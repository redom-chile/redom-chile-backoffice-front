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
- El POS todavía no aplica las opciones de mesas, meseros y mesero obligatorio (`GET /pos/details`): solo se configuran.
- `businessGuard` manda al onboarding ("Tu local") al dueño que desactiva todos sus locales. Confirmar con producto.
- Con `BUSINESS_ALREADY_EXISTS` y 0 locales se retoma en "Tu local" (el backend sugería ir a la app, pero el guard lo devolvería igual).
- Si fallan el sector o algunas mesas, no hay reintento dentro del onboarding (se completan en Mesas/Sectores).
- El SKU de los productos rápidos es aleatorio; un SKU duplicado se muestra como error genérico.
- `CreateBusinessService` quedó sin uso (el onboarding usa `OnboardingApiService`).
- Los montos se formatean siempre en CLP (`formatCurrency`) aunque el negocio use otra moneda.
- Los errores de validación de Mi negocio se muestran genéricos; el skeleton de Mi negocio tiene la forma del diseño anterior.
- Primeros pasos: si la consulta falla, toda la tarjeta queda "sin verificar"; `teamMembers` cuenta también usuarios desactivados; "Ocultar" es por navegador.

## Otros pendientes generales

- Página pública de la carta `app.redom.cl/carta/:qrCode` (`GET /restaurant/api/menu/:qrCode`, ver #7).
- Configuración de despliegue en Netlify.
- Etapa de permisos: guards, constantes y botones (hoy `environment.enforcePermissions = false`).
- Limpiar del menú los ítems de la plantilla (Errors, Components, Download, Gift Card, Users). Falta confirmación.
- Solicitudes al backend con workaround: #15, #16, #28–#38, #41. Bloqueante: #39.
