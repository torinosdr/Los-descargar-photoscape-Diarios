# Avance
- [x] Fase 1 · Modelo de datos multi-tenant (84 tablas, RLS, triggers, vistas, seed, 7 suites de tests)
- [x] Fase 2 · Auth, sesiones, invitaciones, roles/permisos, planes y alta de tenants (a nivel base de datos, test 08). Falta la capa HTTP/JWT/email, que necesita paquetes.
- [x] Fase 3 · Sistema de diseño y carcasa de la interfaz (web/): navegación, tablas densas, Customer 360, búsqueda global, claro/oscuro, es-AR/en/pt-BR, multi-moneda. Datos de ejemplo.
- [x] Fase 4 · Clientes (alta/edición, grupos, B2B con crédito y subcuentas, billetera→deuda, segmentos) e Inventario (ajuste, transferencia). SQL: migración 015 + test 09.
- [x] Fase 5 · Ventas: presupuestos, ventas con flujo de estados, factura + deuda, cobranzas con imputación, antigüedad de deuda, devoluciones y anulaciones. SQL: migración 016 + test 10.
- [x] Fase 6 · Compras: órdenes (confirmar, recibir parcial/total, factura proveedor, anular), proveedores, cuentas por pagar con antigüedad y pagos, gastos. SQL: migración 017 + test 11.
- [x] Fase 7 · CRM: leads con conversión a cliente, embudo (arrastrar y soltar), tickets con conversación, tareas con horas y subtareas, proyectos con avance. SQL: migración 018 + test 12.
- [x] Fase 8 · Tablero de Inicio con datos reales, campana de notificaciones, búsqueda global (Ctrl K), Contactos, Agenda, Llamadas e Informes (con CSV). SQL: migración 019 + test 13.
- [x] Fase 9 · B2B avanzado: escalas por volumen, reglas dinámicas (condiciones y acciones), simulador de precios, precios aplicados al crear ventas y pedido mínimo al facturar. SQL: migración 020 + test 14.
- [x] Fase 10 · MercadoLibre (estructura), Anuncios, Auditoría
- [x] Fase 11 · Pulido (celular, accesibilidad, índices, revisión del Excel)
- [x] Fase 12 · Servidor (Node + Express) y MVP conectado: login con JWT de acceso (15 min) + refresh token rotativo en cookie httpOnly, logout, límite de intentos por IP, cambio de contraseña. Clientes, Ventas y Cobranzas leen y escriben en la base real; cada petición corre como `nexo_app` con RLS y contexto de tenant/usuario. Migración 025 (`nexo_api`) + 15 pruebas HTTP (`test/api.test.js`). 023/024 ahora son idempotentes y portables (fuera de Supabase).
- [ ] Pendiente · correo (recuperar contraseña, invitaciones), MFA, conectar el resto de los módulos (presupuestos, devoluciones, compras, CRM…), integraciones reales (MercadoLibre, pasarela de pago), despliegue.

npm ya funciona en este entorno (antes devolvía 403).
