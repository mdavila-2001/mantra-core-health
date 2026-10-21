# Plan — Red social al estilo LinkedIn: eliminar el «Muro profesional» y cerrar el flujo completo

- Fecha: 2026-10-21 · Repos afectados: `mantra-core-health` (front, rama de trabajo sobre `origin/mockup`), `mantra-core-health-api` (una extensión aditiva de contrato) · Predecesor: pedido del 13/09/2026 (`playwright/red-social-linkedin.mjs`, «red social al estilo LinkedIn (/posts)»), brechas AG-23/AG-24 (`docs/brechas-front-back-2026-09-24/anexos/C-agenda-social-directorios-operacion.md`).
- Resultado observable: una persona con sesión abre «Red social» y recorre **un solo flujo** —Inicio · Mi red · Chats · Notificaciones · Yo— igual que en LinkedIn: ve un feed de a quién sigue, publica (texto + imágenes + visibilidad) desde un modal, reacciona con uno de cinco tipos, comenta y responde **en el mismo hilo**, guarda, comparte y sigue/deja de seguir a profesionales. La pantalla `/feed` («Muro profesional») **deja de existir** y ningún enlace, aviso ni prueba la nombra.
- Kill-test: abrir `/feed?post=<id>` con sesión y que aparezca el «Muro profesional» de la captura del 21/10 (con «Perfil 64902038» y «Todavía no se pueden adjuntar imágenes»). Si aparece, el trabajo no está hecho. Segundo kill-test: tocar «Responder» en un comentario de `/posts` y salir de la pantalla.

> Estado de este documento: **plan** (fase 2 del ciclo). No hay una línea de código escrita todavía. Peldaño de evidencia: `DISCOVERED` (todo lo citado abajo tiene ruta y línea en `origin/mockup`, salvo donde dice `master`).

---

## 0 · Dos cosas que hay que decidir antes de la primera microtarea

| ID | Decisión | Lo que encontré | Lo que propongo | Quién confirma |
|---|---|---|---|---|
| **D-01** | **Sobre qué rama se trabaja.** | La demo que mostraste es la rama `mockup` (el panel «Rama mockup: sin backend» sale de `src/app/core/mock/mock-banner.ts`). Mi rama `claude-marcelo/hopeful-ride-7z2qps` nació de `origin/master` (`7cc6337e`), que está 1 088 commits detrás de `mockup` y **no tiene** `/posts` con sesión, ni `public-post-card` con acciones, ni el redactor de comentarios con adjuntos. `docs/refactor-profesional/trabajo/ESTADO.md` indica partir de `origin/mockup`. | Reiniciar la rama de trabajo desde `origin/mockup` (`git checkout -B claude-marcelo/hopeful-ride-7z2qps origin/mockup`) y abrir el PR contra `mockup`. Implementar esto sobre `master` sería rehacer trabajo que ya existe. | Marcelo |
| **D-02** | **Qué dijo el chat anterior.** | No tengo ese chat. Lo que recuperé del repo: (a) el script del 13/09 fija *izquierda: «Doctores en tendencia» + banners; centro: crear + feed; derecha: perfil mini sólo con sesión*; (b) «el hilo usa la pantalla como en LinkedIn» (`public-post-comments.html:1-5`); (c) textos de usted. | Tomar «copiar LinkedIn tal cual» como manda: **izquierda = perfil mini + accesos, derecha = sugerencias/tendencias + banners** (es el orden de LinkedIn y el inverso del 13/09). Si en el chat anterior se decidió otra cosa, pegámelo y ajusto §H3 antes de tocar código. | Marcelo |

Ambigüedades menores registradas en §9. Ninguna bloquea el arranque de H0–H2.

---

## 1 · Qué hay hoy (hechos, con ruta) — por qué «está de más»

### 1.1 Hay dos muros y uno sobra

| | `/feed` «Muro profesional» (la captura) | `/posts` «Red social de AloVida» |
|---|---|---|
| Ruta | `src/app/app.routes.ts:1695-1698`, dentro de `ShellLayout` (menú lateral de la app). Sin entrada de menú desde el carril R2-1 (`navigation.map.ts:207-236`). | `src/app/app.routes.ts:1497-1510`, dentro de `AlovidaPublicShell` (header público). Es a donde lleva el ícono «Red social» del header de la app (`shell-layout.html:419-424` → `routerLink="/posts"`). |
| Componente | `src/app/features/feed/feed.{ts,html,css}` (293 + 137 líneas) + `post-card/`, `composer/`, `report-post/`. | `src/app/features/alovida/buscar/feed-publicaciones/` + `feed-crear-publicacion/`, `feed-tendencias/`, `feed-banner/`, `feed-perfil-mini/`; tarjeta `features/public-profile/public-post-card/`. |
| Datos | `CommunityClient.listFeed` → `GET /community/feed` (feed personal por seguimientos; `community.client.ts:560`). Los ítems traen sólo `authorPublicProfileId` (`community.types.ts:230-249`): por eso la tarjeta imprime **«Perfil 64902038»** (`post-card.html:3`, `:98`, `:117`). | `PublicDirectoryClient.feedPublico` → `GET /public/posts` (todo lo público, sin personalizar; `public-directory.client.ts:124`). Trae `authorDisplayName`, `authorHeadline`, `authorAvatarUrl`, `authorSlug`, `mediaUrls` (`public-directory.types.ts:146-169`). |
| Autor | ID crudo. | Avatar + nombre + titular, enlazados a `/p/:slug`. |
| Reacciones | Dos botones de texto («Me sirve», «Me hizo pensar»; `post-card.ts:39-40`). | «Recomendar» = un solo tipo (`public-post-card.ts:126-138`), contador que abre modal de quién reaccionó (`public-post-reactions`). |
| Comentarios | Hilo plano con «Perfil xxxx». | Hilo con redactor propio, adjuntos (`comment-media-picker`), paginación «Ver más», respuestas anidadas (`public-post-comments.html`). **Pero «Responder» manda a `/feed?post=…`** (`public-post-comments.ts:254`) y `feed.ts` no lee `?post` (grep vacío). |
| Imágenes | «Agregar imágenes» apagado + «Todavía no se pueden adjuntar imágenes» (`composer.html`, punto de extensión P5). | La tarjeta ya pinta carrusel de `mediaUrls` y artículos con imágenes (`app-article-body`), pero **crear** sigue usando el mismo `app-composer` sin medios (`feed-crear-publicacion.ts:8`). El atajo «Foto» abre el redactor sin foto. |
| Laterales | Izq: nombre + «Accesos» (Grupos, Mensajes, Directorios, Mi cuenta). Der: «Tendencias clínicas» = grupos con más miembros (no hay endpoint de tendencias, AG-24). | Izq: «Doctores en tendencia esta semana» (muestra de `searchPractitioners` ordenada por reseñas, `feed-tendencias.ts:35-90`) + banners. Der: perfil mini con portada, avatar, nombre, ciudad, y accesos «Mi muro (→ /feed)», «Editar mi vitrina», «Mi panel». |
| Pruebas | `playwright/carril-p3-p6-humo.spec.ts:123` (`irA(page,'/feed')`), `feed.spec.ts` (368 líneas), specs de `post-card`/`composer`/`report-post`. | `playwright/red-social-linkedin.mjs` (22 verificaciones), `carril-01-publicaciones-publicas.spec.ts` (AC-01-1…18), `p3-muro-social.spec.ts`. |

Conclusión: `/posts` ya es el 60 % del LinkedIn pedido; `/feed` es una versión anterior que quedó alcanzable por enlace directo y a la que siguen apuntando **cuatro** lugares (§H1).

### 1.2 Quién todavía apunta a `/feed` (lo que hay que redirigir)

1. `src/app/app.routes.ts:74` (cargador `feed:` en el mapa de secciones) y `:1695-1698` (la ruta).
2. `src/app/core/notifications/notifications.store.ts:326` — todo aviso social (`fuente: 'community'`) lleva a `/feed` «porque el muro no tiene pantalla de publicación suelta». Hoy sí la hay: `/p/:slug/post/:postId` (`app.routes.ts` bloque `:slug/post/:postId`, componente `public-post-detail`).
3. `feed-perfil-mini.html:62` — enlace «Mi muro».
4. `public-post-comments.ts:254` — «Responder» con sesión.
5. `playwright/carril-p3-p6-humo.spec.ts:123`.
6. Comentarios que lo documentan: `navigation.map.ts:236`, `app.routes.ts:1686`, `feed-publicaciones.ts:127`.
7. Documentos: `docs/reports/generated/route-inventory.md` (fila `/feed`), `docs/integrations/backend-api.md`.

### 1.3 Lo que la API ya ofrece y el front no usa (AG-23, verificado hoy)

`mantra-core-health-api/src/modules/community/controllers/`:

