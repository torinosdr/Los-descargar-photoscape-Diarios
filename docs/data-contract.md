# Contrato de datos de la interfaz

Cada pantalla lista lo que necesita de la base. Al conectar el servidor, cada fila se convierte en un endpoint o consulta; hoy las pantallas usan `web/js/mock.js` con la misma forma. Importes en unidades menores + moneda; el frontend convierte y formatea según moneda e idioma elegidos.

| Pantalla | Lectura | Acciones |
|---|---|---|
| Arranque | `session_bootstrap()` (usuario, tenant, permisos, funciones del plan) | `auth_login`, `auth_refresh`, `auth_logout` |
| Inicio | KPIs: ventas del mes, `v_receivables`, `v_payables`, `v_wallet_balances`; top deudores; tareas de hoy; actividad (`audit_log`/`v_customer_timeline`); `v_inventory_status` (stock bajo) | — |
| Clientes · Lista | `v_customer_360` (saldo, billetera, última compra, responsable), filtros: con deuda, con saldo a favor, tipo | crear/editar cliente, exportar CSV |
| Customer 360 | `v_customer_360` + `v_customer_timeline` + ventas/pagos/billetera/tickets/notas del cliente | nueva venta, registrar pago, aplicar billetera a la deuda más antigua |
| Ventas · Facturas | `invoices` + `accounts_receivable` (total, cobrado, pendiente, vencimiento) | registrar pago (imputación), nota de crédito, exportar |
| Búsqueda global (Ctrl K) | `v_global_search` (clientes, facturas, productos) | navegar |
| Ajustes visuales | idioma y moneda (`tenant_settings`, `exchange_rates`), tema y densidad (por usuario) | — |

Todo se pide con el contexto del tenant y del usuario; los permisos se verifican con `has_permission()`.

## Fase 4
| Pantalla | Lectura | Acciones |
|---|---|---|
| Clientes · Lista | `v_customer_360`, `customers` | alta/edición (reglas: B2C = persona física; empresa exige razón social) |
| Clientes · Grupos | `customer_groups` + conteo de clientes + `price_lists` | — |
| Clientes · Cuentas B2B | `v_customer_credit` (límite, usado, disponible, excedido), `customer_subaccounts` | alta de cliente |
| Clientes · Billetera | `v_wallet_balances`, `v_receivables` | `wallet_apply_to_debt(cliente, máximo?)` |
| Clientes · Segmentos | `v_customer_segments` (vip, con_deuda_vencida, inactivo_90d, nuevo_30d, con_saldo_a_favor, sin_compras) | — |
| Compras · Inventario | `v_product_stock`, `v_inventory_status`, `stock_movements` | `stock_adjust(...)`, `stock_transfer(...)` |

## Fase 5 · Ventas
| Pantalla | Lectura | Acciones |
|---|---|---|
| Presupuestos | `quotes` + `quote_items` | transiciones Borrador→Enviado→Aceptado; `quote_convert_to_sale(id)` |
| Ventas | `sales` + `sale_items` + factura y deuda asociadas | `sale_reserve_stock`, `sale_issue_invoice`, estado "En Preparación", `sale_dispatch`, entregada/completada, `sale_cancel(id, motivo)` |
| Facturas | `invoices` + `accounts_receivable` | cobrar (abre `payment_register`) |
| Cobranzas | `payments` + `payment_allocations` + excedente a billetera | `payment_register(cliente, medio, importe, deuda_primero?, referencia?)` |
| Por cobrar | `v_receivables`, `v_receivables_aging` | cobrar |
| Devoluciones | `sale_returns` + `sale_return_items` | `return_create(venta, motivo, reembolso, líneas)`, `return_complete(id)` (reingreso de stock, billetera / nota de crédito / efectivo) |
| Inicio (KPI) | `v_sales_by_month` | — |

