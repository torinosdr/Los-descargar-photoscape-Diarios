-- Fase 5 · Flujos de ventas: presupuesto → venta → reserva → factura/cuenta por cobrar → despacho → cobro → devolución.
-- Funciones SECURITY INVOKER: corren con el rol de la app, así que RLS y permisos aplican siempre.

create function default_warehouse() returns uuid language sql stable as $$
  select id from warehouses where tenant_id = app_tenant() and is_default and deleted_at is null limit 1
$$;

-- ===================== Presupuesto → venta =====================
create function quote_convert_to_sale(p_quote uuid) returns uuid
language plpgsql as $$
declare q quotes; v_terms int; v_sale uuid; v_wh uuid := default_warehouse();
begin
  perform require_permission('quotes.update'); perform require_permission('sales.create');
  select * into q from quotes where id = p_quote and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Presupuesto inexistente' using errcode = 'no_data_found'; end if;
  if q.status <> 'Aceptado' then
    raise exception 'Solo se convierte un presupuesto Aceptado (estado actual: %)', q.status using errcode = 'check_violation';
  end if;
  select payment_terms_days into v_terms from customers where id = q.customer_id and tenant_id = q.tenant_id;
  insert into sales (tenant_id, customer_id, quote_id, project_id, source, currency, exchange_rate, prices_include_tax,
                     discount_minor, shipping_minor, payment_terms_days, due_date, warehouse_id, assigned_user_id)
  values (q.tenant_id, q.customer_id, q.id, q.project_id, 'Manual', q.currency, q.exchange_rate, q.prices_include_tax,
          q.discount_minor, q.shipping_minor, coalesce(v_terms, 0), current_date + coalesce(v_terms, 0), v_wh, q.assigned_user_id)
  returning id into v_sale;
  insert into sale_items (tenant_id, sale_id, sort_order, product_id, variation_id, description, quantity, unit_price_minor, discount_minor, tax_rate_id)
  select tenant_id, v_sale, sort_order, product_id, variation_id, description, quantity, unit_price_minor, discount_minor, tax_rate_id
    from quote_items where quote_id = q.id and tenant_id = q.tenant_id;
  update quotes set status = 'Convertido a Venta', converted_sale_id = v_sale where id = q.id;
  return v_sale;
end $$;

