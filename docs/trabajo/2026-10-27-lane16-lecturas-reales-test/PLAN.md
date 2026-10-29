# Plan — Port a test del ajuste del front del carril 16 (lecturas reales)

- Fecha: 2026-10-27 · Repos afectados: mantra-core-health · Predecesor: [lecturas-reales (PR a dev)](../2026-10-25-lane16-lecturas-reales/PLAN.md)
- Resultado observable: en `test`, la sección de cotizar pide los seguros de la persona a la API real y «Mis solicitudes» muestra desglose y objeción cuando la API los trae.
- Kill-test: en `origin/test`, `listCoveragesOfPatient` envuelve la llamada en `simulatorOnly` (devuelve «no disponible» contra la API real).

## Alcance
- IN: el mismo cambio de `src/` del PR a dev (cliente, tipos, maqueta, 2 specs).
- OUT: `api-contract.generated.ts` (3 operaciones ajenas atrasadas), cualquier fallo previo de `test`.
- Ambigüedades: las del plan de dev.

## H1 — Port a test
**CA:** Dado `origin/test`, cuando se aplica el cambio, entonces compila, sus specs pasan y no aparecen fallos nuevos en la suite completa.
**Estado:** A MEDIAS (falta la revisión humana del PR y verlo contra la API real)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.M1 | Aplicar el cambio sobre `origin/test` | sin conflictos | `git cherry-pick -n` | HECHO |
| H1.M2 | Typecheck | exit 0 | `yarn typecheck` | HECHO |
| H1.M3 | Lint de lo tocado | exit 0 | `yarn eslint <archivos>` | HECHO |
| H1.M4 | Specs dirigidos | en verde | `yarn test --include=…` | HECHO |
| H1.M5 | Suite completa comparada con la base | ningún fallo nuevo de seguros | `yarn test` + aislado con y sin el cambio | HECHO |
| H1.M6 | PR a `test` mergeable | MERGEABLE | `gh pr view` + `gh pr checks` | EN CURSO |
