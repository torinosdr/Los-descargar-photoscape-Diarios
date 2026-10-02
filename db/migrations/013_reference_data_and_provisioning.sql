-- 013 · Datos de referencia globales y alta automática de un tenant (provisioning)

insert into currencies (code, name, symbol, minor_unit) values
  ('ARS','Peso argentino','$',2), ('USD','Dólar estadounidense','US$',2), ('EUR','Euro','€',2),
  ('BRL','Real brasileño','R$',2), ('CLP','Peso chileno','$',0), ('UYU','Peso uruguayo','$U',2),
  ('MXN','Peso mexicano','$',2), ('COP','Peso colombiano','$',2), ('PEN','Sol peruano','S/',2),
  ('PYG','Guaraní','₲',0), ('BOB','Boliviano','Bs.',2);

insert into locales (code, name) values
  ('es-AR','Español (Argentina)'), ('es','Español'), ('en','English'), ('pt-BR','Português (Brasil)');

insert into plans (code, name, description, currency, sort_order) values
  ('basico','Básico','B2C y facturación simple','ARS',1),
  ('pro','Pro','B2C, B2B y CRM completo','ARS',2),
  ('b2b','B2B','Todo lo anterior más reglas dinámicas, precios escalonados, subcuentas, multi-depósito y MercadoLibre avanzado','ARS',3);

insert into features (code, name, description, sort_order) values
  ('b2c','Ventas B2C','Clientes minoristas y venta directa',1),
  ('simple_billing','Facturación simple','Facturas y cuentas por cobrar',2),
  ('b2b','Ventas B2B','Clientes empresa, contactos múltiples y listas de precios por grupo',3),
  ('crm','CRM completo','Leads, proyectos, tareas, tickets, llamadas y agenda',4),
  ('dynamic_rules','Reglas dinámicas B2B','Reglas de precios y condiciones',5),
  ('price_tiers','Precios escalonados','Precios por volumen',6),
  ('subaccounts','Subcuentas','Subcuentas de clientes empresa',7),
  ('multi_warehouse','Multi-depósito','Más de un depósito',8),
  ('ml_advanced','MercadoLibre avanzado','Sincronización avanzada con MercadoLibre',9);

insert into plan_features (plan_id, feature_id)
select p.id, f.id from plans p join features f on
  (p.code = 'basico' and f.code in ('b2c','simple_billing'))
  or (p.code = 'pro' and f.code in ('b2c','simple_billing','b2b','crm'))
  or (p.code = 'b2b');

-- Catálogo de permisos: recurso.acción
insert into permissions (code, resource, action, description)
select r || '.' || a, r, a, initcap(a) || ' · ' || r
  from unnest(array['customers','products','inventory','suppliers','quotes','sales','sale_returns','invoices',
                    'credit_notes','receivables','payments','wallet','purchases','payables','expenses','leads',
                    'projects','tasks','tickets','calls','calendar','notes','files','announcements','reports',
                    'users','roles','settings','audit','b2b_rules','mercadolibre']) r
  cross join unnest(array['read','create','update','delete']) a;
insert into permissions (code, resource, action, description) values
  ('sales.cancel','sales','cancel','Cancelar ventas'),
  ('quotes.send','quotes','send','Enviar presupuestos'),
  ('payments.refund','payments','refund','Reembolsar pagos'),
  ('wallet.adjust','wallet','adjust','Ajustar billetera de clientes'),
  ('inventory.adjust','inventory','adjust','Ajustar stock'),
  ('data.export','data','export','Exportar datos');

