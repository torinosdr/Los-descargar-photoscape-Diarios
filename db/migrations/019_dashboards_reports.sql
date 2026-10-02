-- Fase 8 · Tablero, informes, notificaciones, búsqueda global, agenda, llamadas, notas y recordatorios.
-- Los importes del tablero van en la moneda base del tenant; los informes se agrupan por moneda.

-- ===================== Tablero =====================
create view v_dashboard with (security_invoker = true) as
select t.id as tenant_id, t.base_currency as currency,
  coalesce((select sum(s.total_minor) from sales s where s.tenant_id = t.id and s.deleted_at is null and s.status <> 'Cancelado'
             and s.currency = t.base_currency and s.sold_at >= now() - interval '30 days'), 0)::bigint as sales_30d_minor,
  coalesce((select sum(s.total_minor) from sales s where s.tenant_id = t.id and s.deleted_at is null and s.status <> 'Cancelado'
             and s.currency = t.base_currency and s.sold_at >= now() - interval '60 days' and s.sold_at < now() - interval '30 days'), 0)::bigint as sales_prev_30d_minor,
  coalesce((select sum(ar.open_minor) from accounts_receivable ar where ar.tenant_id = t.id and ar.deleted_at is null
             and ar.status in ('Abierta','Parcial') and ar.currency = t.base_currency), 0)::bigint as receivable_minor,
  coalesce((select sum(ar.open_minor) from accounts_receivable ar where ar.tenant_id = t.id and ar.deleted_at is null
             and ar.status in ('Abierta','Parcial') and ar.currency = t.base_currency and ar.due_date < current_date), 0)::bigint as receivable_overdue_minor,
  coalesce((select sum(ap.open_minor) from accounts_payable ap where ap.tenant_id = t.id and ap.deleted_at is null
             and ap.status in ('Abierta','Parcial') and ap.currency = t.base_currency), 0)::bigint as payable_minor,
  coalesce((select sum(w.balance_minor) from v_wallet_balances w where w.tenant_id = t.id and w.currency = t.base_currency), 0)::bigint as wallet_minor,
  (select count(*) from tickets k where k.tenant_id = t.id and k.deleted_at is null and k.status not in ('Resuelto','Cerrado'))::int as open_tickets,
  (select count(*) from tickets k where k.tenant_id = t.id and k.deleted_at is null and k.status not in ('Resuelto','Cerrado')
      and k.due_at < now())::int as overdue_tickets,
  (select count(*) from tasks x where x.tenant_id = t.id and x.deleted_at is null and x.status not in ('Completada','Cancelada')
      and x.due_date < current_date)::int as overdue_tasks,
  coalesce((select sum(l.estimated_value_minor) from leads l where l.tenant_id = t.id and l.deleted_at is null
             and l.status not in ('Ganado','Perdido') and coalesce(l.currency, t.base_currency) = t.base_currency), 0)::bigint as pipeline_minor,
  (select count(*) from v_inventory_status v where v.tenant_id = t.id and v.reorder_alert)::int as low_stock_count,
  (select count(*) from customers c where c.tenant_id = t.id and c.deleted_at is null and c.created_at >= now() - interval '30 days')::int as new_customers_30d
from tenants t;

-- ===================== Informes =====================
create view v_top_customers with (security_invoker = true) as
select s.tenant_id, s.customer_id, c.display_name as customer_name, s.currency,
       count(*)::int as sales_count, sum(s.total_minor)::bigint as total_minor, max(s.sold_at)::date as last_sale
  from sales s join customers c on c.id = s.customer_id and c.tenant_id = s.tenant_id
 where s.deleted_at is null and s.status <> 'Cancelado' group by s.tenant_id, s.customer_id, c.display_name, s.currency;

create view v_top_products with (security_invoker = true) as
select i.tenant_id, i.product_id, p.sku, p.name as product_name, s.currency,
       sum(i.quantity - i.quantity_returned)::numeric(14,3) as units,
       sum(round((i.quantity - i.quantity_returned) * i.unit_price_minor) - i.discount_minor)::bigint as revenue_minor,
       sum(round((i.quantity - i.quantity_returned) * coalesce(i.unit_cost_minor, 0)))::bigint as cost_minor
  from sale_items i
  join sales s on s.id = i.sale_id and s.tenant_id = i.tenant_id
  join products p on p.id = i.product_id and p.tenant_id = i.tenant_id
 where s.deleted_at is null and s.status <> 'Cancelado' and i.product_id is not null
 group by i.tenant_id, i.product_id, p.sku, p.name, s.currency;

