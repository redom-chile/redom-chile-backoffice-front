# Prompt para el backend: Módulo legal global (términos, privacidad y consentimientos)

> Copiar todo lo que está debajo de la línea y entregarlo al agente o equipo del backend.
> Corresponde a la solicitud #77 de `BACKEND-REQUESTS.md` del front. Es la etapa 10.1 del plan, ampliada a **todo Redom**.
> Los códigos nuevos van en **camelCase**; los códigos de error, en MAYÚSCULAS como el resto.

---

# Contexto
Trabajas en el BACKEND de REDOM (SaaS para restaurantes; NestJS + TypeORM + PostgreSQL; apps `auth`, `restaurant` y
`billing`). Repo: `redom-chile-backend`.

Hoy **nadie acepta términos ni consentimientos**: ni el dueño al registrarse (`register-owner`, `google-authenticate`),
ni los usuarios que crea el negocio (`create-user`), ni el negocio al contratar un plan (`create-checkout`), ni quien
crea llaves de la API pública, ni el comensal en la carta (la etapa 10 guarda solo `consentVersion` y `consentAt` en
`public_customers`).

Objetivo: un **módulo legal único** para todo el proyecto, que cumpla la **Ley 21.719** (y la 19.628 mientras rige):
1. El **superadmin** gestiona documentos legales y sus versiones (texto y PDF).
2. **Todos los que correspondan aceptan** la versión vigente de lo que les aplica, en el momento que corresponde.
3. Cada aceptación queda **registrada de forma auditable**: quién, qué versión exacta (con huella), cuándo y desde dónde.
4. Cuando se publica una versión nueva, el sistema **detecta por correo** a quién le falta aceptarla, se lo pide al
   entrar y le avisa por correo.

# Quién acepta qué (audiencias)
| Audiencia | Cuándo | Documentos (código) | Obligatorio |
|---|---|---|---|
| **Dueño que se registra** | Al registrarse (correo o Google) | `platformTerms` (términos de uso de Redom), `privacyPolicy` | Sí |
| **Negocio** (lo acepta el dueño) | Al crear el negocio y al contratar o cambiar de plan | `subscriptionTerms` (condiciones del servicio y cobros), `dataProcessingAgreement` (acuerdo de tratamiento de datos: el negocio es responsable y Redom encargado) | Sí |
| **Usuarios del backoffice** (creados por el negocio) | En su primer ingreso y cuando cambie una versión sustancial | `platformTerms`, `privacyPolicy` | Sí |
| **Desarrolladores de la API pública** | Al crear la primera llave | `apiTerms` | Sí |
| **Comensal con perfil** (etapa 10) | Al verificar el código y cuando cambie una versión sustancial | `dinerTerms`, `privacyPolicy` (versión para comensales o la misma), `dinerDataConsent` | Sí |
| **Comensal** | Opcional, por negocio | `marketingConsent` (recibir novedades de ese negocio) | No |
| **Comensal sin perfil** (pedido online o reserva) | Al enviar | Aviso de privacidad (`privacyPolicy`): se **informa** (enlace) y se guarda la versión vigente en el pedido o reserva (`acknowledge`) | Informativo |
| **Negocio** (su propio texto) | Lo publica el negocio | `businessConsent` (consentimiento propio del local, etapa 10) | Según el negocio |

Las audiencias son configurables por documento; la tabla es el punto de partida.

