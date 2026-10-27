# Plan: carta personalizada e innovadora (etapas 8 a 14)

Continuación de la carta pública (etapas 1 a 7, ya implementadas en el front). Ordena todas las ideas en etapas que se
pueden entregar por separado, cada una con su valor para el negocio, el alcance en front y backend, y sus dependencias.

Última actualización: 2026-10-22. Estado: **propuesta, sin implementar**.

## Principio: cada negocio decide (SaaS)

Redom es un SaaS: **el plan solo marca lo máximo que se puede usar** (función y límites). Dentro de eso, cada negocio
activa, desactiva y configura cada función según su realidad, desde el backoffice:

- **Apagado por defecto:** toda función nueva parte desactivada (salvo las de accesibilidad del cliente, que no cambian nada del negocio). Nada se activa solo al subir de plan.
- **Por local** cuando aplica (un local puede tener delivery y mesero virtual, y otro no).
- **Configurable:** cada función tiene sus opciones con valores por defecto razonables (tono, horarios, límites propios por debajo del plan, textos).
- **Con permiso:** quién configura cada función se controla con roles y permisos (por defecto, dueño y administrador).
- **Con vista previa y reversible:** ver el efecto en la carta antes de publicarlo y poder volver atrás.
- **Medible:** cada función muestra su uso y su resultado, para que el negocio decida si mantenerla.

Cada etapa tiene abajo su apartado **"Lo que configura el negocio"**.

## Resumen

| Etapa | Nombre | Para quién | Tamaño | Depende de | Plan sugerido |
|---|---|---|---|---|---|
| 8 | Diseño de la carta | Dueño | M | — | Ver "Planes" |
| 9 | Contenido con IA | Dueño | M | 8 (opcional) | Ver "Planes" |
| 10 | Cliente reconocido | Cliente | L | Fidelización (etapa 7) | Ver "Planes" |
| 10.1 | Consentimientos y documentos legales | Superadmin, cliente y negocio | L | 10 | Todos (obligatorio por ley) |
| 10.2 | Mensajería y panel de clientes (correo; WhatsApp después) | Negocio y cliente | L | 10, 10.1 | Ver "Planes" |
| 11 | Carta dinámica | Cliente y dueño | M | 8 | Ver "Planes" |
| 12 | Mesa compartida | Cliente | L | Pedidos en la mesa (etapa 3) | Ver "Planes" |
| 13 | Comunidad y juegos | Cliente y dueño | L | 10 | Ver "Planes" |
| 14 | Mesero virtual con IA | Cliente | XL | 9, 10, 11 | Ver "Planes" |

Tamaño: **S** ≈ 1 semana, **M** ≈ 2 a 3, **L** ≈ 4 a 5, **XL** ≈ 6 o más (front + backend, una persona por lado).

**Orden recomendado:** 8 → 9 → 10 → 10.1 → 10.2 → 11 → 12 → 13 → 14.
- La 8 es la más visible y casi todo es front: el backend solo amplía la personalización que ya existe (`theme`).
- La 9 reutiliza la IA que ya está (asistente de ayuda y traducciones), y mejora el contenido que usará la 14.
- La 10 crea la identidad del cliente, que necesitan "Lo de siempre", las reseñas, los juegos y el mesero virtual.
- La 14 es la más diferenciadora, pero rinde más cuando la carta ya tiene buen contenido (9), reglas de momento (11) y clientes reconocidos (10).

---

## Etapa 8 · Diseño de la carta

**Objetivo:** que cada carta se vea propia sin saber de diseño.

