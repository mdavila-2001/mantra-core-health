# Reporte — P47: el catálogo completo de la farmacia

> **AVANCE: 15 / 15 — 100 %.** Modelo, API y frontend con sus pruebas dirigidas en verde. Sin prueba visual en navegador (ver «No cubierto»).

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/elegant-goodall-0wu6ci` (model, api, front)
- Peldaño de evidencia: modelo `TESTED` (patch aplicado 2× + tests del generador); API `TESTED` con integración
  real contra PostgreSQL (`mantra_p47`); frontend `TESTED` (Vitest dirigido). No se alcanza `VERIFIED`: no se
  ejercitó la pantalla en navegador contra la API levantada.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `diagram_24_pharmacy.puml`: categoría (FK **compuesta** `(pharmacy_id, categoría)`), descripción, existencias declaradas, tablas `pharmacy_product_categories` y `pharmacy_product_images`; `gen_ddl.py` aprende `<<FK, SCOPED_BY:col>>` | `python3 salud-db/gen_ddl.py 24` · `python3 -m unittest discover -s salud-db/tests` | 23 tests OK → `evidencia/model-generator-tests.txt` |
| H1.S1.M2 | Patch `2026-10-26_v4255_pharmacy_catalog.sql` idempotente (columnas, tablas, FKs, CHECK, seis categorías por farmacia existente) | `psql -v ON_ERROR_STOP=1 -f …` ×2 | exit 0 / exit 0 → `evidencia/model-patch-idempotente.txt` |
| H1.S1.M3 | Entidades regeneradas (`gen_entities.py 24` + prettier) | `yarn typecheck` | `EXIT=0` → `evidencia/api-typecheck.txt` |
| H2.S1.M1–M6 | DTO, reglas, categorías, inventario en lote, lectura `managed`, resumen | `yarn test src/modules/pharmacy src/modules/public src/modules/pharmacy_inventory` | 47 suites, 534 tests PASS → `evidencia/api-unit.txt` |
| H2.S1.M7 + H2.S2.M1 | Integración real: alta/edición con precio (numeric exacto, lista `CATALOGO`, BOB), versionado idempotente, FK compuesta rechaza categoría ajena (23503), categoría ajena por nombre 422, imagen ajena 403, archivo no-IMAGE 422, personal de B → 404 en edición/inventario/gestión/categorías, borrador y «no tengo» fuera de P31 y de lo vendible, inventario todo o nada, resumen 30 × 14.00 = 420.00, 409 al borrar categoría con productos, retiro por PATCH | `ALLOW_PERMANENT_TEST_RESIDUE=yes DB_NAME=mantra_p47 … yarn test:integration test/integration/pharmacy-catalog-p47.int-spec.ts` | 13/13 PASS → `evidencia/api-integration.txt` |
| H2.S2.M2 | OpenAPI + endpoints markdown regenerados con las herramientas del repo; README del módulo | `yarn build && node tools/openapi/generate-openapi.mjs && node tools/docs/generate-endpoint-markdown.mjs` | exit 0 |
| H3.S1.M1–M3 | Cliente sin `simulatorOnly` para categorías e inventario; extensiones del producto vacías; simulador con `stock: null` = sin conteo, `currency` y 422 como la API; inventario muestra «Sin conteo»; contrato de la maqueta regenerado | `yarn ng test --watch=false --include src/app/core/data-access/pharmacy --include src/app/features/pharmacy --include 'src/app/core/mock/**/*.spec.ts'` · `yarn typecheck` · `node scripts/gen-mock-contract.mjs <openapi> --check` | 106 archivos / 1262 tests PASS → `evidencia/front-vitest.txt`; typecheck EXIT=0; contrato «al día» |

## A medias

ninguna

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| P47 §6 carga masiva del lado del servidor | DESCARTADO (opcional en el pedido) | Decisión de producto si los catálogos de miles lo piden |
| Registro sanitario del producto | TODO | El front no lo dibuja; empieza en el modelo cuando se pida |
| Vínculo del genérico tipeado con el vademécum | TODO | El alta por `catalogProductId` ya lo resuelve; lo tipeado a mano queda sin concepto |

## Evidencia

```text
$ yarn test src/modules/pharmacy src/modules/public src/modules/pharmacy_inventory
Test Suites: 47 passed, 47 total
Tests:       534 passed, 534 total

