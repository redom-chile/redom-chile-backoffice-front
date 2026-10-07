# Prompt para el backend: Pagos, dividir la cuenta y pagar por producto

> Copiar todo lo que está debajo de la línea y entregarlo al agente / equipo del backend.
> Corresponde a la solicitud #40 de `BACKEND-REQUESTS.md` del front.

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS). Repo: `redom-chile-backend`.
Lo relevante:
- `libs/restaurant/features/{create-payment,cancel-payment,find-transaction-payments,find-order-by-id}`
- `libs/restaurant/shared/src/lib/orders.service.ts` (líneas del pedido y modificadores: `parentSellLineId`)
- `libs/restaurant/shared/src/lib/sale-stock.service.ts` (descuento de stock con `on_payment`)

Errores con `errorPayload()` y código de negocio en `libs/common/utils/operators/src/lib/error-codes.ts`
(formato `{ statusCode, code, message, details }`).

# Objetivo
Permitir dividir la cuenta por producto:
- cada pago puede cubrir productos concretos, con sus cantidades;
- el pedido sabe qué está pagado y qué no;
- se puede mezclar con los pagos por monto que existen hoy.

# 1. Registrar un pago por productos: `POST /payments`
Agregar el campo opcional `lines`:
```json
{ "transactionId": 12, "method": "cash", "amountTendered": 20000, "tipAmount": 0,
  "lines": [ { "sellLineId": 45, "quantity": 1 }, { "sellLineId": 47, "quantity": 2 } ] }
```
- `sellLineId` es la línea del PRODUCTO, no la de un modificador. Sus modificadores la siguen en proporción.
- Monto de cada línea = `quantity` × (precio unitario del producto + Σ modificadores por unidad).
  El descuento del pedido se reparte en proporción al total de cada línea.
- Si viene `lines`, `amount` es opcional y lo calcula el backend. Si viene igual, se valida que coincida:
  400 `PAYMENT_AMOUNT_MISMATCH` con `details: { expected }`.
- `quantity` > 0. Admite decimales solo si la línea los tiene.
- `quantity` no puede superar lo pendiente de pagar de esa línea:
  400 `LINE_ALREADY_PAID` con `details: { sellLineId, pendingQuantity }`.
- Una línea de otro pedido o de un modificador:
  400 `INVALID_PAYMENT_LINE` con `details: { sellLineId }`.
- Sin `lines`, el pago funciona como hoy (por monto).
- Se pueden mezclar ambos tipos en un mismo pedido. Un pago por monto no se asigna a productos.
- Se mantiene todo lo demás:
  - propina;
  - vuelto (`amountTendered` solo en efectivo);
  - estado `partial` / `paid`;
  - descuento de stock con `on_payment` cuando el pedido queda pagado completo.
- Respuesta: la actual (`{ id, success, changeAmount, paymentStatus, remaining }`), más el `amount`
  calculado y `lines: [{ sellLineId, quantity, amount }]`.

# 2. Ver qué está pagado: `GET /orders/:id`
Agregar a cada elemento de `lines`:
- `paidQuantity`: cantidad ya cubierta por pagos por producto;
- `pendingQuantity`: `quantity − paidQuantity`;
- `pendingAmount`: lo que falta pagar de esa línea, con modificadores y descuento proporcional.

`remaining` sigue siendo el saldo del pedido completo. Puede ser menor que Σ `pendingAmount`
si hubo pagos por monto.

# 3. Historial: `GET /payments?transactionId=`
Cada pago trae `lines: [{ sellLineId, productName, quantity, amount }]`. Va vacío si el pago fue por monto.

# 4. Anular un pago: `PATCH /payments/:id/cancel`
Libera las cantidades que cubría ese pago, que vuelven a quedar pendientes.

# 5. A definir y documentar
- Qué pasa al agregar productos (`POST /orders/:id/lines`) a un pedido que ya tiene pagos por producto.
  Lo esperable es que lo nuevo quede pendiente.
- El redondeo del descuento proporcional en CLP (sin decimales): en qué línea queda la diferencia de $1.

# Entregables
1. Migración: tabla `payment_lines` (`payment_id`, `sell_line_id`, `quantity`, `amount`) o equivalente.
2. `POST /payments` con `lines`, el cálculo y las validaciones con códigos de negocio.
3. `GET /orders/:id` con `paidQuantity`, `pendingQuantity` y `pendingAmount` por línea.
4. `GET /payments` con las líneas de cada pago, y anulación que las libera.
5. Swagger actualizado.

# Prueba E2E
1. Crear un pedido con estas líneas:
   - línea A: 1 hamburguesa ($6.000) con Extra queso ($800);
   - línea B: 1 hamburguesa ($6.000) sin modificadores;
   - línea C: 2 Coca-Cola ($1.500 c/u).

   Total: $15.800.
2. Pagar por productos la línea A × 1 y la línea C × 1 → monto calculado $8.300. El pedido queda `partial`.
3. `GET /orders/:id`:
   - línea A con `paidQuantity` 1 y `pendingAmount` 0;
   - línea C con `paidQuantity` 1 y `pendingQuantity` 1;
   - `remaining` $7.500.
4. Intentar pagar la línea C × 2 → 400 `LINE_ALREADY_PAID` con `pendingQuantity: 1`.
5. Pagar por monto $7.500 → el pedido queda `paid`.
6. Anular el pago del paso 2 → las líneas A y C vuelven a pendientes y el pedido queda `partial`
   con `remaining` $8.300.
7. En otro pedido con descuento del 10 %, el monto calculado por productos aplica el 10 % en proporción.
