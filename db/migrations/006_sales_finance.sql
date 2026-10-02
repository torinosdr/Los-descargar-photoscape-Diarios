-- 006 · Ventas y finanzas: presupuestos, ventas, facturas, cuentas por cobrar, pagos,
--       billetera, devoluciones y notas de crédito
--
-- Totales de cabecera (derivados por trigger, ver 010):
--   subtotal = suma de líneas (ya sin descuento de línea)
--   total    = subtotal − descuento + impuestos (solo si los precios NO incluyen impuesto) + envío

create table quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  customer_id uuid not null,
  project_id uuid,
  status text not null default 'Borrador' check (status in (
    'Borrador','Enviado','Visto','Aceptado','Rechazado','Vencido','Convertido a Venta')),
  quote_date date not null default current_date,
  valid_until date,
  currency char(3) not null references currencies(code),
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  prices_include_tax boolean not null default false,
  subtotal_minor bigint not null default 0,
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0,
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  total_minor bigint not null default 0,
  public_token text not null default encode(gen_random_bytes(24), 'hex'),   -- enlace público: /q/<token>
  sent_at timestamptz, viewed_at timestamptz, accepted_at timestamptz, rejected_at timestamptz,
  rejected_reason text,
  accepted_by_name text,
  assigned_user_id uuid,
  converted_sale_id uuid,
  notes text,
  terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, project_id) references projects (tenant_id, id),
  foreign key (tenant_id, assigned_user_id) references users (tenant_id, id),
  check ((status = 'Convertido a Venta') = (converted_sale_id is not null)),
  check (valid_until is null or valid_until >= quote_date)
);
create unique index quotes_number_uq on quotes (tenant_id, number) where deleted_at is null;
create unique index quotes_token_uq on quotes (public_token);
create index quotes_customer_idx on quotes (tenant_id, customer_id) where deleted_at is null;
create index quotes_status_idx on quotes (tenant_id, status) where deleted_at is null;

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  quote_id uuid not null,
  sort_order int not null default 0,
  product_id uuid,
  variation_id uuid,
  description text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_rate_id uuid,
  tax_rate_percent numeric(7,4) not null default 0,
  tax_minor bigint not null default 0,
  line_total_minor bigint generated always as (round(quantity * unit_price_minor)::bigint - discount_minor) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, quote_id) references quotes (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, variation_id) references product_variations (tenant_id, id),
  foreign key (tenant_id, tax_rate_id) references tax_rates (tenant_id, id),
  check (discount_minor <= round(quantity * unit_price_minor))
);
create index quote_items_quote_idx on quote_items (tenant_id, quote_id);

create table sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  customer_id uuid not null,
  quote_id uuid,
  project_id uuid,
  source text not null default 'Manual' check (source in ('Manual','Web','POS','Portal B2B','MercadoLibre')),
  external_ref text,                    -- id de orden en el canal de origen (ej.: MercadoLibre)
  status text not null default 'Pendiente de Pago' check (status in (
    'Pendiente de Pago','Pago Parcial','Pagado','En Preparación','Enviado','Entregado','Completado','Cancelado','Devuelto')),
  payment_status text not null default 'Pendiente' check (payment_status in ('Pendiente','Parcial','Pagado')),
  sold_at timestamptz not null default now(),
  due_date date,
  payment_terms_days int not null default 0 check (payment_terms_days >= 0),
  currency char(3) not null references currencies(code),
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  prices_include_tax boolean not null default false,
  subtotal_minor bigint not null default 0,
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0,
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  total_minor bigint not null default 0,
  paid_minor bigint not null default 0 check (paid_minor >= 0),            -- lo mantiene el trigger de imputaciones
  open_minor bigint generated always as (greatest(total_minor - paid_minor, 0)) stored,
  warehouse_id uuid,
  assigned_user_id uuid,
  billing_address jsonb,
  shipping_address jsonb,
  tracking_number text,
  notes text,
  cancelled_at timestamptz,
  cancel_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, quote_id) references quotes (tenant_id, id),
  foreign key (tenant_id, project_id) references projects (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id),
  foreign key (tenant_id, assigned_user_id) references users (tenant_id, id)
);
create unique index sales_number_uq on sales (tenant_id, number) where deleted_at is null;
create unique index sales_external_uq on sales (tenant_id, source, external_ref) where external_ref is not null;
create unique index sales_quote_uq on sales (quote_id) where quote_id is not null and deleted_at is null;
create index sales_customer_idx on sales (tenant_id, customer_id, sold_at desc) where deleted_at is null;
create index sales_status_idx on sales (tenant_id, status) where deleted_at is null;