-- ===================== Reserva de stock =====================
create function sale_reserve_stock(p_sale uuid) returns int
language plpgsql as $$
declare s sales; it record; n int := 0; v_wh uuid;
begin
  perform require_permission('sales.update');
  select * into s from sales where id = p_sale and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Venta inexistente' using errcode = 'no_data_found'; end if;
  if s.status in ('Cancelado', 'Devuelto', 'Enviado', 'Entregado', 'Completado') then
    raise exception 'No se puede reservar stock en una venta %', s.status using errcode = 'check_violation';
  end if;
  if exists (select 1 from stock_reservations where tenant_id = s.tenant_id and reference_type = 'sale' and reference_id = s.id and status = 'Activa') then
    return 0;
  end if;
  for it in select si.* from sale_items si join products p on p.id = si.product_id and p.tenant_id = si.tenant_id
             where si.sale_id = s.id and si.tenant_id = s.tenant_id and p.track_stock loop
    v_wh := coalesce(it.warehouse_id, s.warehouse_id, default_warehouse());
    insert into stock_reservations (tenant_id, warehouse_id, product_id, variation_id, quantity, reference_type, reference_id)
    values (s.tenant_id, v_wh, it.product_id, it.variation_id, it.quantity, 'sale', s.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ===================== Factura + cuenta por cobrar =====================
create function sale_issue_invoice(p_sale uuid) returns uuid
language plpgsql as $$
declare s sales; v_inv uuid; v_total bigint; v_due date; v_issue date := current_date;
begin
  perform require_permission('invoices.create');
  select * into s from sales where id = p_sale and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Venta inexistente' using errcode = 'no_data_found'; end if;
  if s.status in ('Cancelado', 'Devuelto') then
    raise exception 'No se factura una venta %', s.status using errcode = 'check_violation';
  end if;
  if exists (select 1 from invoices where tenant_id = s.tenant_id and sale_id = s.id and status <> 'Anulada' and deleted_at is null) then
    raise exception 'La venta ya tiene una factura' using errcode = 'unique_violation';
  end if;
  if s.total_minor <= 0 then raise exception 'La venta no tiene importe para facturar' using errcode = 'check_violation'; end if;
  v_due := greatest(coalesce(s.due_date, v_issue + s.payment_terms_days), v_issue);
  insert into invoices (tenant_id, customer_id, sale_id, project_id, issue_date, due_date, currency, exchange_rate, prices_include_tax,
                        discount_minor, shipping_minor, customer_snapshot)
  select s.tenant_id, s.customer_id, s.id, s.project_id, v_issue, v_due, s.currency, s.exchange_rate, s.prices_include_tax,
         s.discount_minor, s.shipping_minor,
         jsonb_build_object('name', c.display_name, 'tax_id', c.tax_id, 'tax_condition', c.tax_condition, 'billing_address', c.billing_address)
    from customers c where c.id = s.customer_id and c.tenant_id = s.tenant_id
  returning id into v_inv;
  insert into invoice_items (tenant_id, invoice_id, sort_order, product_id, variation_id, description, quantity, unit_price_minor, discount_minor, tax_rate_id)
  select tenant_id, v_inv, sort_order, product_id, variation_id, description, quantity, unit_price_minor, discount_minor, tax_rate_id
    from sale_items where sale_id = s.id and tenant_id = s.tenant_id;
  select total_minor into v_total from invoices where id = v_inv;
  insert into accounts_receivable (tenant_id, customer_id, sale_id, invoice_id, issue_date, due_date, currency, original_minor)
  values (s.tenant_id, s.customer_id, s.id, v_inv, v_issue, v_due, s.currency, v_total);
  return v_inv;
end $$;

-- ===================== Despacho: consume reservas y descuenta stock =====================
create function sale_dispatch(p_sale uuid) returns void
language plpgsql as $$
declare s sales; it record; v_wh uuid;
begin
  perform require_permission('sales.update');
  select * into s from sales where id = p_sale and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Venta inexistente' using errcode = 'no_data_found'; end if;
  if s.status <> 'En Preparación' then
    raise exception 'Solo se despacha una venta En Preparación (estado actual: %)', s.status using errcode = 'check_violation';
  end if;
  update stock_reservations set status = 'Consumida'
   where tenant_id = s.tenant_id and reference_type = 'sale' and reference_id = s.id and status = 'Activa';
  for it in select si.* from sale_items si join products p on p.id = si.product_id and p.tenant_id = si.tenant_id
             where si.sale_id = s.id and si.tenant_id = s.tenant_id and p.track_stock loop
    v_wh := coalesce(it.warehouse_id, s.warehouse_id, default_warehouse());
    insert into stock_movements (tenant_id, warehouse_id, product_id, variation_id, movement_type, quantity, unit_cost_minor, reference_type, reference_id, notes)
    values (s.tenant_id, v_wh, it.product_id, it.variation_id, 'Venta', -it.quantity, it.unit_cost_minor, 'sale', s.id, 'Salida por venta ' || coalesce(s.number, ''));
  end loop;
  update sales set status = 'Enviado' where id = s.id;
end $$;

-- ===================== Anulación de venta =====================
-- Libera reservas, anula factura y cuentas por cobrar y devuelve lo cobrado a la billetera del cliente.
create function sale_cancel(p_sale uuid, p_reason text) returns bigint
language plpgsql as $$
declare s sales; v_refund bigint;
begin
  perform require_permission('sales.cancel');
  if p_reason is null or btrim(p_reason) = '' then raise exception 'Indica el motivo de la anulación' using errcode = 'check_violation'; end if;
  select * into s from sales where id = p_sale and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Venta inexistente' using errcode = 'no_data_found'; end if;
  select coalesce(sum(paid_minor), 0) into v_refund from accounts_receivable
   where tenant_id = s.tenant_id and sale_id = s.id and status <> 'Anulada' and deleted_at is null;
  update sales set status = 'Cancelado', cancelled_at = now(), cancel_reason = p_reason where id = s.id;   -- valida la transición
  update stock_reservations set status = 'Liberada'
   where tenant_id = s.tenant_id and reference_type = 'sale' and reference_id = s.id and status = 'Activa';
  update invoices set status = 'Anulada', voided_at = now() where tenant_id = s.tenant_id and sale_id = s.id and status <> 'Anulada';
  update accounts_receivable set status = 'Anulada' where tenant_id = s.tenant_id and sale_id = s.id and status <> 'Anulada';
  if v_refund > 0 then
    insert into wallet_transactions (tenant_id, customer_id, type, amount_minor, currency, reference_type, reference_id, notes)
    values (s.tenant_id, s.customer_id, 'Devolución', v_refund, s.currency, 'sale', s.id, 'Anulación de venta: ' || p_reason);
  end if;
  return v_refund;
end $$;

-- ===================== Cobranza =====================
-- Registra un pago de cliente y lo imputa: primero a la cuenta indicada y luego a las más antiguas.
-- Lo que sobra queda como saldo a favor en la billetera (si p_excess_to_wallet).
create function payment_register(p_customer uuid, p_method text, p_amount bigint, p_receivable uuid default null,
                                 p_reference text default null, p_excess_to_wallet boolean default true) returns uuid
language plpgsql as $$
declare v_cur char(3); v_pay uuid; v_left bigint := p_amount; v_apply bigint; ar record;
begin
  perform require_permission('payments.create');
  if p_amount is null or p_amount <= 0 then raise exception 'El monto debe ser mayor a cero' using errcode = 'check_violation'; end if;
  if p_method = 'Billetera' then raise exception 'Para usar la billetera aplica el saldo a la deuda' using errcode = 'check_violation'; end if;
  select base_currency into v_cur from tenants where id = app_tenant();
  perform 1 from customers where id = p_customer and tenant_id = app_tenant() for update;
  if not found then raise exception 'Cliente inexistente' using errcode = 'foreign_key_violation'; end if;
  insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency, reference)
  values (app_tenant(), 'Entrada', p_customer, p_method, p_amount, v_cur, p_reference) returning id into v_pay;
  for ar in select id, open_minor from accounts_receivable
             where tenant_id = app_tenant() and customer_id = p_customer and currency = v_cur and deleted_at is null
               and status in ('Abierta', 'Parcial') and open_minor > 0
             order by (id = p_receivable) desc nulls last, due_date, issue_date, created_at loop
    exit when v_left <= 0;
    v_apply := least(v_left, ar.open_minor);
    insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (app_tenant(), v_pay, ar.id, v_apply);
    v_left := v_left - v_apply;
  end loop;
  if v_left > 0 and p_excess_to_wallet then
    insert into wallet_transactions (tenant_id, customer_id, type, amount_minor, currency, payment_id, reference_type, notes)
    values (app_tenant(), p_customer, 'Carga', v_left, v_cur, v_pay, 'payment', 'Excedente de cobranza');
  end if;
  return v_pay;
