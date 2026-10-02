-- Fase 2 · Autenticación, usuarios, roles/permisos, alta de tenants y planes (todo a nivel base de datos).
-- El backend (HTTP/JWT) solo orquesta estas funciones; las garantías viven aquí.

-- ===================== Columnas y límites =====================
alter table users add column failed_login_count int not null default 0,
                  add column locked_until timestamptz,
                  add column password_changed_at timestamptz;
update plans set max_users = case code when 'basico' then 3 when 'pro' then 10 else null end;  -- null = ilimitado

-- ===================== Utilidades =====================
create function sha256_hex(p text) returns text language sql immutable
as $$ select encode(digest(p, 'sha256'), 'hex') $$;

create function new_token() returns text language sql volatile
as $$ select encode(gen_random_bytes(32), 'hex') $$;

create function hash_password(p text) returns text language plpgsql volatile as $$
begin
  if p is null or length(p) < 8 or p !~ '[A-Za-z]' or p !~ '[0-9]' then
    raise exception 'La contraseña debe tener al menos 8 caracteres, con letras y números' using errcode = 'check_violation';
  end if;
  return crypt(p, gen_salt('bf', 10));
end $$;

-- ===================== Permisos del usuario actual =====================
create function user_permissions(p_user uuid) returns setof text language sql stable security definer set search_path = public as $$
  select rp.permission_code from users u
    join role_permissions rp on rp.tenant_id = u.tenant_id and rp.role_id = u.role_id
   where u.id = p_user and u.status = 'Activo' and u.deleted_at is null
$$;

-- ¿El usuario del contexto (app.user_id) tiene este permiso y su tenant tiene la función activa?
create function has_permission(p_code text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from users u
                  join role_permissions rp on rp.tenant_id = u.tenant_id and rp.role_id = u.role_id
                 where u.id = app_user() and u.tenant_id = app_tenant()
                   and u.status = 'Activo' and u.deleted_at is null and rp.permission_code = p_code)
$$;

create function require_permission(p_code text) returns void language plpgsql stable as $$
begin
  if not has_permission(p_code) then
    raise exception 'Permiso requerido: %', p_code using errcode = 'insufficient_privilege';
  end if;
end $$;

