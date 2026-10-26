# Plan — P44 · «Mis gastos»: `GET /patient-spending/me` en la API real

- Fecha: 2026-10-26 · Repos afectados: `mantra-core-health-api`, `mantra-core-health` · Predecesor: P44 del frontend (pantalla contra el simulador)
- Resultado observable: el paciente autenticado abre `my-account/spending` en `production-api` y ve sus gastos de salud derivados de sus facturas reales, en vez del estado de error.
- Kill-test: `GET /patient-spending/me?from=…&to=…` con el token de otro paciente devuelve movimientos del primero, o la ruta responde 404.

## Alcance
- IN: lectura nueva en `billing` (controlador, servicio, repositorio SQL, DTO), conceptos `SPEND_*` en el catálogo de conceptos de la API, OpenAPI e inventario de endpoints regenerados, pruebas unitarias e integración real; en el front, quitar las notas «sólo el simulador», aceptar el campo aditivo `truncated` en DTO, simulador y pantalla.
- OUT: esquema (no hace falta tabla, vista ni columna: ver decisión D1), gastos de farmacia sin seguro (no hay cobro registrado), primas de seguro (no hay cobro registrado), dependientes, `toCents` en coma flotante del front.
- Ambigüedades registradas (decididas por el agente, sin respuesta del dueño esta noche): ver `REPORTE.md` §Decisiones.
- Modelo: no se toca. La lectura sale de tablas existentes (`billing.invoices`, `billing.invoice_lines`, `insurance.insurance_claim(_line)s`, `diagnostic_units.diagnostic_study_offerings`, `procedures_perioperative.procedure_charge_items`); los dos huecos que nombraba P44 §3 ya no existen en `dev` (`billing.invoices.patient_profile_id` y `scheduling.appointment_payment_states`).

## H1 — La API sirve los gastos del titular
**CA:** dado un paciente con facturas emitidas, cuando pide su rango, entonces recibe un movimiento por factura con importes exactos en BOB, del más reciente al más antiguo; otro paciente no las ve.
**DoD:** unitarios del servicio y del controlador en verde · integración contra `mantra_p44` en verde, con el negativo · typecheck y lint de lo tocado · OpenAPI e inventario regenerados.
**Estado:** HECHO (ver REPORTE.md)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Conceptos `SPEND_*` en `billing.concepts.ts` | los seis códigos sembrables | unitario del servicio usa los códigos | HECHO |
| H1.S1.M2 | Validación del rango (400, como el simulador; ver D3) y tope `limit` | `from`/`to` faltantes, mal formados, invertidos o > 3 años → 400 | `jest patient-spending` | HECHO |
| H1.S1.M3 | Repositorio SQL que deriva el movimiento desde `billing.invoices` + líneas + reclamo + procedimiento | importes y categoría correctos por factura | integración real | HECHO |
| H1.S1.M4 | Servicio + controlador `@Roles('PATIENT')`, titular del token | sin perfil → 422 `PRECONDITION_FAILED` (como `/promotions/me`); otro paciente no ve nada | unitario + integración negativa | HECHO |
| H1.S1.M5 | OpenAPI e inventario regenerados | la ruta figura | `yarn docs:openapi:generate`, `yarn inventario:endpoints` | HECHO |

## H2 — El front usa la API real
**CA:** la pantalla consume la misma forma y deja de anunciarse como «sólo el simulador».
**DoD:** specs del cliente, del simulador y de la pantalla en verde; lint y typecheck.
**Estado:** HECHO (ver REPORTE.md)

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | DTO/cliente/simulador: notas fuera, `truncated` aditivo | el simulador sirve el mismo contrato | `vitest` de los tres specs | HECHO |
| H2.S1.M2 | Pantalla avisa si la lista llegó recortada | aviso visible con `truncated: true` | spec de la pantalla | HECHO |

| H1.S1.M6 | Integración HTTP con la app completa | 401 sin token, 403 rol no paciente, 400 del pipe y del servicio, aislamiento entre pacientes, fila en `audit.data_access_log` | `MIKRO_ORM_CLI_ALWAYS_ALLOW_TS=1 yarn test:integration test/integration/patient-spending-http.int-spec.ts` → 5/5 (`evidencia/api-integracion-http.txt`) | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| RLS de `practice.practices` con `RLS_ENFORCE=true` oculta el nombre de prácticas de otra organización | `providerName` nulo | se toma también el nombre del tenant que administra la sede (`practice_sites.managing_tenant_id`, sin RLS) |
| Varios agentes en la misma rama remota | conflictos en derivados | regenerar derivados tras el merge |
