# REDOM — Solicitudes al backend

Cambios que el frontend necesita del backend (`redom-chile-backend`), detectados al integrar cada módulo.
Cada solicitud indica el endpoint, el problema, lo que se pide y cómo lo resuelve el front mientras tanto.

Estados: 🔴 bloquea una funcionalidad o produce datos erróneos · 🟡 el front usa un workaround · ⚪ por decidir · 🟢 resuelto (mover a la sección final)

---

## Resumen

| Prioridad | Solicitudes |
|---|---|
| 🔴 Bloquea una función | #39 el token renovado por `refresh-token` no sirve (la sesión se cierra a las 2 h) |
| 🟡 Hay workaround en el front | #15 token de dispositivo para impresión · #16 permiso para ver todas las reservas (fase de permisos) · #28 códigos de error faltantes · #29 `QR_BASE_URL` por ambiente · #30 color de marca del restaurante · #31 códigos de error de inventario · #32 detalle de documento y total de stock · #33 eliminar una unidad en uso · #34 editar y eliminar opciones de modificadores · #35 `GET /products` devuelve los sets de modificadores · #36 falta de stock por venta, anulación de pagos y filtros · #37 detalle de conteos y transferencias, filtros y códigos · #38 preparaciones, órdenes de compra y lotes · #43 ajustes de caja y turnos · #44 ajustes de gastos y cuentas por pagar · #45 ajustes de propinas y comisiones |
| ⚪ Por decidir | #25 entrar solo con PIN |
| 🔵 Nueva función | #41 ajustes de pagos por producto y propina sugerida · #46 centro de ayuda y asistente con IA |
| 🟢 Resueltas | #1–#14, #17–#24, #26, #27, #40, #42 |

