# Inconsistencias del Excel (revisión hoja por hoja)

Revisadas las 44 hojas de `CRM_ERP_Ecommerce_SaaS_Modelo_Funcional.xlsx`, leyendo los datos y las fórmulas. Cada hallazgo se comprobó contra las celdas; los que no se pudieron comprobar no se listan. (La afirmación previa sobre INV-001 / SAL-002 era errónea y está retirada: esa factura sí corresponde a SAL-002.)

| # | Hoja | Hallazgo | Cómo lo trata Nexo |
|---|---|---|---|
| 1 | Inventory | `stock_current = F+G+H+I` **suma** `stock_out` (que está cargado en positivo: 1, 2, 1). Con los datos del Excel da 11, 6 y 6 en vez de 9, 4 y 5. Stock_Movements sí usa negativos. | El stock sale del libro de movimientos (salidas negativas) y los tests lo verifican. |
| 2 | Payments | PAY-001 es de TEN-001 / SAL-001, pero apunta a `INV-001`, que es de TEN-002 / SAL-002: pago cruzado entre empresas. SAL-001 no tiene factura. | Las claves foráneas llevan `tenant_id`: ese cruce es imposible. La demo no replica ese pago. |
| 3 | Quotes | QUO-002 tiene `converted_sale_id = SAL-003`, que no existe en Sales (solo SAL-001 y SAL-002). | La conversión crea la venta y vincula el presupuesto en la misma transacción. |
| 4 | Dashboard | "Pago Parcial" y "Pagado" se cuentan contra `Sales!F` (estado), pero son valores de `payment_status` (columna G): dan 0. "Cancelado/Devuelto" es una etiqueta doble que nunca coincide con un estado. | `v_dashboard` separa estado de pago y estado logístico. |
| 5 | Dashboard | "Leads activos" cuenta `<> Ganado`, e incluye los Perdidos. | Activo = ni ganado ni perdido. |
| 6 | Customers / Customer_360 | `wallet_balance` y `account_balance` están vacíos y no se calculan: CUS-002 debería mostrar 2.000 de billetera (WAL-001) y 17.500 por cobrar (AR-001). Customer_360 los lee de ahí. | Ambos saldos se derivan de los libros (billetera y por cobrar). |
| 7 | Sale_Items | SAL-002 vende PRD-002 dos veces: a 9.000 (= precio de lista) y a 6.500, por debajo del precio B2B (7.500) y del de lista. | Los precios salen de la lista del grupo y las reglas; el mínimo se valida al facturar. |
| 8 | Sales / Stock_Movements | SAL-002 está "En Preparación" pero ya tiene salidas de stock (MOV-003 y MOV-005). | El stock sale al despachar; antes solo se reserva. |
| 9 | Payments | PAY-003 tiene la fecha como texto (`'2026-09-23'`); el resto son fechas reales. | Tipos `date` en la base. |
| 10 | Wallet_Transactions | WAL-002 "Aplicación a deuda" tiene importe 0, y `balance_after` encadena con la fila anterior sin mirar al cliente. | El libro es inmutable, rechaza importes en cero y calcula el saldo por cliente. |
| 11 | Purchases / Stock_Movements | PUR-001 figura "Recibido Total" pero sus ingresos tienen fechas distintas (MOV-002 el 20/9, MOV-004 el 21/9) sin recepciones parciales registradas. | Cada recepción es un documento con fecha propia. |
| 12 | Plans / Feature_Flags | Feature_Flags exige plan B2B para precios escalonados y subcuentas, pero Plans no tiene columnas para esas funciones (solo `dynamic_rules`, `multi_warehouse`, `ml_advanced`). | Las funciones se activan por feature flags en la tabla de planes de Nexo. |
