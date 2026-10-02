-- Fase 10 · MercadoLibre (estructura y flujos locales), anuncios internos y consulta de auditoría.
-- No hay conexión real con MercadoLibre: la capa de integración (servidor) llamará a estas mismas funciones.

create function require_feature(p_code text) returns void language plpgsql stable as $$
begin
  if not tenant_has_feature(app_tenant(), p_code) then
    raise exception 'Tu plan no incluye esta función (%)', p_code using errcode = 'insufficient_privilege';
  end if;
end $$;

-- ===================== MercadoLibre =====================
create function ml_account_register(p_ml_user text, p_nickname text default null, p_site text default 'MLA') returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  perform require_permission('mercadolibre.create'); perform require_feature('ml_advanced');
  if nullif(btrim(coalesce(p_ml_user, '')), '') is null then raise exception 'Indicá el usuario de MercadoLibre' using errcode = 'check_violation'; end if;
  insert into ml_accounts (tenant_id, ml_user_id, nickname, site_id) values (app_tenant(), btrim(p_ml_user), p_nickname, p_site) returning id into v_id;
  return v_id;
end $$;

-- Estados de la cuenta los fija la integración al completar la autorización; aquí solo se permite desconectar.
create function ml_account_disconnect(p_account uuid) returns void language plpgsql as $$
begin
  perform require_permission('mercadolibre.update'); perform require_feature('ml_advanced');
  update ml_accounts set status = 'Desconectada', access_token_enc = null, refresh_token_enc = null, token_expires_at = null
   where id = p_account and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Cuenta inexistente' using errcode = 'no_data_found'; end if;
  update ml_publications set status = 'Pausada' where ml_account_id = p_account and tenant_id = app_tenant() and status = 'Activa';
end $$;

create function ml_publication_prepare(p_product uuid, p_account uuid default null, p_title text default null, p_price bigint default null, p_stock numeric default null) returns uuid
language plpgsql as $$
declare p products; v_id uuid; v_stock numeric;
begin
  perform require_permission('mercadolibre.create'); perform require_feature('ml_advanced');
  select * into p from products where id = p_product and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Producto inexistente' using errcode = 'no_data_found'; end if;
  if exists (select 1 from ml_publications where tenant_id = p.tenant_id and product_id = p.id and variation_id is null and deleted_at is null and status <> 'Cerrada'
               and ml_account_id is not distinct from p_account) then
    raise exception 'El producto ya tiene una publicación preparada para esa cuenta' using errcode = 'unique_violation'; end if;
  if coalesce(p_price, p.sale_price_minor) < 0 then raise exception 'El precio no puede ser negativo' using errcode = 'check_violation'; end if;
  select coalesce(sum(available_quantity), 0) into v_stock from v_inventory_status where tenant_id = p.tenant_id and product_id = p.id;
  insert into ml_publications (tenant_id, ml_account_id, product_id, title, price_minor, currency, stock_quantity)
  values (p.tenant_id, p_account, p.id, left(coalesce(nullif(btrim(p_title), ''), p.name), 60), coalesce(p_price, p.sale_price_minor), p.currency, greatest(coalesce(p_stock, v_stock), 0))
  returning id into v_id;
  return v_id;
end $$;

create function ml_publication_set_status(p_pub uuid, p_status text) returns void
language plpgsql as $$
declare pb ml_publications; v_acc ml_accounts;
begin
  perform require_permission('mercadolibre.update'); perform require_feature('ml_advanced');
  select * into pb from ml_publications where id = p_pub and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Publicación inexistente' using errcode = 'no_data_found'; end if;
  if p_status not in ('Activa','Pausada','Cerrada') then raise exception 'Estado inválido: %', p_status using errcode = 'check_violation'; end if;
  if pb.status = 'Cerrada' then raise exception 'Una publicación cerrada no se puede reabrir' using errcode = 'check_violation'; end if;
  if p_status = 'Activa' then
    select * into v_acc from ml_accounts where id = pb.ml_account_id and tenant_id = pb.tenant_id;
    if not found or v_acc.status <> 'Conectada' then raise exception 'Conectá una cuenta de MercadoLibre antes de activar la publicación' using errcode = 'check_violation'; end if;
    if pb.stock_quantity <= 0 then raise exception 'No se puede activar una publicación sin stock' using errcode = 'check_violation'; end if;
  elsif pb.status = 'Preparado' and p_status = 'Pausada' then
    raise exception 'Una publicación preparada se activa o se cierra' using errcode = 'check_violation';
  end if;
  update ml_publications set status = p_status where id = pb.id;
end $$;

