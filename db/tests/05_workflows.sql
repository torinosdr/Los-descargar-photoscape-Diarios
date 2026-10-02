-- 05 · Máquina de estados (ventas, presupuestos, leads, tickets) y reglas de conversión
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-retail'); c uuid; s uuid; q uuid; l uuid; tk uuid; s2 uuid;
begin
  select id into c from customers where tenant_id = t1 limit 1;

  -- ventas
  insert into sales (tenant_id, customer_id, currency) values (t1, c, 'ARS') returning id into s;
  perform pg_temp.assert(pg_temp.throws(format('update sales set status = ''Entregado'' where id = %L', s), '23514', 'Transición inválida'), 'Pendiente de Pago → Entregado no permitido');
  update sales set status = 'En Preparación' where id = s;
  update sales set status = 'Enviado' where id = s;
  perform pg_temp.assert(pg_temp.throws(format('update sales set status = ''Cancelado'' where id = %L', s), '23514'), 'una venta enviada no se cancela');
  update sales set status = 'Entregado' where id = s;
  update sales set status = 'Completado' where id = s;
  perform pg_temp.assert(pg_temp.throws(format('update sales set status = ''Pendiente de Pago'' where id = %L', s), '23514'), 'Completado no vuelve atrás');

  -- presupuestos y conversión (una venta por presupuesto)
  insert into quotes (tenant_id, customer_id, currency) values (t1, c, 'ARS') returning id into q;
  perform pg_temp.assert(pg_temp.throws(format('update quotes set status = ''Convertido a Venta'' where id = %L', q), '23514'), 'Borrador no se convierte directamente');
  update quotes set status = 'Enviado' where id = q;
  update quotes set status = 'Aceptado' where id = q;
  perform pg_temp.assert(pg_temp.throws(format('update quotes set status = ''Convertido a Venta'' where id = %L', q), '23514'), 'convertir exige una venta asociada (check)');
  insert into sales (tenant_id, customer_id, currency, quote_id) values (t1, c, 'ARS', q) returning id into s;
  update quotes set status = 'Convertido a Venta', converted_sale_id = s where id = q;
  perform pg_temp.assert(pg_temp.throws(format('insert into sales (tenant_id, customer_id, currency, quote_id) values (%L,%L,''ARS'',%L)', t1, c, q), '23505'), 'un presupuesto solo genera una venta');

  -- leads: Ganado exige cliente convertido
  insert into leads (tenant_id, name) values (t1, 'Lead test') returning id into l;
  perform pg_temp.assert(pg_temp.throws(format('update leads set status = ''Ganado'' where id = %L', l), '23514'), 'Nuevo → Ganado no permitido');
  update leads set status = 'Contactado' where id = l;
  update leads set status = 'Calificado' where id = l;
  update leads set status = 'Propuesta Enviada' where id = l;
  update leads set status = 'Negociación' where id = l;
  perform pg_temp.assert(pg_temp.throws(format('update leads set status = ''Ganado'' where id = %L', l), '23514'), 'Ganado sin cliente convertido rechazado');
  update leads set status = 'Ganado', converted_customer_id = c where id = l;

  -- tickets
  insert into tickets (tenant_id, customer_id, subject) values (t1, c, 'Consulta') returning id into tk;
  perform pg_temp.assert(pg_temp.throws(format('update tickets set status = ''Resuelto'' where id = %L', tk), '23514'), 'Abierto → Resuelto no permitido');
  update tickets set status = 'En Progreso' where id = tk;
  update tickets set status = 'Resuelto' where id = tk;
  update tickets set status = 'Cerrado' where id = tk;
  update tickets set status = 'Abierto' where id = tk;
end
$t$;

rollback;
