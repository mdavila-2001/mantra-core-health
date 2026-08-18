# Reporte P7 · Grupos y foros

**PC:** PC-04 — Lenovo Legion · RTX · 16 GB DDR5
**Rama:** `pablo/p7-grupos-foros` (en los dos repos)
**Fecha:** 18/08/2026
**PR:** pendiente de abrir (ver «Handoff»)

## Base

| Repo | Base SHA | Qué es esa base |
|---|---|---|
| `mantra-core-health-api` | `ac6fcebe` | último commit de P1 |
| `mantra-core-health` | `e744b2f` | último commit de P1 |

**El carril NO parte de `origin/dev`, y es a propósito.** La tarea 5 —«te
aceptaron en el grupo» / «nuevo post»— consume el contrato de emisión de P1, que
todavía no está en `dev`. Ramificar de `dev` obligaba a escribir contra un
servicio que no existe. El orden de merge del README ya pone **P7 al final,
después de P1**, así que basarse en P1 no adelanta nada que el plan no dijera.

Antes de abrir el PR: `git fetch origin && git rebase origin/dev` una vez que P1
esté mergeado.

## Entregado

### API (`mantra-core-health-api`)

| Commit | Qué |
|---|---|
| `80adc39a` | dominio de grupos: ficha, muro, bajas, administración de membresías, temas |
| `fb91baa6` | enganche con la campana de P1 |
| `1dda6935` | arreglo: un profesional también resuelve su perfil público |
| `33a3cb55` | journey del carril contra la API viva |

### Front (`mantra-core-health`)

| Commit | Qué |
|---|---|
| `83380ce` | métodos aditivos de grupos en `community.client.ts` (aislado) |
| `cacfe92` | directorio de grupos y el grupo por dentro |
| `f348285` | sección `groups` y ruta `groups/:groupId` (hotspots, aislado) |
| `81b1d72` | `/community` en el proxy y en nginx |

## Endpoints / contratos verificados

Todos existentes antes del carril salvo donde se indica.

| Método | Ruta | Estado |
|---|---|---|
| `POST` | `/community/groups` | ya existía · **ahora nace con `tenant_id`, tema y la membresía de su dueño** |
| `POST` | `/community/groups/:groupId/members` | ya existía · ahora reabre una membresía terminada en vez de fallar |
| `GET` | `/community/groups` | ya existía · **filtros nuevos** `topicId` y `q` |
| `GET` | `/community/groups/:groupId/members` | ya existía · **filtro nuevo** `joinStatus` |
| `GET` | `/community/groups/:groupId` | **nuevo** — ficha con `viewer` |
| `DELETE` | `/community/groups/:groupId/members/:memberProfileId` | **nuevo** — salir / dar de baja |
| `PATCH` | `/community/groups/:groupId/members/:memberId` | **nuevo** — aprobar/rechazar alta, cambiar rol |
| `GET` | `/community/groups/:groupId/posts` | **nuevo** — muro con hilos |
| `POST` | `/community/groups/:groupId/posts` | **nuevo** — publicar y responder |
| `GET` | `/community/topics` | **nuevo** — árbol de temas |

## Las tres decisiones del carril

### 1. El muro son `comments`, no `social_posts`

`community.social_posts` **no tiene `group_id` ni `topic_id`** en el modelo. No
hay forma de decir «este post es de este grupo» sin agregar una columna, y el
carril no crea esquema. Es exactamente el bloqueo que la tabla del carril
anticipaba.

El muro se apoya en `community.comments`, que **sí** es polimórfica
(`commentable_type_concept_id` + `commentable_ref_id`) y acá apunta al grupo. Una
publicación es un comentario raíz del grupo; una respuesta es su hijo. Trae
gratis los hilos anidados, los contadores y la cola de reportes que P6 ya montó
sobre `comments`.

**Lo que se pierde hasta que exista la FK:** una publicación de grupo no lleva
media adjunta, ni encuesta, ni entra al ranking del feed general.

### 2. `viewer` viaja dentro de la ficha