| Capacidad LinkedIn | Endpoint real | Cliente front | Consumidor en `features/` |
|---|---|---|---|
| Seguir / dejar de seguir | `POST/DELETE /community/follows`, `GET /community/follows?followerProfileId=` (`community-social.controller.ts:348-360`) | `follow` (`community.client.ts:408`), `unfollow` (`:426`), `listFollows` (`:505`) | **ninguno** (los botones «Seguir» de `alovida/buscar/perfil-*-detalle.html` son maquetas `aria-disabled`) |
| Feed personal | `GET /community/feed` (fan-out por seguimientos, `community-feed.controller.ts`) | `listFeed` (`:560`) | sólo `features/feed/feed.ts` (el que se elimina) |
| Cinco reacciones | `PUT /community/reactions` (upsert) · `GET posts/:id/reactions` | `react` (`:327`); `REACTION_TYPES = LIKE, LOVE, INSIGHTFUL, CELEBRATE, SUPPORT` (`community.types.ts:1080`) | la tarjeta pública sólo manda `LIKE` |
| Guardar | `POST/DELETE/GET /community/bookmarks` | `bookmark` (`:441`), `unbookmark` (`:454`), `listBookmarks` (`:522`) | sólo la tarjeta del muro viejo |
| Imágenes en la publicación | `POST /community/profiles/:id/posts` con `media[]` (`NewPost.media`, `community.types.ts:292-298`); `GET /public/media/:id` | `createPost` | nadie llena `media` |
| Detalle de publicación | `GET /community/posts/:id`, comentarios y reacciones | `readPost` (`:282`) | `public-post-detail` |
| Notificaciones sociales | `GET /community/notifications` | `listNotifications` (`:577`) | `notifications.store.ts` (destino roto, §1.2) |
| Chat | `community/conversations/*` | `createConversation` (`:1139`) … | `features/messaging/*`, «Enviar mensaje» en la ficha (`public-profile-card.html:140-143`) |
| Encuestas | `POST posts/:id/polls`, `POST polls/:id/votes` | `readPoll` (`:1263`); **no hay** `createPoll`/`vote` | ninguno |

**Lo que la API no tiene** (y por lo tanto el plan no inventa): repost/«Recomendar con comentario», conteo de seguidores de un perfil, sugerencias «a quién seguir», tendencias por hashtag (AG-24), «ocultar este tipo de publicaciones» (P-01-3). Para cada uno §H5/§H6 dice qué se hace en su lugar.

### 1.4 Datos simulados (lo que la demo va a mostrar)

`src/app/core/mock/handlers/community.handlers.ts` ya simula `follows` (líneas 431-445), `feed` por seguidos (`:479-481`), reacciones, comentarios, notificaciones, conversaciones. Seguimientos sembrados: la médica sigue a 5 vitrinas (`:59`); la paciente sigue a la médica y a otra (`:60-61`). Fixtures en `core/mock/fixtures/comunidad.ts` (`VITRINAS`, `publicaciones`, `comentarios`, `grupos`, `conversaciones`).

### 1.5 Piezas reutilizables (se usan antes de crear nada — `CLAUDE.md` «primitivas existentes»)

`shared/components`: `avatar`, `avatar-group`, `badge`, `button`, `chip`, `tooltip`, `menu`, `tabs`, `card`, `dialog`, `content-dialog`, `empty-state`, `skeleton`, `segmented-control`, `comment-media-picker`, `file-preview-image`, `attachment-uploader`, `post-preferences-menu` (7 entradas: `openPost`, `openProfile`, `copyLink`, `share`, `hideSimilar`, `report`, `contactPractitioner`), `article-body`, `view-state-host` (`ViewState<T>`, ADR-0005), `public-nav-rail`, `notification-bell`, `page-header`.

---

## 2 · El mapa LinkedIn → AloVida (lo que se va a construir)

| LinkedIn | AloVida (destino) | Estado hoy |
|---|---|---|
| Barra superior: Inicio · Mi red · Mensajes · Notificaciones · Yo | Barra social del shell público con sesión: **Inicio** `/posts` · **Mi red** `/network` · **Chats** `/messaging` · **Notificaciones** `/notification-center` · **Yo** `/p/:miSlug` | Sólo «Volver a mi panel / Entrar / Crear cuenta» (`alovida-public-shell.html:58-63`). `/network` no existe. |
| Inicio: izq. tarjeta de perfil (portada, avatar, nombre, titular, «Vistas del perfil», «Impresiones», accesos a Guardados y Grupos) | `feed-perfil-mini` + stats de `GET /community/profiles/me/stats` + «Guardados» + «Grupos» | Existe el mini (sin stats, sin guardados, con «Mi muro» roto). |
| Inicio: centro «Crear publicación» (avatar + pastilla) con atajos Foto · Artículo | Igual; la pastilla abre un **modal** de redacción | La pastilla despliega el redactor en línea, sin fotos. |
| Modal de creación: avatar + nombre + selector de visibilidad arriba, textarea grande, barra de adjuntos, botón «Publicar» | `app-content-dialog` + `app-composer` extendido con `media[]` | `app-composer` sin medios; visibilidad existe. |
| Inicio: feed de a quién seguís, con «Recientes» | `GET /community/feed` con sesión; descubrimiento (`GET /public/posts`) cuando el feed está vacío | Con sesión sigue mostrando el feed público (no personalizado). |
| Inicio: der. «Agregar a tu feed» (sugerencias con botón Seguir) + noticias | «Profesionales para seguir» (misma muestra de tendencias, con **Seguir**) + banners | Tendencias sin botón; en la izquierda. |
| Tarjeta: avatar · nombre · titular · «hace 2 h · 🌐» · **+ Seguir** · «…» | `public-post-card` + botón Seguir cuando no se sigue al autor | Sin Seguir; tiempo absoluto. |
| Tarjeta: resumen «👍❤️💡 24 · 3 comentarios» | Iconos de los tipos presentes en `reactions.tallies` + total | Sólo número. |
| Tarjeta: Recomendar (con selector de 5 reacciones al mantener/hover) · Comentar · Compartir · Enviar | **Recomendar** (selector con LIKE/LOVE/INSIGHTFUL/CELEBRATE/SUPPORT) · **Comentar** · **Compartir** (copiar enlace, enviar por chat) · **Guardar** | Recomendar = LIKE fijo; Guardar sólo en el muro viejo. |
| Hilo: redactor arriba, comentarios con avatar, «Responder» abre redactor anidado | Igual, todo en línea | «Responder» sale a `/feed`. |
| Mi red: «Personas que sigues», invitaciones, sugerencias | `/network`: pestañas **Siguiendo** (GET follows) · **Sugerencias** · **Grupos** (enlace) | No existe. |
| Perfil: botón Seguir / Mensaje, «Actividad» con publicaciones | `public-profile-card`: **Seguir** + «Enviar mensaje» (existe) + pestaña «Publicaciones» (existe) | Sin Seguir. |
| Notificación «X reaccionó a tu publicación» → abre la publicación | Aviso social → `/p/:slug/post/:postId` | Lleva a `/feed`. |
| Guardados | `/my-account/saved` (lista de `GET /community/bookmarks`) | No existe. |

Lo que **no** se copia porque no hay backend y no se simula como si lo hubiera: repost, «Enviar» a varias personas con mensaje, conteo de seguidores, «Premium», empleos, eventos. Se registran en §9 con su endpoint faltante.

---

## 3 · Alcance

- **IN:** todo lo de la tabla §2 marcado como destino; eliminación de `features/feed/feed.*` y `features/feed/post-card/*`; reubicación de `composer/` y `report-post/`; redirección `/feed` → `/posts`; extensión aditiva del contrato de la API (autor resumido en el ítem de publicación) con su simulación; mock handlers; pruebas unitarias, Playwright y evidencia visual; documentación de rutas.
- **OUT:** grupos médicos (CV-26), moderación/apelaciones (BR-27 §AG-18), encuestas (sin `createPoll`/`vote` en el cliente — se deja el atajo oculto, §9), tendencias por hashtag (AG-24, API), «ocultar tipo de publicación» (P-01-3), app móvil (`mantra_core_health_mobile` no tiene pantallas sociales: `find lib -iname "*feed*|*post*|*social*"` vacío), rediseño de `/messaging` y `/groups` (sólo se enlazan), cambios en `master`.
- **Ambigüedades:** §9.

---

## 4 · Orden de ejecución y dependencias

```
H0 base y evidencia «antes»
 └─ H1 eliminar /feed (sin romper nada)       ← no depende de API
     └─ H2 contrato de autor (API + tipos + mock) ← desbloquea H3/H5
         ├─ H3 Inicio /posts personalizado y en 3 columnas LinkedIn
         ├─ H4 modal «Crear publicación» con imágenes
         ├─ H5 tarjeta LinkedIn (seguir, 5 reacciones, hilo en línea, compartir, guardar)
         └─ H6 Mi red + Seguir en ficha/tarjeta/sugerencias + Guardados
              └─ H7 notificaciones y chats conectados
                  └─ H8 barra social del shell público
                      └─ H9 cierre: gates, Playwright, barrido visual, revisión independiente, PR
                          └─ H10 rediseño estético e integral (franjas S0→S5, pedido del 21/10)
```

