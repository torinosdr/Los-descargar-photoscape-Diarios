-- 010 · Invariantes de negocio en la base de datos
-- Aquí vive SOLO lo que no puede quedar inconsistente aunque falle la aplicación:
-- totales, existencias, saldo de billetera, imputación de pagos y estados derivados.
-- Los flujos (convertir presupuesto en venta, aplicar billetera a la deuda, etc.)
-- viven en la capa de servicios del backend y usan estas garantías.

-- ===================== Totales de documentos =====================

-- Impuesto de línea derivado de la tasa (snapshot en tax_rate_percent).
-- Argumentos: tabla de cabecera, columna FK hacia la cabecera.
create function compute_line_tax() returns trigger
language plpgsql as $$
declare
  v_incl boolean; v_line bigint; v_pct numeric;
begin
  if new.tax_rate_id is not null
     and (tg_op = 'INSERT' or new.tax_rate_id is distinct from old.tax_rate_id) then
    select rate_percent into v_pct from tax_rates where id = new.tax_rate_id and tenant_id = new.tenant_id;
    new.tax_rate_percent := coalesce(v_pct, 0);
  end if;
  execute format('select prices_include_tax from %I where id = $1 and tenant_id = $2', tg_argv[0])
     into v_incl using (to_jsonb(new) ->> tg_argv[1])::uuid, new.tenant_id;
  v_line := round(new.quantity * new.unit_price_minor)::bigint - new.discount_minor;
  if coalesce(v_incl, false) then
    new.tax_minor := round(v_line - v_line / (1 + new.tax_rate_percent / 100))::bigint;
  else
    new.tax_minor := round(v_line * new.tax_rate_percent / 100)::bigint;
  end if;
  return new;
end $$;

-- Recalcula subtotal e impuestos de la cabecera cuando cambian sus líneas.
create function recalc_header_from_items() returns trigger
language plpgsql as $$
declare v_parent uuid; v_tenant uuid;
begin
  v_tenant := coalesce(new.tenant_id, old.tenant_id);
  v_parent := coalesce((to_jsonb(new) ->> tg_argv[1])::uuid, (to_jsonb(old) ->> tg_argv[1])::uuid);
  execute format(
    'update %I set
       subtotal_minor = (select coalesce(sum(line_total_minor), 0) from %I where tenant_id = $1 and %I = $2),
       tax_minor      = (select coalesce(sum(tax_minor), 0)        from %I where tenant_id = $1 and %I = $2)
     where tenant_id = $1 and id = $2',
    tg_argv[0], tg_table_name, tg_argv[1], tg_table_name, tg_argv[1])
    using v_tenant, v_parent;
  return null;
end $$;

-- total = subtotal − descuento + impuestos (si no están incluidos en el precio) + envío
create function derive_header_total() returns trigger
language plpgsql as $$
begin
  new.total_minor := new.subtotal_minor - new.discount_minor
                     + case when new.prices_include_tax then 0 else new.tax_minor end
                     + new.shipping_minor;
  -- Sin líneas (subtotal 0) el encabezado puede tener descuento/envío; el total se valida al haber importe.
  if new.total_minor < 0 and new.subtotal_minor > 0 then
    raise exception 'El descuento no puede superar el subtotal' using errcode = 'check_violation';
  end if;
  new.total_minor := greatest(new.total_minor, 0);
  return new;
end $$;

-- ===================== Inventario =====================

alter table inventory_levels add constraint inventory_reserved_le_onhand
  check (reserved_quantity <= quantity_on_hand);

