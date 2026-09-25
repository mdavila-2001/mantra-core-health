# Reporte — Transparencia de exclusiones y liquidación conciliada (Tarea 3 · H8 / MED-E13..E16), lado front

**AVANCE (front): 10 / 10 microtareas de H4+H5 — HECHO.** El alcance de este
worktree (`mantra-core-health`, rama `marcelo/feat-insurance-exclusions-settlement-contracts`)
era H4 (front) y H5 (E2E). H1–H3 (contrato canónico y lote periódico de la
API) y el resto de H6 pertenecen al repositorio `mantra-core-health-api`
(rama `marcelo/feat-practitioner-settlement-batches-api`), ya reportados ahí
por separado en `A MEDIAS (36%)` con PR #459 contra `dev`.

## Qué se entregó

- **H4 — desglose de tres importes y exclusiones formales** en el detalle del
  prestador (`/administration/insurance-claims/:claimId`) y en la tarjeta del
  paciente (`app-patient-insurance-settlement`), con verificación de la
  ecuación (`totalBilled = approved + patient + denied`, suma de exclusiones
  = rechazado) hecha en el navegador con aritmética decimal exacta
  (`core/money/decimal-strings.ts`, sin `Number`). Corrigió además un error
  real de la maqueta: `totalPatientAmount` contaba el rechazo dos veces
  (`CLM-2026-0177` mostraba 420 sobre 300 facturados).
- **H5 — cobertura E2E** (`playwright/carril-insurance-exclusions-settlement.spec.ts`,
  4 pruebas: prestador × 2 viewports, paciente × 2 viewports). La primera
  corrida real contra la maqueta viva encontró y permitió corregir dos
  defectos de layout que ninguna prueba unitaria podía ver:
  1. El badge de la cláusula hereda `white-space: nowrap` del átomo `Badge`
     (pensado para chips cortos); con ~250 caracteres de texto legal
     desbordaba la página. Se corrigió poniendo la clase que anula el
     `nowrap` directamente en el `<app-badge>`, no en su contenedor.
  2. La tabla de exclusiones nueva reutilizó `.claim__table` (que exige
     mínimo 52 rem de ancho) sin el `.claim__table-scroll` que la contiene:
     a 390 px empujaba `<body>` entero. Se agregó el envoltorio, igual que ya
     tiene la tabla de ítems.
  Detalle completo de la primera y segunda pasada en
  `evidencia/double-review.md` (regla 35); las cuatro pantallas quedan
  `APROBADA` tras la corrección.

## Verificación

| Comando | Resultado |
|---|---|
| `yarn ng test --watch=false` (9 archivos de H4: `decimal-strings`, `insurance.client`, `patient-insurance-settlement.types`, `insurance-claim-detail`, `patient-insurance-settlement`, `insurance.handlers`) | 93 pruebas, todas en verde |
| `yarn typecheck` | 0 errores |
| `yarn lint` | 252 errores preexistentes de `@angular-eslint/prefer-on-push-component-change-detection` en archivos `*.spec.ts` que este carril no toca (deuda del repo, verificada línea por línea contra el diff); ninguno en los archivos modificados aquí |
| `E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/carril-insurance-exclusions-settlement.spec.ts --workers=1` | 4/4 passed (`evidencia/playwright-exclusions-settlement.txt`) |

## Archivos tocados

Ver `git log --oneline origin/dev..HEAD` (tres commits): tipos y cliente de
`core/data-access/insurance`, `core/money/decimal-strings.ts`,
`insurance-claim-detail.{html,ts,css,spec.ts}`,
`patient-insurance-settlement.{html,css,spec.ts}`,
`patient-insurance-settlement.types.ts`, `insurance.handlers.ts`,
`docs/integrations/backend-api.md`, y el spec E2E nuevo con su evidencia.

## Fuera de alcance de este worktree (no se tocó)

- H1–H3 y el resto de H6 (contrato, lote periódico, regeneración de OpenAPI):
  repositorio de la API, ya reportado por separado.
- Los 252 problemas preexistentes de lint (`prefer-on-push-component-change-detection`)
  en archivos ajenos a este carril: deuda del repo, no se corrigió por no
  ser parte del diff mínimo de esta tarea.
- El panel flotante «Modo de demostración» del propio entorno de maqueta que
  se superpone levemente a una tarjeta en la captura de escritorio del
  paciente: es ajeno a este carril y no afecta ninguna aserción.

## Siguiente paso

`git fetch origin dev && git rebase origin/dev`, push y
`gh pr create --base dev --reviewer "jsaldias39,PabloArauzCaballero"`.
