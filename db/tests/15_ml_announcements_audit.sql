-- 15 · MercadoLibre (flujos locales), anuncios y consulta de auditoría
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-distribuidora'); t2 uuid := pg_temp.tid('demo-retail'); u uuid; ro uuid; w uuid; acc uuid; acc2 uuid; p uuid; pub uuid; pub2 uuid; s uuid; s2 uuid; c uuid; q uuid; an uuid; an2 uuid;
  n int; nusers int; rr record;
begin
  select u.id into u from users u join roles r on r.id = u.role_id where u.tenant_id = t1 and r.code = 'admin' limit 1;
  select u.id into ro from users u join roles r on r.id = u.role_id where u.tenant_id = t1 and r.code = 'vendedor' limit 1;
  perform set_config('app.tenant_id', t1::text, true);
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;

  select id into w from warehouses where tenant_id = t1 and is_default;
  insert into products (tenant_id, sku, name, currency, sale_price_minor, purchase_price_minor) values (t1, 'ML-15', 'Producto ML', 'ARS', 150000, 80000) returning id into p;

  -- ---- cuenta y publicación
  perform pg_temp.assert(pg_temp.throws('select ml_account_register('' '')', '23514'), 'cuenta exige usuario ML');
  acc := ml_account_register('123456', 'MI_TIENDA');
  perform pg_temp.assert((select status from ml_accounts where id = acc) = 'Pendiente', 'la cuenta nace Pendiente');
  perform pg_temp.assert(pg_temp.throws('select ml_account_register(''123456'')', '23505'), 'usuario ML único por tenant');
  pub := ml_publication_prepare(p, acc, null, null, 5);
  perform pg_temp.assert((select status = 'Preparado' and price_minor = 150000 and title = 'Producto ML' and stock_quantity = 5 from ml_publications where id = pub), 'publicación preparada con datos del producto');
  perform pg_temp.assert(pg_temp.throws(format('select ml_publication_prepare(%L, %L)', p, acc), '23505'), 'no se duplica la publicación');
  perform pg_temp.assert(pg_temp.throws(format('select ml_publication_set_status(%L, ''Activa'')', pub), '23514'), 'no se activa con la cuenta sin conectar');
  perform pg_temp.assert(pg_temp.throws(format('select ml_publication_set_status(%L, ''Pausada'')', pub), '23514'), 'preparada no pasa a pausada');
  reset role; update ml_accounts set status = 'Conectada' where id = acc; set local role nexo_app;
  perform ml_publication_set_status(pub, 'Activa');
  perform pg_temp.assert((select status from ml_publications where id = pub) = 'Activa', 'publicación activa');
  perform ml_publication_set_status(pub, 'Pausada'); perform ml_publication_set_status(pub, 'Activa');
  pub2 := ml_publication_prepare(p, null);
  perform pg_temp.assert(pg_temp.throws(format('select ml_publication_set_status(%L, ''Activa'')', pub2), '23514'), 'sin cuenta no se activa');

  -- ---- stock
  perform stock_adjust(p, w, 12, 'Stock ML');
  n := ml_stock_refresh();
  perform pg_temp.assert(n >= 1 and (select status from ml_stock_sync where publication_id = pub) = 'Pendiente' and (select local_stock from ml_stock_sync where publication_id = pub) = 12, 'stock local distinto → Pendiente');
  update ml_publications set stock_quantity = 12 where id = pub;
  perform ml_stock_refresh();
  perform pg_temp.assert((select status from ml_stock_sync where publication_id = pub) = 'Sincronizado', 'stock igual → Sincronizado');
  perform pg_temp.assert((select stock_pending from v_ml_overview where tenant_id = t1) >= 0 and (select publications_active from v_ml_overview where tenant_id = t1) = 1, 'resumen de MercadoLibre');

  -- ---- orden importada
  perform pg_temp.assert(pg_temp.throws(format('select ml_order_import(%L, ''ML-1'', ''comprador1'', ''c1@example.com'', ''[]'')', acc), '23514'), 'orden sin ítems');
  perform pg_temp.assert(pg_temp.throws(format('select ml_order_import(%L, ''ML-1'', ''comprador1'', ''c1@example.com'', ''[{"sku":"NO-EXISTE","quantity":1,"unit_price_minor":10}]'')', acc), 'P0002'), 'SKU desconocido');
  perform pg_temp.assert(not exists (select 1 from sales where external_ref = 'ML-1'), 'una orden fallida no deja venta a medias');
  s := ml_order_import(acc, 'ML-2001', 'comprador_ml', 'comprador@example.com', '[{"sku":"ML-15","quantity":2,"unit_price_minor":150000}]');
  perform pg_temp.assert((select source = 'MercadoLibre' and external_ref = 'ML-2001' and total_minor = 300000 and status = 'Pagado' from sales where id = s), 'venta ML creada y pagada');
  perform pg_temp.assert(exists (select 1 from invoices where sale_id = s) and (select open_minor from accounts_receivable where sale_id = s) = 0, 'factura emitida y cobrada');
  perform pg_temp.assert((select source from customers where email = 'comprador@example.com') = 'MercadoLibre', 'cliente creado con origen ML');
  perform pg_temp.assert(ml_order_import(acc, 'ML-2001', 'otro', 'otro@example.com', '[{"sku":"ML-15","quantity":1,"unit_price_minor":1}]') = s and (select count(*) from sales where external_ref = 'ML-2001') = 1, 'importar dos veces no duplica');
  s2 := ml_order_import(acc, 'ML-2002', 'comprador_ml', 'COMPRADOR@example.com', '[{"sku":"ML-15","quantity":1,"unit_price_minor":150000}]');
  perform pg_temp.assert((select count(*) from customers where lower(email) = 'comprador@example.com') = 1, 'el mismo email reutiliza al cliente');

  -- ---- preguntas
  q := ml_question_receive(acc, 'Q-1', 'MLA999', '¿Hacen envíos?');
  perform pg_temp.assert(ml_question_receive(acc, 'Q-1', 'MLA999', 'otra') = q, 'recibir dos veces no duplica');
  perform pg_temp.assert(pg_temp.throws(format('select ml_question_answer(%L, '' '')', q), '23514'), 'respuesta vacía');
  perform pg_temp.assert((select questions_pending from v_ml_overview where tenant_id = t1) = 1, 'pregunta pendiente en el resumen');
  perform ml_question_answer(q, 'Sí, a todo el país');
  perform pg_temp.assert((select status = 'Respondida' and answered_by = u from ml_questions where id = q), 'pregunta respondida por mí');
  perform pg_temp.assert(pg_temp.throws(format('select ml_question_answer(%L, ''otra'')', q), '23514'), 'no se responde dos veces');

  -- ---- desconectar
  perform ml_account_disconnect(acc);
  perform pg_temp.assert((select status from ml_accounts where id = acc) = 'Desconectada' and (select status from ml_publications where id = pub) = 'Pausada', 'desconectar pausa las publicaciones');

  -- ---- anuncios
  select count(*) into nusers from users where tenant_id = t1 and status = 'Activo';
  perform pg_temp.assert(pg_temp.throws('select announcement_create('' '', ''x'')', '23514'), 'anuncio exige título');
  perform pg_temp.assert(pg_temp.throws('select announcement_create(''t'', ''m'', ''Usuarios seleccionados'')', '23514'), 'elegidos exige destinatarios');
  perform pg_temp.assert(pg_temp.throws(format('select announcement_create(''t'', ''m'', ''Todos'', ''info'', %L, %L)', now() + interval '2 day', now() + interval '1 day'), '23514'), 'vence antes de publicarse');
  an := announcement_create('Mantenimiento', 'El sábado habrá mantenimiento', 'Todos', 'aviso');
  perform pg_temp.assert((select status from announcements where id = an) = 'Borrador' and not exists (select 1 from v_my_announcements where id = an), 'borrador no es visible');
  n := announcement_publish(an);
  perform pg_temp.assert(n = nusers, 'se avisa a todos los usuarios activos');
  perform pg_temp.assert(exists (select 1 from v_my_announcements where id = an and unread), 'el anuncio aparece sin leer');
  perform pg_temp.assert(pg_temp.throws(format('select announcement_publish(%L)', an), '23514'), 'no se publica dos veces');
  perform announcement_mark_read(an);
  perform pg_temp.assert(exists (select 1 from v_my_announcements where id = an and not unread), 'marcado como leído');
  an2 := announcement_create('Solo para mí', 'Mensaje', 'Usuarios seleccionados', 'info', null, null, false, array[u]);
  perform pg_temp.assert(announcement_publish(an2) = 1, 'destinatario elegido');
  an2 := announcement_create('Para clientes', 'Promo', 'Clientes');
  perform pg_temp.assert((select show_customer_frontend from announcements where id = an2), 'anuncio a clientes se muestra en la tienda');
  update announcements set expires_at = now() - interval '1 minute', publish_at = now() - interval '1 day' where id = an;
  perform pg_temp.assert(not exists (select 1 from v_my_announcements where id = an), 'un anuncio vencido deja de mostrarse');
  perform announcement_archive(an);
  perform pg_temp.assert(pg_temp.throws(format('select announcement_archive(%L)', an), 'P0002'), 'ya archivado');

  -- ---- auditoría
  insert into customers (tenant_id, customer_type, person_type, first_name, email) values (t1, 'B2C', 'Persona Física', 'Auditado', 'a@x.com') returning id into c;
  update customers set email = 'b@x.com', first_name = 'Auditada' where id = c;
  select * into rr from v_audit_log where entity_id = c and action = 'update' order by created_at desc limit 1;
  perform pg_temp.assert(rr.user_id = u and rr.detail -> 'email' ->> 'old' = 'a@x.com' and rr.detail -> 'email' ->> 'new' = 'b@x.com' and not rr.detail ? 'updated_at', 'la auditoría muestra qué campos cambiaron');
  perform pg_temp.assert((select count(*) from audit_for('customers', c)) >= 2, 'historial del registro (alta + cambio)');
  perform pg_temp.assert(audit_diff('{"a":1,"b":2}', '{"a":1,"b":3,"c":4}') = '{"b":{"old":2,"new":3},"c":{"old":null,"new":4}}'::jsonb, 'audit_diff');
  if ro is not null then
    reset role; perform set_config('app.user_id', ro::text, true); set local role nexo_app;
    perform pg_temp.assert((select count(*) from v_audit_log) = 0, 'sin audit.read no se ve la auditoría');
    update customers set first_name = 'Cambio vendedor' where id = c;
  end if;

  -- ---- plan básico
  reset role;
  select u3.id into u from users u3 join roles r3 on r3.id = u3.role_id where u3.tenant_id = t2 and r3.code = 'admin' limit 1;
  perform set_config('app.tenant_id', t2::text, true); perform set_config('app.user_id', u::text, true);
  set local role nexo_app;
  perform pg_temp.assert(pg_temp.throws('select ml_account_register(''999'')', '42501'), 'plan básico: sin MercadoLibre');
  perform pg_temp.assert(not exists (select 1 from v_audit_log where entity_id = c) and not exists (select 1 from v_my_announcements where id = an2), 'otro tenant no ve auditoría ni anuncios');
end $t$;
rollback;