$ yarn test:integration test/integration/pharmacy-catalog-p47.int-spec.ts   (mantra_p47)
Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
EXIT=0

$ yarn typecheck   (API)
EXIT=0

$ yarn ng test --watch=false --include …   (front)
 Test Files  106 passed (106)
      Tests  1262 passed (1262)

$ psql -f SQL/patches/2026-10-26_v4255_pharmacy_catalog.sql   ×2
aplicación 1: exit 0
aplicación 2: exit 0
```

Primera corrida de integración (`evidencia/api-integration-run1-deadlock.txt`): el alta colgó 180 s. Causa
demostrada: el `SELECT … FOR UPDATE` de la farmacia y los SQL crudos del repositorio corrían en otra conexión del
pool (sin `em.getTransactionContext()`), esperando la `FOR KEY SHARE` que la propia transacción había tomado al
insertar el producto. Corregido pasando el contexto de transacción; corrida siguiente verde. Una corrida intermedia
falló sólo en la limpieza: `pharmacy_product_prices_history` es append-only y retiene por FK; la prueba ahora usa el
guard de residuo permanente, como la de contabilidad.

### Tras el merge con la rama compartida (08:xx)

```text
$ yarn ng test --watch=false --include … (front, tras merge con P34/P37/otros)
 Test Files  1 failed | 107 passed (108)
      Tests  1 failed | 1293 passed (1294)
 FAIL src/app/core/mock/handlers/received-services.handlers.spec.ts > … > un paciente no lee los servicios de otro
