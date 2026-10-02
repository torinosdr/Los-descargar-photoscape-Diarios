-- Fase 6 · Flujos de compras: orden → recepción (stock) → factura del proveedor (cuenta por pagar) → pago; gastos.

create function purchase_confirm(p_purchase uuid) returns void
language plpgsql as $$
declare p purchases;
begin
  perform require_permission('purchases.update');
  select * into p from purchases where id = p_purchase and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Compra inexistente' using errcode = 'no_data_found'; end if;
  if not exists (select 1 from purchase_items where purchase_id = p.id and tenant_id = p.tenant_id) then
    raise exception 'La orden de compra no tiene líneas' using errcode = 'check_violation';
  end if;
  update purchases set status = 'Ordenado' where id = p.id;     -- valida la transición Borrador → Ordenado
end $$;

-- Recibe mercadería. p_items: [{"purchase_item_id": "...", "quantity": n}]; null = todo lo pendiente.
create function purchase_receive(p_purchase uuid, p_items jsonb default null, p_warehouse uuid default null) returns uuid
language plpgsql as $$
declare p purchases; v_rc uuid; i record; v_wh uuid; v_n int := 0;
begin
  perform require_permission('purchases.update'); perform require_permission('inventory.create');
  select * into p from purchases where id = p_purchase and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Compra inexistente' using errcode = 'no_data_found'; end if;
  v_wh := coalesce(p_warehouse, p.warehouse_id, default_warehouse());
  insert into purchase_receipts (tenant_id, purchase_id, warehouse_id) values (p.tenant_id, p.id, v_wh) returning id into v_rc;
  if p_items is null then
    for i in select id, quantity - quantity_received as pending from purchase_items
              where purchase_id = p.id and tenant_id = p.tenant_id and quantity_received < quantity loop
      insert into purchase_receipt_items (tenant_id, receipt_id, purchase_item_id, quantity) values (p.tenant_id, v_rc, i.id, i.pending);
      v_n := v_n + 1;
    end loop;
  else
    for i in select (e->>'purchase_item_id')::uuid as item, (e->>'quantity')::numeric as qty from jsonb_array_elements(p_items) e where (e->>'quantity')::numeric > 0 loop
      insert into purchase_receipt_items (tenant_id, receipt_id, purchase_item_id, quantity) values (p.tenant_id, v_rc, i.item, i.qty);
      v_n := v_n + 1;
    end loop;
  end if;
  if v_n = 0 then raise exception 'No hay nada para recibir' using errcode = 'check_violation'; end if;
  return v_rc;
end $$;

-- Registra la factura del proveedor: genera la cuenta por pagar.
create function purchase_register_invoice(p_purchase uuid, p_supplier_invoice text, p_issue date default current_date) returns uuid
language plpgsql as $$
declare p purchases; v_ap uuid; v_due date;
begin
  perform require_permission('payables.create');
  select * into p from purchases where id = p_purchase and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Compra inexistente' using errcode = 'no_data_found'; end if;
  if p.status in ('Borrador', 'Cancelado') then
    raise exception 'No se registra factura de una compra en estado %', p.status using errcode = 'check_violation';
  end if;
  if exists (select 1 from accounts_payable where purchase_id = p.id and tenant_id = p.tenant_id and status <> 'Anulada' and deleted_at is null) then
    raise exception 'La compra ya tiene una cuenta por pagar' using errcode = 'unique_violation';
  end if;
  if p.total_minor <= 0 then raise exception 'La compra no tiene importe' using errcode = 'check_violation'; end if;
  v_due := p_issue + p.payment_terms_days;
  insert into accounts_payable (tenant_id, supplier_id, purchase_id, supplier_invoice_number, issue_date, due_date, currency, original_minor)
  values (p.tenant_id, p.supplier_id, p.id, p_supplier_invoice, p_issue, v_due, p.currency, p.total_minor) returning id into v_ap;
  update purchases set supplier_invoice_number = p_supplier_invoice where id = p.id;
  return v_ap;
end $$;

-- Pago a proveedor: imputa primero a la cuenta indicada y luego a las más antiguas. No admite pagar de más.
create function supplier_payment_register(p_supplier uuid, p_method text, p_amount bigint, p_payable uuid default null, p_reference text default null) returns uuid
language plpgsql as $$
declare v_cur char(3); v_pay uuid; v_left bigint := p_amount; v_open bigint; v_apply bigint; ap record;
begin
  perform require_permission('payables.update');
  if p_amount is null or p_amount <= 0 then raise exception 'El monto debe ser mayor a cero' using errcode = 'check_violation'; end if;
  select base_currency into v_cur from tenants where id = app_tenant();
  perform 1 from suppliers where id = p_supplier and tenant_id = app_tenant() for update;
  if not found then raise exception 'Proveedor inexistente' using errcode = 'foreign_key_violation'; end if;
  select coalesce(sum(open_minor), 0) into v_open from accounts_payable
   where tenant_id = app_tenant() and supplier_id = p_supplier and currency = v_cur and status in ('Abierta', 'Parcial') and deleted_at is null;
  if p_amount > v_open then
    raise exception 'El pago (%) supera la deuda con el proveedor (%)', p_amount, v_open using errcode = 'check_violation';
  end if;
  insert into payments (tenant_id, direction, supplier_id, method, amount_minor, currency, reference)
  values (app_tenant(), 'Salida', p_supplier, p_method, p_amount, v_cur, p_reference) returning id into v_pay;
  for ap in select id, open_minor from accounts_payable
             where tenant_id = app_tenant() and supplier_id = p_supplier and currency = v_cur and status in ('Abierta', 'Parcial') and open_minor > 0 and deleted_at is null
             order by (id = p_payable) desc nulls last, due_date, issue_date, created_at loop
    exit when v_left <= 0;
    v_apply := least(v_left, ap.open_minor);
    insert into payment_allocations (tenant_id, payment_id, payable_id, amount_minor) values (app_tenant(), v_pay, ap.id, v_apply);
    v_left := v_left - v_apply;
  end loop;
  return v_pay;