alter table quotes add foreign key (tenant_id, converted_sale_id) references sales (tenant_id, id) deferrable initially deferred;

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  sale_id uuid not null,
  sort_order int not null default 0,
  product_id uuid,
  variation_id uuid,
  warehouse_id uuid,                    -- null = depósito de la venta
  description text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  quantity_returned numeric(14,3) not null default 0 check (quantity_returned >= 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  unit_cost_minor bigint check (unit_cost_minor is null or unit_cost_minor >= 0),   -- costo al vender (margen)
  tax_rate_id uuid,
  tax_rate_percent numeric(7,4) not null default 0,
  tax_minor bigint not null default 0,
  line_total_minor bigint generated always as (round(quantity * unit_price_minor)::bigint - discount_minor) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, sale_id) references sales (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, variation_id) references product_variations (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id),
  foreign key (tenant_id, tax_rate_id) references tax_rates (tenant_id, id),
  check (discount_minor <= round(quantity * unit_price_minor)),
  check (quantity_returned <= quantity)
);
create index sale_items_sale_idx on sale_items (tenant_id, sale_id);
create index sale_items_product_idx on sale_items (tenant_id, product_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  document_type text not null default 'Factura' check (document_type in ('Factura','Nota de Débito','Recibo','Proforma')),
  document_letter text check (document_letter in ('A','B','C','E','M')),
  point_of_sale_id uuid,
  fiscal_number int,                    -- número fiscal correlativo (futuro: AFIP)
  customer_id uuid not null,
  sale_id uuid,
  project_id uuid,
  status text not null default 'Pendiente' check (status in ('Borrador','Pendiente','Pago Parcial','Pagada','Anulada')),
  issue_date date not null default current_date,
  due_date date,
  currency char(3) not null references currencies(code),
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  prices_include_tax boolean not null default false,
  subtotal_minor bigint not null default 0,
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0,
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  total_minor bigint not null default 0,
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  credited_minor bigint not null default 0 check (credited_minor >= 0),
  open_minor bigint generated always as (greatest(total_minor - paid_minor - credited_minor, 0)) stored,
  customer_snapshot jsonb,              -- razón social, CUIT y domicilio al momento de emitir
  fiscal_status text not null default 'No fiscal' check (fiscal_status in ('No fiscal','Pendiente','Autorizada','Rechazada')),
  fiscal_cae text,
  fiscal_cae_due_date date,
  fiscal_payload jsonb,
  notes text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, sale_id) references sales (tenant_id, id),
  foreign key (tenant_id, project_id) references projects (tenant_id, id),
  foreign key (tenant_id, point_of_sale_id) references points_of_sale (tenant_id, id),
  check (due_date is null or due_date >= issue_date)
);
create unique index invoices_number_uq on invoices (tenant_id, number) where deleted_at is null;
create unique index invoices_fiscal_uq on invoices (tenant_id, point_of_sale_id, document_letter, fiscal_number)
  where fiscal_number is not null and deleted_at is null;
