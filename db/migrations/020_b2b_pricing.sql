-- Fase 9 · B2B avanzado: precios escalonados, reglas dinámicas y cálculo de precio.
-- Orden del cálculo: precio base del producto → lista de precios del grupo (escala por cantidad) → reglas activas por prioridad.

alter table sale_items  add column applied_rules jsonb;
alter table quote_items add column applied_rules jsonb;

-- ===================== Motor de condiciones =====================
create function rule_cond_ok(p_field text, p_op text, p_value jsonb, p_ctx jsonb) returns boolean
language plpgsql immutable as $$
declare v jsonb := p_ctx -> p_field;
begin
  if v is null or v = 'null'::jsonb then return false; end if;
  return case p_op
    when '='  then v = p_value
    when '!=' then v <> p_value
    when '>'  then (v #>> '{}')::numeric >  (p_value #>> '{}')::numeric
    when '>=' then (v #>> '{}')::numeric >= (p_value #>> '{}')::numeric
    when '<'  then (v #>> '{}')::numeric <  (p_value #>> '{}')::numeric
    when '<=' then (v #>> '{}')::numeric <= (p_value #>> '{}')::numeric
    when 'in' then p_value @> jsonb_build_array(v)
    when 'not_in' then not (p_value @> jsonb_build_array(v))
    when 'between' then (v #>> '{}')::numeric between (p_value ->> 0)::numeric and (p_value ->> 1)::numeric
    else false end;
end $$;

-- Valida la definición de una regla (condiciones y acciones) antes de guardarla.
create function rule_validate(p_conditions jsonb, p_actions jsonb) returns void
language plpgsql immutable as $$
declare c jsonb; a jsonb; v_num boolean;
begin
  if jsonb_typeof(coalesce(p_actions, 'null'::jsonb)) <> 'array' or jsonb_array_length(p_actions) = 0 then
    raise exception 'La regla necesita al menos una acción' using errcode = 'check_violation';
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_conditions, '[]'::jsonb)) loop
    v_num := c ->> 'field' in ('quantity', 'cart_total');
    if c ->> 'field' not in ('customer_group','customer_type','customer','product','category','sku','quantity','cart_total','currency') then
      raise exception 'Campo de condición inválido: %', c ->> 'field' using errcode = 'check_violation'; end if;
    if c ->> 'operator' not in ('=','!=','>','>=','<','<=','in','not_in','between') then
      raise exception 'Operador inválido: %', c ->> 'operator' using errcode = 'check_violation'; end if;
    if c ->> 'operator' in ('>','>=','<','<=') and not v_num then
      raise exception 'El operador % solo aplica a cantidad o total del carrito', c ->> 'operator' using errcode = 'check_violation'; end if;
    if c ->> 'operator' in ('in','not_in') and jsonb_typeof(c -> 'value') <> 'array' then
      raise exception 'El operador % espera una lista de valores', c ->> 'operator' using errcode = 'check_violation'; end if;
    if c ->> 'operator' = 'between' and (jsonb_typeof(c -> 'value') <> 'array' or jsonb_array_length(c -> 'value') <> 2
         or (c -> 'value' ->> 0)::numeric > (c -> 'value' ->> 1)::numeric) then
      raise exception 'between espera [desde, hasta] con desde <= hasta' using errcode = 'check_violation'; end if;
    if v_num and c ->> 'operator' not in ('in','not_in','between') and jsonb_typeof(c -> 'value') <> 'number' then
      raise exception 'La condición sobre % espera un número', c ->> 'field' using errcode = 'check_violation'; end if;
  end loop;
  for a in select * from jsonb_array_elements(p_actions) loop
    if a ->> 'action_type' not in ('set_price','percent_discount','fixed_discount','free_shipping','min_order','hide_product','tax_exempt') then
      raise exception 'Acción inválida: %', a ->> 'action_type' using errcode = 'check_violation'; end if;
    if a ->> 'action_type' = 'percent_discount' and not ((a -> 'value' ->> 'percent')::numeric > 0 and (a -> 'value' ->> 'percent')::numeric <= 100) then
      raise exception 'El descuento debe ser mayor a 0 y hasta 100%%' using errcode = 'check_violation'; end if;
    if a ->> 'action_type' in ('set_price','fixed_discount','min_order') and coalesce((a -> 'value' ->> 'amount_minor')::numeric, -1) < 0 then
      raise exception 'La acción % necesita un importe (amount_minor) mayor o igual a 0', a ->> 'action_type' using errcode = 'check_violation'; end if;
  end loop;
end $$;

-- ===================== Cálculo de precio =====================
create function price_resolve(p_customer uuid, p_product uuid, p_qty numeric, p_cart_total bigint default 0)
returns table (base_minor bigint, list_minor bigint, tier_min_qty numeric, unit_price_minor bigint, line_total_minor bigint,
               free_shipping boolean, min_order_minor bigint, tax_exempt boolean, hidden boolean, applied jsonb)
language plpgsql stable as $$
#variable_conflict use_column
declare c customers; p products; g customer_groups; v_price bigint; v_list bigint; v_tier numeric; v_free boolean := false; v_min bigint := 0;
        v_exempt boolean := false; v_hidden boolean := false; v_applied jsonb := '[]'::jsonb; r dynamic_rules; ctx jsonb; act record; v_ok boolean;
        v_tiers boolean := tenant_has_feature(app_tenant(), 'price_tiers'); v_rules boolean := tenant_has_feature(app_tenant(), 'dynamic_rules');
begin
  if p_qty is null or p_qty <= 0 then raise exception 'La cantidad debe ser mayor a cero' using errcode = 'check_violation'; end if;
  select * into c from customers where id = p_customer and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Cliente inexistente' using errcode = 'no_data_found'; end if;
  select * into p from products where id = p_product and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Producto inexistente' using errcode = 'no_data_found'; end if;
  select * into g from customer_groups where id = c.customer_group_id and tenant_id = c.tenant_id;
  v_price := p.sale_price_minor; v_list := v_price;
  if g.default_price_list_id is not null then
    select pli.unit_price_minor, pli.min_qty into v_list, v_tier from price_list_items pli
     where pli.tenant_id = c.tenant_id and pli.price_list_id = g.default_price_list_id and pli.product_id = p.id and pli.variation_id is null
       and pli.deleted_at is null and pli.min_qty <= p_qty and (pli.min_qty = 1 or v_tiers)
     order by pli.min_qty desc limit 1;
    if found then v_price := v_list; else v_list := v_price; v_tier := null; end if;
  end if;
  ctx := jsonb_build_object('customer_group', c.customer_group_id, 'customer_type', c.customer_type, 'customer', c.id, 'product', p.id,
                            'category', p.category_id, 'sku', p.sku, 'quantity', p_qty, 'cart_total', coalesce(p_cart_total, 0) + round(p_qty * v_price)::bigint,
                            'currency', coalesce(c.currency, p.currency));
  if v_rules then
    for r in select * from dynamic_rules d where d.tenant_id = c.tenant_id and d.status = 'Activa' and d.deleted_at is null
                and (d.valid_from is null or d.valid_from <= current_date) and (d.valid_until is null or d.valid_until >= current_date)
              order by d.priority, d.created_at loop
      if r.customer_group_id is not null and r.customer_group_id is distinct from c.customer_group_id then continue; end if;
      if r.product_id is not null and r.product_id <> p.id then continue; end if;
      if r.category_id is not null and r.category_id is distinct from p.category_id then continue; end if;
      select coalesce(bool_and(rule_cond_ok(rc.field, rc.operator, rc.value, ctx)), true) into v_ok from rule_conditions rc where rc.rule_id = r.id and rc.tenant_id = r.tenant_id;
      if not v_ok then continue; end if;
      for act in select * from rule_actions ra where ra.rule_id = r.id and ra.tenant_id = r.tenant_id order by ra.sort_order loop
        if act.action_type = 'set_price' then v_price := (act.value ->> 'amount_minor')::bigint;
        elsif act.action_type = 'percent_discount' then v_price := round(v_price * (1 - (act.value ->> 'percent')::numeric / 100))::bigint;
        elsif act.action_type = 'fixed_discount' then v_price := greatest(v_price - (act.value ->> 'amount_minor')::bigint, 0);
        elsif act.action_type = 'free_shipping' then v_free := true;
        elsif act.action_type = 'min_order' then v_min := greatest(v_min, (act.value ->> 'amount_minor')::bigint);
        elsif act.action_type = 'tax_exempt' then v_exempt := true;
        elsif act.action_type = 'hide_product' then v_hidden := true; end if;
      end loop;
      v_applied := v_applied || jsonb_build_array(jsonb_build_object('rule_id', r.id, 'name', r.name, 'price_after', v_price));
      exit when r.stop_processing;
    end loop;
  end if;
  return query select p.sale_price_minor, v_list, v_tier, v_price, round(p_qty * v_price)::bigint, v_free, v_min, v_exempt, v_hidden, v_applied;
end $$;

-- ===================== Escalas por volumen =====================
create function price_tier_set(p_list uuid, p_product uuid, p_min_qty numeric, p_price bigint) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  perform require_permission('products.update');
  if p_min_qty is null or p_min_qty <= 0 then raise exception 'La cantidad mínima debe ser mayor a cero' using errcode = 'check_violation'; end if;
  if p_price is null or p_price < 0 then raise exception 'El precio no puede ser negativo' using errcode = 'check_violation'; end if;
  if p_min_qty > 1 and not tenant_has_feature(app_tenant(), 'price_tiers') then
    raise exception 'Tu plan no incluye precios escalonados' using errcode = 'insufficient_privilege'; end if;
  if not exists (select 1 from price_lists where id = p_list and tenant_id = app_tenant()) then raise exception 'Lista inexistente' using errcode = 'no_data_found'; end if;
  if exists (select 1 from price_list_items where tenant_id = app_tenant() and price_list_id = p_list and product_id = p_product and variation_id is null
              and deleted_at is null and min_qty < p_min_qty and unit_price_minor < p_price) then
    raise exception 'Una escala de mayor cantidad no puede costar más que una de menor cantidad' using errcode = 'check_violation'; end if;
  if exists (select 1 from price_list_items where tenant_id = app_tenant() and price_list_id = p_list and product_id = p_product and variation_id is null
              and deleted_at is null and min_qty > p_min_qty and unit_price_minor > p_price) then
    raise exception 'Una escala de menor cantidad no puede costar menos que una de mayor cantidad' using errcode = 'check_violation'; end if;
  update price_list_items set unit_price_minor = p_price
   where tenant_id = app_tenant() and price_list_id = p_list and product_id = p_product and variation_id is null and min_qty = p_min_qty and deleted_at is null
  returning id into v_id;
  if v_id is null then
    insert into price_list_items (tenant_id, price_list_id, product_id, min_qty, unit_price_minor) values (app_tenant(), p_list, p_product, p_min_qty, p_price) returning id into v_id;
  end if;
  return v_id;
end $$;

create function price_tier_delete(p_list uuid, p_product uuid, p_min_qty numeric) returns void
language plpgsql as $$
begin
  perform require_permission('products.update');
  update price_list_items set deleted_at = now()
   where tenant_id = app_tenant() and price_list_id = p_list and product_id = p_product and variation_id is null and min_qty = p_min_qty and deleted_at is null;
  if not found then raise exception 'Escala inexistente' using errcode = 'no_data_found'; end if;
end $$;

-- ===================== Reglas dinámicas =====================
create function rule_create(p_name text, p_priority int, p_conditions jsonb, p_actions jsonb, p_group uuid default null, p_product uuid default null,
                            p_valid_from date default null, p_valid_until date default null, p_stop boolean default false, p_status text default 'Activa') returns uuid
language plpgsql as $$
declare v_id uuid; x jsonb; i int := 0;
begin
  perform require_permission('products.update');
  if not tenant_has_feature(app_tenant(), 'dynamic_rules') then raise exception 'Tu plan no incluye reglas dinámicas' using errcode = 'insufficient_privilege'; end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'La regla necesita un nombre' using errcode = 'check_violation'; end if;
  perform rule_validate(p_conditions, p_actions);
  insert into dynamic_rules (tenant_id, name, priority, customer_group_id, product_id, valid_from, valid_until, stop_processing, status)
  values (app_tenant(), btrim(p_name), coalesce(p_priority, 100), p_group, p_product, p_valid_from, p_valid_until, coalesce(p_stop, false), p_status) returning id into v_id;
  for x in select * from jsonb_array_elements(coalesce(p_conditions, '[]'::jsonb)) loop
    insert into rule_conditions (tenant_id, rule_id, sort_order, field, operator, value) values (app_tenant(), v_id, i, x ->> 'field', x ->> 'operator', x -> 'value'); i := i + 1;
  end loop;
  i := 0;
  for x in select * from jsonb_array_elements(p_actions) loop
    insert into rule_actions (tenant_id, rule_id, sort_order, action_type, value) values (app_tenant(), v_id, i, x ->> 'action_type', x -> 'value'); i := i + 1;
  end loop;
  return v_id;
end $$;

create function rule_set_status(p_rule uuid, p_status text) returns void
language plpgsql as $$
begin
  perform require_permission('products.update');
  update dynamic_rules set status = p_status where id = p_rule and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Regla inexistente' using errcode = 'no_data_found'; end if;
end $$;

create function rule_delete(p_rule uuid) returns void
language plpgsql as $$
begin
  perform require_permission('products.update');
  update dynamic_rules set deleted_at = now(), status = 'Inactiva' where id = p_rule and tenant_id = app_tenant() and deleted_at is null;
  if not found then raise exception 'Regla inexistente' using errcode = 'no_data_found'; end if;
end $$;

-- ===================== Líneas con precio calculado =====================
create function sale_add_item(p_sale uuid, p_product uuid, p_qty numeric) returns uuid
language plpgsql as $$
declare s sales; pr record; p products; v_id uuid;
begin
  perform require_permission('sales.update');
  select * into s from sales where id = p_sale and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Venta inexistente' using errcode = 'no_data_found'; end if;
  if s.status in ('Cancelado', 'Devuelto') or exists (select 1 from invoices where sale_id = s.id and tenant_id = s.tenant_id and status <> 'Anulada' and deleted_at is null) then
    raise exception 'La venta ya no admite cambios de líneas' using errcode = 'check_violation'; end if;
  select * into pr from price_resolve(s.customer_id, p_product, p_qty, s.subtotal_minor);
  if pr.hidden then raise exception 'El producto no está disponible para este cliente' using errcode = 'check_violation'; end if;
  select * into p from products where id = p_product and tenant_id = s.tenant_id;
  insert into sale_items (tenant_id, sale_id, product_id, description, quantity, unit_price_minor, unit_cost_minor, applied_rules)
  values (s.tenant_id, s.id, p.id, p.name, p_qty, pr.unit_price_minor, p.purchase_price_minor, pr.applied) returning id into v_id;
  if pr.free_shipping and s.shipping_minor > 0 then update sales set shipping_minor = 0 where id = s.id; end if;
  return v_id;
end $$;

create function quote_add_item(p_quote uuid, p_product uuid, p_qty numeric) returns uuid
language plpgsql as $$
declare q quotes; pr record; p products; v_id uuid;
begin
  perform require_permission('quotes.update');
  select * into q from quotes where id = p_quote and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Presupuesto inexistente' using errcode = 'no_data_found'; end if;
  if q.status <> 'Borrador' then raise exception 'Solo se agregan líneas a un presupuesto en Borrador' using errcode = 'check_violation'; end if;
  select * into pr from price_resolve(q.customer_id, p_product, p_qty, q.subtotal_minor);
  if pr.hidden then raise exception 'El producto no está disponible para este cliente' using errcode = 'check_violation'; end if;
  select * into p from products where id = p_product and tenant_id = q.tenant_id;
  insert into quote_items (tenant_id, quote_id, product_id, description, quantity, unit_price_minor, applied_rules)
  values (q.tenant_id, q.id, p.id, p.name, p_qty, pr.unit_price_minor, pr.applied) returning id into v_id;
  return v_id;
end $$;

-- Pedido mínimo: si alguna regla vigente exige un mínimo y la venta no lo alcanza, no se factura.
create function sale_check_minimum(p_sale uuid) returns void
language plpgsql stable as $$
declare s sales; i record; v_min bigint := 0; v_m bigint;
begin
  select * into s from sales where id = p_sale and tenant_id = app_tenant();
  if not found then return; end if;
  for i in select product_id, quantity from sale_items where sale_id = s.id and tenant_id = s.tenant_id and product_id is not null loop
    select min_order_minor into v_m from price_resolve(s.customer_id, i.product_id, i.quantity, s.subtotal_minor - 0);
    v_min := greatest(v_min, coalesce(v_m, 0));
  end loop;
  if s.subtotal_minor < v_min then
    raise exception 'El pedido mínimo para este cliente es % (la venta suma %)', v_min, s.subtotal_minor using errcode = 'check_violation';
  end if;
end $$;

create or replace function sale_issue_invoice(p_sale uuid) returns uuid
language plpgsql as $$
declare s sales; v_inv uuid; v_total bigint; v_due date; v_issue date := current_date;
begin
  perform require_permission('invoices.create');
  select * into s from sales where id = p_sale and tenant_id = app_tenant() and deleted_at is null for update;
  if not found then raise exception 'Venta inexistente' using errcode = 'no_data_found'; end if;
  if s.status in ('Cancelado', 'Devuelto') then
    raise exception 'No se factura una venta %', s.status using errcode = 'check_violation';
  end if;
  if exists (select 1 from invoices where tenant_id = s.tenant_id and sale_id = s.id and status <> 'Anulada' and deleted_at is null) then
    raise exception 'La venta ya tiene una factura' using errcode = 'unique_violation';
  end if;
  if s.total_minor <= 0 then raise exception 'La venta no tiene importe para facturar' using errcode = 'check_violation'; end if;
  perform sale_check_minimum(s.id);
  v_due := greatest(coalesce(s.due_date, v_issue + s.payment_terms_days), v_issue);
  insert into invoices (tenant_id, customer_id, sale_id, project_id, issue_date, due_date, currency, exchange_rate, prices_include_tax,
                        discount_minor, shipping_minor, customer_snapshot)
  select s.tenant_id, s.customer_id, s.id, s.project_id, v_issue, v_due, s.currency, s.exchange_rate, s.prices_include_tax,
         s.discount_minor, s.shipping_minor,
         jsonb_build_object('name', c.display_name, 'tax_id', c.tax_id, 'tax_condition', c.tax_condition, 'billing_address', c.billing_address)
    from customers c where c.id = s.customer_id and c.tenant_id = s.tenant_id
  returning id into v_inv;
  insert into invoice_items (tenant_id, invoice_id, sort_order, product_id, variation_id, description, quantity, unit_price_minor, discount_minor, tax_rate_id)
  select tenant_id, v_inv, sort_order, product_id, variation_id, description, quantity, unit_price_minor, discount_minor, tax_rate_id
    from sale_items where sale_id = s.id and tenant_id = s.tenant_id;
  select total_minor into v_total from invoices where id = v_inv;
  insert into accounts_receivable (tenant_id, customer_id, sale_id, invoice_id, issue_date, due_date, currency, original_minor)
  values (s.tenant_id, s.customer_id, s.id, v_inv, v_issue, v_due, s.currency, v_total);
  return v_inv;
end $$;

-- ===================== Vistas =====================
create view v_price_tiers with (security_invoker = true) as
select pli.tenant_id, pli.price_list_id, pl.name as list_name, pli.product_id, p.sku, p.name as product_name,
       jsonb_agg(jsonb_build_object('min_qty', pli.min_qty, 'unit_price_minor', pli.unit_price_minor) order by pli.min_qty) as tiers
  from price_list_items pli
  join price_lists pl on pl.id = pli.price_list_id and pl.tenant_id = pli.tenant_id
  join products p on p.id = pli.product_id and p.tenant_id = pli.tenant_id
 where pli.deleted_at is null and pli.variation_id is null
 group by pli.tenant_id, pli.price_list_id, pl.name, pli.product_id, p.sku, p.name;

create view v_rules_overview with (security_invoker = true) as
select d.tenant_id, d.id, d.name, d.priority, d.status, d.valid_from, d.valid_until, d.stop_processing, d.customer_group_id, g.name as group_name,
       (d.status = 'Activa' and (d.valid_from is null or d.valid_from <= current_date) and (d.valid_until is null or d.valid_until >= current_date)) as in_force,
       coalesce((select jsonb_agg(jsonb_build_object('field', c.field, 'operator', c.operator, 'value', c.value) order by c.sort_order)
                   from rule_conditions c where c.rule_id = d.id and c.tenant_id = d.tenant_id), '[]'::jsonb) as conditions,
       coalesce((select jsonb_agg(jsonb_build_object('action_type', a.action_type, 'value', a.value) order by a.sort_order)
                   from rule_actions a where a.rule_id = d.id and a.tenant_id = d.tenant_id), '[]'::jsonb) as actions
  from dynamic_rules d left join customer_groups g on g.id = d.customer_group_id and g.tenant_id = d.tenant_id
 where d.deleted_at is null;

grant select on v_price_tiers, v_rules_overview to nexo_app, nexo_platform;
grant execute on function rule_cond_ok(text, text, jsonb, jsonb), rule_validate(jsonb, jsonb), price_resolve(uuid, uuid, numeric, bigint),
  price_tier_set(uuid, uuid, numeric, bigint), price_tier_delete(uuid, uuid, numeric),
  rule_create(text, int, jsonb, jsonb, uuid, uuid, date, date, boolean, text), rule_set_status(uuid, text), rule_delete(uuid),
  sale_add_item(uuid, uuid, numeric), quote_add_item(uuid, uuid, numeric), sale_check_minimum(uuid), sale_issue_invoice(uuid) to nexo_app, nexo_platform;
