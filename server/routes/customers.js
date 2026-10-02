// Clientes: lista (Customer 360), ficha, alta/edición, grupos, responsables y billetera.
import { Router } from 'express';
import { HttpError } from '../errors.js';
import { perm, uuid, optUuid, minor, text, one, all } from './util.js';

const LIST_SQL = `
  select v.customer_id as id, v.number, v.display_name as name, v.customer_type as type, v.person_type, v.status,
         v.email, v.phone, v.tax_id, c.tax_condition, c.first_name, c.last_name, c.company_name,
         c.customer_group_id as group_id, v.group_name, c.assigned_user_id as owner_id, u.name as owner_name,
         c.credit_limit_minor, c.payment_terms_days, v.currency,
         v.wallet_balance_minor, v.receivable_open_minor, v.receivable_overdue_minor,
         v.sales_count, v.sales_total_minor, v.last_sale_at, c.created_at
    from v_customer_360 v
    join customers c on c.id = v.customer_id and c.tenant_id = v.tenant_id
    left join users u on u.id = c.assigned_user_id and u.tenant_id = c.tenant_id`;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const STATUS = ['Activo', 'Inactivo', 'Bloqueado'];

// Normaliza y valida el cuerpo; mismas reglas que las restricciones de la tabla customers.
function readCustomer(b, { partial }) {
  const out = {}, errs = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  if (!partial || has('customer_type')) {
    if (!['B2C', 'B2B'].includes(b.customer_type)) errs.customer_type = 'Tipo inválido';
    out.customer_type = b.customer_type;
  }
  if (!partial || has('person_type')) {
    if (!['Persona Física', 'Empresa'].includes(b.person_type)) errs.person_type = 'Tipo de persona inválido';
    out.person_type = b.person_type;
  }
  for (const k of ['first_name', 'last_name', 'company_name', 'phone', 'tax_id', 'tax_condition']) if (!partial || has(k)) out[k] = text(b[k], 160);
  if (!partial || has('email')) {
    out.email = text(b.email, 254);
    if (out.email && !EMAIL.test(out.email)) errs.email = 'Email inválido';
    if (out.email) out.email = out.email.toLowerCase();
  }
  if (!partial || has('customer_group_id')) out.customer_group_id = optUuid(b.customer_group_id, 'customer_group_id');
  if (!partial || has('assigned_user_id')) out.assigned_user_id = optUuid(b.assigned_user_id, 'assigned_user_id');
  if (!partial || has('credit_limit_minor')) out.credit_limit_minor = minor(b.credit_limit_minor, 'credit_limit_minor', { optional: true });
  if (!partial || has('payment_terms_days')) {
    const n = b.payment_terms_days === undefined || b.payment_terms_days === null || b.payment_terms_days === '' ? 0 : Number(b.payment_terms_days);
    if (!Number.isInteger(n) || n < 0 || n > 365) errs.payment_terms_days = 'Plazo inválido';
    out.payment_terms_days = n;
  }
  if (partial && has('status')) {
    if (!STATUS.includes(b.status)) errs.status = 'Estado inválido';
    out.status = b.status;
  }
  if (Object.keys(errs).length) throw new HttpError(422, 'datos_invalidos', 'Revisá los datos del cliente', errs);
  return out;
}

// Reglas que combinan campos; se evalúan sobre el registro final (útil también en ediciones parciales).
function checkCombined(r) {
  const errs = {};
  if (r.customer_type === 'B2C' && r.person_type !== 'Persona Física') errs.person_type = 'Un cliente B2C debe ser persona física';
  if (r.person_type === 'Empresa' && !r.company_name) errs.company_name = 'La empresa necesita razón social';
  if (r.person_type === 'Persona Física' && !r.first_name && !r.last_name) errs.first_name = 'Indicá el nombre';
  if (Object.keys(errs).length) throw new HttpError(422, 'datos_invalidos', 'Revisá los datos del cliente', errs);
}