# Parte A: Modelo de datos
```
legalDocuments            id, code (único por alcance), title, audience ('platformUser' | 'businessOwner' |
                          'apiClient' | 'diner'), scope ('platform' | 'business'), businessId (null en 'platform'),
                          isRequired boolean, createdAt, updatedAt

legalDocumentVersions     id, documentId, version (entero que sube), language ('es'|'en'|'pt'|'de'),
                          content (markdown o HTML sanitizado), fileId (PDF opcional), contentHash (sha256 del contenido
                          + del PDF), changeSummary, isMaterialChange boolean, status ('draft'|'published'|'retired'),
                          effectiveAt, publishedAt, publishedBy, createdAt
                          -- publicada = inmutable (no se edita: se crea otra versión)

consentRecords            id, documentId, documentVersionId, documentCode, contentHash (copia, para prueba),
                          action ('accept' | 'withdraw' | 'acknowledge'),
                          subjectType ('user' | 'publicCustomer' | 'business' | 'guest'), subjectId, email (minúsculas),
                          businessId, locationId, channel ('backoffice' | 'carta' | 'email' | 'api' | 'registration'),
                          ip, userAgent, createdAt
                          -- SOLO inserción: sin UPDATE ni DELETE (regla o trigger en la base)
```
- **Inmutabilidad:** una versión publicada no se puede editar ni borrar; `consentRecords` no se actualiza ni borra.
- **Anonimización** (derecho del titular): un proceso aparte reemplaza `email`, `ip` y `userAgent` por una huella, sin
  borrar el registro, y deja constancia.
- **Migración:** los perfiles de la etapa 10 (`consentVersion`, `consentAt`) pasan a `consentRecords` con la versión 1 de
  `dinerDataConsent`; después esas columnas quedan solo como caché o se eliminan.

# Parte B: Superadmin (Plataforma → Legal)
Permiso nuevo del módulo `LEGAL` (solo SUPERADMIN): `legal:see-module`, `legal:manage-documents`,
`legal:publish-documents`, `legal:see-audit`, `legal:export-audit`.

| Método | Ruta | Para |
|---|---|---|
| GET/POST | `/platform/legal/documents` | Listar y crear documentos |
| PATCH | `/platform/legal/documents/{id}` | Título, audiencia, obligatorio |
| GET/POST | `/platform/legal/documents/{id}/versions` | Listar versiones y crear un borrador |
| PATCH | `/platform/legal/versions/{id}` | Editar un **borrador** (contenido, idioma, PDF, resumen, sustancial, vigencia) |
| POST | `/platform/legal/versions/{id}/publish` | Publicar (ahora o en `effectiveAt`); calcula `contentHash` |
| POST | `/platform/legal/versions/{id}/retire` | Retirar una versión (no borra registros) |
| GET | `/platform/legal/stats?documentId=` | % de aceptación de la versión vigente, pendientes por audiencia |
| GET | `/platform/legal/audit?email=&documentCode=&from=&to=` | Historial por persona o documento |
| GET | `/platform/legal/audit/export?…&format=csv\|pdf` | Exportación con la huella de cada versión |
| POST | `/platform/legal/versions/{id}/notify` | Enviar el correo a quienes les falta aceptar (si es sustancial) |

- Al publicar una versión **sustancial** de un documento obligatorio, quien la tenga pendiente debe aceptarla en su
  próximo ingreso; con `notify` se le avisa por correo con el enlace. Las no sustanciales solo se informan.
- Los PDF se suben con el almacenamiento existente (carpeta nueva `legal_documents`, PDF hasta 10 MB).

# Parte C: Lectura pública de documentos
| Método | Ruta | Para |
|---|---|---|
| GET | `{PUBLIC}/legal/documents/{code}?lang=&businessSlug=` | La versión vigente (contenido, PDF, versión, fecha) para mostrar o enlazar |
| GET | `{PUBLIC}/legal/versions/{id}` | Una versión exacta (para "lo que aceptaste") |

# Parte D: Pendientes y aceptación
## Usuarios del backoffice (dueños y equipo)
- `GET /auth/whoami` agrega `legal: { pending: PendingDocument[] }` (documentos obligatorios de su audiencia, y del
  negocio actual si es dueño, cuya versión vigente no aceptó, o aceptó una anterior con un cambio sustancial después).
- `POST /legal/accept` `{ versionIds: number[] }` → registra `accept` (canal `backoffice`) y devuelve el `legal` actualizado.
- **Bloqueo:** con pendientes obligatorios, las rutas protegidas responden **428 `LEGAL_ACCEPTANCE_REQUIRED`** con
  `details.documents`, excepto `whoami`, `logout`, `refresh-token`, `/legal/*` y la lectura pública. El front muestra
  la aceptación y no deja seguir hasta aceptar.
