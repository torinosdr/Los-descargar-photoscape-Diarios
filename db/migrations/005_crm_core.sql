-- 005 · CRM base: leads y proyectos (los proyectos se facturan, por eso van antes de ventas)

create table leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  name text not null,
  email text,
  phone text,
  company text,
  source text,                          -- Web, Instagram, Referido…
  owner_user_id uuid,
  status text not null default 'Nuevo' check (status in (
    'Nuevo','Contactado','Calificado','Propuesta Enviada','Negociación','Ganado','Perdido')),
  temperature text check (temperature in ('Frío','Tibio','Caliente')),
  estimated_value_minor bigint not null default 0 check (estimated_value_minor >= 0),
  currency char(3) references currencies(code),
  lost_reason text,
  next_action_at timestamptz,
  converted_customer_id uuid,
  converted_at timestamptz,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, owner_user_id) references users (tenant_id, id),
  foreign key (tenant_id, converted_customer_id) references customers (tenant_id, id),
  check (status <> 'Ganado' or converted_customer_id is not null)
);
create unique index leads_number_uq on leads (tenant_id, number) where deleted_at is null;
create index leads_status_idx on leads (tenant_id, status) where deleted_at is null;
create index leads_name_trgm on leads using gin (name gin_trgm_ops);
create index leads_company_trgm on leads using gin (company gin_trgm_ops);

create table projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  customer_id uuid,
  name text not null,
  description text,
  status text not null default 'Planificado' check (status in ('Planificado','En Progreso','En Pausa','Completado','Cancelado')),
  start_date date,
  due_date date,
  owner_user_id uuid,
  billable boolean not null default false,
  billing_mode text not null default 'No facturable' check (billing_mode in ('No facturable','Precio fijo','Por horas')),
  budget_minor bigint not null default 0 check (budget_minor >= 0),
  currency char(3) references currencies(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, owner_user_id) references users (tenant_id, id),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create unique index projects_number_uq on projects (tenant_id, number) where deleted_at is null;
create index projects_customer_idx on projects (tenant_id, customer_id) where deleted_at is null;

-- Miembros internos e invitados externos de un proyecto.
create table project_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  project_id uuid not null,
  user_id uuid,
  guest_name text,
  guest_email text,
  role text not null default 'Miembro' check (role in ('Responsable','Miembro','Invitado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  unique (tenant_id, id),
  foreign key (tenant_id, project_id) references projects (tenant_id, id) on delete cascade,
  foreign key (tenant_id, user_id) references users (tenant_id, id),
  check (user_id is not null or guest_email is not null)
);
create unique index project_members_user_uq on project_members (project_id, user_id) where user_id is not null;
