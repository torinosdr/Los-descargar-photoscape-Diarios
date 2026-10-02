// Acceso a PostgreSQL. Cada petición corre en una transacción con el rol nexo_app (sin bypass de RLS)
// y con el contexto del tenant y del usuario fijado con SET LOCAL, como exige el modelo de datos.
import pg from 'pg';
import { HttpError } from './errors.js';

// bigint (int8) y numeric llegan como texto: los importes en unidades menores entran holgados en un Number.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
// date → 'YYYY-MM-DD' sin conversión de zona horaria.
pg.types.setTypeParser(1082, (v) => v);

export function createPool(cfg) {
  const pool = new pg.Pool({ connectionString: cfg.databaseUrl, ssl: cfg.ssl, max: 10, idleTimeoutMillis: 30000 });
  pool.on('error', (e) => console.error('[db] error en conexión inactiva:', e.message));
  return pool;
}

/**
 * Ejecuta fn(client) dentro de una transacción.
 * ctx = { tid, uid, sid } fija app.tenant_id / app.user_id y verifica que la sesión siga vigente
 * (un logout o un cambio de contraseña invalidan el access token en la siguiente petición).
 */
export async function withTx(pool, ctx, fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query('set local role nexo_app');
    if (ctx) {
      const r = await c.query(
        "select set_config('app.tenant_id', $1, true), set_config('app.user_id', $2, true), auth_session_valid($3) as ok",
        [ctx.tid, ctx.uid, ctx.sid]
      );
      if (!r.rows[0].ok) throw new HttpError(401, 'sesion_invalida', 'La sesión expiró o fue cerrada');
    }
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
