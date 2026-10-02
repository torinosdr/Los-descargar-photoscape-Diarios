-- 024 · Políticas privadas de notificaciones y auditoría (equivalente a lo final de 019 y 021).
-- Idempotente: en una base nueva 019/021 ya las crearon; en Supabase el conector había salteado esos DROP POLICY.
drop policy if exists tenant_isolation on notifications;
drop policy if exists own_select on notifications;
drop policy if exists own_update on notifications;
drop policy if exists tenant_insert on notifications;
create policy own_select on notifications for select using (tenant_id = app_tenant() and user_id = app_user());
create policy own_update on notifications for update using (tenant_id = app_tenant() and user_id = app_user()) with check (tenant_id = app_tenant() and user_id = app_user());
create policy tenant_insert on notifications for insert with check (tenant_id = app_tenant());
drop policy if exists tenant_isolation on audit_log;
drop policy if exists audit_read on audit_log;
drop policy if exists audit_write on audit_log;
create policy audit_read on audit_log for select using (tenant_id = app_tenant() and has_permission('audit.read'));
create policy audit_write on audit_log for insert with check (tenant_id = app_tenant());
