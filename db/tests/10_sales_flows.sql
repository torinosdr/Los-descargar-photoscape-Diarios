-- 10 · Flujos de ventas: presupuesto → venta → reserva → factura → despacho → cobro → anulación → devolución
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-retail'); u uuid; w uuid; c uuid; p uuid; q uuid; s uuid; s2 uuid; inv uuid; inv2 uuid; pay uuid;
  n int; v bigint; ar record; rt uuid; si uuid; cn record;
begin
  select u.id into u from users u join roles r on r.id = u.role_id where u.tenant_id = t1 and r.code = 'admin' limit 1;
  perform set_config('app.tenant_id', t1::text, true);
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;

  select id into w from warehouses where tenant_id = t1 and is_default;
  insert into customers (tenant_id, customer_type, person_type, first_name, payment_terms_days) values (t1, 'B2C', 'Persona Física', 'Flujo', 15) returning id into c;
  insert into products (tenant_id, sku, name, currency, sale_price_minor, purchase_price_minor) values (t1, 'F-1', 'Prod flujo', 'ARS', 100000, 60000) returning id into p;
  perform stock_adjust(p, w, 10, 'Stock de prueba');

  -- ---- Presupuesto → venta
  insert into quotes (tenant_id, customer_id, currency, shipping_minor) values (t1, c, 'ARS', 5000) returning id into q;
  insert into quote_items (tenant_id, quote_id, product_id, description, quantity, unit_price_minor) values (t1, q, p, 'Prod flujo', 4, 100000);
  perform pg_temp.assert(pg_temp.throws(format('select quote_convert_to_sale(%L)', q), '23514'), 'un presupuesto en Borrador no se convierte');
  update quotes set status = 'Enviado' where id = q; update quotes set status = 'Aceptado' where id = q;
  s := quote_convert_to_sale(q);
  perform pg_temp.assert((select status from quotes where id = q) = 'Convertido a Venta' and (select converted_sale_id from quotes where id = q) = s, 'presupuesto convertido y enlazado');
  perform pg_temp.assert((select total_minor from sales where id = s) = 405000 and (select count(*) from sale_items where sale_id = s) = 1, 'la venta copia líneas y envío: 4.050,00');
  perform pg_temp.assert((select due_date from sales where id = s) = current_date + 15, 'vencimiento según el plazo del cliente');
  perform pg_temp.assert(pg_temp.throws(format('select quote_convert_to_sale(%L)', q), '23514'), 'no se convierte dos veces');

  -- ---- Reserva
  perform pg_temp.assert(sale_reserve_stock(s) = 1, 'reserva una línea');
  perform pg_temp.assert(sale_reserve_stock(s) = 0, 'reservar de nuevo no duplica');
  perform pg_temp.assert((select available_quantity from inventory_levels where product_id = p and warehouse_id = w) = 6, 'disponible 10 − 4 = 6');

  -- ---- Factura y cuenta por cobrar
  inv := sale_issue_invoice(s);
  perform pg_temp.assert((select total_minor from invoices where id = inv) = 405000, 'factura por 4.050,00');
  select * into ar from accounts_receivable where sale_id = s;
  perform pg_temp.assert(ar.original_minor = 405000 and ar.due_date = current_date + 15 and ar.status = 'Abierta', 'cuenta por cobrar creada');
  perform pg_temp.assert(pg_temp.throws(format('select sale_issue_invoice(%L)', s), '23505'), 'no se factura dos veces');

  -- ---- Despacho
  perform pg_temp.assert(pg_temp.throws(format('select sale_dispatch(%L)', s), '23514'), 'no se despacha una venta pendiente de preparación');
  update sales set status = 'En Preparación' where id = s;
  perform sale_dispatch(s);
  perform pg_temp.assert((select status from sales where id = s) = 'Enviado', 'venta enviada');
  perform pg_temp.assert((select quantity_on_hand from inventory_levels where product_id = p and warehouse_id = w) = 6
                         and (select reserved_quantity from inventory_levels where product_id = p and warehouse_id = w) = 0, 'el despacho descuenta stock y consume la reserva');

  -- ---- Cobro: parcial, luego completo con excedente a billetera
  pay := payment_register(c, 'Transferencia', 100000, null, 'TRX-A');
  select * into ar from accounts_receivable where sale_id = s;
  perform pg_temp.assert(ar.paid_minor = 100000 and ar.status = 'Parcial', 'cobro parcial imputado a la deuda');
  perform pg_temp.assert((select payment_status from sales where id = s) = 'Parcial', 'venta con pago parcial');
  pay := payment_register(c, 'Efectivo', 400000, null, 'EF-1');
  select * into ar from accounts_receivable where sale_id = s;
  perform pg_temp.assert(ar.status = 'Pagada' and ar.open_minor = 0, 'deuda saldada');
  perform pg_temp.assert((select balance_minor from v_wallet_balances where customer_id = c) = 95000, 'el excedente (950,00) queda en la billetera');
  perform pg_temp.assert((select status from invoices where id = inv) = 'Pagada', 'factura pagada');
  perform pg_temp.assert(pg_temp.throws(format('select payment_register(%L, ''Billetera'', 100)', c), '23514'), 'no se cobra con "Billetera" por esta vía');
  perform pg_temp.assert(pg_temp.throws(format('select payment_register(%L, ''Efectivo'', 0)', c), '23514'), 'monto 0 rechazado');
  perform pg_temp.assert(pg_temp.throws(format('select sale_cancel(%L, ''x'')', s), '23514'), 'una venta enviada no se anula (usar devolución)');

  -- ---- Devolución con nota de crédito/billetera
  select id into si from sale_items where sale_id = s;
  perform pg_temp.assert(pg_temp.throws(format('select return_create(%L, ''x'', ''Billetera'', ''[]''::jsonb)', s), '23514'), 'devolución sin líneas');
  rt := return_create(s, 'No era lo esperado', 'Billetera', jsonb_build_array(jsonb_build_object('sale_item_id', si, 'quantity', 1, 'restock', true)));
  v := return_complete(rt);
  perform pg_temp.assert(v = 100000, 'se devuelve 1.000,00');
  perform pg_temp.assert((select balance_minor from v_wallet_balances where customer_id = c) = 195000, 'billetera + 1.000,00');
  perform pg_temp.assert((select quantity_on_hand from inventory_levels where product_id = p and warehouse_id = w) = 7, 'la mercadería vuelve al stock');
  perform pg_temp.assert(pg_temp.throws(format('select return_complete(%L)', rt), '23514'), 'una devolución no se completa dos veces');
  perform pg_temp.assert(pg_temp.throws(format('select return_create(%L, ''x'', ''Billetera'', %L::jsonb)', s, jsonb_build_array(jsonb_build_object('sale_item_id', si, 'quantity', 4))), '23514'), 'no se devuelve más de lo vendido');
  rt := return_create(s, 'Resto', 'Efectivo', jsonb_build_array(jsonb_build_object('sale_item_id', si, 'quantity', 3, 'restock', false)));
  perform return_complete(rt);
  perform pg_temp.assert((select status from sales where id = s) = 'Devuelto', 'devolución total deja la venta en Devuelto');
  perform pg_temp.assert((select quantity_on_hand from inventory_levels where product_id = p and warehouse_id = w) = 7, 'sin reingreso no cambia el stock');
  perform pg_temp.assert(exists (select 1 from payments where customer_id = c and direction = 'Salida' and amount_minor = 300000), 'reembolso en efectivo registrado como pago de salida');

  -- ---- Nota de crédito aplicada a otra deuda
  insert into sales (tenant_id, customer_id, currency, warehouse_id, status) values (t1, c, 'ARS', w, 'Pendiente de Pago') returning id into s2;
  insert into sale_items (tenant_id, sale_id, product_id, description, quantity, unit_price_minor) values (t1, s2, p, 'Prod flujo', 2, 100000);
  inv2 := sale_issue_invoice(s2);
  update sales set status = 'En Preparación' where id = s2;
  perform sale_reserve_stock(s2); perform sale_dispatch(s2);
  si := (select id from sale_items where sale_id = s2);
  rt := return_create(s2, 'Defecto', 'Nota de crédito', jsonb_build_array(jsonb_build_object('sale_item_id', si, 'quantity', 1)));
  perform return_complete(rt);
  select * into cn from credit_notes where sale_return_id = rt;
  perform pg_temp.assert(cn.total_minor = 100000 and cn.applied_minor = 100000 and cn.status = 'Aplicada', 'la nota de crédito se aplica a la deuda de la venta');
  perform pg_temp.assert((select open_minor from accounts_receivable where sale_id = s2) = 100000, 'la deuda baja a 1.000,00');

  -- ---- Anulación con cobro y reserva
  insert into sales (tenant_id, customer_id, currency, warehouse_id) values (t1, c, 'ARS', w) returning id into s2;
  insert into sale_items (tenant_id, sale_id, product_id, description, quantity, unit_price_minor) values (t1, s2, p, 'Prod flujo', 3, 100000);
  perform sale_reserve_stock(s2);
  inv2 := sale_issue_invoice(s2);
  perform payment_register(c, 'Transferencia', 120000, (select id from accounts_receivable where sale_id = s2));
  v := (select balance_minor from v_wallet_balances where customer_id = c);
  perform pg_temp.assert(pg_temp.throws(format('select sale_cancel(%L, '''')', s2), '23514'), 'la anulación exige motivo');
  perform pg_temp.assert(sale_cancel(s2, 'Cliente desistió') = 120000, 'devuelve lo cobrado');
  perform pg_temp.assert((select balance_minor from v_wallet_balances where customer_id = c) = v + 120000, 'lo cobrado vuelve a la billetera');
  perform pg_temp.assert((select status from invoices where id = inv2) = 'Anulada' and (select status from accounts_receivable where sale_id = s2) = 'Anulada', 'factura y deuda anuladas');
  perform pg_temp.assert((select status from stock_reservations where reference_id = s2) = 'Liberada', 'reserva liberada');
  perform pg_temp.assert((select status from sales where id = s2) = 'Cancelado', 'venta cancelada');

  -- ---- Antigüedad de deuda
  insert into accounts_receivable (tenant_id, customer_id, issue_date, due_date, currency, original_minor) values (t1, c, current_date - 100, current_date - 45, 'ARS', 5000);
  perform pg_temp.assert((select d31_60_minor from v_receivables_aging where customer_id = c) = 5000, 'antigüedad: 31-60 días');
  perform pg_temp.assert(exists (select 1 from v_sales_by_month where month = date_trunc('month', now())::date), 'ventas por mes');
  reset role;

  -- ---- Permisos: un usuario de solo lectura no opera
  select u.id into u from users u join roles r on r.id = u.role_id where u.tenant_id = t1 and r.code = 'lectura' limit 1;
  if u is null then
    insert into users (tenant_id, email, name, role_id, status) select t1, 'ro@x.test', 'RO', id, 'Activo' from roles where tenant_id = t1 and code = 'lectura' returning id into u;
  end if;
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;
  perform pg_temp.assert(pg_temp.throws(format('select payment_register(%L, ''Efectivo'', 100)', c), '42501'), 'solo lectura no cobra');
  perform pg_temp.assert(pg_temp.throws(format('select sale_cancel(%L, ''x'')', s), '42501'), 'solo lectura no anula');
  reset role;
end
$t$;

rollback;
