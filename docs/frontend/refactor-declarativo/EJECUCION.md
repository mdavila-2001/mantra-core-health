# Registro de ejecución

Todo corrido en `C:\…\alovida\mch-refactor-declarativo` (worktree de
`pablo/refactor-frontend-declarativo`), Windows 11, Node 22.23.1, Yarn 4.18.0, el 2026-09-21.
Estados: `passed` · `failed` · `not-run` · `blocked`. Un fallo preexistente se conserva en la
tabla; no se elimina ni se presenta como regresión.

## Baseline (antes de tocar nada) · `5a0776c66b005ad4d2d6722321e933cd7adea621`

| checkId | Comando | Salida | Estado | Notas |
|---|---|---|---|---|
| B-01 | `corepack yarn install --immutable` | 0 | passed | `nodeLinker: node-modules` |
| B-02 | `corepack yarn stock:generate` | 0 | passed | 537 componentes · 191 con algo que mirar |
| B-03 | `corepack yarn lint` | 0 | passed | |
| B-04 | `corepack yarn typecheck` | 0 | passed | tres proyectos `tsc` |
| B-05 | `corepack yarn test --watch=false` | 1 | **failed (preexistente)** | 561 archivos · 6985/6988. Fallan: `app.routes.spec` («una sección disponible NO cae en el placeholder»), `accounting/resumen.spec` («pide el estado de resultados SEIS veces»), `auth/register-practitioner.spec` («cinco tipos canónicos de credencial») |
| B-06 | `node scripts/check-architecture.mjs` | 1 | **failed (preexistente)** | 3 ciclos (`core/mock/fixtures/personas` ↔ `insurer-network`, ↔ `registered-people`; `agenda/month-view` ↔ `day-view`), 1 import contra capas (`mock-backend.spec` → `phone-input.paises`), 1 `fetch` fuera de `data-access` (`core/messaging/adjunto-metadata`). Idéntico corrido en el worktree `mch-pablo-tabla-canonica` sobre el mismo corte |
| B-07 | `corepack yarn prettier --check` sobre los 6 archivos de producto que se iban a editar | 1 | failed (preexistente) | Ninguno cumplía en la base. Regla D-17: no se formatean archivos que no cumplían (esconde el cambio real) |

## Tras el incremento · `5a0776c` + cambios de la rama

| checkId | Comando | Salida | Estado | Notas |
|---|---|---|---|---|
| R-01 | `corepack yarn stock:generate` | 0 | passed | 536 componentes (el banco ya no se lista a sí mismo) · 190 con algo que mirar |
| R-02 | `corepack yarn typecheck` | 0 | passed | |
| R-03 | `corepack yarn lint` | 0 | passed | |
| R-04 | `corepack yarn ng test --watch=false --include …` (data-table, component-stock, patient-list, organization-list, services-catalog, insurance-claims) | 0 | passed | 7 archivos · 110/110. Incluye los 8 de `cursor-history.spec` y los 40 de `escenarios.spec` |
| R-05 | `corepack yarn test --watch=false` (1.ª corrida) | 1 | failed (entorno) | Murió con `Fatal process out of memory: Zone` mientras el servidor de desarrollo seguía arriba. No se cuenta |
| R-06 | `corepack yarn test --watch=false` (2.ª corrida, sola) | 1 | **failed (preexistente + entorno)** | 563 archivos · 7009/7020. Fallan: los 3 preexistentes (B-05) + `child-organization-new.spec`, `tenant-binding-form.spec`, `reset-password.spec` con «Worker exited unexpectedly» (1,6 GB libres de 16 durante la corrida) |
| R-07 | `corepack yarn ng test --watch=false --include …` (los 6 archivos de R-06, aislados) | 1 | **failed (preexistente)** | 6 archivos · 190/192. Los tres que cayeron por el worker pasan; quedan `resumen.spec` y `register-practitioner.spec`, que ya fallaban en B-05. `app.routes.spec` pasa aislado: su fallo depende del orden |
| R-08 | `node scripts/check-architecture.mjs` | 1 | failed (preexistente) | Los mismos 5 hallazgos de B-06, ninguno en archivos tocados |
| R-09 | `corepack yarn prettier --check` sobre los 9 archivos nuevos | 0 | passed | Los 6 preexistentes de B-07 siguen igual, a propósito |
| R-10 | `node scripts/inventario-organismos.mjs` | 0 | passed | 1045 aristas · 0 hallazgos (ningún import sin instanciar, ningún selector sin importar) |
| R-11 | `corepack yarn ng serve --port 4377` + `corepack yarn node playwright/refactor-declarativo-evidencia.mjs` | 0 | passed | 56/56 comprobaciones · 0 errores de página · capturas en `docs/frontend/evidence/refactor-declarativo/` |
| R-12 | `corepack yarn build` | 0 | passed | 98,7 s. Inicial 1,19 MB (aviso a 620 kB, error a 1,3 MB: preexistente). 30 avisos `anyComponentStyle`; el de `component-stock.css` (7,94 kB) ya excedía los 4 kB antes de los ≈0,5 kB de esta oleada. El fragmento del banco es diferido (`chunk … component-stock`, 455 kB): nada entra al paquete inicial |
| R-13 | `node scripts/check-doc-links.mjs` · `node scripts/check-doc-coverage.mjs` | 1 · 1 | failed (preexistente) | 7 enlaces rotos en `docs/tareas/subtarea-2.4-…` hacia `artifacts/`; un organismo y tres servicios sin mencionar. Ninguno en los documentos de esta oleada |
| R-14 | `node scripts/generate-component-index.mjs --check` · `node scripts/inventario-organismos.mjs --check` | 0 · 0 | passed | 536 componentes · 1045 aristas |

## Lo que no se ejecutó, y por qué

| Ítem | Estado | Motivo |
|---|---|---|
| Cypress (`yarn e2e`) | not-run | Cubre recorridos por actor contra la API viva; nada de esta oleada cambia un recorrido |
| Playwright del repo (`yarn pw`) | not-run | Los specs entran contra la API real (`contextoDeApi`), no disponible en esta máquina. La evidencia de esta oleada es un script propio contra el simulador |
| Comparación por píxel banco ↔ pantalla | blocked | No hay arnés de captura pareada; se deja en ✘ en `MIGRACION.md` |
| Auditoría axe desde el banco | not-run | El botón existe en la pestaña «Accesibilidad»; no se automatizó en esta oleada |
