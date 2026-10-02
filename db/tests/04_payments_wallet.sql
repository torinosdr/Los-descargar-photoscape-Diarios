-- 04 · Cobranzas: imputación de pagos, anulación, billetera, notas de crédito, pagos a proveedores
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-retail'); t2 uuid := pg_temp.tid('demo-distribuidora');
  c uuid; c2 uuid; s uuid; ar uuid; ar2 uuid; pay uuid; pay2 uuid; cn uuid; w uuid;
  v_bal bigint; sv record; a record; pr record; sup uuid; pu uuid; ap uuid;
begin
  insert into customers (tenant_id, customer_type, person_type, first_name) values (t1, 'B2C', 'Persona Física', 'Cobranza') returning id into c;
  insert into customers (tenant_id, customer_type, person_type, first_name) values (t1, 'B2C', 'Persona Física', 'Otro') returning id into c2;
  insert into sales (tenant_id, customer_id, currency) values (t1, c, 'ARS') returning id into s;
  insert into sale_items (tenant_id, sale_id, description, quantity, unit_price_minor) values (t1, s, 'X', 1, 1000000);
  insert into accounts_receivable (tenant_id, customer_id, sale_id, issue_date, due_date, currency, original_minor)
    values (t1, c, s, current_date, current_date + 30, 'ARS', 1000000) returning id into ar;

  -- pago parcial
  insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency) values (t1, 'Entrada', c, 'Efectivo', 400000, 'ARS') returning id into pay;
  insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (t1, pay, ar, 400000);
  select * into a from accounts_receivable where id = ar;
  perform pg_temp.assert(a.paid_minor = 400000 and a.open_minor = 600000 and a.status = 'Parcial', 'AR parcial');
  select * into sv from sales where id = s;
  perform pg_temp.assert(sv.paid_minor = 400000 and sv.payment_status = 'Parcial' and sv.status = 'Pago Parcial', 'la venta pasa a Pago Parcial: ' || sv.status);
  select * into pr from payments where id = pay;
  perform pg_temp.assert(pr.allocated_minor = 400000 and pr.unallocated_minor = 0, 'pago totalmente imputado');

  -- validaciones de imputación
  perform pg_temp.assert(pg_temp.throws(format('insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (%L,%L,%L,1)', t1, pay, ar), '23514'), 'pago sin saldo para imputar');
  insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency) values (t1, 'Entrada', c, 'Transferencia', 900000, 'ARS') returning id into pay2;
  perform pg_temp.assert(pg_temp.throws(format('insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (%L,%L,%L,700000)', t1, pay2, ar), '23514'), 'no se puede imputar más que el saldo de la cuenta');
  insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency) values (t1, 'Entrada', c2, 'Efectivo', 100, 'ARS') returning id into w;
  perform pg_temp.assert(pg_temp.throws(format('insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (%L,%L,%L,100)', t1, w, ar), '23514'), 'pago de otro cliente rechazado');
  perform pg_temp.assert(pg_temp.throws(format('insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency) values (%L,''Entrada'',%L,''Efectivo'',0,''ARS'')', t1, c), '23514'), 'monto 0 rechazado');

  -- cobro del resto → Pagado
  insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (t1, pay2, ar, 600000);
  select * into sv from sales where id = s;
  perform pg_temp.assert(sv.status = 'Pagado' and sv.payment_status = 'Pagado', 'venta pagada: ' || sv.status);
  perform pg_temp.assert((select unallocated_minor from payments where id = pay2) = 300000, 'saldo sin imputar 3000,00');

  -- anular un pago revierte la cuenta y la venta
  update payments set status = 'Anulado' where id = pay2;
  select * into a from accounts_receivable where id = ar;
  select * into sv from sales where id = s;
  perform pg_temp.assert(a.paid_minor = 400000 and a.status = 'Parcial', 'anular pago reabre la cuenta');
  perform pg_temp.assert(sv.status = 'Pago Parcial' and sv.paid_minor = 400000, 'anular pago revierte la venta: ' || sv.status);

  -- nota de crédito aplicada a la deuda
  insert into credit_notes (tenant_id, customer_id, currency, total_minor) values (t1, c, 'ARS', 250000) returning id into cn;
  perform pg_temp.assert(pg_temp.throws(format('insert into credit_note_applications (tenant_id, credit_note_id, receivable_id, amount_minor) values (%L,%L,%L,300000)', t1, cn, ar), '23514'), 'NC sin saldo suficiente');
  insert into credit_note_applications (tenant_id, credit_note_id, receivable_id, amount_minor) values (t1, cn, ar, 250000);
  select * into a from accounts_receivable where id = ar;
  perform pg_temp.assert(a.credited_minor = 250000 and a.open_minor = 350000, 'NC reduce la deuda');
  perform pg_temp.assert((select status from credit_notes where id = cn) = 'Aplicada' and (select remaining_minor from credit_notes where id = cn) = 0, 'NC totalmente aplicada');

  -- ---- Billetera
  insert into wallet_transactions (tenant_id, customer_id, type, amount_minor, currency) values (t1, c, 'Carga', 200000, 'ARS');
  select balance_minor into v_bal from v_wallet_balances where customer_id = c and currency = 'ARS';
  perform pg_temp.assert(v_bal = 200000, 'saldo de billetera 2000,00: ' || coalesce(v_bal::text, 'null'));
  perform pg_temp.assert(pg_temp.throws(format('insert into wallet_transactions (tenant_id, customer_id, type, amount_minor, currency) values (%L,%L,''Retiro'',300000,''ARS'')', t1, c), '23514'), 'la billetera no puede quedar negativa');
  -- aplicar billetera a la deuda más antigua: movimiento de billetera + pago con billetera imputado
  insert into wallet_transactions (tenant_id, customer_id, type, amount_minor, currency, reference_type, reference_id)
    values (t1, c, 'Aplicación a deuda', 200000, 'ARS', 'receivable', ar);
  insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency) values (t1, 'Entrada', c, 'Billetera', 200000, 'ARS') returning id into w;
  insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (t1, w, ar, 200000);
  select * into a from accounts_receivable where id = ar;
  perform pg_temp.assert(a.open_minor = 150000, 'deuda restante 1500,00: ' || a.open_minor);
  select balance_minor into v_bal from v_wallet_balances where customer_id = c and currency = 'ARS';
  perform pg_temp.assert(coalesce(v_bal, 0) = 0, 'billetera en 0');
  perform pg_temp.assert(pg_temp.throws('update wallet_transactions set notes = ''x''', '23001'), 'billetera inmutable');

  -- ---- Pagos a proveedores
  select id into sup from suppliers where tenant_id = t2 limit 1;
  insert into purchases (tenant_id, supplier_id, currency) values (t2, sup, 'ARS') returning id into pu;
  insert into purchase_items (tenant_id, purchase_id, description, quantity, unit_price_minor) values (t2, pu, 'Insumo', 10, 50000);
  insert into accounts_payable (tenant_id, supplier_id, purchase_id, issue_date, due_date, currency, original_minor)
    values (t2, sup, pu, current_date, current_date + 30, 'ARS', 500000) returning id into ap;
  insert into payments (tenant_id, direction, supplier_id, method, amount_minor, currency) values (t2, 'Salida', sup, 'Transferencia', 200000, 'ARS') returning id into pay;
  insert into payment_allocations (tenant_id, payment_id, payable_id, amount_minor) values (t2, pay, ap, 200000);
  perform pg_temp.assert((select payment_status from purchases where id = pu) = 'Parcial', 'compra con pago parcial');
  insert into payments (tenant_id, direction, supplier_id, method, amount_minor, currency) values (t2, 'Salida', sup, 'Transferencia', 300000, 'ARS') returning id into pay2;
  insert into payment_allocations (tenant_id, payment_id, payable_id, amount_minor) values (t2, pay2, ap, 300000);
  perform pg_temp.assert((select payment_status from purchases where id = pu) = 'Pagado', 'compra pagada');
  perform pg_temp.assert((select status from accounts_payable where id = ap) = 'Pagada', 'cuenta por pagar saldada');
end
$t$;

rollback;
