-- 13 · Tablero, informes, notificaciones, búsqueda global, agenda, llamadas, notas y recordatorios
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-distribuidora'); u uuid; u2 uuid; w uuid; c uuid; p uuid; s uuid; k uuid; ev uuid; nt int; n int; nid uuid; rr record; d1 record; d2 record;
begin
  select u.id into u from users u join roles r on r.id = u.role_id where u.tenant_id = t1 and r.code = 'admin' limit 1;
  select id into u2 from users where tenant_id = t1 and id <> u order by created_at limit 1;
  perform set_config('app.tenant_id', t1::text, true);
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;

  select id into w from warehouses where tenant_id = t1 and is_default;
  select * into d1 from v_dashboard where tenant_id = t1;
  insert into customers (tenant_id, customer_type, person_type, first_name, last_name) values (t1, 'B2C', 'Persona Física', 'Zulema', 'Buscable') returning id into c;
  insert into products (tenant_id, sku, name, currency, sale_price_minor, purchase_price_minor, stock_min) values (t1, 'ZZ-13', 'Producto Zeta', 'ARS', 100000, 60000, 5) returning id into p;
  perform stock_adjust(p, w, 2, 'Stock bajo de prueba');
  insert into sales (tenant_id, customer_id, currency) values (t1, c, 'ARS') returning id into s;
  insert into sale_items (tenant_id, sale_id, product_id, description, quantity, unit_price_minor, unit_cost_minor) values (t1, s, p, 'Producto Zeta', 3, 100000, 60000);

  -- ---- tablero
  select * into d2 from v_dashboard where tenant_id = t1;
  perform pg_temp.assert(d2.sales_30d_minor - d1.sales_30d_minor = 300000, 'el tablero suma la venta de los últimos 30 días');
  perform pg_temp.assert(d2.low_stock_count >= 1 and d2.new_customers_30d - d1.new_customers_30d = 1, 'stock bajo y clientes nuevos');
  perform pg_temp.assert((select count(*) from v_dashboard) = 1, 'el tablero solo muestra mi tenant');

  -- ---- informes
  perform pg_temp.assert((select total_minor from v_top_customers where customer_id = c) = 300000, 'top clientes');
  select * into rr from v_top_products where product_id = p;
  perform pg_temp.assert(rr.units = 3 and rr.revenue_minor = 300000 and rr.cost_minor = 180000, 'top productos: unidades, ingreso y costo');
  update sales set status = 'Cancelado' where id = s;
  perform pg_temp.assert(not exists (select 1 from v_top_customers where customer_id = c) and not exists (select 1 from v_top_products where product_id = p), 'las ventas canceladas no cuentan');
  insert into expenses (tenant_id, description, currency, amount_minor, status, paid_at, payment_method) values (t1, 'Gasto flujo', 'ARS', 7000, 'Pagado', now(), 'Efectivo');
  perform pg_temp.assert((select expenses_out_minor from v_cash_flow_monthly where month = date_trunc('month', now())::date and currency = 'ARS') >= 7000, 'flujo de caja incluye gastos pagados');

  -- ---- notificaciones
  nt := notifications_generate();
  perform pg_temp.assert(nt >= 1 and exists (select 1 from notifications where user_id = u and type = 'Stock'), 'se genera la alerta de stock');
  perform pg_temp.assert(notifications_generate() = 0, 'no se repiten las alertas del mismo día');
  select id into nid from notifications where user_id = u and type = 'Stock' limit 1;
  perform notification_read(nid);
  perform pg_temp.assert((select read_at is not null from notifications where id = nid), 'marcar como leída');
  perform pg_temp.assert(notifications_read_all() >= 0 and not exists (select 1 from notifications where user_id = u and read_at is null), 'marcar todas');
  perform pg_temp.assert(pg_temp.throws(format('select notification_read(%L)', gen_random_uuid()), 'P0002'), 'notificación inexistente');
  insert into tickets (tenant_id, customer_id, subject, assigned_user_id) values (t1, c, 'Ticket asignado', u2) returning id into k;
  perform pg_temp.assert(not exists (select 1 from notifications where user_id = u2), 'no veo las notificaciones de otra persona');
  reset role;
  perform pg_temp.assert(exists (select 1 from notifications where tenant_id = t1 and user_id = u2 and linked_id = k), 'asignar un ticket notifica al responsable');
  set local role nexo_app;
  insert into tickets (tenant_id, customer_id, subject, assigned_user_id) values (t1, c, 'Ticket propio', u) returning id into k;
  perform pg_temp.assert(not exists (select 1 from notifications where user_id = u and linked_id = k), 'asignarse a uno mismo no notifica');

  -- ---- búsqueda global
  perform pg_temp.assert((select count(*) from search_global('zulema')) = 1, 'busca clientes por texto');
  perform pg_temp.assert((select entity from search_global('zeta') limit 1) = 'producto', 'busca productos');
  perform pg_temp.assert(exists (select 1 from search_global((select number from tickets where id = k))), 'busca tickets por número');
  perform pg_temp.assert(not exists (select 1 from search_global('zulema') where entity = 'pedido'), 'texto no devuelve documentos');
  perform pg_temp.assert((select count(*) from search_global('z')) = 0, 'menos de 2 letras no busca');

  -- ---- agenda
  ev := calendar_event_create('Reunión', now() + interval '1 day', now() + interval '1 day 1 hour');
  perform pg_temp.assert(pg_temp.throws(format('select calendar_event_create(''Solapado'', %L, %L)', now() + interval '1 day 30 minutes', now() + interval '1 day 90 minutes'), '23P01'), 'no se solapan eventos propios');
  perform pg_temp.assert(pg_temp.throws(format('select calendar_event_create(''Al revés'', %L, %L)', now() + interval '3 day', now() + interval '2 day'), '23514'), 'no termina antes de empezar');
  perform pg_temp.assert(pg_temp.throws(format('select calendar_event_create('' '', %L, %L)', now() + interval '5 day', now() + interval '6 day'), '23514'), 'exige título');
  perform calendar_event_set_status(ev, 'Cancelada');
  perform calendar_event_create('Mismo horario', now() + interval '1 day', now() + interval '1 day 1 hour');
  perform pg_temp.assert((select count(*) from calendar_events where title = 'Mismo horario') = 1, 'un evento cancelado libera el horario');

  -- ---- llamadas, notas, recordatorios
  perform pg_temp.assert(pg_temp.throws('select call_log(''Saliente'', ''Sin vínculo'')', '23514'), 'la llamada exige cliente o lead');
  perform call_log('Saliente', 'Seguimiento de pago', 12, c);
  perform pg_temp.assert((select duration_minutes from calls where subject = 'Seguimiento de pago') = 12, 'llamada registrada');
  perform pg_temp.assert(pg_temp.throws(format('select note_add(''customer'', %L, '' '')', c), '23514'), 'nota vacía rechazada');
  perform note_add('customer', c, 'Prefiere contacto por WhatsApp', true);
  perform pg_temp.assert((select pinned from notes where linked_id = c) , 'nota fijada');
  nid := reminder_create(now() + interval '1 hour', 'Llamar de nuevo', 'customer', c);
  perform reminder_done(nid);
  perform pg_temp.assert((select done_at is not null from reminders where id = nid), 'recordatorio cumplido');
  perform pg_temp.assert(pg_temp.throws(format('select reminder_done(%L)', gen_random_uuid()), 'P0002'), 'recordatorio inexistente');

  -- ---- contactos
  perform pg_temp.assert(exists (select 1 from v_contacts where source = 'lead') or true, 'vista de contactos consultable');

  -- ---- aislamiento
  reset role;
  select u3.id into u from users u3 join roles r3 on r3.id = u3.role_id where u3.tenant_id = pg_temp.tid('demo-retail') and r3.code = 'admin' limit 1;
  perform set_config('app.tenant_id', pg_temp.tid('demo-retail')::text, true);
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;
  perform pg_temp.assert((select count(*) from search_global('zulema')) = 0, 'otro tenant no encuentra mis clientes');
  perform pg_temp.assert(not exists (select 1 from v_top_customers where customer_id = c) and not exists (select 1 from notifications where tenant_id = t1), 'otro tenant no ve informes ni notificaciones ajenas');
end $t$;
rollback;
