# Reporte — Pasada final de integración de la noche de pendientes P

> **AVANCE: 16 / 19 — 84,2 %.** En rojo y heredado de `dev` (no de esta noche): `audit-trail-coverage.spec.ts` por `POST /iam/users/search`, `identity-verification-cycle.int-spec.ts` (9/11) y los tres inventarios `--verificar` de la API. Suite completa del front: BLOQUEADA por memoria (se corrieron completos los 76 specs que tocó la noche).

- Fecha: 2026-10-26 · Rama: `claude/elegant-goodall-0wu6ci` en modelo, API y front · Base: `mantra_final` (clon de `mantra_base` + los seis patches de la noche)
- Peldaño: modelo `TESTED` · API `TESTED` (unitarios + integración contra PostgreSQL real) · front `RUNS` + specs dirigidos (`TESTED` sólo en lo que tocó la noche)
- Evidencia: `evidencia/pasada-final/` (esta carpeta). Las capturas de la pasada visual están en `evidencia/visual/` y son de otro agente.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| M1 | Número de versión de los patches: **no se renumera**. Nada lo lee: `init-postgres.sh` aplica `SQL/patches/*.sql` por orden de nombre, no hay tabla de versiones ni chequeo en `salud-db/`, `check_*`, `model-manifest.yaml` ni `scripts/db/`; y el repositorio ya tiene versiones repetidas (`v4249` ×6, `v4240`, `v4242`…). Los tres `v4252` aplican bien en orden de nombre | `grep` en modelo y API (ver Decisiones) | PASS |
| M2 | Los seis patches del 2026-10-26 aplicados dos veces sobre `mantra_final`, en orden de nombre, con `ON_ERROR_STOP=1` | `psql -v ON_ERROR_STOP=1 -f …` ×2 | 12/12 exit 0 (`t1-patches.txt`) |
| M3 | Pruebas del modelo y fuentes de DDL | `python3 -m unittest discover -s salud-db/tests` · `python3 salud-db/check_ddl_sources.py` | 23 OK · «Fuentes de DDL OK» |
| M4 | `database/SQL` y `database/NoSQL` de la API iguales al modelo de la rama, blob por blob (440 archivos SQL) | `git ls-tree` comparado; `rsync --checksum -ni` | 0 diferencias de contenido (`t2-vendor.txt`) |
| M5 | OpenAPI y referencia de endpoints regenerados sobre la rama combinada (con P51 y el merge de `dev`): **sin diferencias** con lo versionado | `yarn docs:openapi:generate` (incluye `yarn build`) · `yarn docs:endpoints:generate` | exit 0, árbol limpio (`t8-openapi-final.txt`) |
| M6 | Catálogo ORM con el delta de la noche: `pharmacy_on_call_shifts` (P34), categorías e imágenes de producto (P47), FK e índice de `pharmacies.primary_practice_site_id` (P50), `clinical.service_request_notes` (P40) — 16 FK y 22 índices | `yarn orm:catalog` sobre bóveda descartable (ver Decisiones) | API `6082de21`; `yarn test src/orm` 54/54 |
| M8 | Typecheck API | `NODE_OPTIONS=--max-old-space-size=6144 heavy.sh yarn typecheck` | exit 0 |
| M9 | Lint global API: un error nuevo de P47 (`no-unnecessary-type-assertion` en `pharmacy-read.repository.ts`) corregido | `heavy.sh yarn lint` | exit 0 (API `f4aded74`) |
| M10 | Build API | dentro de `yarn docs:openapi:generate` | exit 0 |
| M12 | Integraciones nuevas de la noche contra `mantra_final`, una por una (15 archivos) | `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1 … yarn test:integration <archivo> --testTimeout=900000` | 15/15 en verde (las que dejan bitácora WORM con `ALLOW_PERMANENT_TEST_RESIDUE=yes`) — `api-integracion-resumen.txt` |
| M13 | Siembra de formularios clínicos reanudable (defecto previo) | ver «Evidencia» | API `aabeaa91`; unit 26/26; integración 3/3 |
| M14 | Front: `generate-env` + `generate-component-index`, typecheck, lint y build de producción tras el merge de `dev` | `yarn typecheck` · `yarn lint` · `heavy.sh yarn build` | exit 0 los tres |
| M16 | Planes y reportes fuera de la API: `docs/trabajo/2026-10-26-p*` (P23, P28, P29, P34, P37, P39, P40, P47, P50, P51) pasan al front con su nombre de carpeta; reportes de P36 y P44 escritos | `git rm` en API, copia al front | API `8799d401` · front `9cbe4bb31` |
| M17 | Anexo del punto 6 de P51 al final de su REPORTE.md | `cat >>` | front `a8dec6a3f` |
| M18 | La verificación de identidad institucional (`verifyTenant`) evalúa los requisitos para operar: una farmacia o laboratorio PENDIENTE sin papeles sigue PENDIENTE, sin sello, con el motivo en el log; el caso de verificación se cierra igual | unit 14/14 · `tenant-external-verification-requirements.int-spec.ts` | API `caee44a6`; sin el cambio la integración falla (queda ACTIVO), con el cambio pasa |
| M19 | P51 traído antes del último push; typecheck y OpenAPI repetidos sobre la rama final | `git fetch/merge` + M5/M8 | sin diferencias |

