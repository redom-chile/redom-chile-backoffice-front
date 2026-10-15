# Redom — Lo que hay y lo que se viene (front)

Estado del front por módulo y lo que falta, priorizado. Lo que depende del backend está en `BACKEND-REQUESTS.md` (se cita por número).
Al cerrar un punto, bórralo de aquí; al agregar una fase, anota sus limitaciones en el detalle por área.

Última actualización: 2026-10-15 (revisión general de la carta pública, etapas 1 a 7).

# 1. Lo que hay

| Módulo | Estado | Probado |
|---|---|---|
| POS, pedidos, cobro (dividir, propina sugerida), mesas, sectores, cocina | Implementado | Parcial (falta E2E de dividir por productos) |
| Inventario: fases 1 a 5 (stock, modificadores, recetas, costeo, preparaciones, OC, lotes) | Implementado | Solo fase 1 |
| Caja y turnos; gastos y cuentas por pagar; propinas y comisiones | Implementado | No |
| Onboarding y Mi negocio | Implementado | No |
| Centro de ayuda y asistente con IA | Implementado | No |
| Planes y suscripciones (fases 2 a 6: entitlements, Plataforma, pago manual, Flow, proceso diario) | Implementado | No |
| Roles y permisos | Implementado (`enforcePermissions` encendido en todos los ambientes) | No |
| Acceso de soporte | Implementado | No |
| Carta pública 1: carta por local, QR, publicar, agotados, etiquetas y horarios | Implementado | No |
| Carta pública 2: promociones, banners, ventana de ofertas, packs, personalización | Implementado | No |
| Carta pública 3: pedidos desde la mesa y bandeja de Pedidos de clientes | Implementado | No |
| Carta pública 4: mesero, cuenta, reservas y encuesta (barra inferior experimental) | Implementado | No |
| Carta pública 5: retiro y delivery, zonas, pago con comprobante, seguimiento | Implementado | No |
| Carta pública 6: llaves, webhooks, widget y carta incrustada | Implementado | No |
| Carta pública 7: idiomas (carta y traducciones con IA) y fidelización (con canje en el POS) | Implementado | No |
| Carta: modo oscuro y tamaño del texto ("Aa") | Implementado | No |
| Variedades de productos (formulario, tabla, POS) | Implementado | No |

**Revisión general (2026-10-15):** cuatro revisiones (carta pública, administración de la carta, fidelización/POS/variedades y contratos/permisos/planes). Los contratos con el backend calzan (rutas, campos, enums, permisos y planes). Se corrigieron 15 errores, entre ellos: "Lo antes posible" con el local cerrado programaba el pedido sin aviso; delivery sin comunas dejaba pedir y fallaba; subcategorías fuera de horario no se atenuaban; encuestas de hoy no aparecían; los textos sin guardar de la tarjeta del local se perdían al guardar otra cosa; el formulario bancario se vaciaba; variedades con precio decimal no se podían guardar; textos de errores faltantes (MENU_MOVED, PRODUCT_UNAVAILABLE, ORDER_TOO_LARGE, llaves de API).

# 2. Lo que se viene

## 2.1 Decisiones

Tomadas (2026-10-15):
- Permisos en producción: `enforcePermissions` encendido en `environment.prod.ts` (requiere el backend de permisos desplegado).
- Carta en develop: sin landing propia por ahora; los QR y enlaces de develop abren `redom.cl` (API de prod).
- Widget: lo ve cualquier rol que vea la carta (`public-menu:see-module`); Llaves y Webhooks siguen pidiendo `public-api:*` (o muestran el aviso del plan a quien configura la carta).
- Cancelar un pedido por transferencia con el comprobante enviado: se mantiene oculto por ahora.
- Pack con variedades: se permite; lo decide el dueño.
- Barra inferior "liquid glass" de la carta: se queda.
- Menú lateral reordenado por tarea: Día a día (Resumen, Ventas, Salón, Cocina) · Carta y clientes (Carta con Agotados de hoy, Carta online, Clientes con Fidelización) · Administración (Inventario, Recetas y costos, Finanzas) · Negocio (Mi negocio con Horarios, Equipo y permisos, Equipos y pagos, Plan y facturación, Ayuda) · Plataforma (SUPERADMIN) · Plantilla.

Pendientes:
- [ ] Precios de los planes y qué incluye cada uno (borrador en el prompt de planes).
- [ ] Ítems de la plantilla en el menú (Errors, Components, Download, Gift Card, Users, Notifications, Folders): confirmar si se eliminan (hoy solo los ve el SUPERADMIN, en el grupo "Plantilla").
- [ ] Artículos del Centro de ayuda: actualizados en `docs/help-center/` con el menú nuevo; volver a cargarlos en el backend (migración o CRUD) para que la app los muestre así.

