# Plan — carril 2 · Pablo · front (comprobantes y cierre con pago, CI único, Colegio Médico, consentimiento, encuestas)

- Fecha: 2026-10-23 · Repos afectados: `mantra-core-health` (este), `mantra-core-health-api`, `mantra-core-health-model` · Predecesor: `AlovidaPromptManager/planes/06-correcciones-fullstack-2026-10-23` (prompt de Pablo, `repartos/2026-10-23/PromptDia/Pablo/`)
- Resultado observable: el médico ve en su pantalla de atención los comprobantes que subió el paciente y los acepta o rechaza con motivo; la consulta no cierra ni factura sin pago confirmado; dos médicos no pueden registrarse con el mismo CI y terminación; la matrícula se verifica contra el Colegio Médico simulado; el consentimiento se pide por sección con motivo; las encuestas se emiten solas al cerrar la cita.
- Kill-test: `corepack yarn pw playwright/correcciones-2026-10-23-kill-tests.spec.ts --grep "@pablo"` contra la API real sigue en rojo.

## Alcance
- IN: lo que fija el prompt de Pablo (`ComprobantesCierreCiUnicoColegioMedicoConsentimientoYEncuestas.md`), hito por hito, en su orden: H1 → H2 (C-01) → H3 (C-10) → H5 (C-05) → H6 (C-06) → H4 (Colegio) → H7 (Coolify) → H8.
- OUT: lo que el prompt declara OUT (pantalla de pago del paciente y C-02 de Richard; buzón y bandeja del paciente de Leo; agenda de Justin; QR de receta y órdenes de Ender e Itzan; pasarela; motor de pólizas; módulo de identidad del mock).
- Ambigüedades registradas: Q-P1…Q-P6 del prompt, Q-06, Q-13, Q-14, D-2, D-3 del plan.

El plan detallado (hitos, subtareas, microtareas con CA y DoD) **es el prompt del carril**; este archivo
registra el estado real de cada microtarea en este repo a medida que se ejecuta, y la evidencia va a
`evidencia/`. Los IDs son los del prompt (H1.S1.M1 …).

## Estado por microtarea (este repo)

