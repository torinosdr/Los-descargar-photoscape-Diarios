-- 002 · Tenancy, identidad, permisos, configuración, numeración, impuestos y auditoría

create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text not null,
  legal_name text,
  tax_id text,
  status text not null default 'Activo' check (status in ('Activo','Prueba','Suspendido','Cancelado')),
  plan_id uuid not null references plans(id),
  base_currency char(3) not null default 'ARS' references currencies(code),
  default_locale text not null default 'es-AR' references locales(code),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  country char(2) not null default 'AR',
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  plan_id uuid not null references plans(id),
  status text not null default 'Activa' check (status in ('Prueba','Activa','Vencida','Cancelada')),
  period_start date not null default current_date,
  period_end date,
  provider text, provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id)
);

-- Excepciones por tenant sobre lo que da el plan (ej.: habilitar una función a un cliente).
create table tenant_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  feature_id uuid not null references features(id),
  enabled boolean not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, feature_id)
);

-- Super administradores de la plataforma SaaS (fuera de cualquier tenant).
create table platform_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text not null,
  status text not null default 'Activo' check (status in ('Activo','Suspendido')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
create unique index platform_admins_email_uq on platform_admins (lower(email)) where deleted_at is null;

create table roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null,                   -- admin | gerente | vendedor | contable | lectura | personalizado
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, code)
);

create table role_permissions (
  tenant_id uuid not null references tenants(id),
  role_id uuid not null,
  permission_code text not null references permissions(code),
  primary key (role_id, permission_code),
  foreign key (tenant_id, role_id) references roles (tenant_id, id) on delete cascade
);

create table users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  email text not null,
  name text not null,
  password_hash text,
  role_id uuid not null,
  status text not null default 'Activo' check (status in ('Activo','Invitado','Suspendido')),
  is_owner boolean not null default false,
  locale text references locales(code),         -- null = idioma por defecto del tenant
  timezone text,
  avatar_url text,
  mfa_secret text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, role_id) references roles (tenant_id, id)
);
-- El email es único en toda la plataforma: el login lo resuelve antes de conocer el tenant.
create unique index users_email_uq on users (lower(email)) where deleted_at is null;
create index users_tenant_idx on users (tenant_id) where deleted_at is null;

create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null,
  refresh_token_hash text not null,
  user_agent text, ip inet,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade
);
create index auth_sessions_user_idx on auth_sessions (user_id) where revoked_at is null;

create table password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade
);

create table user_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  email text not null,
  role_id uuid not null,
  token_hash text not null unique,
  invited_by uuid,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, role_id) references roles (tenant_id, id)
);

create table tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  category text not null,               -- Ventas | Finanzas | ML | Inventario | General
  setting_key text not null,
  value jsonb not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, category, setting_key)
);

create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  from_currency char(3) not null references currencies(code),
  to_currency char(3) not null references currencies(code),
  rate numeric(18,8) not null check (rate > 0),
  valid_on date not null default current_date,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, from_currency, to_currency, valid_on),
  check (from_currency <> to_currency)
);

-- Numeración correlativa legible por tenant (SAL-0001, FAC-0001…).
-- scope permite series separadas (ej.: punto de venta de una factura).
create table document_sequences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  doc_type text not null,
  scope text not null default '',
  prefix text not null,
  padding smallint not null default 4 check (padding between 1 and 12),
  next_value bigint not null default 1 check (next_value >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  unique (tenant_id, id),
  unique (tenant_id, doc_type, scope)
);

create table tax_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null,
  name text not null,
  kind text not null default 'IVA' check (kind in ('IVA','Exento','No gravado','Percepción','Otro')),
  rate_percent numeric(7,4) not null check (rate_percent >= 0 and rate_percent <= 100),
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, code)
);
create unique index tax_rates_default_uq on tax_rates (tenant_id) where is_default and deleted_at is null;

-- Puntos de venta: base para numeración fiscal futura (AFIP u otros).
create table points_of_sale (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number int not null check (number > 0),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, number)
);

-- Bitácora de auditoría (append-only). Se llena por trigger (ver 012).
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  user_id uuid,
  entity text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  ip inet,
  request_id text,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on audit_log (tenant_id, entity, entity_id, created_at desc);
create index audit_log_time_idx on audit_log (tenant_id, created_at desc);
create trigger audit_log_immutable before update or delete on audit_log
  for each row execute function forbid_mutation();

-- Funciones de plan: ¿tiene este tenant la función X? (plan + excepciones)
create function tenant_has_feature(p_tenant uuid, p_feature text) returns boolean
language sql stable as $$
  select coalesce(
    (select o.enabled from tenant_feature_overrides o
       join features f on f.id = o.feature_id
      where o.tenant_id = p_tenant and f.code = p_feature and o.deleted_at is null),
    exists (select 1 from tenants t
              join plan_features pf on pf.plan_id = t.plan_id
              join features f on f.id = pf.feature_id
             where t.id = p_tenant and f.code = p_feature)
  )
$$;
