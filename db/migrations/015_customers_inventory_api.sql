-- Fase 4 · Operaciones de clientes, billetera e inventario (funciones que usará la API) + vistas de segmentos y crédito.

-- ===================== Billetera → deuda más antigua =====================
-- Aplica el saldo a favor del cliente a sus cuentas por cobrar abiertas, de la más antigua a la más nueva.
-- Genera: movimiento de billetera "Aplicación a deuda" + pago "Billetera" + imputación. Devuelve lo aplicado.
create function wallet_apply_to_debt(p_customer uuid, p_max_minor bigint default null) returns bigint
language plpgsql as $$
declare
  v_tenant uuid := app_tenant(); v_cur char(3); v_balance bigint; v_left bigint; v_apply bigint; v_total bigint := 0;
  ar record; v_pay uuid;
begin
  perform require_permission('payments.create');
  perform require_permission('wallet.create');
  select base_currency into v_cur from tenants where id = v_tenant;
  perform 1 from customers where id = p_customer and tenant_id = v_tenant for update;   -- serializa al cliente
  if not found then raise exception 'Cliente inexistente' using errcode = 'foreign_key_violation'; end if;
  select coalesce(sum(signed_minor), 0) into v_balance from wallet_transactions
   where tenant_id = v_tenant and customer_id = p_customer and currency = v_cur;
  v_left := least(v_balance, coalesce(p_max_minor, v_balance));
  for ar in select id, open_minor from accounts_receivable
             where tenant_id = v_tenant and customer_id = p_customer and currency = v_cur and deleted_at is null
               and status in ('Abierta', 'Parcial') and open_minor > 0
             order by due_date, issue_date, created_at loop
    exit when v_left <= 0;
    v_apply := least(v_left, ar.open_minor);
    insert into wallet_transactions (tenant_id, customer_id, type, amount_minor, currency, reference_type, reference_id)
    values (v_tenant, p_customer, 'Aplicación a deuda', v_apply, v_cur, 'receivable', ar.id);
    insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency, notes)
    values (v_tenant, 'Entrada', p_customer, 'Billetera', v_apply, v_cur, 'Aplicación de saldo de billetera') returning id into v_pay;
    insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (v_tenant, v_pay, ar.id, v_apply);
    v_left := v_left - v_apply; v_total := v_total + v_apply;
  end loop;
  return v_total;
end $$;

-- ===================== Inventario: ajuste y transferencia =====================
create function stock_adjust(p_product uuid, p_warehouse uuid, p_new_qty numeric, p_reason text, p_variation uuid default null) returns numeric
language plpgsql as $$
declare v_now numeric; v_delta numeric;
begin
  perform require_permission('inventory.adjust');
  if p_new_qty < 0 then raise exception 'La existencia no puede ser negativa' using errcode = 'check_violation'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'Indica el motivo del ajuste' using errcode = 'check_violation'; end if;
  select coalesce(quantity_on_hand, 0) into v_now from inventory_levels
   where tenant_id = app_tenant() and warehouse_id = p_warehouse and product_id = p_product and variation_id is not distinct from p_variation;
  v_now := coalesce(v_now, 0);
  v_delta := p_new_qty - v_now;
  if v_delta <> 0 then
    insert into stock_movements (tenant_id, warehouse_id, product_id, variation_id, movement_type, quantity, reference_type, notes)
    values (app_tenant(), p_warehouse, p_product, p_variation, 'Ajuste', v_delta, 'adjustment', p_reason);
  end if;
  return v_delta;
end $$;

