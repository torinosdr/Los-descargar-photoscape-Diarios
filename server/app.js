// Aplicación HTTP: API JSON bajo /api y la interfaz estática de web/ en el mismo origen.
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { authRouter, requireAuth } from './auth.js';
import { withTx } from './db.js';
import { errorHandler, HttpError } from './errors.js';
import { customersRouter } from './routes/customers.js';
import { salesRouter } from './routes/sales.js';
import { paymentsRouter } from './routes/payments.js';

const WEB_DIR = fileURLToPath(new URL('../web/', import.meta.url));

export function createApp({ pool, cfg }) {
  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],   // la interfaz usa atributos style=
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: cfg.secureCookies ? [] : null
      }
    }
  }));

  const api = express.Router();
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  api.get('/health', async (_req, res) => {
    await pool.query('select 1');
    res.json({ ok: true });
  });

  const auth = authRouter({ pool, cfg });
  api.use('/auth', auth.router);

  // Todo lo que sigue exige sesión; req.tx corre la consulta con el contexto del usuario.
  api.use(requireAuth(auth.verify));
  api.use((req, _res, next) => { req.tx = (fn) => withTx(pool, req.ctx, fn); next(); });
  api.get('/me', async (req, res) => {
    res.json(await req.tx(async (c) => (await c.query('select session_bootstrap() as s')).rows[0].s));
  });
  api.post('/auth/password', async (req, res) => {
    const { current_password: cur, new_password: nw } = req.body || {};
    if (typeof cur !== 'string' || typeof nw !== 'string') throw new HttpError(400, 'datos_incompletos', 'Completá ambas contraseñas');
    await req.tx((c) => c.query('select auth_change_password($1, $2)', [cur, nw]));
    res.status(204).end();
  });
  api.use(customersRouter());
  api.use(salesRouter());
  api.use(paymentsRouter());

  api.use((_req, _res, next) => next(new HttpError(404, 'no_encontrado', 'Ruta inexistente')));
  api.use(errorHandler);
  app.use('/api', api);

  app.use(express.static(WEB_DIR, { index: 'index.html', maxAge: '5m' }));
  return app;
}
