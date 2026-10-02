-- 012 · Aislamiento por tenant (RLS), triggers y permisos de base de datos

-- Sello simple para tablas con updated_at pero sin created_by/updated_by.
create function touch_updated_at() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(new) ? 'tenant_id' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id es inmutable' using errcode = 'integrity_constraint_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ===================== Row Level Security =====================
-- Segunda capa de defensa: aunque la aplicación olvide un WHERE tenant_id = …,
-- la base solo devuelve/modifica filas del tenant fijado en app.tenant_id.
do $$
declare t record;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'tenant_id' and tb.table_type = 'BASE TABLE'
  loop
    execute format('alter table %I enable row level security', t.table_name);
    execute format('alter table %I force row level security', t.table_name);
    execute format('create policy tenant_isolation on %I using (tenant_id = app_tenant()) with check (tenant_id = app_tenant())', t.table_name);
  end loop;
end $$;

alter table tenants enable row level security;
alter table tenants force row level security;
create policy tenant_self on tenants using (id = app_tenant()) with check (id = app_tenant());

-- ===================== Triggers genéricos =====================
do $$
declare t record; has_by boolean;
begin
  for t in
    select tb.table_name
      from information_schema.tables tb
     where tb.table_schema = 'public' and tb.table_type = 'BASE TABLE'
       and exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = tb.table_name and c.column_name = 'updated_at')
  loop
    select exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'created_by')
       and exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = t.table_name and c.column_name = 'updated_by')
      into has_by;
    execute format('create trigger a_touch before insert or update on %I for each row execute function %s()',
                   t.table_name, case when has_by then 'touch_row' else 'touch_updated_at' end);
  end loop;
end $$;

-- Numeración correlativa por tenant
create trigger b_number before insert on customers        for each row execute function set_doc_number('customer');
create trigger b_number before insert on suppliers        for each row execute function set_doc_number('supplier');
create trigger b_number before insert on quotes           for each row execute function set_doc_number('quote');
create trigger b_number before insert on sales            for each row execute function set_doc_number('sale');
create trigger b_number before insert on invoices         for each row execute function set_doc_number('invoice');
create trigger b_number before insert on payments         for each row execute function set_doc_number('payment');
create trigger b_number before insert on sale_returns     for each row execute function set_doc_number('sale_return');
create trigger b_number before insert on credit_notes     for each row execute function set_doc_number('credit_note');
create trigger b_number before insert on purchases        for each row execute function set_doc_number('purchase');
create trigger b_number before insert on purchase_receipts for each row execute function set_doc_number('receipt');
create trigger b_number before insert on expenses         for each row execute function set_doc_number('expense');
create trigger b_number before insert on leads            for each row execute function set_doc_number('lead');
create trigger b_number before insert on projects         for each row execute function set_doc_number('project');
create trigger b_number before insert on tasks            for each row execute function set_doc_number('task');
create trigger b_number before insert on tickets          for each row execute function set_doc_number('ticket');

-- Máquinas de estado
create trigger c_workflow before update of status on quotes    for each row execute function enforce_transition('Quote');
create trigger c_workflow before update of status on sales     for each row execute function enforce_transition('Sale');
create trigger c_workflow before update of status on purchases for each row execute function enforce_transition('Purchase');
create trigger c_workflow before update of status on leads     for each row execute function enforce_transition('Lead');
create trigger c_workflow before update of status on tickets   for each row execute function enforce_transition('Ticket');

-- Totales de documentos
create trigger d_total before insert or update on quotes    for each row execute function derive_header_total();
create trigger d_total before insert or update on sales     for each row execute function derive_header_total();
create trigger d_total before insert or update on invoices  for each row execute function derive_header_total();
create trigger d_total before insert or update on purchases for each row execute function derive_header_total();

create trigger d_line_tax before insert or update on quote_items    for each row execute function compute_line_tax('quotes', 'quote_id');
create trigger d_line_tax before insert or update on sale_items     for each row execute function compute_line_tax('sales', 'sale_id');
create trigger d_line_tax before insert or update on invoice_items  for each row execute function compute_line_tax('invoices', 'invoice_id');
create trigger d_line_tax before insert or update on purchase_items for each row execute function compute_line_tax('purchases', 'purchase_id');

create trigger e_recalc after insert or update or delete on quote_items    for each row execute function recalc_header_from_items('quotes', 'quote_id');
create trigger e_recalc after insert or update or delete on sale_items     for each row execute function recalc_header_from_items('sales', 'sale_id');
create trigger e_recalc after insert or update or delete on invoice_items  for each row execute function recalc_header_from_items('invoices', 'invoice_id');
create trigger e_recalc after insert or update or delete on purchase_items for each row execute function recalc_header_from_items('purchases', 'purchase_id');

-- Inventario
create trigger f_stock after insert on stock_movements for each row execute function apply_stock_movement();
create trigger f_reservation after insert or update or delete on stock_reservations for each row execute function sync_reservation();

-- Billetera
create trigger f_wallet before insert on wallet_transactions for each row execute function wallet_before_insert();

-- Cobranzas, pagos y notas de crédito
create trigger f_alloc_check before insert on payment_allocations for each row execute function allocation_before_insert();
create trigger f_alloc_after after insert or update or delete on payment_allocations for each row execute function allocation_after_change();
create trigger f_payment_status after update of status on payments for each row execute function payment_status_changed();
create trigger f_credit_check before insert on credit_note_applications for each row execute function credit_application_before_insert();
create trigger f_credit_after after insert or update or delete on credit_note_applications for each row execute function credit_application_after_change();

-- Devoluciones y recepciones
create trigger f_return_check before insert on sale_return_items for each row execute function return_item_before_insert();
create trigger f_return_after after insert or update or delete on sale_return_items for each row execute function return_item_after_change();
create trigger f_receipt_check before insert on purchase_receipt_items for each row execute function receipt_item_before_insert();
create trigger f_receipt_after after insert on purchase_receipt_items for each row execute function receipt_item_after_insert();

-- ===================== Auditoría a nivel de base de datos =====================
do $$
declare t text;
begin
  foreach t in array array[
    'tenants','subscriptions','tenant_feature_overrides','users','roles','tenant_settings','tax_rates',
    'price_lists','price_list_items','customer_groups','customers','customer_contacts','customer_subaccounts',
    'products','product_variations','suppliers','warehouses',
    'quotes','sales','invoices','accounts_receivable','payments','payment_allocations','wallet_transactions',
    'sale_returns','credit_notes','purchases','accounts_payable','expenses',
    'leads','projects','tasks','tickets','dynamic_rules','rule_conditions','rule_actions',
    'announcements','ml_accounts']
  loop
    execute format('create trigger z_audit after insert or update or delete on %I for each row execute function audit_row()', t);
  end loop;
end $$;

-- ===================== Permisos de base de datos =====================
grant usage on schema public to nexo_app, nexo_platform;
grant select on all tables in schema public to nexo_app;
grant all on all tables in schema public to nexo_platform;

do $$
declare t record;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'tenant_id' and tb.table_type = 'BASE TABLE'
  loop
    execute format('grant insert, update, delete on %I to nexo_app', t.table_name);
  end loop;
end $$;

-- Libros inmutables y tablas gobernadas por la plataforma
revoke update, delete on stock_movements, wallet_transactions, audit_log from nexo_app;
revoke insert, update, delete on subscriptions, tenant_feature_overrides from nexo_app;
revoke all on platform_admins from nexo_app;
grant update (name, legal_name, tax_id, default_locale, timezone) on tenants to nexo_app;
