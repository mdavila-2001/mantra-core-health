# Reporte — carril 2 · Pablo · comprobantes y cierre con pago (C-01), CI único (C-10) — corte del 2026-10-24

> **AVANCE: 30 / 80 — 37,5 %.** H1 y H2 (C-01) cerrados salvo 3 microtareas; H3 (C-10) 7 de 11 (3 a medias, 1 móvil sin empezar); H4–H8 sin empezar; carril de Justin sin empezar.

- Fecha: 2026-10-23 (H1–H2) y 2026-10-24 (H3) · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/intelligent-faraday-444u25` en `mantra-core-health`, `mantra-core-health-api`, `mantra-core-health-model`, `mantra_core_technologies_health_docs`
- Peldaño de evidencia alcanzado, por área:
  - API C-01: `VERIFIED` (int-spec contra Postgres real + E2E contra la API real).
  - Front C-01: `VERIFIED` con doble revisión visual (veredicto final: 8 pantallas `ACEPTABLE CON RESERVAS`, ninguna `RECHAZADA`).
  - API C-10: `VERIFIED` (int-spec 11/11 contra Postgres real; E2E contra la API real).
  - Front C-10: `VERIFIED` con doble revisión visual (3 rondas; 5 estados `APROBADA`, 4 `ACEPTABLE CON RESERVAS`, ninguna `RECHAZADA`).
  - Regresión: parcial (ver «No cubierto»).

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1 (8) | Corte, baseline, cuentas sintéticas, contratos C-01/05/06/10 publicados, kill-tests en rojo | plan 06 | PASS (plan 06, `evidencia/` de AlovidaPromptManager) |
| H2.S1.M1–M3 | `billing.payment_proofs` en `.puml` M17, CHECK en M33, patch v4247 idempotente, entidad, catálogo ORM | `gen_ddl.py 17` · `gen_integrity.py` · psql ×2 · `orm:audit` | PASS — `mantra-core-health-model/…/evidencia/h2-modelo.txt` |
| H2.S2.M1–M4, M6, M8, M9 | Endpoints C-01, precondición en la escritura (doble aceptación → una gana, 409), cierre bloqueado sin pago (422 `PAYMENT_REQUIRED`) con excepción auditada, tabla del prestador con cursor y filtro por persona, avisos al paciente, imagen del comprobante autorizada por contexto | `yarn test:integration c01-comprobantes-de-pago` | PASS 14/14 — `mantra-core-health-api/…/evidencia/h2-int-spec-c01.txt` |
| H2.S3.M1–M5 | Cliente, caja «Comprobantes del paciente» (miniatura, lightbox, aceptar, rechazar con motivo), cierre que explica el pago faltante y ofrece la excepción, pestaña «Pagos por sesión» en Contabilidad del médico y en `/billing`, simulador C-01 en tres niveles | `playwright test c01-aceptar-comprobante` (API real, sin mocks) | PASS 3/3 — `evidencia/h2-e2e-mutacion-api-real.txt` |
| Kill-test MD-06 | La tabla de pagos por sesión existe y tiene sus columnas | `playwright test correcciones-… --grep MD-06` (API real) | PASS 1/1 |
| Datos de prueba en la API real | Script versionado que siembra el escenario C-01 completo por endpoints públicos, sintético e idempotente | `node scripts/e2e-sembrar-api-real.mjs --etiqueta carril2` ×2 | PASS — `evidencia/h2-datos-de-prueba-api-real.txt` |
| H3.S1.M1–M4 | `owner_kind_concept_id` en el modelo (M02), patch v4248 (relleno 29 médicos · 39 pacientes, 0 duplicados, índice único parcial `ux_identifiers_document_owner_kind`), conceptos `common:document-holder-kind`, búsqueda por (tipo, número, departamento, tipo de usuario) | `gen_ddl.py 02` · psql ×2 · arranque ×2 · `orm:audit` | PASS — `mantra-core-health-api/…/evidencia/h3-seed-y-patch.txt`, `h3-orm-audit-resumen.txt` |
| H3.S2.M1, M4 | El alta de médico rechaza el CI de otro médico con 409 `DOCUMENT_ALREADY_REGISTERED` (también en carrera y en el alta asistida); `GET /iam/auth/document-availability?type&number&issuer&userType` → `{ available }`, 60/min, sin PII | `yarn test:integration c10-ci-unico` | PASS 11/11 — `mantra-core-health-api/…/evidencia/h3-int-spec-c10.txt` |
| H3.S2.M7 | El mensaje de error y el asterisco de `form-field` usan `--text-danger`: en oscuro pasan de ≈3,0:1 a ≈7,9:1 | `playwright test capturas-h3-form-field-regresion` antes/después | PASS — `evidencia/capturas-h3-form-field/`, ronda 3 ACEPTABLE CON RESERVAS |
| Kill-test MD-01 | El alta de médico avisa si el documento está registrado | `playwright test correcciones-… --grep MD-01` (simulador) | PASS 1/1 |
| Capturas | 52 capturas, 3 anchos × 2 temas, doble revisión con revisor independiente (4 rondas) | `playwright test capturas-c01-comprobantes` | PASS — `evidencia/capturas/`, `evidencia/doble-revision.md` |

## A medias

### H3.S2.M2 — paciente con el CI de un médico: una sola persona
- Qué anda: el paciente recibe el mismo 409 con código que el médico, y un médico puede darse de alta como paciente con su CI (int-spec 5 y 6; E2E paso 4).
- Qué no anda: la persona del médico y la del paciente no se unen; quedan dos `profiles.persons` con el mismo CI.
- Qué falta exactamente: decidir la identidad maestra (Q-13). Unir automáticamente por CI permite tomar la identidad de otra persona, así que no se hizo en el alta.
- Dónde quedó: `iam-patient-self-registration.service.ts`; compila; rama `claude/intelligent-faraday-444u25`.

### H3.S2.M3 — representantes de organización y altas asistidas
- Qué anda: el alta asistida de médico (administrador) rechaza el CI repetido (int-spec 7b). El alta de mostrador y los representantes quedan etiquetados con su tipo de titular.
- Qué no anda: el representante de organización queda fuera de la unicidad, con el supuesto de que una persona puede representar a varias empresas. No hay int-spec del alta de organización (exige cinco PDF).
- Qué falta exactamente: confirmar el supuesto con el dueño del alta de organizaciones; si la regla aplica, sumar el tipo al índice y un int-spec.
- Dónde quedó: `contact-person.ts`, `iam-organization-representatives.service.ts`, `walk-in-patient.ts`; compila.

### H3.S2.M5 — validador del documento en los tres registros
- Qué anda: médico y paciente consultan mientras se escribe (sin consultar si falta el departamento o el formato es inválido), marcan el campo con su propio mensaje, mapean el 409 por `details.reason` y, mientras la consulta espera, no dejan enviar campos inválidos (`hayAlgoInvalido`, bug encontrado por los specs y corregido). Specs 749+ en verde; E2E contra la API real 4/4, diez corridas seguidas.
- Qué no anda: el alta de organización no tiene validador.
- Qué falta exactamente: lo mismo que H3.S2.M3 (si la regla aplica a representantes).
- Dónde quedó: `shared-registration/document-availability*.ts`, `register-patient`, `register-practitioner`; compila.

### H2.S2.M5 — el cargo nace al iniciar la reserva
- Qué anda: el estado del cargo se deriva del comprobante aceptado o de la cuenta saldada; `PUT /scheduling/bookings/:id/payment-state` está marcado deprecado en OpenAPI.
- Qué no anda: el cargo no nace en `start` con sede y precio; se calcula desde el encuentro.
- Qué falta exactamente: decidir con Q-P2 si hace falta materializarlo; si sí, crear la cuenta por cobrar en `StartAppointmentUseCase`.
- Dónde quedó: API, rama del carril, compila y pasa.

### H2.S2.M7 — factura real con pago
- Qué anda: la factura fiscal simulada exige pago (422 `PAYMENT_REQUIRED`, int-spec caso 2b).
- Qué no anda: `POST /billing/invoices:issue-from-encounter` real no consulta `charge-settlement`.
- Qué falta exactamente: llamar a `paymentRequired(chargeSettlement(...))` en `InvoicesService.issueFromEncounter` y su int-spec.
- Dónde quedó: API, rama del carril.

### H2.S3.M6 — móvil
- Qué anda: nada todavía.
- Qué no anda: la hoja de cobro de la consulta en Flutter no muestra comprobantes.
- Qué falta exactamente: consumir `PaymentProofsClient` equivalente en `consultation_billing_sheet.dart` y su `flutter test`.
- Dónde quedó: sin tocar.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H3.S2.M6 (móvil: validador en Flutter) | TODO | Siguiente turno. |
| H4 (Colegio Médico) · H5 (consentimiento por sección) · H6 (encuestas) · H7 (Coolify) · H8 (cierre) | TODO | Siguiente turno. Kill-tests MD-02, MD-03 y MD-05 siguen en rojo. |
| Carril de Justin | TODO | El usuario pidió correrlo al terminar el de Pablo; no se empezó. |

## Evidencia

- API: `mantra-core-health-api/docs/trabajo/2026-10-23-doctor-pagos-identidad-consentimiento/evidencia/` (`h2-int-spec-c01.txt`, `h2-api-verificacion.txt`, `h2-regresion-cierre-encuentro.txt`).
- Modelo: `mantra-core-health-model/…/evidencia/h2-modelo.txt`.
- H3 API: `h3-int-spec-c10.txt` (11/11), `h3-seed-y-patch.txt`, `h3-orm-audit-resumen.txt`, `h3-regresion-altas.txt`. H3 front: `h3-vitest-front.txt`, `h3-e2e-c10-api-real.txt`, `capturas-h3/` (54), `capturas-h3-form-field/` (24), `doble-revision.md`.
- Front: `evidencia/h2-e2e-mutacion-api-real.txt`, `h2-datos-de-prueba-api-real.txt`, `h2-regresion-front.md`, `doble-revision.md`, `capturas/` (52).

```text
$ yarn test:integration test/integration/c01-comprobantes-de-pago.int-spec.ts
Tests:       14 passed, 14 total
$ yarn playwright test playwright/c01-aceptar-comprobante.spec.ts --workers=1   (API real)
  3 passed (17.9s)
