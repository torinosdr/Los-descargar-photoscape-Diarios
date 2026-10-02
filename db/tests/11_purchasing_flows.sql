-- 11 · Compras: orden → recepción → factura del proveedor → pago; cancelación; gastos
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-retail'); u uuid; w uuid; sup uuid; sup2 uuid; p uuid; pu uuid; pu2 uuid; pi1 uuid; pi2 uuid; rc uuid; ap uuid; ap2 uuid; pay uuid;
  cat uuid; ex uuid; v bigint;
begin
  select u.id into u from users u join roles r on r.id = u.role_id where u.tenant_id = t1 and r.code = 'admin' limit 1;
  perform set_config('app.tenant_id', t1::text, true);
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;

  select id into w from warehouses where tenant_id = t1 and is_default;
  insert into suppliers (tenant_id, name, payment_terms_days) values (t1, 'Proveedor 11', 30) returning id into sup;
  insert into suppliers (tenant_id, name) values (t1, 'Proveedor 11b') returning id into sup2;
  insert into products (tenant_id, sku, name, currency, sale_price_minor, purchase_price_minor) values (t1, 'P-11', 'Prod compra', 'ARS', 2000, 1000) returning id into p;

  insert into purchases (tenant_id, supplier_id, currency, payment_terms_days, warehouse_id) values (t1, sup, 'ARS', 30, w) returning id into pu;
  perform pg_temp.assert(pg_temp.throws(format('select purchase_confirm(%L)', pu), '23514'), 'una orden sin líneas no se confirma');
  insert into purchase_items (tenant_id, purchase_id, product_id, description, quantity, unit_price_minor) values (t1, pu, p, 'A', 10, 1000) returning id into pi1;
  insert into purchase_items (tenant_id, purchase_id, description, quantity, unit_price_minor) values (t1, pu, 'Servicio', 2, 5000) returning id into pi2;
  perform pg_temp.assert((select total_minor from purchases where id = pu) = 20000, 'total 200,00');
  perform pg_temp.assert(pg_temp.throws(format('select purchase_receive(%L)', pu), '23514'), 'no se recibe en Borrador');
  perform pg_temp.assert(pg_temp.throws(format('select purchase_register_invoice(%L, ''F-1'')', pu), '23514'), 'no se factura en Borrador');
  perform purchase_confirm(pu);
  perform pg_temp.assert((select status from purchases where id = pu) = 'Ordenado', 'orden confirmada');

  -- recepción parcial y total
  rc := purchase_receive(pu, jsonb_build_array(jsonb_build_object('purchase_item_id', pi1, 'quantity', 4)));
  perform pg_temp.assert((select status from purchases where id = pu) = 'Recibido Parcial' and (select quantity_on_hand from inventory_levels where product_id = p and warehouse_id = w) = 4, 'recepción parcial suma stock');
  perform pg_temp.assert(pg_temp.throws(format('select purchase_receive(%L, %L::jsonb)', pu, jsonb_build_array(jsonb_build_object('purchase_item_id', pi1, 'quantity', 7))), '23514'), 'no se recibe más que lo pendiente');
  rc := purchase_receive(pu);
  perform pg_temp.assert((select status from purchases where id = pu) = 'Recibido Total' and (select quantity_on_hand from inventory_levels where product_id = p and warehouse_id = w) = 10, 'recibe el resto');
  perform pg_temp.assert(pg_temp.throws(format('select purchase_receive(%L)', pu), '23514'), 'ya no hay nada para recibir');

  -- factura del proveedor → cuenta por pagar
  ap := purchase_register_invoice(pu, 'FA-0001-123');
  perform pg_temp.assert((select original_minor from accounts_payable where id = ap) = 20000 and (select due_date from accounts_payable where id = ap) = current_date + 30, 'AP por 200,00 a 30 días');
  perform pg_temp.assert(pg_temp.throws(format('select purchase_register_invoice(%L, ''X'')', pu), '23505'), 'no se factura dos veces');

  -- pagos
  perform pg_temp.assert(pg_temp.throws(format('select supplier_payment_register(%L, ''Transferencia'', 30000)', sup), '23514'), 'no se paga más que la deuda');
  perform pg_temp.assert(pg_temp.throws(format('select supplier_payment_register(%L, ''Transferencia'', 100)', sup2), '23514'), 'proveedor sin deuda');
  pay := supplier_payment_register(sup, 'Transferencia', 8000, ap, 'T-1');
  perform pg_temp.assert((select status from accounts_payable where id = ap) = 'Parcial' and (select payment_status from purchases where id = pu) = 'Parcial', 'pago parcial');
  pay := supplier_payment_register(sup, 'Transferencia', 12000);
  perform pg_temp.assert((select status from accounts_payable where id = ap) = 'Pagada' and (select status from purchases where id = pu) = 'Pagado', 'compra pagada');
  perform pg_temp.assert((select count(*) from payments where supplier_id = sup and direction = 'Salida') = 2, 'dos pagos de salida');

  -- cancelación
  insert into purchases (tenant_id, supplier_id, currency, warehouse_id) values (t1, sup, 'ARS', w) returning id into pu2;
  insert into purchase_items (tenant_id, purchase_id, description, quantity, unit_price_minor) values (t1, pu2, 'B', 1, 3000);
  perform purchase_confirm(pu2);
  ap2 := purchase_register_invoice(pu2, 'FA-2');
  perform pg_temp.assert(pg_temp.throws(format('select purchase_cancel(%L, '''')', pu2), '23514'), 'la cancelación exige motivo');
  perform purchase_cancel(pu2, 'Pedido duplicado');
  perform pg_temp.assert((select status from purchases where id = pu2) = 'Cancelado' and (select status from accounts_payable where id = ap2) = 'Anulada', 'cancelada y deuda anulada');
  perform pg_temp.assert(pg_temp.throws(format('select purchase_cancel(%L, ''x'')', pu), '23514'), 'una compra pagada no se cancela');

  -- gastos
  select id into cat from expense_categories where tenant_id = t1 and name = 'Servicios';
  ex := expense_register(cat, 'Internet', 15000, current_date, 'Transferencia');
  perform pg_temp.assert((select status from expenses where id = ex) = 'Pagado', 'gasto pagado al registrarlo');
  ex := expense_register(cat, 'Luz', 9000);
  perform pg_temp.assert((select status from expenses where id = ex) = 'Pendiente', 'gasto pendiente');
  perform expense_pay(ex, 'Efectivo');
  perform pg_temp.assert((select status from expenses where id = ex) = 'Pagado', 'gasto pagado después');
  perform pg_temp.assert(pg_temp.throws(format('select expense_pay(%L, ''Efectivo'')', ex), '23514'), 'no se paga dos veces');
  perform pg_temp.assert(pg_temp.throws(format('select expense_register(%L, ''x'', 0)', cat), '23514'), 'monto 0');
  perform pg_temp.assert((select total_minor from v_expenses_monthly where category = 'Servicios' and month = date_trunc('month', current_date)::date) = 24000, 'gastos del mes por categoría');

  -- resumen
  select purchases_total_minor into v from v_supplier_summary where supplier_id = sup;
  perform pg_temp.assert(v = 20000, 'resumen: compras 200,00 (la cancelada no cuenta)');
  perform pg_temp.assert((select payable_open_minor from v_supplier_summary where supplier_id = sup) = 0, 'sin deuda abierta');
  reset role;

  -- sin permiso
  select u.id into u from users u join roles r on r.id = u.role_id where u.tenant_id = t1 and r.code = 'vendedor' limit 1;
  if u is null then
    insert into users (tenant_id, email, name, role_id, status) select t1, 'v11@x.test', 'V', id, 'Activo' from roles where tenant_id = t1 and code = 'vendedor' returning id into u;
  end if;
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;
  perform pg_temp.assert(pg_temp.throws(format('select supplier_payment_register(%L, ''Efectivo'', 100)', sup), '42501'), 'el vendedor no paga a proveedores');
  perform pg_temp.assert(pg_temp.throws(format('select purchase_confirm(%L)', pu2), '42501'), 'el vendedor no confirma compras');
  reset role;
end
$t$;

rollback;