Regla `NO_BIG_BANG_REWRITE`: cada hito termina compilando, con sus pruebas en verde y con la app usable. Un hito no abre hasta que el anterior esté en `HECHO` o en `A MEDIAS` con su motivo. `NO_SELF_APPROVAL`: H9 lo revisan `visual-reviewer`, `frontend-reviewer` y `regression-auditor`, no quien implementó.

Gates por microtarea (DoD mínimo, siempre): `yarn lint` 0 · `yarn typecheck` 0 · `yarn test <spec tocado>` verde · para plantillas, además arranque con `yarn start` y la ruta abierta en navegador (regla 3 de `CLAUDE.md`: `tsc` no revisa plantillas).

---

## H0 — Base de rama y evidencia «antes»

**CA:** Dado D-01 confirmada, cuando se abre la rama de trabajo, entonces nace de `origin/mockup`, instala, arranca y hay capturas del estado actual de `/feed` y `/posts` para comparar al final.
**DoD:** `git log -1 --oneline` muestra un commit de `mockup` como base · `corepack yarn install --immutable` 0 · `yarn start --port <libre>` sirve · 5 capturas en `evidencia/antes/`.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando → salida esperada) | Estado |
|---|---|---|---|---|
| H0.S1.M1 | Reiniciar la rama desde `origin/mockup` (si D-01 = sí) | `git merge-base --is-ancestor origin/mockup HEAD` → 0 | `git fetch origin mockup && git checkout -B claude-marcelo/hopeful-ride-7z2qps origin/mockup` → rama en `5318f35d` o posterior | HECHO |
| H0.S1.M2 | Instalar y verificar gates base | lint/typecheck/test corren igual que en `ESTADO.md` (9 fallos preexistentes conocidos) | `corepack yarn install --immutable && yarn lint && yarn typecheck` → 0 · `yarn test` → sólo los fallos preexistentes listados | HECHO |
| H0.S1.M3 | Evidencia «antes»: `/feed`, `/feed?post=<id>`, `/posts` con y sin sesión, `/p/<slug>` | 5 PNG en 1440 + 1 en 390 | `node playwright/red-social-linkedin.mjs http://localhost:<p> evidencia/antes` → 22 ✔ (línea base) | TODO — no se capturó el «antes»; la base sigue en el worktree de `origin/mockup` y queda para H10.S0.M3 |

---

## H1 — Eliminar el «Muro profesional» sin dejar un enlace roto

**CA:** Dado cualquier enlace, aviso o prueba que hoy lleva a `/feed`, cuando se abre, entonces termina en el lugar equivalente del flujo LinkedIn (`/posts`, el detalle de la publicación o el hilo en línea) y `features/feed/feed.*` y `features/feed/post-card/*` ya no existen.
**DoD:** `git grep -n "'/feed'\|\"/feed\"\|features/feed/feed\|features/feed/post-card" src playwright` → vacío (salvo el redirect) · `yarn test` sin specs borrados en rojo · `yarn build` 0 · navegador: `/feed` y `/feed?post=X` aterrizan en `/posts` (y, con `post`, en `/p/:slug/post/X`).
**Estado:** TODO

### H1.S1 — Reubicar lo que `/posts` todavía necesita del muro viejo

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Mover `features/feed/composer/` a `features/social/composer/` (carpeta nueva `features/social/` para lo que es del flujo social y no del buscador público) y actualizar el import en `feed-crear-publicacion.ts:8` | `git grep "feed/composer"` vacío | `yarn typecheck` 0 · `yarn test src/app/features/social/composer` verde | HECHO |
| H1.S1.M2 | Mover `features/feed/report-post/` a `features/social/report-post/` y actualizar `feed-publicaciones.ts:14` | `git grep "feed/report-post"` vacío | `yarn typecheck` 0 · spec de `report-post` verde | HECHO |
| H1.S1.M3 | Mover la lógica reutilizable de `post-card.ts` que no esté en la tarjeta pública (toggle de guardado `bookmark/unbookmark` y comentario con adjunto) a servicios de `features/social/` **antes** de borrar la tarjeta | `features/social/bookmark.service.ts` (o nombre coherente con el repo) con spec | `yarn test src/app/features/social` verde | HECHO — `core/social/bookmark.store.ts` |

### H1.S2 — Redirigir y borrar

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Reemplazar la ruta `feed` (`app.routes.ts:1695-1698`) por `{ path: 'feed', redirectTo: '/posts' }` y quitar el cargador `feed:` de `:74` | `/feed` → `/posts` | `app.routes.spec.ts` (fila `'feed'` en `:96`) actualizada a redirect y verde | HECHO — desvío: `feedHeredadoGuard` en vez de `redirectTo` |
| H1.S2.M2 | Guard/`redirectTo` funcional: `/feed?post=<id>` → `/p/:slug/post/<id>` (resolviendo el slug con `readPost` + `readProfile`) y si falla → `/posts` | Con `post` válido aterriza en el detalle | spec nuevo `feed-redirect.spec.ts` con los dos casos verde | HECHO — `enlaces-sociales.guard.ts` + spec |
| H1.S2.M3 | Borrar `features/feed/feed.{ts,html,css,spec.ts}` y `features/feed/post-card/*` | carpeta `features/feed/` ya no existe | `ls src/app/features/feed` → no existe · `yarn build` 0 | HECHO |
| H1.S2.M4 | `notifications.store.ts:326`: aviso social → `/p/:slug/post/:postId` cuando `sourceTypeConceptId` es publicación o comentario (comentario → la publicación con `#comentario-<id>`), con el slug resuelto en el store | Un aviso «comentaron tu publicación» abre la publicación | `notifications.store.spec.ts` caso nuevo verde | HECHO — desvío: `/posts/:id?actor=` resuelto por `publicacionPorIdGuard` |
| H1.S2.M5 | `feed-perfil-mini.html:62`: «Mi muro» → «Mi actividad» (`/p/:miSlug`, pestaña Publicaciones) | el enlace abre la ficha propia | spec de `feed-perfil-mini` verde | HECHO |
| H1.S2.M6 | `public-post-comments.ts:254`: «Responder» abre el redactor **en línea** bajo el comentario con `parentCommentId` (el redactor ya existe en el mismo componente, `comment-composer`) | Respondo sin cambiar de URL y la respuesta aparece bajo el comentario | spec `public-post-comments.spec.ts` caso «responder en línea» verde · navegador: UI → `POST /community/comments` con `parentCommentId` → respuesta → recarga → UI | HECHO |
| H1.S2.M7 | `playwright/carril-p3-p6-humo.spec.ts:123`: el humo del muro pasa a `/posts` (mismas dos ramas: redactor visible o puerta «Cree su vitrina») | spec verde contra `ng serve` | `yarn pw carril-p3-p6-humo` → passed | A MEDIAS — spec adaptado a `/posts` y al modal; no se corrió `yarn pw` (necesita la API real) |
| H1.S2.M8 | Comentarios y docs: `navigation.map.ts:207-236`, `app.routes.ts:1686`, `feed-publicaciones.ts:127`, `docs/reports/generated/route-inventory.md`, `docs/integrations/backend-api.md` | ningún texto dice que el muro «sigue en pie» | `git grep -n "Muro profesional" src docs` → sólo historial | HECHO |

---

## H2 — Contrato: la publicación trae a su autor (API + tipos + mock)

Motivo: el feed personal (`GET /community/feed`) devuelve `PostListItem` sin nombre ni avatar del autor. Sin esto, cualquier tarjeta LinkedIn sobre el feed personal vuelve a imprimir «Perfil 64902038» o dispara una lectura por autor (N+1).

**CA:** Dado un ítem de `GET /community/feed` o de `GET /community/profiles/:id/posts`, cuando llega al front, entonces trae `author: { profileId, slug, displayName, headline, avatarUrl, kind }` y la tarjeta lo pinta sin pedir nada más.
**DoD:** int-spec de la API verde · `community.types.ts` tipa `author` · mock handlers lo devuelven · contrato generado (`core/mock/contract/api-contract.generated.ts`) regenerado con el script del repo, no a mano.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | API: `PostListItemDto` (`src/modules/community/dto/read-social.dto.ts`) + `author: PostAuthorSummaryDto` (campo **nuevo y opcional** → compatible hacia atrás, regla 96.4). Resolver en el servicio de lectura con un `IN (...)` por página, no por ítem | `GET /community/feed` devuelve `items[].post.author` | `npm test -- community-feed` + int-spec nuevo `community-feed-author.int-spec.ts` verde · OpenAPI actualizado en el mismo PR | TODO — no se hizo; la API no trae `author` (ver M4) |
| H2.S1.M2 | API: lo mismo en `GET /community/profiles/:id/posts` y `GET /community/posts/:id` | idem | int-spec existente ampliado verde | TODO |
| H2.S1.M3 | Front: `community.types.ts` (`PostListItem.author?`), `community.client.ts` (mapeo del wire), `community.handlers.ts` (devolver `author` desde `vitrinaDe(authorProfileId)`) | tipos y mock alineados | `yarn test src/app/core/data-access/community src/app/core/mock/handlers` verde | TODO |
| H2.S1.M4 | Front, respaldo mientras la API no esté desplegada: `ProfileSummaryStore` con caché por id que resuelve `author` ausente vía `readProfile` **una vez por autor y por sesión** (nunca por tarjeta) | con `author` ausente, la tarjeta igual muestra nombre y avatar | spec con 3 posts del mismo autor → 1 `GET /community/profiles/:id` | HECHO — `ProfileSummaryStore` + `cola-acotada` |

