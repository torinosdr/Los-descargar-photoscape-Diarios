-- 07 · Auditoría, feature flags, provisión de tenants y reglas de datos
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  t1 uuid := pg_temp.tid('demo-retail'); t2 uuid := pg_temp.tid('demo-distribuidora');
  tn uuid; plan_basico uuid; n int; a record; c uuid; u uuid; pid uuid; f uuid;
begin
  -- ---- Auditoría
  insert into customers (tenant_id, customer_type, person_type, first_name) values (t1, 'B2C', 'Persona Física', 'Auditado') returning id into c;
  update customers set first_name = 'Auditado 2' where id = c;
  select * into a from audit_log where entity_id = c and action = 'update' order by created_at desc limit 1;
  perform pg_temp.assert(a.tenant_id = t1 and a.old_value->>'first_name' = 'Auditado' and a.new_value->>'first_name' = 'Auditado 2', 'auditoría guarda valores anterior y nuevo');
  perform pg_temp.assert(exists (select 1 from audit_log where entity_id = c and action = 'create'), 'auditoría de alta');
  update customers set deleted_at = now() where id = c;
  perform pg_temp.assert(exists (select 1 from audit_log where entity_id = c and action in ('delete','soft_delete','archive')), 'baja lógica auditada');
  select id into u from users where tenant_id = t1 limit 1;
  update users set name = name || '!' where id = u;
  perform pg_temp.assert(not exists (select 1 from audit_log where entity_id = u and (old_value ? 'password_hash' or new_value ? 'password_hash')), 'la auditoría no guarda password_hash');
  perform pg_temp.assert(pg_temp.throws('update audit_log set action = ''x''', '23001'), 'auditoría inmutable');

  -- ---- Feature flags: plan + excepciones por tenant
  perform pg_temp.assert(tenant_has_feature(t1, 'b2c'), 'el plan incluye b2c');
  select id into plan_basico from plans where code = 'basico';
  insert into tenants (slug, name, plan_id) values ('test-basico', 'Test Básico', plan_basico) returning id into tn;
  perform pg_temp.assert(tenant_has_feature(tn, 'b2c') and not tenant_has_feature(tn, 'b2b'), 'Básico: b2c sí, b2b no');
  select id into f from features where code = 'b2b';
  insert into tenant_feature_overrides (tenant_id, feature_id, enabled) values (tn, f, true);
  perform pg_temp.assert(tenant_has_feature(tn, 'b2b'), 'excepción habilita b2b');
  update tenant_feature_overrides set enabled = false where tenant_id = tn and feature_id = f;
  select id into f from features where code = 'b2c';
  insert into tenant_feature_overrides (tenant_id, feature_id, enabled) values (tn, f, false);
  perform pg_temp.assert(not tenant_has_feature(tn, 'b2c'), 'excepción puede deshabilitar una función del plan');
  perform pg_temp.assert(not exists (select 1 from v_tenant_features where tenant_id = tn and feature_code = 'b2c' and enabled), 'v_tenant_features refleja la excepción');
  update tenants set plan_id = (select id from plans where code = 'b2b') where id = tn;
  perform pg_temp.assert(tenant_has_feature(tn, 'multi_warehouse'), 'cambiar de plan activa funciones');

  -- ---- Provisión automática del tenant nuevo
  select count(*) into n from roles where tenant_id = tn;           perform pg_temp.assert(n = 5, '5 roles de sistema, hay ' || n);
  select count(*) into n from document_sequences where tenant_id = tn; perform pg_temp.assert(n = 15, '15 series de numeración, hay ' || n);
  select count(*) into n from tax_rates where tenant_id = tn;        perform pg_temp.assert(n >= 1, 'impuestos iniciales');
  select count(*) into n from warehouses where tenant_id = tn and is_default; perform pg_temp.assert(n = 1, 'depósito por defecto');
  select count(*) into n from price_lists where tenant_id = tn;      perform pg_temp.assert(n >= 1, 'lista de precios por defecto');
  select count(*) into n from role_permissions rp join roles r on r.id = rp.role_id where r.tenant_id = tn and r.code = 'lectura' and rp.permission_code like '%.delete';
  perform pg_temp.assert(n = 0, 'Solo Lectura no tiene permisos de borrado');
  select count(*) into n from role_permissions rp join roles r on r.id = rp.role_id where r.tenant_id = tn and r.code = 'admin';
  perform pg_temp.assert(n = (select count(*) from permissions), 'Admin tiene todos los permisos');

  -- ---- Reglas de datos
  perform pg_temp.assert(pg_temp.throws(format('insert into users (tenant_id, email, name, role_id) select %L, email, ''Dup'', role_id from users where tenant_id = %L limit 1', t2, t1), '23505'), 'el email de usuario es único globalmente');
  perform pg_temp.assert(pg_temp.throws(format('insert into customers (tenant_id, customer_type, person_type, company_name) values (%L,''B2C'',''Empresa'',''X'')', t1), '23514'), 'B2C no puede ser Empresa');
  perform pg_temp.assert(pg_temp.throws(format('insert into customers (tenant_id, customer_type, person_type) values (%L,''B2B'',''Empresa'')', t1), '23514'), 'Empresa exige razón social');
  insert into products (tenant_id, sku, name, currency, sale_price_minor) values (t1, 'DUP-1', 'A', 'ARS', 1) returning id into pid;
  perform pg_temp.assert(pg_temp.throws(format('insert into products (tenant_id, sku, name, currency, sale_price_minor) values (%L,''DUP-1'',''B'',''ARS'',1)', t1), '23505'), 'SKU único por tenant');
  update products set deleted_at = now() where id = pid;
  insert into products (tenant_id, sku, name, currency, sale_price_minor) values (t1, 'DUP-1', 'C', 'ARS', 1);
  perform pg_temp.assert(true, 'SKU reutilizable tras baja lógica');
  insert into products (tenant_id, sku, name, currency, sale_price_minor) values (t2, 'DUP-1', 'D', 'ARS', 1);
  perform pg_temp.assert(true, 'mismo SKU permitido en otro tenant');
end
$t$;

rollback;
