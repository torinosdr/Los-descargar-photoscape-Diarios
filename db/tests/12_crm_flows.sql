-- 12 · CRM: leads → cliente, tickets, tareas y proyectos
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-retail'); u uuid; l1 uuid; l2 uuid; l3 uuid; c1 uuid; c2 uuid; k uuid; tk uuid; sub uuid; pr uuid; n int;
begin
  select u.id into u from users u join roles r on r.id = u.role_id where u.tenant_id = t1 and r.code = 'admin' limit 1;
  perform set_config('app.tenant_id', t1::text, true);
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;

  -- ---- leads
  insert into leads (tenant_id, name, email, company, source, estimated_value_minor) values (t1, 'Ana Gómez', 'ana@x.com', 'Gómez SRL', 'Web', 500000) returning id into l1;
  insert into leads (tenant_id, name, source) values (t1, 'Luis Pérez', 'Instagram') returning id into l2;
  insert into leads (tenant_id, name) values (t1, 'Descartado') returning id into l3;
  perform pg_temp.assert((select number from leads where id = l1) like 'LED-%', 'el lead recibe número');
  perform pg_temp.assert(pg_temp.throws(format('select lead_advance(%L, ''Negociación'')', l1), '23514'), 'no se salta etapas con lead_advance');
  perform pg_temp.assert(pg_temp.throws(format('select lead_advance(%L, ''Ganado'')', l1), '23514'), 'Ganado solo por lead_convert');
  perform lead_advance(l1, 'Contactado');
  perform pg_temp.assert((select status from leads where id = l1) = 'Contactado', 'avanza una etapa');

  perform pg_temp.assert(pg_temp.throws(format('select lead_lose(%L, '' '')', l3), '23514'), 'perder exige motivo');
  perform lead_lose(l3, 'Sin presupuesto');
  perform pg_temp.assert((select status from leads where id = l3) = 'Perdido', 'lead perdido');
  perform pg_temp.assert(pg_temp.throws(format('select lead_convert(%L)', l3), '23514'), 'un lead perdido no se convierte');
  perform pg_temp.assert(pg_temp.throws(format('update leads set status = ''Ganado'' where id = %L', l1), '23514'), 'update directo a Ganado inválido');

  insert into tasks (tenant_id, title, lead_id) values (t1, 'Llamar a Ana', l1);
  c1 := lead_convert(l1);
  perform pg_temp.assert((select customer_type from customers where id = c1) = 'B2B' and (select company_name from customers where id = c1) = 'Gómez SRL', 'empresa → cliente B2B');
  perform pg_temp.assert((select count(*) from customer_contacts where customer_id = c1 and is_primary) = 1, 'contacto principal creado');
  perform pg_temp.assert((select status from leads where id = l1) = 'Ganado' and (select converted_customer_id from leads where id = l1) = c1, 'lead ganado y vinculado');
  perform pg_temp.assert((select customer_id from tasks where lead_id = l1) = c1, 'las tareas pasan al cliente');
  perform pg_temp.assert(pg_temp.throws(format('select lead_convert(%L)', l1), '23505'), 'no se convierte dos veces');
  c2 := lead_convert(l2);
  perform pg_temp.assert((select customer_type from customers where id = c2) = 'B2C' and (select display_name from customers where id = c2) = 'Luis Pérez', 'persona → cliente B2C');
  select count(*) into n from v_pipeline where status = 'Ganado';
  perform pg_temp.assert(n = 1, 'el embudo cuenta ganados');

  -- ---- tickets
  insert into tickets (tenant_id, customer_id, subject, priority, due_at) values (t1, c1, 'No llega el pedido', 'Alta', now() - interval '1 hour') returning id into k;
  perform pg_temp.assert((select overdue from v_ticket_overview where id = k), 'ticket vencido en la vista');
  perform pg_temp.assert(pg_temp.throws(format('select ticket_reply(%L, '' '')', k), '23514'), 'mensaje vacío rechazado');
  perform ticket_reply(k, 'Nota interna', true);
  perform pg_temp.assert((select status from tickets where id = k) = 'Abierto', 'nota interna no toma el ticket');
  perform ticket_reply(k, 'Estamos revisando');
  perform pg_temp.assert((select status from tickets where id = k) = 'En Progreso', 'respuesta pública toma el ticket');
  perform pg_temp.assert(pg_temp.throws(format('select ticket_change_status(%L, ''Cerrado'')', k), '23514'), 'no se cierra sin resolver');
  perform ticket_change_status(k, 'Resuelto');
  perform pg_temp.assert((select resolved_at is not null from tickets where id = k), 'resolved_at se completa');
  perform ticket_change_status(k, 'Cerrado');
  perform pg_temp.assert((select closed_at is not null from tickets where id = k), 'closed_at se completa');
  perform pg_temp.assert(pg_temp.throws(format('select ticket_reply(%L, ''hola'')', k), '23514'), 'no se responde un ticket cerrado');
  perform ticket_change_status(k, 'Abierto');
  perform pg_temp.assert((select closed_at is null and resolved_at is null from tickets where id = k), 'reabrir limpia fechas');

  -- ---- proyectos y tareas
  insert into projects (tenant_id, customer_id, name, billable, billing_mode, budget_minor, due_date) values (t1, c1, 'Implementación', true, 'Por horas', 1000000, current_date - 1) returning id into pr;
  insert into tasks (tenant_id, title, project_id, billable) values (t1, 'Relevamiento', pr, true) returning id into tk;
  insert into tasks (tenant_id, title, project_id, parent_task_id) values (t1, 'Entrevistas', pr, tk) returning id into sub;
  perform pg_temp.assert(pg_temp.throws(format('select task_log_time(%L, 0)', tk), '23514'), 'minutos > 0');
  perform task_log_time(tk, 90, null, 'Reunión');
  perform pg_temp.assert((select status from tasks where id = tk) = 'En Progreso' and (select billable from time_entries where task_id = tk), 'registrar horas inicia la tarea y hereda facturable');
  perform pg_temp.assert(pg_temp.throws(format('select task_complete(%L)', tk), '23514'), 'no se completa con subtareas abiertas');
  perform task_complete(sub);
  perform task_complete(tk);
  perform pg_temp.assert((select completed_at is not null from tasks where id = tk), 'completed_at');
  perform pg_temp.assert(pg_temp.throws(format('select task_log_time(%L, 10)', tk), '23514'), 'no se cargan horas a tarea completada');
  perform pg_temp.assert((select tasks_total = 2 and tasks_done = 2 and minutes_logged = 90 and overdue from v_project_summary where id = pr), 'resumen del proyecto');
  insert into tasks (tenant_id, title, project_id) values (t1, 'Pendiente', pr);
  perform pg_temp.assert(pg_temp.throws(format('select project_set_status(%L, ''Completado'')', pr), '23514'), 'proyecto no se completa con tareas abiertas');

  -- ---- permisos y aislamiento
  reset role;
  select u2.id into u from users u2 join roles r on r.id = u2.role_id where u2.tenant_id = pg_temp.tid('demo-distribuidora') and r.code = 'admin' limit 1;
  perform set_config('app.tenant_id', pg_temp.tid('demo-distribuidora')::text, true);
  perform set_config('app.user_id', u::text, true);
  set local role nexo_app;
  perform pg_temp.assert(not exists (select 1 from leads where id = l1), 'otro tenant no ve leads');
  perform pg_temp.assert(pg_temp.throws(format('select lead_lose(%L, ''x'')', l2), 'P0002'), 'otro tenant no puede operar el lead');
end $t$;
rollback;
