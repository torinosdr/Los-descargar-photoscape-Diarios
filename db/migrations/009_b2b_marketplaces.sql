-- 009 · B2B (motor de reglas dinámicas) y MercadoLibre (estructura preparada)

-- Reglas: "Si [grupo = Mayorista] Y [cantidad >= 10] entonces [precio = X / descuento = Y%]".
-- Menor número de prioridad = se evalúa primero. Requiere la función "dynamic_rules".
create table dynamic_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  description text,
  customer_group_id uuid,               -- filtro rápido (también se puede expresar como condición)
  product_id uuid,
  category_id uuid,
  priority int not null default 100,
  status text not null default 'Activa' check (status in ('Borrador','Activa','Inactiva')),
  valid_from date,
  valid_until date,
  stop_processing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_group_id) references customer_groups (tenant_id, id),
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, category_id) references categories (tenant_id, id),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);
create index dynamic_rules_active_idx on dynamic_rules (tenant_id, priority) where status = 'Activa' and deleted_at is null;

create table rule_conditions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  rule_id uuid not null,
  sort_order int not null default 0,
  field text not null check (field in (
    'customer_group','customer_type','customer','product','category','sku','quantity','cart_total','currency')),
  operator text not null check (operator in ('=','!=','>','>=','<','<=','in','not_in','between')),
  value jsonb not null,
  unique (tenant_id, id),
  foreign key (tenant_id, rule_id) references dynamic_rules (tenant_id, id) on delete cascade
);

create table rule_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  rule_id uuid not null,
  sort_order int not null default 0,
  action_type text not null check (action_type in (
    'set_price','percent_discount','fixed_discount','free_shipping','min_order','hide_product','tax_exempt')),
  value jsonb not null,                 -- set_price/fixed_discount/min_order: {"amount_minor": n}; percent_discount: {"percent": n}
  unique (tenant_id, id),
  foreign key (tenant_id, rule_id) references dynamic_rules (tenant_id, id) on delete cascade
);

-- ===== MercadoLibre: sin integración real todavía, pero con el modelo definitivo =====

create table ml_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ml_user_id text not null,
  nickname text,
  site_id text not null default 'MLA',
  status text not null default 'Pendiente' check (status in ('Pendiente','Conectada','Error','Desconectada')),
  access_token_enc text,                -- cifrado en la aplicación
  refresh_token_enc text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, ml_user_id)
);

create table ml_publications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ml_account_id uuid,
  product_id uuid not null,
  variation_id uuid,
  ml_item_id text,
  title text not null,
  status text not null default 'Preparado' check (status in ('Preparado','Activa','Pausada','Cerrada','Error')),
  price_minor bigint not null check (price_minor >= 0),
  currency char(3) not null references currencies(code),
  stock_quantity numeric(14,3) not null default 0 check (stock_quantity >= 0),
  listing_type text,
  permalink text,
  sync_error text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, ml_account_id) references ml_accounts (tenant_id, id),
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, variation_id) references product_variations (tenant_id, id)
);
create unique index ml_publications_item_uq on ml_publications (tenant_id, ml_item_id) where ml_item_id is not null and deleted_at is null;

-- Órdenes de MercadoLibre. Al importarlas se transforman en una venta (sales) con
-- source = 'MercadoLibre', external_ref = ml_order_id y estado 'Pagado'.
create table ml_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ml_account_id uuid,
  ml_order_id text not null,
  buyer_nickname text,
  customer_email text,
  customer_id uuid,
  sale_id uuid,
  status text not null default 'Pendiente' check (status in ('Pendiente','Pagado','Enviado','Entregado','Cancelado')),
  total_minor bigint not null check (total_minor >= 0),
  currency char(3) not null references currencies(code),
  raw_payload jsonb,
  ordered_at timestamptz,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, ml_order_id),
  foreign key (tenant_id, ml_account_id) references ml_accounts (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, sale_id) references sales (tenant_id, id)
);

create table ml_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  ml_account_id uuid,
  ml_question_id text,
  ml_item_id text not null,
  publication_id uuid,
  question text not null,
  answer text,
  status text not null default 'Sin responder' check (status in ('Sin responder','Respondida','Eliminada')),
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  answered_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, ml_account_id) references ml_accounts (tenant_id, id),
  foreign key (tenant_id, publication_id) references ml_publications (tenant_id, id)
);
create unique index ml_questions_ml_uq on ml_questions (tenant_id, ml_question_id) where ml_question_id is not null;

create table ml_stock_sync (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  publication_id uuid,
  product_id uuid not null,
  variation_id uuid,
  warehouse_id uuid,
  ml_item_id text,
  local_stock numeric(14,3) not null default 0,
  ml_stock numeric(14,3) not null default 0,
  direction text not null default 'Bidireccional' check (direction in ('Local → ML','ML → Local','Bidireccional')),
  status text not null default 'Preparado' check (status in ('Preparado','Pendiente','Sincronizado','Error')),
  error text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, publication_id) references ml_publications (tenant_id, id),
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, variation_id) references product_variations (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id)
);