## Fase 6 · Compras
| Pantalla | Lectura | Acciones |
|---|---|---|
| Órdenes | `purchases` + `purchase_items` | `purchase_confirm(id)`, `purchase_receive(id, items?, almacén?)` (recepción parcial/total, ingresa stock), `purchase_register_invoice(id, número, vence)`, `purchase_cancel(id, motivo)` (bloqueada si hay pagos) |
| Proveedores | `v_supplier_summary`, `suppliers` | alta de proveedor |
| Por pagar | `v_payables`, `v_payables_aging` | `supplier_payment_register(orden, medio, importe, ref?)` (sin sobrepago) |
| Gastos | `expenses`, `v_expenses_monthly` | `expense_register(...)`, `expense_pay(id, medio)` |

## Fase 7 · CRM
| Pantalla | Lectura | Acciones |
|---|---|---|
| Leads | `leads` | alta; `lead_advance(id, etapa)` (una etapa por vez); `lead_convert(id)` (empresa → cliente B2B con contacto principal, persona → B2C; recorre las etapas intermedias; traspasa tareas y llamadas); `lead_lose(id, motivo)` (motivo obligatorio); reabrir (Perdido → Nuevo) |
| Embudo | `v_pipeline` (leads y valor por etapa) | arrastrar = `lead_advance` a la etapa siguiente, `lead_convert` a Ganado, `lead_lose` a Perdido |
| Tickets | `v_ticket_overview` (vencido, mensajes), `tickets`, `ticket_messages` | alta; `ticket_reply(id, texto, interno?)` (una respuesta pública toma el ticket; no se responde un ticket cerrado); `ticket_change_status(id, estado)` según `workflow_transitions` (fechas resolved_at/closed_at por trigger) |
| Tareas | `tasks`, `time_entries` | alta (con subtarea opcional); `task_complete(id)` (bloqueada con subtareas abiertas); `task_log_time(id, minutos, facturable?, notas?)` (inicia la tarea, hereda facturable) |
| Proyectos | `v_project_summary` (tareas, avance, horas, vencido) | alta; `project_set_status(id, estado)` (no se completa con tareas abiertas) |

## Fase 8 · Tablero, informes y barra lateral
| Pantalla | Lectura | Acciones |
|---|---|---|
| Inicio | `v_dashboard` (una fila por tenant, en moneda base: ventas 30 días vs 30 previos, por cobrar y vencido, por pagar, billeteras, tickets abiertos/vencidos, tareas vencidas, embudo, stock bajo, clientes nuevos), `v_sales_by_month` | — |
| Campana | `notifications` (privadas por usuario por RLS) | `notifications_generate()` (una alerta por día y tipo: deudas vencidas, stock bajo, tickets y tareas vencidas del usuario), `notification_read(id)`, `notifications_read_all()`; al asignar un ticket o tarea a otra persona se notifica por trigger |
| Búsqueda (Ctrl K) | `search_global(texto, límite)`: si parece un número de documento busca pedidos, facturas, presupuestos y tickets; si no, clientes, contactos, leads, productos y proveedores | — |
| Contactos | `v_contacts` (contactos de clientes + leads abiertos) | — |
| Agenda | `calendar_events` | `calendar_event_create(...)` (título obligatorio, no termina antes de empezar, sin solapes propios; un evento cancelado libera el horario), `calendar_event_set_status(id, estado)` |
| Llamadas | `calls` | `call_log(sentido, asunto, minutos, cliente?, lead?, resultado?, notas?)` (exige cliente o lead) |
| Informes | `v_sales_by_month`, `v_top_customers`, `v_top_products` (unidades, ingreso, costo), `v_cash_flow_monthly` (cobrado − pagado a proveedores − gastos pagados), `v_receivables_aging`, `v_payables_aging` | exportar a CSV |
| (sin pantalla aún) | `notes`, `reminders` | `note_add(tipo, id, texto, fijada?)`, `reminder_create(...)`, `reminder_done(id)` |