export function customersRouter() {
  const r = Router();

  r.get('/customers', async (req, res) => {
    res.json(await req.tx(async (c) => {
      await perm(c, 'customers.read');
      return all(c, LIST_SQL + ' order by v.display_name');
    }));
  });

  r.get('/customers/:id', async (req, res) => {
    const id = uuid(req.params.id);
    res.json(await req.tx(async (c) => {
      await perm(c, 'customers.read');
      const customer = await one(c, LIST_SQL + ' where v.customer_id = $1', [id]);
      if (!customer) throw new HttpError(404, 'no_encontrado', 'Cliente inexistente');
      // Secuencial: un cliente de pg ejecuta una consulta por vez dentro de la transacción.
      const timeline = await all(c, `select kind, entity_id, occurred_at, title, detail, amount_minor, currency
                  from v_customer_timeline where customer_id = $1 order by occurred_at desc limit 50`, [id]);
      const receivables = await all(c, `select id, invoice_id, invoice_number, sale_id, sale_number, issue_date, due_date, currency,
                       original_minor, paid_minor, credited_minor, open_minor, status, is_overdue, days_overdue
                  from v_receivables where customer_id = $1 order by due_date desc`, [id]);
      const wallet = await all(c, `select id, occurred_at, type, amount_minor, signed_minor, balance_after_minor, currency, notes
                  from wallet_transactions where customer_id = $1 order by occurred_at desc limit 50`, [id]);
      return { ...customer, timeline, receivables, wallet };
    }));
  });

  r.post('/customers', async (req, res) => {
    const d = readCustomer(req.body || {}, { partial: false });
    checkCombined(d);
    const row = await req.tx(async (c) => {
      await perm(c, 'customers.create');
      const cols = Object.keys(d);
      const { id } = await one(c,
        `insert into customers (tenant_id, ${cols.join(', ')}) values (app_tenant(), ${cols.map((_, i) => '$' + (i + 1)).join(', ')}) returning id`,
        cols.map((k) => d[k]));
      return one(c, LIST_SQL + ' where v.customer_id = $1', [id]);
    });
    res.status(201).json(row);
  });

  r.patch('/customers/:id', async (req, res) => {
    const id = uuid(req.params.id);
    const d = readCustomer(req.body || {}, { partial: true });
    const cols = Object.keys(d);
    if (!cols.length) throw new HttpError(400, 'sin_cambios', 'No hay cambios para guardar');
    const row = await req.tx(async (c) => {
      await perm(c, 'customers.update');
      const cur = await one(c, 'select * from customers where id = $1 and deleted_at is null for update', [id]);
      if (!cur) throw new HttpError(404, 'no_encontrado', 'Cliente inexistente');
      checkCombined({ ...cur, ...d });
      await c.query(`update customers set ${cols.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1`, [id, ...cols.map((k) => d[k])]);
      return one(c, LIST_SQL + ' where v.customer_id = $1', [id]);
    });
    res.json(row);
  });

  // Aplica el saldo de la billetera a las deudas más antiguas (wallet_apply_to_debt).
  r.post('/customers/:id/wallet/apply', async (req, res) => {
    const id = uuid(req.params.id);
    const max = minor((req.body || {}).max_minor, 'max_minor', { optional: true, positive: true });
    res.json(await req.tx(async (c) => {
      const { applied } = await one(c, 'select wallet_apply_to_debt($1, $2) as applied', [id, max]);
      return { applied_minor: applied };
    }));
  });

  r.get('/customer-groups', async (req, res) => {
    res.json(await req.tx(async (c) => {
      await perm(c, 'customers.read');
      return all(c, `select g.id, g.name, g.description, g.is_b2b, pl.name as price_list_name,
                            (select count(*) from customers x where x.customer_group_id = g.id and x.deleted_at is null)::int as members
                       from customer_groups g left join price_lists pl on pl.id = g.default_price_list_id and pl.tenant_id = g.tenant_id
                      where g.deleted_at is null order by g.name`);
    }));
  });

  // Usuarios activos del tenant (para elegir responsable).
  r.get('/users', async (req, res) => {
    res.json(await req.tx(async (c) => {
      await perm(c, 'customers.read');
      return all(c, "select id, name, email from users where deleted_at is null and status = 'Activo' order by name");
    }));
  });

  return r;
}
