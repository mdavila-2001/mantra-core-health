# Plan — Hito 3: homologación de métodos HTTP (frontend)

- Fecha: 2026-10-01 · Repos afectados: `mantra-core-health` (este) y `mantra-core-health-api` (rama gemela con el mismo nombre; su plan vive en el repo de la API) · Predecesor: Hito 2 (este repo, PR #812, mergeado) y Hito 1 (API, PR #520, mergeado)
- Resultado observable: con `mockBackend: false` ninguna de las 7 operaciones del hito responde 404 ni 405 por culpa del verbo; el simulador registra sólo el verbo que publica la API en cada ruta; y la auditoría de rutas (`compare_mock_api.py`) imprime `Method Mismatch: 0`.
- Kill-test: `router.rutas()` del simulador todavía contiene alguno de los verbos legados, o la auditoría imprime un número distinto de 0.
- Rama: `marcelo/fix-homologacion-metodos-http` desde `origin/dev` (`2439b79f`). Reviewers: `jsaldias39`, `PabloArauzCaballero`. Orden de despliegue: la API primero.

## Los 7 desajustes, con su diagnóstico real (`origin/dev` del 2026-10-01)

| # | Mock (línea legada) | Cliente real (`core/data-access`) | API (`openapi.json` + controlador) | Diagnóstico |
|---|---|---|---|---|
| 1 | `community.handlers.ts:384` `POST /community/reactions` (el `PUT` ya está en `:385`) | `community.client.ts:329` ya usa `PUT` | `@Put('reactions')`, `@HttpCode(OK)` | línea legada duplicada; además el mock responde 201 y la API 200 |
| 2 | `medical-notes.handlers.ts:276` `POST /charts/notes/:id/versions` (el `PUT` ya está en `:275`) | `chart-notes.client.ts:90` `PUT` | `@Put(':noteId/versions')` | línea legada; la fijan 2 specs |
| 3 | `notifications.handlers.ts:209` `PATCH /notifications/preferences/me` (el `PUT` ya está en `:199`, código idéntico) | `notifications.client.ts:128` `PUT` | `@Put('preferences/me')` | bloque legado duplicado |
| 4 | `scheduling.handlers.ts:391` `POST …/payment-state` (el `PUT` ya está en `:390`) | `scheduling.client.ts:210` `PUT` | `@Put(':id/payment-state')` | línea legada |
| 5 | `admin-modules.handlers.ts:171` `PUT …/protocol-configs` (el `POST` ya está en `:175`) | `auth-providers.client.ts:95` `POST` | `@Post(':id/protocol-configs')` | bloque legado |
| 6 | `practice.handlers.ts:390` `GET /practitioners/me/sites` (queda `GET /practitioners/:id/sites`) | `practice-sites.client.ts:61` pide `/practitioners/:profileId/sites` | `@Get(':profileId/sites')` (`ParseUUIDPipe`) y `@Post('me/sites')` | ruta muerta: nadie la llama |
| 7 | `pharmacy.handlers.ts:844` `PATCH …/products/:productId` | `pharmacy.client.ts:200` `PATCH` (JSDoc: «sólo existe en el simulador», P47) | **no existía**; el PR gemelo de la API agrega `PATCH` (P47 §2) | endpoint inexistente en la API |

## Alcance

- IN: retirar los 6 verbos legados del simulador y ajustar los 2 specs que los fijaban; guard durable en `mock-backend.spec.ts`; alinear a 200 la respuesta del `PUT /community/reactions` del mock (la API publica `@HttpCode(OK)`, CA-1); contrato del cliente de farmacia (spec y documentación de qué claves persiste la API); P47 §2 en `PENDIENTES-BACKEND.md`; PLAN, REPORTE y evidencia; commit, push y PR con reviewers.
- OUT: implementación del `PATCH` en la API (vive en el PR gemelo); autorización del módulo farmacia (P47 §1); precio, stock, categoría, descripción, imágenes y borrador (P47 §3-5, exigen modelo); ocultar acciones por modo en la UI; alias `GET me/sites` en la API; poda de `CONOCIDAS` en `scripts/check-mock-vs-client.mjs`; `.env`, bases en la nube y el stack Docker `mantra-redesa`; mergear el PR.
- Decisiones del usuario (2026-10-01): el `PATCH` se implementa en la API (rama gemela); el Hito 2 ya está en `origin/dev` (PR #812) y se parte de `origin/dev` tal cual; el modo real se verifica por contrato (OpenAPI y controladores), no levantando la API.
- Ambigüedades registradas:
  1. CA-5 («0 mismatches») depende de que el PR de la API aporte el `PATCH`: con sólo este PR la auditoría da 1. La herramienta vive fuera de los repos (`C:\Users\Usuario\.gemini\...\scratch\compare_mock_api.py`); el guard versionado es la aserción nueva de `mock-backend.spec.ts`. Confirmar con Pablo.
  2. #6 se resuelve borrando la ruta muerta del simulador, no agregando un alias `me/sites` en la API (regla 00 §1: nadie la consume; el cliente usa `:profileId`). Confirmar con Pablo y Justin.
  3. El mock respondía 201 al `PUT /community/reactions` y la API responde 200. Se alinea el mock a 200 porque CA-1 pide «200 OK».
  4. **Desvío del plan aprobado:** el plan proponía proyectar `updateProduct` en modo real y fallar con un error tipado. La evidencia lo desaconseja: `publishProduct` ya manda el borrador entero con las claves del simulador y `pharmacy.types.ts` documenta que la API las rechaza con 400; la pantalla con `PATCH` (`PharmacyProducts`) sólo se monta con `mockBackend` activo (`app.routes.ts:283-286`); y proyectar obligaba a reescribir 3 specs de pantalla. H3 queda en contrato documentado y probado, sin cambio de comportamiento. En modo real la única llamada alcanzable al `PATCH` es la importación CSV (filas «actualizar»), que manda `inStock` y por eso recibirá 400 hasta que P47 §3-5 se cierre; antes recibía 404.

## H1 — El simulador registra sólo el verbo que publica la API

**CA:** Dado el backend simulado, cuando se consulta el inventario de rutas, entonces cada una de las 6 rutas tiene registrado únicamente el verbo canónico (una vez) y el legado no existe; y el `PUT /community/reactions` responde 200.
**DoD:** `yarn typecheck` 0 · `yarn lint` 0 · specs dirigidos en verde · `node scripts/check-mock-vs-client.mjs --json` sin `nuevasSinManejador` nuevas respecto del baseline · la auditoría externa ya no lista ninguno de los 6.
**Estado:** TODO

### H1.S1 — Preparación
**CA:** Dado `origin/dev`, cuando se prepara el trabajo, entonces hay rama, dependencias, plan en disco y baselines medidos antes de tocar código.
**DoD:** las cuatro microtareas en HECHO con su evidencia.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Rama desde `origin/dev` sin upstream | HEAD = `2439b79f` | `git rev-parse HEAD` → `2439b79fc65b7c8764534e25188cd254c2d512b0` (`evidencia/01-rama.txt`) | HECHO |
| H1.S1.M2 | `yarn install --immutable` | instala sin tocar el lockfile | `yarn install --immutable` → exit 0 (`evidencia/02-install.txt`) | HECHO |
| H1.S1.M3 | Escribir este PLAN antes del primer cambio de código | archivo en disco | `git status --short docs/trabajo/2026-10-01-homologacion-metodos-http/PLAN.md` → `??` (en disco antes del primer cambio de código) | HECHO |
| H1.S1.M4 | Baselines: typecheck, `check-mock-vs-client --json`, auditoría externa | auditoría = 7 mismatches | typecheck exit 0 (`evidencia/03-typecheck-baseline.txt`); `check-mock-vs-client --json`: 617 operaciones · 660 manejadores · 0 nuevas sin manejador (`04-…`); auditoría: `Method Mismatch: 7` (`05-auditoria-baseline.txt`) | HECHO |

### H1.S2 — Retirar los verbos legados
**CA:** Dado cada manejador, cuando se registra, entonces sólo queda el verbo canónico.
**DoD:** specs dirigidos verdes (ver cada fila).
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H1.S2.M1 | `community.handlers.ts`: borrar `router.post('/community/reactions', …)` | `rutas()` no tiene `POST /community/reactions` | `yarn test --watch=false --include=src/app/core/mock/mock-backend.spec.ts` verde → guard verde (`06-specs-mock-dirigidos.txt`: 6 archivos, 133 pruebas, exit 0) y rojo con el legado restaurado (`07-guard-mutacion-rojo.txt`) | HECHO |
| H1.S2.M2 | `community.handlers.ts`: `reaccionar` responde 200 (no 201) | el handler devuelve 200 | mismo spec, caso nuevo de estado → caso de estado 200 verde (`06`) y rojo con 201 (`07`) | HECHO |
| H1.S2.M3 | `medical-notes.handlers.ts`: borrar `router.post('/charts/notes/:id/versions', …)` | `rutas()` sólo con `PUT` | `…clinical.handlers.spec.ts` verde (tras M8) → `clinical.handlers.spec.ts` verde (`06`) | HECHO |
| H1.S2.M4 | `notifications.handlers.ts`: borrar el bloque `router.patch('/notifications/preferences/me', …)` | `rutas()` sólo con `GET` y `PUT` | `yarn typecheck` 0 → borrado hecho; falta `yarn typecheck` → `yarn typecheck` exit 0 (`08-typecheck.txt`) y `yarn lint` exit 0 (`09-lint.txt`) | HECHO |
| H1.S2.M5 | `scheduling.handlers.ts`: borrar `router.post('…/payment-state', marcarPago)` | `rutas()` sólo con `PUT` | `…scheduling.handlers.spec.ts` verde → `scheduling.handlers.spec.ts` verde (`06`) | HECHO |
| H1.S2.M6 | `admin-modules.handlers.ts`: borrar el bloque `router.put('…/protocol-configs', …)` | `rutas()` sólo con `POST` | `yarn typecheck` 0 → borrado hecho; falta `yarn typecheck` → `yarn typecheck` exit 0 (`08-typecheck.txt`) | HECHO |
| H1.S2.M7 | `practice.handlers.ts`: borrar el bloque `router.get('/practitioners/me/sites', …)` | `rutas()` sin `GET /practitioners/me/sites` | `…practice.handlers.spec.ts` verde → `practice.handlers.spec.ts` verde (`06`) | HECHO |
| H1.S2.M8 | `clinical.handlers.spec.ts`: la lista esperada de rutas de notas y el bucle `['PUT','POST']` pasan a la ruta canónica | el spec describe el contrato nuevo, sin aflojar ninguna aserción | `…clinical.handlers.spec.ts` verde → `clinical.handlers.spec.ts` verde (`06`); sólo se quitó la variante `POST` y se corrigió el título | HECHO |
| H1.S2.M9 | `mock-backend.spec.ts`: quitar el `POST` de «registra una sola vez» y agregar el guard de las 6 rutas y el estado 200 de reacciones | el guard falla si reaparece un verbo legado | `…mock-backend.spec.ts` verde y, con el borrado revertido en un experimento, rojo → `mock-backend.spec.ts` verde (`06`) y rojo sin los borrados (`07`) | HECHO |
| H1.S2.M10 | `pharmacy.handlers.ts`: el comentario del `PATCH` dice qué persiste la API y qué sigue siendo del simulador | comentario exacto, sin cambio de lógica | `…pharmacy.handlers.spec.ts` verde → `pharmacy.handlers.spec.ts` verde (`06`) | HECHO |

## H3 — El cliente de farmacia declara el contrato real de la edición

**CA:** Dado `PharmacyClient`, cuando edita o retira un producto, entonces usa `PATCH` y `DELETE` sobre `/pharmacies/:pharmacyId/products/:productId` (los verbos que publica la API) y su documentación dice qué claves persiste la API y cuáles son del simulador (P47).
**DoD:** `yarn typecheck` 0 · `yarn lint` 0 · `pharmacy.client.spec.ts` verde.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H3.S1.M1 | `pharmacy.client.spec.ts`: casos de contrato de `updateProduct` (`PATCH`, URL, cuerpo intacto) y `retireProduct` (`DELETE`) | los dos casos existen y pasan | `yarn test --watch=false --include=src/app/core/data-access/pharmacy/pharmacy.client.spec.ts` verde → 14 pruebas verdes, exit 0 (`11-spec-pharmacy-client.txt`); `tsc` de los 3 specs tocados exit 0 (`10-typecheck-specs-tocados.txt`) | HECHO |
| H3.S1.M2 | JSDoc de `updateProduct` y comentario de `PharmacyProductChanges` | dicen qué persiste la API (marca, genérico, concentración, empaque, receta) y que el resto lo rechaza con 400 | `yarn typecheck` 0 → `yarn typecheck` exit 0 (`08-typecheck.txt`) | HECHO |
| H3.S1.M3 | `PENDIENTES-BACKEND.md`: P47 §2 cerrado para los 5 campos; §1 y §3-6 siguen abiertos | la tabla y la sección lo dicen | `git diff` acotado a esas líneas → `git diff --stat -- PENDIENTES-BACKEND.md` → 8 inserciones, 6 borrados; sólo la fila P47 y el §2 | HECHO |

## H4 — Regresión y entrega

**CA:** Dado el árbol final, cuando se corren los gates, entonces todo pasa y el PR queda mergeable (regla 35).
**DoD:** salidas literales en `evidencia/`; `REPORTE.md` con avance en la primera línea; PR con reviewers.
**Estado:** TODO

| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H4.S1.M1 | Specs dirigidos del hito | verdes | `yarn test --watch=false --include=<spec>` para `mock-backend`, `clinical`/`pharmacy`/`practice`/`scheduling` `.handlers`, `community-gaps.handlers`, `pharmacy.client`, `pharmacy-products`, `product-dialog`, `pharmacy-import`, `notification-preferences`, `post-card`, `medical-note-block`, `chart-notes.client`, `auth-providers.client`, `scheduling.client` → 18 archivos de spec, 417 pruebas, exit 0 (`06-specs-dirigidos.txt`); el guard falla con los verbos legados restaurados (`07-guard-mutacion-rojo.txt`) | HECHO |
| H4.S1.M2 | `yarn typecheck` y `yarn lint` | exit 0 | los dos comandos → `yarn typecheck` exit 0 (`08`), `yarn lint` exit 0 (`09`), `tsc` de los 3 specs tocados exit 0 (`10`) | HECHO |
| H4.S1.M3 | Suite completa | sin fallos nuevos | `yarn test --watch=false` → 709 de 709 archivos y 9514 de 9514 pruebas aprobados, 0 errores no manejados (`14-suite-completa.txt`) | HECHO |
| H4.S1.M4 | Checks del CI a mano (el CI del front está caído) | exit 0 | `node scripts/check-architecture.mjs` · `check-api-prefixes.mjs` · `check-route-prefixes.mjs` · `check-english-identifiers.mjs` · `check-mock-vs-client.mjs --json` → `check-architecture`, `check-api-prefixes`, `check-route-prefixes` y `check-mock-vs-client` exit 0 (`13`); falta `check-english-identifiers` contra `origin/dev`, que sólo mira lo ya commiteado → los cinco exit 0; `check-english-identifiers` con `CHECK_ENGLISH_BASE=origin/dev`: «sin identificadores nuevos en castellano» (`13`, `13c`) | HECHO |
| H4.S1.M5 | Auditoría externa con las dos ramas del hito en disco | `Method Mismatch: 0` | `python …\compare_mock_api.py` → `Method Mismatch: 0`, 643 rutas del simulador y 1438 de la API (`12-auditoria-final.txt`) | HECHO |
| H4.S2.M1 | `REPORTE.md` | tres secciones y «No cubierto» | archivo en disco → `REPORTE.md` en disco, con avance en la primera línea y «No cubierto» | HECHO |
| H4.S2.M2 | Commit con rutas explícitas (nunca `git add -A`) y push | rama en `origin` | `git push -u origin marcelo/fix-homologacion-metodos-http` | TODO |
| H4.S2.M3 | PR a `dev` con `jsaldias39` y `PabloArauzCaballero` | PR abierto | `gh pr create …` | TODO |
| H4.S2.M4 | Gate mergeable | `mergeable` = `MERGEABLE`; `BLOCKED` sólo por la revisión humana | `gh pr view <n> --json number,url,isDraft,mergeable,mergeStateStatus,reviewDecision,baseRefName,headRefName` y `gh pr checks <n>` | TODO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `yarn test` muere con `TS2307` sobre `component-index.generated.ts` | falso rojo | los scripts `test`/`typecheck`/`build` ya corren `stock:generate`; si pasa igual, `yarn stock:generate` |
| Timeouts o contagio de TestBed en la suite completa | rojo intermitente | re-correr aislando con `--include`; clasificar con evidencia, nunca subir timeouts |
| `check-mock-vs-client.mjs` ya falla por entradas viejas de `CONOCIDAS` | DoD ambiguo | `--json` y comparar `nuevasSinManejador` contra el baseline; la poda es del Hito 2 |
| El pre-push corre `yarn build` y el presupuesto de bundle | lentitud | esperar; no usar `SALTAR_BUILD` |
| `GET /practitioners/me/sites` sigue respondiendo en el simulador por el comodín `:id` | ninguno: nadie lo llama | documentado; el guard compara patrones registrados, no coincidencias |
