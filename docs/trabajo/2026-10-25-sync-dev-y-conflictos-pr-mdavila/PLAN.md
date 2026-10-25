# Plan — Sync de dev en los repos y resolución de conflictos de PR (mdavila-2001)

- Fecha: 2026-10-25 · Repos afectados: api, front, model, mobile, docs · Predecesor: ninguno
- Resultado observable: los 4 PRs de mdavila-2001 que hoy están `CONFLICTING` quedan `MERGEABLE` en GitHub; los repos pedidos tienen `origin/dev` traído.
- Kill-test: `gh pr view <n> --json mergeable,mergeStateStatus` sigue en `CONFLICTING`/`DIRTY` tras el push.
- Nota de ubicación: este plan vive sin commitear en el front (rama `mockup`) a propósito: las ramas de PR no deben llevar archivos de trabajo ajenos al PR.

## Alcance
- IN: (a) traer `origin/dev` a mobile, docs, model, api; (b) resolver conflictos de api #904, api #895, front #1287, front #1279 mergeando la base en la rama del PR (merge, no rebase: no reescribe historia publicada), en worktrees aparte; (c) push a esas 4 ramas tras confirmación del usuario.
- OUT: cualquier otro PR (los `CLEAN`/`BLOCKED` no se tocan); front `mockup`: NO se mergea dev (467 archivos en conflicto, ver Ambigüedades); cambios de funcionalidad en los PRs; `pubspec.lock` modificado de mobile (cambio local ajeno, se deja como está); PR #878 (draft, `UNKNOWN`).
- Ambigüedades registradas:
  - Front `mockup` ← `origin/dev`: el usuario pidió "los 5 repos mergeando dev", pero el dry-run (`git merge-tree`) da 467 conflictos (ramas largas divergentes, mockup +880 / dev +444). Supuesto: no es el pull rutinario que se imaginaba; se omite y se reporta. Confirmar con el usuario si quiere asumir ese merge como trabajo propio.
  - #904 tiene base `claude/sync-test-en-dev` (no `dev`). Supuesto: se resuelve contra esa base tal cual está en el PR.

## H1 — Repos sincronizados con origin/dev
**CA:** Dado mobile/docs/model/api, cuando se trae `origin/dev`, entonces `origin/dev` es ancestro de `HEAD` en cada uno.
**DoD:** `git merge-base --is-ancestor origin/dev HEAD` → exit 0 en los cuatro. **Estado:** EN CURSO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | mobile ff-only | dev == origin/dev | `git status -sb` sin `behind` | HECHO |
| H1.S1.M2 | docs ff-only | ya al día | `Already up to date` | HECHO |
| H1.S1.M3 | model ff (`origin/dev` → rama marcelo/…) | origin/dev ancestro | `merge-base --is-ancestor` | HECHO |
| H1.S1.M4 | api merge origin/dev en `fix/cerrar-issues-abiertos` | merge limpio, sin push | `merge-base --is-ancestor` | HECHO |
| H1.S1.M5 | front mockup ← dev | — | — | DESCARTADO (467 conflictos, ver Ambigüedades) |

## H2 — Cuatro PRs sin conflicto
**CA:** Dado un PR `CONFLICTING`, cuando se mergea su base en su rama y se resuelve entendiendo ambos lados, entonces `gh pr view` da `MERGEABLE`.
**DoD:** salida literal de `gh pr view <n> --json isDraft,mergeable,mergeStateStatus` y `gh pr checks <n>` tras el último push. **Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | api #895: conflicto en `docs/modules/index.md` | índice conserva las entradas de ambos lados | merge sin marcas `<<<<`; `yarn build` del api | TODO |
| H2.S2.M1 | api #904: conflictos en `inventario/**` y `docs/inventario/**` (generados) | inventario consistente con el código mergeado | regenerar con el generador del repo y `--check` si existe | TODO |
| H2.S3.M1 | front #1279: `src/app/core/mock/handlers/index.ts` | handlers de ambos lados registrados | `yarn typecheck` + spec dirigido | TODO |
| H2.S4.M1 | front #1287: `notification-center.ts` y `.spec.ts` | conserva el cambio de dev y el del PR (títulos del vacío, trato de usted) | `yarn typecheck` + spec de notification-center en verde | TODO |
| H2.S5.M1 | push confirmado + estado mergeable de los 4 | `MERGEABLE` y checks sin fallo | `gh pr view` / `gh pr checks` | TODO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Resolver "quedándome con lo mío" y perder cambios de dev | Regresión silenciosa | Leer ambos lados de cada hunk; correr la verificación dirigida |
| `inventario/**` es generado: merge manual produce JSON inconsistente | Inventario falso | Regenerar, no mezclar a mano |
| CI del front caído (CLAUDE.md del front) | Sin checks remotos | Correr yarn typecheck/test dirigido a mano y decirlo |
| Push a ramas ajenas | Pisar trabajo | Solo merge (fast-forward del remoto), nunca force |
