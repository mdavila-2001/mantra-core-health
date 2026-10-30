# Reporte — P40 · órdenes de análisis basadas en notas (carril C2)

> **AVANCE: 15 / 15 — 100 %.**

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/elegant-goodall-0wu6ci` (modelo, API, frontend)
- Peldaño de evidencia: modelo `RUNS` (patch aplicado ×2) · API `TESTED` (unitarios + integración real
  contra `mantra_p40`, con negativos) · frontend `TESTED` (unitarios + componente; sin navegador).
  No es `VERIFIED`: no se ejercitó la pantalla en un navegador contra la API levantada.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | `clinical.service_request_notes` en `diagram_08_clinical.puml`; DDL regenerado | `python3 salud-db/gen_ddl.py all` + diff contra la regeneración de base | PASS: el delta es sólo la tabla, 3 FK, 4 índices |
| H1.S1.M2 | Patch `2026-10-26_v4253_clinical_service_request_notes.sql` idempotente | `psql -v ON_ERROR_STOP=1 -f …` ×2 sobre `mantra_p40` | PASS (2.ª corrida: sólo NOTICE «already exists») |
| H1.S2.M1 | Entidad `ServiceRequestNotes` | `python3 salud-db/gen_entities.py 08` | PASS |
| H1.S2.M2 | Concepto `SR_OTHER` sembrado (catálogo dinámico + designación es) | integración «category OTHER…» (FK al catálogo) | PASS |
| H1.S2.M3 | Alta con `category` y `basedOnNoteIds` + validación | `yarn test src/modules/clinical/services/service-request…` | PASS — `evidencia/unit-api.txt` |
| H1.S2.M4 | Lecturas con `category` / `basedOnNoteIds` | `yarn test src/modules/diagnostics…` | PASS (223) |
| H1.S2.M5 | Integración real con negativos | ver Evidencia | PASS 9/9 (+7/7 de la suite vecina) — `evidencia/integracion-p40.txt` |
| H1.S3.M1–M4 | Tipos, simulador, «Mis órdenes», línea del encuentro | `ng test --include …` (10 archivos) | PASS 141/141 — `evidencia/front-tests.txt` |
| H1.S4.M1 | Notas acotadas al tenant custodio, firmadas, no restringidas | unit + integración | PASS |
| H1.S4.M2 | Guard de historia en `GET /diagnostics/patients/:id/orders` | integración «sin vínculo… 403» | PASS |

## A medias
ninguna

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| UI para elegir las notas al pedir la orden | fuera de alcance (no hay pantalla esperándolo, ver P39–P41) | decisión de producto sobre dónde se eligen |

## Evidencia
```text
$ DB_NAME=mantra_p40 ALLOW_PERMANENT_TEST_RESIDUE=yes MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1 yarn test:integration \
    --testTimeout=900000 test/integration/p40-orden-basada-en-notas.int-spec.ts test/integration/patient-diagnostic-orders.int-spec.ts
… "reason":"BASED_ON_NOTE_NOT_FOUND" … ×4 (otro paciente, inexistente, otro tenant, borrador)
… "reason":"BASED_ON_NOTE_ENCOUNTER_MISMATCH" …
… "reason":"SERVICE_REQUEST_CATEGORY_MISMATCH" …
… VALIDATION_FAILED … "field":"category","constraints":["isIn"] … / basedOnNoteIds ["arrayUnique"]
Test Suites: 2 passed, 2 total
Tests:       16 passed, 16 total

$ yarn test src/modules/clinical/services/service-request src/modules/clinical/service-request-category \
    src/modules/diagnostics/services/diagnostics-orders src/modules/diagnostics/services/diagnostics-patient-results.orders src/common/seed
Test Suites: 39 passed, 39 total
Tests:       410 passed, 410 total
$ yarn test src/modules/diagnostics src/app.module.wiring.spec.ts      → Tests: 223 passed, 223 total
$ NODE_OPTIONS=--max-old-space-size=6144 yarn typecheck                 → exit 0 (evidencia/typecheck-api.txt)

$ (frontend) NODE_OPTIONS=--max-old-space-size=4096 yarn ng test --watch=false --include <5 rutas de P40>
 Test Files  10 passed (10)
      Tests  141 passed (141)
$ (frontend) yarn build → exit 0 (corrido aparte; el push usó SALTAR_BUILD=1 porque el hook se quedó sin memoria)