-- Máquinas de estado (hoja Workflows del Excel + alternativas del prompt)
insert into workflow_transitions (entity, from_status, to_status, description) values
  ('Quote','Borrador','Enviado','Enviar presupuesto'),
  ('Quote','Enviado','Visto','Cliente abrió enlace'),
  ('Quote','Visto','Aceptado','Cliente acepta'),
  ('Quote','Visto','Rechazado','Cliente rechaza'),
  ('Quote','Enviado','Aceptado','Aceptación registrada por el equipo'),
  ('Quote','Enviado','Rechazado','Cliente rechaza sin abrir el enlace'),
  ('Quote','Aceptado','Convertido a Venta','Crear venta automáticamente'),
  ('Quote','Borrador','Vencido','Venció la validez'),
  ('Quote','Enviado','Vencido','Venció la validez'),
  ('Quote','Visto','Vencido','Venció la validez'),
  ('Quote','Rechazado','Borrador','Reabrir'),
  ('Quote','Vencido','Borrador','Reabrir'),
  ('Sale','Pendiente de Pago','Pago Parcial','Registrar pago parcial'),
  ('Sale','Pago Parcial','Pagado','Completar pago'),
  ('Sale','Pendiente de Pago','Pagado','Pago total'),
  ('Sale','Pagado','En Preparación','Iniciar preparación'),
  ('Sale','Pendiente de Pago','En Preparación','Preparar a crédito'),
  ('Sale','Pago Parcial','En Preparación','Preparar con pago parcial'),
  ('Sale','En Preparación','Enviado','Despachar'),
  ('Sale','Enviado','Entregado','Confirmar entrega'),
  ('Sale','Entregado','Completado','Cerrar operación'),
  ('Sale','Pagado','Pago Parcial','Reversión de pago'),
  ('Sale','Pagado','Pendiente de Pago','Reversión de pago'),
  ('Sale','Pago Parcial','Pendiente de Pago','Reversión de pago'),
  ('Sale','Pendiente de Pago','Cancelado','Cancelar'),
  ('Sale','Pago Parcial','Cancelado','Cancelar'),
  ('Sale','Pagado','Cancelado','Cancelar'),
  ('Sale','En Preparación','Cancelado','Cancelar'),
  ('Sale','Enviado','Devuelto','Devolución'),
  ('Sale','Entregado','Devuelto','Devolución'),
  ('Sale','Completado','Devuelto','Devolución'),
  ('Purchase','Borrador','Ordenado','Enviar orden'),
  ('Purchase','Ordenado','Recibido Parcial','Recepción parcial'),
  ('Purchase','Recibido Parcial','Recibido Total','Completar recepción'),
  ('Purchase','Ordenado','Recibido Total','Recepción completa'),
  ('Purchase','Recibido Total','Pagado','Cancelar deuda'),
  ('Purchase','Borrador','Cancelado','Cancelar'),
  ('Purchase','Ordenado','Cancelado','Cancelar'),
  ('Purchase','Recibido Parcial','Cancelado','Cancelar'),
  ('Lead','Nuevo','Contactado','Primer contacto'),
  ('Lead','Contactado','Calificado','Calificar lead'),
  ('Lead','Calificado','Propuesta Enviada','Enviar propuesta'),
  ('Lead','Propuesta Enviada','Negociación','Negociar'),
  ('Lead','Negociación','Ganado','Convertir'),
  ('Lead','Nuevo','Perdido','Descartar'),
  ('Lead','Contactado','Perdido','Descartar'),
  ('Lead','Calificado','Perdido','Descartar'),
  ('Lead','Propuesta Enviada','Perdido','Descartar'),
  ('Lead','Negociación','Perdido','Descartar'),
  ('Lead','Perdido','Nuevo','Reabrir'),
  ('Ticket','Abierto','En Progreso','Tomar ticket'),
  ('Ticket','En Progreso','Esperando Cliente','Esperar respuesta'),
  ('Ticket','En Progreso','Resuelto','Resolver'),
  ('Ticket','Resuelto','Cerrado','Cerrar'),
  ('Ticket','Esperando Cliente','En Progreso','El cliente respondió'),
  ('Ticket','Esperando Cliente','Resuelto','Resolver'),
  ('Ticket','Resuelto','En Progreso','Reabrir'),
  ('Ticket','Abierto','Cerrado','Cerrar sin tratar'),
  ('Ticket','Cerrado','Abierto','Reabrir');

-- ===================== Alta automática de un tenant =====================
create function provision_tenant(p_tenant uuid) returns void
language plpgsql as $$
declare
  v_t tenants; v_pl uuid; v_pl_b2b uuid;
