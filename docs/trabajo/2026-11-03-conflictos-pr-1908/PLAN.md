# Plan — Resolver los conflictos de #1908

- Fecha: 2026-11-03 · Repos afectados: mantra-core-health · Predecesor: [2026-11-03-conflictos-pr-frontend](../2026-11-03-conflictos-pr-frontend/PLAN.md)
- Resultado observable: #1908 queda MERGEABLE y su diff contra `dev` es sólo `appointments.organizaciones.spec.ts` (13 casos nuevos en verde).
- Kill-test: `git diff --stat origin/dev` debe listar un único archivo; si lista más, quedó residuo de #1902/#1905.

## Alcance
- IN: merge de `origin/dev` en `feat/pruebas-organizaciones-1899`; resolver con la versión de `dev` los conflictos de `appointments.spec.ts` y `support-access.provisioning.handlers.spec.ts`; correr los specs; push; gate de mergeable.
- OUT: cambiar el contenido de los 13 casos; los demás fallos de la suite; cualquier código de producción.
- Ambigüedades registradas: la rama apila los commits de #1902 y #1905, ambos cerrados por superados (su contenido ya está en `dev`). Supuesto: se descartan, no se reaplican. Confirmar con quien abrió los PRs.

## H1 — #1908 mergeable con sólo su spec nuevo
**CA:** Dado `origin/dev` actual, cuando se mergea la rama, entonces no hay conflictos y el diff contra `dev` es un único archivo, con sus 13 casos en verde.
**DoD:** `git diff --stat origin/dev` (1 archivo); `ng test` dirigido a `appointments.organizaciones.spec.ts` y `appointments.spec.ts`; `gh pr view 1908 --json isDraft,mergeable,mergeStateStatus` → MERGEABLE.
**Estado:** EN CURSO

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Merge de dev, conflictos con versión de dev | Sin marcadores de conflicto | `git diff --name-only --diff-filter=U` → vacío | TODO |
| H1.S1.M2 | Diff final = un archivo | Sólo el spec nuevo | `git diff --stat origin/dev` | TODO |
| H1.S2.M1 | Specs dirigidos | 13 + existentes en verde | `ng test --include` de ambos specs | TODO |
| H1.S2.M2 | Lint dirigido | Sin errores | `yarn eslint src/app/features/account/appointments` → exit 0 | TODO |
| H1.S3.M1 | Push y gate | PR sin conflictos | `gh pr view 1908 …` y `gh pr checks 1908` | TODO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| El spec nuevo depende del `montar()` de #1905 | Casos en rojo tras tomar el de dev | Correrlo; si falla, diagnosticar y ajustar sólo lo mínimo, registrándolo |
| Red de GitHub intermitente | Gate no demostrable | Reintentar con `timeout` |