**Funciones**
1. **Plantillas:** Clásica (actual), Minimal, Revista (fotos grandes, una columna), Pizarra (estilo bistró, sin fotos) y Grilla (dos columnas de fotos).
2. **Tipografías:** 6 a 8 pares de títulos y texto (elegante, moderna, rústica, infantil, clásica), cargadas solo si se usan.
3. **Forma de las tarjetas** por categoría: lista con foto chica, foto grande, solo texto.
4. **Categorías con portada e ícono**, y **orden manual** de categorías y productos (arrastrar).
5. **Mensajes propios:** saludo, aviso destacado con fecha de término ("Hoy: música en vivo") y "Nuestra historia" al pie.
6. **Vista previa en vivo** tipo celular en el backoffice, con cambio claro/oscuro y tamaño de texto.
7. **Recomendaciones del chef:** una sección propia arriba de la carta (como "Los más pedidos") con los productos que elija el negocio, en su orden, con nombre propio ("Recomendación del chef", "Sugerencias de la casa", "Favoritos de María"), foto opcional del chef y días y horario en que se muestra.
8. **Nota del chef por producto:** un texto corto distinto de la descripción ("Lo recomiendo con el pebre de la casa"), destacado en el detalle del producto.
9. **Accesibilidad:** modo alto contraste y **lectura en voz alta** de un producto o categoría (Web Speech API, sin costo de servidor), sumado al modo oscuro y tamaño de texto ya hechos.

**Front:** plantillas como variantes de los componentes de la carta (CSS por plantilla + tokens), selector de fuentes con Google Fonts bajo demanda, editor en Carta online → Marketing → Personalización, vista previa en vivo con la carta real, `CartaDisplay` con alto contraste y voz.

