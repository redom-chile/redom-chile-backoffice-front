# Prompt para el backend: Asignar mesero y encargado a una reserva

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Corresponde a la solicitud #71 de `BACKEND-REQUESTS.md` del front.

---

# Contexto
Trabajas en el BACKEND de REDOM (NestJS + TypeORM). Repo: `redom-chile-backend`.

`restaurant.bookings` tiene `waiter_id` y `correspondent_id`, y la visibilidad de reservas (#53) depende de ellos:
quien no tiene `bookings:get-all-bookings` ve sus reservas más las que no tienen responsable. Pero ningún endpoint
permite escribirlos: `PUT /bookings/{id}` (`update-booking`) solo acepta `bookingStatus`, `partySize`, `bookingStart`,
`bookingEnd`, `tableId` y `bookingNote`, y `POST /bookings` tampoco los recibe. Una reserva de la carta confirmada
queda sin responsable para siempre y la ve cualquiera con `bookings:see-module`.

# Qué hacer
1. `PUT /bookings/{id}` (parcial, como hoy) y `POST /bookings`: aceptar
   - `waiterId: string | null` (uuid del usuario; `null` quita el mesero);
   - `correspondentId: string | null` (encargado; `null` lo quita).
2. Validar que sean usuarios activos del negocio y con acceso al local de la reserva (400 `BOOKING_STAFF_INVALID` con
   `details.field`).
3. Devolver `waiterId`, `waiterName`, `correspondentId` y `correspondentName` en el listado, en las de hoy y en el detalle
   (el detalle ya trae los nombres).
4. Permiso: `bookings:update-booking` (y `bookings:create-booking` al crear).
5. Si existe un endpoint para listar el personal asignable (meseros del POS: `POST /pos/details` trae `waiters`), indicar
   en Swagger cuál debe usar el front; si no, un `GET /bookings/staff?locationId=` con `{ code, name, role }`.

# Contrato para el front
```ts
UpdateBookingDto = { ...lo que hay, waiterId?: string | null, correspondentId?: string | null }
Booking = { ...lo que hay, waiterId, waiterName, correspondentId, correspondentName }
```

# Verificación
1. Asignar un mesero a una reserva de la carta → ese mesero la ve; otro mesero sin `get-all-bookings` ya no la ve.
2. `waiterId: null` → la reserva vuelve a no tener responsable y la ven todos los que gestionan reservas.
3. Un uuid de otro negocio → 400 `BOOKING_STAFF_INVALID`.
