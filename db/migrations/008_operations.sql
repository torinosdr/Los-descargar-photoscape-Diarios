-- 008 · Operaciones: tareas, tickets, llamadas, agenda, notas, archivos, recordatorios,
--       notificaciones y anuncios

create table tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  title text not null,
  description text,
  customer_id uuid,
  lead_id uuid,
  project_id uuid,
  parent_task_id uuid,
  assigned_user_id uuid,
  status text not null default 'Pendiente' check (status in ('Pendiente','En Progreso','Completada','Cancelada')),
  priority text not null default 'Media' check (priority in ('Baja','Media','Alta','Urgente')),
  start_date date,
  due_date date,
  completed_at timestamptz,
  billable boolean not null default false,
  visibility text not null default 'Pública' check (visibility in ('Pública','Privada')),
  estimated_minutes int check (estimated_minutes is null or estimated_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, lead_id) references leads (tenant_id, id),
  foreign key (tenant_id, project_id) references projects (tenant_id, id),
  foreign key (tenant_id, parent_task_id) references tasks (tenant_id, id),
  foreign key (tenant_id, assigned_user_id) references users (tenant_id, id),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create unique index tasks_number_uq on tasks (tenant_id, number) where deleted_at is null;
create index tasks_customer_idx on tasks (tenant_id, customer_id) where deleted_at is null;
create index tasks_assignee_idx on tasks (tenant_id, assigned_user_id, status) where deleted_at is null;
create index tasks_project_idx on tasks (tenant_id, project_id) where deleted_at is null;

-- Participantes e invitados de una tarea (además del responsable).
create table task_participants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  task_id uuid not null,
  user_id uuid not null,
  role text not null default 'Invitado' check (role in ('Responsable','Invitado','Seguidor')),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (task_id, user_id),
  foreign key (tenant_id, task_id) references tasks (tenant_id, id) on delete cascade,
  foreign key (tenant_id, user_id) references users (tenant_id, id)
);

-- Horas registradas (base para facturar tareas y proyectos facturables).
create table time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  task_id uuid not null,
  user_id uuid not null,
  started_at timestamptz not null default now(),
  minutes int not null check (minutes > 0),
  billable boolean not null default false,
  notes text,
  invoice_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, task_id) references tasks (tenant_id, id),
  foreign key (tenant_id, user_id) references users (tenant_id, id),
  foreign key (tenant_id, invoice_id) references invoices (tenant_id, id)
);

create table tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  customer_id uuid not null,
  contact_id uuid,
  sale_id uuid,
  subject text not null,
  description text,
  priority text not null default 'Media' check (priority in ('Baja','Media','Alta','Urgente')),
  status text not null default 'Abierto' check (status in ('Abierto','En Progreso','Esperando Cliente','Resuelto','Cerrado')),
  channel text not null default 'Manual' check (channel in ('Manual','Email','Portal','WhatsApp','Teléfono')),
  assigned_user_id uuid,
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, contact_id) references customer_contacts (tenant_id, id),
  foreign key (tenant_id, sale_id) references sales (tenant_id, id),
  foreign key (tenant_id, assigned_user_id) references users (tenant_id, id)
);
create unique index tickets_number_uq on tickets (tenant_id, number) where deleted_at is null;
create index tickets_customer_idx on tickets (tenant_id, customer_id) where deleted_at is null;
create index tickets_status_idx on tickets (tenant_id, status) where deleted_at is null;
create index tickets_subject_trgm on tickets using gin (subject gin_trgm_ops);

create table ticket_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ticket_id uuid not null,
  author_type text not null check (author_type in ('Usuario','Cliente','Sistema')),
  author_user_id uuid,
  author_contact_id uuid,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, ticket_id) references tickets (tenant_id, id) on delete cascade,
  foreign key (tenant_id, author_user_id) references users (tenant_id, id),
  foreign key (tenant_id, author_contact_id) references customer_contacts (tenant_id, id)
);
create index ticket_messages_ticket_idx on ticket_messages (tenant_id, ticket_id, created_at);