-- Importa una orden: crea (o reutiliza) al cliente, la venta con origen MercadoLibre, la factura y el cobro. Idempotente por ml_order_id.
-- p_items: [{"sku": "...", "quantity": n, "unit_price_minor": n}]
create function ml_order_import(p_account uuid, p_ml_order text, p_buyer text, p_email text, p_items jsonb, p_currency char default null) returns uuid
language plpgsql as $$
declare v_sale uuid; v_c uuid; v_cur char(3); i jsonb; p products; v_inv uuid; v_ar uuid; v_total bigint := 0; v_cust customers;
begin
  perform require_permission('mercadolibre.create'); perform require_feature('ml_advanced');
  perform require_permission('sales.create'); perform require_permission('invoices.create'); perform require_permission('payments.create');
  select sale_id into v_sale from ml_sales where tenant_id = app_tenant() and ml_order_id = p_ml_order;
  if found then return v_sale; end if;
  if jsonb_typeof(coalesce(p_items, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La orden no tiene ítems' using errcode = 'check_violation'; end if;
  if not exists (select 1 from ml_accounts where id = p_account and tenant_id = app_tenant() and deleted_at is null) then raise exception 'Cuenta inexistente' using errcode = 'no_data_found'; end if;
  v_cur := coalesce(p_currency, (select base_currency from tenants where id = app_tenant()));
  if nullif(btrim(coalesce(p_email, '')), '') is not null then
    select id into v_c from customers where tenant_id = app_tenant() and lower(email) = lower(btrim(p_email)) and deleted_at is null order by created_at limit 1;
  end if;
  if v_c is null then
    insert into customers (tenant_id, customer_type, person_type, first_name, email, source)
    values (app_tenant(), 'B2C', 'Persona Física', coalesce(nullif(btrim(p_buyer), ''), 'Comprador MercadoLibre'), nullif(btrim(coalesce(p_email, '')), ''), 'MercadoLibre') returning id into v_c;
  end if;
  insert into sales (tenant_id, customer_id, currency, source, external_ref) values (app_tenant(), v_c, v_cur, 'MercadoLibre', p_ml_order) returning id into v_sale;
  for i in select * from jsonb_array_elements(p_items) loop
    select * into p from products where tenant_id = app_tenant() and sku = i ->> 'sku' and deleted_at is null;
    if not found then raise exception 'SKU desconocido en la orden: %', i ->> 'sku' using errcode = 'no_data_found'; end if;
    if coalesce((i ->> 'quantity')::numeric, 0) <= 0 then raise exception 'Cantidad inválida para %', p.sku using errcode = 'check_violation'; end if;
    insert into sale_items (tenant_id, sale_id, product_id, description, quantity, unit_price_minor, unit_cost_minor)
    values (app_tenant(), v_sale, p.id, p.name, (i ->> 'quantity')::numeric, (i ->> 'unit_price_minor')::bigint, p.purchase_price_minor);
  end loop;
  select total_minor into v_total from sales where id = v_sale;
  insert into ml_sales (tenant_id, ml_account_id, ml_order_id, buyer_nickname, customer_email, customer_id, sale_id, status, total_minor, currency, raw_payload, ordered_at)
  values (app_tenant(), p_account, p_ml_order, p_buyer, p_email, v_c, v_sale, 'Pagado', v_total, v_cur, p_items, now());
  v_inv := sale_issue_invoice(v_sale);
  select id into v_ar from accounts_receivable where invoice_id = v_inv and tenant_id = app_tenant();
  perform payment_register(v_c, 'Mercado Pago', v_total, v_ar, p_ml_order, false);
  return v_sale;
end $$;

create function ml_question_receive(p_account uuid, p_ml_question text, p_item text, p_text text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  perform require_permission('mercadolibre.create'); perform require_feature('ml_advanced');
  select id into v_id from ml_questions where tenant_id = app_tenant() and ml_question_id = p_ml_question;
  if found then return v_id; end if;
  if nullif(btrim(coalesce(p_text, '')), '') is null then raise exception 'La pregunta está vacía' using errcode = 'check_violation'; end if;
  insert into ml_questions (tenant_id, ml_account_id, ml_question_id, ml_item_id, publication_id, question)
  values (app_tenant(), p_account, p_ml_question, p_item,
          (select id from ml_publications where tenant_id = app_tenant() and ml_item_id = p_item and deleted_at is null), btrim(p_text)) returning id into v_id;
  return v_id;
end $$;

create function ml_question_answer(p_question uuid, p_answer text) returns void
language plpgsql as $$
declare q ml_questions;
begin
  perform require_permission('mercadolibre.update'); perform require_feature('ml_advanced');
  select * into q from ml_questions where id = p_question and tenant_id = app_tenant() for update;
  if not found then raise exception 'Pregunta inexistente' using errcode = 'no_data_found'; end if;
  if q.status <> 'Sin responder' then raise exception 'La pregunta ya está %', lower(q.status) using errcode = 'check_violation'; end if;
  if nullif(btrim(coalesce(p_answer, '')), '') is null then raise exception 'La respuesta está vacía' using errcode = 'check_violation'; end if;
  if length(p_answer) > 2000 then raise exception 'La respuesta supera los 2000 caracteres' using errcode = 'check_violation'; end if;
  update ml_questions set answer = btrim(p_answer), status = 'Respondida', answered_at = now(), answered_by = app_user() where id = q.id;
end $$;

-- Compara el stock local con el publicado y deja marcado qué falta enviar. La integración real hará el envío.
create function ml_stock_refresh() returns int
language plpgsql as $$
declare pb record; v_local numeric; v_n int := 0;
begin
  perform require_permission('mercadolibre.update'); perform require_feature('ml_advanced');
  for pb in select * from ml_publications where tenant_id = app_tenant() and deleted_at is null and status in ('Preparado','Activa','Pausada') loop
    select coalesce(sum(available_quantity), 0) into v_local from v_inventory_status where tenant_id = pb.tenant_id and product_id = pb.product_id;
    update ml_stock_sync set local_stock = v_local, ml_stock = pb.stock_quantity,
           status = case when v_local = pb.stock_quantity then 'Sincronizado' else 'Pendiente' end
     where tenant_id = pb.tenant_id and publication_id = pb.id;
    if not found then
      insert into ml_stock_sync (tenant_id, publication_id, product_id, ml_item_id, local_stock, ml_stock, status)
      values (pb.tenant_id, pb.id, pb.product_id, pb.ml_item_id, v_local, pb.stock_quantity, case when v_local = pb.stock_quantity then 'Sincronizado' else 'Pendiente' end);
    end if;
    if v_local <> pb.stock_quantity then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $$;

create view v_ml_overview with (security_invoker = true) as
select t.id as tenant_id,
  (select count(*) from ml_accounts a where a.tenant_id = t.id and a.deleted_at is null and a.status = 'Conectada')::int as accounts_connected,
  (select count(*) from ml_publications p where p.tenant_id = t.id and p.deleted_at is null and p.status = 'Activa')::int as publications_active,
  (select count(*) from ml_publications p where p.tenant_id = t.id and p.deleted_at is null and p.status = 'Preparado')::int as publications_prepared,
  (select count(*) from ml_questions q where q.tenant_id = t.id and q.status = 'Sin responder')::int as questions_pending,
  (select count(*) from ml_stock_sync s where s.tenant_id = t.id and s.status = 'Pendiente')::int as stock_pending,
  (select count(*) from ml_sales m where m.tenant_id = t.id)::int as orders_imported
from tenants t;

-- ===================== Anuncios =====================
create function announcement_create(p_title text, p_message text, p_audience text default 'Todos', p_severity text default 'info',
                                    p_publish_at timestamptz default null, p_expires_at timestamptz default null,
                                    p_show_customers boolean default false, p_users uuid[] default null) returns uuid
language plpgsql as $$
declare v_id uuid; u uuid;
begin
  perform require_permission('announcements.create');
  if nullif(btrim(coalesce(p_title, '')), '') is null or nullif(btrim(coalesce(p_message, '')), '') is null then
    raise exception 'El anuncio necesita título y mensaje' using errcode = 'check_violation'; end if;
  if p_audience = 'Usuarios seleccionados' and coalesce(array_length(p_users, 1), 0) = 0 then
    raise exception 'Elegí al menos un usuario destinatario' using errcode = 'check_violation'; end if;
  insert into announcements (tenant_id, title, message, audience, severity, publish_at, expires_at, show_customer_frontend)
  values (app_tenant(), btrim(p_title), btrim(p_message), p_audience, p_severity, p_publish_at, p_expires_at, coalesce(p_show_customers, false) or p_audience = 'Clientes')
  returning id into v_id;
  if p_audience = 'Usuarios seleccionados' then
    foreach u in array p_users loop insert into announcement_recipients (tenant_id, announcement_id, user_id) values (app_tenant(), v_id, u) on conflict do nothing; end loop;
  end if;
  return v_id;
end $$;

-- Publica el anuncio: arma los destinatarios (todos los usuarios activos o los elegidos) y les avisa en la campana.
create function announcement_publish(p_id uuid) returns int
language plpgsql as $$
declare a announcements; v_n int;
begin
  perform require_permission('announcements.update');
  select * into a from announcements where id = p_id and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Anuncio inexistente' using errcode = 'no_data_found'; end if;
  if a.status <> 'Borrador' then raise exception 'Solo se publica un anuncio en Borrador' using errcode = 'check_violation'; end if;
  if a.audience = 'Todos' then
    insert into announcement_recipients (tenant_id, announcement_id, user_id)
    select a.tenant_id, a.id, u.id from users u where u.tenant_id = a.tenant_id and u.status = 'Activo' and u.deleted_at is null on conflict do nothing;
  end if;
  update announcements set status = 'Publicado', publish_at = coalesce(publish_at, now()) where id = a.id;
  insert into notifications (tenant_id, user_id, type, title, message, linked_type, linked_id)
  select a.tenant_id, r.user_id, 'Anuncio', a.title, left(a.message, 140), 'announcement', a.id from announcement_recipients r where r.announcement_id = a.id and r.tenant_id = a.tenant_id;
  get diagnostics v_n = row_count; return v_n;
end $$;

create function announcement_archive(p_id uuid) returns void language plpgsql as $$
begin
  perform require_permission('announcements.update');
  update announcements set status = 'Archivado' where id = p_id and tenant_id = app_tenant() and deleted_at is null and status <> 'Archivado';
  if not found then raise exception 'Anuncio inexistente o ya archivado' using errcode = 'no_data_found'; end if;
end $$;

create function announcement_mark_read(p_id uuid) returns void language plpgsql as $$
begin
  update announcement_recipients set read_at = coalesce(read_at, now()) where announcement_id = p_id and tenant_id = app_tenant() and user_id = app_user();
  if not found then raise exception 'Anuncio inexistente' using errcode = 'no_data_found'; end if;
end $$;

-- Mis anuncios: publicados, vigentes y dirigidos a mí.
create view v_my_announcements with (security_invoker = true) as
select a.tenant_id, a.id, a.title, a.message, a.severity, a.audience, a.publish_at, a.expires_at, r.read_at, (r.read_at is null) as unread
  from announcements a join announcement_recipients r on r.announcement_id = a.id and r.tenant_id = a.tenant_id
 where a.deleted_at is null and a.status = 'Publicado' and r.user_id = app_user()
   and (a.publish_at is null or a.publish_at <= now()) and (a.expires_at is null or a.expires_at > now());

-- ===================== Auditoría =====================
-- Solo quien tiene audit.read consulta la bitácora; cualquier operación del tenant puede escribir en ella.
drop policy tenant_isolation on audit_log;
create policy audit_read on audit_log for select using (tenant_id = app_tenant() and has_permission('audit.read'));
create policy audit_write on audit_log for insert with check (tenant_id = app_tenant());

create function audit_diff(p_old jsonb, p_new jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(k, jsonb_build_object('old', p_old -> k, 'new', p_new -> k)), '{}'::jsonb)
    from (select key as k from jsonb_each(coalesce(p_new, '{}'::jsonb)) union select key from jsonb_each(coalesce(p_old, '{}'::jsonb))) f
   where k not in ('updated_at', 'updated_by') and (p_old -> k) is distinct from (p_new -> k)
$$;

create view v_audit_log with (security_invoker = true) as
select l.tenant_id, l.id, l.created_at, l.user_id, u.name as user_name, l.entity, l.entity_id, l.action,
       case l.action when 'update' then audit_diff(l.old_value, l.new_value) when 'delete' then l.old_value else l.new_value end as detail,
       l.ip, l.request_id
  from audit_log l left join users u on u.id = l.user_id and u.tenant_id = l.tenant_id;

-- Historial de un registro (para el panel de cada cliente, venta, etc.).
create function audit_for(p_entity text, p_id uuid, p_limit int default 50) returns setof v_audit_log
language sql stable as $$
  select * from v_audit_log where tenant_id = app_tenant() and entity = p_entity and entity_id = p_id order by created_at desc limit greatest(least(p_limit, 200), 1)
$$;

grant select on v_ml_overview, v_my_announcements, v_audit_log to nexo_app, nexo_platform;
grant execute on function require_feature(text), ml_account_register(text, text, text), ml_account_disconnect(uuid), ml_publication_prepare(uuid, uuid, text, bigint, numeric),
  ml_publication_set_status(uuid, text), ml_order_import(uuid, text, text, text, jsonb, char), ml_question_receive(uuid, text, text, text), ml_question_answer(uuid, text),
  ml_stock_refresh(), announcement_create(text, text, text, text, timestamptz, timestamptz, boolean, uuid[]), announcement_publish(uuid), announcement_archive(uuid),
  announcement_mark_read(uuid), audit_diff(jsonb, jsonb), audit_for(text, uuid, int) to nexo_app, nexo_platform;