$ psql mantra_p40 -v ON_ERROR_STOP=1 -f SQL/patches/2026-10-26_v4253_clinical_service_request_notes.sql   (2.ª vez)
BEGIN … NOTICE: relation "service_request_notes" already exists, skipping … COMMIT
```

## Gate de seguridad (regla 90.6)
- **Amenaza:** BOLA/IDOR entre tenants — citar en `basedOnNoteIds` el id de una nota del mismo paciente escrita
  en otra organización, o una nota en borrador/restringida, y después leer el vínculo en la ficha. Además, la
  ficha `GET /diagnostics/patients/:id/orders` sólo exigía rol + tenant, y ahora devuelve ids de notas.
- **Control:** `ServiceRequestNotesService.assertUsable`
  (`src/modules/clinical/services/service-request-notes.service.ts`): mismo paciente; encuentro de la nota en el
  tenant custodio de la orden (la cabecera no tiene tenant; sin encuentro no se puede probar → rechazo); ciclo
  `NOTE_LC_SIGNED | NOTE_LC_AMENDED`; confidencialidad vacía o `DOC_CONF_NORMAL`. Todas las fallas → 422
  `BASED_ON_NOTE_NOT_FOUND` con el mismo mensaje (no revela existencia). La ficha diagnóstica lleva
  `@UseGuards(ClinicalRecordAccessGuard)`, el mismo guard que el alta.
- **Test:** unit `service-request-notes.service.spec.ts` (otro tenant, sin encuentro, borrador, restringida,
  inexistente, ajena); integración «nota del MISMO paciente pero de otro tenant», «nota en borrador», «nota de
  otro paciente», «sin vínculo asistencial → 403 en alta y en ficha».
- **Resultado:** PASS (arriba).
- **Riesgo residual:** la nota de otro tenant se fabrica en la prueba moviendo su encuentro a otro tenant
  sembrado con un `UPDATE` (patrón de FX-10: el auto-registro deja a todos los médicos en el tenant semilla).
  `basedOnNoteIds` no viaja al portal del paciente.

## No cubierto
- Prueba visual / navegador: no se levantó `ng serve` ni la API; los cambios del frontend son de datos (pestaña de
  «Mis órdenes», texto de la línea) y están cubiertos por pruebas de componente, no por captura.
- El simulador no modela tenants en notas ni encuentros: la custodia por tenant sólo está probada en la API
  (el simulador sí rechaza borradores).
- Inventario (`inventario:*`) y OpenAPI no se regeneraron: la verificación ya fallaba en `dev` con 37 archivos
  ajenos desfasados; regenerar mezclaría cambios de otros P. El contrato está en los decoradores del DTO.
- `database/SQL` vendorizado a mano (copia exacta del modelo para los archivos de P40) porque `rsync` no está en
  este entorno; `diff -rq` dio idéntico en ese momento. Cambios posteriores de otros P en el modelo no se
  vendorizaron desde acá.
- La integración se corrió con `--testTimeout=900000` en la línea de comando (no en el código): con la máquina
  compartida el `beforeAll` (siembra) superó los 180 s dos veces (`Exceeded timeout of 180000 ms for a hook`).

## Desvíos del plan
- Hallazgo de la revisión de seguridad (orquestador) → H1.S4 agregado: tenant custodio, sólo firmadas, no restringidas.
- Al escribir el negativo «sin vínculo», la ficha diagnóstica respondió 200 a un médico sin vínculo: se agregó el
  guard (H1.S4.M2). Un primer intento con `DiagnosticsPatientAccessService` rechazaba también al médico tratante
  (exige `care_relationship`, que el mostrador no crea) y se reemplazó por el mismo guard del alta.
- Las segundas consultas del paciente se abren con `POST /clinical/encounters/check-in` (el mostrador rechaza el
  mismo documento dos veces: 409).
- La prueba esperaba el código `SR_OTHER` en `catalog_concepts.code`; el seed guarda la clave
  `clinical:SERVICE_REQUEST_CATEGORY_OTHER`. Se cambió a comparar el id del concepto (más estricto).

## Riesgos residuales
- Dos conceptos de imagen conviven (`clinical:` y `diagnostics:`): el selector del frontend ofrece el de
  `clinical`, y las listas diagnósticas sólo leen el de `diagnostics`. Preexistente; `category` los lee a los dos
  como `IMAGING` y el alta por texto escribe el de `diagnostics`. Anotado, no corregido (fuera de alcance).
- Quien lea la ficha diagnóstica sin acceso a la historia ahora recibe 403. En el frontend la consumen sólo
  pantallas del expediente (`patient-chart`, `analysis-order-block`, `diagnosis-verify-dialog`).

## Decisiones y ambigüedades (a confirmar con el dueño del producto en el PR)
1. Tabla puente `clinical.service_request_notes` (no `uuid[]`): FK real; patrón de `observation_performers`.
2. `category` = vista de `category_concept_id`, sin columna nueva; procedimiento/cardio/patología se leen `OTHER`.
3. `category` + `categoryConceptId` deben coincidir (422); se guarda el concepto.
4. Una nota sólo motiva una orden si está firmada o enmendada, es del tenant custodio y no es restringida.
5. Nota ajena/inexistente/otro tenant/borrador: misma respuesta. Otra consulta del mismo paciente: motivo propio.
6. `basedOnNoteIds` no va al portal del paciente; `category` sí.
7. Las órdenes `OTHER` se listan en la ficha y en el portal; colas y liquidaciones de lab/imagen no cambian.