create table calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  occurred_at timestamptz not null default now(),
  direction text not null check (direction in ('Entrante','Saliente')),
  customer_id uuid,
  lead_id uuid,
  contact_id uuid,
  user_id uuid,
  subject text not null,
  duration_minutes int not null default 0 check (duration_minutes >= 0),
  outcome text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, lead_id) references leads (tenant_id, id),
  foreign key (tenant_id, contact_id) references customer_contacts (tenant_id, id),
  foreign key (tenant_id, user_id) references users (tenant_id, id)
);
create index calls_customer_idx on calls (tenant_id, customer_id, occurred_at desc) where deleted_at is null;
create index calls_lead_idx on calls (tenant_id, lead_id, occurred_at desc) where deleted_at is null;

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  title text not null,
  event_type text not null default 'Cita' check (event_type in ('Cita','Reunión','Llamada','Tarea','Recordatorio','Otro')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  owner_user_id uuid,
  customer_id uuid,
  lead_id uuid,
  project_id uuid,
  task_id uuid,
  location text,
  description text,
  visibility text not null default 'Pública' check (visibility in ('Pública','Privada')),
  status text not null default 'Programada' check (status in ('Programada','Completada','Cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, owner_user_id) references users (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, lead_id) references leads (tenant_id, id),
  foreign key (tenant_id, project_id) references projects (tenant_id, id),
  foreign key (tenant_id, task_id) references tasks (tenant_id, id),
  check (ends_at >= starts_at)
);
create index calendar_owner_idx on calendar_events (tenant_id, owner_user_id, starts_at) where deleted_at is null;
create index calendar_customer_idx on calendar_events (tenant_id, customer_id, starts_at) where deleted_at is null;

create table calendar_attendees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  event_id uuid not null,
  user_id uuid,
  email text,
  response text not null default 'Pendiente' check (response in ('Pendiente','Aceptó','Rechazó','Tentativo')),
  unique (tenant_id, id),
  foreign key (tenant_id, event_id) references calendar_events (tenant_id, id) on delete cascade,
  foreign key (tenant_id, user_id) references users (tenant_id, id),
  check (user_id is not null or email is not null)
);

-- Notas, archivos y recordatorios: pertenecen a una entidad (cliente, lead, proyecto…).
-- Vínculo polimórfico (linked_type + linked_id); la capa de servicio valida que exista.
create table notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  linked_type text not null check (linked_type in ('customer','lead','project','ticket','sale','quote','purchase','supplier','task','invoice')),
  linked_id uuid not null,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id)
);
create index notes_link_idx on notes (tenant_id, linked_type, linked_id, created_at desc) where deleted_at is null;

create table files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  linked_type text not null check (linked_type in ('customer','lead','project','ticket','sale','quote','purchase','supplier','task','invoice','product')),
  linked_id uuid not null,
  filename text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  storage_key text not null,            -- clave en el almacenamiento de objetos
  checksum text,
  visibility text not null default 'Interno' check (visibility in ('Interno','Cliente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id)
);
create index files_link_idx on files (tenant_id, linked_type, linked_id) where deleted_at is null;

create table reminders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null,
  linked_type text check (linked_type in ('customer','lead','project','ticket','sale','quote','task','invoice')),
  linked_id uuid,
  remind_at timestamptz not null,
  text text not null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, user_id) references users (tenant_id, id),
  check ((linked_type is null) = (linked_id is null))
);
create index reminders_due_idx on reminders (tenant_id, user_id, remind_at) where done_at is null and deleted_at is null;

create table notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null,
  type text not null,                   -- Ticket, Venta, Cobranza, Stock, Sistema…
  title text not null,
  message text,
  linked_type text,
  linked_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, user_id) references users (tenant_id, id)
);
create index notifications_user_idx on notifications (tenant_id, user_id, created_at desc);
create index notifications_unread_idx on notifications (tenant_id, user_id) where read_at is null;

create table announcements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  title text not null,
  message text not null,
  audience text not null default 'Todos' check (audience in ('Todos','Usuarios seleccionados','Clientes')),
  severity text not null default 'info' check (severity in ('info','aviso','crítico')),
  status text not null default 'Borrador' check (status in ('Borrador','Publicado','Archivado')),
  show_customer_frontend boolean not null default false,
  publish_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  check (expires_at is null or publish_at is null or expires_at > publish_at)
);

create table announcement_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  announcement_id uuid not null,
  user_id uuid not null,
  read_at timestamptz,
  unique (announcement_id, user_id),
  foreign key (tenant_id, announcement_id) references announcements (tenant_id, id) on delete cascade,
  foreign key (tenant_id, user_id) references users (tenant_id, id)
);