**Backend:**
- Ampliar `theme` (JSON, hoy `primaryColor`, `backgroundColor`, `textColor`): `template`, `font`, `cardStyle`, `categoryCardStyle` (por categoría), `contrast`.
- Categorías: `imageFileId` (existe), `icon`, `position`; productos: `position` dentro de la categoría. Devolverlos en la carta pública.
- Mensajes: `announcement { text, endsAt }`, `story` por local (traducibles, etapa 7).
- Recomendaciones del chef por local: título, foto opcional, productos en orden, días y horario; `chefNote` por producto (traducibles).
- Orden manual de categorías y productos (#68, incluido en el prompt de la etapa 8).

**Riesgos:** mantener el rendimiento (fuentes y fotos grandes en celulares); probar cada plantilla en claro, oscuro y alto contraste.

**Métrica:** % de negocios que cambian la plantilla; tiempo en la carta y tasa de "Agregar".

**Lo que configura el negocio:** elegir la plantilla, la tipografía y la forma de las tarjetas por local (y por categoría); orden manual (arrastrar y soltar) o alfabético; activar o no las recomendaciones del chef, su título, productos, foto y horario, y la nota del chef de cada producto; activar o no el anuncio (texto, fechas) y la historia; si ofrece la lectura en voz alta y el alto contraste en su carta; vista previa antes de publicar y "volver al diseño anterior".

---

## Etapa 9 · Contenido con IA (para el dueño)

**Objetivo:** que el dueño tenga una carta atractiva en minutos.

**Funciones**
1. **Descripciones con IA:** desde el nombre, los ingredientes (recetas) y el estilo del local, propone 2 o 3 descripciones; el dueño elige y edita. También en lote ("completar las que faltan").
2. **Mejorar fotos (etapa 9b, después de medir el costo):** recorte y encuadre automático, luz y color, fondo limpio o difuminado. Siempre con antes/después y aprobación.
3. **Sugerencias de precio y promociones** con las ventas, el food cost y los días flojos: "este plato tiene margen bajo", "2x1 los martes", "sube $500 el más pedido".
4. **Etiquetas sugeridas** (vegano, sin gluten, picante) a partir de la receta, para revisar.

**Front:** botones "Sugerir con IA" en el producto y una pantalla "Mejorar mi carta" con tareas pendientes (sin descripción, sin foto, foto de baja calidad, margen bajo).

**Backend:**
- `POST /ai/menu/descriptions` (por producto o lote), `POST /ai/menu/photo` (procesa y devuelve un archivo nuevo, sin reemplazar el original), `GET /ai/menu/insights` (precios y promos).
- Cuota mensual por plan (como `ai_questions_month` y la traducción con IA) y registro de uso y costo en la Plataforma.

**Riesgos:** costo de la IA de imágenes; no inventar ingredientes ni alérgenos (la descripción no debe afirmar "sin gluten" si no está en la receta o la etiqueta).

**Métrica:** productos con descripción y foto antes/después; promociones creadas desde una sugerencia.

**Lo que configura el negocio:** activar o no la IA; el tono de las descripciones (cercano, formal, divertido) y el largo; si las sugerencias quedan como borrador (siempre se aprueban antes de publicar); qué mejoras de foto permite (recorte, luz, fondo); un límite mensual propio por debajo del plan; y si quiere recibir sugerencias de precios y promociones y con qué frecuencia.

---

## Etapa 10 · Cliente reconocido

**Objetivo:** que la carta "conozca" al cliente y facilite volver a pedir.

**Funciones**
1. **Identificación liviana** por teléfono con **código por WhatsApp o SMS** (sin contraseña). Sin código solo se usa lo guardado en el navegador.
2. **Preferencias que se recuerdan:** dieta y alérgenos, idioma, tamaño de texto y modo; en el navegador y, si se identifica, en su perfil (sirven en cualquier local Redom).
3. **"Lo de siempre":** sus últimos pedidos del local, repetir con un toque (revalidando precios y disponibilidad).
4. **Alérgenos explicados:** aviso claro al agregar un producto que choca con sus preferencias ("contiene maní").
5. **Su saldo de fidelización** visible en la carta (hoy solo en el seguimiento).

**Front:** hoja "Tu perfil" en la barra inferior, código de verificación, sección "Lo de siempre" arriba de la carta, avisos de alérgenos en el detalle y el carrito.

**Backend:**
- `POST /public/v1/customers/otp` y `/verify` → token de cliente (corto, por negocio o global).
- `GET/PUT /public/v1/customers/me/preferences`, `GET /public/v1/customers/me/orders?location=`.
- Envío de códigos (proveedor de WhatsApp/SMS) con límites por teléfono e IP.

**Perfil global:** el cliente tiene un solo perfil Redom (teléfono, preferencias, idioma) que sirve en todos los locales; cada negocio ve solo su historial y su fidelización con ese cliente.

**Riesgos y legal:** datos personales y de salud (alérgenos): consentimiento explícito, política de privacidad, poder borrar el perfil (Ley 19.628 y la nueva Ley 21.719 de protección de datos). Costo por mensaje de verificación.

**Métrica:** clientes identificados, recompra a 30 días, uso de "Lo de siempre".

**Lo que configura el negocio:** activar o no el perfil del cliente por local; si pide verificación por código o solo recuerda en el navegador; el canal preferido (WhatsApp o SMS); qué datos pide (teléfono, nombre, correo opcional); si muestra "Lo de siempre" y el saldo de fidelización; el texto de consentimiento y su política de privacidad.

---

## Etapa 10.1 · Consentimientos y documentos legales (próximo evolutivo; **alcance global de Redom**)

> Decidido 2026-10-25: el módulo legal es **de todo el proyecto**, no solo de la carta: dueños al registrarse, negocio al
> contratar un plan (términos del servicio y acuerdo de tratamiento de datos), usuarios del backoffice, desarrolladores de
> la API y comensales. Prompt del backend: `docs/backend-prompts/legal-consentimientos-global.md` (#77).

**Objetivo:** cumplir la Ley 21.719 (y la 19.628 mientras rige) con consentimientos **auditables**: qué documento exacto
aceptó cada persona, cuándo y desde dónde, y pedir de nuevo la aceptación cuando un documento cambia.

**Funciones**
1. **Módulo de superadmin (Plataforma → Legal):** crear y versionar documentos: términos y condiciones para comensales,
   política de privacidad de Redom, consentimiento de datos del perfil, consentimiento de comunicaciones (marketing) y,
   si se quiere, los términos para restaurantes y usuarios del backoffice.
   - Cada **versión** tiene texto (y/o archivo PDF), idioma, fecha de entrada en vigencia, si es **obligatoria** u
     opcional y si el cambio es **sustancial** (exige volver a aceptar). Una versión publicada **no se edita**: se crea otra.
   - Se guarda un **hash** del contenido de cada versión para probar qué texto exacto se aceptó.
   - Historial de versiones, vista previa y publicación programada.
2. **Registro de aceptaciones:** cada aceptación guarda la persona (correo o perfil), la versión exacta (id y hash), la
   fecha y hora, el canal (carta, backoffice, correo), el negocio y local si aplica, la IP y el navegador. También el
   **retiro** del consentimiento (por ejemplo, darse de baja de comunicaciones), sin borrar el historial.
3. **Detección de pendientes por correo:** al identificarse (código por correo) o al entrar al backoffice, el sistema
   revisa si a ese correo le falta aceptar la versión vigente de algún documento obligatorio y le pide aceptarla antes
   de seguir; los opcionales se ofrecen sin bloquear.
4. **Textos por negocio:** el consentimiento propio de cada local (etapa 10) pasa a ser una versión de documento del
   negocio, con el mismo registro.
5. **Auditoría:** buscar por correo y exportar (CSV o PDF) qué aceptó, qué retiró y cuándo; reporte por documento y
   versión; los registros no se pueden modificar ni borrar (salvo anonimizar a pedido del titular).
6. **Derechos del titular:** desde "Tu perfil", ver lo aceptado, descargar el documento y retirar los consentimientos
   opcionales; solicitud de acceso, rectificación y borrado con su registro.

**Lo que configura el negocio:** su texto de consentimiento y su política (como versiones), y si pide consentimiento de
comunicaciones; ve cuántos de sus clientes aceptaron recibir novedades (no el detalle de otros negocios).

**Backend (resumen):** `legalDocuments`, `legalDocumentVersions` (inmutables, con hash), `consentRecords` (aceptación y
retiro, solo inserción), endpoint de "pendientes por correo", exportación de auditoría; reemplaza `consentVersion` y
`consentAt` del perfil por estos registros.

**Riesgos:** definir con un abogado los textos y qué cambios son sustanciales; retención de los registros; no bloquear
la operación del restaurante si un documento falla al cargar.

---

## Etapa 10.2 · Mensajería y panel de clientes (después de 10.1)

**Objetivo:** usar la relación con el cliente para que vuelva, con su permiso.

**Funciones:** panel de clientes en el backoffice (frecuentes, nuevos, en riesgo, ticket promedio, última visita);
encuesta de atención por correo después de la visita; avisos de fidelización (puntos sumados, recompensa disponible,
puntos por vencer); campañas por correo solo a quien aceptó el consentimiento de comunicaciones (10.1), con "darse de
baja"; y más adelante WhatsApp (guía de Meta pendiente) para avisos urgentes del pedido y recordatorios de reservas.

**Lo que configura el negocio:** qué mensajes envía (cada uno con su interruptor y su texto), a qué segmentos y con
qué frecuencia; cupos por plan.

---

## Etapa 11 · Carta dinámica

**Objetivo:** mostrar lo correcto en el momento correcto.

**Funciones**
1. **Cartas por momento:** desayuno, almuerzo, once, happy hour, con horario propio (amplía el horario por categoría que ya existe) y cambio automático.
2. **Temporadas y fechas:** Fiestas Patrias, Navidad, verano; destacados y banners que se activan solos.
3. **Según el clima** (opcional): destacar sopas si llueve o bebidas frías con calor (API de clima sin costo, cacheada por local).
4. **Plato del día con cuenta regresiva:** "Quedan 5 porciones" o "Hasta las 15:00", conectado al stock o a un cupo manual.
5. **"Completa tu pedido":** sugerencias de bebida, postre o acompañamiento en el carrito; reglas manuales del dueño ("con hamburguesa, sugerir papas") y luego automáticas por ventas conjuntas.

**Front:** secciones de destacados según reglas, contador en vivo, sugerencias en el carrito y el checkout; en el backoffice, editor de momentos y reglas.

**Backend:**
- Entidades `menu_moments` (franja, categorías/productos) y `menu_rules` (condición: hora, fecha, clima; acción: destacar, ocultar, banner).
- `dailySpecial { productId, portions, endsAt }` con descuento de porciones al vender.
- `GET /public/v1/menus/.../suggestions?cart=` (reglas + ventas conjuntas).

**Métrica:** ticket promedio con sugerencias; ventas del plato del día.

**Lo que configura el negocio:** crear sus momentos (nombre, días, horario, qué categorías o productos muestra); temporadas con fechas; activar o no las reglas por clima; el plato del día (producto, porciones, hora de término, precio); las sugerencias "completa tu pedido": manuales, automáticas o ambas, y en qué productos no sugerir.

---

## Etapa 12 · Mesa compartida

**Objetivo:** pedir y pagar en grupo sin enredos.

**Funciones**
1. **Pedido grupal:** cada celular de la mesa (mismo QR) se une a un carrito compartido, ve lo que agregan los demás y uno envía todo (o cada uno envía lo suyo).
2. **Dividir la cuenta desde la carta:** por persona o por productos (ya existe en el POS), con propina sugerida.
3. **Pagar desde la carta** (opcional, depende del proveedor de pagos): cada uno paga su parte; el POS ve los pagos.

**Front:** sesión de mesa con nombres o avatares, carrito en vivo, pantalla "Dividir"; en el POS, quién pidió qué.

**Backend:**
- `table_sessions` y carrito compartido (`POST/GET /public/v1/tables/{qr}/cart`), actualización en vivo (WebSocket o SSE; polling corto como alternativa).
- Pagos online: integración con un proveedor (Flow, Mercado Pago o Transbank) por negocio, comisiones y conciliación con la caja.

**Riesgos:** concurrencia (dos personas editando), abuso del QR desde fuera del local, y el pago online (requiere cuenta del negocio con el proveedor).

**Métrica:** mesas con más de un dispositivo; tiempo desde "pedir la cuenta" hasta el pago.

**Lo que configura el negocio:** activar o no la mesa compartida por local; si cada uno envía lo suyo o una persona envía todo; los modos de dividir la cuenta que permite; la propina sugerida; activar o no el pago online, conectar su cuenta de Mercado Pago y qué medios acepta.

---

## Etapa 13 · Comunidad y juegos

**Objetivo:** que los clientes generen contenido y vuelvan.

**Funciones**
1. **Fotos y reseñas de clientes** después de la encuesta: foto del plato y comentario; el dueño aprueba y aparece en la carta.
2. **Juegos con premio:** ruleta o "rasca y gana" al pagar o al dejar una reseña; premios conectados a la fidelización (puntos, sellos, cupón). Cada negocio elige si exigen compra o no, con topes por cliente y bases tipo que entrega Redom.
3. **Desafíos:** "Prueba los 5 platos de la temporada" o "sello extra por probar algo nuevo".
4. **Compartir un plato:** enlace con foto, nombre y precio que se ve bien en WhatsApp e Instagram (vista previa generada en el servidor).
5. **Carta en video:** videos cortos verticales por producto, estilo historias.

**Front:** galería en el detalle del producto, moderación en el backoffice, ruleta animada, botón Compartir; videos con carga diferida.

**Backend:**
- `reviews` con foto (almacenamiento existente) y estados (pendiente, aprobada, rechazada), moderación automática previa con IA.
- `games` y `prizes` ligados a `loyalty` y a cupones, con probabilidades y topes por cliente.
- **Vista previa al compartir:** Netlify Edge Function o SSR para `/carta/...` que arme las etiquetas Open Graph por negocio y producto (pendiente desde la etapa 1).
- Videos: subida, compresión y límite de tamaño por plan.

**Riesgos:** contenido inapropiado (moderación), costo de video, reglas de sorteos (premios sin compra obligatoria si aplica la normativa).

**Métrica:** reseñas aprobadas por semana, enlaces compartidos, visitas desde enlaces compartidos.

**Lo que configura el negocio:** activar o no las reseñas con fotos y cómo se moderan (manual, o automática con revisión); activar o no los juegos, cuáles, los premios, si exigen compra, la probabilidad y los topes por cliente y por día; si permite compartir platos; activar o no los videos y en qué productos.

---

## Etapa 14 · Mesero virtual con IA

**Objetivo:** un asistente en la carta que recomienda y ayuda a pedir, en el idioma del cliente.

**Funciones**
1. Chat en la carta: "¿qué me recomiendas sin gluten y bajo $10.000?", "¿qué lleva el lomo?", "algo para compartir entre 4".
2. Responde **solo con productos reales** de la carta (precios, disponibilidad, horario, alérgenos de las etiquetas), en el idioma de la carta.
3. **Agrega al carrito** con confirmación del cliente; respeta opciones, variedades y packs.
4. Usa las preferencias del cliente (etapa 10) y las reglas del momento (etapa 11).
5. Para el dueño: tono del asistente, temas permitidos y reporte de preguntas frecuentes ("muchos preguntan por opciones veganas").

**Front:** botón flotante o pestaña "Pregúntame" en la barra inferior, mensajes con tarjetas de producto y botón Agregar, streaming de la respuesta.

**Backend:**
- `POST /public/v1/menus/{negocio}/{local}/assistant` con herramientas (buscar productos, ver detalle, agregar al carrito propuesto) sobre la carta pública; streaming.
- Cuota por plan y por cliente (límite por sesión e IP), registro de conversaciones anonimizadas para el reporte.
- Reutilizar la infraestructura del asistente de ayuda (modelo, streaming, costos en la Plataforma).

**Riesgos:** inventar productos o afirmar alérgenos no registrados (respuestas acotadas a datos de la carta y aviso "consulta al personal si tienes alergias"); costo por conversación; abuso (límites y captcha suave).

**Métrica:** conversaciones por día, % que termina en "Agregar", ticket promedio con asistente.

**Lo que configura el negocio:** activar o no el mesero virtual por local y en qué horario; su nombre, tono y mensaje de bienvenida; qué temas puede tratar (solo la carta, o también horarios, reservas y delivery); si puede agregar al carrito; un límite de conversaciones por cliente y un tope mensual propio por debajo del plan; revisar las preguntas frecuentes y marcar respuestas a mejorar.

---

## Transversal a todas las etapas

- **Planes:** nuevas funciones en `PLAN_FEATURES` (por ejemplo `menu_design`, `menuAiContent`, `customer_profiles`, `menu_dynamic`, `table_sessions`, `menu_community`, `menu_assistant`) con su candado y aviso de mejora, como las etapas anteriores.
- **Idiomas:** todo texto nuevo del dueño (mensajes, historia, momentos, premios) entra en las traducciones de la etapa 7; los textos fijos, en los diccionarios de la carta.
- **Analítica:** ampliar los eventos de la carta (vistas, agregar, sugerencias aceptadas, chat, compartidos) y mostrarlos en un panel "Rendimiento de la carta".
- **Rendimiento:** imágenes y videos con tamaños por dispositivo, carga diferida y presupuesto de peso por página.
- **Privacidad y seguridad:** consentimiento, borrado de datos, límites por IP y teléfono, moderación.
- **Costos de IA:** cuotas por plan, caché de respuestas repetidas, registro de uso en la Plataforma.

## Planes (decidido 2026-10-24)

Sigue la lógica de las etapas 1 a 7: Free = carta básica; Emprende = vender y verse bien; Pro = crecer con IA y clientes; Empresa = escala y diferenciación.

| Función | Free | Emprende | Pro | Empresa |
|---|---|---|---|---|
| Accesibilidad (alto contraste, lectura en voz alta) y avisos de alérgenos | ✅ | ✅ | ✅ | ✅ |
| Compartir un plato con vista previa | ✅ | ✅ | ✅ | ✅ |
| Orden manual de categorías y productos | ✅ | ✅ | ✅ | ✅ |
| Plantillas, tipografías, forma de tarjetas, íconos, anuncio, recomendaciones y nota del chef (`menu_design`) | Solo Clásica | ✅ | ✅ | ✅ |
| Colores propios, portada e historia del local (`menu_branding`, ya existe) | — | — | ✅ | ✅ |
| Cartas por momento y temporadas (`menu_dynamic`) | — | ✅ | ✅ | ✅ |
| Clima, plato del día con porciones y "completa tu pedido" automático | — | Reglas manuales | ✅ | ✅ |
| Cliente reconocido: preferencias y "Lo de siempre" (`customer_profiles`) | — | ✅ | ✅ | ✅ |
| Contenido con IA (`menuAiContent`): descripciones / fotos al mes | — | — | 100 / 20 | 500 / 100 |
| Sugerencias de precios y promociones | — | — | ✅ | ✅ |
| Mesa compartida y dividir la cuenta (`table_sessions`) | — | — | ✅ | ✅ |
| Pago online desde la carta | — | — | ✅ (comisión) | ✅ (comisión) |
| Reseñas con fotos y juegos con premio (`menu_community`) | — | — | ✅ | ✅ |
| Carta en video | — | — | 20 videos | 100 videos |
| Mesero virtual (`menu_assistant`): conversaciones al mes | — | — | 200 | 2.000 |

Los números son un punto de partida: se ajustan desde Plataforma → Planes (límites por plan) después de medir el uso y el costo real.

## Límites de archivos (decidido 2026-10-24)

| Qué | Free | Emprende | Pro | Empresa |
|---|---|---|---|---|
| Fotos por producto | 1 | 3 | 5 | 10 |
| Fotos de clientes aprobadas por mes | — | — | 200 | 1.000 |
| Tamaño de foto | 5 MB (se comprime a 1.600 px, WebP) | igual | igual | igual |
| Video por producto | — | — | 1 de hasta 15 s | 1 de hasta 30 s |
| Tamaño de video | — | — | 30 MB (se comprime a 720p) | 50 MB (720p) |

## Proveedores (recomendación)

- **Códigos de verificación (etapa 10), decidido 2026-10-24:** **por correo** (ya implementado en el backend con Resend). WhatsApp (API de WhatsApp Cloud de Meta) queda para una etapa de mensajería posterior, junto con avisos del pedido, recordatorios, encuestas, fidelización y campañas. Recomendación anterior: empezar con **Twilio Verify** (un solo servicio para WhatsApp y SMS, con límites y protección contra fraude ya incluidos). WhatsApp como canal principal (en Chile casi todos lo usan) y SMS como respaldo. Si el volumen crece, pasar WhatsApp directo a la **API de WhatsApp Business de Meta** para bajar el costo. Revisar la tarifa vigente por código antes de decidir el límite por plan.
- **Pago online desde la carta (etapa 12):** **Mercado Pago con conexión OAuth** por negocio. El restaurante conecta su propia cuenta con un clic (Redom no guarda sus claves), el dinero llega directo al restaurante y permite cobrar una comisión de plataforma. Flow sigue para las suscripciones de Redom; Transbank (Webpay) queda como segunda opción porque exige un código de comercio por restaurante.

## Decisiones tomadas (2026-10-22)

- **Perfil del cliente:** global de Redom. Sirve en todos los locales; cada negocio ve solo los pedidos y la fidelización que tiene con él.
- **Juegos con premio:** los configura cada negocio (con compra o sin compra). Redom entrega bases tipo para publicar y topes por cliente.
- **Planes y límites:** confirmados (2026-10-24), tablas de arriba. Proveedores: recomendación, por confirmar con sus tarifas.
- **Etapa 9 sin fotos con IA:** descripciones, etiquetas y sugerencias de precio y promociones; la mejora de fotos queda para una etapa 9b, después de medir el costo.

## Decisiones abiertas

- [ ] Comisión de Redom por pago online desde la carta (si cobra y cuánto).
- [ ] Confirmar las tarifas de Twilio/Meta y Mercado Pago antes de la etapa 10 y 12.

## Próximo paso

Etapa 8: prompt del backend listo en `docs/backend-prompts/carta-etapa-8-diseno.md` (incluye el orden manual, #68). En paralelo, el front de plantillas, tipografías y vista previa en vivo.