create function stock_transfer(p_product uuid, p_from uuid, p_to uuid, p_qty numeric, p_variation uuid default null) returns void
language plpgsql as $$
declare v_ref uuid := gen_random_uuid();
begin
  perform require_permission('inventory.update');
  if p_from = p_to then raise exception 'El origen y el destino deben ser distintos' using errcode = 'check_violation'; end if;
  if p_qty <= 0 then raise exception 'La cantidad debe ser mayor a cero' using errcode = 'check_violation'; end if;
  insert into stock_movements (tenant_id, warehouse_id, product_id, variation_id, movement_type, quantity, reference_type, reference_id)
  values (app_tenant(), p_from, p_product, p_variation, 'Transferencia salida', -p_qty, 'transfer', v_ref);
  insert into stock_movements (tenant_id, warehouse_id, product_id, variation_id, movement_type, quantity, reference_type, reference_id)
  values (app_tenant(), p_to, p_product, p_variation, 'Transferencia entrada', p_qty, 'transfer', v_ref);
end $$;

-- ===================== Vistas =====================
-- Existencias totales por producto (todas las variaciones y depósitos) con alerta de reposición.
create view v_product_stock with (security_invoker = true) as
select p.tenant_id, p.id as product_id, p.sku, p.name, p.status, p.track_stock, p.stock_min,
       coalesce(sum(l.quantity_on_hand), 0) as on_hand, coalesce(sum(l.reserved_quantity), 0) as reserved,
       coalesce(sum(l.available_quantity), 0) as available,
       case when not p.track_stock then 'sin_control'
            when coalesce(sum(l.available_quantity), 0) <= 0 then 'agotado'
            when coalesce(sum(l.available_quantity), 0) <= p.stock_min then 'bajo' else 'ok' end as stock_state
  from products p
  left join inventory_levels l on l.tenant_id = p.tenant_id and l.product_id = p.id
 where p.deleted_at is null
 group by p.tenant_id, p.id;

-- Crédito de clientes B2B: límite, usado (deuda abierta) y disponible.
create view v_customer_credit with (security_invoker = true) as
select c.tenant_id, c.id as customer_id, c.display_name, c.credit_limit_minor,
       coalesce(sum(ar.open_minor) filter (where ar.status in ('Abierta', 'Parcial')), 0)::bigint as used_minor,
       case when c.credit_limit_minor is null then null
            else c.credit_limit_minor - coalesce(sum(ar.open_minor) filter (where ar.status in ('Abierta', 'Parcial')), 0) end::bigint as available_minor,
       (c.credit_limit_minor is not null
        and coalesce(sum(ar.open_minor) filter (where ar.status in ('Abierta', 'Parcial')), 0) > c.credit_limit_minor) as over_limit
  from customers c
  left join accounts_receivable ar on ar.tenant_id = c.tenant_id and ar.customer_id = c.id and ar.deleted_at is null
 where c.deleted_at is null
 group by c.tenant_id, c.id;

-- Segmentos automáticos (un cliente puede estar en varios).
create view v_customer_segments with (security_invoker = true) as
with base as (
  select v.*, c.created_at,
         percent_rank() over (partition by v.tenant_id order by v.sales_total_minor) as pr
    from v_customer_360 v join customers c on c.id = v.customer_id and c.tenant_id = v.tenant_id
   where c.deleted_at is null and c.status = 'Activo'
)
select tenant_id, customer_id, 'vip'::text as segment from base where sales_count > 0 and pr >= 0.8
union all select tenant_id, customer_id, 'con_deuda_vencida' from base where receivable_overdue_minor > 0
union all select tenant_id, customer_id, 'inactivo_90d' from base where coalesce(last_sale_at, created_at) < now() - interval '90 days'
union all select tenant_id, customer_id, 'nuevo_30d' from base where created_at >= now() - interval '30 days'
union all select tenant_id, customer_id, 'con_saldo_a_favor' from base where wallet_balance_minor > 0
union all select tenant_id, customer_id, 'sin_compras' from base where sales_count = 0;

grant select on v_product_stock, v_customer_credit, v_customer_segments to nexo_app, nexo_platform;
grant execute on function wallet_apply_to_debt(uuid, bigint), stock_adjust(uuid, uuid, numeric, text, uuid), stock_transfer(uuid, uuid, uuid, numeric, uuid) to nexo_app;