- **Registro:** `register-owner` y el registro con Google reciben `acceptedVersionIds` (de `platformTerms` y
  `privacyPolicy` vigentes); sin ellos, 400 `LEGAL_ACCEPTANCE_REQUIRED`. Crear el negocio y contratar o cambiar de plan
  reciben los de `subscriptionTerms` y `dataProcessingAgreement`.
- Crear la primera llave de la API pública exige haber aceptado `apiTerms` (o recibir `acceptedVersionIds`).

## Comensales (carta)
- `POST {PUBLIC}/customers/verify` deja de aceptar solo `consent: true`: recibe `acceptedVersionIds` (de
  `dinerTerms`, `privacyPolicy` y `dinerDataConsent` vigentes, y opcional `marketingConsent` del negocio). Compatibilidad:
  si llega `consent: true`, registrar las vigentes en ese momento.
- `GET {PUBLIC}/customers/me` agrega `legal: { pending, accepted }` y `POST {PUBLIC}/customers/legal/accept`
  `{ versionIds }`, `POST {PUBLIC}/customers/legal/withdraw` `{ documentCode, businessSlug? }` (solo opcionales, p. ej.
  `marketingConsent`).
- Con pendientes obligatorios, `usual`, `loyalty` y los pedidos con `X-Redom-Customer` responden 428
  `LEGAL_ACCEPTANCE_REQUIRED` (la carta puede seguir mostrándose).
- Pedidos y reservas **sin perfil**: guardar la versión vigente de `privacyPolicy` mostrada (`privacyVersionId`) y un
  registro `acknowledge` con el correo o teléfono del pedido.

```ts
PendingDocument = { documentCode, title, versionId, version, isRequired, isMaterialChange, effectiveAt, url }
```

# Parte E: Detección por correo y avisos
- La identidad para "pendientes" es el **correo** (en minúsculas): un mismo correo que es dueño, usuario o comensal ve
  sus pendientes de cada audiencia.
- Job diario: al entrar en vigencia una versión sustancial, enviar el aviso por correo (plantilla `legal-update`) a
  quienes la tengan pendiente, una vez por versión, con el enlace para leer y aceptar.
- Al ingresar (backoffice) o verificar el código (carta), devolver los pendientes como arriba.

# Parte F: Ayuda
- Artículos: "Términos y privacidad en Redom" (para negocios) y "Tus datos como cliente" (para comensales).

# Contrato para el front (resumen)
Documentos, versiones, `PendingDocument`, `legal` en `whoami` y en `customers/me`, `POST /legal/accept`, endpoints de
plataforma, lectura pública; códigos `LEGAL_ACCEPTANCE_REQUIRED` (428 y 400), `LEGAL_VERSION_NOT_PUBLISHED`,
`LEGAL_VERSION_IMMUTABLE`, `LEGAL_DOCUMENT_INVALID` (`details.field`), `PLAN_FEATURE_NOT_INCLUDED` no aplica (es para todos).

# Verificación
1. Publicar `platformTerms` v1 y `privacyPolicy` v1 → registrar un dueño sin `acceptedVersionIds` → 400; con ellos → se
   crean dos `consentRecords` con `contentHash`.
2. Publicar `platformTerms` v2 **sustancial** → el siguiente `whoami` de cualquier usuario trae el pendiente; una ruta
   protegida responde 428 hasta aceptar; `notify` envía el correo una sola vez.
3. Versión publicada → intentar editarla → 400 `LEGAL_VERSION_IMMUTABLE`; `UPDATE` o `DELETE` directo en
   `consentRecords` → falla en la base.
4. Comensal verifica con `acceptedVersionIds` → registros con canal `carta`; retira `marketingConsent` → registro
   `withdraw`, sin borrar el anterior.
5. Auditoría: buscar por correo → historial completo; exportar CSV y PDF con las huellas.
6. Anonimizar un correo a pedido → los registros quedan con huella y sin datos personales.
