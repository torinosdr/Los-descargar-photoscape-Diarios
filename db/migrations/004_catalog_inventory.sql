-- 004 · Catálogo, listas de precios con tramos, proveedores, depósitos e inventario

create table categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,
  slug text,
  parent_category_id uuid,
  status text not null default 'Activo' check (status in ('Activo','Inactivo')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, parent_category_id) references categories (tenant_id, id)
);
create unique index categories_name_uq on categories
  (tenant_id, coalesce(parent_category_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;

create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  sku text not null,
  name text not null,
  description text,
  category_id uuid,
  brand text,
  barcode text,
  unit text not null default 'u',
  currency char(3) not null references currencies(code),
  purchase_price_minor bigint not null default 0 check (purchase_price_minor >= 0),   -- costo
  sale_price_minor bigint not null default 0 check (sale_price_minor >= 0),           -- precio de venta (B2C)
  b2b_price_minor bigint check (b2b_price_minor is null or b2b_price_minor >= 0),     -- precio B2B base
  tax_rate_id uuid,
  weight_kg numeric(10,3) check (weight_kg is null or weight_kg >= 0),
  stock_min numeric(14,3) not null default 0 check (stock_min >= 0),
  track_stock boolean not null default true,
  has_variations boolean not null default false,
  visible_in_store boolean not null default true,
  status text not null default 'Activo' check (status in ('Borrador','Activo','Inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, category_id) references categories (tenant_id, id),
  foreign key (tenant_id, tax_rate_id) references tax_rates (tenant_id, id)
);
create unique index products_sku_uq on products (tenant_id, lower(sku)) where deleted_at is null;
create index products_name_trgm on products using gin (name gin_trgm_ops);
create index products_category_idx on products (tenant_id, category_id) where deleted_at is null;

create table product_variations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  product_id uuid not null,
  sku text not null,
  attributes jsonb not null default '{}',     -- {"Color": "Negro", "Talle": "M"}
  barcode text,
  purchase_price_minor bigint check (purchase_price_minor is null or purchase_price_minor >= 0),
  sale_price_minor bigint check (sale_price_minor is null or sale_price_minor >= 0),
  b2b_price_minor bigint check (b2b_price_minor is null or b2b_price_minor >= 0),
  weight_kg numeric(10,3) check (weight_kg is null or weight_kg >= 0),
  stock_min numeric(14,3) check (stock_min is null or stock_min >= 0),
  status text not null default 'Activo' check (status in ('Activo','Inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, product_id) references products (tenant_id, id)
);
create unique index product_variations_sku_uq on product_variations (tenant_id, lower(sku)) where deleted_at is null;
create index product_variations_product_idx on product_variations (tenant_id, product_id) where deleted_at is null;

-- Precios por lista y por tramo de cantidad: "desde 10 unidades, precio A; desde 100, precio B".
create table price_list_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  price_list_id uuid not null,
  product_id uuid not null,
  variation_id uuid,
  min_qty numeric(14,3) not null default 1 check (min_qty > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, price_list_id) references price_lists (tenant_id, id),
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, variation_id) references product_variations (tenant_id, id)
);
create unique index price_list_items_uq on price_list_items
  (price_list_id, product_id, coalesce(variation_id, '00000000-0000-0000-0000-000000000000'::uuid), min_qty)
  where deleted_at is null;

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  name text not null,
  legal_name text,
  email text,
  phone text,
  tax_id text,
  contact_name text,
  payment_terms_days int not null default 0 check (payment_terms_days >= 0),
  currency char(3) references currencies(code),
  address jsonb,
  notes text,
  status text not null default 'Activo' check (status in ('Activo','Inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id)
);
create unique index suppliers_number_uq on suppliers (tenant_id, number) where deleted_at is null;
create index suppliers_name_trgm on suppliers using gin (name gin_trgm_ops);

create table warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null,
  name text not null,
  location text,
  address jsonb,
  is_default boolean not null default false,
  status text not null default 'Activo' check (status in ('Activo','Inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, code)
);
create unique index warehouses_default_uq on warehouses (tenant_id) where is_default and deleted_at is null;

-- Existencias por depósito/producto/variación. Se mantienen SOLO por trigger desde
-- stock_movements (existencia) y stock_reservations (reservado): nunca se editan a mano.
create table inventory_levels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  warehouse_id uuid not null,
  product_id uuid not null,
  variation_id uuid,
  quantity_on_hand numeric(14,3) not null default 0 check (quantity_on_hand >= 0),
  reserved_quantity numeric(14,3) not null default 0 check (reserved_quantity >= 0),
  available_quantity numeric(14,3) generated always as (quantity_on_hand - reserved_quantity) stored,
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id),
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, variation_id) references product_variations (tenant_id, id)
);
create unique index inventory_levels_uq on inventory_levels
  (tenant_id, warehouse_id, product_id, coalesce(variation_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Libro de movimientos de stock (inmutable). Un error se corrige con un movimiento inverso.
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  occurred_at timestamptz not null default now(),
  warehouse_id uuid not null,
  product_id uuid not null,
  variation_id uuid,
  movement_type text not null check (movement_type in (
    'Stock inicial','Compra','Venta','Ajuste','Transferencia entrada','Transferencia salida',
    'Devolución de cliente','Devolución a proveedor','Anulación')),
  quantity numeric(14,3) not null check (quantity <> 0),      -- con signo: + entra, − sale
  unit_cost_minor bigint check (unit_cost_minor is null or unit_cost_minor >= 0),
  reference_type text,                                        -- sale | purchase_receipt | adjustment | transfer…
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id),
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, variation_id) references product_variations (tenant_id, id)
);
create index stock_movements_item_idx on stock_movements (tenant_id, product_id, occurred_at desc);
create index stock_movements_ref_idx on stock_movements (tenant_id, reference_type, reference_id);
create trigger stock_movements_immutable before update or delete on stock_movements
  for each row execute function forbid_mutation();

-- Reservas de stock (ej.: venta confirmada y aún no despachada).
create table stock_reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  warehouse_id uuid not null,
  product_id uuid not null,
  variation_id uuid,
  quantity numeric(14,3) not null check (quantity > 0),
  status text not null default 'Activa' check (status in ('Activa','Consumida','Liberada')),
  reference_type text not null,                               -- sale | quote | ml_order
  reference_id uuid not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid,
  unique (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id),
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, variation_id) references product_variations (tenant_id, id)
);
create index stock_reservations_ref_idx on stock_reservations (tenant_id, reference_type, reference_id);
