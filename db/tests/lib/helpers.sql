-- Helpers de pruebas (funciones temporales de la sesión)
create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FALLÓ: %', msg; end if; end $$;

-- ¿La sentencia falla con el SQLSTATE esperado? (y opcionalmente el mensaje contiene un texto)
create function pg_temp.throws(stmt text, state text, msg_like text default null) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return sqlstate = state and (msg_like is null or sqlerrm like '%' || msg_like || '%');
end $$;

create function pg_temp.tid(slug_ text) returns uuid language sql as $$ select id from tenants where slug = slug_ $$;