Decisión registrada (regla 00 §1.4): se extiende el DTO existente en vez de crear un endpoint «feed enriquecido» paralelo.

---

## H3 — Inicio (`/posts`) al estilo LinkedIn

**CA:** Dado un profesional con sesión y vitrina, cuando abre `/posts`, entonces ve tres columnas (izq: su perfil mini con stats y accesos; centro: «Crear publicación» + el feed de a quién sigue; der: «Profesionales para seguir» + banners); sin sesión ve dos columnas (centro + derecha) con el feed público; con sesión y sin seguir a nadie ve el feed de descubrimiento con un aviso que lo dice.
**DoD:** `playwright/red-social-linkedin.mjs` actualizado al nuevo orden → todos ✔ · sin scroll horizontal en 390/768/1024/1440/1920 · claro y oscuro · consola sin errores.
**Estado:** TODO

### H3.S1 — Columnas en el orden de LinkedIn (D-02)

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | `feed-publicaciones.html/.css`: izquierda = `feed-perfil-mini` (con sesión) · derecha = `feed-tendencias` + `feed-banner`; sin sesión la izquierda no se reserva (clase `red--sin-perfil`, regla §5 de `composition-rules.md`: nunca una columna vacía) | medidas: izq < centro > der en 1440; una columna en 390 (orden DOM: centro, izq, der) | script `.mjs` → «tres columnas izquierda < centro < derecha» ✔ y «sin sesión el feed es más ancho» ✔ | HECHO |
| H3.S1.M2 | `feed-perfil-mini`: agregar «Vistas de su perfil (7 días)» y «Apariciones en búsquedas» desde `GET /community/profiles/me/stats` (cliente: método nuevo `readOwnStats`), y accesos **Guardados** (`/my-account/saved`, H6) · **Grupos** (`/groups`) · **Editar mi vitrina** | los dos números y los tres accesos | spec del mini + `community.client.spec.ts` (`readOwnStats`) verde | HECHO — accesos: Mi actividad · Mi red · Guardados · Editar · Mi panel |
| H3.S1.M3 | `feed-tendencias` → «Profesionales para seguir»: cada fila con botón **Seguir / Siguiendo** (H6.S1) y sin reseñas como dato principal | botón presente y funcional | spec verde; navegador: Seguir → `POST /community/follows` → `GET` lo incluye → el feed lo refleja | HECHO |

### H3.S2 — Feed personalizado con sesión

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S2.M1 | `feed-publicaciones.ts`: con sesión y vitrina → `community.listFeed({ profileId })` (`GET /community/feed`) mapeado a la forma de la tarjeta usando `post.author` (H2); sin sesión → `feedPublico` como hoy | el médico ve publicaciones de a quién sigue | spec: con sesión llama a `/community/feed`, sin sesión a `/public/posts` | HECHO — desvío: pestaña «Siguiendo»; «Recientes» es la de entrada (el feed real depende del fan-out) |
| H3.S2.M2 | Estados M34 (`ViewState<T>`): cargando (S1) · con datos (S2) · vacío con próxima acción «Siga a profesionales para llenar su inicio» + lista de sugerencias (S3) · error con reintento (S5) · «ver más» con cursor | los nueve estados que apliquen están codificados, no inventados | spec con `view-state-host` por estado verde | HECHO |
| H3.S2.M3 | Vacío con sesión → mostrar el feed de descubrimiento (`/public/posts`) debajo del aviso, para que la pantalla nunca quede muda (regla 95.2.2) | aviso + publicaciones públicas | spec verde · captura | A MEDIAS — el vacío de Siguiendo orienta y ofrece «Ver recientes», pero no pinta el descubrimiento debajo |
| H3.S2.M4 | Tiempo relativo («hace 2 h», «ayer», fecha si > 7 días) en un pipe compartido `shared/pipes/tiempo-relativo` (buscar antes si ya existe: `git grep -i "hace .* h\|relativeTime"`) + `<time datetime>` absoluto | la tarjeta dice «hace 2 h» y el lector de pantalla la fecha completa | spec del pipe (6 casos) verde | HECHO — reusa `shared/date/tiempo-relativo` |
| H3.S2.M5 | Selector «Recientes / Destacadas» (LinkedIn: Top/Recent): `rankScore` del ítem del feed ya viene (`FeedListItem.rankScore`) → ordenar en cliente dentro de la página; sin inventar ranking server-side | el selector cambia el orden de la página cargada | spec verde | TODO — no se hizo el selector Destacadas (en su lugar: Recientes / Siguiendo) |

---

## H4 — «Crear publicación» en modal, con imágenes

**CA:** Dado un profesional con vitrina, cuando toca «Crear publicación» o «Foto», entonces se abre un modal (`app-content-dialog`: foco adentro, Escape cierra, foco restaurado) con su avatar y nombre, el selector de visibilidad, el texto, hasta N imágenes con vista previa y texto alternativo, y «Publicar»; al publicar, la publicación aparece primera en el feed **tras releer** con sus imágenes.
**DoD:** `UI → POST /files (o el uploader del repo) → POST /community/profiles/:id/posts con media[] → 201 → GET /community/feed → la tarjeta pinta mediaUrls` demostrado en navegador y en spec · la publicación con imágenes se ve en 390 y 1440.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | Averiguar y fijar **cómo se sube una imagen de publicación**: `attachment-uploader` (organismo existente) y el endpoint de archivos que usa `comment-media-picker` (`community.comment_media`). Registrar en §9 si el endpoint de medios de post difiere del de comentarios | ruta y contrato escritos acá con línea | `git grep -n "comment_media\|/files" src/app/core` pegado en `evidencia/` | HECHO |
| H4.S1.M2 | `features/social/composer`: `media` con `comment-media-picker` (o el uploader que M1 determine), máximo y tipos según el contrato, vista previa, alt obligatorio opcional según `NewPostMedia.altText`, quitar | se adjunta y se ve antes de publicar | spec: adjuntar 2 → `NewPost.media.length === 2` | HECHO |
| H4.S1.M3 | Quitar el botón apagado «Agregar imágenes» + «Todavía no se pueden adjuntar imágenes» y la aserción `aria-disabled` de `carril-p3-p6-humo.spec.ts` | no queda texto de «todavía no» | `git grep "Todavía no se pueden adjuntar"` vacío | HECHO |
| H4.S1.M4 | `feed-crear-publicacion`: la pastilla y «Foto» abren el modal (`app-content-dialog`); «Foto» abre con el selector de archivos disparado; «Escribir artículo» sigue yendo a `/my-account/articles` si `escribeArticulos()` | modal con foco, Escape, restauración | spec del modal (a11y: `role=dialog`, nombre, foco inicial, Escape, foco de vuelta a la pastilla) verde | HECHO |
| H4.S1.M5 | Cabecera del modal: avatar + nombre + selector de visibilidad (`PUBLIC/FOLLOWERS/PRIVATE`) como en LinkedIn («Cualquiera / Sólo quienes me siguen / Sólo yo») | se ve y cambia `visibility` | spec verde | HECHO |
| H4.S1.M6 | Mock: `POST /community/profiles/:id/posts` con `media` → el feed devuelve `mediaUrls` resolviendo por `GET /public/media/:id` simulado | la demo muestra la imagen subida | `yarn test community.handlers` verde · navegador | HECHO |
| H4.S1.M7 | Prueba de mutación completa (regla «un toast no prueba nada»): spec de componente con `HttpTestingController` y corrida Playwright `publicar-con-imagen` que recarga y encuentra la tarjeta nueva con `<img>` | pasa en `ng serve` | `yarn pw publicar-con-imagen` → passed + captura | A MEDIAS — spec + recorrido de navegador `playwright/red-social/h4-modal.mjs` (17/17); no hay spec `yarn pw publicar-con-imagen` |

---

## H5 — La tarjeta de publicación como en LinkedIn

