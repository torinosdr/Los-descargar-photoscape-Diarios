-- 01 · Aislamiento entre tenants (RLS, claves compuestas, permisos de base de datos)
begin;

\i db/tests/lib/helpers.sql

-- 1) Con el contexto del tenant 1 solo se ven filas del tenant 1
do $t$
declare t1 uuid; t2 uuid; n int;
begin
  select id into t1 from tenants where slug = 'demo-retail';
  select id into t2 from tenants where slug = 'demo-distribuidora';
  perform set_config('app.tenant_id', t1::text, true);
  set local role nexo_app;
  select count(*) into n from customers;                         perform pg_temp.assert(n = 1, 'T1 ve solo su cliente, ve ' || n);
  select count(*) into n from customers where tenant_id = t2;    perform pg_temp.assert(n = 0, 'T1 no ve clientes de T2');
  select count(*) into n from sales where tenant_id <> t1;       perform pg_temp.assert(n = 0, 'T1 no ve ventas de T2');
  select count(*) into n from v_customer_360;                    perform pg_temp.assert(n = 1, 'La vista Customer 360 respeta RLS');
  select count(*) into n from audit_log where tenant_id <> t1;   perform pg_temp.assert(n = 0, 'La auditoría respeta RLS');
  select count(*) into n from tenants;                           perform pg_temp.assert(n = 1, 'Un tenant solo ve su propia fila de tenants');
  select count(*) into n from permissions;                       perform pg_temp.assert(n > 0, 'El catálogo global de permisos es legible');
  reset role;
end
$t$;

-- 2) No se puede insertar ni mover filas a otro tenant; sin contexto no se ve nada
do $t$
declare t1 uuid; t2 uuid; n int; ok boolean;
begin
  select id into t1 from tenants where slug = 'demo-retail';
  select id into t2 from tenants where slug = 'demo-distribuidora';
  perform set_config('app.tenant_id', t1::text, true);
  set local role nexo_app;
  ok := pg_temp.throws(format(
    'insert into customers (tenant_id, customer_type, person_type, first_name) values (%L, ''B2C'', ''Persona Física'', ''Intruso'')', t2),
    '42501');
  perform pg_temp.assert(ok, 'INSERT en otro tenant bloqueado por RLS');
  ok := pg_temp.throws(format('update customers set tenant_id = %L', t2), '23000');
  perform pg_temp.assert(ok, 'tenant_id no se puede cambiar');
  update customers set first_name = 'Hack' where tenant_id = t2;
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'UPDATE sobre filas de otro tenant no afecta ninguna fila');
  delete from customers where tenant_id = t2;
  get diagnostics n = row_count;
  perform pg_temp.assert(n = 0, 'DELETE sobre filas de otro tenant no afecta ninguna fila');

  perform set_config('app.tenant_id', '', true);
  select count(*) into n from customers;
  perform pg_temp.assert(n = 0, 'Sin contexto de tenant no se ve ninguna fila, se ven ' || n);
  reset role;
end
$t$;

-- 3) La propia base impide referenciar datos de otro tenant (FK compuesta), incluso siendo superusuario
do $t$
declare t1 uuid; t2 uuid; c2 uuid; w1 uuid;
begin
  select id into t1 from tenants where slug = 'demo-retail';
  select id into t2 from tenants where slug = 'demo-distribuidora';
  select id into c2 from customers where tenant_id = t2 and display_name = 'Distribuidora Norte';
  select id into w1 from warehouses where tenant_id = t1 and is_default;
  perform pg_temp.assert(pg_temp.throws(format(
    'insert into sales (tenant_id, customer_id, currency, warehouse_id) values (%L, %L, ''ARS'', %L)', t1, c2, w1),
    '23503'), 'Una venta de T1 no puede apuntar a un cliente de T2');
  perform pg_temp.assert(pg_temp.throws(format(
    'insert into customer_contacts (tenant_id, customer_id, name) values (%L, %L, ''X'')', t1, c2),
    '23503'), 'Un contacto de T1 no puede colgar de un cliente de T2');
  perform pg_temp.assert(pg_temp.throws(format('update customers set tenant_id = %L where tenant_id = %L', t2, t1),
    '23000'), 'tenant_id es inmutable incluso para el dueño de la base');
end
$t$;

-- 4) Permisos de base de datos del rol de la aplicación
do $t$
declare t1 uuid; ok boolean;
begin
  select id into t1 from tenants where slug = 'demo-retail';
  perform set_config('app.tenant_id', t1::text, true);
  set local role nexo_app;
  perform pg_temp.assert(pg_temp.throws('select * from platform_admins', '42501'), 'La app no lee platform_admins');
  perform pg_temp.assert(pg_temp.throws('update tenants set plan_id = plan_id', '42501'), 'La app no cambia el plan del tenant');
  perform pg_temp.assert(pg_temp.throws('delete from audit_log', '42501'), 'La app no borra auditoría');
  perform pg_temp.assert(pg_temp.throws('delete from stock_movements', '42501'), 'La app no borra movimientos de stock');
  perform pg_temp.assert(pg_temp.throws('update wallet_transactions set notes = ''x''', '42501'), 'La app no edita la billetera');
  perform pg_temp.assert(pg_temp.throws('insert into subscriptions (tenant_id, plan_id) select id, plan_id from tenants', '42501'), 'La app no crea suscripciones');
  reset role;
end
$t$;

rollback;
