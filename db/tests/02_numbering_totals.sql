-- 02 · Numeración correlativa por tenant, totales derivados e impuestos
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-retail'); t2 uuid := pg_temp.tid('demo-distribuidora');
  c1 uuid; v_total bigint; v_pct numeric; n1 text; n2 text; n3 text; s uuid; p uuid; iva uuid; r record;
begin
  -- ---- Numeración: cada tenant tiene su propia serie, sin huecos ni repeticiones
  insert into customers (tenant_id, customer_type, person_type, first_name) values (t1, 'B2C', 'Persona Física', 'A') returning number into n1;
  insert into customers (tenant_id, customer_type, person_type, first_name) values (t1, 'B2C', 'Persona Física', 'B') returning number into n2;
  insert into customers (tenant_id, customer_type, person_type, first_name) values (t2, 'B2C', 'Persona Física', 'C') returning number into n3;
  perform pg_temp.assert(n1 = 'CLI-0002' and n2 = 'CLI-0003', 'T1 continúa su serie: ' || n1 || ', ' || n2);
  perform pg_temp.assert(n3 = 'CLI-0004', 'T2 tiene su propia serie: ' || n3);
  update document_sequences set prefix = 'CLIE', padding = 6 where tenant_id = t1 and doc_type = 'customer';
  insert into customers (tenant_id, customer_type, person_type, first_name) values (t1, 'B2C', 'Persona Física', 'D') returning number into n1;
  perform pg_temp.assert(n1 = 'CLIE-000004', 'Prefijo y relleno configurables por tenant: ' || n1);
  perform pg_temp.assert(pg_temp.throws(format('insert into customers (tenant_id, customer_type, person_type, first_name, number) values (%L, ''B2C'', ''Persona Física'', ''Z'', ''CLIE-000004'')', t1), '23505'),
    'El número es único por tenant');

  -- ---- Totales sin impuestos: subtotal − descuento + envío
  select id into c1 from customers where tenant_id = t1 and display_name = 'Juan Pérez';
  select id into p from products where tenant_id = t1 and sku = 'SKU-001';
  insert into sales (tenant_id, customer_id, currency, discount_minor, shipping_minor) values (t1, c1, 'ARS', 10000, 5000) returning id into s;
  insert into sale_items (tenant_id, sale_id, product_id, description, quantity, unit_price_minor, discount_minor) values (t1, s, p, 'L1', 2, 100000, 20000);
  insert into sale_items (tenant_id, sale_id, product_id, description, quantity, unit_price_minor) values (t1, s, p, 'L2', 1, 50000);
  select * into r from sales where id = s;
  perform pg_temp.assert(r.subtotal_minor = 230000, 'subtotal = (2×1000−200)+500 = 2300,00; fue ' || r.subtotal_minor);
  perform pg_temp.assert(r.total_minor = 225000, 'total = 2300 − 100 + 50 = 2250,00; fue ' || r.total_minor);
  perform pg_temp.assert(r.open_minor = 225000 and r.paid_minor = 0, 'saldo pendiente = total');

  -- cambiar una línea y borrar otra recalcula la cabecera sin intervención de la app
  update sale_items set quantity = 3 where sale_id = s and description = 'L1';
  select total_minor into v_total from sales where id = s;
  perform pg_temp.assert(v_total = 3 * 100000 - 20000 + 50000 - 10000 + 5000, 'al editar una línea se recalcula el total');
  delete from sale_items where sale_id = s and description = 'L2';
  select * into r from sales where id = s;
  perform pg_temp.assert(r.subtotal_minor = 280000 and r.total_minor = 275000, 'al borrar una línea se recalcula (' || r.total_minor || ')');

  -- el descuento global no puede dejar el total negativo
  perform pg_temp.assert(pg_temp.throws(format('update sales set discount_minor = 99999999 where id = %L', s), '23514'), 'descuento mayor al subtotal rechazado');
  -- el descuento de una línea no puede superar su importe
  perform pg_temp.assert(pg_temp.throws(format('insert into sale_items (tenant_id, sale_id, description, quantity, unit_price_minor, discount_minor) values (%L, %L, ''X'', 1, 100, 200)', t1, s), '23514'),
    'descuento de línea mayor al importe rechazado');

  -- ---- Impuestos: precios sin IVA (se suma) y con IVA incluido (se discrimina)
  select id into iva from tax_rates where tenant_id = t1 and code = 'IVA21';
  insert into sales (tenant_id, customer_id, currency, prices_include_tax) values (t1, c1, 'ARS', false) returning id into s;
  insert into sale_items (tenant_id, sale_id, description, quantity, unit_price_minor, tax_rate_id) values (t1, s, 'Sin IVA incl.', 1, 100000, iva);
  select * into r from sales where id = s;
  perform pg_temp.assert(r.tax_minor = 21000 and r.total_minor = 121000, 'IVA 21% se suma: tax=' || r.tax_minor || ' total=' || r.total_minor);

  insert into sales (tenant_id, customer_id, currency, prices_include_tax) values (t1, c1, 'ARS', true) returning id into s;
  insert into sale_items (tenant_id, sale_id, description, quantity, unit_price_minor, tax_rate_id) values (t1, s, 'Con IVA incl.', 1, 100000, iva);
  select * into r from sales where id = s;
  perform pg_temp.assert(r.tax_minor = 17355 and r.total_minor = 100000, 'IVA incluido se discrimina: tax=' || r.tax_minor || ' total=' || r.total_minor);

  -- la tasa queda "congelada" en la línea aunque luego cambie en el maestro
  update tax_rates set rate_percent = 25 where id = iva;
  select tax_rate_percent into v_pct from sale_items where sale_id = s;
  perform pg_temp.assert(v_pct = 21, 'la tasa de la línea es un snapshot (21%)');
end
$t$;

rollback;