| ID | Microtarea | Estado | Evidencia |
|---|---|---|---|
| H1.S1.M1 | Corte y rama | HECHO | `origin/dev` @ `6ea11561`, rama `claude/intelligent-faraday-444u25` |
| H1.S1.M2 | Baseline API | HECHO | typecheck exit 0 (plan 06, `evidencia/api-typecheck.txt`) |
| H1.S1.M3 | API real + cuentas | HECHO | Postgres nativo 5433, API 3005, paciente/médica/admin/farmacia/laboratorio sintéticos (plan 06) |
| H1.S2.M1–M4 | Publicar C-01, C-05, C-06, C-10 | HECHO | DTOs en `planes/06/README.md §5` |
| H1.S2.M5 | Kill-tests `@pablo` en rojo | HECHO | plan 06, `evidencia/kill-tests-api-real.txt` (MD-06, MD-01, MD-02, MD-03, MD-05 ×3 rojos) |
| H2.S1.M1–M3 | Modelo `payment_proofs` (puml M17 + CHECK en M33 + patch v4247 + entidad + catálogo) | HECHO | `evidencia/h2-modelo.txt` (en el repo del modelo) |
| H2.S2.M1–M4, M6, M8, M9 | API C-01: contexto, comprobante, lista, aceptar/rechazar con precondición, cierre con candado, tabla del prestador, avisos, imagen autorizada por contexto | HECHO | `evidencia/h2-int-spec-c01.txt`, `h2-api-verificacion.txt`, `h2-regresion-cierre-encuentro.txt` (en el repo de la API) |
| H2.S2.M5 | El cargo nace en `start` y reemplaza la bandera manual | A MEDIAS | `PUT payment-state` marcado deprecado; el cargo se deriva del encuentro, no nace en `start` |
| H2.S2.M7 | `issue-from-encounter` real exige PAID | A MEDIAS | la factura simulada exige pago (422 PAYMENT_REQUIRED, int-spec 2b); el camino real no se extendió |
| H2.S3.M1–M5 | Cliente C-01, caja «Comprobantes del paciente» (miniatura + lightbox, aceptar/rechazar con motivo), cierre con PAYMENT_REQUIRED y excepción, «Pagos por sesión» (Contabilidad del médico y `/billing`), simulador en 3 niveles | HECHO | `evidencia/doble-revision.md`, `h2-e2e-mutacion-api-real.txt`, `h2-regresion-front.md` (repo del front) |
| H2.S3.M6 | Móvil: `consultation_billing_sheet.dart` | TODO | no empezado |
| H3.S1.M1 | `owner_kind_concept_id` en `diagram_02_common.puml` + `gen_ddl.py 02` | HECHO | repo del modelo, `SQL/02_common` regenerado; se reusa `issuer_administrative_area_concept_id` en vez de un `issuer_department` nuevo (desvío registrado) |
| H3.S1.M2 | Patch v4248: relleno, medición de duplicados, índice único parcial | HECHO | `evidencia/h3-seed-y-patch.txt` (API): 29 médicos · 39 pacientes · 0 duplicados; segunda corrida sin cambios |
| H3.S1.M3 | Conceptos `common:document-holder-kind` (paciente, médico, representante) | HECHO | 1.ª siembra 3 filas, 2.ª 0 (`h3-seed-y-patch.txt`) |
| H3.S1.M4 | `findDocumentHolder` por (tipo, número, departamento, tipo de usuario) | HECHO | int-spec C-10 11/11 contra Postgres real; deriva ORM limpia (`h3-orm-audit-resumen.txt`) |
| H3.S1.M5 | (nueva, revisión de seguridad) Normalizar el número de la cédula antes de comparar (mayúsculas, sin `.`): hoy `1234567` y `1.234.567` no chocan | TODO | requiere columna o índice por expresión en el modelo y decidir si cambia el identificador de ingreso del paciente |
| H3.S2.M1 | Médico: chequeo + `ownerKind` + carrera → 409 | HECHO | int-spec 2, 3, 7, 8 |
| H3.S2.M2 | Paciente: mismo código de error; vinculación a la persona del médico | A MEDIAS | anda: 409 `DOCUMENT_ALREADY_REGISTERED`, el médico puede ser paciente (int-spec 5, 6). No anda: no se une la persona del médico con la del paciente (quedan dos personas). Falta: decisión de identidad maestra (Q-13), escalada |
| H3.S2.M3 | Representante de organización y altas asistidas | A MEDIAS | anda: alta asistida de médico → 409 (int-spec 7b); mostrador y representantes quedan etiquetados. No anda: el representante queda fuera de la unicidad (una persona puede representar a varias empresas: ambigüedad a confirmar) y no hay int-spec del alta de organización |
| H3.S2.M4 | `GET /iam/auth/document-availability?type&number&issuer&userType` → `{ available }`, 60/min | HECHO | int-spec 1, 9, 10; sin PII en la respuesta |
| H3.S2.M5 | Front: validador asíncrono + 409 por código | A MEDIAS | anda en médico y paciente: specs, E2E API real 4/4 ×10, kill-test MD-01 verde, doble revisión. Falta el alta de organización, que depende de la misma decisión de H3.S2.M3 |
| H3.S2.M6 | Móvil: validador en `practitioner_registration` y `register_patient_wizard` | TODO | no empezado |
| H3.S2.M7 | (nueva) `form-field`: mensaje de error y asterisco con `--text-danger` (AA en oscuro) | HECHO | `capturas-h3-form-field/antes|despues`, ronda 3 ACEPTABLE CON RESERVAS; `check-contrast` 0 |
| H4.S1.M1–M3 · H4.S2.M1–M5 | Colegio Médico | TODO | |
| H5.S1.M1–M3 · H5.S2.M1–M5 · H5.S3.M1–M4 | Consentimiento | TODO | |
| H6.S1.M1–M3 · H6.S2.M1–M6 · H6.S3.M1–M6 | Encuestas y formularios | TODO | |
| H7.S1.M1–M3 | Coolify | TODO | |
| H8.S1.M1–M5 | Cierre | TODO | |

