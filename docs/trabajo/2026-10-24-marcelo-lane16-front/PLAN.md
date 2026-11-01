# Plan — Carril 16 · Fase 3 frontend: cotizador, desglose del paciente, E2E

- Fecha: 2026-10-24 · Repos afectados: mantra-core-health (front) · Predecesor: fase 1 y 2 de la API (PR #671, PR #722, mergeado en dev)
- Resultado observable: la médica ve el reparto del cobro en el bloque «Pagos» de la consulta y no puede enviar a la aseguradora sin aprobación previa; el paciente ve qué paga él y qué paga la aseguradora en «Mis solicitudes» y puede objetar el cobro.
- Kill-test: abrir la consulta con cobertura y un servicio que exige aprobación previa, sin id de aprobación, y comprobar que «Enviar a la aseguradora» queda deshabilitado con el motivo.

## Fuentes
- Requisitos: `C:\Alovida\carriles-por-persona\Marcelo\Aseguradora\lane-16-solicitudes-seguro-enviadas\requirements.md` (fuera de todo repo).
- Contrato API: worktree `C:\Alovida\wt-marcelo-api-lane16`, `src/modules/insurance/presentation/dto/claim-quote.dto.ts`, `claim-dispute.dto.ts`, `claim-patient-invoice.dto.ts`.

## Alcance
- IN: REQ-16-001 a 022 (verificar y completar), 026, 031, 032, 035 punto 5 (E2E serial, 375/768/1280, claro y oscuro).
- OUT: estilos globales y tokens; cambios en la API; enlace desde «Mis citas»; columnas «broker responsable» y «medio» (sin dato de origen); refactor del listado; puntos 1-4 y 6-8 de REQ-16-035.
- Ambigüedades registradas:
  1. `TAREA-16-solicitudes-de-seguro.md` no existe. Supuesto: `requirements.md` + AC-16-n del spec. A confirmar con el propietario.
  2. «Resolicitar»: la UI dice «Reclamar» / «Reclamar otra vez». Supuesto: se conserva el texto que asevera AC-16-11. A confirmar con el propietario.
  3. `billingProviderEntityId` no tiene fuente en el front. Supuesto: tenant activo en mock. A confirmar y pendiente de backend (P62).
  4. Capturas versionadas con nombres sintéticos del fixture. Supuesto: se enmascaran las celdas de nombre.

## H0 — Arranque y baseline
**Estado:** EN CURSO
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H0.M1 | Worktree desde origin/mockup | El worktree existe en la rama marcelo/lane16-insurance-ui | `git -C C:\Alovida\wt-marcelo-front-lane16 status -sb` → `marcelo/lane16-insurance-ui...origin/mockup` | HECHO |
| H0.M2 | Escribir este PLAN antes del primer edit | El archivo existe antes de cualquier cambio de código | `ls docs/trabajo/2026-10-24-marcelo-lane16-front/PLAN.md` | HECHO |
| H0.M3 | Instalar dependencias | Yarn instala sin cambios en el lockfile | `corepack yarn install --immutable` → exit 0 | TODO |
| H0.M4 | Baseline de typecheck, check-usted y tests de insurance | Sin fallos previos | salidas en `evidencia/00-*.txt` | TODO |
| H0.M5 | Regenerar contrato mock | `gen-mock-contract.mjs --check` pasa y contiene `/insurance-claims/quote` | salida en `evidencia/00-contrato.txt` | TODO |

## H1 — Molécula ClaimQuoteBreakdown
**CA:** Dado un vm con 140.00 y 360.00, cuando se renderiza, entonces muestra las cuatro cifras y una línea por ítem con su badge, sin recalcular.
**DoD:** `corepack yarn test` dirigido a `src/app/shared/components/molecules/claim-quote-breakdown` en verde.
**Estado:** TODO

## H2 — Cotizador del médico (REQ-16-026)
**CA:** Dado el paciente mock con cobertura, cuando la médica elige un servicio que exige aprobación previa y un monto, entonces ve el reparto y «Enviar a la aseguradora» deshabilitado con el motivo; con el id de aprobación, se habilita y el envío devuelve 201.
**DoD:** specs de cliente, mock (tabla de casos del propietario) y sección smart en verde; `payments-block.spec.ts` en verde.
**Estado:** TODO

## H3 — Portal del paciente (REQ-16-031 y 032)
**CA:** Dado un reclamo del paciente, cuando abre el detalle, entonces ve su parte y la de la aseguradora, y puede presentar una objeción con motivo cerrado que queda registrada y no se duplica.
**DoD:** spec `insurer-received-claims.objection.spec.ts` y specs de `my-requests` en verde.
**Estado:** TODO

## H4 — Reclamos (REQ-16-001 a 022)
**CA:** Las columnas y el detalle muestran datos reales del contrato; el error de reclamar no borra el detalle.
**DoD:** specs del popup, tooltip, flujo de reclamo y tono de badge en verde; matriz REQ → evidencia en REPORTE.md.
**Estado:** TODO

## H5 — Playwright
**CA:** La suite mock (9 tests) corre serial en 375/768/1280 claro y oscuro; la suite real queda ejecutada o BLOQUEADO con salida literal.
**DoD:** `corepack yarn playwright test <spec> --project=chromium --workers=1 --max-failures=1 --reporter=list` con salida pegada.
**Estado:** TODO

## H6 — Gates de cierre
**CA:** check-usted, lint, typecheck, tests completos y doble revisión de cada captura; PR mergeable con salida literal de gh.
**DoD:** `evidencia/doble-revision.md`, `evidencia/pr-<n>-mergeable.txt`, `REPORTE.md`.
**Estado:** TODO

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Docker no levanta | Mitad real de E2E BLOQUEADO | Entregar mock; salida literal |
| Id del fixture distinto del id de la consulta | Cotizador sin cobertura | Resolver en H2 por id real |
| Regeneración del contrato trae operaciones de dev | Diff grande en archivo generado | Declararlo en el PR |
| Rate limit 10 logins/min en API real | 429 | Dos logins; entrar() reintenta |
