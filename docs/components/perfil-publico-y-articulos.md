# Perfil público y artículos médicos

Configurar la trayectoria profesional, la vitrina pública que ven terceros, y
publicar artículos médicos con sus comentarios.

---

## Por qué son tres pantallas y no una

**Configurar** (`/my-account/edit`), **Vitrina pública** (`/my-account/preview`)
y **Artículos** (`/my-account/articles`) editan tres cosas distintas del mismo
profesional, y cada una tiene su propio verbo:

| Pantalla | Qué edita | Verbo |
| --- | --- | --- |
| `practitioner-profile-edit` | Título, biografía, disponibilidad (`profiles`) | **Editar** — mismo registro, se corrige |
| `practitioner-profile-edit` (especialidades/matrículas) | Especialidades y matrículas (`profiles`) | **Agregar** — nunca se editan las ya cargadas |
| `public-profile-preview` | La vitrina pública (`community`) | **Crear o actualizar** (`PUT` idempotente) |
| `medical-articles` | Publicaciones etiquetadas como artículo (`community`) | **Publicar** |

Mezclarlas en un único formulario habría escondido esta distinción: una
especialidad verificada es un hecho comprobado contra una credencial, y
"corregirla" sin pasar de nuevo por la verificación vaciaría de sentido el
verbo "verificar". El perfil profesional (`profiles`) y la vitrina pública
(`community`) son además **dos módulos del backend con dueños distintos**, y
tratarlos como una sola pantalla habría acoplado dos dominios que hoy no se
conocen entre sí.

---

## Backend

### `profiles` — presentación del perfil profesional

```
PATCH /profiles/practitioners/me
  { professionalTitle?, professionalBio?, acceptsNewPatients?, telehealthAvailable? }
  → PractitionerProfileSummaryDto (igual forma que el GET)

POST /profiles/practitioners/:profileId/specialties       (ya existía, UC-05-06)
POST /profiles/practitioners/:profileId/jurisdiction-authorizations (ya existía, UC-05-04)
```

`PATCH` porque es una edición real de un registro existente. Campo por campo
contra `undefined` (no `??`): un `''` borra un texto, `false` declara
explícitamente "no toma pacientes nuevos" — y ninguno de los dos puede
confundirse con "no vino en el cuerpo". Sin `@Roles`: el sujeto lo resuelve el
servidor desde la sesión, así que lo único que se puede editar es lo propio.

Especialidades y matrículas usan los endpoints de alta que **ya existían**
(UC-05-04, UC-05-06) — no se agregó ninguna ruta nueva para ellas, sólo se
cablearon al cliente. No hay "editar" una ya cargada.

### `community` — la vitrina pública

```
GET /community/profiles/me   → OwnPublicProfileDto | null
PUT /community/profiles/me
  { tenantId, slug, displayName, headline?, biography?, acceptsReviews? }
  → OwnPublicProfileDto
```

`GET` devuelve `null` y no 404: no tener vitrina es el estado normal de
cualquiera que no publicó nada todavía, no un fallo. `PUT` es idempotente:
crea si no existía, actualiza si existía, y valida que el `slug` no esté en
uso por otro sujeto (`409` si lo está). El sujeto se resuelve así:

```
practitionerProfileId presente (claim `hpid`) → ese perfil profesional
si no                                          → la propia cuenta
```

Es la misma regla en los dos lados: `CommunitySocialService.sujetoDe()` en el
backend, `AuthService.practitionerProfileId()` implícito en el frontend (el
backend decide, el frontend no necesita saberlo — sólo llama `getOwnProfile`).

**Nada de esto autoriza nada nuevo**: el estado de verificación, los sellos y
el prestigio de la vitrina los sigue otorgando la plataforma; no son campos
editables de este contrato.

### Artículos médicos: no hay endpoint propio

**Decisión deliberada**: el backend no distingue un "artículo" de cualquier
otra publicación de `community`. Los dos son un `post`. Crear un tipo de
contenido nuevo —tabla, validaciones, endpoints— para algo que ya se expresa
con un `post` y un hashtag habría duplicado un módulo que ya funciona.

`articulo-medico` es la única diferencia, y la agrega
`CommunityClient.publishPost(profileId, datos, esArticulo: true)` en el
momento de publicar. El resto del contrato —cuerpo, comentarios, reacciones—
es exactamente el de cualquier publicación.

---

## Frontend

```
core/data-access/community/
  community.types.ts      tipos de vista: OwnPublicProfile, PublicPost, Comment...
  community.client.ts      CommunityClient — vitrina, posts, comentarios

core/data-access/profiles/
  profiles.client.ts        + updateOwnPractitionerProfile, addSpecialty,
                             addJurisdictionAuthorization

features/account/my-profile/
  practitioner-profile-edit/    título, bio, disponibilidad + agregar especialidad/matrícula
  public-profile-preview/       formulario + vista previa lado a lado
  medical-articles/             publicar + listar + comentarios
```

### La lista de publicaciones no trae hashtags

`GET /community/profiles/:id/posts` (el listado) no incluye hashtags —sólo
`GET /community/posts/:id` (el detalle) los trae—. Para armar "Mis artículos",
`medical-articles.ts` pide el detalle de cada publicación de la página propia
y filtra por el hashtag. Es un N+1 deliberado y acotado: es la propia
vitrina, una página de como mucho 50 publicaciones de una sola persona, no un
muro ajeno ni un listado sin límite. `CommunityClient.listProfilePosts` lo
documenta explícitamente para que nadie intente "optimizar" agregando un
filtro que el backend no ofrece.

### Los comentarios se piden al abrir, no al listar

Mostrar un contador de comentarios en cada tarjeta exigiría una lectura más
por artículo, encima de la que ya hace falta para saber si es un artículo. Se
pide el hilo completo sólo cuando alguien lo abre (`alternarComentarios`): el
costo cae sobre quien lo necesita, no sobre cada carga de la pantalla.

### La vista previa se calcula del formulario, no de lo guardado

En `public-profile-preview`, la tarjeta "Así te ven" es un `computed` sobre
las señales del formulario (`vistaPrevia`), no sobre la última respuesta
guardada. Escribir en el campo actualiza la vista previa al instante, antes
de que exista ningún `PUT`.

---

## Cómo verificar

```bash
# Backend
cd mantra-core-health-redesa-api
node --experimental-vm-modules node_modules/jest-cli/bin/jest.js src/modules/profiles src/modules/community
npx eslint src/modules/profiles src/modules/community

# Frontend
cd mantra-core-health
yarn ng test --watch=false --include='**/practitioner-profile-edit.spec.ts' \
  --include='**/public-profile-preview.spec.ts' --include='**/medical-articles.spec.ts' \
  --include='**/community.client.spec.ts' --include='**/profiles.client.spec.ts'
yarn lint && yarn typecheck && yarn ng build
```

---

## Limitaciones conocidas

- **Una especialidad o matrícula agregada por error no se puede borrar desde
  la interfaz.** Es la misma limitación que ya tenía el backend (no hay
  `DELETE` en esos endpoints) — este trabajo no la introduce, la hereda.
- **El slug no se puede reservar sin publicar nada más.** `PUT` exige
  `displayName`, así que crear "sólo la dirección" para reservarla no es un
  caso soportado; tampoco lo pidió nadie.
- **Sin paginación en "Mis artículos".** El límite es 50 publicaciones de la
  propia vitrina; una persona con más de 50 posts (no sólo artículos) no ve
  los artículos más viejos hasta que se agregue paginación al N+1 de
  detalles. Documentado, no implementado: el alcance pedido fue publicar,
  listar y comentar, no paginar un caso al borde.