**CA:** Dada una publicación en Inicio, el detalle o la ficha, cuando la miro, entonces veo avatar · nombre · titular · «hace 2 h · 🌐» · **Seguir** (si no sigo al autor) · «…»; el texto con «ver más»; el carrusel; el resumen «👍 💡 24 · 3 comentarios»; y la fila **Recomendar · Comentar · Compartir · Guardar**. Recomendar mantiene presionado y abre el selector de cinco reacciones; Comentar despliega el hilo con el redactor arriba; Compartir ofrece «Copiar enlace» y «Enviar por chat»; Guardar alterna y persiste.
**DoD:** cada acción demostrada `UI → request → response → recarga → UI` en spec y en navegador; `carril-01-publicaciones-publicas.spec.ts` sigue verde (AC-01-1…18 no se debilitan); a11y: cada botón con nombre, `aria-pressed` donde corresponde, selector navegable con teclado.
**Estado:** TODO

### H5.S1 — Cabecera y Seguir

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H5.S1.M1 | `public-post-card`: tiempo relativo (H3.S2.M4) + ícono de visibilidad según `visibilityConceptId` (🌐 pública / 👥 seguidores / 🔒 privada) con texto para lectores | se ve «hace 2 h · 🌐» | spec verde | HECHO — el ícono se dibuja cuando la visibilidad se conoce; la lectura por id la trae como concept id y no se inventa |
| H5.S1.M2 | Botón **Seguir** en la cabecera cuando `actorProfileId !== autor` y no lo sigo; «Siguiendo» cuando sí (estado desde `FollowStore`, H6.S1); oculto en la ficha del propio autor | el botón alterna y persiste | spec: `POST /community/follows` → `GET` lo incluye · navegador | HECHO |
| H5.S1.M3 | Menú «…» (`post-preferences-menu`): mantener las 7 entradas; «Guardar / Quitar de guardados» entra como octava **sólo si** producto lo pide (ambigüedad §9); si no, Guardar vive en la fila de acciones | AC-01-15 se mantiene | `carril-01` AC-01-15 verde | HECHO — el menú conserva sus 7 entradas |

### H5.S2 — Cinco reacciones

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H5.S2.M1 | Molécula nueva `shared/components/molecules/reaction-picker` (buscar antes: `git grep -il "reaction-picker\|reaccion" src/app/shared` vacío → se crea): cinco botones con ícono + rótulo («Recomendar», «Me encanta», «Me hizo pensar», «Celebro», «Apoyo»), `role="group"`, flechas para moverse, Escape cierra, respeta `prefers-reduced-motion` | se abre al mantener (toque) / al pasar o enfocar (puntero y teclado) | spec a11y + teclado verde | HECHO — `shared/components/molecules/reaction-button` |
| H5.S2.M2 | `public-post-card.recomendar()`: clic corto = LIKE o quitar; selector = `react({ reactionType })` (el backend hace upsert: cambiar de tipo no duplica, `community.types.ts:1084-1090`); el botón muestra la reacción propia (`actorReactionType`) | el botón dice «Me encanta» en rojo si reaccioné LOVE | spec: cambiar LIKE→LOVE manda **un** `PUT /community/reactions` y el total no cambia · navegador | HECHO |
| H5.S2.M3 | Resumen: iconos de los tipos presentes en `reactions.tallies` (máx. 3) + total; clic abre `public-post-reactions` (existe) | «👍 ❤️ 💡 24» | spec verde; AC-01-9/10 verde | HECHO |
| H5.S2.M4 | La tarjeta pública consume `ReactionSummary` (tipos) y no sólo `reactionCount`: ampliar `PublicPostSummary` con `reactions` (API `GET /public/posts` ya expone reacciones por post; verificar DTO en `community-public.controller.ts` y, si falta, microtarea de API aditiva) | los tallies llegan | int-spec/contrato pegado en `evidencia/` | A MEDIAS — el desglose llega en «Siguiendo»; `GET /public/posts` sólo trae el total |

### H5.S3 — Comentarios, Compartir, Guardar

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H5.S3.M1 | Hilo: redactor **arriba** del listado (como LinkedIn), avatar del comentarista, «Responder» en línea (H1.S2.M6), «Ver más comentarios» ya existe | orden y redactor arriba | spec verde; captura | HECHO |
| H5.S3.M2 | **Compartir**: `app-menu` con «Copiar enlace» (clipboard + toast; existe `copyLink` en el menú «…», reutilizar la acción) y «Enviar por chat» → abre `/messaging` con `createConversation` precargando el enlace en el cuerpo (contrato `NewDirectMessage.bodyText`) | las dos opciones funcionan | spec: «Enviar por chat» → `POST /community/conversations` + `POST …/messages` · navegador | A MEDIAS — Copiar enlace y Compartir (nativo) andan; «Enviar por chat» no se construyó |
| H5.S3.M3 | **Guardar**: botón con `aria-pressed`, `bookmark/unbookmark` (`community.client.ts:441/454`), estado inicial desde `listBookmarks` cacheado por sesión (`BookmarkStore`, H1.S1.M3) | alterna y persiste tras recargar | spec + navegador: `POST /community/bookmarks` → recarga → sigue «Guardada» | HECHO |
| H5.S3.M4 | Fila de acciones a lo ancho de la tarjeta con cuatro botones de igual peso, íconos + rótulo, rótulo oculto en 390 con tooltip accesible (regla 95.4.1) | 4 botones, sin desborde en 390 | captura 390/768/1440 claro/oscuro | HECHO |

---

## H6 — Mi red, Seguir en todas partes y Guardados

**CA:** Dado un usuario con vitrina, cuando abre **Mi red**, entonces ve a quién sigue (con «Dejar de seguir»), sugerencias con «Seguir», y el acceso a Grupos; desde la ficha pública de cualquier profesional puede Seguir/Dejar de seguir y el estado se refleja en la tarjeta, la ficha y las sugerencias sin recargar.
**DoD:** `GET /community/follows?followerProfileId=` es la única fuente del estado (un `FollowStore` por sesión) · pruebas de las tres superficies · navegador.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H6.S1.M1 | `features/social/follow.store.ts`: carga `listFollows` una vez por sesión (paginando hasta el final, `nextCursor`), `sigue(profileId)`, `seguir`, `dejarDeSeguir` con actualización optimista y reversión en error | una sola lectura por sesión | spec: 3 consultas de estado → 1 `GET` · error en `POST` revierte | HECHO |
| H6.S1.M2 | Botón **Seguir / Siguiendo** como molécula `follow-button` (`aria-pressed`, texto que cambia al pasar: «Siguiendo» → «Dejar de seguir», como LinkedIn) | reutilizable en 3 lugares | spec verde | HECHO |
| H6.S1.M3 | `public-profile-card.html`: Seguir junto a «Enviar mensaje» (`:140-143`); sin sesión manda a `/auth` con retorno (AC-01-17); vitrina propia no lo muestra | Seguir en la ficha | spec + `carril-05-perfil-doctor.spec.ts` sigue verde | HECHO |
| H6.S1.M4 | Ruta `network` en el shell público (`rutasDeBusquedaPublica`, junto a `posts`) con guard de sesión → `features/social/network/`: pestañas (`app-tabs`) **Siguiendo** · **Sugerencias** · **Grupos** (enlace a `/groups`); regla §5: una tarjeta con pestañas, centrada, a lo ancho | las tres pestañas | spec de ruta + componente verde; medición de holgura ≤ 2 px como `mi-perfil-paciente.mjs` | HECHO — desvío: dos pestañas (Siguiendo · Sugerencias); Grupos queda en el rail/perfil |
| H6.S1.M5 | «Siguiendo»: filas con avatar, nombre, titular (resueltos con `ProfileSummaryStore`, H2.S1.M4) y «Dejar de seguir»; vacío orienta («Todavía no sigue a nadie. Empiece por las sugerencias») | lista y vacío | spec verde | HECHO |
| H6.S1.M6 | «Sugerencias»: misma fuente que «Profesionales para seguir» excluyendo a quienes ya sigo y a mí; «Seguir» en cada fila | sin duplicados con «Siguiendo» | spec verde | HECHO |
| H6.S1.M7 | **Guardados** `/my-account/saved` (ruta hija de `my-account`, `pantallaDeOperacion`): lista de `listBookmarks` resolviendo cada `bookmarkableRefId` a su publicación (`readPost`) y pintándola con `public-post-card`; «Quitar» | abre y quita | spec + navegador | HECHO — desvío: ruta `/saved` en el marco público |
| H6.S1.M8 | Mock: sembrar guardados y notificaciones de «empezó a seguirte» para la médica y la paciente, con ids estables (`uuid('…')`) | la demo tiene datos | `yarn test fixtures` verde · segunda corrida sin duplicar (idempotencia de seeds) | TODO — la demo arranca sin guardados (se crean desde la tarjeta); los avisos de seguimiento ya existían |

---

## H7 — Notificaciones y chats conectados al flujo