## 2.2 Errores y mejoras del front (por prioridad)

**Media:** corregidos el 2026-10-15 (reservas con las 2 h dentro del horario; avisos "Se agotó" del carrito como código, recalculados y traducidos; aviso de cambios sin guardar en Personalización; mensajes del backend en marketing y 404 al borrar tratado como ya eliminado; cliente de la venta en solo lectura en el POS; variedades quitadas ocultas en selectores de inventario y recetas, con "Quitada" si tienen stock o receta, y "Sin receta" por variedad en el producto; slugs nulos sin URLs con "null" y tipos corregidos). Queda por backend: Stock, Conteos y Food cost siguen mostrando variedades quitadas (#66).

**Baja**
- [ ] Carta: el idioma guardado no se agrega a la URL (`?lang=`) si no venía en ella; `isOpenNow` no se refresca con la carta abierta mucho rato; los `href` de las categorías quedan con la URL anterior tras cambiar idioma; código muerto `saveTableQr`.
- [ ] Comprobante: deducir el tipo por la extensión si el navegador no informa `file.type` (algunos celulares).
- [ ] Accesibilidad: pestañas sin `tabpanel`/flechas (Pedidos de clientes, Marketing, API); fila del historial de webhooks sin teclado; menú "Agotar" sin Escape; orden de recompensas solo arrastrando; `app-toggle` sin `aria-label` en fidelización.
- [ ] Marketing: `endsAt` de promociones y banners a las 23:59 (no 23:59:59); nombres de productos enlazados de los primeros 100.
- [ ] Encuestas de retiro y delivery muestran "Sin mesa"; mostrar el canal.
- [ ] Fidelización: "Faltan N" sin unidad; pestañas visibles con el plan bloqueado; `amountUnit` acepta más de 2 decimales; producto gratis sin filtrar los no vendibles.
- [ ] Variedades: impedir una variedad llamada igual que el producto (se oculta en la carta, como `DUMMY`).
- [ ] Menú: "Marketing de la carta" no muestra candado en Free (cae en `qr_menu`); `plan-routes` no soporta "alguna de" varias funciones.

## 2.3 Pruebas de punta a punta

- [ ] Carta pública, etapas 1 a 7, contra la API real y en un deploy de Netlify (incluye QR de mesa, pedidos, mesero/cuenta, reservas, retiro y delivery con comprobante, widget en una web real, idiomas).
- [ ] Revisión en Safari de iOS: carta, barra inferior, modo oscuro, tamaño del texto y widget.
- [ ] Revisión de las traducciones de la carta (en/pt/de) por hablantes nativos.
- [ ] Fidelización: programa, recompensa de $2.000, venta con cliente, canje y anulación (pasos del prompt de la etapa 7).
- [ ] Variedades: crear, pasar de precio único, quitar, vender en el POS y ver en cocina.
- [ ] El resto de módulos: ver "Pruebas pendientes" abajo.

## 2.4 Esperando al backend (`BACKEND-REQUESTS.md`)

- **Bloqueante:** #39 (token renovado; la sesión se cierra a las 2 h).
- **Inventario:** #66 `isActive` de variaciones en stock, recetas y food cost.
- **Carta pública:** #51 etiquetas y horario al editar · #52 pack sin opción · #53 reservas de la carta en el listado · #54 `QR_BASE_URL` a la landing · #55 zona y filtros en pedidos online · #56 comunas públicas y contexto del pedido · #57 códigos en la API pública · #59 ocultar variaciones inactivas · #60 pedidos con solo `online_ordering` · #61 descuento canjeado editable · #62 horario del local en reservas · #63 datos nulos y documentación · #65 IP del cliente detrás de Netlify y develop.
- **Otros:** #15, #16, #28–#38, #41, #43–#45, #48, #49, #58, #64.

# 3. Detalle por área

## Pruebas pendientes

- [x] Fase 1 · Inventario: E2E validada por negocio.
- [ ] Fase 2 · Modificadores: E2E desde la UI (plan de pruebas, pestaña "Fase 2 · Modificadores").
- [ ] Fase 3 · Recetas: E2E desde la UI (pestaña "Fase 3 · Recetas"). Requiere el backend con las rutas `/inventory/recipes`.
- [ ] Fase 4 · Costeo y control: E2E desde la UI (pestaña "Fase 4 · Costeo").
- [ ] Fase 5 · Preparaciones, órdenes de compra y lotes: E2E desde la UI (pestaña "Fase 5 · Preparaciones y lotes").
- [ ] Revisión visual en celular y modo oscuro de lo hecho en las fases 2 a 5 (no se vio en navegador).
- [ ] Comanda y precuenta en impresora térmica real de 58 mm con modificadores.

## Inventario

- **Stock:** el valor total es solo de la página visible (#32).
- **Documentos:** el detalle abierto por URL directa arma la cabecera con un respaldo (#32).
- **Alerta de bajo mínimo** del Resumen: no se refresca sola después de una compra o ajuste.
- **Proveedores:** se cargan hasta 100.
- **Compras/ajustes con `?variationId=`:** la precarga solo busca entre los primeros 100 ítems.
- **Unidades:** eliminar una unidad en uso no se bloquea en el backend (#33).
- **Categoría de ingredientes:** usa las categorías de la carta. Falta decidir si se oculta el campo o se piden categorías propias para insumos.

## Modificadores (fase 2)

- Las opciones ya guardadas no se pueden eliminar, solo editar (#34).
- La edición de opciones depende del orden por id (#34).
- Carta → Productos y POS filtran los sets en el front: una página puede mostrar menos filas que `perPage` (#35).
- El modal de opciones es un diálogo normal; evaluar formato bottom sheet en celular.
- `printJobIds` de crear pedido no se usa; `GET /print-jobs/by-transaction` no trae modificadores.

## Recetas y descuento por venta (fase 3)

- La lista de recetas carga todos los productos para encontrar los platos (no hay filtro `stockMode`, #36).
- El aviso de platos sin receta revisa hasta 500 productos (#36).
- El 409 de falta de stock se reconoce por el texto `Not enough stock for:` (#36).
- Anular un pago no devuelve el stock descontado con "Al pagar" (#36).
- El kardex no filtra por pedido (#36).

## Costeo y control (fase 4)

- **Food cost:**
  - El filtro de categoría no incluye subcategorías (el backend compara la categoría exacta, #37).
  - El promedio de food cost y de margen excluye platos sin receta y sin precio; el margen es un promedio simple, no ponderado por ventas.
  - "Costo incompleto" se basa en `unitCost = 0`: no distingue entre "sin compra con costo" y un costo real de 0.
  - Sin exportar a Excel/CSV.
- **Conteos:**
  - No hay borradores: si se cierra la página, se pierde lo contado.
  - Más de 500 ítems contados hay que dividirlos en varios conteos.
  - La hoja carga todo el stock de a 100 por página y no está virtualizada (lenta con más de ~2.000 ítems).
  - No hay detalle propio de un conteo; se ve en el detalle del documento (#37).
- **Transferencias:**
  - "Stock en origen" hace una consulta por ítem buscando por SKU (no hay filtro de stock por variación, #37).
  - El menú no recalcula la cantidad de locales al cambiar de negocio.
  - El resumen después de transferir no se guarda; el detalle del documento tiene lo mismo.
- **Documentos:**
  - El detalle carga 100 movimientos: una transferencia de más de 50 ítems se ve incompleta.
  - El filtro por tipo en el historial está listo (`showType`) pero ninguna pantalla lo muestra todavía.
  - La lista de conteos usa su propia tabla, no la compartida de documentos.
- **Consumo:**
  - El aviso "no hay conteo en el período" no distingue un conteo que cuadró exacto (#37).
  - "Mes anterior" y "Últimos 7 días" se calculan con la fecha del navegador, no con la zona del negocio.
  - El filtro de ítem no encuentra platos con receta y trae solo 20 resultados por búsqueda.

## Preparaciones, órdenes de compra y lotes (fase 5)

- **Preparaciones y producción:**
  - El buscador de preparaciones pide `GET /inventory/recipes` por cada resultado para saber si tiene receta de producción (#38).
  - Abrir "Nueva producción" solo con `variationId` recorre todos los ingredientes para encontrar el producto (#38).
  - El stock de cada insumo en el consumo estimado se busca por nombre, una consulta por insumo.
  - El costo estimado usa el costo promedio; el real puede variar porque la salida consume primero los lotes que vencen antes.
  - El vencimiento no se compara con la fecha de producción.
  - La lista de producciones no filtra por preparación y su columna "Líneas" cuenta producido + consumido.
- **Órdenes de compra:**
  - Al editar, los ítems se reconocen en un catálogo de 100 por tipo; si no aparece, se muestra como "Producto" sin SKU (solo visual).
  - Cada línea exige costo (puede ser 0) aunque el backend lo trata como opcional.
  - El % recibido del detalle se calcula en el front (el detalle no trae `receivedPercent`).
  - El filtro de proveedor carga los primeros 100.
- **Lotes y vencimientos:**
  - Las alertas cuentan ítems, no lotes, y hacen dos consultas sin paginar a `GET /inventory/lots`.
  - La pantalla de lotes no tiene búsqueda por texto (solo filtra por ítem con `variationId`).
  - El badge de vencimiento del stock calcula los días con la zona del navegador; el umbral ámbar es fijo en 7 días.
  - El detalle de una producción no muestra los lotes consumidos (los movimientos no traen lote).

## Sesión

- Por un error del backend (#39), el token renovado no sirve: la sesión se cierra a las 2 h aunque haya refresh token. Cuando se corrija, la renovación debería quedar transparente sin cambios en el front.

## Cobro

- [ ] E2E de "Dividir por productos" (pasos del prompt del backend, #40) y de la propina sugerida.
- El total "Por productos" es una estimación: en pagos parciales de una línea el backend calcula sobre el neto de la línea y puede diferir en algunos pesos (#41).
- La página de Pagos no muestra los productos de cada pago hasta que `GET /payments/all` devuelva `lines` (#41).
- La propina sugerida se configura en Mi negocio → Punto de venta (10 % si no viene). Se sugiere en cada pago parcial; no se lleva la propina total del pedido.
- Si lo elegido supera el saldo (por pagos por monto anteriores), hay que terminar "Por monto".
- La pre-cuenta por persona estima el IVA en proporción.

## Onboarding y Mi negocio

- [ ] Probar el onboarding de punta a punta (registro → negocio y local en una llamada → mesas → productos → POS), retomar sin local y los 409 (`BUSINESS_ALREADY_EXISTS`, `USER_ALREADY_IN_BUSINESS`).
- [ ] Probar "no incluyen IVA" ($1.000 → $1.190) y la propina sugerida configurada en el cobro.
- El nombre del negocio en el encabezado se oculta en pantallas muy angostas (celular) para no tapar el menú.
- El POS aplica mesas, meseros y mesero obligatorio desde la configuración del negocio; los negocios que nunca guardaron esas opciones ven el POS completo como antes.
- `businessGuard` manda al onboarding ("Tu local") al dueño que desactiva todos sus locales. Confirmar con producto.
- Con `BUSINESS_ALREADY_EXISTS` y 0 locales se retoma en "Tu local" (el backend sugería ir a la app, pero el guard lo devolvería igual).
- Si fallan el sector o algunas mesas, no hay reintento dentro del onboarding (se completan en Mesas/Sectores).
- El SKU de los productos rápidos es aleatorio; un SKU duplicado se muestra como error genérico.
- `CreateBusinessService` quedó sin uso (el onboarding usa `OnboardingApiService`).
- Los montos se formatean siempre en CLP (`formatCurrency`) aunque el negocio use otra moneda.
- Los errores de validación de Mi negocio se muestran genéricos; el skeleton de Mi negocio tiene la forma del diseño anterior.
- Primeros pasos: si la consulta falla, toda la tarjeta queda "sin verificar"; `teamMembers` cuenta también usuarios desactivados; "Ocultar" es por navegador.

## Caja y turnos (MVP 1)

- [ ] E2E del prompt del backend (10 pasos): abrir con fondo, cobros, retiro, anulación, cierre ciego con faltante, dos cajas (`CASH_REGISTER_AMBIGUOUS`), devolución con la caja cerrada y apagar el módulo con cajas abiertas.
- [ ] Revisar la impresión del reporte Z (solo rollo de 80 mm; sin A4 ni PDF) y la vista en celular y modo oscuro.
- Fuera del POS (detalle del pedido) no se conoce la caja del equipo: un cobro con tarjeta o transferencia no envía `cashRegisterId` y el backend lo asigna a la única caja abierta del local.
- Con tarjeta o transferencia, el POS solo envía la caja si sabe que está abierta (el backend exige turno a cualquier medio si se envía una caja cerrada, #43).
- En modo terminal (`/terminal`), "Ver turno" sale del shell de la terminal; falta decidir si la terminal muestra caja.
- El indicador de caja se refresca al volver a la ventana, tras cobros, aperturas y cierres; no es en tiempo real.
- El panel del turno muestra los últimos 8 movimientos; el detalle completo está en "Ver turno".
- Al anular un pago sin `registerId` en el error, el modal de apertura lista las cajas activas de todos los locales.
- Sin exportar el historial de turnos (CSV).
- Permisos (quién abre, cierra y hace movimientos): pendiente de la etapa de permisos. Hoy el detalle en vivo solo lo ve el dueño (`business.ownerId`), no otros administradores (#43).

## Gastos y cuentas por pagar (flujo de caja, fase 2)

- [ ] E2E del prompt del backend (10 pasos): categorías, gasto con factura y proveedor a 30 días, gasto pagado ahora en efectivo, pago parcial y exceso, compra con IVA y pago en efectivo, anulaciones, cierre de caja con egresos y recurrentes mensual (día 31) y semanal.
- [ ] Plan de pruebas: pestaña "cajas-fase2".
- Pausar o editar un gasto recurrente cuya categoría está desactivada falla: el backend exige el registro completo y revalida la categoría (#44).
- Pagos de una compra: si se entra directo a una compra ya pagada, la cabecera queda genérica ("Compra #id"); falta un detalle de compra en finanzas (#44).
- El detalle de compra en inventario busca el documento en hasta 5 páginas: compras muy antiguas pueden no mostrar su estado de pago (#32).
- Proveedores: se cargan los primeros 100, sin búsqueda; no hay pantalla para editar un proveedor (el servicio `update` existe).
- Al editar un gasto, vaciar el vencimiento mantiene el actual (no se puede "recalcular con las condiciones del proveedor").
- El IVA sugerido de una compra asume que todas las líneas llevan IVA.
- Un adjunto subido sin guardar el gasto queda huérfano en `expense_documents`.
- La URL del adjunto es temporal: el detalle pide una nueva si pasaron más de 4 minutos.
- Cuentas por pagar no tiene paginación (el backend devuelve todo); "Esta semana" = hoy + 7 días.
- Los toasts no llevan enlace: "Cuentas por pagar" se menciona en el texto.

## Propinas y comisiones (flujo de caja, fase 3)

- [ ] E2E del prompt del backend (7 pasos): pendientes por mesero, vista previa individual/partes iguales/puntos, liquidar en efectivo con y sin caja, `NO_TIPS_TO_PAY`, `TIP_ALREADY_PAID_OUT`, anular liquidación, transferencia, y comisiones débito/crédito con sus abonos.
- [ ] Plan de pruebas: pestaña "cajas-fase3".
- Con caja activa y varios locales, pagar propinas en efectivo exige elegir un local, y eso filtra las propinas a ese local (el backend usa el mismo `locationId` para ambas cosas, #45).
- El buscador de participantes trae los primeros 20 resultados por nombre.
- Si la configuración del negocio carga después de elegir un modo, el modo vuelve al del negocio; al recargar el detalle recién creado reaparece el aviso "Imprimir".
- `TIP_ALREADY_PAID_OUT` con enlace a la liquidación solo en el modal de anular pago de Pagos; en otras pantallas el mensaje sale sin número.
- Comisiones y abonos son estimados: no consideran feriados, no se guardan por pago (cambiar una comisión reescribe el historial) y no hay conciliación con la cartola (#45).
- Plata por llegar: sin exportar a CSV ni detalle de los pagos de cada fecha de abono.

## Centro de ayuda y asistente con IA

- Implementado (#46 resuelto): Centro de ayuda (`/help`, artículo `/help/:slug` con "¿Te sirvió?"), botón "?" en el navbar con panel lateral (artículos de la pantalla + asistente con streaming, fuentes, 👍/👎 y cuota restante) y administración para `SUPERADMIN` (`/help/admin`: artículos con filtros, orden, publicar, duplicar y votos; editor con vista previa; categorías; revisión del asistente; uso y costos). Falta probarlo E2E contra el backend.
- En AWS la respuesta del asistente llega completa al final (API Gateway + Lambda acumula): evaluar Lambda response streaming o un endpoint fuera de API Gateway si se quiere ver el texto en vivo.
- Mejoras posibles: buscador de íconos en el modal de categoría; pasar lo buscado como pregunta al abrir el asistente desde un buscador sin resultados; focus-trap completo en el panel; el gráfico de uso importa el tema de gráficos desde el módulo dashboard (mover a `src/ui`).
- Contenido: 35 artículos listos en `docs/help-center/articles/` (y `articles.json`): cargarlos con la migración del backend o el CRUD, y revisarlos con el equipo antes de publicar.
- Huecos de interfaz detectados al redactarlos: corregidos (menú "Mi negocio" y "Turnos de caja", opciones del POS aplicadas, "Producción" en el kardex, textos de datos fiscales y de sucursal). Revisados y correctos tal como están: la columna "Dirección" de Sucursales (el backend guarda la dirección en `landmark`), la lista fija de medios de pago en el cobro (Medios de pago solo configura comisiones) y Food cost / Consumo visibles sin recetas.
- Definir el límite mensual del asistente por plan (hoy 50 preguntas al mes por negocio, `HELP_CHAT_MONTHLY_LIMIT`). El rol administrador quedó como `SUPERADMIN`.

## Planes, suscripciones y cobros

- Fase 2 implementada (#47): entitlements desde whoami y `GET /billing/entitlements`; candados en el menú y modal "Disponible desde el plan X" (guard por ruta y errores `PLAN_*` desde cualquier API); banners de prueba, pago atrasado, Free y cancelación (solo dueño) y de usuario en solo lectura; uso y límites en Locales, Cajas y Usuarios (crear bloqueado al llegar al límite, recursos en solo lectura, activar/desactivar locales); POS sin exigir caja si el plan no incluye `cash`; locales bloqueados no venden; QR con candado sin `qr_menu`; asistente con candado sin `help_assistant` y sin contador si es ilimitado; página `/billing/plans` y sección Precios en la landing. Falta probarlo E2E contra el backend.
- Decidido: el SUPERADMIN no ve nada de planes (ni avisos, ni uso, ni candados), aunque sea dueño; se prueba con otro usuario dueño. Menú propio "Plan y facturación" (hoy solo Planes).
- Landing: la sección Precios espera el #48 (CORS con varios orígenes).
- Fase 3 implementada (panel del superadmin, menú Plataforma): Resumen, Negocios (filtros, detalle auditado con suscripción, uso, excepciones, historial y acciones: cambiar plan, extender prueba o período, estado, nota, descuento, excepciones), Planes (orden, datos, funciones, límites, precios con historial), Descuentos (cupones, restricciones, términos bloqueados si ya se usaron) y Ajustes (prueba, gracia, plan de respaldo, recordatorios, datos de transferencia). Falta probarlo E2E.
- Mejoras posibles de la fase 3: aviso de cambios sin guardar al cambiar de pestaña en el detalle del plan; nombres de negocios de un descuento exclusivo (falta un endpoint para buscarlos por id sin lectura auditada); el historial muestra priceId/discountId como número.
- Fase 4 implementada (pago manual): dueño con Mi suscripción (plan, próximo cobro, cobros pendientes con datos para transferir, "Ya transferí" con comprobante, cupón, historial, cancelar/reanudar) y elección de plan con resumen (compra, renovación, mejora con prorrateo o cambio programado); superadmin con Pagos por revisar (confirmar/rechazar, contador en el menú), Cobros (registrar pago, reversar, exportar CSV) y las mismas acciones en el detalle del negocio. Falta probarlo E2E.
- Mejoras de la fase 4: en el detalle del negocio lo pagado se calcula con los últimos 20 pagos (el backend no envía paidAmount ahí); el contador de pagos por revisar consulta cada 2 minutos aunque no estés en Plataforma.
- Fase 5 implementada (Flow): medio de pago en Mi suscripción (tarjeta marca •••• últimos 4, cambiar y quitar), elegir tarjeta o transferencia al cambiar de plan, vuelta desde Flow a /billing con mensajes, "Pagar con tarjeta" en cobros pendientes y "Activa tu prueba gratis" cuando la plataforma exige tarjeta. Falta probarlo con el sandbox de Flow.
- Fase 6 implementada (proceso diario): en Mi suscripción, mensajes para suscripción terminada ("Elegir un plan") y plan vencido ("Reactivar" con el mismo plan); en Plataforma → Resumen, botón "Ejecutar proceso diario" con su resultado. Los avisos se actualizan solos porque whoami (con entitlements) se refresca cada minuto con la pestaña activa. Falta probarlo.
- Configuración: el `.env` del backend debe tener `BILLING_FRONT_URL=http://localhost:4200` (estaba en 4300, la landing).
- Por confirmar con el backend: "Pagar con tarjeta" de un cobro de prorrateo usa el checkout del precio actual (como indica el prompt); falta un endpoint para cobrar una factura específica. Con el pago "en proceso" solo se vuelve a consultar una vez a los 60 s.
- Detalles menores: el candado no aparece en el tooltip del menú colapsado; los días de prueba del banner no se recalculan sin recargar; los banners también se ven en `/billing/plans`; las pantallas de caja muestran "módulo apagado" según el ajuste del negocio (sus rutas ya exigen la función `cash`); la URL de `billing` en AWS está por confirmar.
- Decisiones tomadas: prueba de 15 días en Pro (el superadmin activa o desactiva la exigencia de tarjeta), lo no incluido se muestra con candado ofreciendo subir de plan, pago manual + Flow, todos los pagos registrados y la tarjeta solo como marca y últimos 4 dígitos cifrados.
- Asumido (confirmar): al vencer el pago hay 7 días de gracia y después el negocio baja a Free sin perder datos; los recursos sobre el límite quedan en solo lectura.

## Acceso de soporte (#50)

- Implementado: el dueño autoriza a Redom desde Mi negocio → Soporte (1, 3, 7, 14 o 30 días, nota, extender, terminar, actividad e historial); el superadmin entra en modo soporte desde Plataforma → Negocios o Accesos de soporte (franja fija con Salir, menú y rutas solo de la carta, header `X-Support-Business-Id`, candados con el plan del negocio, sale solo al terminar o vencer). Falta probarlo E2E.
- Mejoras: filtro por negocio en Accesos de soporte; la actividad del dueño oculta `email_failed` en el front (páginas con menos filas); el superadmin no ve la actividad de un acceso (no hay endpoint de plataforma).

## Carta pública (etapas 1 a 7)

- Implementada: carta para clientes en la landing (`/carta/{negocio}`, `/carta/{negocio}/{local}`, `/carta/{QR de mesa}`), con código compartido en `src/app/modules/public-menu/carta`; administración en Configuración → Carta pública (URL, QR, publicar, datos, direcciones) y Agotados de hoy (con acceso desde el POS); etiquetas en productos y horario en categorías. Falta probarla contra la API real y en un deploy de Netlify.
- Vista previa en WhatsApp/Instagram: la carta se arma en el navegador, así que comparte la tarjeta genérica de la landing; para una por negocio hace falta una Edge Function de Netlify o SSR.
- Esperando al backend (#51): devolver etiquetas del producto y horario de la categoría para mostrarlos al editar.
- Mejoras: "Hasta mañana" usado después de medianoche agota hasta el día siguiente; el menú "Agotar" puede salirse de la pantalla en el celular; el QR del local no tiene vista previa (solo descarga).
- Etapa 2 implementada (marketing): en la carta, precio con promoción y anterior tachado, carrusel de banners, ventana de ofertas con frecuencia, "Los más pedidos", packs (informativo), colores y portada, analítica por lotes; en el backoffice, Configuración → Marketing de la carta (Promociones, Banners con orden y frecuencia de la ventana, Personalización con vista previa y contraste) y el tipo "Pack / combo" con su editor en el producto. Falta probarla en el navegador.
- Mejoras etapa 2: `GET /products/:id/pack` no trae el precio de referencia de las opciones; "Por defecto" en un grupo no se limita al máximo; al editar un banner con link a producto, el nombre sale de los primeros 100 productos; la tabla de productos no muestra un badge "Pack"; con fondo claro elegido y el dispositivo en modo oscuro, la insignia "Abierto" pierde un poco de contraste.
- Etapa 3 implementada (pedidos desde la mesa): en la carta con QR, agregar con cantidad, nota, opciones y elección del pack, carrito por mesa, envío con los errores del backend, "Tu pedido" con seguimiento y cancelación, "Mis pedidos"; para el personal, POS → Pedidos de clientes (pendientes con sonido y aviso, aceptar o rechazar con motivo, historial, contador en el menú) y la sección Pedidos del local en Carta pública; packs en el POS (selector de opciones, productos del pack en el detalle con su estado y "Servir"). Falta probarla de punta a punta.
- Mejoras etapa 3: "Mis pedidos" no se refresca solo; ante ORDERING_DISABLED no se recarga la carta; el sonido de pedidos nuevos solo suena con la pantalla de Pedidos de clientes abierta; el selector de locales de esa pantalla depende de que el rol pueda listar locales; el comprobante parcial impreso desde el cobro no lista los productos del pack; ver #52 (grupo opcional del pack sin opción).
- Etapa 4 implementada (servicio en la mesa, reservas y encuesta): en la carta, barra inferior "liquid glass" experimental (`CARTA_BOTTOM_BAR` en `carta/ui/carta-bottom-bar.ts`; en false vuelven los botones flotantes) con Pedir, Mesero, Cuenta (detalle y propina sugerida), Pedidos y Reservar; formulario de reserva en la zona horaria del local; encuesta con estrellas y link a Google. Para el personal: pestañas Solicitudes y Encuestas en Pedidos de clientes, interruptores de llamar al mesero y reservas, etiqueta "Desde la carta" en Reservas. Falta probarla de punta a punta.
- Mejoras etapa 4: "Ver venta de la mesa" lleva al listado de ventas filtrado (el POS no abre una mesa por URL); la encuesta del personal trae máximo 100 respuestas; ver #53 (reservas de la carta en el listado y su visibilidad).
- Etapa 5 implementada (retiro y delivery): en la carta sin QR, carrito online (localStorage), checkout con datos del cliente recordados, dirección con comuna o ubicación, zona con envío/mínimo/tiempo, hora lo antes posible o programada, método de pago y resumen; transferencia con datos bancarios para copiar y subida del comprobante; seguimiento en `/carta/pedido/{id}`. Para el personal: retiro y delivery, tiempo de preparación, métodos de pago, datos bancarios y zonas de reparto (comunas o radio, ordenables) en el local; tarjetas con canal, teléfono/WhatsApp, dirección, comprobante, Confirmar pago y avance Listo → En camino → Entregado en la pestaña En curso. Falta probarla de punta a punta.
- Mejoras etapa 5: no se pueden borrar los datos bancarios (solo editar); sin selector de mapa para las coordenadas; ver #54 (URLs públicas), #55 (zona y filtros) y #56 (comunas públicas y contexto del pedido).
- Etapa 6 implementada (API pública y widget): Configuración → API y widget con Llaves (publicables con orígenes o secretas, mostradas una sola vez, revocar), Webhooks (eventos, probar, rotar secreto, historial con payload y reenviar, ayuda con firma HMAC) y Widget (snippet iframe o script con vista previa; disponible sin plan porque usa la carta sin llave; llaves y webhooks exigen el plan Empresa). Carta con `?embed=1` (altura automática, enlaces en pestaña nueva, barra y diálogos visibles en el iframe) y `redom.cl/widget.js`. Falta probar el widget en una web real (en especial Safari de iOS).
- Mejoras etapa 6: el historial de webhooks muestra los últimos 50 sin paginar; al ir a una categoría dentro de una web con encabezado fijo, el scroll puede quedar tapado; ver #57 (códigos de error).
- Carta: botón "Aa" con modo Automático/Claro/Oscuro (mismo ajuste que la landing) y tamaño del texto (87,5 % a 137,5 %, se recuerda). En modo oscuro se ignoran el fondo y el texto personalizados del negocio (se mantiene su color principal). Falta probar en Safari de iOS.
- Etapa 7 implementada (idiomas y fidelización): carta con selector de idioma (🇪🇸 🇬🇧 🇧🇷 🇩🇪, se recuerda y viaja en `?lang=`) y todos sus textos fijos en es/en/pt/de; en el local, casillas de idiomas; Configuración → Idiomas de la carta con traducción a mano, borradores, publicar y traducción con IA. Fidelización (/loyalty): programa de puntos o sellos, recompensas, clientes con movimientos y ajuste manual; en el POS, canje desde la venta abierta y asignar o cambiar el cliente de una venta abierta. El seguimiento de retiro y delivery muestra el saldo del cliente.
- Mejoras etapa 7: revisar las traducciones de la interfaz de la carta con hablantes nativos (en/pt/de; las escribió la IA); el seguimiento abierto desde el correo no envía `lang`; los productos para sellos muestran "Producto #id" si están fuera de los primeros 100; la cuota de IA solo se conoce después de usarla (no hay GET); ver #58.
- Configuración: `environment.publicSiteUrl` del backoffice (redom.cl en develop y prod) debe apuntar a donde está publicada la landing de cada ambiente.

## Variedades de productos

- [ ] E2E: crear un producto con variedades, pasar uno de precio único a variedades (la primera conserva el id), quitar una y volver a precio único; venderlas en el POS y verlas en cocina.
- Quitar una variedad la desactiva y la deja sin precio (no hay endpoint para eliminarla): así se oculta de la carta pública, que no filtra `is_active` (#59). Volver a agregarla crea otra.
- No se pueden reordenar: se muestran en el orden de creación (el backend no tiene posición).
- Renombrar la primera variedad (o volver a precio único, que la renombra a `DUMMY`) cambia el nombre que muestran las ventas antiguas: el detalle de venta y cocina leen el nombre actual.
- Cada variedad tiene su propia receta y stock; el formulario solo lo avisa, no las configura.
- El backend no valida largo ni nombres repetidos de las variaciones: lo valida el front.

## Otros pendientes generales

- Configuración de despliegue en Netlify.
- Etapa de permisos (roles y permisos por negocio):
  - Falta la prueba E2E desde la UI (los 7 casos del prompt del backend). `enforcePermissions` está encendido en todos los ambientes (prod requiere ese backend desplegado).
  - El menú solo muestra pantallas sin permiso propio si están en `PUBLIC_ROUTES` (`/help`, `/profile`): los ítems de plantilla (Errors, Components, Collaboration, Folders) quedan solo para el SUPERADMIN.
  - Las constantes de `src/app/core/permissions` son copia de los enums del backend: al agregar un permiso allá, copiarlo aquí.
  - El mapa de pantalla a permiso (`permission-routes.ts`) tiene supuestos: Ingredientes → `products`, Terminal de salón → `orders`, `/finance/purchases` → `payables`.
  - "Usuarios y roles" y el selector de "Copiar permisos de" cargan hasta 100 roles.
  - Las pantallas Módulos y Permisos (plataforma) no se revisaron más allá de los códigos.
  - Un 403 `PERMISSION_DENIED` muestra un aviso propio; las pantallas que además muestran su error genérico no se ajustaron una por una (el aviso de permiso queda encima).
