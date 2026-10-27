# Reporte — P39: filas campo/valor de la nota médica

> **AVANCE: 10 / 10 — 100,0 %.**

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/elegant-goodall-0wu6ci` en los tres repos
- Peldaño de evidencia: modelo `RUNS` (patch aplicado a `mantra_p39`), API `TESTED` (unitarios + integración real
  contra Postgres), frontend `TESTED` (specs dirigidos con `HttpTestingController` y el simulador; sin API real desde el navegador). Sin prueba visual en navegador (no hubo cambio de plantilla).

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `entries_json : jsonb` en `diagram_15_chart.puml`; `gen_ddl.py 15` sólo agrega la columna en `SQL/15_chart/02_tables.sql` | `python3 salud-db/gen_ddl.py 15` + `git diff SQL/15_chart` | PASS — `evidencia/01-modelo-patch.txt` |
| H1.S1.M2 | Patch `2026-10-26_v4252_chart_note_entries.sql` idempotente; columnas 19 → 20 | `psql -v ON_ERROR_STOP=1 -f …` ×2 | PASS — 2.ª corrida `NOTICE … skipping`, exit 0 |
| H1.S2.M1 | Entidad `ClinicalNoteVersions.entriesJson` regenerada (`gen_entities.py 15`); regenerar otra vez conserva el JSDoc y no cambia nada | `gen_entities.py 15` + prettier + `git diff` | PASS |
| H1.S2.M2 | `NoteEntryInputDto` + `@NoteEntries()` en Create/AddVersion/Amend; validador `IsPlainText` | `yarn test src/modules/chart` | PASS — `evidencia/02-unitarios-chart.txt` (21 suites, 201 tests) |
| H1.S2.M3 | El servicio guarda filas por versión (`null` sin filas) y las sella sólo si existen | idem (`chart-notes-entries.service.spec.ts`) | PASS |
| H1.S2.M4 | Lecturas expediente / colección / portal devuelven `entries` (omitido si no hay) | idem + integración | PASS |
| H1.S2.M5 | Integración real contra `mantra_p39`: crea, lee, versiona (v1 intacta), `null` sin filas, 5 rechazos 400 sin escribir, 403 sin vínculo (POST, PUT y lectura) | `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1 … yarn test:integration test/integration/p39-nota-medica-filas.int-spec.ts` | PASS 12/12 — `evidencia/03-integracion.txt` |
| H1.S2.M6 | OpenAPI (`openapi.json`/`.yaml`) y `openapi/endpoints/*.md` regenerados con las herramientas del repo | `node tools/openapi/generate-openapi.mjs` · `yarn docs:endpoints:generate` | PASS — `entries` en `CreateNoteDto`, `AddVersionDto`, `AmendNoteDto`, `ChartNoteListItemDto`, `MyChartNoteItemDto` |
| H1.S3.M1 | Front: `ChartNotesClient` manda `entries` tal cual (se borró `notePayload`, que aplanaba las filas en `objectiveText`); se quitaron las notas «sólo el simulador» y la extensión `entries` de `simulator-extensions.ts`; `api-contract.generated.ts` regenerado (diff: sólo `CreateNoteDto`, `AddVersionDto`, `AmendNoteDto`, `NoteEntryInputDto`) | `node scripts/gen-mock-contract.mjs <openapi.json>` | PASS (diff verificado) |
| H1.S3.M2 | Simulador con el contrato de la API (sin extensión `entries`, rechaza HTML como `IsPlainText`); specs del cliente y de las dos pantallas actualizados al contrato nuevo (las filas ya no se aplanan en `objectiveText`) | `ng test --include` (6 archivos) | PASS 64/64 — `evidencia/04-front.txt` |

## A medias
ninguna

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| — | ninguna | — |

## Evidencia
- `evidencia/01-modelo-patch.txt` — 2.ª corrida del patch y conteo de columnas.
- `evidencia/02-unitarios-chart.txt` — `yarn test src/modules/chart`: 21 suites, 201 tests en verde (también tras el merge con la rama compartida).
- `evidencia/03-integracion.txt` — integración P39: 12/12.
- `evidencia/04-front.txt` — specs dirigidos del frontend.
- `yarn typecheck` (API, `tsc --noEmit`) — exit 0 después de los cambios de DTO/servicio.

```text
$ yarn test src/modules/chart
Test Suites: 21 passed, 21 total
Tests:       201 passed, 201 total

$ MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1 DB_NAME=mantra_p39 … yarn test:integration test/integration/p39-nota-medica-filas.int-spec.ts
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
```

## No cubierto
- **Prueba visual en navegador**: no se tocó ninguna plantilla ni estilo; las pantallas (`medical-note-block`,
  `additional-fields`) ya mandaban `entries`. No se ejercitó `UI → API real → recarga` en un navegador.
- **Lint de la API**: `npx eslint` sobre los archivos tocados murió por OOM (heap de 2 GB) con la máquina compartida.
- **Enmienda con filas por HTTP**: cubierta en unitario, no en integración.
- **`GET /charts/me/notes` (portal) con filas**: cubierto por el mapeo compartido (`readNoteEntries`), sin integración propia.
- **Inventario (`docs/inventario`, `inventario/`)**: no se regeneró: `tools/inventario/catalogo.mjs` compara contra
  una foto de base desplegada que no tiene la columna (marca `DIVERGE`) y arrastraba deriva ajena en 9 módulos.
- **Catálogo de datos del modelo (`docs/data-catalog/`)**: ya estaba desfasado antes de P39; no se regeneró.

## Desvíos del plan
- La integración necesitó el arreglo de entorno que usó P23: `node_modules` propio con enlaces al compartido,
  caché de metadata de MikroORM privada (la compartida daba `Metadata for entity CatalogConcepts not found`) y
  `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1`. Dos corridas cayeron por timeout del `beforeAll` en el arranque en frío.
- El paciente del test se da de alta con `register-patient` + vínculo `request/respond`: con `POST /profiles/patients`
  (admin) `POST /authz/care-relationships` respondía 404 `AUTHZ_PATIENT_OUT_OF_SCOPE`. Mismo camino que
  `clinical-c14-c23-notas-e-internacion.int-spec.ts`.
- `yarn db:vendor` no corre (falta `rsync`): se copiaron a `database/SQL/` los dos archivos del modelo que cambió
  P39 (`15_chart/02_tables.sql` y el patch).
- El OpenAPI regenerado trae además 5 valores nuevos de un enum de terminología que ya estaban en el código de
  `dev` sin regenerar; se dejan porque el archivo es derivado del código.
- Plan y reporte viven en el repo de la API (el de más cambios), no en el del frontend.

## Riesgos residuales
- El simulador conserva las filas previas cuando un `PUT …/versions` no manda `entries`; la API crea la versión sin
  filas (cada versión es contenido completo, como los textos SOAP). Las pantallas actuales mandan siempre las filas.
- `AppendClinicalNoteVersionInput` del front declara `amendmentReasonText`, que `AddVersionDto` no acepta. Previo a
  P39 y fuera de alcance.

## Decisiones y ambigüedades
1. **Columna `jsonb` en la versión, no tabla hija**: la versión es inmutable y las filas sólo se leen con ella.
   Descartado `chart.clinical_note_entries`. Reversible con un patch. Confirmar con el dueño del modelo.
2. **La enmienda también acepta filas**: si no, enmendar una nota con filas las perdía. Confirmar con producto.
3. **El portal del paciente ve las filas de la versión liberada**: son el contenido de la nota. Confirmar con producto.
4. **Límites** = los del simulador del front (40 filas, 60/500 caracteres, sin repetidos sin distinguir mayúsculas
   ni tildes) + «sin HTML ni caracteres de control». `<140` y `PA < 140 y > 90` se aceptan.
5. **Sello**: las filas entran al `content_hash` sólo si existen; el hash de las versiones anteriores no cambia.
6. **Patch `v4252`** comparte número con otro patch de la misma noche; el repo ya admite varios por número y día.