**CA:** Dado un aviso social («X recomendó tu publicación», «X comentó», «X empezó a seguirte»), cuando lo toco, entonces abro la publicación (o la ficha de X); y desde cualquier publicación o ficha puedo iniciar un chat con el autor.
**DoD:** `notification-center` con sesión de la médica abre los tres tipos al destino correcto en navegador · `AG-21` no empeora (tipos desconocidos no rompen).
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H7.S1.M1 | `notifications.store.ts` (`deCommunity`): destino por `notificationTypeConceptId` — reacción/comentario → publicación (H1.S2.M4); seguimiento → `/p/:slugDelActor`; desconocido → `/posts` (nunca `/feed`) | tres destinos | spec con los 3 + el desconocido verde | HECHO — desvío: el destino lo resuelve la ruta, no el store |
| H7.S1.M2 | Título del aviso con el nombre del actor (resolver `actorProfileId` con `ProfileSummaryStore`) en vez de «Novedad en su perfil» | «Valeria Rojas recomendó su publicación» | spec verde | HECHO |
| H7.S1.M3 | «Contactarme con este doctor» del menú «…» (`pedirContacto`, hoy manda a la ficha con un aviso): mantener hasta que producto decida (P-01-1, §9); registrar | sin cambio de comportamiento | — | HECHO — sin cambio, registrado |

---

## H8 — La barra social del shell público (Inicio · Mi red · Chats · Notificaciones · Yo)

**CA:** Dado un usuario con sesión en `/posts`, `/network`, `/p/:slug` o `/my-account/saved`, cuando mira el header público, entonces ve la barra de cinco entradas con ícono + rótulo (rótulo oculto en 390 con tooltip), la activa marcada una sola vez, el contador de chats sin leer y el de notificaciones; sin sesión ve lo de hoy (Entrar / Crear cuenta).
**DoD:** `carril-01` AC-01-2/AC-01-3 (rail con tooltips y activa única) extendido a la barra nueva y verde · teclado completo · claro/oscuro · sin scroll horizontal.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H8.S1.M1 | Reutilizar `public-nav-rail` (organismo existente, 4 secciones con tooltip) extendiéndolo con entradas condicionadas a sesión, en vez de crear otro rail | un solo rail | spec del rail: con sesión 5 entradas sociales, sin sesión las 4 actuales | HECHO |
| H8.S1.M2 | Contadores: chats sin leer (`listConversations` → `unreadCount`, mismo origen que `etiquetaChats()` de `shell-layout.html`) y notificaciones (`NotificationPage.unreadCount`) como `app-badge`, con texto accesible «3 sin leer» | números correctos | spec verde | HECHO |
| H8.S1.M3 | «Yo»: avatar + menú (`app-menu`) con «Ver mi vitrina», «Editar mi vitrina», «Guardados», «Volver a mi panel», «Cerrar sesión» (reusar lo del header de la app) | menú con teclado y Escape | spec a11y verde | DESCARTADO — el marco ya ofrece «Volver a mi panel» y el perfil mini los accesos; un menú «Yo» los duplicaba (decisión de implementación, a confirmar con Marcelo) |
| H8.S1.M4 | Header de la app (`shell-layout.html:419-424`): el ícono «Red social» sigue a `/posts`; verificar que el tooltip/aria no cambian (spec `:1358-1359`) | sin regresión | `shell-layout.spec.ts` verde | HECHO |

---

## H9 — Cierre: gates, Playwright, barrido visual, revisión independiente, PR

**CA:** Dado todo lo anterior en `HECHO` o `A MEDIAS` declarado, cuando se corre la batería completa, entonces lint/typecheck/build/test están en verde (salvo los 9 fallos preexistentes documentados en `ESTADO.md`), las corridas Playwright pasan contra `ng serve`, el barrido visual está inspeccionado y tres revisores independientes firmaron.
**DoD:** salidas literales en `evidencia/` · PR abierto contra `mockup` (el merge exige revisión humana, `CLAUDE.md` «Git»).
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H9.S1.M1 | `yarn lint` · `yarn typecheck` · `yarn build` | 0 / 0 / 0 (avisos de presupuesto = base) | salidas en `evidencia/gates.txt` | TODO |
| H9.S1.M2 | `yarn test` completo | sólo los 9 fallos preexistentes | `evidencia/test.txt` con el recuento | TODO |
| H9.S1.M3 | `red-social-linkedin.mjs` reescrito para el flujo nuevo (orden de columnas D-02, modal, 5 reacciones, responder en línea, seguir, guardar, compartir, Mi red, redirect `/feed`) → todos ✔ en 390/768/1024/1440/1920 | script ✔ | `evidencia/red-social-linkedin/` + salida | TODO |
| H9.S1.M4 | `yarn pw carril-01-publicaciones-publicas carril-p3-p6-humo carril-05-perfil-doctor public-profile-reviews p3-muro-social` | passed | `evidencia/pw.txt` | TODO |
| H9.S1.M5 | Barrido visual de `/posts`, `/network`, `/p/:slug`, `/my-account/saved`, modal de creación, hilo, selector de reacciones: 390/768/1440 × claro/oscuro × (cargando, con datos, vacío, error) — **mirando** cada captura y anotando en `evidencia/VISUAL.md` | sin desbordes, sin columna vacía, contraste AA | `visual-quality-gate` corrido; `VISUAL.md` escrito | TODO |
| H9.S1.M6 | Accesibilidad: teclado de punta a punta en Inicio (pastilla → modal → publicar → reaccionar con selector → comentar → responder → seguir), axe en los componentes nuevos, lector de pantalla en el selector de reacciones y el modal | 0 violaciones críticas | `evidencia/a11y.txt` | TODO |
| H9.S1.M7 | Revisión independiente: `visual-reviewer` (sobre `evidencia/`), `frontend-reviewer` (diff), `regression-auditor` (consumidores de `community.client`, rutas, notificaciones) — quien implementó no aprueba | tres veredictos escritos | `evidencia/revisiones.md` | TODO |
| H9.S1.M8 | `REPORTE.md` con AVANCE en la primera línea, Completado / A medias / Pendiente, No cubierto, Desvíos, Riesgos, Decisiones | existe | — | TODO |
| H9.S1.M9 | PR contra `mockup` con la plantilla del repo; PR aparte en `mantra-core-health-api` para H2 (orden de despliegue: API primero; el front tolera `author` ausente por H2.S1.M4) | dos PR abiertos y enlazados | URLs en el reporte | TODO |

---

## H10 — Rediseño estético e integral, guiado por `marketingskills` (pedido del 21/10/2026)

Pedido literal: «añadas al plan que hagamos un rediseño ultra estético e integral; considerá estas skills: https://github.com/coreyhaines31/marketingskills/».

**Qué aportan esas skills y qué no (hecho, leído en el repo, commit `e85f3cbc`, 19/10/2026, licencia MIT).** Son 60 skills de **marketing y conversión**, no de diseño visual: `cro`, `copywriting`, `copy-editing`, `onboarding`, `signup`, `site-architecture`, `marketing-psychology`, `product-marketing`, `social`, `community-marketing`, `referrals`, `seo-audit`, `schema`, `image`, entre otras. Por eso el rediseño se apoya en **dos patas**:

- **Lo estético** (color, tipografía, espacio, jerarquía, movimiento): las skills del propio repo y de la casa — `project-design-system` (188 tokens, sin Tailwind), `visual-quality-gate`, `frontend-design`, `emil-design-eng`, `apple-design`, `improve-ui`, `visual-hierarchy-composition`, `typography-systems`, `color-systems`, `frontend-motion`.
- **Lo que hace que la pantalla funcione para quien la usa** (propuesta de valor, textos, confianza, primera experiencia, arquitectura de navegación): las de `marketingskills`, aplicadas a la superficie pública y a la red social.

**Límite ético que no se negocia (producto de salud).** De `marketing-psychology` y `cro` se usa sólo lo honesto: prueba social **verificada** (reseñas reales, matrícula verificada), claridad, reducción de fricción. **Prohibido** en cualquier pantalla: escasez o urgencia artificial («quedan 2 turnos»), FOMO, confirmshaming, conteos inventados, testimonios ficticios, o cualquier patrón que empuje una decisión clínica. Lo pagado sigue diciendo «Espacio pagado» (pie del marco público). Cada afirmación de un texto tiene que poder respaldarse (lo exige también `copywriting`: «Claims must be supportable»).

**Alcance (supuesto A-10):** «integral» = todas las pantallas de la **superficie pública y social** (marco público, `/posts`, `/network`, `/saved`, `/p/:slug` y `/o/:slug`, publicación suelta, buscador y sus 8 verticales, `/auth` y registro, inicio sin sesión) y el **lenguaje visual compartido** (tokens, tipografía, tarjetas, botones), que por construcción alcanza al resto de la app. Las pantallas clínicas internas (historia clínica, recetas, agenda) **sólo heredan** tokens y primitivas; su re-composición queda fuera de H10 y se propone como hito siguiente. Regla `NO_BIG_BANG_REWRITE`: franja por franja, cada una cierra con evidencia de navegador antes de abrir la siguiente.

