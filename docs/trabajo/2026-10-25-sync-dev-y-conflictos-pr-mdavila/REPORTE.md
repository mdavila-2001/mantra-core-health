# Reporte — Sync de dev y conflictos de PR (mdavila-2001)

- Fecha: 2026-10-25 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `wt/pr895`, `wt/pr904`, `wt/pr1279`, `wt/pr1287` (locales, en worktrees)
- Peldaño de evidencia alcanzado: `RUNS` (typecheck exit 0 en api #895/#904 y front #1279; generadores `--verificar` exit 0). No hay `VERIFIED`: no se ejercitó ningún flujo de UI/API.
- Avance: 8 HECHO / 10 microtareas = 80 % (1 DESCARTADO y 1 A MEDIAS: #1287 sin push).
- Estado final (consultado 2026-10-25 ~18:10 UTC): api #895 y #904 **MERGED** (18:03Z, por terceros tras el push); front #1279 `MERGEABLE`/`CLEAN`; front #1287 `CONFLICTING`/`DIRTY`, sin push (hook pre-push falla por entorno).

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | mobile `dev` al día con origin/dev | `git pull --ff-only origin dev` | fast-forward, `dev...origin/dev` sin `behind` (el `pubspec.lock` local modificado no se tocó) |
| H1.S1.M2 | docs `dev` | `git pull --ff-only origin dev` | `Already up to date.` |
| H1.S1.M3 | model: `origin/dev` traído a `marcelo/fix-signature-assets-my-claims` | `git merge --ff-only origin/dev` | fast-forward (24 commits; la rama queda `ahead 24` de su propio remoto, sin push) |
| H1.S1.M4 | api: `origin/dev` mergeado en `fix/cerrar-issues-abiertos` | `git merge --no-edit origin/dev` | merge limpio sin conflictos (`ahead 117` de su remoto, sin push) |
| H2.S1.M1 | api #895 sin conflicto | `gh pr view 895 --json isDraft,mergeable,mergeStateStatus` | `{"isDraft":false,"mergeStateStatus":"BLOCKED","mergeable":"MERGEABLE","number":895}` · `reviewDecision=REVIEW_REQUIRED` · `gh pr checks`: `no checks reported` |

## A medias
(H2.S2.M1 #904 y H2.S3.M1 #1279 pasaron a Completado tras el push; se conserva su detalle abajo como evidencia.)

### H2.S2.M1 — api #904 [HECHO] (`claude/fix-ronda-859-860-869` ← `claude/sync-test-en-dev`)
- Qué anda: 38 conflictos, todos en `inventario/**` y `docs/inventario/**` (generados; ninguno en `inventario/curado`). Regenerados con `tools/inventario/{endpoints,flujos,catalogo}.mjs` (`MODEL_ROOT` = repo del modelo local ya sincronizado). Los tres `--verificar` salen 0; `tsc --noEmit -p tsconfig.build.json` exit 0. Merge commit local `60e72074`.
- Qué no anda: nada detectado.
- Qué falta exactamente: push a la rama del PR (pendiente de confirmación) y `gh pr view 904` / `gh pr checks 904` posteriores.
- Dónde quedó: worktree `scratchpad/wt/api904`, rama local `wt/pr904`, `ahead 29` del remoto (fast-forward).

### H2.S3.M1 — front #1279 [HECHO] (`port/servicios-recibidos-test` ← `test`)
- Qué anda: 1 conflicto en `core/mock/handlers/index.ts`; ambos lados registraban un handler distinto (`registerReceivedServices` / `registerProcedureCenters`), se conservan los dos. `tsc -p tsconfig.app.json --noEmit` exit 0. `received-services.handlers.spec.ts` sola: 16/16. Merge commit local `3b7cc8e1c`.
- Qué no anda: corriendo los 45–47 specs de `core/mock/handlers/**` juntos, `received-services.handlers.spec.ts > un paciente no lee los servicios de otro` falla (`expected false to be 403`). **Preexistente**: falla igual en la cabeza del PR sin el merge (1 failed / 554 passed); `origin/test` puro pasa 46/46. No lo causa el merge; no se tocó.
- Qué falta exactamente: push (pendiente) y `gh pr view 1279`. Decidir si se arregla la dependencia de orden del spec (dueño del PR).
- Dónde quedó: worktree `scratchpad/wt/fe1279`, rama local `wt/pr1279`, `ahead 27`.

### H2.S4.M1 — front #1287 [A MEDIAS] (`claude/port-corr-lote-a` ← `dev`)
- Qué anda: 2 conflictos reales (`notification-center.ts` y `.spec.ts`), resueltos tomando el lado de dev en ambos hunks (dev ya trae el mismo trabajo con `UNREAD_TAB` y la recarga de «Sin leer»: commits `8335395d5` #1087 y `3b61b726f` #1299). Tras el merge, `git diff --cached origin/dev --name-only` da **0 archivos**: el árbol del PR es idéntico a dev. Merge commit local `b760c51a7`.
- Qué no anda: el PR ya no aporta nada neto sobre dev; empujar un merge vacío solo lo deja "mergeable" sin contenido.
- Qué falta exactamente: decisión del usuario (cerrar #1287 como superado, o empujar igual). Se le quitó el upstream a `wt/pr1287` para que VS Code no lo empuje solo.
- Dónde quedó: worktree `scratchpad/wt/fe1287`, rama local `wt/pr1287`, sin upstream.

### H2.S5.M1 — push y estado mergeable [HECHO para #904 y #1279; A MEDIAS para #1287]
- Push confirmado por el usuario. #904: `e8322c65..60e72074`. #1279: `45bab619a..3b7cc8e1c` (el hook pre-push construyó en producción y pasó). #1287: el hook pre-push **falló** al construir: `Could not resolve "three"`; el worktree usa como `node_modules` una junction al del checkout `mockup`, que no tiene `three` (dev sí lo declara). Es de entorno. No se usó `--no-verify`.
- `gh pr view 1279`: `{"baseRefName":"test","isDraft":false,"mergeStateStatus":"CLEAN","mergeable":"MERGEABLE","number":1279,"reviewDecision":""}` · `gh pr checks 1279`: `no checks reported`.
- `gh pr view 1287`: `{"baseRefName":"dev","isDraft":false,"mergeStateStatus":"DIRTY","mergeable":"CONFLICTING",...}` (sin push).
- #895/#904 (y #878): `state=MERGED`, `mergedAt` 18:03:26Z / 18:03:02Z / 18:03:59Z; no los mergeé yo.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S1.M5 | DESCARTADO | Front `mockup` ← `origin/dev`: 467 archivos en conflicto (mockup +880 / dev +444). Si se quiere igual, es un trabajo propio con su plan |

## Evidencia
- `git merge-tree --write-tree --name-only HEAD origin/dev` (front, mockup): 467 rutas en conflicto (33 en `public/anatomy-atlas-3d/catalog`, 24 en `src/app/core/mock/handlers`, 15 en `features/glossary`…).
- #895: `docs/modules/index.md` fila Total: `285 / 459 / 431 / 1274 / 532` = suma de las filas (verificado con awk); `node tools/docs/sync-module-docs.mjs` re-ejecutado → 0 cambios (idempotente). `tsc` exit 0.
- #904: `endpoints --verificar exit=0`, `flujos --verificar exit=0`, `catalogo --verificar exit=0`; `grep -rl '<<<<<<<' inventario docs/inventario` → 0. `tsc` exit 0.
- #1287: `git diff --cached origin/dev --name-only | wc -l` → 0.
- Remoto de #895: `git reflog show origin/claude/contabilidad-simple-p49` → `de05a818 … update by push`.

## No cubierto
- Ningún flujo de UI ni de API ejercitado (no hubo capturas; no aplica `critical-double-review`).
- Suite completa del front (4985 pruebas) y del api: no corridas; solo typecheck y los specs dirigidos indicados.
- Build completo (`yarn build`) del api: solo `tsc --noEmit`.
- `openapi/openapi.json` y `.yaml` se auto-fusionaron por texto en #895/#904 sin regenerar (`yarn docs:openapi:generate` exige build). Posible deriva no comprobada.
- CI remoto: los PRs de api muestran "no checks reported"; el CI del front está caído (CLAUDE.md del front). Ningún check verde que citar.

## Desvíos del plan
- **Push de #895 hecho por VS Code, no por mí.** El commit local `de05a818` apareció en el remoto (`update by push` en el reflog). La rama `wt/pr895` tenía upstream a la rama del PR y la config trae `vscode-merge-base`: el sync de VS Code la empujó. Fue fast-forward y es el resultado autorizado, pero ocurrió antes de la confirmación prometida.
- `git worktree prune` (ejecutado para reintentar el worktree de #1279) eliminó el registro de dos worktrees ya inexistentes del front: `C:/Alovida/mch-video` y `C:/Alovida/wt-marcelo-front-lane16` (marcados `prunable`; sus ramas siguen). Solo metadatos.
- `package.json`/`yarn.lock` no se tocaron. El front declara Yarn PnP en CLAUDE.md pero `.yarnrc.yml` usa `nodeLinker: node-modules`: discrepancia anotada, no corregida.

## Riesgos residuales
- Los worktrees de scratchpad tienen `node_modules` como **junction** hacia el real: no borrarlos con `rm -rf`/`git worktree remove --force` sin antes quitar la junction (`cmd /c rmdir <ruta>\node_modules`).
- Las ramas locales de api (`fix/cerrar-issues-abiertos`) y model (`marcelo/…`) tienen merges de dev sin push; si VS Code sincroniza, se empujarán.

## Decisiones y ambigüedades
- Front `mockup` ← dev: se omitió pese al pedido de "los 5 repos"; supuesto: el usuario esperaba un pull rutinario. Confirmar con el usuario.
- Resolución por merge (no rebase) para no reescribir historia publicada.
