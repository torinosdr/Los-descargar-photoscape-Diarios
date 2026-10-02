// Ventas: lista, detalle, alta con líneas (precio calculado por la base) y acciones del flujo de estados.
import { Router } from 'express';
import { HttpError } from '../errors.js';
import { perm, uuid, minor, text, one, all } from './util.js';

const SALE_SQL = `
  select s.id, s.number, s.customer_id, c.number as customer_number, c.display_name as customer_name,
         s.status, s.payment_status, s.sold_at, s.due_date, s.currency, s.subtotal_minor, s.discount_minor, s.tax_minor,
         s.shipping_minor, s.total_minor, s.paid_minor, s.open_minor, s.cancel_reason, s.cancelled_at, s.completed_at, s.notes,
         i.id as invoice_id, i.number as invoice_number, i.issue_date as invoice_date,
         ar.id as receivable_id, ar.paid_minor as receivable_paid_minor, ar.credited_minor as receivable_credited_minor,
         ar.open_minor as receivable_open_minor, ar.status as receivable_status,
         exists (select 1 from stock_reservations r where r.tenant_id = s.tenant_id and r.reference_type = 'sale'
                    and r.reference_id = s.id and r.status = 'Activa') as reserved,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'id', si.id, 'product_id', si.product_id, 'sku', p.sku, 'description', si.description,
                     'quantity', si.quantity, 'quantity_returned', si.quantity_returned, 'unit_price_minor', si.unit_price_minor,
                     'discount_minor', si.discount_minor, 'tax_minor', si.tax_minor, 'line_total_minor', si.line_total_minor,
                     'applied_rules', si.applied_rules) order by si.sort_order, si.created_at)
                     from sale_items si left join products p on p.id = si.product_id and p.tenant_id = si.tenant_id
                    where si.sale_id = s.id and si.tenant_id = s.tenant_id), '[]'::jsonb) as items
    from sales s
    join customers c on c.id = s.customer_id and c.tenant_id = s.tenant_id
    left join invoices i on i.sale_id = s.id and i.tenant_id = s.tenant_id and i.status <> 'Anulada' and i.deleted_at is null
    left join accounts_receivable ar on ar.invoice_id = i.id and ar.tenant_id = i.tenant_id and ar.deleted_at is null and ar.status <> 'Anulada'
   where s.deleted_at is null`;

// Acciones del detalle de venta. Las que no tienen función SQL propia cambian el estado y el trigger
// enforce_transition('Sale') valida que el paso sea legal según workflow_transitions.
const ACTIONS = {
  reserve: (c, id) => c.query('select sale_reserve_stock($1)', [id]),
  invoice: (c, id) => c.query('select sale_issue_invoice($1)', [id]),
  dispatch: (c, id) => c.query('select sale_dispatch($1)', [id]),
  prepare: (c, id) => setStatus(c, id, 'En Preparación'),
  deliver: (c, id) => setStatus(c, id, 'Entregado'),
  complete: (c, id) => setStatus(c, id, 'Completado', ', completed_at = now()'),
  cancel: (c, id, body) => {
    const reason = text(body.reason, 500);
    if (!reason) throw new HttpError(422, 'datos_invalidos', 'Indicá el motivo de la anulación', { reason: 'Obligatorio' });
    return c.query('select sale_cancel($1, $2)', [id, reason]);
  }
};

async function setStatus(c, id, status, extra = '') {
  await perm(c, 'sales.update');
  const r = await c.query(`update sales set status = $2${extra} where id = $1 and deleted_at is null`, [id, status]);
  if (!r.rowCount) throw new HttpError(404, 'no_encontrado', 'Venta inexistente');
}

async function history(c, id) {
  // Seguimiento: alta, factura, cobros imputados, anulación y cierre (sin depender de audit_log, que es solo para admins).
  return all(c, `
    select at, kind, title, amount_minor from (
      select s.created_at as at, 'creada' as kind, 'Venta creada' as title, null::bigint as amount_minor from sales s where s.id = $1
      union all
      select i.created_at, 'factura', 'Factura ' || i.number, i.total_minor from invoices i where i.sale_id = $1 and i.deleted_at is null
      union all
      select a.created_at, 'cobro', 'Cobro ' || p.number || ' (' || p.method || ')', a.amount_minor
        from payment_allocations a join accounts_receivable ar on ar.id = a.receivable_id and ar.tenant_id = a.tenant_id
        join payments p on p.id = a.payment_id and p.tenant_id = a.tenant_id where ar.sale_id = $1
      union all
      select s.cancelled_at, 'anulada', 'Venta anulada: ' || coalesce(s.cancel_reason, ''), null from sales s where s.id = $1 and s.cancelled_at is not null
      union all
      select s.completed_at, 'completada', 'Venta completada', null from sales s where s.id = $1 and s.completed_at is not null
    ) h order by at`, [id]);
}

