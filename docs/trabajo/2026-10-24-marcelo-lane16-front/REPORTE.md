# Reporte — Carril 16 · Fase 3 frontend: cobro con seguro, desglose y objeción

- Fecha: 2026-10-24 · Plan: [PLAN.md](./PLAN.md) · Rama: `marcelo/lane16-insurance-ui` (base `origin/mockup` = `3cda242fd`) · PR: [#1227](https://github.com/mdavila-2001/mantra-core-health/pull/1227) contra `mockup`
- Peldaño de evidencia alcanzado: `TESTED` para el cotizador, el desglose y la objeción en el backend simulado. `VERIFIED` en navegador sobre la maqueta (25 pruebas Playwright). **No** `REGRESSION_VERIFIED`: la suite real de la API no corrió y el gate de PR no está demostrado.
- Avance: 18 de 27 microtareas HECHO = 66,7 % (cálculo sobre la tabla de hitos de [PLAN.md](./PLAN.md)).

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H0.M1–M4 | Worktree desde `origin/mockup`, dependencias, typecheck y baseline de tests | `corepack yarn install --immutable`; `corepack yarn typecheck` | exit 0; baseline de tests 27 archivos, 369 pruebas en verde (`evidencia/00-*.txt`) |
| H1 | Molécula `ClaimQuoteBreakdown`: cuatro cifras, líneas y badges, sin aritmética | `corepack yarn test --include='…/claim-quote-breakdown/**'` | 5 pruebas en verde |
| H2.S2 | Mock: cobertura de la persona, cotización (regla del propietario en centavos), alta de reclamo con las claves de `CreateClaimDto` | `corepack yarn test --include='…/insurance.claim-quote.handlers.spec.ts'` | 17 pruebas en verde, incluidos 500/50/80 → 140,00/360,00 |
| H2.S3 | Sección «Cobro con seguro» en el bloque «Pagos» de la consulta: cotización en vivo, bloqueo con motivo en usted, envío | `corepack yarn test --include='…/claim-quote/**'` y `…/payments-block/**` | 24 pruebas en verde |
| H2.S4 | Pendiente P62 registrado | lectura de `PENDIENTES-BACKEND.md` | entrada P62 |
| H3.S1–S3 | Desglose y objeción del paciente en «Mis solicitudes»: modal formal, motivo cerrado, idempotencia, despacho por actor | `corepack yarn test --include='…/my-requests/**'` y `…/insurer-received-claims*.spec.ts` | 11 + 28 pruebas en verde |
| H3.S4 | Pendiente P63 registrado | lectura de `PENDIENTES-BACKEND.md` | entrada P63 |
| H4.M1 | Tono del estado por código (aprobada/pagada, parcial, rechazada, en curso) en lista y detalle | `corepack yarn test --include='…/insurance-status-tone.spec.ts'` | 7 pruebas en verde |
| H4.M2 | Referencias clínicas reales por línea (estudio y dispensación) en el mock | `corepack yarn test --include='…/insurance.claim-references.handlers.spec.ts'` | 1 prueba en verde |
| H4.M3 | El error de «Reclamar» se dice junto al botón: el detalle no se pierde | revisión de `insurance-claim-detail.ts` y compilación | `corepack yarn typecheck` exit 0; lint del archivo sin errores |
| H5.S1 | Suite Playwright del mock: cotización, rechazo por aprobación, reparto, desglose, objeción, 375/768/1280 × claro/oscuro | `E2E_BASE_URL=http://localhost:4200 corepack yarn playwright test playwright/carril-16-cobro-con-seguro.spec.ts --project=chromium --workers=1 --max-failures=1 --reporter=list` | `25 passed (32.1s)` |
| H6.M2 | Doble revisión de las 26 capturas, pasada 1 y pasada 2 | [doble-revision.md](./evidencia/doble-revision.md) | 0 RECHAZADA; MAYOR 1 y 2 corregidos y re-capturados |
| H6.M3 | Mapeo archivo → REQ (abajo) | `git status` | todo archivo tiene fila |
| H6.M5 | Este reporte | — | — |

Nota de los comandos: `corepack yarn test --include=…` filtra por archivo. Los demás comandos son los del plan.

## A medias

### H0.M5 — Regeneración del contrato mock
- Qué anda: el contrato se regeneró desde `origin/dev` de la API (`gen-mock-contract.mjs`, 971 operaciones).
- Qué no anda: la regeneración cambia 65 esquemas que no son de este carril (por ejemplo `SignVersionDto`, que deja de exigir `signerProfileId`). Eso rompe el test C5 del validador. Se revirtió el archivo y el motivo de la objeción se registró como extensión de la maqueta.
- Qué falta exactamente: `gen-mock-contract.mjs --check` falla con `SyntaxError` al leer el archivo generado con finales de línea CRLF. Es un defecto del script en Windows, fuera de este carril.
- Dónde quedó: el contrato está igual que en `origin/mockup`. Cambio: `simulator-extensions.ts`.

### H2.S1 — Cliente de cotización
- Qué anda: `quoteClaim`, `createClaim` y `listCoveragesOfPatient` existen y se usan en la sección.
- Qué no anda: no hay spec dedicado del cliente que fije que el cuerpo lleva sólo claves del DTO.
- Qué falta exactamente: un spec `insurance.client.spec.ts` con los tres métodos.
- Dónde quedó: rama `marcelo/lane16-insurance-ui`, `src/app/core/data-access/insurance/`.

### H3.S4 — Contrato de «Mis solicitudes»
- Qué anda: P63 en `PENDIENTES-BACKEND.md`.
- Qué no anda: `docs/contracts/my-insurance-claims.md` no se actualizó con `breakdown` y `patientObjection`.
- Qué falta exactamente: agregar los dos campos al ejemplo del documento y la salvedad «sólo vista PATIENT».

### H4.M3 — Detalle a `toSignal`
- Qué anda: el error de reclamar ya no borra el detalle.
- Qué no anda: el detalle sigue cargando con `subscribe` manual; el plan pedía `toSignal(toObservable(...))`.
- Qué falta exactamente: el cambio de `load()` y su prueba de recarga por intento.

### H4.M4 — Specs del reclamo
- Qué anda: tono del badge, referencias del mock.
- Qué no anda: no hay specs del popup del paciente, del tooltip de referencia ni del flujo de reclamo.
- Qué falta exactamente: tres specs en `insurance-claim-detail.spec.ts` e `insurance-claims.spec.ts`.

### H5.S3 — MATRIZ-visual.md
- Qué anda: `REPORT.md` y la doble revisión de las capturas.
- Qué no anda: `MATRIZ-visual.md` no se escribió.
- Qué falta exactamente: la tabla de escena × ancho × tema × desborde × consola, en formato de `lane-40`.

### H6.M1 — Gates
- Qué anda: `typecheck` en verde; `lint` sin errores en los archivos tocados; `check-usted` sin hallazgos nuevos.
- Qué no anda: `lint` del repo tiene 266 errores en 197 archivos anteriores a este carril. La suite completa de tests tiene 5 fallos que ya están en `origin/mockup` (ver abajo). `gen-mock-contract --check` no corre.

### H6.M4 — PR mergeable
- Qué anda: PR #1227 contra `mockup`, no es borrador, sin conflictos, estado `CLEAN`.
- Qué no anda: `gh pr checks` no reporta ningún check. El CI del repo está caído (CLAUDE.md), así que el criterio de checks en verde no se puede demostrar.
- Qué falta exactamente: un CI que corra sobre el PR. Hasta entonces la entrega es A MEDIAS por esa causa, no HECHO.

Salida literal, consultada después del último push (`11c4060e6`; ver también `evidencia/10-pr-tras-ultimo-push.txt`):

```text
$ gh pr view 1227 --json isDraft,mergeable,mergeStateStatus,headRefOid,baseRefName
{"baseRefName":"mockup","headRefOid":"14495e3a46c4f8ac72b06c79946136cdb55247f6","isDraft":false,"mergeStateStatus":"CLEAN","mergeable":"MERGEABLE"}

$ gh pr checks 1227
no checks reported on the 'marcelo/lane16-insurance-ui' branch
```

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H5.S2 | BLOQUEADO | El login del administrador de arranque de la API local responde 500 (`INTERNAL`). Hay que diagnosticarlo en la API: ver Evidencia. |
| H2.S1 | A MEDIAS | Spec del cliente. |
| H3.S4 | A MEDIAS | Contrato en `docs/contracts/`. |
| H4.M3, H4.M4 | A MEDIAS | Cambio de `load()` y specs del reclamo. |
| H5.S3 | A MEDIAS | `MATRIZ-visual.md`. |
| H0.M5, H6.M1 | A MEDIAS | Bug de `gen-mock-contract.mjs --check` con CRLF; fallos previos de la suite. |
| H6.M4 | A MEDIAS | Consulta de `gh pr view` y `gh pr checks` tras el último push. |
| P62 | Pendiente de backend | Lectura de coberturas para el personal y rol del médico para cotizar (ambigüedad #1 del carril). |
| P63 | Pendiente de backend | Desglose y objeción en `GET /insurance/my-claims`; el POST de disputas acepta al paciente. |

## Evidencia

Salidas literales, recortadas:

```text
$ corepack yarn test --include='src/app/core/mock/handlers/insurance.claim-quote.handlers.spec.ts'
Tests  17 passed (17)

$ corepack yarn test --include='src/app/features/insurance/**/*.spec.ts' … (suite de seguros, 31 archivos)
Tests  415 passed (415)

$ corepack yarn test --watch=false   (suite completa, segunda corrida)
Test Files  5 failed | 816 passed (821)
Tests  5 failed | 11400 passed (11405)
  × app.routes.spec.ts · cada dirección vieja redirige a una ruta que existe
  × design-system-sample.spec.ts · el selector de tema sigue expuesto
  × messaging.spec.ts · no borra la bandeja cuando un tic falla
  × faker.spec.ts · cada ocupación y cada municipio de cada paciente existen
  × fichas-estandar.spec.ts · son tantas como los JSON que siembra el backend

$ git worktree (baseline limpio en 3cda242fd, misma corrida)
Test Files  6 failed | 808 passed (814)   — los mismos 5 más lab-orden-entrante (intermitente: pasó en la corrida siguiente)

$ E2E_BASE_URL=http://localhost:4200 corepack yarn playwright test playwright/carril-16-cobro-con-seguro.spec.ts --project=chromium --workers=1 --max-failures=1 --reporter=list
  25 passed (32.1s)

$ corepack yarn typecheck
exit 0
```

Login de la API local para la semilla real (salida literal):

```text
✗ login del administrador → 500 {"code":"INTERNAL","message":"Error interno del servidor", ...,"path":"/iam/auth/login"}
✗ No se pudo entrar como admin@alovida.com.
```

Mapeo archivo → requisito:

| Archivo | Requisito |
|---|---|
| `features/insurance/claim-quote/*` | REQ-16-026, 024 |
| `shared/components/molecules/claim-quote-breakdown/*` | REQ-16-026, 031 |
| `core/mock/handlers/insurance.handlers.ts` | REQ-16-026 (cotización), 014 a 018 (referencias), 022 (dominio) |
| `core/mock/handlers/insurer-received-claims.handlers.ts` | REQ-16-031, 032 |
| `core/data-access/insurance/*` | REQ-16-026, 031, 032 |
| `features/account/my-requests/*` | REQ-16-031, 032 |
| `features/clinical-record/patient-chart/payments-block/*` | REQ-16-026 (montaje en Pagos) |
| `features/insurance/insurance-claims/*`, `insurance-claim-detail/*` | REQ-16-001 a 022 (tono, error de reclamar) |
| `features/insurance/insurance-status-tone.ts` | REQ-16-008 |
| `core/mock/contract/simulator-extensions.ts` | REQ-16-032 (extensión pendiente P63) |
| `playwright/carril-16-cobro-con-seguro.spec.ts` | REQ-16-035 punto 5 |
| `playwright/carril-16-solicitudes-de-seguro.spec.ts` | REQ-16-035 (AC-16-17 a 375/768/1280 × claro/oscuro; escrito, no ejecutado) |
| `PENDIENTES-BACKEND.md` | P62, P63 |
| `docs/progress/evidence/lane-16/P0/*` | REQ-16-035 |

## No cubierto

- La suite real de la API (AC-16-1 a 18 con 375/768/1280 y tema oscuro): escrita, no ejecutada.
- La objeción en 375 y 768 px: sólo se capturó el modal a 1280 px.
- Estado bloqueado del envío en captura: cubierto por la suite, no por imagen.
- Accesibilidad con lector de pantalla y teclado sobre el modal de objeción: no probado fuera de la suite.
- Puntos 1 a 4 y 6 a 8 de REQ-16-035: son de la API y de revisión independiente.
- Los 5 fallos de la suite completa que ya estaban en `origin/mockup`.

## Desvíos del plan

- El contrato no se dejó regenerado: se revirtió por los 65 esquemas ajenos al carril. El motivo de la objeción entró como extensión de la maqueta (P63).
- La leyenda con la aprobación de prueba se retiró de la pantalla clínica antes de la entrega.
- La sección de cobro se muestra en ambos casos, con y sin facturación simulada; el plan lo decía así, y se verificó en el bloque.
- Se agregaron dos funciones exportadas en el mock para pruebas (`cotizarLinea`, `totalesDeLaCotizacion`, `quitarReclamoDeLaMaqueta`). No cambian la maqueta en uso.

## Riesgos residuales

- La cotización del médico exige roles que la API no mapea (ambigüedad #1): en la API real el envío fallará con 403.
- `billingProviderEntityId` sale del tenant activo en la maqueta: la API real puede rechazarlo (P62).
- El botón de objetar aparece para el paciente; si la API responde 403, la pantalla lo dice. No se oculta por adelantado.

## Decisiones y ambigüedades

- `TAREA-16-solicitudes-de-seguro.md` no existe en ningún repo. **Confirmado por el propietario:** se usa `requirements.md` y los AC-16-n del spec.
- «Resolicitar»: la UI dice «Reclamar» y «Reclamar otra vez». **Confirmado por el propietario:** se mantiene «Reclamar».
- Desglose del paciente en «Mis solicitudes» y no en «Mis citas»: decisión del propietario en la planificación.
- **Confirmado por el propietario:** cotiza el rol BILLING. Pendiente en la API: su `@Roles` declara BILLING y FINANCE, y `role-mapping.ts` no mapea esos códigos. Sin ese mapeo el envío real falla con 403.
- **Confirmado por el propietario:** el `billingProviderEntityId` sale del tenant activo.
- Pantalla de cobro del médico = bloque «Pagos» de la consulta: decisión del propietario en la planificación.
- Suite E2E híbrida: spec de la operadora contra la API real; flujos nuevos contra la maqueta. Decisión del propietario.
- La objeción es REQ-16-032, no 031 como dice la tarea. Se trabaja por el número de la fuente.
- Motivos de objeción en primera persona del paciente (`No me informaron de este cobro`): el validador de tono no los marca; a confirmar con el propietario.