## Desvíos y decisiones registradas (H2)
- **422 en vez de 412.** C-01 dice «412 PAYMENT_REQUIRED». La casa mapea `PreconditionFailedException` a 422 + `PRECONDITION_FAILED` y la factura simulada ya respondía así. Se sigue el patrón nativo: el cliente distingue por `details.reason = PAYMENT_REQUIRED`. Confirmar con Richard/Ender/Itzan (consumidores de C-01).
- **`charge_id` = `encounter_id`.** No existe `billing.charges`; el cargo de la consulta es el encuentro.
- **Práctica del cargo.** Antes se tomaba «la primera práctica del tenant»; los médicos independientes comparten el tenant por defecto, así que un médico cobraba con el precio de otro. Ahora se resuelve por la asignación vigente del profesional (bug real encontrado por el int-spec; arreglado en `charge-settlement.ts`, la tabla del prestador y `loadCharges` del simulado).
- **Aviso sin `destination`.** La bandeja colapsa avisos sin leer con el mismo destino: «pagado» quedaba tapado por un «rechazado» anterior. El aviso va sin destino y con el cargo en `payloadJson`.
- **C-02 contra un doble** (`NoCoveragePatientShare`, siempre `NO_COVERAGE`): falta integrar con el puerto real de Richard.
- **Patch v4247.** La serie v42xx de la copia de despliegue de la API llega a v4246 con cambios que no volvieron al repo del modelo (deriva previa, anotada).

**Avance: 30 / 81 microtareas HECHO — 37,0 %** (H1 8, H2 15, H3 7; H4–H8 sin empezar; H3.S2.M7 y H3.S1.M5 agregadas en ejecución). Detalle en `REPORTE.md`.

## Desvíos y decisiones registradas (H3)
- **`issuer_administrative_area_concept_id` en vez de `issuer_department`.** La columna ya existía y es el departamento de emisión (v4.1.4). Crear otra habría duplicado la verdad.
- **`owner_kind` separado de `owner_type`.** `owner_type` dice qué entidad es dueña de la fila; un médico y un paciente son las dos personas, así que hacía falta otro eje.
- **Sin unión automática de personas** médico ↔ paciente: unir por CI permite tomar la identidad de otro. Es identidad maestra (`patient_identity_links`), escalado como Q-13.
- **Representantes fuera del índice único** (supuesto: una persona representa a varias empresas). Confirmar con el dueño del alta de organizaciones.
- **El alta de mostrador** (`walk-in`) mantiene su chequeo previo, más estricto (cualquier CI activo): no se cambió su semántica. Sólo se etiqueta el tipo.
- **Patch v4249 (corrige v4248)**: el relleno de v4248 etiquetaba todas las filas del titular (también el NIT) y el índice no filtraba por tipo de documento; ahora sólo la cédula, y si una persona tiene los dos perfiles, su cédula queda como de médico.
- **Contrato C-10**: se respetan los nombres publicados (`type`, `number`, `issuer`, `userType`) y 60/min.
- **Ratchet de tamaño** (`check-max-lines`): para no hacer crecer las altas, el campo de departamento pasó a `shared-registration/issuer-department-field.ts`, y el aviso «sin catálogo de departamentos» al componente de estado. El simulador envuelve las altas (`MockRouter.envolver`) en vez de crecer `auth.handlers.ts`.

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Sin Docker: Mongo, OpenSearch y MinIO ausentes | int-specs que los toquen quedan `BLOCKED` | los de billing/iam/consent/surveys usan sólo Postgres y Redis |
| `gen_ddl.py` espera la bóveda como `Mantra Core Health Vault` hermana | no regenera | `SALUD_WORKSPACE` con enlaces simbólicos a los clones reales |