-- ===================== Login / sesiones =====================
create function auth_audit(p_tenant uuid, p_user uuid, p_action text, p_detail jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (tenant_id, user_id, entity, entity_id, action, new_value) values (p_tenant, p_user, 'auth', p_user, p_action, p_detail)
$$;

create function auth_login(p_email text, p_password text, p_user_agent text default null, p_ip inet default null)
returns table (ok boolean, reason text, tenant_id uuid, user_id uuid, session_id uuid, refresh_token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare u users; t tenants; v_token text; v_sid uuid;
begin
  select * into u from users where lower(users.email) = lower(trim(p_email)) and deleted_at is null;
  if not found then
    return query select false, 'credenciales', null::uuid, null::uuid, null::uuid, null::text; return;
  end if;
  select * into t from tenants where id = u.tenant_id;
  if u.locked_until is not null and u.locked_until > now() then
    perform auth_audit(u.tenant_id, u.id, 'login_blocked');
    return query select false, 'bloqueado', null::uuid, null::uuid, null::uuid, null::text; return;
  end if;
  if u.password_hash is null or u.password_hash <> crypt(p_password, u.password_hash) then
    update users set failed_login_count = failed_login_count + 1,
                     locked_until = case when failed_login_count + 1 >= 5 then now() + interval '15 minutes' else null end
     where id = u.id;
    perform auth_audit(u.tenant_id, u.id, 'login_failed');
    return query select false, 'credenciales', null::uuid, null::uuid, null::uuid, null::text; return;
  end if;
  if u.status <> 'Activo' then
    return query select false, 'usuario_inactivo', null::uuid, null::uuid, null::uuid, null::text; return;
  end if;
  if t.deleted_at is not null or t.status in ('Suspendido', 'Cancelado') then
    return query select false, 'tenant_inactivo', null::uuid, null::uuid, null::uuid, null::text; return;
  end if;
  v_token := new_token();
  insert into auth_sessions (tenant_id, user_id, refresh_token_hash, user_agent, ip, expires_at)
  values (u.tenant_id, u.id, sha256_hex(v_token), p_user_agent, p_ip, now() + interval '30 days') returning id into v_sid;
  update users set failed_login_count = 0, locked_until = null, last_login_at = now() where id = u.id;
  perform auth_audit(u.tenant_id, u.id, 'login');
  return query select true, null::text, u.tenant_id, u.id, v_sid, v_token;
end $$;

-- Rota el refresh token. Si se reutiliza uno ya rotado/revocado, se revoca toda la familia (robo de token).
create function auth_refresh(p_token text)
returns table (ok boolean, reason text, tenant_id uuid, user_id uuid, session_id uuid, refresh_token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare s auth_sessions; u users; t tenants; v_new text; v_sid uuid;
begin
  select * into s from auth_sessions where refresh_token_hash = sha256_hex(p_token) for update;
  if not found then
    return query select false, 'token_invalido', null::uuid, null::uuid, null::uuid, null::text; return;
  end if;
  if s.revoked_at is not null then
    update auth_sessions set revoked_at = now() where user_id = s.user_id and revoked_at is null;
    perform auth_audit(s.tenant_id, s.user_id, 'refresh_reuse_detected');
    return query select false, 'token_reutilizado', null::uuid, null::uuid, null::uuid, null::text; return;
  end if;
  select * into u from users where id = s.user_id;
  select * into t from tenants where id = s.tenant_id;
  if s.expires_at < now() or u.status <> 'Activo' or u.deleted_at is not null or t.status in ('Suspendido','Cancelado') or t.deleted_at is not null then
    update auth_sessions set revoked_at = now() where id = s.id;
    return query select false, 'sesion_expirada', null::uuid, null::uuid, null::uuid, null::text; return;
  end if;
  update auth_sessions set revoked_at = now() where id = s.id;
  v_new := new_token();
  insert into auth_sessions (tenant_id, user_id, refresh_token_hash, user_agent, ip, expires_at)
  values (s.tenant_id, s.user_id, sha256_hex(v_new), s.user_agent, s.ip, s.expires_at) returning id into v_sid;
  return query select true, null::text, s.tenant_id, s.user_id, v_sid, v_new;
end $$;

create function auth_logout(p_token text) returns void language sql security definer set search_path = public as $$
  update auth_sessions set revoked_at = now() where refresh_token_hash = sha256_hex(p_token) and revoked_at is null
$$;

create function auth_logout_all(p_user uuid) returns void language sql security definer set search_path = public as $$
  update auth_sessions set revoked_at = now() where user_id = p_user and revoked_at is null
$$;

-- ¿La sesión sigue vigente? (el backend lo consulta al validar un access token con sid)
create function auth_session_valid(p_session uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth_sessions s join users u on u.id = s.user_id
                  where s.id = p_session and s.revoked_at is null and s.expires_at > now()
                    and u.status = 'Activo' and u.deleted_at is null)
$$;

-- ===================== Recuperación de contraseña =====================
-- Devuelve el token en claro (el backend lo envía por email); siempre responde igual exista o no el email.
create function auth_request_password_reset(p_email text) returns text
language plpgsql security definer set search_path = public as $$
declare u users; v_token text;
begin
  select * into u from users where lower(email) = lower(trim(p_email)) and deleted_at is null and status = 'Activo';
  if not found then return null; end if;
  update password_reset_tokens set used_at = now() where user_id = u.id and used_at is null;
  v_token := new_token();
  insert into password_reset_tokens (tenant_id, user_id, token_hash, expires_at)
  values (u.tenant_id, u.id, sha256_hex(v_token), now() + interval '1 hour');
  perform auth_audit(u.tenant_id, u.id, 'password_reset_requested');
  return v_token;
end $$;

create function auth_reset_password(p_token text, p_new_password text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r password_reset_tokens;
begin
  select * into r from password_reset_tokens where token_hash = sha256_hex(p_token) and used_at is null and expires_at > now() for update;
  if not found then return false; end if;
  update users set password_hash = hash_password(p_new_password), password_changed_at = now(),
                   failed_login_count = 0, locked_until = null where id = r.user_id;
  update password_reset_tokens set used_at = now() where id = r.id;
  update auth_sessions set revoked_at = now() where user_id = r.user_id and revoked_at is null;
  perform auth_audit(r.tenant_id, r.user_id, 'password_reset');
  return true;
end $$;

-- Cambio de contraseña del usuario autenticado (exige la actual).
create function auth_change_password(p_current text, p_new text) returns void
language plpgsql security definer set search_path = public as $$
declare u users;
begin
  select * into u from users where id = app_user() and tenant_id = app_tenant();
  if not found or u.password_hash <> crypt(p_current, u.password_hash) then
    raise exception 'La contraseña actual no es correcta' using errcode = 'insufficient_privilege';
  end if;
  update users set password_hash = hash_password(p_new), password_changed_at = now() where id = u.id;
  perform auth_audit(u.tenant_id, u.id, 'password_changed');
end $$;

-- ===================== Usuarios: invitaciones y límites =====================
create function enforce_user_limit() returns trigger language plpgsql as $$
declare v_max int; v_n int;
begin
  if new.deleted_at is not null or new.status = 'Suspendido' then return new; end if;
  select pl.max_users into v_max from tenants t join plans pl on pl.id = t.plan_id where t.id = new.tenant_id;
  if v_max is null then return new; end if;
  select count(*) into v_n from users where tenant_id = new.tenant_id and deleted_at is null and status <> 'Suspendido'
     and id is distinct from new.id;
  if v_n >= v_max then
    raise exception 'El plan permite hasta % usuarios activos', v_max using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger g_user_limit before insert or update of status, deleted_at on users for each row execute function enforce_user_limit();

-- El dueño no se suspende/borra/cambia de rol; nadie se cambia a sí mismo el rol; solo un Admin asigna el rol Admin.
create function guard_user_changes() returns trigger language plpgsql as $$
declare v_actor_role text; v_new_role text;
begin
  if tg_op = 'UPDATE' then
    if old.is_owner and (new.status <> 'Activo' or new.deleted_at is not null or new.role_id <> old.role_id) then
      raise exception 'El usuario propietario no puede suspenderse, borrarse ni cambiar de rol' using errcode = 'check_violation';
    end if;
    if new.role_id <> old.role_id and app_user() is not null then
      if app_user() = new.id then
        raise exception 'No puedes cambiar tu propio rol' using errcode = 'insufficient_privilege';
      end if;
      select r.code into v_new_role from roles r where r.id = new.role_id;
      select r.code into v_actor_role from users a join roles r on r.id = a.role_id where a.id = app_user();
      if v_new_role = 'admin' and v_actor_role is distinct from 'admin' then
        raise exception 'Solo un Admin puede asignar el rol Admin' using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger h_guard_user before update on users for each row execute function guard_user_changes();

create function invite_user(p_email text, p_role_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text; v_role roles; v_actor_role text;
begin
  perform require_permission('users.create');
  select * into v_role from roles where id = p_role_id and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Rol inexistente' using errcode = 'foreign_key_violation'; end if;
  select r.code into v_actor_role from users a join roles r on r.id = a.role_id where a.id = app_user();
  if v_role.code = 'admin' and v_actor_role <> 'admin' then
    raise exception 'Solo un Admin puede invitar con rol Admin' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from users where lower(email) = lower(trim(p_email)) and deleted_at is null) then
    raise exception 'El email ya está registrado' using errcode = 'unique_violation';
  end if;
  update user_invitations set expires_at = now() where tenant_id = app_tenant() and lower(email) = lower(trim(p_email)) and accepted_at is null;
  v_token := new_token();
  insert into user_invitations (tenant_id, email, role_id, token_hash, invited_by, expires_at)
  values (app_tenant(), lower(trim(p_email)), p_role_id, sha256_hex(v_token), app_user(), now() + interval '7 days');
  return v_token;
end $$;

create function accept_invitation(p_token text, p_name text, p_password text)
returns table (tenant_id uuid, user_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare i user_invitations; v_uid uuid;
begin
  select * into i from user_invitations where token_hash = sha256_hex(p_token) and accepted_at is null and expires_at > now() for update;
  if not found then raise exception 'Invitación inválida o vencida' using errcode = 'no_data_found'; end if;
  insert into users (tenant_id, email, name, password_hash, role_id, status, password_changed_at)
  values (i.tenant_id, i.email, p_name, hash_password(p_password), i.role_id, 'Activo', now()) returning id into v_uid;
  update user_invitations set accepted_at = now() where id = i.id;
  perform auth_audit(i.tenant_id, v_uid, 'invitation_accepted');
  return query select i.tenant_id, v_uid;
end $$;

-- ¿Estamos dentro de una petición de usuario (y no aprovisionando un tenant)?
create function in_user_request() returns boolean language sql stable as $$
  select app_user() is not null and coalesce(current_setting('app.provisioning', true), '') <> 'on'
$$;

-- ===================== Roles personalizados =====================
-- Los roles de sistema no se tocan desde la app; los personalizados se gestionan con permiso roles.*
create function guard_roles() returns trigger language plpgsql as $$
begin
  if in_user_request() then
    if tg_op = 'DELETE' and old.is_system then
      raise exception 'Los roles de sistema no se pueden borrar' using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' and old.is_system and (new.code <> old.code or new.is_system <> old.is_system) then
      raise exception 'Los roles de sistema no se pueden modificar' using errcode = 'check_violation';
    end if;
    if tg_op = 'INSERT' and new.is_system then
      raise exception 'No se pueden crear roles de sistema' using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' and new.deleted_at is not null and exists (select 1 from users where role_id = new.id and deleted_at is null) then
      raise exception 'El rol tiene usuarios asignados' using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger h_guard_roles before insert or update or delete on roles for each row execute function guard_roles();

create function guard_role_permissions() returns trigger language plpgsql as $$
declare v_sys boolean; v_actor_perm boolean;
begin
  if in_user_request() then
    select is_system into v_sys from roles where id = coalesce(new.role_id, old.role_id) and tenant_id = coalesce(new.tenant_id, old.tenant_id);
    if v_sys then
      raise exception 'Los permisos de un rol de sistema no se pueden modificar' using errcode = 'check_violation';
    end if;
    -- no se puede otorgar un permiso que uno mismo no tiene (evita escalada de privilegios)
    if tg_op = 'INSERT' and not has_permission(new.permission_code) then
      raise exception 'No puedes otorgar el permiso % porque no lo tienes', new.permission_code using errcode = 'insufficient_privilege';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger h_guard_rp before insert or update or delete on role_permissions for each row execute function guard_role_permissions();

-- ===================== Contexto para el frontend =====================
create function session_bootstrap() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  select jsonb_build_object(
    'user', jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email, 'locale', u.locale, 'timezone', u.timezone,
                               'is_owner', u.is_owner, 'role', ro.code, 'role_name', ro.name),
    'tenant', jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name, 'status', t.status, 'plan', pl.code,
                                 'base_currency', t.base_currency, 'default_locale', t.default_locale,
                                 'timezone', t.timezone, 'country', t.country),
    'permissions', coalesce((select jsonb_agg(rp.permission_code order by rp.permission_code) from role_permissions rp
                              where rp.tenant_id = u.tenant_id and rp.role_id = u.role_id), '[]'::jsonb),
    'features', coalesce((select jsonb_agg(f.code order by f.code) from features f where tenant_has_feature(t.id, f.code)), '[]'::jsonb))
    into r
    from users u join tenants t on t.id = u.tenant_id join plans pl on pl.id = t.plan_id join roles ro on ro.id = u.role_id
   where u.id = app_user() and u.tenant_id = app_tenant() and u.deleted_at is null;
  return r;
end $$;

-- ===================== Plataforma: alta de tenants, planes, excepciones =====================
create function signup_tenant(p_slug text, p_name text, p_plan text, p_owner_email text, p_owner_name text, p_password text,
                              p_country char(2) default 'AR', p_currency char(3) default 'ARS')
returns table (tenant_id uuid, user_id uuid)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_plan uuid; v_tid uuid; v_uid uuid; v_admin uuid;
begin
  select id into v_plan from plans where code = p_plan and active;
  if v_plan is null then raise exception 'Plan inexistente: %', p_plan using errcode = 'foreign_key_violation'; end if;
  if exists (select 1 from users where lower(email) = lower(trim(p_owner_email)) and deleted_at is null) then
    raise exception 'El email ya está registrado' using errcode = 'unique_violation';
  end if;
  insert into tenants (slug, name, plan_id, status, country, base_currency, trial_ends_at)
  values (lower(p_slug), p_name, v_plan, 'Prueba', p_country, p_currency, now() + interval '14 days') returning id into v_tid;
  select id into v_admin from roles where tenant_id = v_tid and code = 'admin';
  insert into users (tenant_id, email, name, password_hash, role_id, is_owner, status, password_changed_at)
  values (v_tid, lower(trim(p_owner_email)), p_owner_name, hash_password(p_password), v_admin, true, 'Activo', now()) returning id into v_uid;
  insert into subscriptions (tenant_id, plan_id, status, period_start) values (v_tid, v_plan, 'Activa', current_date);
  return query select v_tid, v_uid;
end $$;

create function platform_change_plan(p_tenant uuid, p_plan text) returns void
language plpgsql security definer set search_path = public as $$
declare v_plan plans; v_n int;
begin
  select * into v_plan from plans where code = p_plan and active;
  if v_plan.id is null then raise exception 'Plan inexistente: %', p_plan using errcode = 'foreign_key_violation'; end if;
  select count(*) into v_n from users where tenant_id = p_tenant and deleted_at is null and status <> 'Suspendido';
  if v_plan.max_users is not null and v_n > v_plan.max_users then
    raise exception 'El tenant tiene % usuarios activos y el plan % permite %', v_n, p_plan, v_plan.max_users using errcode = 'check_violation';
  end if;
  update tenants set plan_id = v_plan.id where id = p_tenant;
  update subscriptions set status = 'Cancelada', period_end = current_date where tenant_id = p_tenant and status = 'Activa';
  insert into subscriptions (tenant_id, plan_id, status, period_start) values (p_tenant, v_plan.id, 'Activa', current_date);
end $$;

create function platform_set_feature(p_tenant uuid, p_feature text, p_enabled boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_f uuid;
begin
  select id into v_f from features where code = p_feature;
  if v_f is null then raise exception 'Función inexistente: %', p_feature using errcode = 'foreign_key_violation'; end if;
  insert into tenant_feature_overrides (tenant_id, feature_id, enabled, reason) values (p_tenant, v_f, p_enabled, p_reason)
  on conflict (tenant_id, feature_id) where deleted_at is null do update set enabled = excluded.enabled, reason = excluded.reason;
end $$;

create function platform_login(p_email text, p_password text) returns uuid
language plpgsql security definer set search_path = public as $$
declare a platform_admins;
begin
  select * into a from platform_admins where lower(email) = lower(trim(p_email)) and deleted_at is null and status = 'Activo';
  if not found or a.password_hash <> crypt(p_password, a.password_hash) then return null; end if;
  update platform_admins set last_login_at = now() where id = a.id;
  return a.id;
end $$;

-- ===================== Permisos de ejecución y columnas sensibles =====================
revoke execute on all functions in schema public from public;
grant execute on all functions in schema public to nexo_platform, nexo_app;
-- Lo que solo puede hacer la plataforma (o las funciones SECURITY DEFINER internamente):
revoke execute on function signup_tenant(text, text, text, text, text, text, char, char), platform_change_plan(uuid, text),
  platform_set_feature(uuid, text, boolean, text), platform_login(text, text), hash_password(text), new_token(),
  auth_audit(uuid, uuid, text, jsonb), user_permissions(uuid), provision_tenant(uuid) from nexo_app;

-- La app nunca lee hashes ni secretos, ni crea/borrea usuarios directamente (se hace por invitación).
revoke select on users from nexo_app;
grant select (id, tenant_id, email, name, role_id, status, is_owner, locale, timezone, avatar_url, last_login_at,
              created_at, updated_at, created_by, updated_by, deleted_at) on users to nexo_app;
revoke insert, update, delete on users from nexo_app;
grant update (name, role_id, status, locale, timezone, avatar_url, deleted_at) on users to nexo_app;
revoke select, insert, update, delete on auth_sessions, password_reset_tokens, user_invitations from nexo_app;
grant select (id, tenant_id, email, role_id, invited_by, expires_at, accepted_at, created_at) on user_invitations to nexo_app;
