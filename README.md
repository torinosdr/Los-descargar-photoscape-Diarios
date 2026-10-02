# Nexo — CRM + ERP + Ecommerce SaaS multi-tenant

## Servidor + interfaz (Fase 12)
Requiere Node 20+ y PostgreSQL 16+ (o el proyecto de Supabase).

```bash
npm install
cp .env.example .env      # completar DATABASE_URL y JWT_SECRET
npm start                 # http://localhost:3000 → login
```
- Usuarios demo (contraseña `Demo1234!`): `carlos@example.com` (Gerente), `marcos@example.com` (Admin), `valeria@example.com` (Vendedor), `diego@example.com` (Contable) en *Demo Distribuidora B2B*; `ana@example.com` (Admin) en *Demo Retail B2C*.
- Conectados al servidor: **Clientes** (lista, alta/edición, ficha 360, billetera), **Ventas** (alta con precio calculado por la base, reservar, facturar, preparar, despachar, entregar, completar, anular) y **Cobranzas** (cobros con imputación, facturas, por cobrar). El resto de los módulos muestra un aviso y sigue con datos de demostración.
- Sin servidor, `web/index.html` abierto como archivo sigue funcionando con los datos de `web/js/mock.js`.

### Conectar con Supabase
1. Migración `025_api_login_role.sql` (ya aplicada en el proyecto) crea el usuario `nexo_api` **sin contraseña**. Fijala una vez en el SQL Editor de Supabase:
   `alter role nexo_api password 'una-contraseña-larga';`
2. En `.env`: `DATABASE_URL=postgres://nexo_api.<ref-del-proyecto>:<contraseña>@<host-del-pooler>:6543/postgres` (Supabase → Connect → *Transaction pooler*) y `DB_SSL=require` (o `verify` con `DB_SSL_CA`).

## Base de datos
`export DATABASE_URL=postgres://nexo:nexo@localhost:5432/nexo`
- `npm run db:reset` · `db:seed` · `test:db` (15 suites SQL) · `test:api` (reset + seed + pruebas HTTP) · `npm test` (ambas)

Ver `docs/architecture.md`, `docs/api.md`, `docs/data-contract.md` y `PROGRESS.md`.
