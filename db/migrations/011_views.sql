-- 011 · Vistas de lectura (Customer 360, cuentas, inventario, búsqueda global)
-- security_invoker: las vistas respetan el RLS de quien consulta (aislamiento por tenant).

create view v_wallet_balances with (security_invoker = true) as
select tenant_id, customer_id, currency,
       sum(signed_minor)::bigint as balance_minor,
       max(occurred_at) as last_movement_at
  from wallet_transactions
 group by tenant_id, customer_id, currency;

create view v_receivables with (security_invoker = true) as
select ar.*,
       c.display_name as customer_name,
       s.number as sale_number,
       i.number as invoice_number,
       (ar.open_minor > 0 and ar.status in ('Abierta','Parcial') and ar.due_date < current_date) as is_overdue,
       case when ar.open_minor > 0 and ar.status in ('Abierta','Parcial') and ar.due_date < current_date
            then current_date - ar.due_date else 0 end as days_overdue
  from accounts_receivable ar
  join customers c on c.id = ar.customer_id and c.tenant_id = ar.tenant_id
  left join sales s on s.id = ar.sale_id and s.tenant_id = ar.tenant_id
  left join invoices i on i.id = ar.invoice_id and i.tenant_id = ar.tenant_id
 where ar.deleted_at is null;

create view v_payables with (security_invoker = true) as
select ap.*,
       sp.name as supplier_name,
       p.number as purchase_number,
       (ap.open_minor > 0 and ap.status in ('Abierta','Parcial') and ap.due_date < current_date) as is_overdue,
       case when ap.open_minor > 0 and ap.status in ('Abierta','Parcial') and ap.due_date < current_date
            then current_date - ap.due_date else 0 end as days_overdue
  from accounts_payable ap
  join suppliers sp on sp.id = ap.supplier_id and sp.tenant_id = ap.tenant_id
  left join purchases p on p.id = ap.purchase_id and p.tenant_id = ap.tenant_id
 where ap.deleted_at is null;

-- Customer 360: una fila por cliente con todos los indicadores de la ficha.
-- Los importes se expresan en la moneda base del tenant (el detalle por moneda está en v_wallet_balances
-- y v_receivables).
create view v_customer_360 with (security_invoker = true) as
select c.id as customer_id, c.tenant_id, c.number, c.display_name, c.customer_type, c.person_type,
       c.email, c.phone, c.tax_id, c.status, g.name as group_name, c.assigned_user_id,
       t.base_currency as currency,
       coalesce((select sum(w.signed_minor) from wallet_transactions w
                  where w.tenant_id = c.tenant_id and w.customer_id = c.id and w.currency = t.base_currency), 0)::bigint as wallet_balance_minor,
       coalesce((select sum(ar.open_minor) from accounts_receivable ar
                  where ar.tenant_id = c.tenant_id and ar.customer_id = c.id and ar.deleted_at is null
                    and ar.status in ('Abierta','Parcial') and ar.currency = t.base_currency), 0)::bigint as receivable_open_minor,
       coalesce((select sum(ar.open_minor) from accounts_receivable ar
                  where ar.tenant_id = c.tenant_id and ar.customer_id = c.id and ar.deleted_at is null
                    and ar.status in ('Abierta','Parcial') and ar.due_date < current_date
                    and ar.currency = t.base_currency), 0)::bigint as receivable_overdue_minor,
       (select count(*) from sales s where s.tenant_id = c.tenant_id and s.customer_id = c.id
           and s.deleted_at is null and s.status not in ('Cancelado'))::int as sales_count,
       coalesce((select sum(s.total_minor) from sales s where s.tenant_id = c.tenant_id and s.customer_id = c.id
           and s.deleted_at is null and s.status not in ('Cancelado','Devuelto') and s.currency = t.base_currency), 0)::bigint as sales_total_minor,
       (select count(*) from sales s where s.tenant_id = c.tenant_id and s.customer_id = c.id and s.deleted_at is null
           and s.status not in ('Completado','Cancelado','Devuelto'))::int as open_sales_count,
       (select max(s.sold_at) from sales s where s.tenant_id = c.tenant_id and s.customer_id = c.id
           and s.deleted_at is null and s.status <> 'Cancelado') as last_sale_at,
       (select count(*) from quotes q where q.tenant_id = c.tenant_id and q.customer_id = c.id and q.deleted_at is null
           and q.status in ('Borrador','Enviado','Visto'))::int as open_quotes_count,
       (select count(*) from tickets k where k.tenant_id = c.tenant_id and k.customer_id = c.id and k.deleted_at is null
           and k.status <> 'Cerrado')::int as open_tickets_count,
       (select count(*) from tasks tk where tk.tenant_id = c.tenant_id and tk.customer_id = c.id and tk.deleted_at is null
           and tk.status not in ('Completada','Cancelada'))::int as open_tasks_count,
       (select max(ca.occurred_at) from calls ca where ca.tenant_id = c.tenant_id and ca.customer_id = c.id and ca.deleted_at is null) as last_call_at
  from customers c
  join tenants t on t.id = c.tenant_id
  left join customer_groups g on g.id = c.customer_group_id and g.tenant_id = c.tenant_id
 where c.deleted_at is null;