begin
  select * into v_t from tenants where id = p_tenant;

  -- Numeración correlativa
  insert into document_sequences (tenant_id, doc_type, prefix)
  select p_tenant, d, default_doc_prefix(d)
    from unnest(array['customer','supplier','quote','sale','invoice','payment','sale_return','credit_note',
                      'purchase','receipt','expense','lead','project','task','ticket']) d;

  -- Roles del sistema
  insert into roles (tenant_id, code, name, description, is_system) values
    (p_tenant,'admin','Admin','Acceso completo del tenant',true),
    (p_tenant,'gerente','Gerente','Gestión operativa y reportes',true),
    (p_tenant,'vendedor','Vendedor','Ventas, clientes y CRM operativo',true),
    (p_tenant,'contable','Contable','Finanzas, pagos y cuentas',true),
    (p_tenant,'lectura','Solo Lectura','Consulta sin edición',true);

  insert into role_permissions (tenant_id, role_id, permission_code)
  select p_tenant, r.id, p.code
    from roles r join permissions p on (
      r.code = 'admin'
      or (r.code = 'gerente' and p.resource not in ('roles') and not (p.resource = 'users' and p.action <> 'read')
                             and not (p.resource = 'settings' and p.action <> 'read'))
      or (r.code = 'vendedor' and (
            (p.resource in ('customers','quotes','sales','leads','tasks','tickets','calls','calendar','notes','files')
               and p.action in ('read','create','update'))
         or (p.resource in ('products','inventory','projects','payments','wallet','announcements','receivables') and p.action = 'read')
         or p.code = 'quotes.send'))
      or (r.code = 'contable' and (
            (p.resource in ('invoices','credit_notes','receivables','payments','wallet','payables','expenses')
               and p.action in ('read','create','update'))
         or (p.resource in ('customers','suppliers','sales','sale_returns','quotes','purchases','products','reports','announcements','notes') and p.action = 'read')
         or p.code in ('payments.refund','wallet.adjust','data.export')))
      or (r.code = 'lectura' and p.action = 'read' and p.resource not in ('users','roles','settings','audit'))
    )
   where r.tenant_id = p_tenant;

  -- Impuestos
  if v_t.country = 'AR' then
    insert into tax_rates (tenant_id, code, name, kind, rate_percent, is_default) values
      (p_tenant,'IVA21','IVA 21%','IVA',21,true),
      (p_tenant,'IVA105','IVA 10,5%','IVA',10.5,false),
      (p_tenant,'IVA27','IVA 27%','IVA',27,false),
      (p_tenant,'EXENTO','Exento','Exento',0,false),
      (p_tenant,'NOGRAV','No gravado','No gravado',0,false);
  else
    insert into tax_rates (tenant_id, code, name, kind, rate_percent, is_default) values
      (p_tenant,'SIN_IMP','Sin impuesto','Exento',0,true);
  end if;

  insert into points_of_sale (tenant_id, number, name) values (p_tenant, 1, 'Punto de venta 1');

  insert into warehouses (tenant_id, code, name, location, is_default)
  values (p_tenant, 'PRINCIPAL', 'Depósito Principal', null, true);

  -- Listas de precios y grupos de clientes
  insert into price_lists (tenant_id, code, name, currency, is_default)
  values (p_tenant, 'PVP', 'Precio de venta al público', v_t.base_currency, true)
  returning id into v_pl;
  insert into customer_groups (tenant_id, name, description, default_price_list_id)
  values (p_tenant, 'B2C General', 'Clientes minoristas', v_pl);

  if tenant_has_feature(p_tenant, 'b2b') then
    insert into price_lists (tenant_id, code, name, currency)
    values (p_tenant, 'MAYORISTA', 'Lista mayorista', v_t.base_currency)
    returning id into v_pl_b2b;
    insert into customer_groups (tenant_id, name, description, is_b2b, default_price_list_id)
    values (p_tenant, 'Mayorista', 'Clientes mayoristas', true, v_pl_b2b);
  end if;

  -- Configuración inicial
  insert into tenant_settings (tenant_id, category, setting_key, value, description) values
    (p_tenant,'Ventas','default_sale_status','"Pendiente de Pago"','Estado inicial de una venta'),
    (p_tenant,'Ventas','reserve_stock_on_sale','true','Reservar stock al confirmar la venta'),
    (p_tenant,'Ventas','prices_include_tax',case when v_t.country = 'AR' then 'true' else 'false' end::jsonb,'Los precios de venta incluyen impuestos'),
    (p_tenant,'Finanzas','wallet_auto_apply','false','Aplicar saldo de billetera a la deuda más antigua'),
    (p_tenant,'Inventario','allow_negative_stock','false','Permitir vender sin stock'),
    (p_tenant,'General','date_format','"dd/MM/yyyy"','Formato de fecha');

  insert into expense_categories (tenant_id, name) values
    (p_tenant,'Servicios'),(p_tenant,'Alquiler'),(p_tenant,'Impuestos'),
    (p_tenant,'Sueldos'),(p_tenant,'Marketing'),(p_tenant,'Otros');
end $$;

create function tenants_after_insert() returns trigger
language plpgsql as $$
begin
  perform set_config('app.provisioning', 'on', true);
  perform provision_tenant(new.id);
  perform set_config('app.provisioning', 'off', true);
  return null;
end $$;
create trigger p_provision after insert on tenants for each row execute function tenants_after_insert();
