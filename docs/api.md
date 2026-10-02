# API HTTP (Fase 12)

Base: `/api`. JSON. Importes en **unidades menores** (`*_minor`, centavos). Todo salvo `/health` y `/auth/{login,refresh,logout}` exige `Authorization: Bearer <access_token>`.

Errores: `{ "error": "<código>", "message": "<texto para el usuario>", "fields"?: { "<campo>": "<motivo>" } }`
| HTTP | código | cuándo |
|---|---|---|
| 400 | `dato_invalido`, `json_invalido` | identificador o formato inválido |
| 401 | `sin_token`, `token_invalido`, `sesion_invalida`, `credenciales`, `token_reutilizado` | sin sesión / expirada / revocada |
| 403 | `sin_permiso` | falta el permiso del rol (`require_permission`) |
| 404 | `no_encontrado` | inexistente o de otro tenant |
| 409 | `duplicado` | p. ej. CUIT repetido, venta ya facturada |
| 422 | `regla_de_negocio`, `datos_invalidos` | validaciones y transiciones de estado |
| 423 | `bloqueado` | cuenta bloqueada 15 min tras 5 intentos |
| 429 | `demasiados_intentos` | límite de login por IP |

## Sesión
| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ access_token, expires_in, session }` + cookie `nexo_rt` |
| POST | `/auth/refresh` | — (cookie) | igual que login, con token rotado |
| POST | `/auth/logout` | — (cookie) | 204 |
| POST | `/auth/password` | `{ current_password, new_password }` | 204 |
| GET | `/me` | — | `session_bootstrap()`: usuario, tenant, permisos, funciones del plan |

## Clientes
| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/customers` | `customers.read` | `v_customer_360` + grupo, responsable, crédito y plazo |
| GET | `/customers/:id` | `customers.read` | + `timeline`, `receivables`, `wallet` |
| POST | `/customers` | `customers.create` | `customer_type` (B2C/B2B), `person_type` (Persona Física/Empresa), `first_name`, `last_name`, `company_name`, `email`, `phone`, `tax_id`, `tax_condition`, `customer_group_id`, `assigned_user_id`, `credit_limit_minor`, `payment_terms_days` |
| PATCH | `/customers/:id` | `customers.update` | mismos campos (parcial) + `status` (Activo/Inactivo/Bloqueado) |
| POST | `/customers/:id/wallet/apply` | `payments.create` + `wallet.create` | `{ max_minor? }` → `{ applied_minor }` (`wallet_apply_to_debt`) |
| GET | `/customer-groups`, `/users` | `customers.read` | para los selectores del formulario |

## Ventas
| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/sales[?customer_id=]` | `sales.read` | con líneas, factura vigente, cuenta por cobrar y `reserved` |
| GET | `/sales/:id` | `sales.read` | + `history` (alta, factura, cobros, anulación, cierre) |
| POST | `/sales` | `sales.create` (+ `sales.update` por línea) | `{ customer_id, items: [{ product_id, quantity }], discount_minor?, shipping_minor?, notes? }`. El precio de cada línea lo calcula `sale_add_item` (lista del grupo, escalas, reglas); el cliente no envía precios |
| POST | `/sales/:id/actions/:acción` | según acción | `reserve` (`sale_reserve_stock`), `invoice` (`sale_issue_invoice`, exige pedido mínimo), `prepare`, `dispatch` (`sale_dispatch`), `deliver`, `complete`, `cancel` (`{ reason }`, `sale_cancel`: lo cobrado vuelve a la billetera). Transiciones validadas por `workflow_transitions` |
| GET | `/products`, `/warehouses` | `products.read` | stock por depósito, reservado y disponible |
| GET | `/price?customer_id&product_id&quantity` | `sales.read` | `price_resolve` (vista previa del precio) |

## Cobranzas
| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/payments[?customer_id=]` | `payments.read` | cobros con imputaciones y parte enviada a billetera |
| POST | `/payments` | `payments.create` | `{ customer_id, method, amount_minor, receivable_id?, reference? }` → `payment_register`: imputa primero a `receivable_id` y luego a lo más antiguo; el excedente va a la billetera |
| GET | `/payment-methods` | — | Efectivo, Transferencia, Tarjeta de crédito/débito, Cheque, Mercado Pago, Otro |
| GET | `/invoices` | `invoices.read` | total, cobrado, acreditado, pendiente |
| GET | `/receivables` | `invoices.read` | deudas abiertas (`v_receivables`) |
| GET | `/receivables/aging` | `invoices.read` | `v_receivables_aging` |