end $$;

-- ===================== Devoluciones =====================
-- p_items: [{"sale_item_id": "...", "quantity": 2, "restock": true}]
create function return_create(p_sale uuid, p_reason text, p_refund_method text, p_items jsonb) returns uuid
language plpgsql as $$
declare s sales; v_ret uuid; i jsonb; si sale_items;
begin
  perform require_permission('sale_returns.create');
  select * into s from sales where id = p_sale and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Venta inexistente' using errcode = 'no_data_found'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La devolución necesita al menos una línea' using errcode = 'check_violation';
  end if;
  insert into sale_returns (tenant_id, sale_id, customer_id, currency, reason, refund_method, warehouse_id)
  values (s.tenant_id, s.id, s.customer_id, s.currency, p_reason, p_refund_method, coalesce(s.warehouse_id, default_warehouse()))
  returning id into v_ret;
  for i in select * from jsonb_array_elements(p_items) loop
    select * into si from sale_items where id = (i->>'sale_item_id')::uuid and tenant_id = s.tenant_id;
    insert into sale_return_items (tenant_id, sale_return_id, sale_item_id, quantity, unit_price_minor, restock)
    values (s.tenant_id, v_ret, si.id, (i->>'quantity')::numeric,
            si.unit_price_minor - (si.discount_minor / nullif(si.quantity, 0))::bigint, coalesce((i->>'restock')::boolean, true));
  end loop;
  return v_ret;
end $$;