`GET /community/groups/:id` devuelve si quien mira es integrante, si puede
publicar y si administra. La alternativa —deducirlo del padrón— exigía traerlo
entero antes de saber si siquiera se puede leer el muro, y hacía parpadear el
botón «unirme» delante de quien ya entró.

### 3. Público / privado / secreto se comportan distinto, y eso se prueba

- **Público:** lo lee cualquier sesión; publica sólo el integrante.
- **Privado:** ficha visible (es lo que permite pedir el ingreso), muro y padrón
  cerrados con 403.
- **Secreto:** para quien no es integrante **no existe** — 404 incluso en la
  ficha, porque un 403 ya confirmaría que ese grupo existe con ese id.

## Evidencia funcional real

`node tools/e2e/journey-p7-grupos.mjs` contra API y Postgres reales (instancia de
la rama en `:3010` sobre la base del stack local). Sin mocks.

```text
Journey P7 · grupos y foros · contra http://127.0.0.1:3010
  ✓ las dos personas inician sesión
  ✓ el actor A trae organización en su token
  ✓ cada persona tiene su propio perfil público
  ✓ A crea el grupo
  ✓ A queda dentro de su propio grupo
  ✓ A puede publicar en él
  ✓ el grupo nace con su organización
  ✓ B lo encuentra buscando en el directorio
  ✓ B se une al grupo
  ✓ en un grupo público la membresía queda activa
  ✓ el grupo cuenta dos integrantes
  ✓ A publica en el muro
  ✓ B ve la publicación en el muro
  ✓ B comenta colgado del hilo
  ✓ la respuesta viaja anidada bajo su publicación
  ✓ la respuesta no aparece además como publicación suelta
  ✓ B recibe la notificación de la publicación nueva
  ✓ la notificación es navegable: dice a qué recurso lleva
  ✓ A no recibe aviso de lo que él mismo publicó
  ✓ B puede dejar el grupo
  ✓ la baja descuenta al integrante

Journey P7 completo. Grupo: 0b7fcf96-0890-42bb-8eb6-e6a9ba099acd
```

**El journey encontró un defecto que ninguna prueba unitaria podía ver.** En la
primera corrida, A creaba el grupo y quedaba fuera de él. Causa:
`CommunityVisibilityService.resolveActorProfileId` buscaba la vitrina sólo por
`target_id = users.id`, pero `CommunitySocialService` la crea con
`target_id = practitionerProfileId` cuando quien la abre es un profesional. El
efecto era mucho más ancho que P7: **todo profesional leía la comunidad como una
sesión anónima** —sin sus reacciones, sin sus votos—. Arreglado en `1dda6935`.

## Tests ejecutados

```text
API   · yarn test (suite completa)           →  506 suites, 5278 tests
                                                5276 pasan · 1 salta · 1 falla (*)
API   · yarn test src/modules/community      →   24 suites, 202 tests, 0 fallos
API   · npx tsc --noEmit                     →  limpio
API   · npx eslint src/modules/community     →  limpio
API   · node tools/e2e/journey-p7-grupos.mjs →  21 comprobaciones, 0 fallos

FRONT · ng test (suite completa)             →  278 suites, 2661 tests, 0 fallos
FRONT · ng build                             →  bundle completo, sin errores
FRONT · npx tsc -p tsconfig.app.json         →  limpio
FRONT · npx eslint (grupos + community)      →  limpio
FRONT · node scripts/check-api-prefixes.mjs  →  37 prefijos, iguales en las 3 fuentes
```

(*) **La única falla es preexistente y ajena al carril:**
`modules/diagnostic_units/diagnostic_units.indexes.spec.ts` espera el índice
`uq_diagnostic_units_tenant_id_code` y encuentra dos índices separados. Ni ese
módulo ni ese spec están en el diff de P7. Queda anotado, no tocado.

**Nota sobre corridas en paralelo:** ejecutar las dos suites a la vez en esta
máquina produce fallos de tiempo que no se reproducen por separado (rate
limiter y Redis degradado bajo carga). Las cifras de arriba son de corridas
secuenciales, que es como hay que leerlas.

