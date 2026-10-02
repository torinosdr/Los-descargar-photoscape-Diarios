-- 03 · Inventario: existencias, reservas, ledger inmutable, transferencias
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-retail');
  w1 uuid; w2 uuid; p uuid; lvl record; n int; s uuid; c1 uuid; res uuid;
begin
  select id into w1 from warehouses where tenant_id = t1 and is_default;
  insert into warehouses (tenant_id, code, name) values (t1, 'SEC', 'Secundario') returning id into w2;
  insert into products (tenant_id, sku, name, currency, sale_price_minor) values (t1, 'T-INV', 'Producto test', 'ARS', 1000) returning id into p;

  -- existencias = suma de movimientos
  insert into stock_movements (tenant_id, warehouse_id, product_id, movement_type, quantity) values (t1, w1, p, 'Stock inicial', 10);
  insert into stock_movements (tenant_id, warehouse_id, product_id, movement_type, quantity) values (t1, w1, p, 'Venta', -3);
  select * into lvl from inventory_levels where warehouse_id = w1 and product_id = p;
  perform pg_temp.assert(lvl.quantity_on_hand = 7 and lvl.available_quantity = 7, 'existencia 10−3=7, fue ' || lvl.quantity_on_hand);

  -- no se puede dejar stock negativo
  perform pg_temp.assert(pg_temp.throws(format('insert into stock_movements (tenant_id, warehouse_id, product_id, movement_type, quantity) values (%L,%L,%L,''Venta'',-8)', t1, w1, p), '23514'),
    'salida mayor a la existencia rechazada');
  perform pg_temp.assert(pg_temp.throws(format('insert into stock_movements (tenant_id, warehouse_id, product_id, movement_type, quantity) values (%L,%L,%L,''Venta'',-1)', t1, w2, p), '23514'),
    'salida desde un depósito sin stock rechazada');
  select quantity_on_hand into lvl.quantity_on_hand from inventory_levels where warehouse_id = w1 and product_id = p;
  perform pg_temp.assert(lvl.quantity_on_hand = 7, 'el rechazo no altera la existencia');

  -- movimiento en cero no permitido
  perform pg_temp.assert(pg_temp.throws(format('insert into stock_movements (tenant_id, warehouse_id, product_id, movement_type, quantity) values (%L,%L,%L,''Ajuste'',0)', t1, w1, p), '23514'), 'cantidad 0 rechazada');

  -- transferencia entre depósitos
  insert into stock_movements (tenant_id, warehouse_id, product_id, movement_type, quantity) values (t1, w1, p, 'Transferencia salida', -2);
  insert into stock_movements (tenant_id, warehouse_id, product_id, movement_type, quantity) values (t1, w2, p, 'Transferencia entrada', 2);
  perform pg_temp.assert((select quantity_on_hand from inventory_levels where warehouse_id = w1 and product_id = p) = 5, 'origen 5');
  perform pg_temp.assert((select quantity_on_hand from inventory_levels where warehouse_id = w2 and product_id = p) = 2, 'destino 2');

  -- reservas: reducen el disponible, no la existencia
  insert into stock_reservations (tenant_id, warehouse_id, product_id, quantity, reference_type, reference_id)
    values (t1, w1, p, 3, 'sale', gen_random_uuid()) returning id into res;
  select * into lvl from inventory_levels where warehouse_id = w1 and product_id = p;
  perform pg_temp.assert(lvl.quantity_on_hand = 5 and lvl.reserved_quantity = 3 and lvl.available_quantity = 2, 'reserva 3: disponible 2');
  perform pg_temp.assert(pg_temp.throws(format('insert into stock_reservations (tenant_id, warehouse_id, product_id, quantity, reference_type, reference_id) values (%L,%L,%L,3,''sale'',%L)', t1, w1, p, gen_random_uuid()), '23514'),
    'no se puede reservar más que lo existente');
  perform pg_temp.assert(pg_temp.throws(format('insert into stock_movements (tenant_id, warehouse_id, product_id, movement_type, quantity) values (%L,%L,%L,''Ajuste'',-3)', t1, w1, p), '23514'),
    'no se puede sacar stock que está reservado');
  update stock_reservations set status = 'Liberada' where id = res;
  select * into lvl from inventory_levels where warehouse_id = w1 and product_id = p;
  perform pg_temp.assert(lvl.reserved_quantity = 0 and lvl.available_quantity = 5, 'al liberar vuelve el disponible');

  -- ledger inmutable (también para el dueño de la base)
  perform pg_temp.assert(pg_temp.throws('update stock_movements set quantity = 99', '23001'), 'movimientos no se editan');
  perform pg_temp.assert(pg_temp.throws('delete from stock_movements', '23001'), 'movimientos no se borran');
end
$t$;

rollback;
