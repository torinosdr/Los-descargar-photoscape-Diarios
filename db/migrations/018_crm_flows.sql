-- Fase 7 · CRM: leads → cliente, embudo, tickets con mensajes, tareas con horas, proyectos.

-- Fechas derivadas por trigger (nadie las escribe a mano).
create function tasks_set_completed() returns trigger language plpgsql as $$
begin
  if new.status = 'Completada' and old.status is distinct from 'Completada' then new.completed_at := now();
  elsif new.status <> 'Completada' then new.completed_at := null; end if;
  return new;
end $$;
create trigger c_completed before update of status on tasks for each row execute function tasks_set_completed();

create function tickets_set_dates() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.last_activity_at := now();
    if new.status = 'Resuelto' then new.resolved_at := now(); new.closed_at := null;
    elsif new.status = 'Cerrado' then new.closed_at := now(); new.resolved_at := coalesce(new.resolved_at, now());
    else new.resolved_at := null; new.closed_at := null; end if;
  end if;
  return new;
end $$;
create trigger c_dates before update of status on tickets for each row execute function tickets_set_dates();

create function ticket_message_touch() returns trigger language plpgsql as $$
begin
  update tickets set last_activity_at = now() where id = new.ticket_id and tenant_id = new.tenant_id;
  return new;
end $$;
create trigger c_touch after insert on ticket_messages for each row execute function ticket_message_touch();

-- ===================== Leads =====================
create function lead_advance(p_lead uuid, p_status text) returns void
language plpgsql as $$
begin
  perform require_permission('leads.update');
  if p_status in ('Ganado', 'Perdido') then
    raise exception 'Usá lead_convert o lead_lose para cerrar un lead' using errcode = 'check_violation';
  end if;
  update leads set status = p_status where id = p_lead and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Lead inexistente' using errcode = 'no_data_found'; end if;
end $$;

create function lead_lose(p_lead uuid, p_reason text) returns void
language plpgsql as $$
begin
  perform require_permission('leads.update');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Indicá el motivo de la pérdida' using errcode = 'check_violation';
  end if;
  update leads set status = 'Perdido', lost_reason = btrim(p_reason)
   where id = p_lead and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Lead inexistente' using errcode = 'no_data_found'; end if;
end $$;

-- Convierte el lead en cliente (empresa → B2B, persona → B2C). Recorre las etapas intermedias.
create function lead_convert(p_lead uuid) returns uuid
language plpgsql as $$
declare l leads; v_c uuid; v_path text[] := array['Nuevo','Contactado','Calificado','Propuesta Enviada','Negociación']; s text; v_from int;
begin
  perform require_permission('leads.update'); perform require_permission('customers.create');
  select * into l from leads where id = p_lead and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Lead inexistente' using errcode = 'no_data_found'; end if;
  if l.status = 'Ganado' then raise exception 'El lead ya fue convertido' using errcode = 'unique_violation'; end if;
  if l.status = 'Perdido' then raise exception 'Reabrí el lead perdido antes de convertirlo' using errcode = 'check_violation'; end if;
  if nullif(btrim(coalesce(l.company, '')), '') is not null then
    insert into customers (tenant_id, customer_type, person_type, company_name, email, phone, source, currency)
    values (l.tenant_id, 'B2B', 'Empresa', btrim(l.company), l.email, l.phone, l.source, l.currency) returning id into v_c;
    insert into customer_contacts (tenant_id, customer_id, name, email, phone, is_primary)
    values (l.tenant_id, v_c, l.name, l.email, l.phone, true);
  else
    insert into customers (tenant_id, customer_type, person_type, first_name, email, phone, source, currency)
    values (l.tenant_id, 'B2C', 'Persona Física', l.name, l.email, l.phone, l.source, l.currency) returning id into v_c;
  end if;
  v_from := array_position(v_path, l.status);
  for i in v_from + 1 .. array_length(v_path, 1) loop
    update leads set status = v_path[i] where id = l.id;
  end loop;
  update leads set status = 'Ganado', converted_customer_id = v_c, converted_at = now() where id = l.id;
  -- tareas y llamadas del lead pasan al cliente
  update tasks set customer_id = v_c where lead_id = l.id and tenant_id = l.tenant_id and customer_id is null;
  update calls set customer_id = v_c where lead_id = l.id and tenant_id = l.tenant_id and customer_id is null;
  return v_c;
end $$;

-- ===================== Tickets =====================
create function ticket_change_status(p_ticket uuid, p_status text) returns void
language plpgsql as $$
begin
  perform require_permission('tickets.update');
  update tickets set status = p_status where id = p_ticket and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Ticket inexistente' using errcode = 'no_data_found'; end if;
end $$;

