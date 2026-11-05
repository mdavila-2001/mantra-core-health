# Gobierno de accesos: la base del frontend

La fase 5 agrega permisos ultra granulares (73 átomos con condiciones) y gobierno de usuarios (reglas, separación de funciones,
cuatro ojos, campañas de certificación, ciclo de vida, administración delegada). Esta página es la **base común** que dejó el
bloque B6-base: los clientes y tipos, el manejo de desafíos, el simulador y las pantallas esqueleto. El contrato es
`CONTRATO-GOBIERNO.md` (§8.3 rutas, §9 frontend); la autoridad sigue siendo la API.

## Clientes (`core/data-access/access-governance/`)

Cada uno es `providedIn: 'root'`, solo transporte, y sus rutas están fijadas por `access-governance.clients.spec.ts`.

| Cliente | Rutas |
|---|---|
| `AccessExplainClient` | `POST /org/access/explain`, `POST /org/access/simulate`, `POST /me/support-access/explain`, `POST /me/practitioner/support-team/explain`, `GET /org/permission-catalog`, `GET /org/support-engagements/:id/summary` y `…/effective` |
| `AccessGovernanceClient` | reglas (`/org/governance/rules*`), ajustes, `normalize-legacy`, SoD (`sod-rules`, `sod-findings`, `sod-exceptions`), banderas de pacientes, tablero, matriz, informes, anomalías y exportación |
| `AccessApprovalsClient` | `/me/support-approvals*`, `GET /approvals/pending`, `POST /approvals/:id/decision` |
| `AccessReviewsClient` | `/org/access-reviews/campaigns*` y `/me/access-reviews/items*` |
| `AccessLifecycleClient` | `/org/lifecycle/cases*`, mover, dar de baja, suspender, reactivar, dueño, verificación de identidad, compromiso de confidencialidad |
| `TeamAdminClient` | `/org/team/*` (administración delegada) |
| `StepUpClient` | `POST` y `GET /iam/me/step-up` |

Los tipos están en `access-governance.types.ts` (barril), `access-explain.types.ts` y `conditions.types.ts` (el JSON de condiciones v1).
`support-atoms.ts` trae el catálogo de los 73 átomos y los 15 alias; `governance-summary.ts` arma los diez mosaicos del tablero.

## Desafíos de acceso (`core/access-challenge/`)

Cuando la API responde «falta algo» en vez de «no» (`422 REASON_REQUIRED`, `403 STEP_UP_REQUIRED`, `403 APPROVAL_REQUIRED` con
`X-Approval-Id` en el reintento, `409 FOUR_EYES_PAYLOAD_CHANGED`, y los sin salida `503 STEP_UP_UNAVAILABLE`, `429 STEP_UP_ATTEMPTS_EXCEEDED`),
`classifyAccessChallenge` los reconoce por `reason` y `AccessChallengeService` (con su diálogo `AccessChallengeDialog`) resuelve el
motivo, el segundo paso y la aprobación. Dos formas de uso: marcar la petición con `withAccessChallenge()` (la reintenta
`accessChallengeInterceptor`) o llamar `AccessChallengeService.run(...)`. Los bloques «Reservado» (`denialReason: 'RESERVED'`) se
reconocen con `isReservedBlock`.

## Simulador

El mock del gobierno de accesos (`core/mock/handlers/support-access.governance.*.ts`, `support-access.explain.handlers.ts`) cubre las
84 rutas con la forma de la API sobre el hospital piloto extendido (`core/mock/fixtures/support-hospital-governance.ts`). **No
reimplementa la política**: devuelve respuestas fijas por escenario. Para entrar como jefa de Ecografía: Sofía Camacho
(`sofia.camacho@alovida.mock`). El código del paso extra en el simulador es el de prueba de la verificación en dos pasos.

## Pantallas esqueleto

Cada pantalla vive en su carpeta de `features/access-governance/` y la reemplaza su agente:
`/administration/access-governance` (tablero), `/administration/access-governance/matrix`, `/administration/access-governance/anomalies`,
`/administration/access-governance/campaigns`, `/administration/access-governance/campaigns/new`,
`/administration/access-governance/campaigns/:campaignId`, `/administration/access-governance/sod`,
`/administration/access-governance/rules`, `/administration/access-governance/approvals`, `/administration/access-governance/lifecycle`,
`/administration/access-governance/lifecycle/:caseId`, `/administration/access-governance/simulator`,
`/administration/support-team/:engagementId/move`, `/administration/support-team/:engagementId/offboard`,
`/administration/team-management`, `/administration/team-management/:memberId`, `/my-reviews`, `/my-reviews/:itemId`,
`/my-team/reviews`, `/my-team/reviews/:itemId` y `/my-team/approvals`. Las rutas están en `app.routes.governance.ts` y las tres secciones de menú en `navigation.support.ts`.
