// Cobranzas: cobros con imputación automática, facturas, cuentas por cobrar y antigüedad de deuda.
import { Router } from 'express';
import { HttpError } from '../errors.js';
import { perm, uuid, optUuid, minor, text, one, all } from './util.js';

export const METHODS = ['Efectivo', 'Transferencia', 'Tarjeta de crédito', 'Tarjeta de débito', 'Cheque', 'Mercado Pago', 'Otro'];

const PAYMENT_SQL = `
  select p.id, p.number, p.customer_id, c.number as customer_number, c.display_name as customer_name,
         p.method, p.amount_minor, p.currency, p.paid_at, p.reference, p.status, p.allocated_minor,
         coalesce((select jsonb_agg(jsonb_build_object('receivable_id', a.receivable_id, 'invoice_number', i.number,
                                                      'sale_number', s.number, 'amount_minor', a.amount_minor) order by a.created_at)
                     from payment_allocations a
                     join accounts_receivable ar on ar.id = a.receivable_id and ar.tenant_id = a.tenant_id
                     left join invoices i on i.id = ar.invoice_id and i.tenant_id = ar.tenant_id
                     left join sales s on s.id = ar.sale_id and s.tenant_id = ar.tenant_id
                    where a.payment_id = p.id and a.tenant_id = p.tenant_id), '[]'::jsonb) as allocations,
         coalesce((select sum(w.amount_minor) from wallet_transactions w
                    where w.tenant_id = p.tenant_id and w.payment_id = p.id and w.type = 'Carga'), 0)::bigint as to_wallet_minor
    from payments p
    join customers c on c.id = p.customer_id and c.tenant_id = p.tenant_id
   where p.direction = 'Entrada' and p.deleted_at is null`;

export function paymentsRouter() {
  const r = Router();

  r.get('/payments', async (req, res) => {
    res.json(await req.tx(async (c) => {
      await perm(c, 'payments.read');
      const params = [];
      let extra = '';
      if (req.query.customer_id) { params.push(uuid(req.query.customer_id, 'customer_id')); extra = ' and p.customer_id = $1'; }
      return all(c, PAYMENT_SQL + extra + ' order by p.paid_at desc, p.number desc limit 1000', params);
    }));
  });

  // Registra un cobro: se imputa primero a la cuenta indicada y luego a las más antiguas; el excedente va a la billetera.
  r.post('/payments', async (req, res) => {
    const b = req.body || {};
    const customer = uuid(b.customer_id, 'customer_id');
    if (!METHODS.includes(b.method)) throw new HttpError(422, 'datos_invalidos', 'Medio de pago inválido', { method: 'Medio inválido' });
    const amount = minor(b.amount_minor, 'amount_minor', { positive: true });
    const receivable = optUuid(b.receivable_id, 'receivable_id');
    const reference = text(b.reference, 120);
    const payment = await req.tx(async (c) => {
      const { id } = await one(c, 'select payment_register($1, $2, $3, $4, $5, true) as id', [customer, b.method, amount, receivable, reference]);
      return one(c, PAYMENT_SQL + ' and p.id = $1', [id]);
    });
    res.status(201).json(payment);
  });

  r.get('/payment-methods', (_req, res) => res.json(METHODS));

  r.get('/invoices', async (req, res) => {
    res.json(await req.tx(async (c) => {
      await perm(c, 'invoices.read');
      return all(c, `
        select i.id, i.number, i.customer_id, c.number as customer_number, c.display_name as customer_name,
               i.issue_date, i.due_date, i.status, i.currency, i.total_minor,
               coalesce(ar.paid_minor, i.paid_minor) as paid_minor, coalesce(ar.credited_minor, i.credited_minor) as credited_minor,
               coalesce(ar.open_minor, i.open_minor) as open_minor, ar.id as receivable_id, ar.status as receivable_status,
               i.sale_id, s.number as sale_number
          from invoices i
          join customers c on c.id = i.customer_id and c.tenant_id = i.tenant_id
          left join accounts_receivable ar on ar.invoice_id = i.id and ar.tenant_id = i.tenant_id and ar.deleted_at is null
          left join sales s on s.id = i.sale_id and s.tenant_id = i.tenant_id
         where i.deleted_at is null
         order by i.issue_date desc, i.number desc limit 1000`);
    }));
  });

  r.get('/receivables', async (req, res) => {
    res.json(await req.tx(async (c) => {
      await perm(c, 'invoices.read');
      return all(c, `
        select id, customer_id, customer_name, invoice_id, invoice_number, sale_id, sale_number, issue_date, due_date, currency,
               original_minor, paid_minor, credited_minor, open_minor, status, is_overdue, days_overdue
          from v_receivables where status in ('Abierta', 'Parcial') and open_minor > 0
         order by due_date`);
    }));
  });

  r.get('/receivables/aging', async (req, res) => {
    res.json(await req.tx(async (c) => {
      await perm(c, 'invoices.read');
      return all(c, 'select * from v_receivables_aging order by total_open_minor desc');
    }));
  });

  return r;
}
