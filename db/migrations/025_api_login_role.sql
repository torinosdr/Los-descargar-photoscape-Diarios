-- 025 · Usuario de conexión del servidor HTTP.
-- nexo_api puede iniciar sesión pero no hereda nada: el servidor hace SET LOCAL ROLE nexo_app en cada transacción,
-- así que una consulta que se olvide de ese paso no ve ninguna tabla. Se crea sin contraseña (no puede conectarse);
-- la contraseña se fija aparte y nunca se versiona:  alter role nexo_api password '...';
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nexo_api') then
    create role nexo_api login noinherit;
  end if;
end $$;
grant nexo_app to nexo_api;
