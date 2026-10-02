-- 14 · B2B avanzado: escalas por volumen, reglas dinámicas, líneas con precio calculado y pedido mínimo
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-distribuidora'); t2 uuid := pg_temp.tid('demo-retail'); u uuid; g uuid; pl uuid; c uuid; cb2c uuid; p uuid; p2 uuid; rr record; ru uuid; ru2 uuid; s uuid; q uuid; si uuid; n int;
begin
  select u.id into u from users u join roles r on r.id = u.role_id where u.tenant_id = t1 and r.code = 'admin' limit 1;
  perform set_config('app.tenant_id', t1::text, true);
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;

  select id, default_price_list_id into g, pl from customer_groups where tenant_id = t1 and name = 'Mayorista';
  insert into customers (tenant_id, customer_type, person_type, company_name, customer_group_id) values (t1, 'B2B', 'Empresa', 'Mayorista 14', g) returning id into c;
  insert into customers (tenant_id, customer_type, person_type, first_name) values (t1, 'B2C', 'Persona Física', 'Minorista14') returning id into cb2c;
  insert into products (tenant_id, sku, name, currency, sale_price_minor, purchase_price_minor) values (t1, 'P-14', 'Prod escalas', 'ARS', 100000, 50000) returning id into p;
  insert into products (tenant_id, sku, name, currency, sale_price_minor, purchase_price_minor) values (t1, 'P-14B', 'Prod sin lista', 'ARS', 40000, 20000) returning id into p2;

  -- ---- sin lista ni reglas: precio base
  select * into rr from price_resolve(c, p2, 3);
  perform pg_temp.assert(rr.unit_price_minor = 40000 and rr.line_total_minor = 120000 and rr.tier_min_qty is null, 'sin lista usa el precio base');

  -- ---- escalas
  perform pg_temp.assert(pg_temp.throws(format('select price_tier_set(%L, %L, 0, 100)', pl, p), '23514'), 'cantidad mínima > 0');
  perform pg_temp.assert(pg_temp.throws(format('select price_tier_set(%L, %L, 1, -5)', pl, p), '23514'), 'precio no negativo');
  perform price_tier_set(pl, p, 1, 90000); perform price_tier_set(pl, p, 10, 80000); perform price_tier_set(pl, p, 50, 70000);
  perform pg_temp.assert(pg_temp.throws(format('select price_tier_set(%L, %L, 20, 85000)', pl, p), '23514'), 'una escala mayor no puede costar más que una menor');
  perform pg_temp.assert(pg_temp.throws(format('select price_tier_set(%L, %L, 5, 60000)', pl, p), '23514'), 'una escala menor no puede costar menos que una mayor');
  perform price_tier_set(pl, p, 10, 82000);
  perform pg_temp.assert((select jsonb_array_length(tiers) from v_price_tiers where price_list_id = pl and product_id = p) = 3, 'la vista agrupa 3 escalas');
  perform pg_temp.assert((select unit_price_minor from price_resolve(c, p, 1)) = 90000, 'cantidad 1 → escala 1');
  perform pg_temp.assert((select unit_price_minor from price_resolve(c, p, 9)) = 90000, 'cantidad 9 sigue en la escala 1');
  perform pg_temp.assert((select unit_price_minor from price_resolve(c, p, 10)) = 82000, 'cantidad 10 → escala 10 (actualizada)');
  perform pg_temp.assert((select unit_price_minor from price_resolve(c, p, 75)) = 70000 and (select tier_min_qty from price_resolve(c, p, 75)) = 50, 'cantidad 75 → escala 50');
  perform pg_temp.assert(pg_temp.throws(format('select price_resolve(%L, %L, 0)', c, p), '23514'), 'cantidad cero rechazada');
  perform price_tier_delete(pl, p, 50);
  perform pg_temp.assert((select unit_price_minor from price_resolve(c, p, 75)) = 82000, 'escala eliminada deja de aplicar');
  perform pg_temp.assert(pg_temp.throws(format('select price_tier_delete(%L, %L, 50)', pl, p), 'P0002'), 'eliminar una escala inexistente');
  perform price_tier_set(pl, p, 50, 70000);

  -- ---- validación de reglas
  perform pg_temp.assert(pg_temp.throws('select rule_create('' '', 10, ''[]'', ''[{"action_type":"free_shipping","value":{}}]'')', '23514'), 'la regla exige nombre');
  perform pg_temp.assert(pg_temp.throws('select rule_create(''x'', 10, ''[]'', ''[]'')', '23514'), 'la regla exige acciones');
  perform pg_temp.assert(pg_temp.throws('select rule_create(''x'', 10, ''[]'', ''[{"action_type":"percent_discount","value":{"percent":150}}]'')', '23514'), 'descuento máximo 100%');
  perform pg_temp.assert(pg_temp.throws('select rule_create(''x'', 10, ''[{"field":"sku","operator":">","value":3}]'', ''[{"action_type":"free_shipping","value":{}}]'')', '23514'), '> solo sobre cantidad o total');
  perform pg_temp.assert(pg_temp.throws('select rule_create(''x'', 10, ''[{"field":"quantity","operator":"between","value":[10,5]}]'', ''[{"action_type":"free_shipping","value":{}}]'')', '23514'), 'between con rango invertido');
  perform pg_temp.assert(pg_temp.throws('select rule_create(''x'', 10, ''[{"field":"zzz","operator":"=","value":1}]'', ''[{"action_type":"free_shipping","value":{}}]'')', '23514'), 'campo desconocido');

  -- ---- reglas
  ru := rule_create('Mayorista 20+ : 10%', 10, jsonb_build_array(jsonb_build_object('field','quantity','operator','>=','value',20)),
                    jsonb_build_array(jsonb_build_object('action_type','percent_discount','value',jsonb_build_object('percent',10))), g);
  select * into rr from price_resolve(c, p, 20);
  perform pg_temp.assert(rr.unit_price_minor = 73800 and jsonb_array_length(rr.applied) = 1, 'escala 82.000 − 10% = 738,00 y queda registrada la regla');
  perform pg_temp.assert((select unit_price_minor from price_resolve(c, p, 19)) = 82000, 'por debajo de 20 no aplica');
  perform pg_temp.assert((select unit_price_minor from price_resolve(cb2c, p, 20)) = 100000, 'otro grupo no recibe la regla');
  perform rule_set_status(ru, 'Inactiva');
  perform pg_temp.assert((select unit_price_minor from price_resolve(c, p, 20)) = 82000, 'regla inactiva no aplica');
  perform rule_set_status(ru, 'Activa');
  update dynamic_rules set valid_from = current_date + 1 where id = ru;
  perform pg_temp.assert((select unit_price_minor from price_resolve(c, p, 20)) = 82000 and not (select in_force from v_rules_overview where id = ru), 'regla fuera de vigencia no aplica');
  update dynamic_rules set valid_from = null where id = ru;

  -- prioridad y stop_processing
  ru2 := rule_create('Precio fijo primero', 5, jsonb_build_array(jsonb_build_object('field','sku','operator','=','value','P-14')),
                     jsonb_build_array(jsonb_build_object('action_type','set_price','value',jsonb_build_object('amount_minor',60000))), null, null, null, null, true);
  perform pg_temp.assert((select unit_price_minor from price_resolve(c, p, 20)) = 60000, 'prioridad 5 fija el precio y corta el proceso');
  perform rule_delete(ru2);
  perform pg_temp.assert((select unit_price_minor from price_resolve(c, p, 20)) = 73800 and not exists (select 1 from v_rules_overview where id = ru2), 'regla eliminada');

  -- envío gratis, mínimo, exento, oculto
  perform rule_create('Envío gratis grandes', 20, jsonb_build_array(jsonb_build_object('field','cart_total','operator','>=','value',1000000)),
                      jsonb_build_array(jsonb_build_object('action_type','free_shipping','value','{}'::jsonb)));
  perform rule_create('Mínimo mayorista', 30, '[]'::jsonb, jsonb_build_array(jsonb_build_object('action_type','min_order','value',jsonb_build_object('amount_minor',500000))), g);
  perform rule_create('Oculto para minoristas', 40, jsonb_build_array(jsonb_build_object('field','customer_type','operator','=','value','B2C'), jsonb_build_object('field','sku','operator','in','value',jsonb_build_array('P-14B'))),
                      jsonb_build_array(jsonb_build_object('action_type','hide_product','value','{}'::jsonb)));
  perform pg_temp.assert(not (select free_shipping from price_resolve(c, p, 2)) and (select free_shipping from price_resolve(c, p, 20)), 'envío gratis solo con carrito grande');
  perform pg_temp.assert((select min_order_minor from price_resolve(c, p, 2)) = 500000, 'el mínimo se informa');
  perform pg_temp.assert((select hidden from price_resolve(cb2c, p2, 1)) and not (select hidden from price_resolve(c, p2, 1)) and not (select hidden from price_resolve(cb2c, p, 1)), 'oculto solo para B2C y ese SKU');

  -- ---- líneas con precio calculado y pedido mínimo
  insert into sales (tenant_id, customer_id, currency, shipping_minor) values (t1, c, 'ARS', 5000) returning id into s;
  si := sale_add_item(s, p, 2);
  perform pg_temp.assert((select unit_price_minor from sale_items where id = si) = 90000 and (select jsonb_typeof(applied_rules) from sale_items where id = si) = 'array', 'la línea usa el precio calculado');
  perform pg_temp.assert(pg_temp.throws(format('select sale_issue_invoice(%L)', s), '23514'), 'bajo el pedido mínimo no se factura');
  perform sale_add_item(s, p, 20);
  perform pg_temp.assert((select shipping_minor from sales where id = s) = 0, 'envío gratis aplicado a la venta');
  perform pg_temp.assert((select count(*) from sale_items where sale_id = s and unit_price_minor = 73800) = 1, 'segunda línea con escala y descuento');
  perform sale_issue_invoice(s);
  perform pg_temp.assert(exists (select 1 from invoices where sale_id = s), 'alcanzado el mínimo se factura');
  perform pg_temp.assert(pg_temp.throws(format('select sale_add_item(%L, %L, 1)', s, p), '23514'), 'una venta facturada no admite más líneas');
  insert into sales (tenant_id, customer_id, currency) values (t1, cb2c, 'ARS') returning id into s;
  perform pg_temp.assert(pg_temp.throws(format('select sale_add_item(%L, %L, 1)', s, p2), '23514'), 'producto oculto no se agrega');
  insert into quotes (tenant_id, customer_id, currency) values (t1, c, 'ARS') returning id into q;
  perform quote_add_item(q, p, 10);
  perform pg_temp.assert((select unit_price_minor from quote_items where quote_id = q) = 82000, 'el presupuesto también usa escalas');
  update quotes set status = 'Enviado' where id = q;
  perform pg_temp.assert(pg_temp.throws(format('select quote_add_item(%L, %L, 1)', q, p), '23514'), 'solo presupuestos en Borrador');

  -- ---- plan básico: sin escalas ni reglas
  reset role;
  select u3.id into u from users u3 join roles r3 on r3.id = u3.role_id where u3.tenant_id = t2 and r3.code = 'admin' limit 1;
  perform set_config('app.tenant_id', t2::text, true); perform set_config('app.user_id', u::text, true);
  set local role nexo_app;
  perform pg_temp.assert(pg_temp.throws('select rule_create(''x'', 1, ''[]'', ''[{"action_type":"free_shipping","value":{}}]'')', '42501'), 'plan básico: sin reglas dinámicas');
  perform pg_temp.assert(pg_temp.throws(format('select price_tier_set(%L, %L, 10, 100)', gen_random_uuid(), gen_random_uuid()), '42501'), 'plan básico: sin escalas por volumen');
  perform pg_temp.assert(not exists (select 1 from v_rules_overview), 'otro tenant no ve mis reglas');
end $t$;
rollback;
