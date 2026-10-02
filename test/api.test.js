// Pruebas de la API contra una base real recién sembrada (npm run test:api hace reset + seed antes).
// Requiere DATABASE_URL (por defecto postgres://nexo:nexo@localhost:5432/nexo).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { createPool } from '../server/db.js';
import { loadConfig } from '../server/config.js';

const cfg = loadConfig({
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://nexo:nexo@localhost:5432/nexo',
  JWT_SECRET: 'x'.repeat(40), LOGIN_RATE_LIMIT: '1000'
});
let pool, server, base;

before(async () => {
  pool = createPool(cfg);
  server = createApp({ pool, cfg }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { server.close(); await pool.end(); });

async function call(method, path, { token, body, cookie } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: 'Bearer ' + token } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await res.text();
  return { status: res.status, body: txt ? JSON.parse(txt) : null, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}
async function login(email) {
  const r = await call('POST', '/auth/login', { body: { email, password: 'Demo1234!' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r;
}

test('login: credenciales correctas devuelven token, cookie httpOnly y contexto', async () => {
  const r = await login('carlos@example.com');
  assert.ok(r.body.access_token);
  assert.match(r.cookie, /^nexo_rt=/);
  assert.equal(r.body.session.user.role, 'gerente');
  assert.equal(r.body.session.tenant.slug, 'demo-distribuidora');
  assert.ok(r.body.session.permissions.includes('sales.create'));
});

test('login: contraseña incorrecta → 401 sin revelar el motivo', async () => {
  const r = await call('POST', '/auth/login', { body: { email: 'carlos@example.com', password: 'nope1234' } });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'credenciales');
  const r2 = await call('POST', '/auth/login', { body: { email: 'nadie@example.com', password: 'nope1234' } });
  assert.equal(r2.status, 401);
  assert.equal(r2.body.message, r.body.message);
});

test('sin token o con token adulterado → 401', async () => {
  assert.equal((await call('GET', '/customers')).status, 401);
  const { body } = await login('carlos@example.com');
  const bad = body.access_token.slice(0, -2) + (body.access_token.endsWith('A') ? 'BB' : 'AA');
  assert.equal((await call('GET', '/customers', { token: bad })).status, 401);
});

test('refresh rota el token; reutilizar el anterior revoca la sesión', async () => {
  const l = await login('diego@example.com');
  const r1 = await call('POST', '/auth/refresh', { cookie: l.cookie });
  assert.equal(r1.status, 200);
  assert.notEqual(r1.cookie, l.cookie);
  const reuse = await call('POST', '/auth/refresh', { cookie: l.cookie });
  assert.equal(reuse.status, 401);
  assert.equal(reuse.body.error, 'token_reutilizado');
  // la familia entera quedó revocada: el token nuevo tampoco sirve y el access token deja de valer
  assert.equal((await call('POST', '/auth/refresh', { cookie: r1.cookie })).status, 401);
  assert.equal((await call('GET', '/me', { token: r1.body.access_token })).status, 401);
});

test('logout invalida el access token en la siguiente petición', async () => {
  const l = await login('valeria@example.com');
  assert.equal((await call('GET', '/me', { token: l.body.access_token })).status, 200);
  assert.equal((await call('POST', '/auth/logout', { cookie: l.cookie })).status, 204);
  assert.equal((await call('GET', '/me', { token: l.body.access_token })).status, 401);
});

test('refresh desde otro origen → 403', async () => {
  const l = await login('carlos@example.com');
  const res = await fetch(base + '/auth/refresh', { method: 'POST', headers: { cookie: l.cookie, origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
});

test('aislamiento: cada usuario ve solo los clientes de su tenant', async () => {
  const t2 = (await login('carlos@example.com')).body.access_token;
  const t1 = (await login('ana@example.com')).body.access_token;
  const c2 = (await call('GET', '/customers', { token: t2 })).body;
  const c1 = (await call('GET', '/customers', { token: t1 })).body;
  assert.ok(c2.some((c) => c.name === 'Distribuidora Norte'));
  assert.ok(!c1.some((c) => c.name === 'Distribuidora Norte'));
  // pedir por id un cliente de otro tenant es 404, no una fuga
  const norte = c2.find((c) => c.name === 'Distribuidora Norte');
  assert.equal((await call('GET', '/customers/' + norte.id, { token: t1 })).status, 404);
});

test('clientes: alta, validaciones, CUIT duplicado y edición', async () => {
  const t = (await login('carlos@example.com')).body.access_token;
  const bad = await call('POST', '/customers', { token: t, body: { customer_type: 'B2C', person_type: 'Empresa', company_name: 'X' } });
  assert.equal(bad.status, 422);
  assert.ok(bad.body.fields.person_type);
  const ok = await call('POST', '/customers', { token: t, body: {
    customer_type: 'B2B', person_type: 'Empresa', company_name: 'Ferretería Test', email: 'FERRE@test.com', tax_id: '30-99999999-1',
    credit_limit_minor: 500000, payment_terms_days: 15 } });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.match(ok.body.number, /^CLI-/);
  assert.equal(ok.body.email, 'ferre@test.com');
  const dup = await call('POST', '/customers', { token: t, body: { customer_type: 'B2C', person_type: 'Persona Física', first_name: 'Otro', tax_id: '30-99999999-1' } });
  assert.equal(dup.status, 409);
  assert.ok(dup.body.fields.tax_id);
  const ed = await call('PATCH', '/customers/' + ok.body.id, { token: t, body: { phone: '1144445555', status: 'Bloqueado' } });
  assert.equal(ed.status, 200);
  assert.equal(ed.body.status, 'Bloqueado');
  const ed2 = await call('PATCH', '/customers/' + ok.body.id, { token: t, body: { company_name: '' } });
  assert.equal(ed2.status, 422);
});

test('permisos: el rol contable no puede crear clientes ni ventas', async () => {
  const t = (await login('diego@example.com')).body.access_token;
  const r = await call('POST', '/customers', { token: t, body: { customer_type: 'B2C', person_type: 'Persona Física', first_name: 'Nope' } });
  assert.equal(r.status, 403);
  assert.equal(r.body.error, 'sin_permiso');
  const customers = (await call('GET', '/customers', { token: t })).body;
  const products = (await call('GET', '/products', { token: t })).body;
  const s = await call('POST', '/sales', { token: t, body: { customer_id: customers[0].id, items: [{ product_id: products[0].id, quantity: 1 }] } });
  assert.equal(s.status, 403);
});

test('ventas → factura → cobro parcial → cobro con excedente a billetera', async () => {
  const t = (await login('carlos@example.com')).body.access_token;
  const customers = (await call('GET', '/customers', { token: t })).body;
  const laura = customers.find((c) => c.name === 'Laura Gómez');
  const products = (await call('GET', '/products', { token: t })).body;
  const prod = products.find((p) => p.track_stock && p.available >= 2) || products[0];

  const s = await call('POST', '/sales', { token: t, body: { customer_id: laura.id, items: [{ product_id: prod.id, quantity: 2 }] } });
  assert.equal(s.status, 201, JSON.stringify(s.body));
  assert.equal(s.body.status, 'Pendiente de Pago');
  assert.equal(s.body.items.length, 1);
  assert.ok(s.body.total_minor > 0);
  const id = s.body.id;

  const rsv = await call('POST', `/sales/${id}/actions/reserve`, { token: t });
  assert.equal(rsv.status, 200);
  assert.equal(rsv.body.reserved, true);

  const inv = await call('POST', `/sales/${id}/actions/invoice`, { token: t });
  assert.equal(inv.status, 200, JSON.stringify(inv.body));
  assert.ok(inv.body.invoice_number);
  const total = inv.body.receivable_open_minor;
  assert.equal(total, inv.body.total_minor);
  // facturar dos veces → conflicto
  assert.equal((await call('POST', `/sales/${id}/actions/invoice`, { token: t })).status, 409);

  const p1 = await call('POST', '/payments', { token: t, body: { customer_id: laura.id, method: 'Transferencia', amount_minor: 1000, receivable_id: inv.body.receivable_id, reference: 'TRX-1' } });
  assert.equal(p1.status, 201, JSON.stringify(p1.body));
  assert.equal(p1.body.allocations[0].amount_minor, 1000);
  assert.equal(p1.body.allocations[0].invoice_number, inv.body.invoice_number);

  const before = (await call('GET', '/customers/' + laura.id, { token: t })).body;
  const debt = before.receivable_open_minor;
  const p2 = await call('POST', '/payments', { token: t, body: { customer_id: laura.id, method: 'Efectivo', amount_minor: debt + 5000 } });
  assert.equal(p2.status, 201);
  assert.equal(p2.body.to_wallet_minor, 5000);
  const after = (await call('GET', '/customers/' + laura.id, { token: t })).body;
  assert.equal(after.receivable_open_minor, 0);
  assert.equal(after.wallet_balance_minor, before.wallet_balance_minor + 5000);

  const paid = (await call('GET', '/sales/' + id, { token: t })).body;
  assert.equal(paid.status, 'Pagado');
  assert.ok(paid.history.some((h) => h.kind === 'cobro'));

  for (const a of ['prepare', 'dispatch', 'deliver', 'complete']) {
    const r = await call('POST', `/sales/${id}/actions/${a}`, { token: t });
    assert.equal(r.status, 200, a + ': ' + JSON.stringify(r.body));
  }
  const done = (await call('GET', '/sales/' + id, { token: t })).body;
  assert.equal(done.status, 'Completado');
  // una venta completada no se anula (transición inválida)
  const cx = await call('POST', `/sales/${id}/actions/cancel`, { token: t, body: { reason: 'prueba' } });
  assert.equal(cx.status, 422);
});

test('anular una venta cobrada devuelve lo cobrado a la billetera', async () => {
  const t = (await login('carlos@example.com')).body.access_token;
  const customers = (await call('GET', '/customers', { token: t })).body;
  const norte = customers.find((c) => c.name === 'Distribuidora Norte');
  const products = (await call('GET', '/products', { token: t })).body;
  const s = (await call('POST', '/sales', { token: t, body: { customer_id: norte.id, items: [{ product_id: products[0].id, quantity: 1 }] } })).body;
  const inv = (await call('POST', `/sales/${s.id}/actions/invoice`, { token: t })).body;
  await call('POST', '/payments', { token: t, body: { customer_id: norte.id, method: 'Efectivo', amount_minor: 2000, receivable_id: inv.receivable_id } });
  const w0 = (await call('GET', '/customers/' + norte.id, { token: t })).body.wallet_balance_minor;
  assert.equal((await call('POST', `/sales/${s.id}/actions/cancel`, { token: t, body: {} })).status, 422);  // motivo obligatorio
  const cx = await call('POST', `/sales/${s.id}/actions/cancel`, { token: t, body: { reason: 'Cliente desistió' } });
  assert.equal(cx.status, 200);
  assert.equal(cx.body.status, 'Cancelado');
  assert.equal(cx.body.invoice_id, null);
  const w1 = (await call('GET', '/customers/' + norte.id, { token: t })).body.wallet_balance_minor;
  assert.equal(w1, w0 + 2000);
});

test('validaciones de ventas y cobros', async () => {
  const t = (await login('carlos@example.com')).body.access_token;
  const customers = (await call('GET', '/customers', { token: t })).body;
  assert.equal((await call('POST', '/sales', { token: t, body: { customer_id: customers[0].id, items: [] } })).status, 422);
  assert.equal((await call('POST', '/sales', { token: t, body: { customer_id: 'no-es-uuid', items: [{}] } })).status, 400);
  assert.equal((await call('POST', '/payments', { token: t, body: { customer_id: customers[0].id, method: 'Efectivo', amount_minor: 0 } })).status, 422);
  assert.equal((await call('POST', '/payments', { token: t, body: { customer_id: customers[0].id, method: 'Billetera', amount_minor: 10 } })).status, 422);
  assert.equal((await call('POST', '/sales/' + customers[0].id + '/actions/borrar', { token: t })).status, 404);
});

test('cobranzas: el vendedor ve cobros pero no puede registrarlos', async () => {
  const t = (await login('valeria@example.com')).body.access_token;
  assert.equal((await call('GET', '/payments', { token: t })).status, 200);
  const customers = (await call('GET', '/customers', { token: t })).body;
  const r = await call('POST', '/payments', { token: t, body: { customer_id: customers[0].id, method: 'Efectivo', amount_minor: 100 } });
  assert.equal(r.status, 403);
});

test('billetera: aplicar saldo a la deuda más antigua', async () => {
  const t = (await login('carlos@example.com')).body.access_token;
  const c = (await call('POST', '/customers', { token: t, body: { customer_type: 'B2C', person_type: 'Persona Física', first_name: 'Billetera', last_name: 'Test' } })).body;
  // sin deudas, todo el cobro queda como saldo a favor
  const pre = await call('POST', '/payments', { token: t, body: { customer_id: c.id, method: 'Efectivo', amount_minor: 5000 } });
  assert.equal(pre.body.to_wallet_minor, 5000);
  const products = (await call('GET', '/products', { token: t })).body;
  const s = (await call('POST', '/sales', { token: t, body: { customer_id: c.id, items: [{ product_id: products[0].id, quantity: 1 }] } })).body;
  const inv = (await call('POST', `/sales/${s.id}/actions/invoice`, { token: t })).body;
  assert.ok(inv.receivable_open_minor > 5000);
  const r = await call('POST', `/customers/${c.id}/wallet/apply`, { token: t, body: {} });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.applied_minor, 5000);
  const after = (await call('GET', '/customers/' + c.id, { token: t })).body;
  assert.equal(after.wallet_balance_minor, 0);
  assert.equal(after.receivable_open_minor, inv.receivable_open_minor - 5000);
});

test('lecturas de facturas, por cobrar y antigüedad', async () => {
  const t = (await login('diego@example.com')).body.access_token;
  for (const p of ['/invoices', '/receivables', '/receivables/aging', '/customer-groups', '/users', '/warehouses', '/me']) {
    const r = await call('GET', p, { token: t });
    assert.equal(r.status, 200, p + ' ' + JSON.stringify(r.body));
  }
});
