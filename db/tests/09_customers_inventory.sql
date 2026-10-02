-- 09 · Billetera → deuda, ajustes/transferencias de stock, segmentos, crédito y stock por producto
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t2 uuid := pg_temp.tid('demo-distribuidora'); t1 uuid := pg_temp.tid('demo-retail');
  norte uuid; u uuid; applied bigint; bal bigint; v_open bigint; p uuid; w1 uuid; w2 uuid; n int; d numeric; st text; c uuid;
  u_vend uuid;
begin
  select id into norte from customers where tenant_id = t2 and display_name = 'Distribuidora Norte';
  select u.id into u from users u join roles r on r.id = u.role_id where u.tenant_id = t2 and r.code = 'admin' limit 1;
  select u.id into u_vend from users u join roles r on r.id = u.role_id where u.tenant_id = t2 and r.code = 'lectura' limit 1;

  -- sin permiso no se puede
  perform set_config('app.tenant_id', t2::text, true);
  perform set_config('app.user_id', u_vend::text, true);
  set local role nexo_app;
  perform pg_temp.assert(pg_temp.throws(format('select wallet_apply_to_debt(%L)', norte), '42501'), 'solo lectura no aplica billetera');
  reset role;

  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;
  -- caso del Excel: billetera 2.000 vs deuda 17.500 → deuda 15.500 y billetera 0
  applied := wallet_apply_to_debt(norte);
  perform pg_temp.assert(applied = 200000, 'se aplican 2.000,00: ' || applied);
  select open_minor into v_open from accounts_receivable where tenant_id = t2 and customer_id = norte and status in ('Abierta','Parcial');
  perform pg_temp.assert(v_open = 1550000, 'deuda restante 15.500,00: ' || v_open);
  select balance_minor into bal from v_wallet_balances where customer_id = norte;
  perform pg_temp.assert(coalesce(bal, 0) = 0, 'billetera en cero');
  perform pg_temp.assert(wallet_apply_to_debt(norte) = 0, 'sin saldo no aplica nada');
  perform pg_temp.assert(pg_temp.throws(format('select wallet_apply_to_debt(%L)', gen_random_uuid()), '23503'), 'cliente inexistente');
  reset role;

  -- varias deudas: se paga primero la más antigua
  perform set_config('app.tenant_id', t1::text, true);
  select u.id into u from users u join roles r on r.id = u.role_id where u.tenant_id = t1 and r.code = 'admin' limit 1;
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;
  insert into customers (tenant_id, customer_type, person_type, first_name) values (t1, 'B2C', 'Persona Física', 'Multi') returning id into c;
  insert into accounts_receivable (tenant_id, customer_id, issue_date, due_date, currency, original_minor) values (t1, c, current_date - 40, current_date - 10, 'ARS', 100000);
  insert into accounts_receivable (tenant_id, customer_id, issue_date, due_date, currency, original_minor) values (t1, c, current_date - 5, current_date + 25, 'ARS', 100000);
  insert into wallet_transactions (tenant_id, customer_id, type, amount_minor, currency) values (t1, c, 'Carga', 150000, 'ARS');
  applied := wallet_apply_to_debt(c, 120000);
  perform pg_temp.assert(applied = 120000, 'respeta el máximo indicado');
  perform pg_temp.assert((select open_minor from accounts_receivable where customer_id = c and due_date < current_date) = 0, 'la deuda más antigua se salda primero');
  perform pg_temp.assert((select open_minor from accounts_receivable where customer_id = c and due_date > current_date) = 80000, 'el resto va a la siguiente');
  perform pg_temp.assert((select balance_minor from v_wallet_balances where customer_id = c) = 30000, 'queda saldo en billetera');

  -- ---- Inventario
  select id into w1 from warehouses where tenant_id = t1 and is_default;
  insert into warehouses (tenant_id, code, name) values (t1, 'ALT', 'Alterno') returning id into w2;
  insert into products (tenant_id, sku, name, currency, sale_price_minor, stock_min) values (t1, 'T9-1', 'Prod 9', 'ARS', 100, 3) returning id into p;
  perform pg_temp.assert((select stock_state from v_product_stock where product_id = p) = 'agotado', 'sin existencias = agotado');
  d := stock_adjust(p, w1, 10, 'Conteo inicial');
  perform pg_temp.assert(d = 10 and (select stock_state from v_product_stock where product_id = p) = 'ok', 'ajuste a 10');
  d := stock_adjust(p, w1, 2, 'Rotura');
  perform pg_temp.assert(d = -8 and (select stock_state from v_product_stock where product_id = p) = 'bajo', 'ajuste a 2 deja stock bajo');
  perform pg_temp.assert(stock_adjust(p, w1, 2, 'Sin cambio') = 0 and (select count(*) from stock_movements where product_id = p) = 2, 'ajuste sin diferencia no genera movimiento');
  perform pg_temp.assert(pg_temp.throws(format('select stock_adjust(%L,%L,5,'''')', p, w1), '23514'), 'el motivo es obligatorio');
  perform pg_temp.assert(pg_temp.throws(format('select stock_adjust(%L,%L,-1,''x'')', p, w1), '23514'), 'no admite existencia negativa');
  perform stock_adjust(p, w1, 10, 'Reposición');
  perform stock_transfer(p, w1, w2, 4);
  perform pg_temp.assert((select quantity_on_hand from inventory_levels where product_id = p and warehouse_id = w2) = 4 and (select on_hand from v_product_stock where product_id = p) = 10, 'transferencia conserva el total');
  perform pg_temp.assert(pg_temp.throws(format('select stock_transfer(%L,%L,%L,99)', p, w1, w2), '23514'), 'no se transfiere más de lo que hay');
  perform pg_temp.assert(pg_temp.throws(format('select stock_transfer(%L,%L,%L,1)', p, w1, w1), '23514'), 'origen distinto del destino');
  reset role;

  -- ---- Crédito y segmentos (seed Norte: límite informado en el seed o nulo)
  update customers set credit_limit_minor = 1000000 where id = norte;
  perform pg_temp.assert((select over_limit from v_customer_credit where customer_id = norte), 'Norte supera su límite de crédito');
  perform pg_temp.assert((select available_minor from v_customer_credit where customer_id = norte) < 0, 'disponible negativo');
  perform pg_temp.assert(exists (select 1 from v_customer_segments where customer_id = c and segment = 'nuevo_30d'), 'cliente nuevo en segmento nuevo_30d');
  perform pg_temp.assert(exists (select 1 from v_customer_segments where customer_id = c and segment = 'sin_compras'), 'sin compras');
  perform pg_temp.assert(exists (select 1 from v_customer_segments where customer_id = c and segment = 'con_deuda_vencida') = false, 'deuda vencida saldada ya no cuenta');
  perform pg_temp.assert(exists (select 1 from v_customer_segments where customer_id = c and segment = 'con_saldo_a_favor'), 'con saldo a favor');
end
$t$;

rollback;
