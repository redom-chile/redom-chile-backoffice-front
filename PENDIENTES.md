# Redom — Pendientes y mejoras del front

Lo que falta por hacer o mejorar, por área. Lo que depende del backend está detallado en `BACKEND-REQUESTS.md` (se cita por número).
Al cerrar un punto, bórralo de aquí; al agregar una fase, anota sus limitaciones.

Última actualización: 2026-10-07.

## Pruebas pendientes

- [x] Fase 1 · Inventario: E2E validada por negocio.
- [ ] Fase 2 · Modificadores: E2E desde la UI (plan de pruebas, pestaña "Fase 2 · Modificadores").
- [ ] Fase 3 · Recetas: E2E desde la UI (pestaña "Fase 3 · Recetas"). Requiere el backend con las rutas `/inventory/recipes`.
- [ ] Fase 4 · Costeo y control: E2E desde la UI (pestaña "Fase 4 · Costeo").
- [ ] Revisión visual en celular y modo oscuro de lo hecho en las fases 2, 3 y 4 (no se vio en navegador).
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

## Otros pendientes generales

- Página pública de la carta `app.redom.cl/carta/:qrCode` (`GET /restaurant/api/menu/:qrCode`, ver #7).
- Configuración de despliegue en Netlify.
- Etapa de permisos: guards, constantes y botones (hoy `environment.enforcePermissions = false`).
- Limpiar del menú los ítems de la plantilla (Errors, Components, Download, Gift Card, Users). Falta confirmación.
- Solicitudes al backend con workaround: #15, #16, #28–#37.
