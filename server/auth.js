// Login, refresco y cierre de sesión. Las garantías (bloqueo por intentos, rotación de tokens,
// detección de reutilización) viven en la base (migración 014); aquí solo se emiten los JWT de acceso.
//  - Access token: JWT HS256 de vida corta (15 min) que el frontend guarda en memoria y manda como Bearer.
//  - Refresh token: opaco, en cookie httpOnly + SameSite=Strict limitada a /api/auth; la base guarda solo su hash.
import { Router } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import rateLimit from 'express-rate-limit';
import { withTx } from './db.js';
import { HttpError } from './errors.js';

const COOKIE = 'nexo_rt';
const REFRESH_DAYS = 30;

export function authRouter({ pool, cfg }) {
  const r = Router();
  const key = new TextEncoder().encode(cfg.jwtSecret);
  const cookieOpts = { httpOnly: true, sameSite: 'strict', secure: cfg.secureCookies, path: '/api/auth' };

  const issue = (row) => new SignJWT({ tid: row.tenant_id, sid: row.session_id })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(row.user_id)
    .setIssuedAt()
    .setExpirationTime(`${cfg.accessTtlSeconds}s`)
    .sign(key);

  async function respondWithSession(res, row) {
    res.cookie(COOKIE, row.refresh_token, { ...cookieOpts, maxAge: REFRESH_DAYS * 864e5 });
    const ctx = { tid: row.tenant_id, uid: row.user_id, sid: row.session_id };
    const session = await withTx(pool, ctx, async (c) => (await c.query('select session_bootstrap() as s')).rows[0].s);
    res.json({ access_token: await issue(row), token_type: 'Bearer', expires_in: cfg.accessTtlSeconds, session });
  }

  // Las cookies SameSite=Strict ya no viajan desde otros sitios; además se rechaza un Origin ajeno.
  function sameOrigin(req) {
    const o = req.get('origin');
    if (o && new URL(o).host !== req.get('host')) throw new HttpError(403, 'origen_invalido', 'Origen no permitido');
  }

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: cfg.loginRateLimit, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'demasiados_intentos', message: 'Demasiados intentos de inicio de sesión. Probá de nuevo en unos minutos.' }
  });

  r.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      throw new HttpError(400, 'datos_incompletos', 'Ingresá email y contraseña');
    }
    const row = await withTx(pool, null, async (c) => (await c.query(
      'select * from auth_login($1, $2, $3, $4::inet)',
      [email, password, (req.get('user-agent') || '').slice(0, 300), req.ip || null]
    )).rows[0]);
    if (!row.ok) {
      if (row.reason === 'bloqueado') throw new HttpError(423, 'bloqueado', 'La cuenta está bloqueada por 15 minutos tras varios intentos fallidos');
      if (row.reason === 'usuario_inactivo' || row.reason === 'tenant_inactivo') throw new HttpError(403, row.reason, 'La cuenta no está activa');
      throw new HttpError(401, 'credenciales', 'Email o contraseña incorrectos');
    }
    await respondWithSession(res, row);
  });

  r.post('/refresh', async (req, res) => {
    sameOrigin(req);
    const token = req.cookies && req.cookies[COOKIE];
    if (!token) throw new HttpError(401, 'sin_sesion', 'No hay una sesión iniciada');
    const row = await withTx(pool, null, async (c) => (await c.query('select * from auth_refresh($1)', [token])).rows[0]);
    if (!row.ok) {
      res.clearCookie(COOKIE, cookieOpts);
      throw new HttpError(401, row.reason, 'La sesión expiró. Volvé a iniciar sesión');
    }
    await respondWithSession(res, row);
  });

  r.post('/logout', async (req, res) => {
    sameOrigin(req);
    const token = req.cookies && req.cookies[COOKIE];
    if (token) await withTx(pool, null, (c) => c.query('select auth_logout($1)', [token]));
    res.clearCookie(COOKIE, cookieOpts);
    res.status(204).end();
  });

  return { router: r, verify: (token) => jwtVerify(token, key, { algorithms: ['HS256'] }) };
}

// Middleware: exige un access token válido y deja el contexto en req.ctx.
export function requireAuth(verify) {
  return async (req, _res, next) => {
    const h = req.get('authorization') || '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m) return next(new HttpError(401, 'sin_token', 'Iniciá sesión para continuar'));
    try {
      const { payload } = await verify(m[1]);
      if (!payload.sub || !payload.tid || !payload.sid) throw new Error('claims');
      req.ctx = { uid: payload.sub, tid: payload.tid, sid: payload.sid };
      next();
    } catch {
      next(new HttpError(401, 'token_invalido', 'La sesión expiró'));
    }
  };
}