-- Flujo de caja: lo cobrado, lo pagado a proveedores y los gastos pagados, por mes.
create view v_cash_flow_monthly with (security_invoker = true) as
with m as (
  select tenant_id, date_trunc('month', paid_at)::date as month, currency,
         sum(amount_minor) filter (where direction = 'Entrada')::bigint as cash_in,
         sum(amount_minor) filter (where direction = 'Salida')::bigint as supplier_out, 0::bigint as expenses_out
    from payments where status = 'Confirmado' group by 1, 2, 3
  union all
  select tenant_id, date_trunc('month', paid_at)::date, currency, 0, 0, sum(amount_minor)::bigint
    from expenses where status = 'Pagado' and deleted_at is null and paid_at is not null group by 1, 2, 3)
select tenant_id, month, currency, coalesce(sum(cash_in), 0)::bigint as cash_in_minor,
       coalesce(sum(supplier_out), 0)::bigint as supplier_out_minor, coalesce(sum(expenses_out), 0)::bigint as expenses_out_minor,
       (coalesce(sum(cash_in), 0) - coalesce(sum(supplier_out), 0) - coalesce(sum(expenses_out), 0))::bigint as net_minor
  from m group by tenant_id, month, currency;

-- ===================== Notificaciones =====================
-- Privadas por usuario: cada persona ve y marca solo las suyas; cualquiera puede crear una para otra persona de su tenant.
drop policy tenant_isolation on notifications;
create policy own_select on notifications for select using (tenant_id = app_tenant() and user_id = app_user());
create policy own_update on notifications for update using (tenant_id = app_tenant() and user_id = app_user()) with check (tenant_id = app_tenant() and user_id = app_user());
create policy tenant_insert on notifications for insert with check (tenant_id = app_tenant());
create function notify(p_user uuid, p_type text, p_title text, p_message text default null, p_linked_type text default null, p_linked_id uuid default null)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into notifications (tenant_id, user_id, type, title, message, linked_type, linked_id)
  values (app_tenant(), p_user, p_type, p_title, p_message, p_linked_type, p_linked_id) returning id into v_id;
  return v_id;
end $$;

-- Genera (una vez por día y tipo) las alertas del usuario actual. Devuelve cuántas creó.
create function notifications_generate() returns int
language plpgsql as $$
declare v_n int := 0; v_c int; v_user uuid := app_user(); v_t uuid := app_tenant();
begin
  if v_user is null then return 0; end if;
  if has_permission('receivables.read') then
    select count(*) into v_c from v_receivables where tenant_id = v_t and is_overdue and open_minor > 0;
    if v_c > 0 and not exists (select 1 from notifications where tenant_id = v_t and user_id = v_user and type = 'Cobranza' and created_at::date = current_date) then
      perform notify(v_user, 'Cobranza', 'Deudas vencidas', v_c || ' cuentas por cobrar vencidas'); v_n := v_n + 1; end if;
  end if;
  if has_permission('inventory.read') then
    select count(*) into v_c from v_inventory_status where tenant_id = v_t and reorder_alert;
    if v_c > 0 and not exists (select 1 from notifications where tenant_id = v_t and user_id = v_user and type = 'Stock' and created_at::date = current_date) then
      perform notify(v_user, 'Stock', 'Stock bajo', v_c || ' productos bajo el mínimo'); v_n := v_n + 1; end if;
  end if;
  select count(*) into v_c from tickets where tenant_id = v_t and deleted_at is null and assigned_user_id = v_user
     and status not in ('Resuelto','Cerrado') and due_at < now();
  if v_c > 0 and not exists (select 1 from notifications where tenant_id = v_t and user_id = v_user and type = 'Ticket' and title = 'Tickets vencidos' and created_at::date = current_date) then
    perform notify(v_user, 'Ticket', 'Tickets vencidos', v_c || ' tickets asignados a vos están vencidos'); v_n := v_n + 1; end if;
  select count(*) into v_c from tasks where tenant_id = v_t and deleted_at is null and assigned_user_id = v_user
     and status not in ('Completada','Cancelada') and due_date < current_date;
  if v_c > 0 and not exists (select 1 from notifications where tenant_id = v_t and user_id = v_user and type = 'Tarea' and title = 'Tareas vencidas' and created_at::date = current_date) then
    perform notify(v_user, 'Tarea', 'Tareas vencidas', v_c || ' tareas asignadas a vos están vencidas'); v_n := v_n + 1; end if;
  return v_n;
