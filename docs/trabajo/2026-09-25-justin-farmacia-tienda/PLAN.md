# Plan — La tienda: buscador por precio y distancia, y la receta completa al carrito

- Fecha: 2026-09-25 · Repo: `alovida/mantra-core-health` (frontend Angular 21) · Predecesor: Ola 0 de Pablo
- Rama: `justin/farmacia-tienda-y-receta-2026-09-25` · Worktree: `wt-justin-farmacia-tienda`
- **Corte fijado:** `4ba17b1ad415061edf1a3f2a4425a26b687a9249` = `origin/mockup` @ `bf2c3545`
  (PR #660) **+ cherry-pick de `84a587d8`** (Ola 0 de Pablo, PR #671 abierto contra `mockup`).
  Desvío declarado sobre H1.S1.M1: la Ola 0 de Pablo **no está mergeada** y la de Marcelo
  **no existe**; se trabaja sobre el cherry-pick, que desaparece del diff cuando #671 mergee.
- Resultado observable: el paciente entra a `/my-account/pharmacy` y ve **la tienda** (sin
  pestañas): busca «paracetamol», ordena por más barato o más cerca, agrega al carrito, y desde
  una receta suya vuelca los medicamentos enteros al carrito de una sede.
- Kill-test: `/my-account/pharmacy` con pestañas → H3 no está hecho. Una fila con precio que
  `availability()` no devolvió → H2 no está hecho. «Agregar la receta al carrito» que no deja
  el carrito con los medicamentos → H5 no está hecho.

## Alcance

- **IN:** baseline · `PharmacySearchService` (2 modos × 2 órdenes) · `store-front` ·
  `search/product-results` · `search/store-results` · `store-front/recent-orders` ·
  `prescriptions/prescriptions-page` · botón «Agregar la receta al carrito» en `where-to-buy` ·
  las 2 entradas de `app.routes.ts` · specs · `PLAN.md`, `REPORTE.md`, `evidencia/`.
- **OUT:** `core/data-access/pharmacy-cart/**`, `pharmacy.routes.ts`, `pharmacy.testids.ts`,
  `cart/**`, `shell-layout/**`, `core/navigation/**`, `pharmacy-hub/**` (Pablo) ·
  `core/data-access/pharmacy/**`, `core/mock/handlers/pharmacy.handlers.ts` (Marcelo) ·
  `features/account/pharmacy/store/**` (Itzan) · `features/account/cotizaciones/**` (se lee,
  no se toca ni para reusar) · `features/nearby-places/search-origin-picker/**` (se importa) ·
  cualquier backend · convertir monedas · inventar una receta o un precio.

### Ambigüedades registradas (§5 del prompt, tomadas tal cual)

| ID | Supuesto tomado | A quién confirmar |
|---|---|---|
| Q-J1 | En modo Farmacias sin término no se ordena por precio: por distancia (con origen) o por nombre. El «desde X» sólo existe con término. | Justin (propietario) |
| Q-J2 | Farmacias con `productCount === 0` no se listan. | Justin |
| Q-J3 | Al carrito va **sólo lo disponible** de esa sede; lo faltante se avisa por nombre. | Justin + Pablo |
| Q-J4 | «Receta vigente» = mismo criterio que la historia clínica (`medical-record.ts`): se lee el resumen con tope 50 y se calca, sin filtrar por `validTo`. | Justin |
| Q-J5 | `CartStore` **no tiene `toDraft`** en el cherry-pick de Pablo. Se simula su contrato (regla 65) y el caso se verifica contra `createOrderRequest(borradorDePedido(...))` en mi propio spec. | Pablo |

### Desvíos de entorno declarados (límite de recursos de esta sesión)

Hay 3 agentes más corriendo en paralelo: **prohibido** `yarn test` completo, `yarn build`,
`yarn start`, Playwright y cualquier servidor. Consecuencias que se declaran, no se disfrazan:

- Los DoD que decían `corepack yarn build` se sustituyen por `corepack yarn typecheck`, que
  compila las mismas rutas (`tsconfig.app.json`) sin levantar el bundler. Se declara el desvío.
- **Las microtareas de captura (H3.S1.M6, H4.S1.M5 parcial, H5.S2.M2) quedan `BLOQUEADO`**:
  exigen navegador. La prueba visual de este carril está **explícitamente no cubierta**.
- El baseline de `test` no se corre entero; se corren specs **dirigidos** con `--include`.

## Baseline (H1) — rojos previos clasificados

| Fuente | Resultado | Clase | ¿Mío? |
|---|---|---|---|
| `corepack yarn typecheck` | **exit 0**, sin errores | — | no aplica |
| `corepack yarn lint` | **exit 1 · 6 errores** | preexistentes | no |
| `playwright/auditoria-qa-mockup.spec.ts:1,17,18` | `no-unused-vars`, `array-type` ×2 | `TEST_BUG` preexistente | no |
| `playwright/carril-insurance-whatsapp.spec.ts:70` | `no-unused-vars` | `TEST_BUG` preexistente | no |
| `insurance-contact-channels.spec.ts:135` | `no-empty-function` | `TEST_BUG` preexistente | no |
| `patient-coverage-card.spec.ts:114` | `no-empty-function` | `TEST_BUG` preexistente | no |

Ninguno toca archivos de mi alcance. Nota de entorno: `yarn typecheck` falla con
`Cannot find module env.generated` en un árbol recién clonado; se destraba con
`node scripts/generate-env.mjs` (ya lo hace `yarn test`/`yarn build`, no `yarn typecheck`).

## H1 — Corte y baseline

**CA:** Dado el entorno, cuando alguien pregunta contra qué versión se trabajó y qué estaba en
rojo antes, entonces hay SHA, salidas y una tabla de rojos clasificados.
**DoD:** salidas con exit code en `evidencia/antes/`; rojos clasificados arriba.
**Estado:** HECHO

### H1.S1 — Corte, rama y baseline

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Fijar corte y rama | Hay SHA | `git rev-parse HEAD` | A MEDIAS — hay SHA, pero NO es posterior a los merges: la Ola 0 entró por cherry-pick de `84a587d8` (PR #671 abierto) y Marcelo no publicó |
| H1.S1.M2 | Baseline de `lint` y `typecheck` | Hay salidas y exit codes | `evidencia/antes/` | A MEDIAS — `lint` y `typecheck` con exit code pegados; el baseline de `test` completo NO se corrió (prohibido por límite de recursos) |
| H1.S1.M3 | Clasificar cada rojo previo | Cada uno con su clase | tabla en `PLAN.md` | HECHO |

## H2 — El servicio de búsqueda

**CA:** Dado un término y un origen, cuando se busca en modo Productos, cada fila trae
`productId, name, presentation, pharmacyId, pharmacyName, siteId, siteName, unitAmount,
currency, distanceKm, requiresPrescription, medicationConceptId`, ordenada por precio (sin
precio al final) o por distancia (sin origen: aviso, sin reordenar); en modo Farmacias, cada
sede trae `distanceKm` y, con término, `fromAmount`.
**DoD:** `pharmacy-search.service.spec.ts` ≥ 8 casos con `HttpTestingController`.
**Estado:** HECHO — 22/22 en verde, `evidencia/h2/spec-servicio.txt`

### H2.S1 — `PharmacySearchService`

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | `pharmacy-search.types.ts` con `ProductHit`, `StoreHit`, `SearchMode`, `SearchSort`, `SearchResult<T>` | Compila con esos nombres | `corepack yarn typecheck` | HECHO |
| H2.S1.M2 | `searchProducts(term, origin, sort)` = `searchProducts` → `availability` → una fila por `(productId, siteId)` | 2 productos × 2 sedes = 4 filas con precio | spec | HECHO |
| H2.S1.M3 | `searchStores(term, origin, sort)` = `nearbySites` + `availability` para `fromAmount` | Con término, cada sede trae «desde» | spec | HECHO |
| H2.S1.M4 | `sortByPrice`, `sortByDistance`, `normalizeTerm` puras exportadas | 3 casos cada una | spec | HECHO |
| H2.S1.M5 | Sin origen + orden `distance`: no reordena, `sinOrigen = true` | El spec lo fija | spec | HECHO |
| H2.S1.M6 | Término de menos de 2 letras: no consulta | `expectNone` | spec | HECHO |

## H3 — La home de la tienda

**CA:** Dado `/my-account/pharmacy`, el paciente ve una tarjeta a lo ancho con buscador, modo,
orden, origen, «Buscar toda una receta», «Mis pedidos» y «Tus últimos pedidos»; sin pestañas.
**DoD:** specs de home, resultados por producto, por farmacia y últimos pedidos (≥ 22 casos);
capturas 375 · 768 · 1440 claro + 1440 oscuro; `?tab=` redirigen.
**Estado:** A MEDIAS — specs 31/31 en verde; capturas BLOQUEADAS (navegador prohibido)

### H3.S1 — La pantalla

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | `store-front.{ts,html,css}` con `PageHeader` y tarjeta a lo ancho | Se pinta sin pestañas | spec | HECHO |
| H3.S1.M2 | Buscador, modo, orden y origen como signals que alimentan el servicio | Cambiar cualquiera recalcula | spec | HECHO |
| H3.S1.M3 | «Buscar toda una receta» → `PHARMACY_PRESCRIPTIONS_ROUTE` y «Mis pedidos» → `MIS_PEDIDOS_ROUTE` | Los dos enlaces existen | spec | HECHO |
| H3.S1.M4 | Los seis estados (S3 sin término, lista sin término en Farmacias, loading, empty, error, sin origen) | Los seis visibles | spec | HECHO |
| H3.S1.M5 | Sin perfil de paciente: aviso, sin consultas | `expectNone` | spec | HECHO |
| H3.S1.M6 | Capturas 375 · 768 · 1440 claro + 1440 oscuro | Cuatro capturas miradas | `evidencia/h3/capturas/` | BLOQUEADO (navegador prohibido en esta sesión) |

### H3.S2 — Resultados por producto

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S2.M1 | `product-results.{ts,html,css}`: nombre + presentación · farmacia/sede · precio o «Precio no publicado» · distancia o «Elegí desde dónde medir» · acciones | Se pintan las 4 partes | spec | HECHO |
| H3.S2.M2 | «Agregar» → `CartStore.add`; `conflict` → confirm → `replaceWith` | Agregar suma; cancelar no cambia | spec (3 casos) | HECHO |
| H3.S2.M3 | `requiresPrescription` → insignia + enlace, sin «Agregar» | No hay botón en esa fila | spec | HECHO |
| H3.S2.M4 | «Ver tienda» → `pharmacyStoreRoute` | `href` correcto | spec | HECHO |

### H3.S3 — Resultados por farmacia

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S3.M1 | `store-results.{ts,html,css}`: farmacia · sede · dirección · distancia · «desde X Bs» · «Entrar» | Se pinta | spec | HECHO |
| H3.S3.M2 | Orden respeta `sort`; sin origen y `distance` → aviso | El spec lo fija | spec | HECHO |
| H3.S3.M3 | Farmacias con `productCount === 0` no se listan | Filtradas | spec | HECHO |

### H3.S4 — Tus últimos pedidos

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S4.M1 | `recent-orders.{ts,html,spec.ts}` con `misPedidos()` y `pedido-status.ts` | 3 filas máximo | spec | HECHO |
| H3.S4.M2 | Vacío = una línea con enlace; sin perfil = no consulta | `expectNone` | spec | HECHO |

### H3.S5 — La ruta y las redirecciones heredadas

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S5.M1 | `'my-account/pharmacy'` → `StoreFront` en `PANTALLAS_DIFERIDAS` | La ruta abre la home | `corepack yarn typecheck` (desvío de `build`) | HECHO — `app.routes.spec.ts` 53/53 + `typecheck` 0 |
| H3.S5.M2 | Redirecciones de `?tab=` en `StoreFront` (`replaceUrl`) | Las dos redirigen | spec (2 casos) | HECHO |
| H3.S5.M3 | Fila **PUBLICADO** en §4-bis del daily de equipo | Pablo puede leerla | lectura | A MEDIAS (se publica en el cuerpo del PR; no hay daily en este worktree) |

## H4 — Elegir receta

**CA:** Dado `/my-account/pharmacy/prescriptions`, el paciente ve una tarjeta por receta
vigente con «Buscar dónde comprarla» → `where-to-buy/:requestId`; sin recetas, S3; sin perfil,
aviso.
**DoD:** `prescriptions-page.spec.ts` ≥ 6 casos; capturas 375/1440.
**Estado:** TODO

### H4.S1 — La pantalla

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | `prescriptions-page.{ts,html,css}` con `getSummary(perfil, 50)` y agrupación por `encounterId` | Una tarjeta por receta | spec | HECHO |
| H4.S1.M2 | Nombres con `TerminologyClient` (mismo camino que `where-to-buy.ts`) | Se ve el nombre, no el uuid | spec | HECHO |
| H4.S1.M3 | «Buscar dónde comprarla» → `/my-account/medical-record/where-to-buy/<id>` | `href` con el id | spec | HECHO |
| H4.S1.M4 | Estados: loading, S3 sin recetas, error con reintento, sin perfil | Los cuatro | spec | HECHO |
| H4.S1.M5 | Entrada hija en `app.routes.ts`; capturas 375/1440 | La ruta abre; dos capturas | `typecheck`; `evidencia/h4/capturas/` | A MEDIAS — ruta verificada con `app.routes.spec.ts` 53/53; las dos capturas NO existen |

## H5 — La receta entra al carrito

**CA:** Dado `where-to-buy/:requestId` con una sede evaluada, «Agregar la receta al carrito»
deja el carrito con las líneas disponibles de esa sede y `requestId`; las sin producto se
listan como «no se pudieron agregar»; con carrito de otra sede se confirma; después navega al
carrito. «Pedir» sigue igual.
**DoD:** `where-to-buy.spec.ts` ampliado (casos actuales intactos) + caso de
`medicationRequestId`.
**Estado:** TODO

### H5.S1 — El botón en `where-to-buy`

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H5.S1.M1 | `cartLinesFromDraft(borrador)` pura exportada | Omite sin producto y sin stock | spec (2 casos) | HECHO |
| H5.S1.M2 | Botón `where-to-buy-add-to-cart` por sede con `replaceWith` y confirm | Cancelar no cambia; confirmar reemplaza | spec (2 casos) | HECHO |
| H5.S1.M3 | Aviso «N medicamentos no se pudieron agregar» y navegación al carrito | El aviso y la navegación | spec | HECHO |
| H5.S1.M4 | Los casos existentes de `where-to-buy.spec.ts` siguen en verde | Mismo conteo que el baseline | spec dirigido | HECHO |

### H5.S2 — El pedido lleva la receta

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H5.S2.M1 | Spec: `createOrderRequest(...).medicationRequestId === requestId` | En verde | spec dirigido | HECHO |
| H5.S2.M2 | Recorrido manual: receta → carrito → continuar; captura | Mirada | `evidencia/h5/capturas/` | BLOQUEADO (navegador prohibido en esta sesión) |

## H6 — Regresión y cierre

**CA:** `typecheck` y `lint` sin rojos nuevos, PR mergeable y `REPORTE.md` con el avance en la
primera línea.
**DoD:** salidas pegadas; peldaño por área.
**Estado:** TODO

### H6.S1 — Cierre honesto

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H6.S1.M1 | Regresión + e2e del área | Sin rojos nuevos | `typecheck`, `lint`, specs dirigidos | A MEDIAS (suite completa, build y Playwright prohibidos en esta sesión) |
| H6.S1.M2 | PR a `mockup` mergeable | `gh pr view` sin conflictos | `gh pr view --json mergeable,mergeStateStatus` | HECHO — PR #675, mergeable=MERGEABLE (checks en curso al cierre) |
| H6.S1.M3 | `REPORTE.md` al día; nada corriendo | Existe y cumple | `git status` | HECHO |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Un precio sin `availability()` detrás | Alto (regla dura del carril) | El precio de `ProductHit` **sólo** se construye desde `AvailabilityProduct.price`; `PharmacyProduct` no aporta ninguno |
| Ordenar por distancia sin origen | Alto | `SearchResult.sinOrigen` y `sortByDistance` que no reordena sin origen |
| `CartStore.toDraft` no existe | Medio | Simulado por contrato (regla 65): el spec va contra `createOrderRequest(borradorDePedido(...))` |
| Ola 0 de Pablo sin mergear | Medio | Cherry-pick de `84a587d8`; el diff se disuelve cuando #671 mergee |
| Prueba visual imposible en esta sesión | Alto | Declarada **no cubierta**; las microtareas quedan `BLOQUEADO`, no `HECHO` |