create index invoices_customer_idx on invoices (tenant_id, customer_id) where deleted_at is null;
create index invoices_sale_idx on invoices (tenant_id, sale_id) where deleted_at is null;

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  invoice_id uuid not null,
  sort_order int not null default 0,
  product_id uuid,
  variation_id uuid,
  description text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_rate_id uuid,
  tax_rate_percent numeric(7,4) not null default 0,
  tax_minor bigint not null default 0,
  line_total_minor bigint generated always as (round(quantity * unit_price_minor)::bigint - discount_minor) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, invoice_id) references invoices (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references products (tenant_id, id),
  foreign key (tenant_id, variation_id) references product_variations (tenant_id, id),
  foreign key (tenant_id, tax_rate_id) references tax_rates (tenant_id, id),
  check (discount_minor <= round(quantity * unit_price_minor))
);
create index invoice_items_invoice_idx on invoice_items (tenant_id, invoice_id);

create table accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  customer_id uuid not null,
  sale_id uuid,
  invoice_id uuid,
  issue_date date not null default current_date,
  due_date date not null,
  currency char(3) not null references currencies(code),
  original_minor bigint not null check (original_minor > 0),
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  credited_minor bigint not null default 0 check (credited_minor >= 0),
  open_minor bigint generated always as (greatest(original_minor - paid_minor - credited_minor, 0)) stored,
  status text not null default 'Abierta' check (status in ('Abierta','Parcial','Pagada','Anulada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, sale_id) references sales (tenant_id, id),
  foreign key (tenant_id, invoice_id) references invoices (tenant_id, id),
  check (paid_minor + credited_minor <= original_minor),
  check (due_date >= issue_date)
);
create unique index ar_invoice_uq on accounts_receivable (invoice_id) where invoice_id is not null and deleted_at is null;
create index ar_customer_idx on accounts_receivable (tenant_id, customer_id) where deleted_at is null;
create index ar_due_idx on accounts_receivable (tenant_id, due_date) where deleted_at is null and status in ('Abierta','Parcial');
create index ar_sale_idx on accounts_receivable (tenant_id, sale_id) where deleted_at is null;

-- Pagos (entrada: cobros de clientes; salida: pagos a proveedores o reembolsos).
-- El registro es manual hoy; las columnas provider_* dejan lista la conexión a una pasarela
-- (Mercado Pago, Stripe…) sin cambiar el modelo.
create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  direction text not null check (direction in ('Entrada','Salida')),
  customer_id uuid,
  supplier_id uuid,
  method text not null check (method in (
    'Efectivo','Transferencia','Tarjeta de crédito','Tarjeta de débito','Cheque','Billetera','Mercado Pago','Stripe','Otro')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null references currencies(code),
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  paid_at timestamptz not null default now(),
  reference text,
  status text not null default 'Confirmado' check (status in ('Pendiente','Confirmado','Rechazado','Reembolsado','Anulado')),
  allocated_minor bigint not null default 0 check (allocated_minor >= 0),
  unallocated_minor bigint generated always as (amount_minor - allocated_minor) stored,
  provider text,
  provider_payment_id text,
  provider_status text,
  provider_payload jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, supplier_id) references suppliers (tenant_id, id),
  check (num_nonnulls(customer_id, supplier_id) = 1),
  check (direction = 'Salida' or customer_id is not null),
  check (allocated_minor <= amount_minor)
);
create unique index payments_number_uq on payments (tenant_id, number) where deleted_at is null;
create unique index payments_provider_uq on payments (tenant_id, provider, provider_payment_id) where provider_payment_id is not null;
create index payments_customer_idx on payments (tenant_id, customer_id, paid_at desc) where deleted_at is null;
create index payments_supplier_idx on payments (tenant_id, supplier_id, paid_at desc) where deleted_at is null;

