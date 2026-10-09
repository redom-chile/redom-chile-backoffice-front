# Redom — Pendientes y mejoras del front

Lo que falta por hacer o mejorar, por área. Lo que depende del backend está detallado en `BACKEND-REQUESTS.md` (se cita por número).
Al cerrar un punto, bórralo de aquí; al agregar una fase, anota sus limitaciones.

Última actualización: 2026-10-07.

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
- Próxima fase (esperando al backend): fase 5, pago con tarjeta vía Flow.
- Próximas fases (esperando al backend): checkout (Flow y transferencia), "Mi suscripción", panel Plataforma del superadmin, y en Roles y permisos deshabilitar los módulos fuera del plan (cuando exista el mapa `module_codes`).
- Detalles menores: el candado no aparece en el tooltip del menú colapsado; los días de prueba del banner no se recalculan sin recargar; los banners también se ven en `/billing/plans`; las pantallas de caja muestran "módulo apagado" según el ajuste del negocio (sus rutas ya exigen la función `cash`); la URL de `billing` en AWS está por confirmar.
- Decisiones tomadas: prueba de 15 días en Pro (el superadmin activa o desactiva la exigencia de tarjeta), lo no incluido se muestra con candado ofreciendo subir de plan, pago manual + Flow, todos los pagos registrados y la tarjeta solo como marca y últimos 4 dígitos cifrados.
- Asumido (confirmar): al vencer el pago hay 7 días de gracia y después el negocio baja a Free sin perder datos; los recursos sobre el límite quedan en solo lectura.
- Por definir: precios de cada plan (mensual y anual) y qué incluye cada uno (hay un borrador en el prompt).
- Front por hacer cuando responda el backend: Mi negocio → Plan y facturación (comparar, checkout con Flow o transferencia, tarjeta, cupón, cobros, cancelar), banner de prueba o pago vencido, candados en el menú y en Roles y permisos, interceptor de errores `PLAN_*`, grupo Plataforma del superadmin (resumen, negocios, planes, descuentos, cobros, ajustes) y sección de precios en la landing.

## Otros pendientes generales

- Página pública de la carta `app.redom.cl/carta/:qrCode` (`GET /restaurant/api/menu/:qrCode`, ver #7).
- Configuración de despliegue en Netlify.
- Etapa de permisos: guards, constantes y botones (hoy `environment.enforcePermissions = false`).
- Limpiar del menú los ítems de la plantilla (Errors, Components, Download, Gift Card, Users). Falta confirmación.
- Solicitudes al backend con workaround: #15, #16, #28–#38, #41, #43–#45. Bloqueante: #39.
