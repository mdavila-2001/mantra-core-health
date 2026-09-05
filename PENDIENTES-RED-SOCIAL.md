# Pendientes · Red social médica y buscador público

> Qué falta para que la red social (M19 `community`) y su superficie pública (M65 `buscador`)
> funcionen de punta a punta: backend, workers, infraestructura ya levantada y frontend.
>
> **Primer relevamiento: 13/08/2026. Revisado el mismo día, por la tarde.** Todo lo que dice «hoy»
> se midió contra los tres repos y contra los contenedores corriendo, no contra la documentación.
>
> ## ⚠️ Dos de los cinco huecos ya están cerrados
>
> Entre el relevamiento de la mañana y esta revisión se fusionaron a `dev` los PR
> [#62](https://github.com/mdavila-2001/mantra-core-health-api/pull/62) y
> [#63](https://github.com/mdavila-2001/mantra-core-health-api/pull/63) —**los dos de la misma rama**,
> `marcelo/m19-community-reads-worker`, uno contra `master` y otro contra `dev`—, obra de Marcelo
> Dávila. Medido contra `origin/dev`:
>
> | Hueco | Estado hoy | Cómo se midió |
> |---|---|---|
> | **H1** · cero lecturas | ✅ **cerrado** | **17 `@Get`** en `src/modules/community/controllers/` |
> | **H3** · sin worker de fan-out | ✅ **cerrado** | `src/worker-community.ts` existe en `dev` |
> | **H2** · cero superficie pública | ❌ sigue abierto | **0 `@Public()`** en los controladores de `community` |
> | **H4** · cero integración con la infra | ❌ sigue abierto | 0 archivos mencionan `community` en los **ocho** módulos (`search_platform`, `vector_rag`, `ads`, `geo`, `object_storage`, `messaging`, `telemetry`, `read_models`) |
> | **H5** · cero frontend | ❌ sigue abierto | 0 archivos con `community` en `src/app` |
>
> **Lo que eso cambia en el plan:** F1 y F2 ya no bloquean. El camino crítico pasa a ser
> **F4 → F6** (superficie pública y buscador) con **F5** en paralelo, y las decisiones **D1** y **D2**
> siguen sin tomar — y siguen siendo de quien manda en el producto, no de quien programa.

---

## 0 · El estado real, medido

### Lo que ya existe y funciona

| Capa | Estado |
|---|---|
| **Modelo de datos** | **38 entidades** en `community` — `public_profiles`, `social_posts`, `post_media`, `hashtags`, `content_hashtags`, `mentions`, `comments`, `reactions`, `bookmarks`, `social_follows`, `user_blocks`, `conversations`, `conversation_participants`, `direct_messages`, `message_receipts`, `content_reports`, `moderation_queue`, `moderation_decisions`, `moderation_strikes`, `moderation_appeals`, `service_reviews`, `review_dimension_scores`, `review_responses`, `polls`, `poll_options`, `poll_votes`, `groups`, `group_members`, `topics`, `feed_items`, `social_notifications`, `prestige_scores`, `prestige_awards`, `verified_badges`, `post_shares`, `feedback_tickets` (+2) |
| **Escrituras** | **17 endpoints** en 7 controladores, con `em.transactional`, unicidad, 409 de duplicado, 422 de auto-follow/auto-bloqueo, dedup de reportes y strike en la decisión |
| **Especificación de vistas** | [[V19 community — Vistas]] 18 fichas (la red por dentro) · [[V65 buscador — Vistas]] 14 fichas (la superficie pública) · 14 maquetas HTML ya construidas en `SALUD/Vistas/HTML/V65-buscador/` |
| **Reglas de negocio** | 34 reglas ALOVIDA verificadas contra el modelo: `PAC-SOC-001..010`, `DOC-SOC-001..015`, `ORG-PUB-001..003`, `INS-BRK-015`, `PAC-CITA-001/003`, `PAC-DIAG-001..004/013`, `PAC-MED-003..012` |

### Infraestructura levantada — y sin usar por `community`

Todo esto está **corriendo hoy** y ningún archivo de `community` lo toca:

| Servicio | Puerto | Imagen | Para qué lo necesita la red social |
|---|---|---|---|
| OpenSearch | `9201` | `opensearchproject/opensearch:3.8.0` | El buscador entero. Hoy `search_platform` expone `POST /:index/_search`, `POST /:index/documents` y `DELETE /:index/documents/:id` genéricos, y **nadie indexa nada de community** |
| Redis | `6380` | `redis:8.10-alpine` | Contadores de reacciones y comentarios, feed caliente, rate limit de la superficie pública, presencia y no-leídos de DM |
| MinIO | `9002` / `9003` | `minio/minio:RELEASE.2025-04-22...` | `post_media`: fotos de perfil, imágenes y documentos de las publicaciones. `object_storage` ya tiene subida multiparte y versionado — sin usar desde community |
| PostgreSQL + TimescaleDB | `5434` | `timescale/timescaledb-ha:pg18` | `pgvector ^0.3.0` está instalado: la búsqueda semántica del buscador (`vector_rag`) puede apoyarse ahí |
| MongoDB | `27018` | `mongo:8.0` | `document_store` — candidato natural para el feed materializado y los borradores |
| Jaeger | `16686` | `jaegertracing/jaeger:2.20.0` | Trazas. `ORG-PUB-005` (estadísticas de visualización) sale de `telemetry` |
| API | `3000` | `mantra-redesa-api:local` | — |
| Front | `4200` | `mantra-core-health-web` | — |
| Mock provider | `4100` | — | Proveedores externos simulados |

**21 workers** corriendo (`billing`, `automation`, `consent`, `cross_store_consistency`,
`delegated_access`, `health_context`, `identity_assurance`, `integrations`, `audio-assets`,
`messaging`, `pharmacy_inventory`, `promotions`, `qa_lab`, `read_models`, `reporting`, `scheduling`,
`tracking`, `workflow`, `vector_rag`, `lakehouse`, `time_series`).

> [!danger] No existe `worker-community`
> `POST /internal/community/feed/rebuild` (UC-19-15) está declarado como «worker interno» en el
> README del módulo, pero **no hay `src/worker-community.ts`, no hay `src/worker/jobs/community/`
> y no hay servicio en `docker-compose.yml`**. El fan-out del feed hoy no lo dispara nadie.

### Los cinco huecos que impiden que funcione

| # | Hueco | Evidencia |
|---|---|---|
| ~~**H1**~~ | ~~**Cero lecturas.**~~ **Cerrado el 13/08 por la tarde**: hoy hay 17 `@Get` en los controladores de `community` | 17 `@Post`/`@Put`, **17 `@Get`** |
| **H2** | **Cero superficie pública.** Ningún controlador de `community` lleva `@Public()`. Las 12 pantallas públicas de V65 no tienen endpoint | `@Public()` sólo en `iam-auth`, `public-projections`, webhooks y tracking |
| ~~**H3**~~ | ~~**Sin worker de fan-out.**~~ **Cerrado el 13/08 por la tarde**: `src/worker-community.ts` y `src/worker/jobs/community/feed-fanout.job.ts` están en `dev` | `worker-community` existe |
| **H4** | **Cero integración con la infra levantada.** `grep -rl community` sobre `search_platform`, `vector_rag`, `ads`, `geo`, `object_storage`, `messaging`, `telemetry`, `read_models` → **0 archivos en los ocho** | Medido |
| **H5** | **Cero frontend.** `grep -rl community src/app/` → **nada**. No hay ruta, ni cliente de datos, ni feature | `core/data-access/` tiene 16 carpetas; ninguna es community |

---

## 1 · Camino crítico

El orden importa: cada fase desbloquea la siguiente y ninguna se puede adelantar.

```
F1 lecturas + roles ─┬─> F2 worker de fan-out ──> F3 indexación OpenSearch ─┬─> F5 frontend privado
                     │                                                      │
                     └─> F4 superficie pública (@Public + rate limit) ──────┴─> F6 frontend público
                                                                                 │
F7 medios (MinIO) ───────────────────────────────────────────────────────────────┤
F8 notificaciones y tiempo real ─────────────────────────────────────────────────┤
F9 moderación operable ──────────────────────────────────────────────────────────┤
F10 señales: geo · ads · telemetría · prestigio ─────────────────────────────────┘
```

**Mínimo para una demo honesta:** F1 + F2 + F4 + F6. Sin F3 el buscador filtra en SQL y no escala;
sin F7 no hay fotos; sin F8 nadie se entera de nada.

---

## F1 · Backend — las lecturas que no existen ✅ HECHO

> ~~Sin esto no hay nada que mostrar. Es el bloqueo raíz.~~
>
> **Cerrado.** Las 17 lecturas están en `dev`. Lo que queda de esta fase es F1.2 (los roles reales
> de cada endpoint) y F1.3 (lo que el buscador V65 necesita), que dependen de **D1**.

### F1.1 · Lecturas del grafo social

| # | Endpoint | Rol | Entidad | Notas |
|---|---|---|---|---|
| 1 | `GET /community/profiles/:profileId` | auth | `public_profiles` | Con `verified_badges` y `prestige_scores` embebidos |
| 2 | `GET /community/profiles/:profileId/posts` | auth | `social_posts` | Cursor. Respeta `visibility_concept_id` contra el actor |
| 3 | `GET /community/posts/:postId` | auth | `social_posts` | Con `post_media`, `content_hashtags`, `mentions` |
| 4 | `GET /community/posts/:postId/comments` | auth | `comments` | Hilo anidado, cursor por rama |
| 5 | `GET /community/posts/:postId/reactions` | auth | `reactions` | Resumen por tipo + si el actor reaccionó |
| 6 | `GET /community/feed` | auth | `feed_items` | **El endpoint central.** Cursor por `ranking_score` + `published_at` |
| 7 | `GET /community/follows` | auth | `social_follows` | `?followerProfileId=` — alimenta V65-13 |
| 8 | `GET /community/bookmarks` | auth | `bookmarks` | Por colección |
| 9 | `GET /community/blocks` | auth | `user_blocks` | Del propio actor únicamente |
| 10 | `GET /community/profiles/:profileId/reviews` | auth | `service_reviews` | Con `review_dimension_scores` y `review_responses`. **Nunca** expone `verified_encounter_id` |
| 11 | `GET /community/conversations` | auth | `conversations` | Sólo donde el actor participa. Con último mensaje y no-leídos |
| 12 | `GET /community/conversations/:id/messages` | auth | `direct_messages` | Cursor descendente. Verifica participación y ausencia de bloqueo |
| 13 | `GET /community/groups` · `GET /community/groups/:id/members` | auth | `groups`, `group_members` | — |
| 14 | `GET /community/polls/:pollId` | auth | `polls` | Con opciones, conteo y si el actor votó |
| 15 | `GET /community/notifications` | auth | `social_notifications` | Paginado + `unreadCount` |

**DoD:** cada `GET` con su DTO de respuesta, su cursor, su prueba unitaria y su caso en
`test/smoke/modules/community.smoke.ts`. Ningún `Response` expone un UUID interno que la interfaz no
pueda resolver a etiqueta legible.

### F1.2 · Roles — hoy sólo hay `SECURITY_ADMIN`

`community` declara **un solo** `@Roles('SECURITY_ADMIN')` en todos sus controladores. El README
dice «auth» para 14 de los 17 endpoints, pero eso no está expresado en código.

| # | Tarea |
|---|---|
| 16 | Decidir y escribir el decorador real de cada endpoint. Candidatos ya en uso en la API: `PRACTITIONER` (25 usos), `CLINICIAN` (32). **`PATIENT` casi no se usa hoy** — hay que decidir si la red social lo estrena o si el paciente entra por «cualquier sesión autenticada» |
| 17 | Publicar como pública o como propia cada lectura: un post `PUBLIC` lo ve cualquiera; uno `FOLLOWERS` sólo quien sigue; uno `PRIVATE` sólo el autor. Hoy `visibility_concept_id` está en la tabla y **no lo evalúa nadie** |
| 18 | Cablear `user_blocks` en TODA lectura: quien te bloqueó no aparece en tu feed, ni en resultados, ni en comentarios. Es un filtro transversal, no un `if` por endpoint |

### F1.3 · Lo que el buscador V65 necesita y no existe

| # | Endpoint | Pantalla | Regla |
|---|---|---|---|
| 19 | `GET /public/search` — búsqueda unificada por tipo | V65-01 | `PAC-SOC-001` |
| 20 | `GET /public/search/practitioners` | V65-02 | `PAC-SOC-001` · `PAC-CITA-001` |
| 21 | `GET /public/search/medications` | V65-03 | `PAC-MED-003` · `006`–`008` |
| 22 | `GET /public/search/organizations` | V65-04 | `ORG-PUB-001`–`003` |
| 23 | `GET /public/search/diagnostic-units` | V65-05 | `PAC-DIAG-001`–`004` |
| 24 | `GET /public/search/insurers` | V65-06 | `INS-BRK-015` |
| 25 | `GET /public/p/:slug` · `/o/:slug` · `/f/:slug` · `/l/:slug` · `/s/:slug` | V65-07..11 | Perfiles públicos |
| 26 | `GET /public/nearby` | V65-12 | `PAC-MED-004` |

> **Reusar, no duplicar.** `public-projections.controller.ts` ya es `@Public()` y sirve
> `GET /public/{slug}` y `GET /public/directory`. Las rutas de arriba deberían colgar de ahí o de un
> `discovery` nuevo que lo reuse, no de un tercer lugar.

---

## F2 · Worker de fan-out del feed ✅ HECHO

> ~~`POST /internal/community/feed/rebuild` existe. El worker que lo ejecuta, no.~~
>
> **Cerrado.** `worker-community` existe con su job de fan-out. Quedan por comprobar en marcha el
> umbral híbrido (tarea 30) y los jobs 31–34.

| # | Tarea | Archivo |
|---|---|---|
| 27 | Crear `src/worker/jobs/community/community.worker-module.ts` siguiendo el patrón de `read_models` (`@Module({ providers: [...] })` + `bootstrapWorker`) | nuevo |
| 28 | Crear `src/worker-community.ts` con `void bootstrapWorker(CommunityWorkerModule, 'community')` | nuevo |
| 29 | Añadir el servicio `worker-community` a `docker-compose.yml`, con las mismas variables y `healthcheck` que los otros 21 | `docker-compose.yml` |
| 30 | **Job `feed-fanout`** — al publicarse un post, escribe un `feed_items` por seguidor. Estrategia híbrida obligatoria: *push* para perfiles con < 5 000 seguidores, *pull* en lectura para los que estén por encima. Sin eso, un post de una clínica con 200 000 seguidores bloquea la base | nuevo |
| 31 | **Job `ranking-score`** — recalcula `feed_items.ranking_score` (recencia, afinidad, interacción). Barrido periódico como el de `read_models` | nuevo |
| 32 | **Job `counter-reconciliation`** — los contadores de reacciones y comentarios se sirven desde Redis y se reconcilian contra Postgres. Sin este job, la deriva se vuelve permanente | nuevo |
| 33 | **Job `prestige-scores`** — recalcula `prestige_scores` desde reviews, publicaciones y verificaciones. Alimenta la calificación de V65-02 | nuevo |
| 34 | **Job `moderation-sla`** — escala en `moderation_queue` lo que lleva más de N horas sin decisión, y vence las apelaciones sin resolver | nuevo |

**DoD:** `docker compose up -d worker-community` levanta *healthy*; publicar un post desde el smoke
deja filas en `feed_items` de todos los seguidores en menos de 5 s.

---

## F3 · Indexación en OpenSearch

> OpenSearch corre en `9201` desde hace dos días y no tiene un solo documento de community.

| # | Tarea |
|---|---|
| 35 | Definir los índices y sus *mappings*: `community-profiles`, `community-posts`, `directory-practitioners`, `directory-organizations`, `directory-pharmacy-products`, `directory-diagnostic-offerings`, `directory-insurers` |
| 36 | Analizador en español con *stemming* y sin acentos: buscar «cardiologo» tiene que encontrar «Cardiología». Es la diferencia entre un buscador que sirve y uno que no |
| 37 | `geo_point` en los índices de directorio para `PAC-MED-003` (más cercana) y `PAC-MED-004` (mapa) |
| 38 | **Job `search-indexer`** en `worker-community`: proyecta altas y bajas hacia `search_platform`. Reusa `POST /:index/documents` y `DELETE /:index/documents/:id`, que ya existen |
| 39 | Reindexado completo idempotente, para poder reconstruir desde cero |
| 40 | Publicar sólo campos aprobados: el índice público **no** puede contener nada que el prestador no marcó como público. Es el riesgo de fuga más caro de todo el módulo |
| 41 | *Opcional, `vector_rag` y `pgvector` ya instalados:* embeddings de las publicaciones para búsqueda semántica y «contenido relacionado». Va después de que la búsqueda léxica funcione, no antes |

---

## F4 · Superficie pública: exposición y defensa

> Doce pantallas sin token. Es la mayor superficie de ataque del sistema.

| # | Tarea |
|---|---|
| 42 | Marcar los endpoints de búsqueda y perfil con `@Public()` |
| 43 | **Rate limit por IP con Redis.** Redis ya corre en `6380`. Sin límite, el directorio se raspa entero en una tarde |
| 44 | Proyección de sólo-campos-públicos, hecha en el servicio y no en el controlador, y con prueba que falle si alguien agrega un campo al DTO sin pasar por ahí |
| 45 | Slugs estables y únicos por perfil (`/p/marisol-quispe-ticona`), con redirección cuando cambian. Un perfil público que cambia de URL pierde su posicionamiento |
| 46 | Cabeceras de caché y `ETag` en las lecturas públicas |
| 47 | `robots.txt` y `sitemap.xml` generados desde el directorio: si los perfiles no se indexan en buscadores externos, el 80 % del tráfico no llega nunca |
| 48 | Respuestas que no revelen existencia: un slug inexistente y uno despublicado devuelven lo mismo |

---

## F5 · Frontend privado — la red social con sesión

> `grep -rl community src/app/` no devuelve nada. Se empieza de cero.

### F5.1 · Capa de datos

| # | Tarea | Archivo |
|---|---|---|
| 49 | `core/data-access/community/community.client.ts` siguiendo el patrón de los 16 clientes existentes | nuevo |
| 50 | Tipos del contrato generados o escritos a mano contra los DTO de la API | nuevo |
| 51 | Registrar en `core/data-access/wire.ts` | existente |

### F5.2 · Componentes nuevos del banco

El banco tiene 51 piezas + las 6 públicas que se agregaron con V65. La red social necesita:

| # | Componente | Para qué |
|---|---|---|
| 52 | `app-post-card` | La publicación: autor, media, hashtags, acciones |
| 53 | `app-comment-thread` | Hilo anidado con «ver más respuestas» |
| 54 | `app-reaction-bar` | Reacciones con conteo y estado optimista |
| 55 | `app-composer` | Redactor con adjuntos, menciones y selector de visibilidad |
| 56 | `app-conversation-list` · `app-message-bubble` | Mensajería directa |
| 57 | `app-notification-item` | Campana y bandeja |
| 58 | `app-review-form` · `app-review-card` | Reviews por dimensiones |

### F5.3 · Features y rutas

| # | Ruta | Pantallas del vault |
|---|---|---|
| 59 | `/app/comunidad` — muro | V19-13 · V19-16 · V19-05 |
| 60 | `/app/comunidad/mensajes` | V19-01 · V19-02 |
| 61 | `/app/comunidad/grupos` | V19-07 · V19-08 |
| 62 | `/app/comunidad/moderacion` — sólo `SECURITY_ADMIN` | V19-09 · V19-10 |
| 63 | `/mi-cuenta/seguidos` | **V65-13** (maqueta lista) |
| 64 | `/mi-cuenta/calificar` | **V65-14** (maqueta lista) |
| 65 | Guardas por rol reusando `core/auth`, y menú que **no muestra** lo que el rol no puede ejecutar |

---

## F6 · Frontend público — el buscador

> Las 14 maquetas están hechas y verificadas. Falta convertirlas en Angular.

| # | Tarea |
|---|---|
| 66 | Portar `app-public-shell`, `app-resultado`, `app-perfil-cabecera`, `app-perfil-cifras`, `app-declaracion`, `app-mapa` y `app-revelacion` de `alovida.css` §25 a componentes Angular del banco |
| 67 | Rutas públicas fuera de `/app`: `/buscar`, `/buscar/{profesionales,medicamentos,organizaciones,diagnostico,aseguradoras,mapa}`, `/p/:slug`, `/o/:slug`, `/f/:slug`, `/l/:slug`, `/s/:slug` |
| 68 | **SSR para los perfiles públicos.** `app.config.server.ts` y `app.routes.server.ts` ya existen. Sin SSR los perfiles no se indexan y el buscador público pierde su razón de ser |
| 69 | Metadatos Open Graph y JSON-LD (`Physician`, `MedicalOrganization`, `Pharmacy`) por perfil |
| 70 | Estados vacíos con el texto exacto de cada ficha: es el texto que más se copia y pega mal, y en un catálogo a medio poblar es la pantalla que más se ve |
| 71 | Mapa real en V65-12 conservando **la tabla de abajo** y el rótulo «distancia en línea recta» (`PAC-MED-005` es `NO-ESTRUCTURAL`) |
| 72 | Geolocalización del navegador con consentimiento explícito y alternativa escrita: la ubicación no sale del dispositivo salvo que se comparta |

---

## F7 · Medios: MinIO para `post_media`

| # | Tarea |
|---|---|
| 73 | Bucket y *namespace* de community en MinIO, con política de acceso público de sólo lectura para el material aprobado |
| 74 | Conectar la subida al flujo que `object_storage` ya tiene: `POST /storage/namespaces/:code/uploads/initiate` → `POST /storage/uploads/:id/complete` |
| 75 | Derivados: miniatura, tamaño de muro y tamaño completo. `common` ya tiene el concepto de derivados (V02-09) |
| 76 | Antivirus antes de publicar. `POST /internal/files/versions/:vid/scan-result` (V02-08) ya existe: reusarlo, no inventar otro |
| 77 | Límites de tamaño y tipo por `media_type_code`, validados en el servidor |
| 78 | Foto profesional del perfil (`health_practitioner_profiles.photo_file_id`, `DOC-SOC-004`) — el campo existe y nadie lo llena |

---

## F8 · Notificaciones y tiempo real

> **No hay WebSockets ni SSE en toda la API.** `grep -rl "WebSocketGateway\|@nestjs/websockets\|Sse("` → vacío. Es una decisión de arquitectura pendiente, no una tarea de implementación.

| # | Tarea |
|---|---|
| 79 | **Decidir el transporte**: WebSocket, SSE o *polling*. Afecta al despliegue, no sólo al código. Recomendación: SSE para notificaciones y no-leídos (unidireccional, sobrevive a un proxy HTTP), y *polling* de 3 s para mensajes directos en la primera versión |
| 80 | Emitir hacia `messaging`, que **ya tiene el carril montado**: `POST /messaging/notifications/requests`, `GET /messaging/notifications/pending`, `POST /messaging/notifications/in-app/:id/read`. `worker-messaging` ya corre |
| 81 | Llenar `social_notifications` desde el worker: te comentaron, te mencionaron, te siguieron, te respondieron una review |
| 82 | Preferencias de notificación por tipo y por canal |
| 83 | No-leídos en Redis, reconciliados por el job del punto 32 |
| 84 | Recibos de lectura de DM (`message_receipts`): la entidad existe, el `POST /read` también, falta la lectura y el empuje |

---

## F9 · Moderación operable

> Las escrituras están. Lo que falta es que un humano pueda trabajar.

| # | Tarea |
|---|---|
| 85 | `GET /community/moderation/queue` con filtros por estado, severidad y antigüedad — hoy se puede decidir sobre una cola que no se puede leer |
| 86 | `GET /community/moderation/decisions` y `GET /community/moderation/appeals` |
| 87 | Detección automática previa: PII de pacientes en publicaciones. **`DOC-SOC-014` es la regla que más fácil se viola sin querer** y no tiene control estructural posible; la contramedida es advertencia al publicar + moderación reactiva |
| 88 | Strikes acumulativos con consecuencia escrita: qué pasa al segundo y al tercero |
| 89 | Registro en `audit` de toda decisión de moderación |
| 90 | Pantalla V19-10 (cola) y V19-09 (apelaciones) en el frontend, bajo `SECURITY_ADMIN` |

---

## F10 · Señales: geo, publicidad, telemetría, prestigio

| # | Tarea | Módulo | Regla |
|---|---|---|---|
| 91 | Distancia y radio sobre `common.addresses` (`latitude`/`longitude`) → `geo_point` de OpenSearch | `geo` | `PAC-MED-003/004` |
| 92 | Ficha paga en resultados vía `ads.ad_placements`. **Obligación de interfaz:** «Espacio pagado» dentro del cuerpo de la tarjeta, nunca un asterisco al pie | `ads` | `ADV-UBI-001` |
| 93 | Estadísticas de visualización e interacción del perfil público | `telemetry` | `ORG-PUB-005` |
| 94 | `verified_badges` conectado a `identity_assurance`: hoy el sello se puede escribir a mano y **no hay nada que lo ate a la verificación real de matrícula** | `identity_assurance` | `DOC-SOC-005` · `PAC-SOC-002` |
| 95 | Stock y precio de farmacia hacia el índice de búsqueda, con su marca de tiempo | `pharmacy_inventory` | `PAC-MED-007/008/012` |
| 96 | Disponibilidad de agenda hacia el índice: sin el cruce con `scheduling.bookable_slots`, «atiende hoy» es una promesa que la pantalla no puede cumplir | `scheduling` | `PAC-CITA-001` |

---

## F11 · Datos, pruebas y observabilidad

| # | Tarea |
|---|---|
| 97 | Semilla de desarrollo: 50 perfiles públicos bolivianos, 200 publicaciones, comentarios, reacciones, reviews y una cola de moderación con casos. Sin datos realistas no se puede evaluar ni el ranking ni el buscador |
| 98 | `test/smoke/modules/community.smoke.ts` cubriendo los 15 UC más las lecturas nuevas |
| 99 | Smoke de tipo de usuario `paciente` extendido con el recorrido social: buscar → ver perfil → seguir → publicar → comentar → calificar |
| 100 | E2E de Cypress del recorrido público completo, sin sesión |
| 101 | Prueba de carga del fan-out con un perfil de 100 000 seguidores, antes de que exista uno de verdad |
| 102 | Trazas de OpenTelemetry en el fan-out y en la búsqueda — Jaeger ya está en `16686` |
| 103 | Métricas: latencia de búsqueda, retraso del fan-out, profundidad de la cola de moderación |

---

## Decisiones que hay que tomar antes de programar

Ninguna de estas es una tarea: son bifurcaciones que cambian el trabajo de varias fases.

| # | Decisión | Por qué importa |
|---|---|---|
| **D1** | **¿El paciente estrena el rol `PATIENT` o entra como «sesión autenticada»?** | Hoy `PATIENT` casi no se usa en la API. Afecta a los 15 endpoints de F1.1 y a las guardas del frontend |
| **D2** | **Transporte de tiempo real: WebSocket, SSE o polling** | No hay ninguno hoy. Cambia el despliegue, no sólo el código (F8) |
| **D3** | **Umbral del fan-out híbrido** | El número exacto de seguidores donde se pasa de *push* a *pull* (F2.30) |
| **D4** | **Foros médicos** | `DOC-SOC-010/011/015` están `PARCIAL` a la espera del dictamen de `alovida-gap-map#7`: ¿son `community.groups` + `topics` o un dominio nuevo? No se maqueta hasta resolverlo |
| **D5** | **Agregado de receta** | `PAC-MED-001/002` («la farmacia con **todos** los medicamentos de una receta») exige que la receta sea un objeto con N ítems. Hoy el modelo no lo tiene. Sin él, V65-03 resuelve un medicamento por vez |
| **D6** | **Moderación previa o reactiva** | Si una publicación se revisa antes de aparecer, cambia el flujo de F2 y F9 por completo |
| **D7** | **Qué se indexa de un perfil no verificado** | Un directorio que mezcla verificados y declarados sin jerarquía pierde su valor; excluirlos del todo lo deja vacío |

---

## Resumen

| Fase | Tareas | Bloquea a |
|---|---|---|
| F1 · Lecturas y roles | 18 | todo |
| F2 · Worker de fan-out | 8 | F3, F5, F6 |
| F3 · OpenSearch | 7 | F6 |
| F4 · Superficie pública | 7 | F6 |
| F5 · Frontend privado | 17 | — |
| F6 · Frontend público | 7 | — |
| F7 · Medios (MinIO) | 6 | F5, F6 |
| F8 · Notificaciones y tiempo real | 6 | F5 |
| F9 · Moderación | 6 | — |
| F10 · Señales | 6 | F6 |
| F11 · Pruebas y observabilidad | 7 | — |
| **Total** | **95 tareas + 7 decisiones** | |

**Lo primero que hay que hacer, en este orden** (revisado tras el cierre de F1 y F2):

1. **Resolver D1 y D2.** No son tareas: son decisiones de producto, y bloquean F1.2, F1.3, F5 y F8.
   Nadie puede escribir el decorador de rol de 17 endpoints sin saber si el paciente estrena
   `PATIENT` o entra como «sesión autenticada».
2. **F4 · superficie pública** — 0 `@Public()` hoy. Sin esto, las 12 pantallas sin sesión de V65 no
   tienen a qué llamar, y es además la mayor superficie de ataque del sistema: el rate limit por IP
   no es opcional.
3. **F5 y F6 en paralelo** — el frontend sigue en cero: 0 archivos con `community` en `src/app`.

**Lo que ya no bloquea:** F1.1 y F2.27–F2.29.

---

## Referencias

| Qué | Dónde |
|---|---|
| Especificación de la red por dentro | `SALUD/Vistas/V19 community — Vistas.md` |
| Especificación de la superficie pública | `SALUD/Vistas/V65 buscador — Vistas.md` |
| Maquetas HTML del buscador | `SALUD/Vistas/HTML/V65-buscador/` |
| Reglas de conformidad | `SALUD/Arquitectura/alovida/alovida-actor-{paciente,doctor,organizacion-medica,aseguradora}.md` |
| Actores y navegación | `SALUD/Vistas/👥 Actores y navegación.md` |
| Banco de componentes | `SALUD/Vistas/🎨 Banco de componentes.md` |
| Módulo backend | `mantra-core-health-redesa-api/src/modules/community/README.md` |
| Pendientes del backend | `mantra-core-health-redesa-api/ESTADO-Y-PENDIENTES.md` |
| Pendientes del frontend | `PENDIENTES-BACKEND.md` · `COORDINACION-AGENTES.md` |