export function salesRouter() {
  const r = Router();

  r.get('/sales', async (req, res) => {
    res.json(await req.tx(async (c) => {
      await perm(c, 'sales.read');
      const params = [], where = [];
      if (req.query.customer_id) { params.push(uuid(req.query.customer_id, 'customer_id')); where.push(`s.customer_id = $${params.length}`); }
      return all(c, SALE_SQL + (where.length ? ' and ' + where.join(' and ') : '') + ' order by s.sold_at desc, s.number desc limit 1000', params);
    }));
  });

  r.get('/sales/:id', async (req, res) => {
    const id = uuid(req.params.id);
    res.json(await req.tx(async (c) => {
      await perm(c, 'sales.read');
      const sale = await one(c, SALE_SQL + ' and s.id = $1', [id]);
      if (!sale) throw new HttpError(404, 'no_encontrado', 'Venta inexistente');
      return { ...sale, history: await history(c, id) };
    }));
  });

  // Alta: cabecera + líneas en una sola transacción. El precio de cada línea lo resuelve sale_add_item
  // (lista del grupo, escalas y reglas B2B); el cliente no puede imponer precios.
  r.post('/sales', async (req, res) => {
    const b = req.body || {};
    const customerId = uuid(b.customer_id, 'customer_id');
    const items = Array.isArray(b.items) ? b.items : [];
    if (!items.length || items.length > 200) throw new HttpError(422, 'datos_invalidos', 'Agregá al menos una línea con producto', { items: 'Obligatorio' });
    const lines = items.map((it, i) => {
      const q = Number(it && it.quantity);
      if (!(q > 0) || q > 1e6) throw new HttpError(422, 'datos_invalidos', `Cantidad inválida en la línea ${i + 1}`, { [`items.${i}.quantity`]: 'Cantidad inválida' });
      return { product_id: uuid(it.product_id, `items.${i}.product_id`), quantity: q };
    });
    const discount = minor(b.discount_minor ?? 0, 'discount_minor');
    const shipping = minor(b.shipping_minor ?? 0, 'shipping_minor');
    const notes = text(b.notes, 1000);
    const sale = await req.tx(async (c) => {
      await perm(c, 'sales.create');
      const head = await one(c, `
        insert into sales (tenant_id, customer_id, currency, payment_terms_days, due_date, warehouse_id, assigned_user_id,
                           discount_minor, shipping_minor, notes)
        select app_tenant(), cu.id, t.base_currency, cu.payment_terms_days, current_date + cu.payment_terms_days,
               default_warehouse(), app_user(), $2, $3, $4
          from customers cu join tenants t on t.id = cu.tenant_id
         where cu.id = $1 and cu.deleted_at is null and cu.status = 'Activo'
        returning id`, [customerId, discount, shipping, notes]);
      if (!head) throw new HttpError(422, 'cliente_invalido', 'El cliente no existe o no está activo', { customer_id: 'Cliente inválido' });
      for (const l of lines) await c.query('select sale_add_item($1, $2, $3)', [head.id, l.product_id, l.quantity]);
      const s = await one(c, SALE_SQL + ' and s.id = $1', [head.id]);
      if (s.total_minor <= 0) throw new HttpError(422, 'datos_invalidos', 'El descuento no puede superar el total de la venta', { discount_minor: 'Mayor que el total' });
      return s;
    });
    res.status(201).json(sale);
  });

  r.post('/sales/:id/actions/:action', async (req, res) => {
    const id = uuid(req.params.id);
    const act = ACTIONS[req.params.action];
    if (!act) throw new HttpError(404, 'accion_invalida', 'Acción inexistente');
    res.json(await req.tx(async (c) => {
      await act(c, id, req.body || {});
      const sale = await one(c, SALE_SQL + ' and s.id = $1', [id]);
      if (!sale) throw new HttpError(404, 'no_encontrado', 'Venta inexistente');
      return { ...sale, history: await history(c, id) };
    }));
  });

  // Productos vendibles con stock por depósito.
  r.get('/products', async (req, res) => {
    res.json(await req.tx(async (c) => {
      await perm(c, 'products.read');
      return all(c, `
        select p.id, p.sku, p.name, p.sale_price_minor, p.purchase_price_minor, p.stock_min, p.track_stock, p.status,
               coalesce(jsonb_object_agg(w.code, l.quantity_on_hand) filter (where w.code is not null), '{}'::jsonb) as stock,
               coalesce(sum(l.reserved_quantity), 0) as reserved, coalesce(sum(l.available_quantity), 0) as available
          from products p
          left join inventory_levels l on l.product_id = p.id and l.tenant_id = p.tenant_id and l.variation_id is null
          left join warehouses w on w.id = l.warehouse_id and w.tenant_id = l.tenant_id
         where p.deleted_at is null
         group by p.id order by p.name`);
    }));
  });

  r.get('/warehouses', async (req, res) => {
    res.json(await req.tx(async (c) => {
      await perm(c, 'products.read');
      return all(c, 'select id, code, name, is_default from warehouses where deleted_at is null order by is_default desc, name');
    }));
  });

  // Vista previa del precio que aplicará sale_add_item (lista, escalas y reglas).
  r.get('/price', async (req, res) => {
    const customer = uuid(req.query.customer_id, 'customer_id'), product = uuid(req.query.product_id, 'product_id');
    const qty = Number(req.query.quantity || 1);
    if (!(qty > 0)) throw new HttpError(400, 'dato_invalido', 'Cantidad inválida');
    const cart = minor(req.query.cart_total_minor ?? 0, 'cart_total_minor');
    res.json(await req.tx(async (c) => {
      await perm(c, 'sales.read');
      return one(c, 'select * from price_resolve($1, $2, $3, $4)', [customer, product, qty, cart]);
    }));
  });

  return r;
}