## Hotspots tocados

| Archivo | Por qué | Cómo |
|---|---|---|
| `community.client.ts` | los 10 métodos del carril | **commit aislado** (`83380ce`), sólo aditivo, sin refactor — respeta el acuerdo con P2 |
| `app.routes.ts` | la sección y la ficha | **commit aislado** (`f348285`) |
| `navigation.map.ts` | la sección `groups` | mismo commit aislado. **Hizo falta:** el invariante de `app.routes.spec` exige que toda pantalla cuelgue de una sección declarada, y `feed` dejó de estarlo desde el carril R2-1, así que colgar los grupos de `feed/…` dejaba dos pantallas huérfanas. Es una entrada mínima, sin `roles` |
| `community-visibility.service.ts` | el defecto del perfil profesional | **commit aislado** (`1dda6935`) |
| `proxy.conf*.json` · `deploy/nginx.conf` | `/community` no estaba proxeado | **commit aislado** (`81b1d72`) |

## Bloqueadores / decisiones

### Bloqueador para Marcelo (esquema) — abierto

**`community.social_posts` no tiene `group_id`.** Se pide la FK
`social_posts.group_id → community.groups(id)` (y, si se quiere el filtro por
tema sobre publicaciones, `topic_id`). Mientras no exista, el muro vive sobre
`comments`; el día que llegue, la migración del muro es de datos, no de
contrato: los endpoints ya tienen la forma correcta.

### Defecto de infraestructura encontrado y arreglado — cerrado

**`/community` no figuraba en ninguna de las tres declaraciones de prefijos.**
Toda llamada de la red social desde el navegador devolvía el `index.html` de
Angular en vez de JSON — el modo de falla exacto que `check-api-prefixes`
documenta, que funciona en la máquina de quien lo escribió y sale como «error
inesperado» sin que nadie sospeche del proxy. **Esto afectaba también a P2 y a
P4**, no sólo a P7.

### Regla de producto tomada por defecto

El carril la dejaba abierta: **quién puede crear grupos**. Hoy lo hace cualquier
sesión con perfil público. Marcado para producto; si se quiere «sólo
profesionales verificados», el punto de corte es `createGroup`.

### Nota operativa

Para correr el journey se levantó una instancia de la API de esta rama en el
puerto 3010 contra la base del stack local. Al detenerla se detuvo también el
stack `mantra-redesa`; **se volvió a levantar y quedó sano**
(`docker compose -p mantra-redesa start` + `docker start mantra-core-health-dev`).
El seed de arranque insertó las 8 filas de conceptos nuevos del carril, que es lo
que corresponde.

## Lo que NO hace este carril

- No toca el ranking ni el fan-out del feed.
- No toca moderación: los reportes sobre publicaciones de grupo entran por la
  misma cola de P6, porque son `comments`.
- No crea esquema.
- No implementa preferencias de notificación por categoría: eso es P9. Las dos
  categorías nuevas (`NOTIF_CAT_GRP_JOINED`, `NOTIF_CAT_GRP_POST`) existen
  justamente para que P9 pueda silenciarlas sin silenciar una receta.

## Handoff al integrador (PC-01)

1. **Mergear P1 primero.** P7 está basado en él.
2. Rebasear `pablo/p7-grupos-foros` sobre `origin/dev` en los dos repos y abrir
   los PRs. El orden del README pone P7 al final; el rebase debería ser limpio
   salvo en `community.client.ts` (P2) y `app.routes.ts`, y los dos cambios de
   P7 están en commits aislados, listos para rehacerse solos si hiciera falta.
3. **Llevar `81b1d72` cuanto antes**, incluso separado del resto: sin él la red
   social entera no funciona en el navegador, y eso también bloquea a P2 y P4.
4. `1dda6935` toca un servicio compartido de `community`. Vale la pena que P2 lo
   mire: le arregla el mismo problema.
5. El bloqueador de la FK `social_posts.group_id` va a Marcelo.