**CA:** Dado cualquier visitante o profesional en la superficie pública o social, cuando la recorre en 390/768/1440 y en claro/oscuro, entonces ve un lenguaje visual único (mismos tokens, misma escala tipográfica, mismas tarjetas), una propuesta de valor clara en el primer pantallazo sin sesión, textos sin «tics de IA» y sin afirmaciones sin respaldo, un primer uso guiado con sesión (vacíos que orientan, lista de próximos pasos), y ningún patrón de presión; y el comportamiento (autorización, navegación, contratos de API, persistencia, validación) es el mismo que antes del rediseño.
**DoD:** por franja: `yarn lint` 0 · `yarn typecheck` 0 · specs tocados verdes sin debilitar · `visual-quality-gate` con capturas antes/después 390/768/1440 × claro/oscuro **mirado** y anotado en `evidencia/h10/VISUAL.md` · axe sin críticos · contraste AA medido · `visual-reviewer` y `regression-auditor` firmaron (no quien implementó) · Playwright de la franja verde contra `ng serve`.
**Estado:** TODO

### H10.S0 — Base: contexto de producto, skills y auditoría «antes»

| ID | Microtarea | CA (binario) | DoD (comando → salida esperada) | Estado |
|---|---|---|---|---|
| H10.S0.M1 | Incorporar las skills útiles de `marketingskills` al repo: `cro`, `copywriting`, `copy-editing`, `onboarding`, `signup`, `site-architecture`, `marketing-psychology`, `product-marketing`, `social`, `community-marketing`, `seo-audit`, `schema` copiadas a `.claude/skills/marketing/<nombre>/` con `LICENSE` (MIT) y `PROCEDENCIA.md` (URL, commit `e85f3cbc`, fecha, licencia — regla 97.4.2) y la nota del límite ético de este hito | 12 carpetas + licencia + procedencia | `ls .claude/skills/marketing | wc -l` → 12 · `git grep -n "e85f3cbc" .claude/skills/marketing/PROCEDENCIA.md` → 1 | TODO |
| H10.S0.M2 | Documento de contexto de producto (`product-marketing` lo pide en `.agents/product-marketing.md`; acá vive en `docs/refactor-profesional/contexto-producto.md`): públicos (paciente, profesional, organización), problema, propuesta de valor, voz (de usted, sobria, clínica), pruebas que se pueden mostrar y las que **no** — todo con fuente en `docs/` o en el código; lo que no tenga fuente queda como pregunta, no como hecho | cada afirmación cita archivo o queda en §9 | revisión: `grep -c "Fuente:" docs/refactor-profesional/contexto-producto.md` ≥ número de afirmaciones | TODO |
| H10.S0.M3 | Auditoría «antes» con `cro` + `site-architecture` + `seo-audit` sobre las pantallas del alcance: propuesta de valor, jerarquía, CTA, confianza, fricción, navegación, títulos y metadatos | una tabla por pantalla con hallazgo → franja que lo resuelve | `evidencia/h10/auditoria-antes.md` + capturas `evidencia/h10/antes/` (390/1440 × claro/oscuro) | TODO |
| H10.S0.M4 | Dirección visual: tres alternativas en una página de referencia (paleta derivada de los tokens actuales, escala tipográfica, densidad, radios, sombras, movimiento) comparadas con capturas; se elige una y se registra por qué en `docs/adr/ADR-00XX-rediseno-visual.md` | ADR escrito con la elegida y las descartadas | `ls docs/adr | grep -i rediseno` → 1 | TODO |

### H10.S1 — Lenguaje visual compartido (tokens y primitivas)

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H10.S1.M1 | Tokens: ajustar valores (no nombres) de color, tipografía, espacio, radio, sombra y duración según el ADR, en claro y oscuro, en `docs/design-system/tokens.md` y la hoja de tokens; **cero** literales nuevos | contraste AA de cada par texto/fondo | script de contraste sobre los pares documentados → 0 fallos · `yarn build` 0 | TODO |
| H10.S1.M2 | Primitivas: tarjeta, botón, pastilla, pestañas, avatar, insignia de verificado, esqueleto, estado vacío — una sola versión cada una (buscar duplicados antes: `atomic-design-components`) | ningún componente duplicado nuevo | `git grep -c "border-radius:" src/app/features` no crece · specs de las primitivas verdes | TODO |
| H10.S1.M3 | Movimiento: entradas, hover, despliegues con las duraciones del ADR y `prefers-reduced-motion` respetado en todos | sin animaciones de layout | spec/E2E con `reducedMotion: 'reduce'` → sin transiciones | TODO |

### H10.S2 — Superficie sin sesión: primer pantallazo y confianza (`cro`, `copywriting`, `schema`)

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H10.S2.M1 | `/posts` sin sesión: bloque de bienvenida con propuesta de valor en una línea, para quién es, y dos CTA (Buscar a quién consultar · Crear cuenta), sin tapar el feed | se entiende qué es AloVida sin hacer scroll en 390 | captura 390/1440 · prueba de 5 segundos documentada en `evidencia/h10/` | TODO |
| H10.S2.M2 | Marco público: header y rail rediseñados (jerarquía, buscador protagonista, estados activos) sin cambiar rutas ni accesibilidad (AC-01-2/3) | carril-01 sigue verde | `yarn pw carril-01-publicaciones-publicas` → passed | TODO |
| H10.S2.M3 | Ficha pública del profesional: jerarquía de confianza (verificado, especialidad, reseñas reales, cómo contactar) + datos estructurados `Physician`/`MedicalOrganization` (JSON-LD, `schema`) sin datos personales de más | validador de schema sin errores | salida del validador pegada · `carril-05-perfil-doctor` verde | TODO |
| H10.S2.M4 | Buscador y verticales: tarjetas de resultado con la misma anatomía, filtros legibles, vacíos que orientan | 8 verticales con la misma tarjeta | capturas de las 8 · specs verdes | TODO |
| H10.S2.M5 | Pasada de `copy-editing` a todos los textos del alcance: sin tics de IA, sin promesas sin respaldo, de usted, rótulos de botón que dicen lo que pasa | lista antes/después revisada | `evidencia/h10/textos.md` con cada cambio y su motivo | TODO |

### H10.S3 — Registro, entrada y primer uso (`signup`, `onboarding`)

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H10.S3.M1 | `/auth` y registro: menos fricción visual (un objetivo por paso, errores por campo, datos preservados ante fallo) sin cambiar validación ni contratos | mismos requests que antes | spec + E2E de registro verdes · HAR antes/después idéntico en endpoints | TODO |
| H10.S3.M2 | Primer uso con sesión en la red: lista «Empiece acá» (crear su vitrina → seguir a 3 profesionales → primera publicación) calculada de datos reales (perfil propio, `FollowStore.total`, publicaciones propias), descartable y persistida | se marca sola al cumplirse cada paso | spec por paso · navegador: cumplir un paso → recarga → sigue marcado | TODO |
| H10.S3.M3 | Vacíos de `/posts` Siguiendo, `/network`, `/saved` con ilustración/ícono del sistema y próxima acción (ya orientan; se igualan al lenguaje nuevo) | tres vacíos con el mismo patrón | capturas claro/oscuro | TODO |

### H10.S4 — Red social con el lenguaje nuevo (`social`, `community-marketing`)

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H10.S4.M1 | Tarjeta de publicación, modal de creación, hilo y selector de reacciones con el lenguaje del ADR (densidad, tipografía de lectura, imágenes con proporción estable) | sin cambios de comportamiento | specs de H3–H5 verdes sin tocar aserciones · capturas | TODO |
| H10.S4.M2 | Inicio en tres columnas, Mi red y Guardados re-compuestos (holgura ≤ 2 px, `composition-rules` §5) | medición pegada | script de medición → ✔ en 390/768/1440 | TODO |
| H10.S4.M3 | Ayudas al publicar (`social`): pistas de formato en el redactor (gancho en la primera línea, imagen con texto alternativo, etiquetas) sin bloquear ni puntuar a nadie | pistas visibles y descartables | spec verde | TODO |

### H10.S5 — Cierre del rediseño

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H10.S5.M1 | Barrido visual completo antes/después de todas las pantallas del alcance × 390/768/1440 × claro/oscuro × estados, **mirado** | `VISUAL.md` sin pendientes | `visual-quality-gate` corrido | TODO |
| H10.S5.M2 | Regresión: `yarn lint`, `typecheck`, `build`, `test` completo y Playwright de los carriles del alcance | sólo fallos preexistentes documentados | salidas en `evidencia/h10/` | TODO |
| H10.S5.M3 | Revisión independiente (`visual-reviewer`, `frontend-reviewer`, `regression-auditor`) y sección H10 en `REPORTE.md` | tres veredictos | `evidencia/h10/revisiones.md` | TODO |

---

