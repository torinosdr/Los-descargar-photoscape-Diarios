// Utilidades compartidas por las rutas.
import { HttpError } from '../errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Verifica el permiso dentro de la misma transacción (la base es la fuente de verdad: rol → permisos).
export const perm = (c, code) => c.query('select require_permission($1)', [code]);

export function uuid(v, field = 'id') {
  if (typeof v !== 'string' || !UUID.test(v)) throw new HttpError(400, 'dato_invalido', 'Identificador inválido', { [field]: 'Identificador inválido' });
  return v;
}

export function optUuid(v, field) {
  return v === undefined || v === null || v === '' ? null : uuid(v, field);
}

// Importe entero en unidades menores (centavos), >= 0 (o > 0 si positive).
export function minor(v, field, { positive = false, optional = false } = {}) {
  if ((v === undefined || v === null || v === '') && optional) return null;
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 0 || (positive && n === 0)) {
    throw new HttpError(422, 'dato_invalido', positive ? 'El importe debe ser mayor a cero' : 'Importe inválido', { [field]: positive ? 'Debe ser mayor a cero' : 'Importe inválido' });
  }
  return n;
}

export function text(v, max = 200) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export const one = async (c, sql, params) => (await c.query(sql, params)).rows[0];
export const all = async (c, sql, params) => (await c.query(sql, params)).rows;