create function return_complete(p_return uuid) returns bigint
language plpgsql as $$
declare r sale_returns; s sales; it record; v_cn uuid; v_apply bigint; v_left bigint; ar record; v_pay uuid;
begin
  perform require_permission('sale_returns.update');
  select * into r from sale_returns where id = p_return and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Devolución inexistente' using errcode = 'no_data_found'; end if;
  if r.status in ('Reembolsada', 'Rechazada', 'Cerrada') then
    raise exception 'La devolución ya está %', r.status using errcode = 'check_violation';
  end if;
  select * into s from sales where id = r.sale_id and tenant_id = r.tenant_id;
  -- reingreso de mercadería
  for it in select ri.quantity, si.product_id, si.variation_id, si.unit_cost_minor
              from sale_return_items ri join sale_items si on si.id = ri.sale_item_id and si.tenant_id = ri.tenant_id
              join products p on p.id = si.product_id and p.tenant_id = si.tenant_id
             where ri.sale_return_id = r.id and ri.tenant_id = r.tenant_id and ri.restock and p.track_stock loop
    insert into stock_movements (tenant_id, warehouse_id, product_id, variation_id, movement_type, quantity, unit_cost_minor, reference_type, reference_id, notes)
    values (r.tenant_id, coalesce(r.warehouse_id, default_warehouse()), it.product_id, it.variation_id, 'Devolución de cliente', it.quantity, it.unit_cost_minor, 'sale_return', r.id, 'Devolución');
  end loop;
  -- reembolso
  if r.total_minor > 0 then
    if r.refund_method = 'Billetera' then
      insert into wallet_transactions (tenant_id, customer_id, type, amount_minor, currency, reference_type, reference_id, notes)
      values (r.tenant_id, r.customer_id, 'Devolución', r.total_minor, r.currency, 'sale_return', r.id, 'Devolución de venta');
    elsif r.refund_method = 'Nota de crédito' then
      insert into credit_notes (tenant_id, customer_id, invoice_id, sale_return_id, currency, total_minor, reason)
      values (r.tenant_id, r.customer_id, (select id from invoices where sale_id = r.sale_id and tenant_id = r.tenant_id and status <> 'Anulada' limit 1),
              r.id, r.currency, r.total_minor, coalesce(r.reason, 'Devolución')) returning id into v_cn;
      v_left := r.total_minor;
      for ar in select id, open_minor from accounts_receivable
                 where tenant_id = r.tenant_id and sale_id = r.sale_id and status in ('Abierta', 'Parcial') and open_minor > 0 order by due_date loop
        exit when v_left <= 0;
        v_apply := least(v_left, ar.open_minor);
        insert into credit_note_applications (tenant_id, credit_note_id, receivable_id, amount_minor) values (r.tenant_id, v_cn, ar.id, v_apply);
        v_left := v_left - v_apply;
      end loop;
    elsif r.refund_method in ('Efectivo', 'Transferencia') then
      insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency, notes)
      values (r.tenant_id, 'Salida', r.customer_id, r.refund_method, r.total_minor, r.currency, 'Reembolso de devolución') returning id into v_pay;
    end if;
  end if;
  update sale_returns set status = 'Reembolsada', approved_by = app_user(), approved_at = now() where id = r.id;
  -- si se devolvió todo lo vendido, la venta pasa a Devuelto (cuando el flujo lo permite)
  if s.status in ('Enviado', 'Entregado', 'Completado')
     and not exists (select 1 from sale_items where sale_id = s.id and tenant_id = s.tenant_id and quantity_returned < quantity) then
    update sales set status = 'Devuelto' where id = s.id;
  end if;
  return r.total_minor;
end $$;

-- ===================== Vistas =====================
create view v_receivables_aging with (security_invoker = true) as
select tenant_id, customer_id, customer_name,
       sum(open_minor) filter (where days_overdue <= 0) as current_minor,
       sum(open_minor) filter (where days_overdue between 1 and 30) as d1_30_minor,
       sum(open_minor) filter (where days_overdue between 31 and 60) as d31_60_minor,
       sum(open_minor) filter (where days_overdue between 61 and 90) as d61_90_minor,
       sum(open_minor) filter (where days_overdue > 90) as d90_plus_minor,
       sum(open_minor) as total_open_minor
  from v_receivables where status in ('Abierta', 'Parcial') and deleted_at is null
 group by tenant_id, customer_id, customer_name;

create view v_sales_by_month with (security_invoker = true) as
select tenant_id, date_trunc('month', sold_at)::date as month, currency,
       count(*)::int as sales_count, sum(total_minor)::bigint as total_minor
  from sales where deleted_at is null and status not in ('Cancelado') group by 1, 2, 3;

grant select on v_receivables_aging, v_sales_by_month to nexo_app, nexo_platform;
grant execute on function default_warehouse(), quote_convert_to_sale(uuid), sale_reserve_stock(uuid), sale_issue_invoice(uuid),
  sale_dispatch(uuid), sale_cancel(uuid, text), payment_register(uuid, text, bigint, uuid, text, boolean),
  return_create(uuid, text, text, jsonb), return_complete(uuid) to nexo_app;