end $$;

create function notification_read(p_id uuid) returns void language plpgsql as $$
begin
  update notifications set read_at = coalesce(read_at, now()) where id = p_id and tenant_id = app_tenant() and user_id = app_user();
  if not found then raise exception 'Notificación inexistente' using errcode = 'no_data_found'; end if;
end $$;

create function notifications_read_all() returns int language plpgsql as $$
declare v_n int;
begin
  update notifications set read_at = now() where tenant_id = app_tenant() and user_id = app_user() and read_at is null;
  get diagnostics v_n = row_count; return v_n;
end $$;

-- Al asignar un ticket o una tarea a otra persona, esa persona recibe una notificación.
create function notify_assignment() returns trigger language plpgsql as $$
declare v_title text;
begin
  if new.assigned_user_id is not null and new.assigned_user_id is distinct from app_user()
     and (tg_op = 'INSERT' or new.assigned_user_id is distinct from old.assigned_user_id) then
    v_title := coalesce(to_jsonb(new)->>'subject', to_jsonb(new)->>'title');
    insert into notifications (tenant_id, user_id, type, title, message, linked_type, linked_id)
    values (new.tenant_id, new.assigned_user_id, case tg_table_name when 'tickets' then 'Ticket' else 'Tarea' end,
            'Te asignaron: ' || v_title, to_jsonb(new)->>'number', case tg_table_name when 'tickets' then 'ticket' else 'task' end, new.id);
  end if;
  return new;
end $$;
create trigger d_notify after insert or update of assigned_user_id on tickets for each row execute function notify_assignment();
create trigger d_notify after insert or update of assigned_user_id on tasks   for each row execute function notify_assignment();

-- ===================== Búsqueda global =====================
-- Si el texto parece un número de documento (letras + dígitos, o solo dígitos) busca por número; si no, por texto.
create function search_global(p_q text, p_limit int default 20)
returns table (entity text, entity_id uuid, label text, sublabel text, status text)
language plpgsql stable as $$
declare v_q text := lower(btrim(coalesce(p_q, ''))); v_num boolean;
begin
  if length(v_q) < 2 then return; end if;
  v_num := v_q ~ '^[a-z]{0,4}-?[0-9]+$';
  return query
  select r.entity, r.entity_id, r.label, r.sublabel, r.status from (
    select g.entity, g.entity_id, g.label, g.sublabel, g.status,
           case when lower(g.label) = v_q then 0 when lower(g.label) like v_q || '%' then 1 else 2 end as rank
      from v_global_search g
     where g.tenant_id = app_tenant() and (g.kind = 'number') = v_num and g.search_text like '%' || v_q || '%'
    union all
    select 'producto', p.id, p.name, p.sku, p.status, case when lower(p.sku) = v_q then 0 else 2 end
      from products p where p.tenant_id = app_tenant() and p.deleted_at is null and not v_num
       and lower(p.name || ' ' || p.sku) like '%' || v_q || '%'
    union all
    select 'proveedor', s.id, s.name, s.email, null, 2
      from suppliers s where s.tenant_id = app_tenant() and s.deleted_at is null and not v_num
       and lower(s.name || ' ' || coalesce(s.email, '')) like '%' || v_q || '%'
  ) r order by r.rank, r.label limit greatest(least(p_limit, 50), 1);
end $$;

-- ===================== Contactos (rail) =====================
create view v_contacts with (security_invoker = true) as
select cc.tenant_id, cc.id, 'cliente'::text as source, cc.name, cc.email, cc.phone, cc.position,
       c.display_name as organization, cc.customer_id as organization_id
  from customer_contacts cc join customers c on c.id = cc.customer_id and c.tenant_id = cc.tenant_id
 where cc.deleted_at is null and cc.status = 'Activo'
union all
select l.tenant_id, l.id, 'lead', l.name, l.email, l.phone, null, l.company, null
  from leads l where l.deleted_at is null and l.status not in ('Ganado','Perdido');

