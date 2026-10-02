// Errores HTTP y traducción de los errores de negocio de PostgreSQL.
export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// Las funciones SQL lanzan mensajes en castellano pensados para el usuario con estos SQLSTATE.
const PG = {
  '42501': [403, 'sin_permiso'],          // insufficient_privilege (require_permission, RLS)
  P0002: [404, 'no_encontrado'],          // no_data_found
  '23514': [422, 'regla_de_negocio'],     // check_violation (validaciones y transiciones de estado)
  '23505': [409, 'duplicado'],            // unique_violation
  '23503': [422, 'referencia_invalida'],  // foreign_key_violation
  '23P01': [409, 'conflicto'],            // exclusion_violation
  '23001': [409, 'en_uso'],               // restrict_violation
  '23000': [422, 'integridad'],           // integrity_constraint_violation
  '23502': [422, 'dato_obligatorio'],     // not_null_violation
  '22P02': [400, 'dato_invalido'],        // invalid_text_representation (uuid mal formado, etc.)
  '22003': [400, 'dato_invalido'],        // numeric_value_out_of_range
  '22023': [400, 'dato_invalido']
};

// Restricciones con un mensaje propio (el texto de PostgreSQL es técnico).
const CONSTRAINTS = {
  customers_tax_id_uq: [409, 'duplicado', 'Ya existe un cliente con ese CUIT/DNI', 'tax_id']
};

export function toHttp(e) {
  if (e instanceof HttpError) return e;
  const k = e && e.constraint && CONSTRAINTS[e.constraint];
  if (k) return new HttpError(k[0], k[1], k[2], { [k[3]]: k[2] });
  const m = e && e.code && PG[e.code];
  if (m) {
    // Los mensajes de restricciones automáticas (p. ej. 'violates check constraint') no son para el usuario.
    const raw = String(e.message || '');
    const technical = /violates|constraint|syntax|invalid input/i.test(raw);
    return new HttpError(m[0], m[1], technical ? 'Los datos no cumplen las reglas del sistema' : raw);
  }
  return new HttpError(500, 'error_interno', 'Error interno del servidor');
}

export function errorHandler(err, req, res, _next) {
  if (err && err.type === 'entity.parse.failed') err = new HttpError(400, 'json_invalido', 'El cuerpo no es JSON válido');
  const h = toHttp(err);
  if (h.status >= 500) console.error('[api]', req.method, req.originalUrl, err);
  res.status(h.status).json({ error: h.code, message: h.message, ...(h.fields ? { fields: h.fields } : {}) });
}