## 5 · Microtareas en números

| Hito | Microtareas |
|---|---|
| H0 | 3 |
| H1 | 11 |
| H2 | 4 |
| H3 | 8 |
| H4 | 7 |
| H5 | 11 |
| H6 | 8 |
| H7 | 3 |
| H8 | 4 |
| H9 | 9 |
| H10 | 21 |
| **Total** | **89** |

Avance se informa como `HECHO / 89` (68 del flujo social + 21 del rediseño, agregado el 21/10/2026). Los estados por microtarea de H0–H9 se recalculan en el `REPORTE.md` con su evidencia; esta tabla no se adelanta a ella.

---

## 6 · Archivos (crear · modificar · borrar)

**Borrar:** `src/app/features/feed/feed.{ts,html,css,spec.ts}` · `src/app/features/feed/post-card/*`.

**Mover:** `features/feed/composer/*` → `features/social/composer/*` · `features/feed/report-post/*` → `features/social/report-post/*`.

**Crear:** `features/social/{follow.store,bookmark.store,profile-summary.store}.ts` + specs · `features/social/network/*` · `features/account/saved/*` · `shared/components/molecules/reaction-picker/*` · `shared/components/molecules/follow-button/*` · `shared/pipes/tiempo-relativo/*` (si no existe) · `playwright/publicar-con-imagen.spec.ts` · `docs/trabajo/2026-10-21-red-social-linkedin/{REPORTE.md,evidencia/}`.

**Modificar (front):** `app.routes.ts` (`:74`, `:1497-1510`, `:1695-1698`, `rutasDeBusquedaPublica`) · `app.routes.spec.ts:96` · `core/notifications/notifications.store.ts:326` · `core/data-access/community/{community.types,community.client}.ts` · `core/data-access/public-directory/public-directory.types.ts` · `core/mock/handlers/community.handlers.ts` · `core/mock/fixtures/comunidad.ts` · `core/mock/contract/api-contract.generated.ts` (regenerado) · `features/alovida/buscar/feed-publicaciones/*` (los cinco) · `features/alovida/shell/alovida-public-shell.{ts,html,css}` · `shared/components/organisms/public-nav-rail/*` · `features/public-profile/{public-post-card,public-post-comments,public-profile-card}/*` · `shared/components/molecules/post-preferences-menu/*` (sólo si §9 A-03 = sí) · `playwright/{red-social-linkedin.mjs,carril-p3-p6-humo.spec.ts}` · `core/navigation/navigation.map.ts:207-236` (comentario) · `docs/reports/generated/route-inventory.md` · `docs/integrations/backend-api.md`.

**Modificar (API):** `src/modules/community/dto/read-social.dto.ts` · servicio de lectura del feed/posts · `test/integration/community-feed-author.int-spec.ts` (nuevo) · OpenAPI.

---

## 7 · Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| D-01 no confirmada y se implementa sobre `master` | Rehacer `/posts`, tarjeta pública, hilo con adjuntos (miles de líneas que ya existen en `mockup`) | H0.S1.M1 es la primera microtarea y bloquea el resto |
| La API de `master`/`dev` no incorpora H2 a tiempo | El feed personal mostraría autores sin nombre | H2.S1.M4 (caché por autor) hace que el front funcione igual; el DTO es aditivo |
| `GET /community/feed` vacío para usuarios reales que no siguen a nadie | Inicio «muerto» en el primer uso | H3.S2.M3: descubrimiento + sugerencias con Seguir |
| El endpoint de subida de medios de post no es el mismo que el de comentarios | H4 se retrasa | H4.S1.M1 lo determina antes de escribir; si falta, microtarea de API aditiva y simulación en mock con los tres niveles (correcto/límite/inválido) |
| «Copiar LinkedIn tal cual» choca con el pedido del 13/09 (columnas) | Retrabajo de layout | D-02: una respuesta tuya antes de H3 |
| `carril-01` (AC-01-15: «exactamente siete entradas» del menú) | Agregar «Guardar» al menú rompe el AC | Guardar va en la fila de acciones (H5.S3.M3); el menú no cambia salvo decisión A-03 |
| Specs de `feed.spec.ts` (368 líneas) cubren casos que nadie más cubre (puerta «sin vitrina», paginación, reporte en línea) | Pérdida de cobertura al borrar | Antes de borrar, H1.S1 verifica que `feed-publicaciones.spec.ts` cubre los mismos casos; los que no, se portan (sin debilitar) |
| Playwright contra `ng serve`: `networkidle` no llega con HMR | Verdes falsos | `CLAUDE.md` regla 5: esperar por condición, nunca `networkidle`; `testId` vs `data-testid` distintos |
| Un cambio en `public-post-card` alcanza la ficha pública, el detalle y el feed | Regresión en tres pantallas | `regression-auditor` en H9 + `carril-05` y `public-profile-reviews` en H9.S1.M4 |

---

## 8 · Evidencia que exige cada mutación (regla «un toast no prueba nada»)

Para publicar con imagen, reaccionar (y cambiar de tipo), comentar, responder, seguir/dejar de seguir, guardar/quitar, enviar por chat: spec con `HttpTestingController` que afirma **método, ruta y body**, y corrida en navegador con `UI → request (pestaña Red) → response → recarga → UI`, guardada en `evidencia/<accion>.md` con la captura antes/después.

---

## 9 · Ambigüedades registradas (ninguna se resuelve por conveniencia)

| ID | Pregunta | Supuesto tomado mientras tanto | Confirmar con |
|---|---|---|---|
| A-01 | ¿Qué dijo el chat anterior que yo no tengo? | Lo recuperado del repo (§0 D-02) + «copiar LinkedIn tal cual» | Marcelo |
| A-02 | «Compartir» en LinkedIn incluye **Repost**; la API no tiene reposts | Compartir = Copiar enlace + Enviar por chat. Repost se registra como brecha de API (`POST /community/posts/:id/reposts`), no se simula | Marcelo / backend |
| A-03 | ¿«Guardar» entra también en el menú «…» (sería la 8.ª entrada y rompe AC-01-15)? | No: va en la fila de acciones | Marcelo |
| A-04 | «Contactarme con este doctor» (P-01-1): chat, solicitud de consulta o teléfono | Se mantiene lo de hoy (manda a la ficha) | Producto |
| A-05 | Encuestas (LinkedIn las tiene en el modal). La API las tiene; el cliente no tiene `createPoll`/`vote` | OUT en este plan; el atajo no se muestra | Marcelo |
| A-06 | Conteo de seguidores en la ficha (LinkedIn lo muestra). La API sólo lista «a quién sigo» | No se muestra; brecha de API registrada (`GET /community/profiles/:id/followers/count`) | Backend |
| A-07 | Tendencias por hashtag (AG-24) | «Profesionales para seguir» ocupa ese lugar | Producto |
| A-08 | Roles: ¿los pacientes también ven «Red social» con Inicio/Mi red? Hoy `/posts` es público y la paciente del mock tiene vitrina y seguimientos | Sí para cualquiera con sesión; la barra «Yo» depende de tener vitrina | Marcelo |
| A-09 | Idioma de los rótulos de reacción (LinkedIn: Recomendar · Celebrar · Apoyar · Me encanta · Interesante · Gracioso). La API tiene 5: LIKE, LOVE, INSIGHTFUL, CELEBRATE, SUPPORT | «Recomendar · Me encanta · Me hizo pensar · Celebro · Apoyo» (de usted, como el resto de la app) | Marcelo |

| A-10 | ¿Qué abarca «integral» en el rediseño? | Superficie pública y social completa + lenguaje visual compartido (tokens y primitivas, que alcanza a toda la app); la re-composición de pantallas clínicas internas queda para el hito siguiente | Marcelo |
| A-11 | ¿Se copian las skills de `marketingskills` al repo o sólo se consultan? | Se copian las 12 útiles con licencia MIT y procedencia (H10.S0.M1); no se copian las de anuncios, correo frío, SMS, afiliados ni precios, que no tienen superficie en esta app | Marcelo |
| A-12 | Tácticas de `marketing-psychology` (escasez, urgencia, anclaje) en un producto de salud | No se usan: sólo prueba social verificada, claridad y menos fricción (límite ético de H10) | Marcelo / responsable clínico |
---

## 10 · Cómo retomar este plan en otra sesión

1. Leer §0 y ver si D-01 y D-02 ya tienen respuesta (quedan anotadas acá mismo cuando lleguen).
2. `git -C mantra-core-health worktree add ../wt-social -b claude-marcelo/hopeful-ride-7z2qps origin/mockup` (o la rama si ya existe).
3. `corepack yarn install --immutable && yarn start --port <libre>`.
4. Abrir el primer `TODO` de la tabla del hito en curso; actualizar su fila al abrir y al cerrar.
5. Registrar cada salida en `evidencia/` y el estado en este archivo; al cerrar la sesión, `REPORTE.md` aunque esté a medias.