create function ticket_reply(p_ticket uuid, p_body text, p_internal boolean default false) returns uuid
language plpgsql as $$
declare t tickets; v_id uuid;
begin
  perform require_permission('tickets.update');
  if nullif(btrim(coalesce(p_body, '')), '') is null then raise exception 'El mensaje está vacío' using errcode = 'check_violation'; end if;
  select * into t from tickets where id = p_ticket and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Ticket inexistente' using errcode = 'no_data_found'; end if;
  if t.status = 'Cerrado' then raise exception 'El ticket está cerrado: reabrilo para responder' using errcode = 'check_violation'; end if;
  insert into ticket_messages (tenant_id, ticket_id, author_type, author_user_id, body, is_internal)
  values (t.tenant_id, t.id, 'Usuario', app_user(), btrim(p_body), coalesce(p_internal, false)) returning id into v_id;
  -- una respuesta pública a un ticket abierto lo toma automáticamente
  if t.status = 'Abierto' and not coalesce(p_internal, false) then update tickets set status = 'En Progreso' where id = t.id; end if;
  return v_id;
end $$;

-- ===================== Tareas =====================
create function task_complete(p_task uuid) returns void
language plpgsql as $$
begin
  perform require_permission('tasks.update');
  if exists (select 1 from tasks where parent_task_id = p_task and tenant_id = app_tenant() and deleted_at is null
                and status not in ('Completada', 'Cancelada')) then
    raise exception 'Hay subtareas sin completar' using errcode = 'check_violation';
  end if;
  update tasks set status = 'Completada' where id = p_task and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Tarea inexistente' using errcode = 'no_data_found'; end if;
end $$;

create function task_log_time(p_task uuid, p_minutes int, p_billable boolean default null, p_notes text default null) returns uuid
language plpgsql as $$
declare t tasks; v_id uuid;
begin
  perform require_permission('tasks.update');
  select * into t from tasks where id = p_task and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Tarea inexistente' using errcode = 'no_data_found'; end if;
  if t.status in ('Completada', 'Cancelada') then raise exception 'La tarea está %', lower(t.status) using errcode = 'check_violation'; end if;
  insert into time_entries (tenant_id, task_id, user_id, minutes, billable, notes)
  values (t.tenant_id, t.id, app_user(), p_minutes, coalesce(p_billable, t.billable), p_notes) returning id into v_id;
  if t.status = 'Pendiente' then update tasks set status = 'En Progreso' where id = t.id; end if;
  return v_id;
end $$;

-- ===================== Proyectos =====================
create function project_set_status(p_project uuid, p_status text) returns void
language plpgsql as $$
begin
  perform require_permission('projects.update');
  if p_status = 'Completado' and exists (select 1 from tasks where project_id = p_project and tenant_id = app_tenant()
        and deleted_at is null and status not in ('Completada', 'Cancelada')) then
    raise exception 'El proyecto tiene tareas sin completar' using errcode = 'check_violation';
  end if;
  update projects set status = p_status where id = p_project and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Proyecto inexistente' using errcode = 'no_data_found'; end if;
end $$;

-- ===================== Vistas =====================
create view v_pipeline with (security_invoker = true) as
select tenant_id, status, count(*)::int as leads, coalesce(sum(estimated_value_minor), 0)::bigint as value_minor
  from leads where deleted_at is null group by tenant_id, status;

create view v_ticket_overview with (security_invoker = true) as
select k.tenant_id, k.id, k.number, k.customer_id, k.subject, k.priority, k.status, k.assigned_user_id, k.due_at,
       (k.status not in ('Resuelto', 'Cerrado') and k.due_at is not null and k.due_at < now()) as overdue,
       (select count(*) from ticket_messages m where m.ticket_id = k.id and m.tenant_id = k.tenant_id)::int as messages
  from tickets k where k.deleted_at is null;

create view v_project_summary with (security_invoker = true) as
select p.tenant_id, p.id, p.number, p.name, p.customer_id, p.status, p.due_date, p.billable, p.billing_mode, p.budget_minor,
       count(t.id)::int as tasks_total,
       count(t.id) filter (where t.status = 'Completada')::int as tasks_done,
       coalesce((select sum(te.minutes) from time_entries te join tasks t2 on t2.id = te.task_id and t2.tenant_id = te.tenant_id
                  where t2.project_id = p.id and te.tenant_id = p.tenant_id and te.deleted_at is null), 0)::int as minutes_logged,
       (p.status in ('Planificado', 'En Progreso') and p.due_date is not null and p.due_date < current_date) as overdue
  from projects p
  left join tasks t on t.project_id = p.id and t.tenant_id = p.tenant_id and t.deleted_at is null and t.status <> 'Cancelada'
 where p.deleted_at is null
 group by p.tenant_id, p.id;

grant select on v_pipeline, v_ticket_overview, v_project_summary to nexo_app, nexo_platform;
grant execute on function lead_advance(uuid, text), lead_lose(uuid, text), lead_convert(uuid),
  ticket_change_status(uuid, text), ticket_reply(uuid, text, boolean), task_complete(uuid),
  task_log_time(uuid, int, boolean, text), project_set_status(uuid, text) to nexo_app, nexo_platform;