$ yarn typecheck (front)  → EXIT=0
$ yarn build (front, aparte del hook por memoria) → EXIT=0 ; push con SALTAR_BUILD=1
$ yarn test src/modules/pharmacy src/modules/public src/modules/pharmacy_inventory (API tras merge) → 51 suites, 601 tests PASS
```

El fallo de `received-services.handlers.spec.ts` no es de P47 (archivo de «Servicios recibidos», commit
`bdec2a69d`, no tocado aquí). Varias corridas de `ng test` murieron con SIGHUP (exit 129, esbuild «all goroutines are
asleep») al heredar la sesión; con `setsid` corrió completo.

## Seguridad (regla 90.6) — hallazgos MEDIUM del revisor

1. **Categoría de otra farmacia.** Amenaza: colgar a un producto la categoría de otra farmacia (FK simple).
   Control: UNIQUE `(pharmacy_id, id)` en categorías y FK compuesta `(pharmacy_id, pharmacy_product_category_id)`
   emitida por el generador (`SCOPED_BY`, `gen_ddl.py`) más resolución por nombre sólo entre las de la farmacia
   (`PharmacyCategoriesService.resolveByName`). Tests: integración «la base rechaza … (FK compuesta)» → `23503`
   `fk_pharmacy_products_pharmacy_product_category_id`; «un nombre ajeno es 422». Resultado: PASS.
2. **Imagen de un archivo ajeno.** Amenaza: referenciar un `common.files` de otro. Control:
   `AttachableFileService.assertUsableBy` (vivo, versión vigente, MIME de imagen, **subido por quien edita**) +
   categoría `IMAGE`, en `PharmacyProductsService.replaceImages`. Tests: integración «imagen subida por el personal
   de OTRA farmacia (403) y no cambia nada», «archivo propio no-IMAGE 422»; unitarios equivalentes. Resultado: PASS.
   Riesgo residual: una imagen ya colgada se conserva aunque la haya subido otra persona del mismo personal (se
   valida al colgarla).
3. Autorización por propiedad: el personal entra por `PHARMACY_STAFF` (membresía en un tenant `PHARMACY`) y
   `PharmacyTenantScopeGuard` + `requireManagedPharmacy` lo acotan; test negativo de integración con el personal de B.

## Dinero (regla 91)

Importe como texto decimal validado por expresión (nunca aritmética de coma flotante), `numeric` en base y moneda
`BOB` en la lista; versionado append-only con supersesión (sin `UPDATE` de importes); el mismo importe no versiona
(reintento idempotente); el valor del inventario se suma en centavos `bigint`. No hay movimiento de fondos: es precio
de catálogo, sin asientos.

## P31 (`GET /public/profiles/f/:slug/products`)

Queda servible con esto: precio de la lista `CATALOGO` (o la menor pública), borradores excluidos por estado e
`inStock` = declaración del catálogo («no tengo» manda) y, si la farmacia lleva ledger de existencias, lo disponible
del ledger; sin ledger vale la declaración. Antes todo producto sin ledger salía «sin stock».

## No cubierto

- Prueba visual en navegador (portal de la farmacia contra la API real, tres viewports, dos temas): no se levantó
  `ng serve` ni la API (máquina compartida por 12 agentes). La UI cambió poco (placeholder «Sin conteo», tolerancia
  a `stock: null`), pero no se observó.
- Las rutas nuevas no se ejercitaron por HTTP (guards + `ValidationPipe`); la integración llama a los servicios
  reales. Los guards son los ya existentes del controller; el DTO se probó con el `ValidationPipe` real (unitario).
- `recentActivity`: la consulta a `audit.audit_log` corrió en integración pero sin filas (la integración no pasa por
  el interceptor que sella).
- `gen_ddl.py all` y `yarn orm:catalog` producen en este workspace ruido ajeno (comentarios «inferida», orden y
  borrados en ~30 módulos); se revirtió todo salvo el módulo 24 y no se regeneraron `SQL/_generation_report.md` ni
  `src/orm/catalog/`. Regenerarlos en un checkout completo.
- `yarn db:vendor` no corre aquí (falta `rsync`): se copiaron a `database/SQL` los cuatro archivos del módulo 24 y
  el patch; `check_ddl_sources.py` dio «OK».

## Desvíos del plan

- El DoD de H1 decía `gen_ddl.py all` sin diff inesperado: se usó `gen_ddl.py 24` por el ruido descrito.
- Se agregó la FK compuesta y el control de dueño de las imágenes (pedido del revisor de seguridad).
- La integración deja residuo sintético marcado `P47-*` en `mantra_p47` (historial de precios append-only).

## Riesgos residuales

- P50 (registro de farmacia) puede crear farmacias por otro camino que `PharmaciesService.createPharmacy`: esas no
  reciben las seis categorías de partida (llamar `PharmacyCategoriesService.provisionDefaults`).
- `openapi/` regenerado incluye deriva previa de `dev` en otros módulos (terminology, practice): refleja el código
  actual, no son cambios de P47.

## Decisiones y ambigüedades (tomadas sin confirmación; confirmar con el dueño del producto)

- D1 Estado: concepto nuevo `PHARM_PRODUCT_DRAFT` en `status_concept_id` (no una segunda columna).
- D2 Categoría por nombre, 422 si no es de la farmacia; seis de partida del mockup (catálogo interno).
- D3 Existencias: declaración del catálogo, NULL = «sin conteo»; no se toca el ledger. Descartado el «100» del simulador.
- D4 Precio en la lista pública `CATALOGO` (BOB), versionado; descartada una columna de precio en el producto.
- D5 Imágenes: hasta 3, sólo archivos IMAGE subidos por quien edita.
- D6 Actividad reciente desde `audit.audit_log`, sin tabla nueva.
- D7 Inventario en lote: 422 por línea semánticamente inválida; 400 por forma.
- `DELETE` de un borrador ahora retira (antes exigía ACTIVE); un retirado sigue siendo 422.
