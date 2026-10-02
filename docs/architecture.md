# Arquitectura de datos (Fase 1)

**Multi-tenant:** todas las tablas de negocio llevan `tenant_id`. Las claves foráneas son compuestas `(tenant_id, x_id) → padre(tenant_id, id)`, así que la base impide referenciar datos de otro tenant. Sobre eso, Row Level Security (ENABLE + FORCE) con `tenant_id = app_tenant()`. El contexto se fija con `SET LOCAL app.tenant_id / app.user_id`. Roles: `nexo_app` (sin bypass) y `nexo_platform` (bypassrls).

**Dinero:** `bigint` en unidades menores + código de moneda; tipo de cambio como snapshot por documento; `prices_include_tax`; impuesto congelado en cada línea.

**Numeración:** `document_sequences` por tenant y tipo, con prefijo y relleno configurables.

**Integridad derivada por triggers:** totales de documentos, existencias, reservas, saldo de billetera, imputación de pagos, estados de ventas/compras/facturas, notas de crédito, devoluciones y recepciones.

**Inmutables:** `stock_movements`, `wallet_transactions`, `audit_log`.

**Estados:** tabla `workflow_transitions` + trigger (Sale, Quote, Lead, Ticket, Purchase).

**Auditoría:** trigger `audit_row` con valores anterior/nuevo y redacción de secretos. Baja lógica con `deleted_at`.

**Planes:** `tenant_has_feature()` combina plan + excepciones por tenant. `provision_tenant()` crea roles, permisos, series, impuestos, depósito, listas de precio y ajustes al crear un tenant.

**Pagos:** se registran manualmente; `payments` ya tiene `provider_*` para una pasarela futura (Mercado Pago/Stripe). Fiscal (AFIP): campos `fiscal_*` previstos.

## Tests
`npm run db:test` (o `bash scripts/db.sh test`): 7 archivos en `db/tests` (aislamiento, numeración/totales, inventario, cobranzas/billetera, flujos de estado, compras/devoluciones, auditoría/planes/provisión).

## Fase 2 · Identidad y acceso (migración 014)
Todo vive en la base como funciones; el backend futuro solo las orquesta.
- **Sesiones:** `auth_login` (bloqueo 15 min tras 5 fallos, auditoría), `auth_refresh` (rotación; reutilizar un token viejo revoca todas las sesiones), `auth_logout`, `auth_session_valid`. Los tokens se guardan hasheados (SHA-256); bcrypt para contraseñas, con política mínima (8 caracteres, letras y números).
- **Recuperación:** `auth_request_password_reset` / `auth_reset_password` (token de un solo uso, 1 h, cierra sesiones). `auth_change_password`.
- **Usuarios:** alta solo por invitación (`invite_user` / `accept_invitation`, 7 días). Límite de usuarios por plan (Básico 3, Pro 10, B2B ilimitado; editable en `plans.max_users`). El propietario no se suspende ni cambia de rol; nadie cambia su propio rol; solo un Admin asigna Admin.
- **Permisos:** `has_permission()` / `require_permission()` sobre rol → permisos. Roles de sistema inmutables desde la app; roles propios permitidos sin escalada (no se otorga un permiso que no se tiene).
- **Frontend:** `session_bootstrap()` devuelve usuario, tenant, permisos y funciones activas.
- **Plataforma:** `signup_tenant`, `platform_change_plan`, `platform_set_feature`, `platform_login` (no ejecutables por el rol de la app).
- La app no puede leer `password_hash`, `mfa_secret` ni tokens (permisos por columna).
- Pendiente (necesita backend): emisión de JWT de acceso, envío de emails, MFA, rate limiting por IP.

## Fase 12 · Servidor HTTP (`server/`)
Node 20+, Express 5, `pg`, `jose`. El servidor no tiene lógica de negocio propia: valida formato, verifica permisos y llama a las funciones y vistas de la base.
- **Conexión:** usuario `nexo_api` (LOGIN, NOINHERIT, miembro de `nexo_app`). Cada petición abre una transacción, hace `SET LOCAL ROLE nexo_app`, fija `app.tenant_id`/`app.user_id` y verifica `auth_session_valid(sid)`. Si una consulta olvidara el `SET ROLE`, `nexo_api` no ve ninguna tabla. Las consultas no filtran por tenant: el aislamiento lo da RLS (probado en `test/api.test.js`).
- **Sesión:** `auth_login` / `auth_refresh` / `auth_logout`. Access token JWT HS256 (`sub`, `tid`, `sid`, 15 min) en memoria del navegador como `Authorization: Bearer`; refresh token opaco en cookie `nexo_rt` (httpOnly, SameSite=Strict, `Path=/api/auth`, `Secure` en producción), rotado en cada uso; reutilizar uno viejo revoca todas las sesiones. Logout o cambio de contraseña invalidan el access token en la siguiente petición (por `sid`).
- **Defensas:** límite de intentos de login por IP (además del bloqueo por cuenta de la base), verificación de `Origin` en refresh/logout, Helmet con CSP (`script-src 'self'`), JSON ≤ 100 kB, `Cache-Control: no-store` en la API, mensajes de error de la base traducidos a HTTP (403 permiso, 404, 409 duplicado, 422 regla de negocio) sin exponer detalles técnicos.
- **Interfaz:** `web/js/api.js` detecta el servidor (`/api/health`); si no hay, la interfaz queda en modo demostración.
