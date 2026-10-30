# Plan — P40 · órdenes de análisis basadas en notas (carril C2)

- Fecha: 2026-10-26 · Repos afectados: mantra-core-health-model, mantra-core-health-api, mantra-core-health
  · Predecesor: ninguno (el carril C2 nunca se entregó; `PENDIENTES-BACKEND.md` §P39–P41, fila P40;
  ADR-0016 del frontend).
- Resultado observable: el médico pide una orden de análisis con `category` (`LAB | IMAGING | OTHER`) y
  `basedOnNoteIds` en `POST /clinical/service-requests`; la API valida que cada nota sea del mismo
  paciente/encuentro, guarda el vínculo y lo devuelve en `GET /diagnostics/patients/:id/orders`;
  `GET /diagnostic-results/me/orders` devuelve `category`. El frontend deja de deducir la pestaña de la
  orden por el código del concepto.
- Kill-test: `POST /clinical/service-requests` con una nota de otro paciente responde 201, o con
  `category: 'OTHER'` responde 500 (sin concepto `SR_OTHER` sembrado).

## Alcance
- IN: `diagram_08_clinical.puml` + DDL regenerado + patch v4.2.53; entidad `ServiceRequestNotes`;
  DTO/servicio de alta; lecturas de `diagnostics`; concepto `SR_OTHER` (+ catálogo dinámico y designación
  es); simulador, tipos, «Mis órdenes» y línea del encuentro del frontend.
- OUT: una pantalla para elegir notas al pedir la orden (no hay pantalla esperándolo: el P lo dice);
  `entries_json` de la nota (P39, otro agente); el inventario/OpenAPI regenerado (ver REPORTE); el desfase
  previo entre `SR_IMAGING` de `clinical` y el de `diagnostics` en las listas de lectura.
- Ambigüedades registradas (decididas esta noche, nadie responde — BRIEF):
  1. Tabla puente vs `uuid[]`: **tabla** `clinical.service_request_notes` (FK real; el modelo ya usa tablas
     hijas: `observation_performers`, `observation_notes`). Descartado: arreglo sin FK.
  2. `category` textual: **vista de `category_concept_id`**, no columna. `IMAGING` se escribe con el
     concepto de `diagnostics` (el que leen las listas). Cualquier otra categoría declarada (procedimiento,
     cardio, patología) se lee `OTHER`. Descartado: columna textual paralela (dos verdades).
  3. `category` + `categoryConceptId` juntos: tienen que coincidir (422), se guarda el concepto.
  4. Nota de otro paciente y nota inexistente: **misma respuesta** 422 `BASED_ON_NOTE_NOT_FOUND`
     (no revela que el id existe). Nota del paciente de otra consulta: 422 `BASED_ON_NOTE_ENCOUNTER_MISMATCH`.
     Orden sin encuentro: sólo mismo paciente.
  5. `basedOnNoteIds` **no** viaja al portal del paciente (una nota puede no estar liberada).
  6. Las órdenes `OTHER` se listan en la ficha diagnóstica y en el portal; las colas/liquidaciones de
     laboratorio e imagen (`DIAGNOSTIC_CATEGORIES`) no cambian.
  A quién confirmar: dueño del producto (Pablo) al revisar el PR.

## H1 — La orden de análisis declara categoría y notas, y la API lo hace valer
**CA:** Dado un médico con vínculo asistencial y una nota de la consulta del paciente, cuando pide la orden
con `category` y `basedOnNoteIds`, entonces la orden queda con su concepto y su vínculo, y la ficha la
devuelve; con una nota de otro paciente, 422 y no se escribe nada.
**DoD:** unitarios dirigidos + integración real contra `mantra_p40` + typecheck + lint de lo tocado.
**Estado:** ver tablas.

### H1.S1 — Modelo
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Entidad `service_request_notes` en `diagram_08_clinical.puml` | `gen_ddl.py all` emite la tabla, 3 FK y 4 índices | diff baseline→regenerado sólo con esta entidad | HECHO |
| H1.S1.M2 | Patch idempotente v4.2.53 | aplica dos veces sin error | `psql -v ON_ERROR_STOP=1 -f` ×2 | HECHO |

### H1.S2 — API
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Entidad regenerada con `gen_entities.py 08` | archivo nuevo + barrel | `git status` | HECHO |
| H1.S2.M2 | Concepto `SR_OTHER` + catálogo dinámico + designación es | seed lo siembra (FK del alta) | integración `category OTHER` | HECHO |
| H1.S2.M3 | `category` y `basedOnNoteIds` en el alta, validación y vínculo | 422 en nota ajena/otra consulta/mismatch | unit `service-requests.service.spec`, `service-request-notes.service.spec` | HECHO |
| H1.S2.M4 | Lectura en `GET /diagnostics/patients/:id/orders` y `GET /diagnostic-results/me/orders` | `category` (+ `basedOnNoteIds` sólo personal) | unit `diagnostics-orders.service.spec`, `…orders.service.spec` | HECHO |
| H1.S2.M5 | Integración real con negativos (nota ajena, otra consulta, mismatch, 400, 403) | 9 casos verdes | `p40-orden-basada-en-notas.int-spec.ts` | HECHO |

### H1.S3 — Frontend
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Tipos: quitar «sólo el simulador», documentar el contrato | sin notas P40 de simulador | `grep` | HECHO |
| H1.S3.M2 | Simulador con el mismo contrato (validación y lectura) | 8 casos verdes | `service-request-category.mock.spec.ts` | HECHO |
| H1.S3.M3 | «Mis órdenes» usa `category` de la API en lugar del código | pruebas del componente verdes | `diagnostic-orders.spec.ts` | HECHO |
| H1.S3.M4 | Línea del encuentro: `category` cuando falta el concepto | 3 casos | `history-view-model.spec.ts` | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| P39 toca `diagram_15_chart` / `SQL/15_chart` y el `_generation_report.md` | conflicto en derivados | en el merge se regenera, no se elige lado |
| Caché de metadata MikroORM compartida por el symlink de `node_modules` | integración no arranca | setup de jest que desactiva la caché, sólo en la corrida |

### H1.S4 — Gate de seguridad (agregado a mitad de camino: hallazgo de la revisión automática)
| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S4.M1 | Acotar las notas al tenant custodio (vía su encuentro), sólo firmadas/enmendadas, sin confidencialidad restringida | nota del mismo paciente en otro tenant → 422 `BASED_ON_NOTE_NOT_FOUND` | unit `service-request-notes.service.spec` + integración | HECHO |
| H1.S4.M2 | `GET /diagnostics/patients/:id/orders` con `ClinicalRecordAccessGuard` (devuelve ids de notas) | profesional sin vínculo → 403 | integración | HECHO |
