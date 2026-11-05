# Reporte — Conflictos de PR restantes (api #921 y #913)

- Fecha: 2026-10-25 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `claude/contabilidad-simple-p49-test`, `pablo/cm-05-busqueda-de-centros-medicos-dev` (en el checkout principal del api, sin worktrees)
- Peldaño de evidencia alcanzado: `RUNS` (`tsc --noEmit` exit 0 en ambos; generador idempotente). Sin `VERIFIED`: no se ejercitó ningún flujo.
- Avance: 3 HECHO / 3 microtareas = 100 %

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | #921 sin conflicto: `docs/modules/index.md` regenerado (total `288/462/434/1274/534` = suma de filas) | `node tools/docs/sync-module-docs.mjs` (2.ª pasada: 0 cambios) · `tsc --noEmit -p tsconfig.build.json` | exit 0. Merge `ed5e0823`, push `a378fa55..ed5e0823` |
| H1.S2.M1 | #913 sin conflicto: `index.md` y `practice.md` regenerados (total `286/461/434/1274/533` = suma de filas) | ídem | exit 0. Merge `19fb7a6f`, push `bfdbe261..19fb7a6f` |
| H1.S3.M1 | Estado en GitHub tras el último push | `gh pr view` / `gh pr checks` | #921: `{"baseRefName":"test","isDraft":false,"mergeStateStatus":"CLEAN","mergeable":"MERGEABLE","number":921,"reviewDecision":""}` · #913: `{"baseRefName":"dev","isDraft":false,"mergeStateStatus":"BLOCKED","mergeable":"MERGEABLE","number":913,"reviewDecision":"REVIEW_REQUIRED"}` (BLOCKED solo por revisión humana pendiente). Ambos: `no checks reported` |

## A medias
ninguna

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Aprobación de #913 | `REVIEW_REQUIRED` | Revisión humana (la regla de la rama protegida) |

## Evidencia
- Barrido final de PRs abiertos no `MERGEABLE` en api, model, front, mobile, docs y AlovidaPromptManager: lista vacía en los seis (`gh pr list --state open --json number,mergeable,mergeStateStatus`).
- Model #61/#63/#65/#66 estaban `UNKNOWN` al inicio; recalculados: `MERGEABLE/CLEAN`.

## No cubierto
- Sin build completo ni suites del api; solo `tsc --noEmit`.
- `openapi/*` no regenerado (se auto-fusionó por texto).
- Sin checks de CI remoto que citar (`no checks reported`).

## Desvíos del plan
ninguno. El checkout principal del api volvió a `fix/cerrar-issues-abiertos` con el árbol limpio. Se crearon dos ramas locales nuevas (`claude/contabilidad-simple-p49-test`, `pablo/cm-05-…-dev`) en el checkout principal para poder mergear; ambas están completas en remoto.

## Riesgos residuales
- Esas dos ramas locales siguen existiendo; se pueden borrar con `git branch -D` (están completas en remoto).

## Decisiones y ambigüedades
- Merge de la base en la rama del PR (no rebase), sin force.
