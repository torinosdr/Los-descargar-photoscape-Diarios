-- 007 · Compras: órdenes, recepciones (parciales), cuentas por pagar y gastos

create table purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  supplier_id uuid not null,
  status text not null default 'Borrador' check (status in (
    'Borrador','Ordenado','Recibido Parcial','Recibido Total','Pagado','Cancelado')),
  payment_status text not null default 'Pendiente' check (payment_status in ('Pendiente','Parcial','Pagado')),
  supplier_invoice_number text,
  purchase_date date not null default current_date,
  expected_date date,
  received_at timestamptz,
  payment_terms_days int not null default 0 check (payment_terms_days >= 0),
  currency char(3) not null references currencies(code),
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  prices_include_tax boolean not null default false,
  subtotal_minor bigint not null default 0,
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0,
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  total_minor bigint not null default 0,
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  open_minor bigint generated always as (greatest(total_minor - paid_minor, 0)) stored,
  warehouse_id uuid,
  notes text,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, supplier_id) references suppliers (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id)
);
create unique index purchases_number_uq on purchases (tenant_id, number) where deleted_at is null;
create index purchases_supplier_idx on purchases (tenant_id, supplier_id, purchase_date desc) where deleted_at is null;
create index purchases_status_idx on purchases (tenant_id, status) where deleted_at is null;

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  purchase_id uuid not null,
  sort_order int not null default 0,
  product_id uuid,
  variation_id uuid,
  description text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  quantity_received numeric(14,3) not null default 0 check (quantity_received >= 0),   -- lo mantiene el trigger de recepciones
  unit_price_minor bigint not null check (unit_price_minor >= 0),                       -- costo unitario
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_rate_id uuid,
  tax_rate_percent numeric(7,4) not null default 0,
  tax_minor bigint not null default 0,
  line_total_minor bigint generated always as (round(quantity * unit_price_minor)::bigint - discount_minor) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, purchase_id) references purchases (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, variation_id) references product_variations (tenant_id, id),
  foreign key (tenant_id, tax_rate_id) references tax_rates (tenant_id, id),
  check (discount_minor <= round(quantity * unit_price_minor)),
  check (quantity_received <= quantity)
);
create index purchase_items_purchase_idx on purchase_items (tenant_id, purchase_id);

create table purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  purchase_id uuid not null,
  warehouse_id uuid not null,
  received_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  unique (tenant_id, id),
  foreign key (tenant_id, purchase_id) references purchases (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id)
);
create unique index purchase_receipts_number_uq on purchase_receipts (tenant_id, number);

create table purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  receipt_id uuid not null,
  purchase_item_id uuid not null,
  quantity numeric(14,3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, receipt_id) references purchase_receipts (tenant_id, id) on delete cascade,
  foreign key (tenant_id, purchase_item_id) references purchase_items (tenant_id, id)
);

create table accounts_payable (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  supplier_id uuid not null,
  purchase_id uuid,
  supplier_invoice_number text,
  issue_date date not null default current_date,
  due_date date not null,
  currency char(3) not null references currencies(code),
  original_minor bigint not null check (original_minor > 0),
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  open_minor bigint generated always as (greatest(original_minor - paid_minor, 0)) stored,
  status text not null default 'Abierta' check (status in ('Abierta','Parcial','Pagada','Anulada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, supplier_id) references suppliers (tenant_id, id),
  foreign key (tenant_id, purchase_id) references purchases (tenant_id, id),
  check (paid_minor <= original_minor),
  check (due_date >= issue_date)
);
create index ap_supplier_idx on accounts_payable (tenant_id, supplier_id) where deleted_at is null;
create index ap_due_idx on accounts_payable (tenant_id, due_date) where deleted_at is null and status in ('Abierta','Parcial');
create index ap_purchase_idx on accounts_payable (tenant_id, purchase_id) where deleted_at is null;

alter table payment_allocations
  add foreign key (tenant_id, payable_id) references accounts_payable (tenant_id, id);

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  status text not null default 'Activo' check (status in ('Activo','Inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, name)
);

-- Gastos que no son mercadería (servicios, alquileres, impuestos…).
create table expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  expense_date date not null default current_date,
  category_id uuid,
  description text not null,
  supplier_id uuid,
  project_id uuid,
  currency char(3) not null references currencies(code),
  amount_minor bigint not null check (amount_minor > 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  payment_method text check (payment_method in (
    'Efectivo','Transferencia','Tarjeta de crédito','Tarjeta de débito','Cheque','Mercado Pago','Otro')),
  status text not null default 'Pendiente' check (status in ('Pendiente','Pagado','Anulado')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, category_id) references expense_categories (tenant_id, id),
  foreign key (tenant_id, supplier_id) references suppliers (tenant_id, id),
  foreign key (tenant_id, project_id) references projects (tenant_id, id),
  check (status <> 'Pagado' or paid_at is not null)
);
create unique index expenses_number_uq on expenses (tenant_id, number) where deleted_at is null;
create index expenses_date_idx on expenses (tenant_id, expense_date desc) where deleted_at is null;