Arreglos que aparecieron en los gates (todos de esta noche, no de `dev`):

- API `37d25194` — `POST /public/profiles/f/:slug/branch-availability` (P37) sin `@NotAudited`: rompía `audit-trail-coverage.spec.ts`.
- Front `84cd1a122` — `specialty-form-block.spec.ts` seguía esperando las filas aplanadas en `objectiveText`; P39 las manda como `entries`.
- Front `1858a0682` — `contract-drift.spec.ts` (C6, C1, C2) seguía afirmando el contrato anterior a P39/P47; su fallo dejaba el `TestBed` roto y arrastraba otros 11 casos. Ahora afirma el cuerpo completo y el validador del contrato generado lo acepta. En `origin/dev` ese archivo pasaba 15/15 (`t6-front-contract-drift-DEV.txt`).
- `received-services.handlers.spec.ts` (caso conocido de P47): **pasa** en la rama final.

## A medias

### M11 — Unitarios de los módulos tocados
- Qué anda: 445 de 446 suites, 5 682 de 5 683 pruebas (billing, chart, clinical, common, diagnostic_units, diagnostics, directory, iam, identity_assurance, orm, pharmacy, pharmacy_inventory, practice, profiles, public, scheduling).
- Qué no anda: `src/common/audit-trail/audit-trail-coverage.spec.ts` — `POST /iam/users/search (IamUsersController.searchUsersByBody)` no declara `@Audited` ni `@NotAudited`.
- Qué falta exactamente: decidir si esa búsqueda de usuarios (lee datos de personas) lleva `@AccessLogged`/`@Audited` o `@NotAudited` con motivo. No se tocó: la ruta entró por `dev` (`613d0969`) y la decisión es de quien la escribió. Rojo también en `origin/dev` actual (`t8-audit-coverage-DEV.txt`).
- Dónde quedó: sin cambios; rama `claude/elegant-goodall-0wu6ci` de la API compila.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| M7 | TODO | Inventario de la API (`yarn inventario:verificar`): rojo en la rama y **también en `origin/dev`** (endpoints 31, flujos 18, catálogo 20 archivos). Regenerarlo arrastra cientos de cambios ajenos a la noche; no se mezclaron. Regenerarlo sobre `dev` en un PR propio. |
| M15 | BLOQUEADO (ENVIRONMENT) | Suite completa del front (`yarn test`): el proceso crece a ~9 GB y el control de memoria del contenedor lo mata (`dmesg`: `Memory cgroup out of memory: Killed process … ng test`), sola o con 2 y 1 hilos. Se corrieron en lotes los 76 specs que la noche tocó: 2 017/2 017 en verde (`t6-front-lotes.txt`). Destraba: una máquina con más memoria o CI. |

## Evidencia

```text
$ psql -v ON_ERROR_STOP=1 -f SQL/patches/2026-10-26_*.sql   (dos pasadas, orden de nombre)
##### PASADA 1 … 6 × exit=0
##### PASADA 2 … 6 × exit=0

$ python3 -m unittest discover -s salud-db/tests
Ran 23 tests … OK

$ yarn test:integration clinical-forms-seed-idempotency  (mantra_fseed, sin el arreglo)
UniqueConstraintViolationException: duplicate key value violates unique constraint "pk_dynamic_field_sections"
Tests:       1 failed, 2 passed, 3 total
$ … con el arreglo
Tests:       3 passed, 3 total

$ yarn test:integration tenant-external-verification-requirements  (sin el arreglo)
Expected: "<TENANT_PENDING>"  Received: "<TENANT_ACTIVE>"   Tests: 1 failed
$ … con el arreglo
"reason":"pharmacy-not-ready","missing":["CONSTITUTION_DOC","TAX_IDENTIFIER_DOC",…]   Tests: 1 passed

$ yarn test <16 módulos> (API)
Test Suites: 1 failed, 445 passed, 446 total
Tests:       1 failed, 5682 passed, 5683 total     ← audit-trail-coverage, ruta de dev

$ yarn ng test --include <lotes de 10 de los 76 specs de la noche> (front)
8 lotes · 2017 passed
```

Índice de `evidencia/pasada-final/`: `t1-*` (modelo), `t2-vendor.txt`, `t3-*` (derivados, delta de catálogo y los dos scripts usados), `t5-*` (siembra), `b-*` (verificación externa), `t6-*` (front), `t8-*` (gates finales API), `api-integracion-resumen.txt`, `*-DEV.txt` (las mismas pruebas sobre `origin/dev`).

## No cubierto