Pendiente del front: la página pública de la carta `app.redom.cl/carta/:qrCode`, que consume `GET /restaurant/api/menu/:qrCode` (ver #7).

---

## Pendientes

### 15. 🟡 Impresión — token de dispositivo para estaciones y agentes

**Problema:** `/print-jobs/pending` y `PATCH /print-jobs/:id` exigen el JWT de un usuario. La Estación de impresión (y un futuro agente local) queda atada a la sesión de una persona: si expira o la persona cierra sesión, se deja de imprimir.

**Se pide:** credenciales de dispositivo de larga duración por local (API key o token de dispositivo) con permiso solo para leer y actualizar trabajos de impresión.

**Front mientras tanto:** la estación usa la sesión del usuario que la abrió.

---

### 16. 🟡 `GET /bookings` — solo el permiso `crud_all_bookings` ve todas las reservas

**Problema:** sin el permiso `crud_all_bookings`, el listado muestra solo las reservas creadas o asignadas al usuario. Ese código no sigue el formato del resto de los permisos (`modulo:accion`, por ejemplo `bookings:get-all`), y un administrador sin él ve una agenda incompleta sin saberlo.

**Se pide:** renombrarlo al formato estándar (por ejemplo `bookings:see-all`) y documentarlo; idealmente, que el rol administrador lo tenga por defecto.

**Front mientras tanto:** la agenda muestra lo que devuelve el backend.

### 25. ⚪ (A definir) Entrar a la terminal solo con PIN

**Problema:** hoy el mesero elige su nombre y luego ingresa el PIN (`POST /pos/check-staff-pin` necesita `userId`). Entrar solo con el PIN no es posible: el PIN está cifrado y no es único.

**Se pide (si el negocio lo decide):** PIN único por restaurante (409 al asignar uno repetido), `POST /pos/login-by-pin { pin }` que devuelva el mesero, y límite de intentos por equipo/restaurante (no por mesero).

**Front mientras tanto:** selección de mesero + PIN.

### 28. 🟡 Errores que todavía no traen código de negocio

**Problema:** al integrar #22 aparecieron casos que llegan solo con el código genérico del status, y el front no puede distinguirlos sin leer el texto:
- sucursal inexistente al crear o editar un usuario: `NOT_FOUND`, igual que un rol o usuario inexistente (`assertBranchInRestaurant`);
- `POST /orders/:id/lines` sobre un pedido no abierto: `CONFLICT` en vez de `ORDER_NOT_OPEN`;
- cancelar un pedido ya cancelado: `CONFLICT` sin código;
- "Table not found in this location" en reservas: `NOT_FOUND` sin código.

**Se pide:** `BRANCH_NOT_FOUND`, `ORDER_NOT_OPEN` en agregar productos, `ORDER_ALREADY_CANCELLED` y `TABLE_NOT_FOUND`.

**Front mientras tanto:** usa mensajes genéricos por status (404/409) en esos casos.

### 29. 🟡 `QR_BASE_URL` en cada ambiente

**Problema:** `qrUrl` es `QR_BASE_URL/{qrCode}` y es `null` si la variable está vacía; los `.env.example-*` la dejan vacía.

**Se pide:** configurar `QR_BASE_URL=https://app.redom.cl/carta` (o la URL de cada ambiente) en develop y producción.

**Front mientras tanto:** si `qrUrl` es `null`, el modal de QR indica que el enlace de la carta aún no está disponible.

### 30. 🟡 Color de marca del restaurante (`theme_color`)

**Problema:** la tabla `restaurant.business` ya tiene la columna `theme_color` (migración inicial), pero la entidad y los DTOs no la exponen. El color que elige el restaurante no se puede guardar ni leer.

**Se pide:** mapear `themeColor` en la entidad del negocio; aceptarlo en `PATCH /business/:id/settings` (valores permitidos: `base`, `red`, `orange`, `yellow`, `green`, `blue`, `violet`; `null` vuelve al predeterminado) y devolverlo en `GET /business/:id/settings` y en `GET /business/my-businesses`.

**Front mientras tanto:** "Mi negocio" permite elegir el color y ya envía `themeColor` en el PATCH (hoy el backend lo descarta en silencio). El color se guarda además en el navegador (`redom.brand-color.<restaurantId>`), así que por ahora solo se ve en el equipo donde se eligió.

### 31. 🟡 Inventario: errores sin código de negocio y mensajes en inglés

**Problema:** los errores de inventario (`libs/restaurant/shared/src/lib/inventory.service.ts`, `adjustment-rules.ts`, `update-business-settings`) llegan solo con el código genérico del status y un texto en inglés. Para mostrar la pantalla "Activar inventario" o un mensaje claro, el front tiene que reconocer el texto.

**Se pide:** códigos estables, con `details` cuando aplique:
- `INVENTORY_DISABLED` (409);
- `INSUFFICIENT_STOCK` (409), con `details.products` como lista de nombres o `variationId`;
- `INGREDIENTS_DISABLED`;
- `INGREDIENT_UNIT_REQUIRED`;
- `INGREDIENT_RECIPE_NOT_ALLOWED`;
- `PRODUCT_NOT_STOCKED`, para productos sin `stockMode` `direct`;
- `UNIT_NOT_SUB_UNIT`;
- `UNIT_DECIMALS_NOT_ALLOWED`;
- `ADJUSTMENT_QUANTITY_SIGN`;
- `ADJUSTMENT_COST_ON_EXIT`;
- `INVENTORY_SETTINGS_REQUIRE_INVENTORY`.

**Front mientras tanto:** `getInventoryErrorMessage` (`src/app/modules/inventory/data-access/inventory-error-message.ts`) reconoce el texto en inglés y lo traduce al español. Si el texto cambia, se muestra tal cual.

### 32. 🟡 Inventario: detalle de un documento y total valorizado por local

**Problema:**
- No existe `GET /inventory/documents/:id`, y `GET /inventory/documents` no filtra por `id`. Al abrir el detalle de una compra o un ajuste por URL directa, el front no tiene cómo pedir la cabecera: tipo, motivo, proveedor, N° de factura, notas y total.
- `GET /inventory/stock` es paginado y no trae el valor total del inventario del local; solo se puede sumar la página visible.

**Se pide:**
- `GET /inventory/documents/:id`, que devuelva la cabecera (los mismos campos de la lista) y, si es posible, sus líneas.
- En `GET /inventory/stock`, un `summary` con `{ totalValue, itemsCount, lowStockCount }` del local, sin importar la página.

**Front mientras tanto:**
- **Detalle:** toma la cabecera del estado de navegación cuando se llega desde la lista. Si no está, la busca en `/inventory/documents` (hasta 5 páginas). Si tampoco aparece, la arma con los movimientos y lo indica en pantalla.
- **Stock:** el total se muestra como "Valor del inventario (esta página)", y "bajo mínimo" sale de `lowStock=true&perPage=1`.

### 33. 🟡 Unidades: eliminar una unidad en uso

**Problema:** `DELETE /units/:id` (`delete-unit-sql.service.ts`) hace soft delete sin revisar si la usan productos/ingredientes (`products.unit_id`) o si es la unidad base de otras (`units.base_unit_id`). Después, compras y ajustes de esos productos fallan con `Unit X not found` (`inventory.service.ts`, `unitFactor`).

**Se pide:** responder 409 con un código (ej. `UNIT_IN_USE`, con `details.products` y/o `details.subUnits`) cuando la unidad esté en uso.

**Front mientras tanto:** la pantalla Unidades no deja eliminar una unidad base que tiene subunidades y el modal de confirmación avisa que se revise que ningún producto o ingrediente la use.

### 34. 🟡 Sets de modificadores: editar opciones por id y poder eliminarlas

**Problema:**
- En `PUT /modifier-sets/:id`, `modifierNameEdit`/`modifierPriceEdit` son posicionales: el backend los aplica a las opciones existentes ordenadas por **id ASC** (`update-modifier-set-sql.service.ts`), pero `GET /modifier-sets` devuelve las opciones ordenadas por **nombre**. Si el cliente manda los arreglos en el orden en que los recibió, edita la opción equivocada (le pone el nombre y precio de otra).
- Las ediciones solo se aplican si llegan los dos arreglos; si se manda menos opciones que las existentes, las demás quedan igual, sin forma de saber si fue a propósito.
- No hay forma de eliminar una opción de un set: solo se edita o se agrega.
- Los errores (`Modifier set not found`, `One or more products not found`) no traen código de negocio.

**Se pide:**
- Que la edición de opciones vaya por id, por ejemplo `options: [{ variationId?, name, price }]`: con `variationId` se edita, sin él se crea, y las opciones existentes que no vengan se eliminan (soft delete). Alternativa mínima: `deleteVariationIds: number[]`.
- Mientras exista el formato actual, devolver las opciones en `GET /modifier-sets` ordenadas por id (o documentar el orden en Swagger).
- Códigos `MODIFIER_SET_NOT_FOUND` y `PRODUCTS_NOT_FOUND`.

**Front mientras tanto:** la pantalla Carta → Modificadores ordena las opciones existentes por id y siempre manda todas en `modifierNameEdit`/`modifierPriceEdit`; las nuevas van en `modifierName`/`modifierPrice`. Las opciones ya guardadas se pueden editar pero no eliminar (solo se pueden quitar filas nuevas sin guardar) y el modal lo avisa. Los errores se traducen por el mensaje en inglés.

### 35. 🟡 Productos: `GET /products` devuelve los sets de modificadores

**Problema:** sin `type`, `GET /products` solo excluye los ingredientes; los sets de modificadores (productos `type: 'modifier'`) salen en la lista de productos y también con `sellable=true` (POS). Como `type` acepta un solo valor, no hay forma de pedir "todo menos modifier".

**Se pide:** excluir `modifier` por defecto, igual que `ingredient` (solo salen con `type=modifier`), o aceptar `excludeTypes`.

**Front mientras tanto:** Carta → Productos y el POS filtran `type === 'modifier'` en la página recibida, así que una página puede mostrar menos filas que `perPage` y `totalItems` los incluye.

### 36. 🟡 Inventario por venta: código para falta de stock y anulación de pagos

**Problema:**
- La falta de stock (`InventoryService.applyMovements`) responde 409 con código genérico `CONFLICT` y sin `details`: `Not enough stock for: Queso mozzarella (negative stock is not allowed)`. El front tiene que reconocerlo por el texto y sacar los nombres con una regex. Puede salir en `POST /orders`, `POST /orders/:id/lines`, `POST /payments` y `PATCH /orders/:id`.
- Anular un pago (`PATCH /payments/:id/cancel`) no devuelve el stock descontado con `on_payment`; solo `PATCH /orders/:id/cancel` llama a `reverseOrderStock`, y un pedido con pagos no se puede anular.
- `GET /inventory/movements` no filtra por `transactionId`, así que no se pueden ver los movimientos de un pedido desde su detalle.
- `GET /products` no filtra por `stockMode`: para listar platos con receta o saber cuáles no tienen receta, el front recorre hasta 5 páginas de productos y pide `GET /inventory/recipes` de cada uno.

**Se pide:**
- Código `NOT_ENOUGH_STOCK` con `details: { items: [{ productId, variationId, name, required, available }] }`.
- Definir qué pasa con el stock al anular un pago de un pedido ya descontado (devolverlo o dejarlo explícito).
- Filtro `transactionId` en `GET /inventory/movements`.
- Filtro `stockMode` en `GET /products` y, si es posible, un `hasRecipe` (o un endpoint con los platos sin receta).

**Front mientras tanto:** detecta el 409 por el prefijo `Not enough stock for:` y muestra los nombres en español; el aviso de platos sin receta se calcula en la pestaña Inventario del negocio revisando hasta 500 productos.

### 37. 🟡 Costeo y control: detalle de conteos/transferencias, filtros y códigos

**Problema:**
- No existen `GET /inventory/counts/:id` ni `GET /inventory/transfers/:id`: el detalle se arma con `GET /inventory/movements?documentId=` (máx. 100 por página) y en conteos las líneas sin diferencia no generan movimiento, así que no se puede ver qué se contó.
- `linesCount` en `GET /inventory/documents` cuenta movimientos: en transferencias es el doble de las líneas y en conteos solo las líneas con diferencia.
- `GET /inventory/stock` no filtra por `variationId` (para mostrar el stock del origen en una transferencia) y `perPage` máx. 100 obliga a paginar la hoja de conteo.
- `GET /inventory/consumption` no indica si hubo un conteo en el período: un conteo que cuadró exacto no se distingue de no haber contado.
- `GET /inventory/food-cost` filtra `categoryId` exacto, sin subcategorías.
- Ningún error de conteos, transferencias, food cost o consumo trae código de negocio (repetidos, mismo origen y destino, falta de stock, unidad inválida, fechas).

**Se pide:**
- `GET /inventory/documents/:id` con cabecera y líneas (incluidas las de conteo sin diferencia), o guardar las líneas del conteo.
- `linesCount` = líneas del documento.
- Filtro `variationId` (o `variationIds`) en `GET /inventory/stock`.
- En consumo, `countsInPeriod` o `lastCountDate` por ítem.
- `categoryId` que incluya subcategorías en food cost.
- Códigos: `ITEM_REPEATED`, `SAME_LOCATION`, `NOT_ENOUGH_STOCK` (ver #36), `INVALID_UNIT`, `INVALID_DATE_RANGE`.

**Front mientras tanto:** el detalle de conteos y transferencias se arma con los movimientos (hasta 100); la lista divide `linesCount` por 2 en transferencias y muestra "N con diferencia" en conteos; la hoja de conteo pagina de a 100; el stock del origen se busca por SKU; los errores se traducen por el texto en inglés.

### 38. 🟡 Preparaciones, órdenes de compra y lotes

**Problema:**
- No hay forma de listar solo las preparaciones (ingredientes con receta de producción): el front pide `GET /inventory/recipes` por cada ingrediente para saberlo.
- No existe un endpoint que, dado un `variationId`, devuelva su producto; abrir una producción desde un enlace con solo la variación obliga a recorrer todos los ingredientes.
- El detalle de una orden de compra no trae `receivedPercent` (el listado sí).
- `GET /inventory/lots` no está paginado ni tiene búsqueda por texto; las alertas cuentan lotes trayendo el arreglo completo.
- Los movimientos (`GET /inventory/movements`) no indican de qué lote salió cada cantidad.
- `PUT /inventory/purchase-orders/:id` y la recepción de una orden en borrador: se acepta recibir una orden `draft`; confirmar si es intencional.
- Ningún error de producción, órdenes de compra o lotes trae código de negocio.

**Se pide:**
- Filtro `hasProductionRecipe=true` (o `recipeKind=production`) en `GET /products?type=ingredient`, con `recipeYield`.
- `GET /products/variations/:variationId` (o `variationId` como filtro de `GET /products`).
- `receivedPercent` en el detalle de la orden.
- Paginación, búsqueda y un `GET /inventory/lots/summary` con `{ expiring, expired }` por local.
- `lotId`/`lotNumber` en los movimientos.
- Códigos: `PREPARATION_WITHOUT_RECIPE`, `RECIPE_CYCLE`, `PURCHASE_ORDER_NOT_EDITABLE`, `PURCHASE_ORDER_INVALID_TRANSITION`, `LOT_ON_EXIT`.

**Front mientras tanto:** revisa las recetas de los ingredientes de a 4 en paralelo; recorre los ingredientes para encontrar la preparación de un `variationId`; calcula el % recibido del detalle; las alertas de vencimiento piden los lotes completos; los errores se traducen por el texto en inglés.

### 39. 🔴 Auth: el access token que entrega `refresh-token` siempre responde 401

**Problema:**
- El `AuthGuard` (`libs/auth/features/guards/src/lib/jwt-token.guard.ts`) exige que exista en Redis la clave `jwt:<code>:<token>`.
- El login la registra (`session-tokens.service.ts`), pero `POST /auth/refresh-token` (`refresh-token-sql.service.ts`) firma el nuevo access token y **no** la registra. Solo guarda `refresh:<newRefreshToken>`.
- Resultado: después de 2 h (cuando vence el primer token) toda llamada con el token renovado responde 401, aunque el refresh fue exitoso.
- Además, el payload del token renovado no incluye `restaurantId` (el del login sí).

**Se pide:**
- En el refresh, guardar `jwt:<code>:<newAccessToken>` con el mismo TTL que en el login.
- Incluir `restaurantId` en el payload del token renovado, igual que en el login.

**Front mientras tanto:** si la petición reintentada con el token renovado vuelve a dar 401, el interceptor cierra la sesión, avisa "Tu sesión expiró" y lleva al inicio de sesión. Antes la app quedaba "logueada" con todas las llamadas fallando. Con esto, la sesión dura lo que el primer token (2 h) hasta que se corrija el backend.

### 40. 🟢 Pagos: dividir la cuenta y pagar por producto (resuelta)

**Problema:** `POST /payments` recibe solo `{ transactionId, amount, method, tipAmount?, amountTendered?, note? }`. Un pago no queda asociado a productos, así que no se puede dividir la cuenta por lo que consumió cada persona ni saber qué productos quedan por pagar.

**Se pide:**
- En `POST /payments`, un campo opcional `lines: [{ sellLineId, quantity }]` (línea del producto; sus modificadores la siguen):
  - Si viene, el backend calcula el monto: Σ `quantity` × (precio del producto + sus modificadores por unidad), con el descuento del pedido repartido en proporción. `amount` se vuelve opcional o se valida contra ese cálculo.
  - Validar que `quantity` no supere lo pendiente de pagar de la línea (400 con código, ej. `LINE_ALREADY_PAID`, con `details: { sellLineId, pendingQuantity }`).
  - Se puede mezclar: pagos por producto y pagos por monto en el mismo pedido.
- En `GET /orders/:id`, por cada línea: `paidQuantity` y `pendingAmount`, y en la cabecera seguir con `remaining`.
- En `GET /payments?transactionId=`, por pago: las líneas que cubrió (`lines: [{ sellLineId, productName, quantity, amount }]`).
- Al anular un pago (`PATCH /payments/:id/cancel`), liberar esas cantidades.
- Definir qué pasa si se anulan productos de un pedido con pagos por producto (hoy un pedido con pagos no se puede anular).

**Front cuando esté:** en el cobro, un modo "Dividir por productos": se marcan productos y cantidades (ej. 1 de 2 hamburguesas), se muestra el monto calculado y cada línea queda como pagada o pendiente. La precuenta podrá imprimirse por persona con sus productos.

### 41. 🔵 Pagos por producto: ajustes y propina sugerida

**Problema:**
- La vista previa del front usa `pendingAmount × cantidad / pendingQuantity`, pero el backend (`payment-lines.service.ts`, `amountFor`) cobra `round(netAmount × cantidad / quantity)`. En pagos parciales de una misma línea pueden diferir algunos pesos; `netAmount` no se expone.
- `GET /payments/all` no devuelve `lines`, así que la página de Pagos no muestra qué productos cubrió cada pago.
- Pagar más que `remaining`, el efectivo que no cubre monto + propina y `amountTendered` en un medio que no es efectivo responden 400 sin código.
- La propina sugerida (10 %) está fija en el front.

**Se pide:**
- En `GET /orders/:id`, por línea: `netUnitAmount` (o `netAmount`) para que la vista previa calce exacto; o un `POST /payments/preview` con `lines` que devuelva el monto.
- `lines` en `GET /payments/all`.
- Códigos: `PAYMENT_EXCEEDS_REMAINING` (`details: { remaining }`), `CASH_NOT_ENOUGH`, `TENDERED_ONLY_CASH`.

**Front mientras tanto:** muestra el total por productos como estimado y el monto real sale de la respuesta; la propina sugerida usa la constante `DEFAULT_TIP_PERCENT = 10`.

### 42. 🟢 Onboarding: simplificar el alta del negocio (resuelta)

> Resuelta: `POST /business` con `location` devuelve `{ id, locationId }` y deja el negocio activo; `onboarding-status`; whoami con `businessName` y `locationsCount`; `posSettings`, `suggestedTipPercent` y `sellPriceTax` aplicados. Nota: `GET /business/:id/settings` devuelve `posSettings` como texto JSON en snake_case, mientras el PATCH recibe un objeto camelCase; el front normaliza ambos.

**Problema:**
- `POST /business` responde `void`: el front tiene que pedir `whoami` o `my-businesses` para saber el id.
- No crea el primer local; el front llama `POST /business-locations` aparte. Sin local, el POS no puede vender.
- Los locales nuevos quedan con `invoiceSchemeId: 0` y `invoiceLayoutId: 0` en vez del esquema `FAC-` creado con el negocio.
- El asistente de 5 pasos (`/setup/steps`) pide datos que nada usa (`enabledModules`, `keyboardShortcuts`, `enableTooltip`, `transactionEditDays`, `skuPrefix`, método contable, vencimientos) y `isActive` solo se exige para activarse a sí mismo. El front ya no muestra el asistente: lo completa en segundo plano con valores por defecto y activa el negocio.
- `sellPriceTax` se guarda pero los pedidos y el food cost siempre separan el IVA como si el precio lo incluyera.
- `posSettings` (meseros, mesas) solo se escribe en el paso 5 y no se puede editar con `PATCH /business/:id/settings`.

**Se pide:**
- `POST /business` que devuelva `{ id }` y acepte opcionalmente `location: { name, address?, city?, mobile? }` para crear el primer local en la misma transacción, con el esquema de facturación por defecto.
- Locales nuevos asociados al esquema de facturación por defecto del negocio.
- Definir si el asistente y `isActive` siguen existiendo; si no, retirarlos (o activar el negocio al crearlo).
- Aplicar `sellPriceTax` en el cálculo de pedidos o quitar el campo.
- `posSettings` editable en `PATCH /business/:id/settings`.

**Prompt para el backend:** `docs/backend-prompts/onboarding-negocio.md` (incluye además `GET /business/:id/onboarding-status` y `businessName` / `locationsCount` en whoami).

**Front mientras tanto:** crea el negocio, luego el local (y sector, mesas y productos si el dueño los elige) en llamadas separadas; completa los 5 pasos en segundo plano con `BusinessQuickSetupService` y activa el negocio; en Mi negocio solo se editan nombre, logo, moneda, zona horaria, RUT, IVA y "precios incluyen IVA".

### 43. 🟡 Caja y turnos: ajustes del MVP 1

**Problema:**
- El prompt del front decía `page` y `limit` para `GET /cash/sessions`, pero el backend usa `perPage` (`limit` se descarta en silencio). El front usa `perPage`.
- Si se envía `cashRegisterId` de una caja cerrada, `POST /payments` responde `CASH_SESSION_REQUIRED` también para tarjeta y transferencia, y `CASH_REGISTER_AMBIGUOUS` aplica a cualquier medio. El prompt decía que tarjeta y transferencia no necesitan caja.
- `openingAmount` y los montos de retiros e ingresos no se redondean a los decimales de la moneda (en CLP se puede guardar 1000,5).
- Los valores de billetes y monedas del cierre son libres (no hay lista por moneda).
- El detalle en vivo de un turno abierto solo lo ve el dueño (`business.ownerId`); un administrador u otro rol de confianza no.
- Abrir una caja desactivada responde 409 `CONFLICT` sin código de negocio, y en una apertura simultánea `details.sessionId` puede venir `null`.

**Se pide:**
- Que tarjeta y transferencia ignoren la caja cerrada (o la tomen fuera de turno) en vez de rechazar el cobro, o documentarlo.
- Redondear `openingAmount` y los movimientos a `currencyPrecision`.
- Permiso explícito para ver el detalle en vivo (para la etapa de permisos) en vez de solo el dueño.
- Código `CASH_REGISTER_INACTIVE` y `sessionId` siempre presente en `CASH_SESSION_ALREADY_OPEN`.

**Front mientras tanto:** pagina con `perPage`; con tarjeta o transferencia solo envía la caja si sabe que está abierta; los montos se ingresan en pesos enteros; los billetes y monedas son los de Chile.

### 44. 🟡 Gastos y cuentas por pagar: ajustes de la fase 2

**Problema:**
- El prompt del front decía `page` y `limit` para `GET /expenses`, pero el backend usa `perPage` (`limit` se descarta en silencio). El front usa `perPage`.
- Una categoría duplicada responde 409 con código genérico `CONFLICT`; el front la reconoce por el texto.
- `PUT /expenses/recurring/:id` exige el registro completo y vuelve a validar la categoría como activa: pausar o editar un recurrente cuya categoría se desactivó falla. `PUT /expenses/:id` también exige los campos obligatorios aunque el cambio sea parcial.
- No hay un detalle de compra en finanzas: `GET /payables` solo trae deudas abiertas, así que una compra ya pagada no tiene cabecera (proveedor, total) en la página de pagos.
- Al editar un gasto, `dueDate` no se recalcula si cambian la fecha o el proveedor, y no hay forma de pedir "recalcular con las condiciones del proveedor".
- Los archivos subidos a `expense_documents` que nunca se asocian a un gasto quedan huérfanos.

**Se pide:**
- `PATCH /expenses/recurring/:id` parcial (al menos `isActive`), validando la categoría solo si cambia; lo mismo para `PUT /expenses/:id`.
- `GET /payables/purchase/:id` (o `/inventory/documents/:id`) con cabecera, total, pagado y saldo, también si ya está pagada.
- Código `EXPENSE_CATEGORY_EXISTS` para el duplicado.
- `dueDate: null` en `PUT /expenses/:id` para recalcular con las condiciones del proveedor.
- Limpieza periódica de archivos no asociados.

**Front mientras tanto:** pagina con `perPage`; envía el registro completo al pausar o editar recurrentes y gastos; arma la cabecera de la compra con el listado de cuentas por pagar o con el router state.

### 45. 🟡 Propinas y comisiones: ajustes de la fase 3

**Problema:**
- El prompt del front decía `page` y `limit` para `GET /tips/payouts`, pero el backend usa `perPage` (`limit` se descarta). El front usa `perPage`.
- En `POST /tips/payouts`, `locationId` sirve a la vez para filtrar las propinas y para elegir la caja de un pago en efectivo: con caja activa y varios locales no se puede pagar en efectivo propinas de todos los locales.
- Varios 400 no traen código (modo `points` sin participantes, participante repetido, `dateFrom > dateTo`, "Cash payouts need the cash register…"); el front los reconoce por el texto.
- La comisión y la fecha de abono se calculan al vuelo con la configuración actual: cambiar una comisión cambia el historial. Los días hábiles no consideran feriados.
- `GET /tips/payouts/:id` deja `payments` en 0 después de anular, así que no se ve cuántos pagos cubría.

**Se pide:**
- Separar el local de las propinas (`locationId`) de la caja (`cashRegisterId` basta para el efectivo), o permitir `cashRegisterId` sin restringir el período a su local.
- Códigos de negocio para esos 400 (`TIP_PARTICIPANTS_REQUIRED`, `TIP_PARTICIPANT_REPEATED`, `INVALID_DATE_RANGE`).
- Guardar la comisión y la fecha de abono por pago al cobrar (o versionar la configuración), y feriados de Chile en los días hábiles.
- Mantener en el detalle de una liquidación anulada cuántos pagos cubría.

**Front mientras tanto:** pagina con `perPage`; con caja activa y varios locales pide elegir el local para pagar en efectivo; muestra comisiones y abonos como estimados.

### 46. 🔵 Centro de ayuda (preguntas frecuentes) y asistente con IA

**Problema:** no hay dónde documentar el uso de Redom ni responder dudas dentro de la app.

**Se pide:** ver el prompt completo en `docs/backend-prompts/centro-de-ayuda.md`:
- migración con 4 tablas (`help_categories`, `help_articles` con búsqueda de texto completo en español sin tildes, `help_article_feedback`, `help_chat_logs`) y sus entidades;
- endpoints públicos del centro de ayuda y CRUD de administración de categorías y preguntas frecuentes (solo equipo de Redom);
- `POST /help/chat` con streaming SSE usando Claude Haiku 5.5 (`HELP_MODEL`), solo con los artículos publicados, cuota mensual por negocio, registro de tokens y costo;
- feedback de artículos y respuestas, métricas de uso y revisión de preguntas mal respondidas.

**Front mientras tanto:** nada; el centro de ayuda y el panel del asistente se construyen cuando estén los endpoints.

---

## Resueltas

Resueltas por el backend en octubre de 2026. Se indica cuando la solución quedó distinta a lo pedido.

| # | Qué se resolvió |
|---|---|
| 1 | `GET /orders` trae `status`, `paymentStatus`, `finalTotal`, `customerName`, `contactId`, `resTableId` y `locationId`, y filtra por `status`, `paymentStatus`, `dateFrom`/`dateTo`, `resTableId` y `locationId`. |
| 2 | `GET /tables` trae `currentTransactionId` y `openTransactionIds`. |
| 3 | `POST /orders` y `POST /orders/:id/lines` aceptan `note` por producto; sale en la comanda y en el KDS. |
| 4 | Cancelar un pedido ya no cuenta los pagos anulados. |
| 5 | **Distinto:** solo se documentó en Swagger que el `:id` de `mark-line-served` es el de la línea; la ruta no cambió. |
| 6 | `PUT /tables/:id`: `occupied` → 409; con pedido abierto → 409; sin pedido → `available`, `reserved` o `blocked`. |
| 7 | `qrUrl = https://app.redom.cl/carta/{qrCode}` y endpoint público `GET /restaurant/api/menu/:qrCode`. **La página de la carta la construye el front.** |
| 8 | DTOs de `/pos/*` documentados; `POST /pos/details` devuelve los meseros reales (antes llegaba vacío). |
| 9 | `GET /auth/api/users` trae `hasPin`; el PIN es de 4 dígitos exactos. |
| 10 | **Distinto:** no hay FK real; el backend valida la sucursal (404). `POST /internal-user` acepta `branchId` y devuelve `{ code }`; `GET /users` trae `branchId`; se limpia la caché del perfil al editar; `GET /pos/service-staff` acepta `?locationId=` y devuelve `branchId`. |
| 11 | `PUT /kitchen/:id/mark-cooked?stationId=` marca solo las líneas de esa estación. |
| 12 | `GET /kitchen` trae `staffNote` y `additionalNotes` por pedido y `sellLineNote` por línea. |
| 13 | **Distinto:** la prueba es `POST /print-jobs/test` `{ printerId }`; `GET /printers` trae `lastSeenAt`. |
| 14 | **Distinto:** el claim es `POST /print-jobs/pending/claim?printerId=&agentId=`; los trabajos no reportados en 2 minutos vuelven a quedar disponibles; se cierran con `PATCH /print-jobs/:id`. |
| 17 | `GET /bookings` trae `customerMobile`, `contactId` y `tableId`; filtro `?status=`; se aplica `?userId=`; crear y editar devuelven `{ id }`. |
| 18 | `DELETE /contacts/:id`; `q` opcional en `GET /customers`; `PUT /contacts/:id` → 409 si el teléfono existe; `GET /customers/:id` trae `summary { visits, totalSpent, avgTicket, lastVisitAt }`. |
| 19 | `GET /dashboard` trae `salesByDay`, `salesByCategory`, `paymentsByMethod` y `tables { total, occupied }`; `sales` y `orders` usan `current`/`previous` (`today`/`yesterday` quedan como alias). |
| 20, 23 | El id se toma solo de la URL en `PUT`/`DELETE /products/:id`, `PATCH /stations/:id`, `PUT /contacts/:id`, `POST`/`DELETE /contacts/:id` y `PUT /tables/:id`. |
| 22 | Todos los errores traen `code` y, cuando aplica, `details` (por ejemplo `CUSTOMER_PHONE_EXISTS`, `SCHEDULE_OVERLAP`, `BOOKING_TABLE_CAPACITY`). |
| 24 | `GET /products` acepta `isActive` y `sellable=true`. |
| 26 | Roles ordenados en la consulta; se corrigió `active=false`. |
| 27 | Contraseña actual incorrecta → 400 `CURRENT_PASSWORD_INVALID`; solo se puede cambiar la propia contraseña. |

Además, sin pedirlo: `GET /auth/api/users` ya no llega vacío desde la página 2.

### 21. ✅ Subida de imágenes (productos, categorías, logo y foto de perfil)

**Resuelto con:** subida en 3 pasos con URL prefirmada de S3: `POST /files/upload-url` → `PUT` directo a S3 → `POST /files/:id/confirm`. El `fileId` se asocia con `imageFileId` (productos y categorías), `logoFileId` (`PATCH /business/:id/settings`) y `PUT /auth/api/profile/image`. Las respuestas traen `imageUrl`, `logoUrl` y `profileImageUrl`, que son URLs firmadas válidas por 1 hora.

**Front:** el campo "Imagen (URL)" se reemplazó por el selector de imagen en todos los formularios. Funciona en local y en develop.
