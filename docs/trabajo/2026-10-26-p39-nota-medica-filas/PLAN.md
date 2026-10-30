# Plan — P39: filas campo/valor de la nota médica (`entries_json`)

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-model, mantra-core-health-api,
  mantra-core-health (frontend) · Predecesor: carril C1 del paquete «Encuentro clínico» (frontend,
  contra el simulador) y `PENDIENTES-BACKEND.md` §«P39, P40 y P41».
- Resultado observable: la médica guarda una nota con filas «campo: valor» desde la pantalla de la
  cita; la API las persiste en la versión de la nota y las devuelve en el expediente
  (`GET /charts/patients/:id/chart`) y en `GET /charts/notes`, sin aplanarlas en `objectiveText`.
- Kill-test: `POST /charts/notes` con `entries` responde 400 `whitelistValidation`, o el
  `GET` del expediente no trae `entries`.

## Alcance
- IN: `diagram_15_chart.puml` + DDL de `15_chart` + patch `2026-10-26_v4252_chart_note_entries.sql`;
  entidad `ClinicalNoteVersions` (regenerada); `notes.dto.ts`, `chart-read.dto.ts`,
  `chart-me.dto.ts`, `chart-note-item.mapper.ts`, `chart-notes.service.ts`,
  `chart-me-read.service.ts`, `clinical-notes.repository.ts`; validador
  `common/validators/plain-text.validator.ts`; OpenAPI regenerado; tests unitarios + integración;
  frontend: `chart-notes.client.ts`/`.types.ts`, `clinical.types.ts`, `simulator-extensions.ts`,
  `medical-notes.handlers.ts`, comentario de `additional-fields.ts`, `api-contract.generated.ts`
  (regenerado) y sus specs.
- OUT: el `TODO C8` de `history-view-model.ts` (apartados de la línea del encuentro: no existe en
  `dev`); P40 (órdenes basadas en notas); el catálogo de datos `docs/data-catalog/` del modelo (ya
  estaba desfasado antes de P39: regenerarlo arrastra cientos de filas ajenas); la deriva de FKs
  «inferidas» que `gen_ddl.py all` produce por la bóveda local (no es de P39).
- Ambigüedades registradas (decididas, ver «Decisiones» del REPORTE):
  1. Columna `jsonb` en la versión vs tabla hija → columna. Confirmar con el dueño del modelo.
  2. ¿La enmienda (`POST …/amendments`) acepta filas? → sí, misma forma. Confirmar con producto.
  3. ¿El portal del paciente (`GET /charts/me/notes`) ve las filas de la versión liberada? → sí.
  4. Límites: los del simulador del frontend (40 / 60 / 500, sin repetidos) + «sin HTML».

## H1 — Las filas viajan, se guardan por versión y se leen
**CA:** Dado un médico con vínculo asistencial, cuando crea una nota con dos filas y luego agrega
una versión con otra fila, entonces la v1 conserva sus dos filas, la v2 tiene la suya y las dos
lecturas devuelven las filas de la vigente; un médico sin vínculo recibe 403 y no escribe nada.
**DoD:** `yarn test src/modules/chart` verde · `yarn test:integration p39-nota-medica-filas` verde
contra `mantra_p39` · `yarn typecheck` 0 · front: specs dirigidos verdes.
**Estado:** ver tabla

### H1.S1 — Modelo
| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | `entries_json : jsonb` en `clinical_note_versions` del `.puml` + DDL regenerado | `02_tables.sql` trae la columna y nada más cambia en `15_chart` | `gen_ddl.py 15` + `git diff SQL/15_chart` | HECHO |
| H1.S1.M2 | Patch idempotente aplicado a `mantra_p39` | 19 → 20 columnas; 2.ª corrida sin error | `psql -f patch` ×2 | HECHO |

### H1.S2 — API
| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Entidad regenerada con `gen_entities.py 15` | sólo `entriesJson` nuevo; regenerar dos veces no cambia nada | `gen_entities.py 15` + prettier + `git diff` | HECHO |
| H1.S2.M2 | DTO de entrada con límites y sin HTML en create/addVersion/amend | casos válidos, borde e inválidos en `notes.dto.spec.ts` | `yarn test src/modules/chart/dto` | HECHO |
| H1.S2.M3 | Servicio guarda filas por versión y las sella | spec `chart-notes-entries.service.spec.ts` | `yarn test src/modules/chart` | HECHO |
| H1.S2.M4 | Lecturas (expediente, colección, portal) devuelven `entries` | spec del mapeo + integración | idem + int-spec | HECHO |
| H1.S2.M5 | Integración real con 403 negativo | `p39-nota-medica-filas.int-spec.ts` verde | `yarn test:integration …` | HECHO |
| H1.S2.M6 | OpenAPI regenerado | `openapi.json` declara `entries` en los 3 cuerpos | `yarn docs:openapi:generate` | HECHO |

### H1.S3 — Frontend
| ID | Microtarea | CA (binario) | DoD (comando) | Estado |
|---|---|---|---|---|
| H1.S3.M1 | El cliente manda `entries` tal cual a la API real; se quitan las notas «sólo el simulador» | spec del cliente | `ng test --include chart-notes.client.spec.ts` | HECHO |
| H1.S3.M2 | El simulador sirve el contrato de la API (sin extensión `entries`, rechaza HTML) | contrato regenerado + specs del simulador | `gen-mock-contract.mjs` + specs | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Cambiar el sello (`content_hash`) de versiones ya firmadas | hashes viejos dejan de verificar | las filas entran al hash sólo si existen (test que fija el hash SOAP) |
| Filtrar rótulos tipo `<140` como HTML | rechazo de valores clínicos legítimos | regex exige letra tras `<`; test con `PA < 140 y > 90` |
| P40 toca `chart-notes.service.spec.ts` | conflicto de merge | specs de P39 en archivos propios |