-- Cada movimiento de stock actualiza la existencia (y falla si quedara negativa).
create function apply_stock_movement() returns trigger
language plpgsql as $$
begin
  -- Se asegura la fila con 0 y luego se suma: así el CHECK (>= 0) evalúa el resultado final
  -- y no la cantidad del movimiento (un INSERT … ON CONFLICT chequea la fila propuesta primero).
  insert into inventory_levels (tenant_id, warehouse_id, product_id, variation_id)
  values (new.tenant_id, new.warehouse_id, new.product_id, new.variation_id)
  on conflict (tenant_id, warehouse_id, product_id, (coalesce(variation_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  do nothing;
  update inventory_levels
     set quantity_on_hand = quantity_on_hand + new.quantity, updated_at = now()
   where tenant_id = new.tenant_id and warehouse_id = new.warehouse_id and product_id = new.product_id
     and variation_id is not distinct from new.variation_id;
  return null;
exception when check_violation then
  raise exception 'Stock insuficiente para el producto % en el depósito %', new.product_id, new.warehouse_id
    using errcode = 'check_violation';
end $$;

create function recompute_reserved(p_tenant uuid, p_wh uuid, p_prod uuid, p_var uuid) returns void
language plpgsql as $$
begin
  insert into inventory_levels (tenant_id, warehouse_id, product_id, variation_id)
  values (p_tenant, p_wh, p_prod, p_var)
  on conflict (tenant_id, warehouse_id, product_id, (coalesce(variation_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  do nothing;
  update inventory_levels il
     set reserved_quantity = (
           select coalesce(sum(r.quantity), 0) from stock_reservations r
            where r.tenant_id = p_tenant and r.warehouse_id = p_wh and r.product_id = p_prod
              and r.variation_id is not distinct from p_var and r.status = 'Activa'),
         updated_at = now()
   where il.tenant_id = p_tenant and il.warehouse_id = p_wh and il.product_id = p_prod
     and il.variation_id is not distinct from p_var;
exception when check_violation then
  raise exception 'Stock disponible insuficiente para reservar (producto %)', p_prod
    using errcode = 'check_violation';
end $$;

create function sync_reservation() returns trigger
language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform recompute_reserved(old.tenant_id, old.warehouse_id, old.product_id, old.variation_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform recompute_reserved(new.tenant_id, new.warehouse_id, new.product_id, new.variation_id);
  end if;
  return null;
end $$;

-- ===================== Billetera =====================

create function wallet_before_insert() returns trigger
language plpgsql as $$
declare v_balance bigint;
begin
  new.signed_minor := case when new.type in ('Carga','Devolución','Ajuste positivo')
                           then new.amount_minor else -new.amount_minor end;
  -- Serializa los movimientos de un mismo cliente.
  perform 1 from customers where id = new.customer_id and tenant_id = new.tenant_id for update;
  select coalesce(sum(signed_minor), 0) into v_balance
    from wallet_transactions
   where tenant_id = new.tenant_id and customer_id = new.customer_id and currency = new.currency;
  new.balance_after_minor := v_balance + new.signed_minor;
  if new.balance_after_minor < 0 then
    raise exception 'Saldo de billetera insuficiente (saldo %, movimiento %)', v_balance, new.signed_minor
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- ===================== Cobranzas y pagos =====================

create function refresh_receivable(p_tenant uuid, p_ar uuid) returns void
language plpgsql as $$
declare
  v_paid bigint; v_credit bigint; v_ar accounts_receivable;
  v_settled bigint; v_total bigint; v_inv invoices; v_sale sales;
begin
  select coalesce(sum(a.amount_minor), 0) into v_paid
    from payment_allocations a join payments p on p.id = a.payment_id and p.tenant_id = a.tenant_id
   where a.tenant_id = p_tenant and a.receivable_id = p_ar and p.status = 'Confirmado' and p.deleted_at is null;
  select coalesce(sum(ap.amount_minor), 0) into v_credit
    from credit_note_applications ap join credit_notes c on c.id = ap.credit_note_id and c.tenant_id = ap.tenant_id
   where ap.tenant_id = p_tenant and ap.receivable_id = p_ar and c.status <> 'Anulada';

  update accounts_receivable
     set paid_minor = v_paid, credited_minor = v_credit,
         status = case when status = 'Anulada' then 'Anulada'
                       when v_paid + v_credit = 0 then 'Abierta'
                       when v_paid + v_credit >= original_minor then 'Pagada'
                       else 'Parcial' end
   where id = p_ar and tenant_id = p_tenant
  returning * into v_ar;

  -- Factura vinculada
  if v_ar.invoice_id is not null then
    select * into v_inv from invoices where id = v_ar.invoice_id and tenant_id = p_tenant;
    if found and v_inv.status not in ('Anulada', 'Borrador') then
      update invoices
         set paid_minor = v_paid, credited_minor = v_credit,
             status = case when v_paid + v_credit = 0 then 'Pendiente'
                           when v_paid + v_credit >= total_minor then 'Pagada'
                           else 'Pago Parcial' end
       where id = v_inv.id and tenant_id = p_tenant;
    end if;
  end if;

  -- Venta vinculada: "saldado" = cobrado + acreditado en todas sus cuentas por cobrar.
  if v_ar.sale_id is not null then
    select coalesce(sum(paid_minor + credited_minor), 0) into v_settled
      from accounts_receivable
     where tenant_id = p_tenant and sale_id = v_ar.sale_id and status <> 'Anulada' and deleted_at is null;
    select * into v_sale from sales where id = v_ar.sale_id and tenant_id = p_tenant;
    v_total := v_sale.total_minor;
    update sales
       set paid_minor = v_settled,
           payment_status = case when v_settled = 0 then 'Pendiente'
                                 when v_settled >= v_total then 'Pagado' else 'Parcial' end,
           status = case
             when status = 'Pendiente de Pago' and v_settled > 0 and v_settled < v_total then 'Pago Parcial'
             when status in ('Pendiente de Pago','Pago Parcial') and v_settled >= v_total and v_total > 0 then 'Pagado'
             when status = 'Pagado' and v_settled < v_total and v_settled > 0 then 'Pago Parcial'
             when status = 'Pagado' and v_settled = 0 then 'Pendiente de Pago'
             when status = 'Pago Parcial' and v_settled = 0 then 'Pendiente de Pago'
             else status end
     where id = v_sale.id and tenant_id = p_tenant;
  end if;
end $$;

create function refresh_purchase_state(p_tenant uuid, p_purchase uuid) returns void
language plpgsql as $$
declare v_paid bigint; v_p purchases;
begin
  select coalesce(sum(paid_minor), 0) into v_paid
    from accounts_payable
   where tenant_id = p_tenant and purchase_id = p_purchase and status <> 'Anulada' and deleted_at is null;
  select * into v_p from purchases where id = p_purchase and tenant_id = p_tenant;
  update purchases
     set paid_minor = v_paid,
         payment_status = case when v_paid = 0 then 'Pendiente'
                               when v_paid >= v_p.total_minor then 'Pagado' else 'Parcial' end,
         status = case when v_p.status = 'Recibido Total' and v_p.total_minor > 0 and v_paid >= v_p.total_minor
                       then 'Pagado' else v_p.status end
   where id = p_purchase and tenant_id = p_tenant;
end $$;

create function refresh_payable(p_tenant uuid, p_ap uuid) returns void
language plpgsql as $$
declare v_paid bigint; v_ap accounts_payable;
begin
  select coalesce(sum(a.amount_minor), 0) into v_paid
    from payment_allocations a join payments p on p.id = a.payment_id and p.tenant_id = a.tenant_id
   where a.tenant_id = p_tenant and a.payable_id = p_ap and p.status = 'Confirmado' and p.deleted_at is null;
  update accounts_payable
     set paid_minor = v_paid,
         status = case when status = 'Anulada' then 'Anulada'
                       when v_paid = 0 then 'Abierta'
                       when v_paid >= original_minor then 'Pagada' else 'Parcial' end
   where id = p_ap and tenant_id = p_tenant
  returning * into v_ap;
  if v_ap.purchase_id is not null then
    perform refresh_purchase_state(p_tenant, v_ap.purchase_id);
  end if;
end $$;

-- Validaciones al imputar un pago a una cuenta.
create function allocation_before_insert() returns trigger
language plpgsql as $$
declare v_pay payments; v_ar accounts_receivable; v_ap accounts_payable;
begin
  select * into v_pay from payments where id = new.payment_id and tenant_id = new.tenant_id for update;
  if v_pay.amount_minor - v_pay.allocated_minor < new.amount_minor then
    raise exception 'El pago % no tiene saldo suficiente para imputar % (disponible %)',
      v_pay.number, new.amount_minor, v_pay.amount_minor - v_pay.allocated_minor
      using errcode = 'check_violation';
  end if;
  if new.receivable_id is not null then
    if v_pay.direction <> 'Entrada' then
      raise exception 'Solo los pagos de entrada se imputan a cuentas por cobrar' using errcode = 'check_violation';
    end if;
    select * into v_ar from accounts_receivable where id = new.receivable_id and tenant_id = new.tenant_id for update;
    if v_ar.customer_id is distinct from v_pay.customer_id then
      raise exception 'El pago y la cuenta por cobrar pertenecen a clientes distintos' using errcode = 'check_violation';
    end if;
    if v_ar.currency <> v_pay.currency then
      raise exception 'Moneda del pago (%) distinta a la de la cuenta (%)', v_pay.currency, v_ar.currency using errcode = 'check_violation';
    end if;
    if v_ar.open_minor < new.amount_minor then
      raise exception 'La imputación (%) supera el saldo de la cuenta por cobrar (%)', new.amount_minor, v_ar.open_minor
        using errcode = 'check_violation';
    end if;
  else
    if v_pay.direction <> 'Salida' or v_pay.supplier_id is null then
      raise exception 'Solo los pagos a proveedores se imputan a cuentas por pagar' using errcode = 'check_violation';
    end if;
    select * into v_ap from accounts_payable where id = new.payable_id and tenant_id = new.tenant_id for update;
    if v_ap.supplier_id is distinct from v_pay.supplier_id then
      raise exception 'El pago y la cuenta por pagar pertenecen a proveedores distintos' using errcode = 'check_violation';
    end if;
    if v_ap.currency <> v_pay.currency then
      raise exception 'Moneda del pago (%) distinta a la de la cuenta (%)', v_pay.currency, v_ap.currency using errcode = 'check_violation';
    end if;
    if v_ap.open_minor < new.amount_minor then
      raise exception 'La imputación (%) supera el saldo de la cuenta por pagar (%)', new.amount_minor, v_ap.open_minor
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create function allocation_after_change() returns trigger
language plpgsql as $$
declare r record;
begin
  for r in
    select distinct tenant_id, payment_id, receivable_id, payable_id from (
      select old.tenant_id, old.payment_id, old.receivable_id, old.payable_id where tg_op in ('UPDATE','DELETE')
      union all
      select new.tenant_id, new.payment_id, new.receivable_id, new.payable_id where tg_op in ('INSERT','UPDATE')
    ) s
  loop
    update payments
       set allocated_minor = (select coalesce(sum(amount_minor), 0) from payment_allocations
                               where tenant_id = r.tenant_id and payment_id = r.payment_id)
     where id = r.payment_id and tenant_id = r.tenant_id;
    if r.receivable_id is not null then perform refresh_receivable(r.tenant_id, r.receivable_id); end if;
    if r.payable_id is not null then perform refresh_payable(r.tenant_id, r.payable_id); end if;
  end loop;
  return null;
end $$;

-- Si un pago cambia de estado (anulado, rechazado…), se recalculan las cuentas afectadas.
create function payment_status_changed() returns trigger
language plpgsql as $$
declare r record;
begin
  if new.status is distinct from old.status then
    for r in select receivable_id, payable_id from payment_allocations
              where tenant_id = new.tenant_id and payment_id = new.id loop
      if r.receivable_id is not null then perform refresh_receivable(new.tenant_id, r.receivable_id); end if;
      if r.payable_id is not null then perform refresh_payable(new.tenant_id, r.payable_id); end if;
    end loop;
  end if;
  return null;
end $$;

-- ===================== Notas de crédito =====================

create function credit_application_before_insert() returns trigger
language plpgsql as $$
declare v_cn credit_notes; v_ar accounts_receivable;
begin
  select * into v_cn from credit_notes where id = new.credit_note_id and tenant_id = new.tenant_id for update;
  select * into v_ar from accounts_receivable where id = new.receivable_id and tenant_id = new.tenant_id for update;
  if v_cn.status = 'Anulada' then
    raise exception 'La nota de crédito está anulada' using errcode = 'check_violation';
  end if;
  if v_cn.customer_id <> v_ar.customer_id then
    raise exception 'La nota de crédito y la cuenta por cobrar son de clientes distintos' using errcode = 'check_violation';
  end if;
  if v_cn.currency <> v_ar.currency then
    raise exception 'Moneda de la nota de crédito distinta a la de la cuenta' using errcode = 'check_violation';
  end if;
  if v_cn.remaining_minor < new.amount_minor then
    raise exception 'La nota de crédito no tiene saldo suficiente (disponible %)', v_cn.remaining_minor using errcode = 'check_violation';
  end if;
  if v_ar.open_minor < new.amount_minor then
    raise exception 'La aplicación (%) supera el saldo de la cuenta (%)', new.amount_minor, v_ar.open_minor using errcode = 'check_violation';
  end if;
  return new;
end $$;

create function credit_application_after_change() returns trigger
language plpgsql as $$
declare r record;
begin
  for r in
    select distinct tenant_id, credit_note_id, receivable_id from (
      select old.tenant_id, old.credit_note_id, old.receivable_id where tg_op in ('UPDATE','DELETE')
      union all
      select new.tenant_id, new.credit_note_id, new.receivable_id where tg_op in ('INSERT','UPDATE')
    ) s
  loop
    update credit_notes c
       set applied_minor = (select coalesce(sum(amount_minor), 0) from credit_note_applications
                             where tenant_id = r.tenant_id and credit_note_id = r.credit_note_id),
           status = case when c.status = 'Anulada' then 'Anulada'
                         when (select coalesce(sum(amount_minor), 0) from credit_note_applications
                                where tenant_id = r.tenant_id and credit_note_id = r.credit_note_id) >= c.total_minor
                         then 'Aplicada' else 'Emitida' end
     where c.id = r.credit_note_id and c.tenant_id = r.tenant_id;
    perform refresh_receivable(r.tenant_id, r.receivable_id);
  end loop;
  return null;
end $$;

-- ===================== Devoluciones =====================

create function return_item_before_insert() returns trigger
language plpgsql as $$
declare v_item sale_items; v_ret sale_returns;
begin
  select * into v_ret from sale_returns where id = new.sale_return_id and tenant_id = new.tenant_id;
  select * into v_item from sale_items where id = new.sale_item_id and tenant_id = new.tenant_id for update;
  if v_item.sale_id <> v_ret.sale_id then
    raise exception 'La línea % no pertenece a la venta de la devolución', new.sale_item_id using errcode = 'check_violation';
  end if;
  if v_item.quantity - v_item.quantity_returned < new.quantity then
    raise exception 'Cantidad a devolver (%) mayor a la disponible (%)', new.quantity, v_item.quantity - v_item.quantity_returned
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create function return_item_after_change() returns trigger
language plpgsql as $$
declare v_ret uuid; v_tenant uuid; v_incl boolean;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update sale_items set quantity_returned = quantity_returned + new.quantity
     where id = new.sale_item_id and tenant_id = new.tenant_id;
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    update sale_items set quantity_returned = quantity_returned - old.quantity
     where id = old.sale_item_id and tenant_id = old.tenant_id;
  end if;
  v_ret := coalesce(new.sale_return_id, old.sale_return_id);
  v_tenant := coalesce(new.tenant_id, old.tenant_id);
  select s.prices_include_tax into v_incl
    from sale_returns r join sales s on s.id = r.sale_id and s.tenant_id = r.tenant_id
   where r.id = v_ret and r.tenant_id = v_tenant;
  update sale_returns r
     set subtotal_minor = t.sub, tax_minor = t.tax,
         total_minor = t.sub + case when coalesce(v_incl, false) then 0 else t.tax end
    from (select coalesce(sum(line_total_minor), 0) sub, coalesce(sum(tax_minor), 0) tax
            from sale_return_items where tenant_id = v_tenant and sale_return_id = v_ret) t
   where r.id = v_ret and r.tenant_id = v_tenant;
  return null;
end $$;

-- ===================== Recepciones de compra =====================

create function receipt_item_before_insert() returns trigger
language plpgsql as $$
declare v_pi purchase_items; v_rc purchase_receipts; v_p purchases;
begin
  select * into v_rc from purchase_receipts where id = new.receipt_id and tenant_id = new.tenant_id;
  select * into v_pi from purchase_items where id = new.purchase_item_id and tenant_id = new.tenant_id for update;
  if v_pi.purchase_id <> v_rc.purchase_id then
    raise exception 'La línea no pertenece a la compra de la recepción' using errcode = 'check_violation';
  end if;
  select * into v_p from purchases where id = v_rc.purchase_id and tenant_id = new.tenant_id;
  if v_p.status not in ('Ordenado', 'Recibido Parcial') then
    raise exception 'No se puede recibir mercadería de una compra en estado "%"', v_p.status using errcode = 'check_violation';
  end if;
  if v_pi.quantity - v_pi.quantity_received < new.quantity then
    raise exception 'Cantidad recibida (%) mayor a la pendiente (%)', new.quantity, v_pi.quantity - v_pi.quantity_received
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create function receipt_item_after_insert() returns trigger
language plpgsql as $$
declare v_pi purchase_items; v_rc purchase_receipts; v_pending int; v_track boolean;
begin
  select * into v_rc from purchase_receipts where id = new.receipt_id and tenant_id = new.tenant_id;
  update purchase_items set quantity_received = quantity_received + new.quantity
   where id = new.purchase_item_id and tenant_id = new.tenant_id
  returning * into v_pi;

  if v_pi.product_id is not null then
    select track_stock into v_track from products where id = v_pi.product_id and tenant_id = new.tenant_id;
    if coalesce(v_track, false) then
      insert into stock_movements (tenant_id, occurred_at, warehouse_id, product_id, variation_id,
                                   movement_type, quantity, unit_cost_minor, reference_type, reference_id, notes)
      values (new.tenant_id, v_rc.received_at, v_rc.warehouse_id, v_pi.product_id, v_pi.variation_id,
              'Compra', new.quantity, v_pi.unit_price_minor, 'purchase_receipt', v_rc.id,
              'Recepción ' || coalesce(v_rc.number, ''));
    end if;
  end if;

  select count(*) into v_pending from purchase_items
   where tenant_id = new.tenant_id and purchase_id = v_rc.purchase_id and quantity_received < quantity;
  update purchases
     set status = case when v_pending = 0 then 'Recibido Total' else 'Recibido Parcial' end,
         received_at = case when v_pending = 0 then v_rc.received_at else received_at end
   where id = v_rc.purchase_id and tenant_id = new.tenant_id and status in ('Ordenado', 'Recibido Parcial');
  perform refresh_purchase_state(new.tenant_id, v_rc.purchase_id);
  return null;
end $$;
