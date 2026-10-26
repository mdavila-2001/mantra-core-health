# Plan — Port del front del carril 16 (PR #1227) a test

- Fecha: 2026-10-25 · Repos afectados: mantra-core-health · Predecesor: [port a dev, PR #1377](../2026-10-25-lane16-front-port-dev-test/PLAN.md)
- Resultado observable: en `test`, el bloque «Pagos» de la consulta cotiza el cobro con seguro, y «Mis solicitudes»
  muestra el desglose al paciente y permite objetarlo.
- Kill-test: `git grep -c ClaimQuote origin/test -- src/app/features/clinical-record` daba 0 antes del port.

## Alcance
- IN: el mismo cambio de `src/` y `playwright/` del PR #1377 (ya adaptado a las convenciones de dev), aplicado sobre `origin/test`.
- OUT: `PENDIENTES-BACKEND.md`, las capturas de `docs/progress/evidence/lane-16/`, la carpeta de trabajo de #1227; los
  fallos que `origin/test` ya tiene (se anotan, no se arreglan).
- Ambigüedades registradas: las del plan de dev. Supuesto adicional: el cambio de dev sirve tal cual en test porque
  `mockBackend` también viene en `false` allí y el contrato declara `objectionReason`; se verifica con typecheck y specs.

## H2 — Port a test
**CA:** Dado `origin/test`, cuando se aplica el cambio, entonces la UI de cotización, desglose y objeción existe en test y
sus pruebas pasan sin agregar fallos a los que test ya tiene.
**DoD:** typecheck, specs dirigidos, suite completa comparada con la base, lint, Playwright de la maqueta, `gh pr view`/`gh pr checks`.
**Estado:** A MEDIAS (falta la revisión humana del PR; ver REPORTE)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H2.M1 | Rama desde `origin/test` y aplicar el mismo cambio | diff solo `src/` y `playwright/` | `git diff --stat origin/test` | HECHO |
| H2.M2 | Typecheck | exit 0 | `yarn typecheck` | HECHO |
| H2.M3 | Specs dirigidos sin fallos nuevos | solo fallan los que ya fallaban en la base | `yarn test --include=…` | HECHO |
| H2.M4 | Suite completa comparada con `origin/test` limpio | ningún archivo falla por seguros | `yarn test` con y sin el port | HECHO |
| H2.M5 | Lint de lo tocado | exit 0 | `yarn eslint <archivos>` | HECHO |
| H2.M6 | Playwright del cobro + revisión de capturas | 25/25, nota por pantalla | `yarn pw playwright/carril-16-cobro-con-seguro.spec.ts` | HECHO |
| H2.M7 | PR a `test` mergeable | MERGEABLE | `gh pr view` + `gh pr checks` | EN CURSO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| `origin/test` ya tiene specs en rojo | Confundirlos con fallos del port | Correr la suite con y sin el port y comparar |
| Pre-push construye el front | Push lento | Esperarlo; no `--no-verify` |
| Merge a `test` exige revisión humana | El flujo termina en abrir el PR | Se declara en el reporte |
