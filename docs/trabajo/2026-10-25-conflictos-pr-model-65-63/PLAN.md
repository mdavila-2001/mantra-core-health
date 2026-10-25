# Plan — Conflictos de PR en model (#65 y #63)

- Fecha: 2026-10-25 · Repos afectados: model · Predecesor: [2026-10-25-conflictos-pr-api-921-913](../2026-10-25-conflictos-pr-api-921-913/PLAN.md)
- Resultado observable: model #65 y #63 pasan de `CONFLICTING/DIRTY` a `MERGEABLE`.
- Kill-test: `gh pr view <n> --json mergeable,mergeStateStatus` sigue `CONFLICTING` tras el push.
- Nota: plan sin commitear en el front, a propósito (no debe viajar en ningún PR).

## Alcance
- IN: #65 (`claude/p49-contabilidad-simple` ← `origin/dev`): `model-manifest.yaml`, `modules/diagram_33_integrity.puml`, `SQL/_generation_report.md`. #63 (`claude/compassionate-shannon-rw6526` ← `origin/dev`): `docs/architecture/physical-materialization.md`, `model-manifest.yaml`, `seedsGenerales/checksums.json`, `seedsGenerales/seed-manifest.json`. Checkout de la rama del PR en el checkout principal del model (SIN worktrees), merge de `origin/dev`, resolver, verificar con los validadores/generadores del repo, push sin force.
- OUT: otros PRs (los demás salen `MERGEABLE` o ya están mergeados); cambios de contenido del modelo más allá de lo que exige el conflicto; la rama `marcelo/fix-signature-assets-my-claims` (se vuelve a ella al terminar, sin tocarla).
- Ambigüedades: por ver al leer los hunks (los `.yaml`/`.puml`/`.md` pueden ser edición manual de ambos lados: se resuelve entendiendo los dos y se registra). Supuesto: merge, no rebase.

## H1 — model #65 y #63 mergeables
**CA:** Dado un PR `CONFLICTING`, cuando se mergea `dev` en su rama y se resuelve entendiendo ambos lados, entonces `gh pr view` da `MERGEABLE` y los validadores del repo siguen en verde.
**DoD:** salida literal de `gh pr view <n> --json isDraft,mergeable,mergeStateStatus` y `gh pr checks <n>` tras el push, más la salida de los validadores/generadores. **Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | #65: generados (`SQL/_generation_report.md`) | se regenera, no se mezcla a mano | generador del repo (a localizar) idempotente | TODO |
| H1.S1.M2 | #65: `model-manifest.yaml` y `diagram_33_integrity.puml` | quedan las entradas de ambos lados | parseo YAML/validador del repo | TODO |
| H1.S2.M1 | #63: `seedsGenerales/checksums.json` y `seed-manifest.json` | checksums coinciden con los archivos reales | verificador/generador del repo | TODO |
| H1.S2.M2 | #63: `model-manifest.yaml` y `physical-materialization.md` | quedan las entradas de ambos lados | validador del repo | TODO |
| H1.S3.M1 | push de ambos y estado mergeable | `MERGEABLE` | `gh pr view` / `gh pr checks` | TODO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Ambos PRs tocan `model-manifest.yaml` y dev acaba de mergear otros: el segundo en entrar vuelve a chocar | Re-conflicto | Resolver, empujar y re-consultar `gh pr view` de ambos al final |
| Checksums/seed-manifest mezclados a mano | Datos de integridad falsos | Regenerar con el script del repo, no editar a mano |
| Checkout principal con cambios | Pisar trabajo | `git status` limpio antes de cada checkout (hoy: 0 cambios); volver a la rama original |
| Pre-push del repo | Rechazo del push | Leer el mensaje; nunca `--no-verify` |
