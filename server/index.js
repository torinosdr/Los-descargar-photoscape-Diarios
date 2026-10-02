// Punto de entrada: `npm start` (lee .env si existe).
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { createApp } from './app.js';

const cfg = loadConfig();
const pool = createPool(cfg);
const app = createApp({ pool, cfg });

const server = app.listen(cfg.port, () => console.log(`Nexo escuchando en http://localhost:${cfg.port}`));

function shutdown() {
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