## Fase 9 · B2B avanzado
Orden del cálculo (`price_resolve(cliente, producto, cantidad, resto_del_carrito)`): precio base del producto → lista de precios del grupo del cliente (escala por cantidad: la de mayor `min_qty` que no supere la cantidad) → reglas dinámicas vigentes por prioridad ascendente. Devuelve precio final, total de línea, envío gratis, pedido mínimo, exento de impuestos, oculto y la lista de reglas aplicadas (se guarda en `sale_items.applied_rules` / `quote_items.applied_rules`).
| Pantalla | Lectura | Acciones |
|---|---|---|
| Clientes · Precios y reglas · Escalas | `v_price_tiers` | `price_tier_set(lista, producto, desde, precio)` (requiere `price_tiers`; una escala mayor no puede costar más que una menor), `price_tier_delete(...)` |
| … · Reglas | `v_rules_overview` (condiciones, acciones, vigente) | `rule_create(nombre, prioridad, condiciones jsonb, acciones jsonb, grupo?, producto?, desde?, hasta?, cortar?)` (requiere `dynamic_rules`; `rule_validate` revisa campos, operadores y valores), `rule_set_status`, `rule_delete` |
| … · Simulador | `price_resolve(...)` | — |
| Ventas / Presupuestos (alta) | — | `sale_add_item`, `quote_add_item` (precio calculado; producto oculto rechazado; envío gratis pone el envío en 0) |
| Ventas (facturar) | — | `sale_issue_invoice` ahora exige el pedido mínimo (`sale_check_minimum`) |
Condiciones: `customer_group, customer_type, customer, product, category, sku, quantity, cart_total, currency` con `= != > >= < <= in not_in between` (`>` etc. solo sobre cantidad y total). Acciones: `set_price, percent_discount, fixed_discount, free_shipping, min_order, hide_product, tax_exempt`. Permiso usado: `products.update`.

## Fase 10 · MercadoLibre, Anuncios y Auditoría
No hay conexión real con MercadoLibre: la capa de integración (servidor) llamará a estas mismas funciones. Todas las funciones de ML exigen el permiso `mercadolibre.*` y la función de plan `ml_advanced` (`require_feature`, error 42501 si el plan no la incluye).
| Pantalla | Lectura | Acciones |
|---|---|---|
| MercadoLibre · Resumen | `v_ml_overview` (cuentas conectadas, publicaciones activas/preparadas, preguntas sin responder, stock pendiente, órdenes importadas), `ml_accounts` | `ml_account_register(usuario, apodo?, sitio)` (queda `Pendiente`; solo la integración la pasa a `Conectada`), `ml_account_disconnect` (pausa las publicaciones activas) |
| … · Publicaciones | `ml_publications` | `ml_publication_prepare(producto, cuenta?, título?, precio?, stock?)` (una por producto y cuenta), `ml_publication_set_status(pub, Activa/Pausada/Cerrada)` (activar exige cuenta `Conectada` y stock > 0; una preparada no se pausa; cerrada es final) |
| … · Órdenes | `ml_sales` | `ml_order_import(cuenta, orden, comprador, email, items jsonb, moneda?)`: idempotente por orden; crea o reutiliza al cliente por email (origen `MercadoLibre`), la venta, la factura y el cobro `Mercado Pago`. Si falla, no queda nada a medias |
| … · Preguntas | `ml_questions` | `ml_question_receive`, `ml_question_answer(id, texto)` (hasta 2000 caracteres, una sola vez) |
| … · Stock | `ml_stock_sync` | `ml_stock_refresh()` compara stock local vs. publicado y marca `Pendiente`/`Sincronizado` (el envío lo hará la integración) |
| Anuncios | `v_my_announcements` (vigentes, dirigidos a mí, `unread`), `announcements` | `announcement_create(título, mensaje, audiencia, importancia, publica?, vence?, clientes?, usuarios[])`, `announcement_publish` (arma destinatarios y crea una notificación `Anuncio` por usuario), `announcement_archive`, `announcement_mark_read` |
| Auditoría | `v_audit_log` (usuario, acción, registro, `detail` = campos que cambiaron antes/después), `audit_for(entidad, id, límite)` | solo lectura; requiere `audit.read` (admin; ni vendedor ni lectura la ven). `audit_diff(old, new)` ignora `updated_at` |