-- Línea de tiempo unificada del cliente (la pestaña "Actividad" de Customer 360).
create view v_customer_timeline with (security_invoker = true) as
select s.tenant_id, s.customer_id, 'venta'::text as kind, s.id as entity_id, s.sold_at as occurred_at,
       'Venta ' || coalesce(s.number, '') as title, s.status as detail,
       s.total_minor as amount_minor, s.currency
  from sales s where s.deleted_at is null
union all
select p.tenant_id, p.customer_id, 'pago', p.id, p.paid_at,
       'Pago ' || coalesce(p.number, '') || ' · ' || p.method, p.status, p.amount_minor, p.currency
  from payments p where p.deleted_at is null and p.customer_id is not null
union all
select q.tenant_id, q.customer_id, 'presupuesto', q.id, coalesce(q.sent_at, q.created_at),
       'Presupuesto ' || coalesce(q.number, ''), q.status, q.total_minor, q.currency
  from quotes q where q.deleted_at is null
union all
select i.tenant_id, i.customer_id, 'factura', i.id, i.issue_date::timestamptz,
       'Factura ' || coalesce(i.number, ''), i.status, i.total_minor, i.currency
  from invoices i where i.deleted_at is null
union all
select k.tenant_id, k.customer_id, 'ticket', k.id, k.created_at,
       'Ticket ' || coalesce(k.number, '') || ' · ' || k.subject, k.status, null, null
  from tickets k where k.deleted_at is null
union all
select ca.tenant_id, ca.customer_id, 'llamada', ca.id, ca.occurred_at,
       'Llamada ' || lower(ca.direction) || ' · ' || ca.subject, ca.outcome, null, null
  from calls ca where ca.deleted_at is null and ca.customer_id is not null
union all
select n.tenant_id, n.linked_id, 'nota', n.id, n.created_at, 'Nota', left(n.body, 140), null, null
  from notes n where n.deleted_at is null and n.linked_type = 'customer'
union all
select tk.tenant_id, tk.customer_id, 'tarea', tk.id, coalesce(tk.completed_at, tk.created_at),
       'Tarea · ' || tk.title, tk.status, null, null
  from tasks tk where tk.deleted_at is null and tk.customer_id is not null
union all
select w.tenant_id, w.customer_id, 'billetera', w.id, w.occurred_at,
       'Billetera · ' || w.type, w.notes, w.signed_minor, w.currency
  from wallet_transactions w;

-- Existencias con alerta de reposición (disponible <= mínimo).
create view v_inventory_status with (security_invoker = true) as
select il.tenant_id, il.warehouse_id, w.name as warehouse_name,
       il.product_id, p.sku, p.name as product_name, il.variation_id, pv.sku as variation_sku,
       il.quantity_on_hand, il.reserved_quantity, il.available_quantity,
       coalesce(pv.stock_min, p.stock_min) as stock_min,
       (il.available_quantity <= coalesce(pv.stock_min, p.stock_min)) as reorder_alert
  from inventory_levels il
  join products p on p.id = il.product_id and p.tenant_id = il.tenant_id
  join warehouses w on w.id = il.warehouse_id and w.tenant_id = il.tenant_id
  left join product_variations pv on pv.id = il.variation_id and pv.tenant_id = il.tenant_id
 where p.deleted_at is null and p.track_stock;

-- Funciones habilitadas por tenant (plan + excepciones): base de los feature flags.
create view v_tenant_features with (security_invoker = true) as
select t.id as tenant_id, f.code as feature_code, f.name as feature_name,
       tenant_has_feature(t.id, f.code) as enabled
  from tenants t cross join features f;

-- Búsqueda global: letras → clientes, empresas, contactos, leads; números → pedidos, facturas, tickets.
-- search_text es lo que se compara (con índices trigram en las tablas origen).
create view v_global_search with (security_invoker = true) as
select tenant_id, case when customer_type = 'B2B' and person_type = 'Empresa' then 'empresa' else 'cliente' end as entity,
       id as entity_id, display_name as label, coalesce(email, number) as sublabel, status,
       lower(coalesce(display_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(number,'') || ' ' || coalesce(tax_id,'')) as search_text,
       'text'::text as kind
  from customers where deleted_at is null
union all
select tenant_id, 'contacto', id, name, coalesce(email, position), status,
       lower(coalesce(name,'') || ' ' || coalesce(email,'')), 'text'
  from customer_contacts where deleted_at is null
union all
select tenant_id, 'lead', id, name, coalesce(company, email), status,
       lower(coalesce(name,'') || ' ' || coalesce(company,'') || ' ' || coalesce(email,'')), 'text'
  from leads where deleted_at is null
union all
select tenant_id, 'pedido', id, coalesce(number, ''), null, status, lower(coalesce(number, '')), 'number'
  from sales where deleted_at is null
union all
select tenant_id, 'factura', id, coalesce(number, ''), null, status, lower(coalesce(number, '')), 'number'
  from invoices where deleted_at is null
union all
select tenant_id, 'ticket', id, coalesce(number, ''), subject, status, lower(coalesce(number, '') || ' ' || subject), 'number'
  from tickets where deleted_at is null
union all
select tenant_id, 'presupuesto', id, coalesce(number, ''), null, status, lower(coalesce(number, '')), 'number'
  from quotes where deleted_at is null;
