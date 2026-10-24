# Prompt para el backend: Las reservas de la carta no aparecen en el listado

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Corresponde a la solicitud #53 de `BACKEND-REQUESTS.md` del front (ahora bloqueante).

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS + TypeORM). Repo: `redom-chile-backend`.

Las reservas hechas desde la carta pública se guardan bien (`restaurant.bookings`, `source = 'public_menu'`,
`created_by = null`, `booking_status = 'waiting'`), pero **nadie las ve** en `GET /bookings`, ni siquiera el dueño.

Causa, en `libs/restaurant/features/find-all-bookings/src/lib/infrastructure/find-all-bookings-sql.service.ts`:
```ts
const hasAllBookingsPermission = principal.permissions.includes('crud_all_bookings');
if (!hasAllBookingsPermission) {
  queryBuilder.andWhere('(b.createdBy = :userCode OR b.correspondentId = :userCode OR b.waiterId = :userCode)', ...);
}
```
`crud_all_bookings` es un permiso del sistema antiguo: **no existe** en el enum actual (`RestaurantPermission.RESTAURANT.BOOKINGS`
tiene `see-module`, `get-all-bookings`, `create-booking`, `update-booking`, `delete-booking`). Por eso todos los usuarios
caen en el filtro "solo mis reservas", y una reserva con `created_by` null nunca aparece.

Ejemplo real en local: negocio 12 (Devom Chile), local 17, reservas 14 y 15 (`source = public_menu`) no aparecen en el
listado.

# Qué hacer
1. Reemplazar el chequeo de `crud_all_bookings` por la regla nueva:
   - Ven **todas** las reservas del negocio (o de sus locales permitidos): el dueño, el administrador y quien tenga
     `bookings:get-all-bookings`.
   - El resto (por ejemplo, un mesero con solo `bookings:see-module`): las suyas (`created_by`, `correspondent_id`,
     `waiter_id`) **más las que no tienen responsable** (`created_by IS NULL` y sin encargado ni mesero, como las de la
     carta), para que alguien las pueda atender.
2. Revisar `find-today-bookings` y `find-booking` con el mismo criterio (que una reserva de la carta se pueda abrir y
   confirmar).
3. Agregar al listado y al detalle `source: 'staff' | 'public_menu'` (la columna ya existe) y `createdBy` (o su
   nombre), para que el front muestre "Desde la carta" sin adivinar.
4. Si existen permisos de reservas en roles por defecto, asegurar que el rol **Administrador** y el **dueño** tengan
   `bookings:get-all-bookings`.

# Contrato para el front
```ts
Booking = { ...lo que hay, source: 'staff' | 'public_menu', createdBy: string | null }
```

# Verificación
1. Hacer una reserva desde la carta → el dueño la ve en `GET /bookings` del día con `source: 'public_menu'`.
2. Un mesero sin `bookings:get-all-bookings` ve sus reservas y las de la carta sin responsable, pero no las de otro
   mesero.
3. Asignar un mesero a la reserva de la carta → sigue visible para ese mesero y para el dueño.
