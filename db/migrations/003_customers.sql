-- 003 · Clientes: listas de precios, grupos, clientes, contactos y subcuentas B2B

create table price_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null,                   -- PVP, MAYORISTA…
  name text not null,
  description text,
  currency char(3) not null references currencies(code),
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, code)
);
create unique index price_lists_default_uq on price_lists (tenant_id) where is_default and deleted_at is null;

create table customer_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  description text,
  is_b2b boolean not null default false,
  default_price_list_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, name),
  foreign key (tenant_id, default_price_list_id) references price_lists (tenant_id, id)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,                          -- CLI-0001 (trigger)
  customer_type text not null check (customer_type in ('B2C','B2B')),
  person_type text not null check (person_type in ('Persona Física','Empresa')),
  first_name text,
  last_name text,
  company_name text,
  display_name text generated always as (
    coalesce(nullif(btrim(company_name), ''),
             nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''))
  ) stored,
  email text,
  phone text,
  tax_id text,                          -- CUIT/CUIL/DNI
  tax_condition text,                   -- Responsable Inscripto, Monotributo, Consumidor Final…
  customer_group_id uuid,
  assigned_user_id uuid,
  status text not null default 'Activo' check (status in ('Activo','Inactivo','Bloqueado')),
  currency char(3) references currencies(code),     -- null = moneda base del tenant
  credit_limit_minor bigint check (credit_limit_minor is null or credit_limit_minor >= 0),
  payment_terms_days int not null default 0 check (payment_terms_days >= 0),
  billing_address jsonb,
  shipping_address jsonb,
  source text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_group_id) references customer_groups (tenant_id, id),
  foreign key (tenant_id, assigned_user_id) references users (tenant_id, id),
  check (customer_type <> 'B2C' or person_type = 'Persona Física'),
  check (person_type <> 'Empresa' or nullif(btrim(company_name), '') is not null),
  check (person_type <> 'Persona Física' or coalesce(nullif(btrim(first_name), ''), nullif(btrim(last_name), '')) is not null)
);
create unique index customers_number_uq on customers (tenant_id, number) where deleted_at is null;
create unique index customers_tax_id_uq on customers (tenant_id, tax_id) where tax_id is not null and deleted_at is null;
create index customers_name_trgm on customers using gin (display_name gin_trgm_ops);
create index customers_email_trgm on customers using gin (email gin_trgm_ops);
create index customers_group_idx on customers (tenant_id, customer_group_id) where deleted_at is null;

create table customer_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  customer_id uuid not null,
  name text not null,
  email text,
  phone text,
  position text,
  is_primary boolean not null default false,
  status text not null default 'Activo' check (status in ('Activo','Inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id)
);
create unique index customer_contacts_primary_uq on customer_contacts (customer_id) where is_primary and deleted_at is null;
create index customer_contacts_customer_idx on customer_contacts (tenant_id, customer_id) where deleted_at is null;
create index customer_contacts_name_trgm on customer_contacts using gin (name gin_trgm_ops);

-- Subcuentas B2B: usuarios del portal de una empresa cliente con permisos granulares.
-- Requiere la función "subaccounts" del plan (se valida en la capa de servicio).
create table customer_subaccounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  customer_id uuid not null,
  contact_id uuid,
  name text not null,
  email text not null,
  password_hash text,
  permissions jsonb not null default '{"can_order": true, "can_view_invoices": false, "can_view_prices": true, "can_manage_users": false}',
  spending_limit_minor bigint check (spending_limit_minor is null or spending_limit_minor >= 0),
  status text not null default 'Activo' check (status in ('Activo','Invitado','Suspendido')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, contact_id) references customer_contacts (tenant_id, id)
);
create unique index customer_subaccounts_email_uq on customer_subaccounts (tenant_id, lower(email)) where deleted_at is null;
