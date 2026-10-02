-- 001 · Fundaciones: extensiones, roles de base de datos y funciones auxiliares
-- Convenciones del proyecto (ver docs/architecture.md):
--   * PK uuid. Cada tabla de negocio tiene tenant_id y UNIQUE (tenant_id, id).
--   * Las FK entre tablas de negocio son COMPUESTAS (tenant_id, x_id): la propia base
--     impide referenciar filas de otro tenant.
--   * Dinero: bigint en unidades menores (centavos) + código de moneda.
--   * Borrado lógico (deleted_at) en maestros y documentos. Libros (ledgers) inmutables.

create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- Roles de base de datos (grupos sin login). La aplicación se conecta con un login
-- que sea miembro de nexo_app. Los procesos de plataforma usan nexo_platform.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nexo_app') then
    create role nexo_app nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'nexo_platform') then
    begin
      create role nexo_platform nologin bypassrls;
    exception when insufficient_privilege then
      -- Hosting gestionado (p. ej. Supabase): postgres no es superusuario y no puede otorgar BYPASSRLS.
      -- El rol queda sin esa marca; los procesos de plataforma se conectan como el propietario (que sí la tiene).
      create role nexo_platform nologin;
    end;
  end if;
end $$;

-- Contexto de la petición: lo fija el backend con SET LOCAL en cada transacción.
create function app_tenant() returns uuid
language sql stable as $$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;

create function app_user() returns uuid
language sql stable as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

-- Sello de auditoría y protección de tenant_id.
create function touch_row() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, app_user());
    new.created_at := coalesce(new.created_at, now());
    new.updated_by := app_user();
    new.updated_at := now();
  else
    if (to_jsonb(new)->>'tenant_id') is distinct from (to_jsonb(old)->>'tenant_id') then
      raise exception 'tenant_id es inmutable' using errcode = 'integrity_constraint_violation';
    end if;
    new.updated_at := now();
    new.updated_by := coalesce(app_user(), old.updated_by);
  end if;
  return new;
end $$;

-- Ledgers y bitácora: solo se agregan filas.
create function forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% es de solo escritura (inmutable): % no permitido', tg_table_name, tg_op
    using errcode = 'restrict_violation';
end $$;

-- Prefijos por defecto de la numeración correlativa por tenant.
create function default_doc_prefix(p_type text) returns text
language sql immutable as $$
  select case p_type
    when 'customer' then 'CLI'   when 'supplier' then 'PRV'  when 'quote' then 'PRE'
    when 'sale' then 'SAL'       when 'invoice' then 'FAC'   when 'payment' then 'PAG'
    when 'sale_return' then 'DEV' when 'credit_note' then 'NC' when 'purchase' then 'COM'
    when 'receipt' then 'REC'    when 'expense' then 'GAS'   when 'lead' then 'LED'
    when 'project' then 'PRY'    when 'task' then 'TSK'      when 'ticket' then 'TCK'
    else upper(left(p_type, 3)) end
$$;

-- Siguiente número legible (SAL-0001) para un tenant y tipo de documento.
-- El UPDATE bloquea la fila: dos transacciones concurrentes nunca reciben el mismo número.
create function next_doc_number(p_tenant uuid, p_type text, p_scope text default '')
returns text language plpgsql as $$
declare v_prefix text; v_pad int; v_n bigint;
begin
  update document_sequences
     set next_value = next_value + 1
   where tenant_id = p_tenant and doc_type = p_type and scope = p_scope
  returning prefix, padding, next_value - 1 into v_prefix, v_pad, v_n;
  if not found then
    insert into document_sequences (tenant_id, doc_type, scope, prefix, next_value)
    values (p_tenant, p_type, p_scope, default_doc_prefix(p_type), 2)
    on conflict (tenant_id, doc_type, scope) do update set next_value = document_sequences.next_value + 1
    returning prefix, padding, next_value - 1 into v_prefix, v_pad, v_n;
  end if;
  return v_prefix || '-' || lpad(v_n::text, v_pad, '0');
end $$;

-- Trigger: asigna number si viene vacío. Argumento: tipo de documento.
create function set_doc_number() returns trigger
language plpgsql as $$
begin
  if new.number is null then
    new.number := next_doc_number(new.tenant_id, tg_argv[0]);
  end if;
  return new;
end $$;

-- Máquina de estados: solo se permiten las transiciones listadas en workflow_transitions.
create function enforce_transition() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if not exists (
      select 1 from workflow_transitions
       where entity = tg_argv[0] and from_status = old.status and to_status = new.status
    ) then
      raise exception 'Transición inválida de % : "%" → "%"', tg_argv[0], old.status, new.status
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

-- Bitácora de auditoría a nivel de base de datos (usuario, tenant, entidad, valores).
create function audit_row() returns trigger
language plpgsql as $$
declare
  v_old jsonb; v_new jsonb; v_row jsonb; v_tenant uuid; v_action text;
  v_redact text[] := array['password_hash','token_hash','refresh_token_hash','access_token_enc','refresh_token_enc','mfa_secret'];
begin
  if tg_op = 'INSERT' then v_new := to_jsonb(new) - v_redact; v_row := v_new; v_action := 'create';
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old) - v_redact; v_new := to_jsonb(new) - v_redact; v_row := v_new;
    if (v_old - 'updated_at' - 'updated_by') = (v_new - 'updated_at' - 'updated_by') then return new; end if;
    v_action := case when v_old->>'deleted_at' is null and v_new->>'deleted_at' is not null then 'delete'
                     when v_old->>'deleted_at' is not null and v_new->>'deleted_at' is null then 'restore'
                     else 'update' end;
  else v_old := to_jsonb(old) - v_redact; v_row := v_old; v_action := 'delete'; end if;
  v_tenant := coalesce((v_row->>'tenant_id')::uuid, case when tg_table_name = 'tenants' then (v_row->>'id')::uuid end);
  insert into audit_log (tenant_id, user_id, entity, entity_id, action, old_value, new_value)
  values (v_tenant, app_user(), tg_table_name, (v_row->>'id')::uuid, v_action, v_old, v_new);
  return coalesce(new, old);
end $$;

-- ===== Catálogos globales (no pertenecen a un tenant) =====

create table currencies (
  code char(3) primary key,
  name text not null,
  symbol text not null,
  minor_unit smallint not null default 2 check (minor_unit between 0 and 4),
  active boolean not null default true
);

create table locales (
  code text primary key,                -- es-AR, en, pt-BR…
  name text not null,
  active boolean not null default true
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- basico | pro | b2b
  name text not null,
  description text,
  price_minor bigint not null default 0 check (price_minor >= 0),
  currency char(3) not null references currencies(code),
  billing_interval text not null default 'mensual' check (billing_interval in ('mensual','anual')),
  max_users int,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table features (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- b2b, crm, dynamic_rules…
  name text not null,
  description text,
  sort_order int not null default 0
);

create table plan_features (
  plan_id uuid not null references plans(id) on delete cascade,
  feature_id uuid not null references features(id) on delete cascade,
  primary key (plan_id, feature_id)
);

create table permissions (
  code text primary key,                -- recurso.acción (customers.read)
  resource text not null,
  action text not null,
  description text
);

create table workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  entity text not null,                 -- Quote | Sale | Purchase | Lead | Ticket
  from_status text not null,
  to_status text not null,
  description text,
  unique (entity, from_status, to_status)
);
