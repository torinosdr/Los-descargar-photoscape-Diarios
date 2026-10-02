-- 023 · Hosting gestionado (Supabase): los roles públicos de la API no deben ejecutar funciones ni usar el esquema.
-- Condicional: en un PostgreSQL propio no existen anon/authenticated.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') and exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke execute on all functions in schema public from anon, authenticated;
    revoke usage on schema public from anon, authenticated;
  end if;
end $$;