-- ===================== Agenda =====================
create function calendar_event_create(p_title text, p_starts timestamptz, p_ends timestamptz, p_type text default 'Cita',
                                      p_customer uuid default null, p_lead uuid default null, p_location text default null) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  perform require_permission('calendar.create');
  if nullif(btrim(coalesce(p_title, '')), '') is null then raise exception 'El evento necesita un título' using errcode = 'check_violation'; end if;
  if p_ends < p_starts then raise exception 'El evento termina antes de empezar' using errcode = 'check_violation'; end if;
  if exists (select 1 from calendar_events e where e.tenant_id = app_tenant() and e.owner_user_id = app_user() and e.deleted_at is null
              and e.status = 'Programada' and not e.all_day and e.starts_at < p_ends and e.ends_at > p_starts and p_ends > p_starts) then
    raise exception 'Ya tenés un evento en ese horario' using errcode = 'exclusion_violation';
  end if;
  insert into calendar_events (tenant_id, title, event_type, starts_at, ends_at, owner_user_id, customer_id, lead_id, location)
  values (app_tenant(), btrim(p_title), p_type, p_starts, p_ends, app_user(), p_customer, p_lead, p_location) returning id into v_id;
  return v_id;
end $$;

create function calendar_event_set_status(p_id uuid, p_status text) returns void language plpgsql as $$
begin
  perform require_permission('calendar.update');
  if p_status not in ('Programada','Completada','Cancelada') then raise exception 'Estado inválido' using errcode = 'check_violation'; end if;
  update calendar_events set status = p_status where id = p_id and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Evento inexistente' using errcode = 'no_data_found'; end if;
end $$;

-- ===================== Llamadas, notas y recordatorios =====================
create function call_log(p_direction text, p_subject text, p_minutes int default 0, p_customer uuid default null, p_lead uuid default null,
                         p_outcome text default null, p_notes text default null) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  perform require_permission('calls.create');
  if p_customer is null and p_lead is null then raise exception 'La llamada debe asociarse a un cliente o a un lead' using errcode = 'check_violation'; end if;
  if nullif(btrim(coalesce(p_subject, '')), '') is null then raise exception 'La llamada necesita un asunto' using errcode = 'check_violation'; end if;
  insert into calls (tenant_id, direction, customer_id, lead_id, user_id, subject, duration_minutes, outcome, notes)
  values (app_tenant(), p_direction, p_customer, p_lead, app_user(), btrim(p_subject), coalesce(p_minutes, 0), p_outcome, p_notes) returning id into v_id;
  return v_id;
end $$;

create function note_add(p_type text, p_id uuid, p_body text, p_pinned boolean default false) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  perform require_permission('notes.create');
  if nullif(btrim(coalesce(p_body, '')), '') is null then raise exception 'La nota está vacía' using errcode = 'check_violation'; end if;
  insert into notes (tenant_id, linked_type, linked_id, body, pinned) values (app_tenant(), p_type, p_id, btrim(p_body), coalesce(p_pinned, false)) returning id into v_id;
  return v_id;
end $$;

create function reminder_create(p_at timestamptz, p_text text, p_type text default null, p_id uuid default null) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  if nullif(btrim(coalesce(p_text, '')), '') is null then raise exception 'El recordatorio está vacío' using errcode = 'check_violation'; end if;
  insert into reminders (tenant_id, user_id, linked_type, linked_id, remind_at, text) values (app_tenant(), app_user(), p_type, p_id, p_at, btrim(p_text)) returning id into v_id;
  return v_id;
end $$;

create function reminder_done(p_id uuid) returns void language plpgsql as $$
begin
  update reminders set done_at = coalesce(done_at, now()) where id = p_id and tenant_id = app_tenant() and user_id = app_user() and deleted_at is null;
  if not found then raise exception 'Recordatorio inexistente' using errcode = 'no_data_found'; end if;
end $$;

grant select on v_dashboard, v_top_customers, v_top_products, v_cash_flow_monthly, v_contacts to nexo_app, nexo_platform;
grant execute on function notify(uuid, text, text, text, text, uuid), notifications_generate(), notification_read(uuid), notifications_read_all(),
  search_global(text, int), calendar_event_create(text, timestamptz, timestamptz, text, uuid, uuid, text), calendar_event_set_status(uuid, text),
  call_log(text, text, int, uuid, uuid, text, text), note_add(text, uuid, text, boolean), reminder_create(timestamptz, text, text, uuid), reminder_done(uuid)
  to nexo_app, nexo_platform;
