# Plan — Conflictos de PR restantes en todos los repos (api #921 y #913)

- Fecha: 2026-10-25 · Repos afectados: api · Predecesor: [2026-10-25-sync-dev-y-conflictos-pr-mdavila](../2026-10-25-sync-dev-y-conflictos-pr-mdavila/PLAN.md)
- Resultado observable: api #921 y #913 pasan de `CONFLICTING` a `MERGEABLE`.
- Kill-test: `gh pr view <n> --json mergeable,mergeStateStatus` sigue `CONFLICTING`/`DIRTY` tras el push.
- Nota de ubicación: plan sin commitear en el front, a propósito (no debe viajar en ningún PR).

## Alcance
- IN: revisión de PRs abiertos no mergeables en api, model, front, mobile, docs y AlovidaPromptManager (hecha: solo api #921 y #913 en conflicto; model #61/#63/#65/#66 salieron `UNKNOWN` y recalculados dan `MERGEABLE/CLEAN`; front, mobile, docs y PromptManager: ninguno). Para cada PR conflictivo: checkout de su rama en el checkout principal del repo (SIN worktrees, por pedido del usuario), `git merge origin/<base>`, resolver, verificar, push sin force.
- OUT: cualquier PR que ya esté `MERGEABLE`; cambios de funcionalidad; el resto de ramas locales.
- Ambigüedades: ninguna nueva. Supuesto: se resuelve por merge (no rebase) para no reescribir historia publicada.

## H1 — api #921 y #913 mergeables
**CA:** Dado un PR `CONFLICTING`, cuando se mergea su base en su rama y se resuelve entendiendo ambos lados, entonces `gh pr view` da `MERGEABLE`.
**DoD:** salida literal de `gh pr view <n> --json isDraft,mergeable,mergeStateStatus` y `gh pr checks <n>` tras el push. **Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | #921: conflicto en `docs/modules/index.md` (generado) | índice coherente con el código mergeado | `node tools/docs/sync-module-docs.mjs` idempotente + `tsc --noEmit -p tsconfig.build.json` exit 0 | TODO |
| H1.S2.M1 | #913: conflictos en `docs/modules/index.md` y `practice.md` (generados) | ídem | ídem | TODO |
| H1.S3.M1 | push de ambos y estado mergeable | `MERGEABLE` | `gh pr view` / `gh pr checks` | TODO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Checkout principal con cambios sin guardar | Pisar trabajo | `git status` limpio antes de cada checkout; volver a la rama original al terminar |
| Pre-push del api | Rechazo del push | Leer el mensaje; no `--no-verify` |
| VS Code empujando ramas solo | Pushes no confirmados | No crear ramas locales nuevas; trabajar sobre la rama del PR |
