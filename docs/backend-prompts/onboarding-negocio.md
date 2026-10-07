# Prompt para el backend: Onboarding, alta del negocio en pocos pasos

> Copiar todo lo que está debajo de la línea y entregarlo al agente / equipo del backend.
> Corresponde a la solicitud #42 de `BACKEND-REQUESTS.md` del front.

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS). Repo: `redom-chile-backend`.
Lo relevante:
- `libs/restaurant/features/create-business/` (`create-business-sql.service.ts`)
- `libs/restaurant/features/create-business-location/`
- `libs/restaurant/features/{complete-business-setup-step,find-business-setup-steps,activate-business}`
- `libs/restaurant/features/update-business-settings/`, `libs/restaurant/features/get-pos-details/`
- `libs/restaurant/shared/src/lib/orders.service.ts` (`getVatRate`, `splitVat`)
- Seed de pasos: `libs/restaurant/database/src/migrations/seed/1754000010000-populateConfigurationSteps.ts`

Errores con `errorPayload()` y código de negocio en `libs/common/utils/operators/src/lib/error-codes.ts`
(formato `{ statusCode, code, message, details }`).

# Objetivo
Que un dueño pase de registrarse a tomar su primer pedido en pocos minutos, sin pasos que no aportan.

El front ya tiene un onboarding nuevo:
1. Tu negocio: nombre, moneda, zona horaria y logo.
2. Tu local: el primero, obligatorio.
3. ¿Cómo atiendes?: mostrador o mesas; si hay mesas, crea un sector y N mesas.
4. Primeros productos: nombre y precio, opcional.
5. Foto de perfil.
6. Listo → POS.

Hoy el front tiene que suplir con varias llamadas y valores por defecto lo que el backend no hace (ver abajo).
Este prompt pide simplificarlo.

# Situación actual (lo que obliga al front a dar vueltas)
- `POST /business` responde `void`: el front pide `whoami` para saber el id.
- `POST /business` no crea ningún local, y sin local el POS no puede vender (`POST /orders` exige `locationId`).
- Los locales nuevos quedan con `invoiceSchemeId: 0` e `invoiceLayoutId: 0`, sin el esquema `FAC-` del negocio.
- El asistente de 5 pasos (`/business/:id/setup/steps`) pide datos que nada usa:
  - `enabledModules`, `keyboardShortcuts`, `enableTooltip`, `transactionEditDays`;
  - `skuPrefix`, método contable, márgenes;
  - configuración de vencimientos.

  `isActive` solo se exige para activarse a sí mismo; nada más lo revisa. El front ya no muestra el asistente:
  lo completa en segundo plano con valores por defecto y llama a `/activate`.
- `sellPriceTax` se guarda, pero los pedidos y el food cost siempre separan el IVA como si el precio lo incluyera.
- `posSettings` (meseros, mesas) solo se escribe en el paso 5 y no se puede editar con `PATCH /business/:id/settings`.
- Para la lista "Primeros pasos" del Resumen, el front hace 7 consultas (locales, productos, pedidos, mesas,
  usuarios, impresoras y estaciones) solo para saber si existe al menos uno de cada cosa.

# 1. `POST /business`: devolver el id y dejar el negocio listo
- Responder `201 { id }`.
- Dejar el negocio **activo** (`isActive = true`, `startDate = now`) y sin pasos pendientes del asistente,
  con los mismos valores por defecto que hoy pone la base de datos.
- Aceptar, de forma opcional, el primer local en la misma transacción:
  ```json
  { "name": "La Picada de Omar", "currencyId": 3, "timeZone": "America/Santiago",
    "location": { "name": "La Picada de Omar", "address": "Av. Siempre Viva 123", "city": "Providencia",
                  "mobile": "+56 9 1234 5678" } }
  ```
  Respuesta con local: `{ "id": 12, "locationId": 31 }`.
- Mantener los 409 actuales (`User already belongs to a business`, `User already has a business`),
  pero con código: `BUSINESS_ALREADY_EXISTS` y `USER_ALREADY_IN_BUSINESS`.

