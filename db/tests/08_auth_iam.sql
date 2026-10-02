-- 08 · Autenticación, sesiones, invitaciones, roles y límites de plan
begin;
\i db/tests/lib/helpers.sql

do $t$
declare
  tn uuid; owner uuid; r record; tok text; tok2 text; rid uuid; sid uuid; n int;
  r_admin uuid; r_vend uuid; r_lect uuid; inv text; u2 uuid; u3 uuid; cr uuid; boot jsonb;
begin
  -- ---- Alta de tenant
  select tenant_id, user_id into tn, owner from signup_tenant('acme-test', 'Acme Test', 'basico', 'Owner@Acme.test', 'Dueña', 'Clave1234');
  perform pg_temp.assert((select status from tenants where id = tn) = 'Prueba', 'tenant nuevo en período de prueba');
  perform pg_temp.assert((select count(*) from roles where tenant_id = tn) = 5, 'roles provisionados');
  perform pg_temp.assert((select is_owner from users where id = owner), 'el alta crea al propietario');
  perform pg_temp.assert((select email from users where id = owner) = 'owner@acme.test', 'email normalizado');
  perform pg_temp.assert((select password_hash from users where id = owner) <> 'Clave1234', 'la contraseña se guarda hasheada');
  perform pg_temp.assert(pg_temp.throws($q$select * from signup_tenant('acme-2','Otro','basico','OWNER@acme.test','X','Clave1234')$q$, '23505'), 'email duplicado');
  perform pg_temp.assert(pg_temp.throws($q$select * from signup_tenant('acme-3','Otro','basico','x@acme.test','X','corta')$q$, '23514'), 'contraseña débil rechazada');
  perform pg_temp.assert(pg_temp.throws($q$select * from signup_tenant('acme-4','Otro','inexistente','y@acme.test','X','Clave1234')$q$, '23503'), 'plan inexistente');

  -- ---- Login
  select * into r from auth_login('OWNER@acme.test', 'Clave1234', 'ua', '10.0.0.1');
  perform pg_temp.assert(r.ok and r.tenant_id = tn and r.user_id = owner and r.refresh_token is not null, 'login correcto');
  tok := r.refresh_token; sid := r.session_id;
  perform pg_temp.assert((select refresh_token_hash from auth_sessions where id = sid) <> tok, 'el refresh token no se guarda en claro');
  perform pg_temp.assert(auth_session_valid(sid), 'sesión válida');
  select * into r from auth_login('owner@acme.test', 'mala');
  perform pg_temp.assert(not r.ok and r.reason = 'credenciales', 'contraseña incorrecta');
  select * into r from auth_login('nadie@acme.test', 'Clave1234');
  perform pg_temp.assert(not r.ok and r.reason = 'credenciales', 'usuario inexistente da el mismo motivo');

  -- bloqueo tras 5 fallos
  for i in 1..4 loop perform 1 from auth_login('owner@acme.test', 'mala'); end loop;
  select * into r from auth_login('owner@acme.test', 'Clave1234');
  perform pg_temp.assert(not r.ok and r.reason = 'bloqueado', 'cuenta bloqueada tras 5 intentos fallidos (correcta incluida)');
  update users set locked_until = now() - interval '1 second' where id = owner;
  select * into r from auth_login('owner@acme.test', 'Clave1234');
  perform pg_temp.assert(r.ok, 'vencido el bloqueo se puede entrar');
  perform pg_temp.assert((select failed_login_count from users where id = owner) = 0, 'el login correcto reinicia el contador');
  perform pg_temp.assert(exists (select 1 from audit_log where entity = 'auth' and user_id = owner and action = 'login_failed'), 'intentos fallidos auditados');

  -- ---- Refresh con rotación y detección de reutilización
  select * into r from auth_refresh(tok);
  perform pg_temp.assert(r.ok and r.refresh_token <> tok, 'refresh rota el token');
  tok2 := r.refresh_token;
  perform pg_temp.assert(not auth_session_valid(sid), 'la sesión anterior queda revocada');
  select * into r from auth_refresh(tok);
  perform pg_temp.assert(not r.ok and r.reason = 'token_reutilizado', 'reutilizar un token rotado se detecta');
  select * into r from auth_refresh(tok2);
  perform pg_temp.assert(not r.ok, 'al detectar reutilización se revocan todas las sesiones');
  select * into r from auth_refresh('basura');
  perform pg_temp.assert(not r.ok and r.reason = 'token_invalido', 'token inventado');

  -- logout
  select * into r from auth_login('owner@acme.test', 'Clave1234'); tok := r.refresh_token; sid := r.session_id;
  perform auth_logout(tok);
  perform pg_temp.assert(not auth_session_valid(sid), 'logout revoca la sesión');

  -- usuario/tenant inactivos
  update tenants set status = 'Suspendido' where id = tn;
  select * into r from auth_login('owner@acme.test', 'Clave1234');
  perform pg_temp.assert(not r.ok and r.reason = 'tenant_inactivo', 'tenant suspendido no entra');
  update tenants set status = 'Activo' where id = tn;

  -- ---- Recuperación de contraseña
  perform pg_temp.assert(auth_request_password_reset('nadie@acme.test') is null, 'email desconocido: sin token, sin error');
  select * into r from auth_login('owner@acme.test', 'Clave1234'); sid := r.session_id;
  tok := auth_request_password_reset('owner@acme.test');
  perform pg_temp.assert(tok is not null, 'token de recuperación');
  perform pg_temp.assert(not auth_reset_password('inventado', 'Nueva1234'), 'token inválido');
  perform pg_temp.assert(pg_temp.throws(format('select auth_reset_password(%L, ''corta'')', tok), '23514'), 'la nueva contraseña también se valida');
  perform pg_temp.assert(auth_reset_password(tok, 'Nueva1234'), 'reset correcto');
  perform pg_temp.assert(not auth_reset_password(tok, 'Otra12345'), 'el token es de un solo uso');
  perform pg_temp.assert(not auth_session_valid(sid), 'el reset cierra las sesiones abiertas');
  perform pg_temp.assert(not (select ok from auth_login('owner@acme.test', 'Clave1234')), 'la contraseña vieja ya no sirve');
  perform pg_temp.assert((select ok from auth_login('owner@acme.test', 'Nueva1234')), 'la nueva sí');

  -- ---- Con contexto de usuario (rol de la aplicación)
  select id into r_admin from roles where tenant_id = tn and code = 'admin';
  select id into r_vend from roles where tenant_id = tn and code = 'vendedor';
  select id into r_lect from roles where tenant_id = tn and code = 'lectura';
  perform set_config('app.tenant_id', tn::text, true);
  perform set_config('app.user_id', owner::text, true);
  set local role nexo_app;

  perform pg_temp.assert(pg_temp.throws('select password_hash from users', '42501'), 'la app no lee password_hash');
  perform pg_temp.assert(pg_temp.throws('select refresh_token_hash from auth_sessions', '42501'), 'la app no lee tokens de sesión');
  perform pg_temp.assert(pg_temp.throws(format('insert into users (tenant_id, email, name, role_id) values (%L,''x@x.com'',''X'',%L)', tn, r_admin), '42501'), 'la app no crea usuarios sin invitación');
  perform pg_temp.assert(pg_temp.throws($q$select * from signup_tenant('z-1','Z','basico','z@z.com','Z','Clave1234')$q$, '42501'), 'la app no da de alta tenants');
  perform pg_temp.assert(pg_temp.throws($q$select platform_change_plan(app_tenant(), 'b2b')$q$, '42501'), 'la app no cambia su propio plan');

  boot := session_bootstrap();
  perform pg_temp.assert(boot #>> '{tenant,plan}' = 'basico' and boot #>> '{user,role}' = 'admin', 'bootstrap con tenant y rol');
  perform pg_temp.assert(boot->'features' ? 'b2c' and not boot->'features' ? 'b2b', 'bootstrap con funciones del plan');
  perform pg_temp.assert(jsonb_array_length(boot->'permissions') = (select count(*) from permissions), 'admin con todos los permisos');

  -- invitaciones y límite del plan Básico (3 usuarios)
  inv := invite_user('vendedor@acme.test', r_vend);
  select tenant_id, user_id into tn, u2 from accept_invitation(inv, 'Vendedor', 'Clave1234');
  perform pg_temp.assert(u2 is not null, 'invitación aceptada');
  perform pg_temp.assert(pg_temp.throws(format('select accept_invitation(%L, ''X'', ''Clave1234'')', inv), 'P0002'), 'la invitación es de un solo uso');
  inv := invite_user('lectura@acme.test', r_lect);
  select user_id into u3 from accept_invitation(inv, 'Lector', 'Clave1234');
  inv := invite_user('cuarto@acme.test', r_lect);
  perform pg_temp.assert(pg_temp.throws(format('select accept_invitation(%L, ''Cuarto'', ''Clave1234'')', inv), '23514', 'hasta 3 usuarios'), 'el plan limita los usuarios');
  perform pg_temp.assert(pg_temp.throws(format('select invite_user(%L, %L)', 'vendedor@acme.test', r_lect), '23505'), 'no se invita un email ya registrado');

  -- reglas sobre usuarios
  perform pg_temp.assert(pg_temp.throws(format('update users set status = ''Suspendido'' where id = %L', owner), '23514'), 'el propietario no se suspende');
  perform pg_temp.assert(pg_temp.throws(format('update users set role_id = %L where id = %L', r_lect, owner), '23514'), 'el propietario no cambia de rol');
  update users set role_id = r_lect where id = u2;
  perform pg_temp.assert((select role_id from users where id = u2) = r_lect, 'un admin cambia el rol de otro usuario');
  update users set role_id = r_vend where id = u2;

  -- roles de sistema intocables; roles propios sin escalada de privilegios
  perform pg_temp.assert(pg_temp.throws(format('delete from roles where id = %L', r_vend), '23514'), 'rol de sistema no se borra');
  perform pg_temp.assert(pg_temp.throws(format('insert into role_permissions (tenant_id, role_id, permission_code) values (%L,%L,''users.delete'')', tn, r_vend), '23514'), 'permisos de rol de sistema no se tocan');
  insert into roles (tenant_id, code, name) values (tn, 'soporte', 'Soporte') returning id into cr;
  insert into role_permissions (tenant_id, role_id, permission_code) values (tn, cr, 'customers.read');
  update users set role_id = cr where id = u3;
  reset role;

  -- el vendedor (sin users.create ni roles.*) no puede invitar ni armar roles
  perform set_config('app.user_id', u2::text, true);
  set local role nexo_app;
  perform pg_temp.assert(pg_temp.throws(format('select invite_user(%L, %L)', 'x@acme.test', r_lect), '42501'), 'el vendedor no puede invitar');
  perform pg_temp.assert(pg_temp.throws(format('update users set role_id = %L where id = %L', r_admin, u3), '42501'), 'el vendedor no se auto-eleva / no asigna Admin');
  perform pg_temp.assert(pg_temp.throws(format('update users set role_id = %L where id = %L', r_lect, u2), '42501'), 'nadie cambia su propio rol');
  perform pg_temp.assert(pg_temp.throws(format('insert into role_permissions (tenant_id, role_id, permission_code) values (%L,%L,''users.delete'')', tn, cr), '42501'), 'no se otorga un permiso que no se tiene');
  insert into role_permissions (tenant_id, role_id, permission_code) values (tn, cr, 'customers.update');
  reset role;

  -- ---- Plataforma: cambio de plan y excepciones
  perform platform_change_plan(tn, 'pro');
  perform pg_temp.assert(tenant_has_feature(tn, 'crm') and (select count(*) from subscriptions where tenant_id = tn and status = 'Activa') = 1, 'cambio de plan: una sola suscripción activa');
  perform platform_set_feature(tn, 'dynamic_rules', true, 'piloto');
  perform platform_set_feature(tn, 'dynamic_rules', false, 'fin del piloto');
  perform pg_temp.assert(not tenant_has_feature(tn, 'dynamic_rules'), 'excepción actualizable (upsert)');
  perform pg_temp.assert(platform_login('admin@nexo.local', 'Demo1234!') is not null and platform_login('admin@nexo.local', 'mala') is null, 'login de plataforma');
end
$t$;

rollback;
