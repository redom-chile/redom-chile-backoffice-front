# REDOM — Solicitudes al backend

Cambios que el frontend necesita del backend (`redom-chile-backend`), detectados al integrar cada módulo.
Cada solicitud indica el endpoint, el problema, lo que se pide y cómo lo resuelve el front mientras tanto.

Estados: 🔴 bloquea una funcionalidad o produce datos erróneos · 🟡 el front usa un workaround · ⚪ por decidir · 🟢 resuelto (mover a la sección final)

---

## Resumen

| Prioridad | Solicitudes |
|---|---|
| 🟡 Hay workaround en el front | #15 token de dispositivo para impresión · #16 permiso para ver todas las reservas (fase de permisos) · #28 códigos de error faltantes · #29 `QR_BASE_URL` por ambiente · #30 color de marca del restaurante · #31 códigos de error de inventario · #32 detalle de documento y total de stock |
| ⚪ Por decidir | #25 entrar solo con PIN |
| 🟢 Resueltas | #1–#14, #17–#24, #26, #27 |

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