- Suite completa del front en una sola corrida (ver M15). Los specs no tocados por la noche corrieron sólo dentro del build/typecheck, no como pruebas.
- Prueba visual: no es de esta pasada (la hizo otro agente; `evidencia/visual/`).
- `identity-verification-cycle.int-spec.ts`: 9/11 en rojo en la rama **y** con el código de `origin/dev` sobre la misma base (`api-identity-verification-cycle-DEV.txt`: mismos 422/400 al abrir el caso). Preexistente; no se diagnosticó.
- La integración de la verificación externa cubre la farmacia sin papeles; el laboratorio sin papeles y el «con papeles se activa» quedan cubiertos sólo por unitarios.
- Regeneración de `SQL/` desde los `.puml` en este entorno no reproduce el DDL versionado (ni en la rama ni en `origin/dev`): la bóveda local está en `main` y no resuelve los mismos destinos de FK. El contenido de la noche sí se reproduce igual (`t1-regen-vs-dev-regen.diff`); `_generation_report.md` quedó con recuentos de una regeneración parcial y no se tocó a mano.
- `yarn db:vendor:check` da exit 1 sólo por fechas de archivo (rsync sin `--checksum` en un checkout recién hecho); el contenido es idéntico (M4).
- Primer arranque de la app contra una base nueva: ~24 min sembrando formularios (un flush por campo sobre un único EntityManager). Con `--testTimeout=900000` la primera integración se corta en plena siembra; desde el arreglo M13 el arranque siguiente la retoma sin error (es lo que pasó en esta corrida).

## Desvíos del plan

- La tarea 5 se adelantó a la 4: las integraciones arrancan la app una vez por archivo y, con la siembra no reanudable, cada corte obligaba a re-clonar la base.
- Las integraciones con bitácora WORM (`laboratory-registration`, `pharmacy-catalog-p47`, `pharmacy-registration`) se re-corrieron con `ALLOW_PERMANENT_TEST_RESIDUE=yes`: su guarda rechaza bases cuyo nombre no dice «test/tmp…». `mantra_final` es propia y descartable.
- OpenAPI se generó con `SEED_ON_BOOT=false` contra una base ya sembrada (`mantra_fseed`): el documento no depende de la siembra.
- Frente a la falta de memoria se usó, fuera de git, una configuración de Vitest con menos hilos; se borró y la corrida final de los lotes usa la del repositorio (`yarn ng test --include …`).

## Riesgos residuales

- La FK compuesta `pharmacy_products (pharmacy_id, pharmacy_product_category_id)` figura en el catálogo ORM como FK de una columna (el formato del catálogo no admite compuestas). Con `ORM_SCHEMA_SYNC=off` no tiene efecto; con `safe` sobre una base sin el DDL del modelo crearía la simple.
- La FK y los índices de `pharmacy_products.catalog_product_concept_id` (v4.2.32, de `dev`) faltan en el catálogo ORM desde antes; no se agregaron por no ser de esta noche.
- La siembra de formularios sigue siendo lenta (~24 min en base nueva).
- `verifyTenant` deja la institución pendiente sin aviso al dueño más allá del log; reintentar exige la verificación de la plataforma (`POST /admin/tenants/:id/verification`) cuando complete los papeles.

## Decisiones y ambigüedades

- **Versiones de patch (tarea 1):** no se renumera. Búsqueda: `salud-db/*.py` (sólo `check_ddl_sources.py` nombra `SQL/patches/` como ubicación válida), `model-manifest.yaml` (sin referencias a versiones de patch), `scripts/db/` y `docker/db-init/init-postgres.sh` de la API (glob `*.sql` en orden de nombre, sin registro). Renumerar habría cambiado nombres que ya conocen los reportes de cada P sin ganar nada. A confirmar con el dueño del modelo si quiere una regla de unicidad.
- **Catálogo ORM (tarea 3):** el generador lee sólo la bóveda; la copia compartida está en `main` (no en `dev`) y ninguna rama de la bóveda tiene notas de las tablas de la noche. Regenerar desde ella reescribe 126–136 archivos por orden de lectura del sistema de archivos y versión de la bóveda. Camino elegido: copia descartable de la bóveda en `origin/dev`, dos corridas del generador (la segunda con notas de las tablas de la noche tomadas de los `.puml` y del DDL del modelo, `synth_vault_notes.py`) y sólo la diferencia entre ambas insertada en el catálogo versionado (`splice_catalog.py`), mismo criterio que `8cec1b61`. Alternativa descartada: escribir esas notas en la bóveda compartida (repositorio fuera de los tres de la noche). A confirmar: que alguien suba esas notas a la bóveda.
- **Siembra (tarea 5):** causa raíz probada — no es el segundo arranque en sí (sobre una siembra completa, la segunda corrida pasa: 2/2), sino una corrida cortada entre el flush de la sección y el de la plantilla. Se reusa la sección existente.
- **`verifyTenant` (pedido del orquestador):** sólo se exige al pasar de PENDIENTE a ACTIVO; un tenant ya operando o suspendido conserva el comportamiento anterior. Si faltan papeles no se marca `TENANT_VERIFIED` ni se emite el sello; el caso de identidad sí queda verificado. Alternativa descartada: hacer fallar el caso (rompía el flujo de verificación de identidad).
- **`POST /iam/users/search` sin decorador de bitácora:** no se decidió (ver M11).