-- Imputación de un pago a una cuenta por cobrar (o por pagar, ver 007).
create table payment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  payment_id uuid not null,
  receivable_id uuid,
  payable_id uuid,                      -- FK compuesta se agrega en 007
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (tenant_id, id),
  foreign key (tenant_id, payment_id) references payments (tenant_id, id),
  foreign key (tenant_id, receivable_id) references accounts_receivable (tenant_id, id),
  check (num_nonnulls(receivable_id, payable_id) = 1)
);
create index payment_allocations_payment_idx on payment_allocations (tenant_id, payment_id);
create index payment_allocations_ar_idx on payment_allocations (tenant_id, receivable_id) where receivable_id is not null;
create index payment_allocations_ap_idx on payment_allocations (tenant_id, payable_id) where payable_id is not null;

-- Billetera del cliente: libro mayor inmutable. El saldo es la suma de signed_minor.
create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  customer_id uuid not null,
  occurred_at timestamptz not null default now(),
  type text not null check (type in (
    'Carga','Devolución','Ajuste positivo','Ajuste negativo','Aplicación a deuda','Pago con billetera','Retiro')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null references currencies(code),
  signed_minor bigint not null,         -- lo fija el trigger según el tipo
  balance_after_minor bigint not null,  -- idem (saldo corrido por cliente y moneda)
  payment_id uuid,
  reference_type text,                  -- sale | receivable | sale_return | manual
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, payment_id) references payments (tenant_id, id)
);
create index wallet_customer_idx on wallet_transactions (tenant_id, customer_id, currency, occurred_at);
create trigger wallet_transactions_immutable before update or delete on wallet_transactions
  for each row execute function forbid_mutation();

create table sale_returns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  sale_id uuid not null,
  customer_id uuid not null,
  status text not null default 'Solicitada' check (status in ('Solicitada','Aprobada','Recibida','Reembolsada','Rechazada','Cerrada')),
  reason text,
  refund_method text not null default 'Billetera' check (refund_method in ('Billetera','Efectivo','Transferencia','Nota de crédito','Sin reembolso')),
  currency char(3) not null references currencies(code),
  subtotal_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  total_minor bigint not null default 0,
  warehouse_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, sale_id) references sales (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, warehouse_id) references warehouses (tenant_id, id)
);
create unique index sale_returns_number_uq on sale_returns (tenant_id, number) where deleted_at is null;
create index sale_returns_sale_idx on sale_returns (tenant_id, sale_id) where deleted_at is null;

create table sale_return_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  sale_return_id uuid not null,
  sale_item_id uuid not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  tax_minor bigint not null default 0,
  line_total_minor bigint generated always as (round(quantity * unit_price_minor)::bigint) stored,
  restock boolean not null default true,        -- ¿vuelve al inventario?
  condition text,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, sale_return_id) references sale_returns (tenant_id, id) on delete cascade,
  foreign key (tenant_id, sale_item_id) references sale_items (tenant_id, id)
);

create table credit_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  number text,
  customer_id uuid not null,
  invoice_id uuid,
  sale_return_id uuid,
  issue_date date not null default current_date,
  currency char(3) not null references currencies(code),
  subtotal_minor bigint not null default 0,
  tax_minor bigint not null default 0,
  total_minor bigint not null check (total_minor > 0),
  applied_minor bigint not null default 0 check (applied_minor >= 0),
  remaining_minor bigint generated always as (total_minor - applied_minor) stored,
  status text not null default 'Emitida' check (status in ('Emitida','Aplicada','Anulada')),
  reason text,
  fiscal_status text not null default 'No fiscal' check (fiscal_status in ('No fiscal','Pendiente','Autorizada','Rechazada')),
  fiscal_cae text,
  fiscal_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id),
  foreign key (tenant_id, invoice_id) references invoices (tenant_id, id),
  foreign key (tenant_id, sale_return_id) references sale_returns (tenant_id, id),
  check (applied_minor <= total_minor)
);
create unique index credit_notes_number_uq on credit_notes (tenant_id, number) where deleted_at is null;

create table credit_note_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  credit_note_id uuid not null,
  receivable_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (tenant_id, id),
  foreign key (tenant_id, credit_note_id) references credit_notes (tenant_id, id),
  foreign key (tenant_id, receivable_id) references accounts_receivable (tenant_id, id)
);
