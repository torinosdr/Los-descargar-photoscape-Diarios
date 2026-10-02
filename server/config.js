// Configuración del servidor desde variables de entorno (ver .env.example).
import { readFileSync } from 'node:fs';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name} (ver .env.example)`);
  return v;
}

export function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET || required('JWT_SECRET');
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  const sslMode = env.DB_SSL || 'disable';          // disable | require | verify
  if (!['disable', 'require', 'verify'].includes(sslMode)) throw new Error('DB_SSL debe ser disable, require o verify');
  let ssl = false;
  if (sslMode === 'require') ssl = { rejectUnauthorized: false };
  if (sslMode === 'verify') ssl = { rejectUnauthorized: true, ...(env.DB_SSL_CA ? { ca: readFileSync(env.DB_SSL_CA, 'utf8') } : {}) };
  return {
    port: Number(env.PORT || 3000),
    databaseUrl: env.DATABASE_URL || required('DATABASE_URL'),
    ssl,
    jwtSecret,
    accessTtlSeconds: Number(env.ACCESS_TTL_SECONDS || 900),
    // La cookie de refresco solo viaja por HTTPS en producción; en local (http://localhost) se desactiva.
    secureCookies: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : env.NODE_ENV === 'production',
    trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) || env.TRUST_PROXY : false,
    loginRateLimit: Number(env.LOGIN_RATE_LIMIT || 10)  // intentos por IP cada 15 minutos
  };
}