$ yarn playwright test playwright/correcciones-2026-10-23-kill-tests.spec.ts --grep MD-06   (API real)
  1 passed (5.2s)
$ yarn test:integration test/integration/c10-ci-unico.int-spec.ts
Tests:       11 passed, 11 total
$ yarn test src/modules/iam src/modules/common src/modules/scheduling src/modules/profiles
Test Suites: 101 passed · Tests: 1734 passed
$ E2E_API_REAL=1 yarn playwright test playwright/c10-ci-unico-api-real.spec.ts   (×10)
  4 passed — 10/10 corridas seguidas
$ yarn ng test (auth, motor de formularios, simulador, iam)
  Tests 1659 passed · 1 failed (faker.spec, rojo previo)
```

## No cubierto

- H3: el alta de organización (representantes) y el móvil. El kill-test MD-01 corrió contra el simulador (contra la API real lo cubre `c10-ci-unico-api-real`). Los estados «comprobando», «sin respuesta» y «sin catálogo» se capturaron con la red interceptada.
- H3: el registro de médicos de la API real tiene un rojo previo, ajeno a C-10: `practitioner-registration` P19 (domicilio, 400), igual en HEAD sin estos cambios.

- Regresión completa del front: corrida por lotes. Los rojos de `features [d-l]`, `[m-p]` y de `core` también lo están en HEAD o pasan aislados. `account` (1 rojo) y `admin` (2 rojos) no tienen cambios de C-01, pero no se les corrió línea de base. `auth` y `auth-providers` no se corrieron.
- Regresión completa de la API: sólo billing, encounters y los int-specs de cierre (fx12, fx17, br14).
- Estados vacío y error capturados con la red interceptada: evidencia de UI, no de integración.
- C-02 contra un doble (`NoCoveragePatientShare`, siempre «Sin seguro»): falta integrarlo con el puerto real de Richard.
- La pantalla de pago del paciente (Richard) no existe: el paciente subió comprobantes por API en el sembrado y en la E2E.
- El simulador no bloquea el cierre del encuentro por pago.

## Desvíos del plan

- **H3: se reusa `issuer_administrative_area_concept_id`** (ya era el departamento de emisión) en vez de crear `issuer_department`; `owner_kind_concept_id` es un eje aparte de `owner_type`.
- **H3: `findDocumentHolder` nuevo** en vez de extender `findActiveDuplicate`, que usa el alta de mostrador con una semántica más estricta que se dejó igual.
- **H3: microtarea nueva H3.S2.M7** (`form-field` con `--text-danger`), pedida por la segunda pasada visual.
- **H3: partición por el ratchet de tamaño** (`check-max-lines`): el campo de departamento se extrajo a `issuer-department-field.ts`, el aviso «sin catálogo de departamentos» pasó al componente de estado y el simulador envuelve las altas con `MockRouter.envolver`. Así ningún archivo congelado creció.
- **H3: se corrigieron dos TEST_BUG propios.** El kill-test MD-01 no llenaba los obligatorios para avanzar. La E2E atrapaba la respuesta de una consulta anterior: era intermitente, se reprodujo y se demostró la causa con la captura.

- **422 en vez de 412.** El contrato C-01 dice 412; la casa mapea las precondiciones a 422 `PRECONDITION_FAILED` y el simulador ya lo documentaba así. El cliente distingue por `details.reason = PAYMENT_REQUIRED`.
- **«Pagos por sesión» en Contabilidad, no sólo en `/billing`.** El menú del médico es una lista cerrada del cliente (`navigation.service.spec.ts`); se agregó como tercera pestaña de Contabilidad, que ya está en ese menú. El kill-test MD-06 abre Contabilidad; la aserción es la misma.
- **Etiqueta «Pendiente»** en vez de «Pendiente de pago», por ancho en 390 px.
- **Endpoint nuevo `GET /billing/payment-proofs/:id/file`.** El médico no podía ver la imagen que subió el paciente.
- **Patch v4247** y no v4243: la copia de despliegue de la API ya llegaba a v4246.

## Riesgos residuales

- **H3: enumeración.** La consulta pública dice si un CI + departamento tiene cuenta de ese tipo. MD-01 lo pide; queda acotado por el límite de 60/min por IP y la respuesta sólo trae `available`. El alta ya lo revelaba con su 409.
- **H3: deuda del sistema de diseño** (dueño: sistema de diseño): los bordes de error siguen en `--c-error-500` en unos 10 controles (2,99:1 en oscuro), en claro el error se ve marrón y en oscuro el asterisco casi blanco. A esto se suman el hueco de la región de estado vacía en la grilla del motor y el aviso «sin catálogo» gris con «Reintentar» sin affordance.

- **BUG-C2-01 (producto, fuera de C-01, con arista de seguridad).** `GET /practices` devuelve todas las prácticas del tenant, y los médicos independientes comparten el tenant por defecto. La Contabilidad del médico abre la práctica de otro médico (422 «sin vinculación activa») y lista nombres de prácticas ajenas. Se nombró en la E2E en vez de ignorarlo. Dueño: práctica/contabilidad.
- **Mismo patrón arreglado en billing.** «La primera práctica del tenant» se usaba para el precio y el emisor de un cobro; ahora se resuelve por la asignación del profesional (`charge-settlement.ts`, `loadCharges`).
- **Base local con deriva.** Los patches v4223–v4246 de la API no estaban aplicados en la base local; se aplicaron (idempotentes). Cualquier entorno armado sólo desde el repo del modelo tiene la misma deriva.
- **Pendientes de componentes compartidos** que señaló la revisión visual (MENOR): fecha ISO partida en `patient-charges`, mensaje crudo en `errorToViewState`, pestaña en dos renglones, ▼ desalineado.
- **Rojos previos ajenos:** `billing.spec` «la puerta por omisión», `navigation.subgroups.spec`, `audit-trail-coverage.spec` (`PUT /community/ratings`), gate `check-api-prefixes` (`/admin/portal`), `check-colores-sueltos` (map.css), CSS desbalanceado en `data-table.css`.

## Decisiones y ambigüedades

- **H3 · Q-13:** ¿se une la persona del médico con la del paciente cuando comparten CI? Se tomó «no, en el alta»; queda escalada al propietario (identidad maestra).
- **H3:** ¿el representante de organización entra en la unicidad? Supuesto: no (representa a varias empresas). Confirmar con el dueño del alta de organizaciones.

- 422 vs 412 en C-01: confirmar con Richard, Ender e Itzan (consumidores).
- Dónde vive la tabla del prestador para el médico (Contabilidad): confirmar con el propietario.
- Aviso al paciente sin `destination` (la bandeja colapsaba «pagado» con un «rechazado» sin leer): el cargo va en el payload.
- Mockup: el usuario avisó que `mockup` tiene cambios visuales que no llegaron a `dev` ni `test`. Este trabajo se hizo sobre `dev` con componentes compartidos y sin restilizarlos. `billing/`, `payments-block/` y `consultation/` difieren entre `dev` y `mockup` en los dos sentidos: habrá que resolverlo al integrar.