# 2. Locales con el esquema de facturación del negocio
- `POST /business-locations` debe asociar el esquema y el layout por defecto del negocio
  (`invoiceSchemeId`, `saleInvoiceSchemeId`, `invoiceLayoutId`), no `0`.
- Migración: corregir los locales existentes que tienen `0`.

# 3. Asistente de 5 pasos e `isActive`
Elegir una opción y documentarla:
- **A (recomendada):** retirar el asistente. Eliminar `/setup/steps`, `/setup/steps/:n` y `/activate`, o dejarlos
  respondiendo "ya completado". Activar todos los negocios existentes.
- **B:** mantenerlo, pero que los 5 pasos acepten el cuerpo vacío (valores por defecto) y que `POST /business` los
  marque como completados.

En ambos casos, documentar qué hace `isActive` (si no hace nada, retirarlo).

# 4. Impuestos y POS en la configuración
- **`sellPriceTax`:** aplicarlo en `orders.service.ts`. Con `excludes`, el precio del producto es neto y el IVA se
  suma encima. Si no se va a soportar, quitar el campo.
- **`PATCH /business/:id/settings`:** aceptar `posSettings`:
  `{ waiterEnabled?: boolean, tablesEnabled?: boolean, isServiceStaffRequired?: boolean }`.
  Guardarlo como JSON válido y que `GET /pos/details` lo siga leyendo.
- **`suggestedTipPercent`:** agregarlo a la configuración del negocio (número 0..100, 0 = sin sugerencia; ver #41).

# 5. Estado de "Primeros pasos": `GET /business/:id/onboarding-status`
Una sola consulta liviana para la lista del Resumen:
```json
{ "hasLocation": true, "hasSellableProduct": true, "hasOrder": false, "hasTaxData": false,
  "hasTables": true, "teamMembers": 1, "hasPrinterOrStation": false }
```
- `hasSellableProduct`: producto activo, vendible y con precio (excluye ingredientes y sets de modificadores).
- `hasOrder`: al menos un pedido no cancelado.
- `hasTaxData`: `taxNumber1` no vacío.
- `teamMembers`: usuarios del negocio, incluido el dueño.

# 6. Datos del negocio en `whoami`
Incluir en `GET /users/whoami`, dentro de `user`:
- `businessName`;
- `locationsCount`.

Así el front sabe al iniciar sesión si falta crear el local, sin otra consulta, y muestra el nombre actualizado
del negocio.

# Entregables
1. `POST /business` con `{ id }`, negocio activo y primer local opcional en la misma transacción, con códigos de error.
2. Locales asociados al esquema de facturación por defecto, más la migración de los existentes.
3. Decisión sobre el asistente e `isActive` (opción A o B), implementada y documentada.
4. `sellPriceTax` aplicado (o retirado), `posSettings` y `suggestedTipPercent` en PATCH settings.
5. `GET /business/:id/onboarding-status`.
6. `whoami` con `businessName` y `locationsCount`.
7. Swagger actualizado.

# Prueba E2E
1. Registrar un usuario nuevo y verificar el correo.
2. `POST /business` con `location` → `201 { id, locationId }`.
   - `GET /business/:id/settings` muestra `isActive: true`.
   - `GET /business-locations` muestra el local con el esquema de facturación por defecto.
3. Repetir `POST /business` → 409 `BUSINESS_ALREADY_EXISTS`.
4. `GET /business/:id/onboarding-status` → `hasLocation: true` y el resto en `false`/`1`.
5. Crear un producto y un pedido en ese local → la factura usa el prefijo `FAC-`, y `hasSellableProduct` y
   `hasOrder` pasan a `true`.
6. `PATCH /business/:id/settings { "sellPriceTax": "excludes" }`, pedir un producto de $1.000:
   - `finalTotal` = $1.190;
   - IVA = $190.
7. `PATCH /business/:id/settings { "posSettings": { "tablesEnabled": true } }` → `GET /pos/details` devuelve
   `tablesEnabled: true`.
8. `whoami` trae `businessName` y `locationsCount: 1`.
