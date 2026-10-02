-- Datos de demostración basados en CRM_ERP_Ecommerce_SaaS_Modelo_Funcional.xlsx
-- Los importes del Excel están en pesos; aquí se guardan en centavos (× 100).
-- Las inconsistencias del Excel corregidas están documentadas en docs/excel-issues.md.
-- Credencial de todos los usuarios demo: Demo1234!

do $seed$
declare
  t1 uuid; t2 uuid;
  r_admin uuid; r_ger uuid; r_ven uuid; r_con uuid;
  u_ana uuid; u_marcos uuid; u_carlos uuid; u_vale uuid; u_diego uuid;
  wh1 uuid; wh2 uuid; wh3 uuid;
  c_juan uuid; c_norte uuid; c_laura uuid; c_ml uuid;
  cat1 uuid; cat2 uuid;
  p_aur uuid; v_aur uuid; p_mouse uuid; p_tec uuid;
  pl_may uuid; sup uuid;
  s uuid; q uuid; inv uuid; ar uuid; pay uuid; pur uuid; ap uuid; rc uuid; proj uuid; tk uuid; mlacc uuid; mlpub uuid; rule uuid;
  grp_may uuid;
begin
  -- ---------- Plataforma ----------
  insert into platform_admins (email, name, password_hash)
  values ('admin@nexo.local', 'Super Admin', crypt('Demo1234!', gen_salt('bf', 8)));

  -- =====================================================================
  -- TENANT 1 · Demo Retail B2C (plan Básico)
  -- =====================================================================
  insert into tenants (slug, name, plan_id, status, created_at)
  values ('demo-retail', 'Demo Retail B2C', (select id from plans where code = 'basico'), 'Activo', '2026-01-10')
  returning id into t1;

  select id into r_admin from roles where tenant_id = t1 and code = 'admin';
  insert into users (tenant_id, email, name, password_hash, role_id, is_owner)
  values (t1, 'ana@example.com', 'Ana Demo', crypt('Demo1234!', gen_salt('bf', 8)), r_admin, true)
  returning id into u_ana;
  perform set_config('app.user_id', u_ana::text, true);

  select id into wh1 from warehouses where tenant_id = t1 and is_default;

  insert into customers (tenant_id, customer_type, person_type, first_name, last_name, email, phone, tax_id,
                         tax_condition, customer_group_id, status, created_at)
  values (t1, 'B2C', 'Persona Física', 'Juan', 'Pérez', 'juan@example.com', '1111111111', '20-11111111-1',
          'Consumidor Final', (select id from customer_groups where tenant_id = t1 and name = 'B2C General'), 'Activo', '2026-03-01')
  returning id into c_juan;

  insert into categories (tenant_id, name) values (t1, 'Electrónica') returning id into cat1;
  insert into products (tenant_id, sku, name, category_id, currency, purchase_price_minor, sale_price_minor,
                        weight_kg, stock_min, has_variations)
  values (t1, 'SKU-001', 'Auriculares Pro', cat1, 'ARS', 1500000, 2500000, 0.35, 5, true)
  returning id into p_aur;
  insert into product_variations (tenant_id, product_id, sku, attributes, purchase_price_minor, sale_price_minor)
  values (t1, p_aur, 'SKU-001-B', '{"Color": "Negro"}', 1500000, 2500000)
  returning id into v_aur;

  insert into stock_movements (tenant_id, occurred_at, warehouse_id, product_id, variation_id, movement_type, quantity, notes)
  values (t1, '2026-09-01 09:00-03', wh1, p_aur, v_aur, 'Stock inicial', 10, 'Stock inicial');

  -- Venta 1 (entregada y pagada)
  insert into sales (tenant_id, customer_id, source, sold_at, currency, warehouse_id, assigned_user_id)
  values (t1, c_juan, 'Web', '2026-09-20 11:00-03', 'ARS', wh1, u_ana) returning id into s;
  insert into sale_items (tenant_id, sale_id, product_id, variation_id, description, quantity, unit_price_minor, unit_cost_minor)
  values (t1, s, p_aur, v_aur, 'Auriculares Pro · Negro', 1, 2500000, 1500000);
  insert into invoices (tenant_id, customer_id, sale_id, issue_date, due_date, currency)
  values (t1, c_juan, s, '2026-09-20', '2026-09-20', 'ARS') returning id into inv;
  insert into invoice_items (tenant_id, invoice_id, product_id, variation_id, description, quantity, unit_price_minor)
  values (t1, inv, p_aur, v_aur, 'Auriculares Pro · Negro', 1, 2500000);
  insert into accounts_receivable (tenant_id, customer_id, sale_id, invoice_id, issue_date, due_date, currency, original_minor)
  values (t1, c_juan, s, inv, '2026-09-20', '2026-09-20', 'ARS', 2500000) returning id into ar;
  insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency, paid_at, reference, notes)
  values (t1, 'Entrada', c_juan, 'Transferencia', 2500000, 'ARS', '2026-09-20 11:30-03', 'TRX-001', 'Pago completo')
  returning id into pay;
  insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (t1, pay, ar, 2500000);
  insert into stock_movements (tenant_id, occurred_at, warehouse_id, product_id, variation_id, movement_type, quantity, reference_type, reference_id, notes)
  values (t1, '2026-09-20 12:00-03', wh1, p_aur, v_aur, 'Venta', -1, 'sale', s, 'Salida por venta');
  update sales set status = 'En Preparación' where id = s;
  update sales set status = 'Enviado' where id = s;
  update sales set status = 'Entregado', completed_at = null where id = s;

  -- Presupuesto aceptado y convertido en venta (queda pendiente de pago)
  insert into quotes (tenant_id, customer_id, quote_date, valid_until, currency, assigned_user_id, created_at)
  values (t1, c_juan, '2026-09-23', '2026-10-08', 'ARS', u_ana, '2026-09-23') returning id into q;
  insert into quote_items (tenant_id, quote_id, product_id, variation_id, description, quantity, unit_price_minor)
  values (t1, q, p_aur, v_aur, 'Auriculares Pro · Negro', 1, 2500000);
  update quotes set status = 'Enviado', sent_at = '2026-09-23 10:00-03' where id = q;
  update quotes set status = 'Visto', viewed_at = '2026-09-23 12:00-03' where id = q;
  update quotes set status = 'Aceptado', accepted_at = '2026-09-24 09:00-03', accepted_by_name = 'Juan Pérez' where id = q;
  insert into sales (tenant_id, customer_id, quote_id, source, sold_at, due_date, currency, warehouse_id, assigned_user_id)
  values (t1, c_juan, q, 'Web', '2026-09-24 09:05-03', '2026-10-08', 'ARS', wh1, u_ana) returning id into s;
  insert into sale_items (tenant_id, sale_id, product_id, variation_id, description, quantity, unit_price_minor, unit_cost_minor)
  values (t1, s, p_aur, v_aur, 'Auriculares Pro · Negro', 1, 2500000, 1500000);
  insert into accounts_receivable (tenant_id, customer_id, sale_id, issue_date, due_date, currency, original_minor)
  values (t1, c_juan, s, '2026-09-24', '2026-10-08', 'ARS', 2500000);
  update quotes set status = 'Convertido a Venta', converted_sale_id = s where id = q;

  insert into leads (tenant_id, name, email, phone, source, owner_user_id, estimated_value_minor, currency, created_at)
  values (t1, 'Sofía Díaz', 'sofia@example.com', '1177777777', 'Instagram', u_ana, 5000000, 'ARS', '2026-09-12');
  update leads set status = 'Contactado' where tenant_id = t1 and email = 'sofia@example.com';
  update leads set status = 'Calificado' where tenant_id = t1 and email = 'sofia@example.com';

  -- =====================================================================
  -- TENANT 2 · Demo Distribuidora B2B (plan B2B)
  -- =====================================================================
  insert into tenants (slug, name, plan_id, status, created_at)
  values ('demo-distribuidora', 'Demo Distribuidora B2B', (select id from plans where code = 'b2b'), 'Activo', '2026-02-15')
  returning id into t2;

  select id into r_admin from roles where tenant_id = t2 and code = 'admin';
  select id into r_ger from roles where tenant_id = t2 and code = 'gerente';
  select id into r_ven from roles where tenant_id = t2 and code = 'vendedor';
  select id into r_con from roles where tenant_id = t2 and code = 'contable';
  insert into users (tenant_id, email, name, password_hash, role_id, is_owner)
  values (t2, 'marcos@example.com', 'Marcos Admin', crypt('Demo1234!', gen_salt('bf', 8)), r_admin, true) returning id into u_marcos;
  insert into users (tenant_id, email, name, password_hash, role_id)
  values (t2, 'carlos@example.com', 'Carlos Demo', crypt('Demo1234!', gen_salt('bf', 8)), r_ger) returning id into u_carlos;
  insert into users (tenant_id, email, name, password_hash, role_id)
  values (t2, 'valeria@example.com', 'Valeria Ventas', crypt('Demo1234!', gen_salt('bf', 8)), r_ven) returning id into u_vale;
  insert into users (tenant_id, email, name, password_hash, role_id)
  values (t2, 'diego@example.com', 'Diego Cuentas', crypt('Demo1234!', gen_salt('bf', 8)), r_con) returning id into u_diego;
  perform set_config('app.user_id', u_carlos::text, true);

  update tenant_settings set value = 'true' where tenant_id = t2 and setting_key = 'wallet_auto_apply';
  insert into tenant_settings (tenant_id, category, setting_key, value, description)
  values (t2, 'ML', 'future_integration', 'true', 'Estructura preparada para MercadoLibre');

  -- Depósitos: el principal se renombra a "Depósito Central" y se agrega "Depósito Norte"
  update warehouses set code = 'CENTRAL', name = 'Depósito Central', location = 'Centro' where tenant_id = t2 and is_default
  returning id into wh2;
  insert into warehouses (tenant_id, code, name, location) values (t2, 'NORTE', 'Depósito Norte', 'Norte') returning id into wh3;

  select id into grp_may from customer_groups where tenant_id = t2 and name = 'Mayorista';
  insert into customers (tenant_id, customer_type, person_type, company_name, email, phone, tax_id, tax_condition,
                         customer_group_id, payment_terms_days, assigned_user_id, created_at)
  values (t2, 'B2B', 'Empresa', 'Distribuidora Norte', 'ventas@dnorte.com', '1122222222', '30-22222222-2',
          'Responsable Inscripto', grp_may, 30, u_carlos, '2026-03-05') returning id into c_norte;
  insert into customers (tenant_id, customer_type, person_type, first_name, last_name, email, phone, tax_id,
                         tax_condition, customer_group_id, created_at)
  values (t2, 'B2B', 'Persona Física', 'Laura', 'Gómez', 'laura@example.com', '1133333333', '27-33333333-3',
          'Monotributo', grp_may, '2026-03-07') returning id into c_laura;
  insert into customers (tenant_id, customer_type, person_type, first_name, last_name, email, source)
  values (t2, 'B2C', 'Persona Física', 'Comprador', 'MercadoLibre', 'comprador@example.com', 'MercadoLibre')
  returning id into c_ml;
  insert into customer_contacts (tenant_id, customer_id, name, email, phone, position, is_primary)
  values (t2, c_norte, 'María Norte', 'maria@dnorte.com', '1144444444', 'Compras', true);

  insert into categories (tenant_id, name) values (t2, 'Mayorista') returning id into cat2;
  insert into products (tenant_id, sku, name, category_id, currency, purchase_price_minor, sale_price_minor, b2b_price_minor, weight_kg, stock_min)
  values (t2, 'SKU-002', 'Mouse Pro', cat2, 'ARS', 500000, 900000, 750000, 0.2, 10) returning id into p_mouse;
  insert into products (tenant_id, sku, name, category_id, currency, purchase_price_minor, sale_price_minor, b2b_price_minor, weight_kg, stock_min)
  values (t2, 'SKU-003', 'Teclado Mecánico', cat2, 'ARS', 1200000, 2200000, 1850000, 0.8, 5) returning id into p_tec;

  -- Lista mayorista con precios escalonados
  select id into pl_may from price_lists where tenant_id = t2 and code = 'MAYORISTA';
  insert into price_list_items (tenant_id, price_list_id, product_id, min_qty, unit_price_minor) values
    (t2, pl_may, p_mouse, 1, 750000), (t2, pl_may, p_mouse, 10, 700000), (t2, pl_may, p_tec, 1, 1850000);

  insert into suppliers (tenant_id, name, email, phone, tax_id, payment_terms_days)
  values (t2, 'Proveedor Central', 'proveedor@example.com', '1155555555', '30-55555555-5', 30) returning id into sup;

  insert into stock_movements (tenant_id, occurred_at, warehouse_id, product_id, movement_type, quantity, notes) values
    (t2, '2026-09-01 09:00-03', wh2, p_mouse, 'Stock inicial', 5, 'Stock inicial'),
    (t2, '2026-09-01 09:00-03', wh2, p_tec, 'Stock inicial', 5, 'Stock inicial');

  -- Compra PUR-001: ordenada, recibida completa, pagada en parte
  insert into purchases (tenant_id, supplier_id, purchase_date, payment_terms_days, currency, warehouse_id)
  values (t2, sup, '2026-09-20', 30, 'ARS', wh2) returning id into pur;
  insert into purchase_items (tenant_id, purchase_id, product_id, description, quantity, unit_price_minor) values
    (t2, pur, p_mouse, 'Mouse Pro', 1, 500000), (t2, pur, p_tec, 'Teclado Mecánico', 1, 1200000);
  update purchases set status = 'Ordenado' where id = pur;
  insert into purchase_receipts (tenant_id, purchase_id, warehouse_id, received_at)
  values (t2, pur, wh2, '2026-09-21 10:00-03') returning id into rc;
  insert into purchase_receipt_items (tenant_id, receipt_id, purchase_item_id, quantity)
  select t2, rc, id, quantity from purchase_items where purchase_id = pur;
  insert into accounts_payable (tenant_id, supplier_id, purchase_id, issue_date, due_date, currency, original_minor)
  values (t2, sup, pur, '2026-09-20', '2026-10-20', 'ARS', 1700000) returning id into ap;
  insert into payments (tenant_id, direction, supplier_id, method, amount_minor, currency, paid_at, reference, notes)
  values (t2, 'Salida', sup, 'Transferencia', 700000, 'ARS', '2026-09-23 10:00-03', 'TRX-003', 'Pago proveedor')
  returning id into pay;
  insert into payment_allocations (tenant_id, payment_id, payable_id, amount_minor) values (t2, pay, ap, 700000);

  -- Venta B2B a crédito (Excel SAL-002): factura, pago parcial y preparación
  insert into sales (tenant_id, customer_id, source, sold_at, payment_terms_days, due_date, currency, warehouse_id, assigned_user_id)
  values (t2, c_norte, 'Web', '2026-09-21 09:00-03', 30, '2026-10-21', 'ARS', wh2, u_carlos) returning id into s;
  insert into sale_items (tenant_id, sale_id, sort_order, product_id, description, quantity, unit_price_minor, unit_cost_minor) values
    (t2, s, 1, p_mouse, 'Mouse Pro', 1, 900000, 500000),
    (t2, s, 2, p_tec, 'Teclado Mecánico', 1, 2200000, 1200000),
    (t2, s, 3, p_mouse, 'Mouse Pro (precio negociado)', 1, 650000, 500000);
  insert into invoices (tenant_id, customer_id, sale_id, issue_date, due_date, currency)
  values (t2, c_norte, s, '2026-09-21', '2026-10-21', 'ARS') returning id into inv;
  insert into invoice_items (tenant_id, invoice_id, sort_order, product_id, description, quantity, unit_price_minor) values
    (t2, inv, 1, p_mouse, 'Mouse Pro', 1, 900000),
    (t2, inv, 2, p_tec, 'Teclado Mecánico', 1, 2200000),
    (t2, inv, 3, p_mouse, 'Mouse Pro (precio negociado)', 1, 650000);
  insert into accounts_receivable (tenant_id, customer_id, sale_id, invoice_id, issue_date, due_date, currency, original_minor)
  values (t2, c_norte, s, inv, '2026-09-21', '2026-10-21', 'ARS', 3750000) returning id into ar;
  insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency, paid_at, reference, notes)
  values (t2, 'Entrada', c_norte, 'Transferencia', 2000000, 'ARS', '2026-09-22 15:00-03', 'TRX-002', 'Pago parcial')
  returning id into pay;
  insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (t2, pay, ar, 2000000);
  insert into stock_movements (tenant_id, occurred_at, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, notes) values
    (t2, '2026-09-21 12:00-03', wh2, p_mouse, 'Venta', -2, 'sale', s, 'Salida venta'),
    (t2, '2026-09-21 12:00-03', wh2, p_tec, 'Venta', -1, 'sale', s, 'Salida venta');
  update sales set status = 'En Preparación' where id = s;

  -- Billetera del cliente: saldo a favor pendiente de aplicar a la deuda
  insert into wallet_transactions (tenant_id, customer_id, occurred_at, type, amount_minor, currency, reference_type, notes)
  values (t2, c_norte, '2026-09-10 10:00-03', 'Carga', 200000, 'ARS', 'manual', 'Saldo inicial');

  -- Presupuesto enviado
  insert into quotes (tenant_id, customer_id, quote_date, valid_until, currency, assigned_user_id, created_at)
  values (t2, c_norte, '2026-09-22', '2026-10-07', 'ARS', u_carlos, '2026-09-22') returning id into q;
  insert into quote_items (tenant_id, quote_id, product_id, description, quantity, unit_price_minor)
  values (t2, q, p_mouse, 'Mouse Pro', 4, 750000);
  update quotes set status = 'Enviado', sent_at = '2026-09-22 16:00-03' where id = q;

  -- MercadoLibre (estructura): publicación, orden convertida en pedido pagado, pregunta y sincronización
  insert into ml_accounts (tenant_id, ml_user_id, nickname, status) values (t2, '123456789', 'DEMO_DISTRIBUIDORA', 'Pendiente')
  returning id into mlacc;
  insert into ml_publications (tenant_id, ml_account_id, product_id, ml_item_id, title, status, price_minor, currency, stock_quantity, last_sync_at)
  values (t2, mlacc, p_mouse, 'MLA-DEMO-001', 'Mouse Pro', 'Preparado', 900000, 'ARS', 4, '2026-09-25')
  returning id into mlpub;
  insert into sales (tenant_id, customer_id, source, external_ref, sold_at, currency, warehouse_id)
  values (t2, c_ml, 'MercadoLibre', 'ML-ORDER-001', '2026-09-25 14:00-03', 'ARS', wh2) returning id into s;
  insert into sale_items (tenant_id, sale_id, product_id, description, quantity, unit_price_minor, unit_cost_minor)
  values (t2, s, p_mouse, 'Mouse Pro', 1, 900000, 500000);
  insert into accounts_receivable (tenant_id, customer_id, sale_id, issue_date, due_date, currency, original_minor)
  values (t2, c_ml, s, '2026-09-25', '2026-09-25', 'ARS', 900000) returning id into ar;
  insert into payments (tenant_id, direction, customer_id, method, amount_minor, currency, paid_at, reference, provider, provider_payment_id)
  values (t2, 'Entrada', c_ml, 'Mercado Pago', 900000, 'ARS', '2026-09-25 14:01-03', 'MP-DEMO-001', 'mercadopago', 'MP-DEMO-001')
  returning id into pay;
  insert into payment_allocations (tenant_id, payment_id, receivable_id, amount_minor) values (t2, pay, ar, 900000);
  insert into stock_movements (tenant_id, occurred_at, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, notes)
  values (t2, '2026-09-25 14:05-03', wh2, p_mouse, 'Venta', -1, 'sale', s, 'Venta MercadoLibre');
  insert into ml_sales (tenant_id, ml_account_id, ml_order_id, customer_email, customer_id, sale_id, status, total_minor, currency, ordered_at)
  values (t2, mlacc, 'ML-ORDER-001', 'comprador@example.com', c_ml, s, 'Pagado', 900000, 'ARS', '2026-09-25 14:00-03');
  insert into ml_questions (tenant_id, ml_account_id, ml_item_id, publication_id, question, answer, status, asked_at, answered_at)
  values (t2, mlacc, 'MLA-DEMO-001', mlpub, '¿Tiene garantía?', 'Sí, 12 meses.', 'Respondida', '2026-09-25 09:00-03', '2026-09-25 09:30-03');
  insert into ml_stock_sync (tenant_id, publication_id, product_id, warehouse_id, ml_item_id, local_stock, ml_stock, status, last_sync_at)
  values (t2, mlpub, p_mouse, wh2, 'MLA-DEMO-001', 3, 4, 'Pendiente', '2026-09-25');

  -- CRM
  insert into leads (tenant_id, name, email, phone, company, source, owner_user_id, estimated_value_minor, currency, created_at)
  values (t2, 'Pedro Ruiz', 'pedro@example.com', '1166666666', 'Comercial Sur', 'Web', u_carlos, 12000000, 'ARS', '2026-09-10');
  update leads set status = 'Contactado' where tenant_id = t2 and email = 'pedro@example.com';
  update leads set status = 'Calificado' where tenant_id = t2 and email = 'pedro@example.com';
  update leads set status = 'Propuesta Enviada' where tenant_id = t2 and email = 'pedro@example.com';
  update leads set status = 'Negociación' where tenant_id = t2 and email = 'pedro@example.com';

  insert into projects (tenant_id, customer_id, name, description, status, start_date, due_date, owner_user_id, billable, billing_mode, budget_minor, currency)
  values (t2, c_norte, 'Implementación catálogo', 'Carga y revisión de catálogo', 'En Progreso', '2026-09-01', '2026-10-01', u_carlos, true, 'Precio fijo', 15000000, 'ARS')
  returning id into proj;
  insert into project_members (tenant_id, project_id, user_id, role) values (t2, proj, u_carlos, 'Responsable'), (t2, proj, u_vale, 'Miembro');
  insert into tasks (tenant_id, title, description, project_id, assigned_user_id, status, priority, due_date, billable, visibility)
  values (t2, 'Revisar precios', 'Actualizar precios mayoristas', proj, u_carlos, 'En Progreso', 'Alta', '2026-09-28', true, 'Pública');
  insert into tasks (tenant_id, title, description, customer_id, assigned_user_id, status, priority, due_date, billable, visibility)
  values (t2, 'Llamar cliente', 'Seguimiento comercial', c_norte, u_carlos, 'Pendiente', 'Media', '2026-09-29', false, 'Privada');

  insert into tickets (tenant_id, customer_id, subject, priority, assigned_user_id, created_at, last_activity_at)
  values (t2, c_norte, 'Consulta sobre pedido', 'Alta', u_carlos, '2026-09-22', '2026-09-25') returning id into tk;
  insert into ticket_messages (tenant_id, ticket_id, author_type, body, created_at)
  values (t2, tk, 'Cliente', '¿Cuándo despachan el pedido del 21/09?', '2026-09-22 16:00-03');

  insert into calls (tenant_id, occurred_at, direction, customer_id, user_id, subject, duration_minutes, outcome, notes)
  values (t2, '2026-09-24 11:00-03', 'Saliente', c_norte, u_carlos, 'Seguimiento pedido', 8, 'Seguimiento', 'Solicita actualización');
  insert into calendar_events (tenant_id, title, event_type, starts_at, ends_at, owner_user_id, customer_id, visibility)
  values (t2, 'Reunión comercial', 'Cita', '2026-09-28 10:00-03', '2026-09-28 11:00-03', u_carlos, c_norte, 'Privada');
  insert into notes (tenant_id, linked_type, linked_id, body, pinned)
  values (t2, 'customer', c_norte, 'Solicitan factura A y entrega en el Depósito Norte.', true);
  insert into reminders (tenant_id, user_id, linked_type, linked_id, remind_at, text)
  values (t2, u_carlos, 'customer', c_norte, '2026-10-02 09:00-03', 'Confirmar fecha de entrega con Distribuidora Norte');
  insert into notifications (tenant_id, user_id, type, title, message, linked_type, linked_id, created_at)
  values (t2, u_carlos, 'Ticket', 'Ticket abierto', 'Hay un ticket abierto de prioridad alta.', 'ticket', tk, '2026-09-25 09:00-03');
  insert into announcements (tenant_id, title, message, audience, status, show_customer_frontend, publish_at)
  values (t2, 'Mantenimiento', 'Mantenimiento programado', 'Todos', 'Publicado', true, '2026-09-25');

  insert into expenses (tenant_id, expense_date, category_id, description, currency, amount_minor, payment_method, status, paid_at)
  values (t2, '2026-09-20', (select id from expense_categories where tenant_id = t2 and name = 'Servicios'),
          'Internet', 'ARS', 1500000, 'Transferencia', 'Pagado', '2026-09-20');

  -- Reglas dinámicas B2B
  insert into dynamic_rules (tenant_id, name, customer_group_id, product_id, priority, status, valid_from, valid_until)
  values (t2, 'Mayorista Mouse', grp_may, p_mouse, 10, 'Activa', '2026-01-01', '2026-12-31') returning id into rule;
  insert into rule_conditions (tenant_id, rule_id, field, operator, value) values (t2, rule, 'quantity', '>=', '10');
  insert into rule_actions (tenant_id, rule_id, action_type, value) values (t2, rule, 'set_price', '{"amount_minor": 700000}');

  perform set_config('app.user_id', '', true);
end
$seed$;
