-- 06 · Compras (recepciones parciales/totales) y devoluciones de venta
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-retail'); w uuid; sup uuid; p uuid; pu uuid; pi uuid; rc uuid; rc2 uuid;
  c uuid; s uuid; si uuid; rt uuid; it record; n numeric;
begin
  select id into w from warehouses where tenant_id = t1 and is_default;
  insert into suppliers (tenant_id, name) values (t1, 'Proveedor test') returning id into sup;
  insert into products (tenant_id, sku, name, currency, sale_price_minor) values (t1, 'T-PUR', 'Prod compra', 'ARS', 1000) returning id into p;

  insert into purchases (tenant_id, supplier_id, currency, warehouse_id) values (t1, sup, 'ARS', w) returning id into pu;
  insert into purchase_items (tenant_id, purchase_id, product_id, description, quantity, unit_price_minor) values (t1, pu, p, 'L', 10, 500) returning id into pi;
  insert into purchase_receipts (tenant_id, purchase_id, warehouse_id) values (t1, pu, w) returning id into rc;
  perform pg_temp.assert(pg_temp.throws(format('insert into purchase_receipt_items (tenant_id, receipt_id, purchase_item_id, quantity) values (%L,%L,%L,4)', t1, rc, pi), '23514'), 'no se recibe una compra en Borrador');
  update purchases set status = 'Ordenado' where id = pu;
  insert into purchase_receipt_items (tenant_id, receipt_id, purchase_item_id, quantity) values (t1, rc, pi, 4);
  perform pg_temp.assert((select status from purchases where id = pu) = 'Recibido Parcial', 'recepción parcial');
  perform pg_temp.assert((select quantity_on_hand from inventory_levels where warehouse_id = w and product_id = p) = 4, 'la recepción suma stock');
  perform pg_temp.assert(pg_temp.throws(format('insert into purchase_receipt_items (tenant_id, receipt_id, purchase_item_id, quantity) values (%L,%L,%L,7)', t1, rc, pi), '23514'), 'no se recibe más de lo pendiente');
  insert into purchase_receipts (tenant_id, purchase_id, warehouse_id) values (t1, pu, w) returning id into rc2;
  insert into purchase_receipt_items (tenant_id, receipt_id, purchase_item_id, quantity) values (t1, rc2, pi, 6);
  perform pg_temp.assert((select status from purchases where id = pu) = 'Recibido Total', 'recepción total');
  perform pg_temp.assert((select quantity_on_hand from inventory_levels where warehouse_id = w and product_id = p) = 10, 'stock 10');
  perform pg_temp.assert((select count(*) from stock_movements where reference_id in (rc, rc2)) = 2, 'un movimiento por recepción');

  -- devoluciones de venta
  select id into c from customers where tenant_id = t1 limit 1;
  insert into sales (tenant_id, customer_id, currency, warehouse_id) values (t1, c, 'ARS', w) returning id into s;
  insert into sale_items (tenant_id, sale_id, product_id, description, quantity, unit_price_minor) values (t1, s, p, 'V', 5, 1000) returning id into si;
  insert into sale_returns (tenant_id, sale_id, customer_id, currency, refund_method) values (t1, s, c, 'ARS', 'Billetera') returning id into rt;
  insert into sale_return_items (tenant_id, sale_return_id, sale_item_id, quantity, unit_price_minor) values (t1, rt, si, 2, 1000);
  select * into it from sale_items where id = si;
  perform pg_temp.assert(it.quantity_returned = 2, 'cantidad devuelta acumulada');
  perform pg_temp.assert((select total_minor from sale_returns where id = rt) = 2000, 'total de la devolución 20,00');
  perform pg_temp.assert(pg_temp.throws(format('insert into sale_return_items (tenant_id, sale_return_id, sale_item_id, quantity, unit_price_minor) values (%L,%L,%L,4,1000)', t1, rt, si), '23514'), 'no se devuelve más de lo vendido');
  insert into sale_return_items (tenant_id, sale_return_id, sale_item_id, quantity, unit_price_minor) values (t1, rt, si, 3, 1000);
  perform pg_temp.assert((select quantity_returned from sale_items where id = si) = 5, 'devolución total');
  delete from sale_return_items where sale_return_id = rt and quantity = 3;
  perform pg_temp.assert((select quantity_returned from sale_items where id = si) = 2, 'al borrar la línea se libera la cantidad');
end
$t$;

rollback;