end $$;

create function purchase_cancel(p_purchase uuid, p_reason text) returns void
language plpgsql as $$
declare p purchases;
begin
  perform require_permission('purchases.update');
  if p_reason is null or btrim(p_reason) = '' then raise exception 'Indica el motivo de la cancelación' using errcode = 'check_violation'; end if;
  select * into p from purchases where id = p_purchase and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Compra inexistente' using errcode = 'no_data_found'; end if;
  if p.paid_minor > 0 then raise exception 'La compra tiene pagos registrados: anula primero los pagos' using errcode = 'check_violation'; end if;
  update purchases set status = 'Cancelado', cancelled_at = now(), cancel_reason = p_reason where id = p.id;
  update accounts_payable set status = 'Anulada' where purchase_id = p.id and tenant_id = p.tenant_id and status <> 'Anulada';
end $$;

-- ===================== Gastos =====================
create function expense_register(p_category uuid, p_description text, p_amount bigint, p_date date default current_date,
                                 p_method text default null, p_supplier uuid default null) returns uuid
language plpgsql as $$
declare v_cur char(3); v_id uuid;
begin
  perform require_permission('expenses.create');
  if p_amount is null or p_amount <= 0 then raise exception 'El monto debe ser mayor a cero' using errcode = 'check_violation'; end if;
  select base_currency into v_cur from tenants where id = app_tenant();
  insert into expenses (tenant_id, expense_date, category_id, description, supplier_id, currency, amount_minor, payment_method, status, paid_at)
  values (app_tenant(), p_date, p_category, p_description, p_supplier, v_cur, p_amount, p_method,
          case when p_method is null then 'Pendiente' else 'Pagado' end, case when p_method is null then null else now() end)
  returning id into v_id;
  return v_id;
end $$;

create function expense_pay(p_expense uuid, p_method text) returns void
language plpgsql as $$
begin
  perform require_permission('expenses.update');
  update expenses set status = 'Pagado', payment_method = p_method, paid_at = now()
   where id = p_expense and tenant_id = app_tenant() and status = 'Pendiente' and deleted_at is null;
  if not found then raise exception 'El gasto no existe o no está pendiente' using errcode = 'check_violation'; end if;
end $$;

-- ===================== Vistas =====================
create view v_payables_aging with (security_invoker = true) as
select tenant_id, supplier_id, supplier_name,
       sum(open_minor) filter (where days_overdue <= 0) as current_minor,
       sum(open_minor) filter (where days_overdue between 1 and 30) as d1_30_minor,
       sum(open_minor) filter (where days_overdue between 31 and 60) as d31_60_minor,
       sum(open_minor) filter (where days_overdue between 61 and 90) as d61_90_minor,
       sum(open_minor) filter (where days_overdue > 90) as d90_plus_minor,
       sum(open_minor) as total_open_minor
  from v_payables where status in ('Abierta', 'Parcial') and deleted_at is null
 group by tenant_id, supplier_id, supplier_name;

create view v_supplier_summary with (security_invoker = true) as
select s.tenant_id, s.id as supplier_id, s.number, s.name, s.status, s.payment_terms_days,
       (select count(*) from purchases p where p.tenant_id = s.tenant_id and p.supplier_id = s.id and p.deleted_at is null and p.status <> 'Cancelado')::int as purchases_count,
       coalesce((select sum(p.total_minor) from purchases p where p.tenant_id = s.tenant_id and p.supplier_id = s.id and p.deleted_at is null and p.status <> 'Cancelado'), 0)::bigint as purchases_total_minor,
       coalesce((select sum(ap.open_minor) from accounts_payable ap where ap.tenant_id = s.tenant_id and ap.supplier_id = s.id and ap.status in ('Abierta', 'Parcial') and ap.deleted_at is null), 0)::bigint as payable_open_minor,
       (select max(p.purchase_date) from purchases p where p.tenant_id = s.tenant_id and p.supplier_id = s.id and p.deleted_at is null and p.status <> 'Cancelado') as last_purchase_date
  from suppliers s where s.deleted_at is null;

create view v_expenses_monthly with (security_invoker = true) as
select e.tenant_id, date_trunc('month', e.expense_date)::date as month, c.name as category, e.currency,
       sum(e.amount_minor)::bigint as total_minor, count(*)::int as expenses_count
  from expenses e left join expense_categories c on c.id = e.category_id and c.tenant_id = e.tenant_id
 where e.deleted_at is null and e.status <> 'Anulado' group by 1, 2, 3, 4;

grant select on v_payables_aging, v_supplier_summary, v_expenses_monthly to nexo_app, nexo_platform;
grant execute on function purchase_confirm(uuid), purchase_receive(uuid, jsonb, uuid), purchase_register_invoice(uuid, text, date),
  supplier_payment_register(uuid, text, bigint, uuid, text), purchase_cancel(uuid, text),
  expense_register(uuid, text, bigint, date, text, uuid), expense_pay(uuid, text) to nexo_app;
