# Plan — C7: homogeneización de nombres, «Notas médicas», adiós a la hoja en blanco

- Fecha: 2026-09-25 · Repo: `mantra-core-health` (worktree `wt-clinica-c7`) · Rama: `claude/clinica-c7-nombres`
- Corte: `origin/mockup` @ `963b728358b9dd612087f89584e3931d40b0611c` (mismo que C5; sin novedades).
- Fuente: `AlovidaPromptManager/repartos/2026-09-25/PromptNoche/Pablo/Noche-EncuentroClinico.C7-Nombres/HomogeneizacionDeNombresYNotasMedicas.md`
- Kill-test: `grep -rniE "nota clínica|evoluci[oó]n|hoja en blanco" src/app --include=*.html --include=*.ts` fuera de C1–C6/C9 = 0.

## Bloqueo real, aislado (regla 65): no se puede borrar `free-note-block/**` sin romper `patient-chart.ts`
El prompt pide "eliminar `free-note-block/**`", pero `patient-chart.ts` (C3, fuera de mi alcance) lo
**importa y lo usa en su plantilla** (`patient-chart.ts:74,322`, `patient-chart.html:461`,
`<app-free-note-block>`). Borrar la carpeta entera rompe la compilación de un archivo que no puedo
tocar — no es un caso de "falta un dato" (como en C5): es un `NG8001`/`TS2307` real y compartido.
**Decisión:** no se borra el archivo. Se extrae la cuadrícula de mediciones a su propio componente
`measurement-grid/` (renombrado de `note-grid/`, que ya vivía adentro de `free-note-block/` y ya
importaba `TARGET_MEDICION` de `observation-block` — la cuadrícula siempre fue de mediciones, mal
ubicada). `free-note-block.ts` se reduce a un envoltorio que **ya no ofrece la hoja en blanco**
(se retira el editor de texto libre y toda la terminología vieja) y sólo monta `measurement-grid`,
conservando su selector `app-free-note-block` para que `patient-chart.ts` siga compilando sin
tocarlo. Queda marcado `@deprecated` con la instrucción exacta para que C3 (o quien toque
`patient-chart.ts` después) cambie la importación a `measurement-grid` directo y borre el envoltorio.
Esto cumple el **resultado observable** del kill-test (ninguna "hoja en blanco", ningún "nota clínica"
en pantalla) sin romper el build compartido.

**Desvío explícito del DoD literal de C7.H2.M1** (`grep -rn "free-note-block\|FreeNoteBlock" src` = 0):
con la decisión de arriba, ese grep da **37**, no 0 (`evidencia/free-note-block-grep.txt`). Los archivos
que quedan son: mis 3 propios (`free-note-block.{ts,html,spec.ts}`, el envoltorio en sí — no se pueden
eliminar por la razón de arriba), `measurement-grid.ts` (un comentario que documenta el origen),
`component-index.generated.ts` (autogenerado: el componente sigue existiendo, así que sigue listado), y
**3 archivos ajenos que lo consumen** — `consultation.{ts,html}`, `patient-chart.{ts,html}` (C3) y
`specialty-form-block.{ts,html}` (sin dueño declarado en mi ficha). Ninguno de los tres es mío, y
tocarlos para completar el rename es exactamente lo que la regla 00 §3 prohíbe. El DoD tal como está
escrito no es alcanzable sin romper el alcance de otro carril; el kill-test real de este trabajo (§2 del
prompt: nada de "hoja en blanco" ni "nota clínica" **visible**) sí se cumple.

## Alcance
- IN: archivos listados en la ficha del prompt (ver §0 del prompt fuente).
- OUT: todo lo de C1–C6/C9 aunque tenga términos viejos (se anota en el inventario, no se toca);
  `booking-status.ts`; rutas; `consultation/**`; tipos congelados.

## H1 — Arranque, baseline, inventario
**Estado:** HECHO
- `corepack yarn typecheck` exit 0. Inventario: `evidencia/inventario.md`.

## H2 — Los renombres y retiros
**Estado:** HECHO

| ID | Microtarea | Estado |
|---|---|---|
| C7.H2.M1 | `measurement-grid/` (ex `note-grid/`), `free-note-block` reducido (deprecated wrapper) | HECHO — `yarn typecheck` exit 0, `yarn build` sin errores, `ng test --include=.../free-note-block/*.spec.ts --include=.../measurement-grid/*.spec.ts` → 2 files / 15 tests OK (`evidencia/h2m1-test.txt`) |
| C7.H2.M2 | `observation-block` rótulos («Medición», «Registrar una medición», «Qué se midió», «¿En qué consulta se tomó?») | HECHO — `ng test --include=.../observation-block/*.spec.ts --include=.../measurement-grid/*.spec.ts` → 2 files / 26 tests OK (`evidencia/h2m2-test.txt`). `consulta-rejilla.spec.ts` **no** se ajustó para las casillas `observaciones`/`notas`: sus títulos vienen de `consultation.ts` (congelado, ajeno) — ver `evidencia/inventario.md` §Ajenos |
| C7.H2.M3 | `progress-notes` → «Notas médicas» (ADR-0015: barra + tabla `maxHeight` + `app-pagination` local; renombres `AttendedEncounter`/`MedicalNoteRow`) | HECHO — `yarn typecheck` exit 0, `yarn build` sin errores, `ng test --include=src/app/features/progress-notes/*.spec.ts` → 1 file / 16 tests OK (`evidencia/h2m3-test.txt`); `grep` del kill-test acotado a la carpeta → 0 hits (`evidencia/h2m3-killtest.txt`). **«Una fila por nota» NO se logró**: `GET /charts/notes?practitionerId&from&to` no existe en este corte (`clinical.handlers.ts` sólo tiene `POST /charts/notes` y `PUT/POST .../versions`) — se mantiene la fila por atención de hoy (bookings + chart bajo demanda), tal como el prompt lo admite como salida («si no, seguís con bookings + chart como hoy y lo anotás»). Documentado en el JSDoc del componente. |
| C7.H2.M4 | `care-plan-block`, `procedures-block`, `toast-samples`, `faker/clinico.ts`, `aviso-ficha-medica.spec.ts` | HECHO — `grep` acotado a los 5 archivos/carpetas → 0 hits; `procedures-block.html:266` «Nota clínica» → «Nota médica»; `faker/clinico.ts` `notaDeEvolucion`→`textoDeNotaMedica` (+ constante interna `EVOLUCIONES`→`TEXTOS_DE_NOTA`, privada, sin otros usos) y su export en `faker/index.ts`; `care-plan-block`, `toast-samples.ts`, `aviso-ficha-medica.spec.ts` no tenían términos viejos (0 hits ya en el inventario). `yarn typecheck` exit 0, `yarn build` sin errores, `ng test` con los 4 `--include` → 5 files / 66 tests OK (`evidencia/h2m4-test.txt`) |

## H3 — Playwright y capturas
**Estado:** A MEDIAS — escrito, correr y capturar diferido al pase final consolidado de la noche
(Farmacia/C9/C5 quedaron en la misma condición).

| ID | Microtarea | Estado |
|---|---|---|
| C7.H3.M1 | Renombrar `pdf-premium-evoluciones.spec.ts`→`clinica-c7-notas-medicas-pdf.spec.ts` (título, heading, capturas, mensajes); revisar `consulta-rejilla.spec.ts` y `formularios-cuadricula.spec.ts` | HECHO (con hallazgo ajeno) — **corregido el supuesto anterior: `scripts/pw-guard.mjs` no existe en el repo** (nunca se escribió pese a que los tres prompts clínicos lo dan por hecho); tampoco hace falta Postgres/API — la rama `mockup` corre contra el interceptor propio. Se corrió con `ng serve --port 4217` + `E2E_BASE_URL=http://localhost:4217 npx playwright test playwright/consulta-rejilla.spec.ts playwright/clinica-c7-notas-medicas-pdf.spec.ts`. **`clinica-c7-notas-medicas-pdf.spec.ts`: PASS** (8.3 s) — «Notas médicas» en el heading, botón de PDF, sin desborde en los 5 viewports, descarga real, consola limpia (evidencia/playwright/pdf-premium/). **`consulta-rejilla.spec.ts`: FAIL, ajeno a C7** — timeout esperando `getByRole('textbox', {name:'Buscar por nombre o código'})` en `/medical-records`; el campo real es `label="Nombre o código"` (`clinical-record.html:29`, commit `15e93630`, muy anterior a esta noche). Es un locator desactualizado de un archivo fuera de mi alcance (`clinical-record.html`), no una regresión de C7 — bloquea antes de llegar a la rejilla de consulta, así que **las casillas `observaciones`/`notas` (los dos hits ajenos de `consultation.ts` documentados en el inventario) no se pudieron verificar visualmente esta noche**. Evidencia en `evidencia/playwright/consulta-rejilla-fallo/`. `formularios-cuadricula.spec.ts` no se corrió: no aplica a C7 (confirmado en H1, no toca `note-grid`/`measurement-grid`). |
| C7.H3.M2 | Capturas de «Notas médicas», cinco viewports, claro/oscuro; doble revisión crítica | A MEDIAS — **tema claro: HECHO**, 5/5 viewports, doble pasada (regla 35.1) → **APROBADA**, sin hallazgos bloqueantes (`evidencia/doble-revision.md`). **Tema oscuro: TODO**, no capturado (el spec no alterna tema). `observation-block`/`measurement-grid` dentro de la consulta: no capturables esta noche por el bloqueo ajeno de `consulta-rejilla.spec.ts` |

## H4 — Cierre
**Estado:** HECHO — commits por carpeta/archivo, push a `claude/clinica-c7-nombres`, PR #682 a
`mockup` (reviewers `jsaldias39`, `PabloArauzCaballero`), `REPORTE.md` escrito.
`mergeable: MERGEABLE` / `mergeStateStatus: UNSTABLE` (checks del runner propio en `pending`, caído
— ver `evidencia/h4-pr-checks.txt` y `REPORTE.md` §"Entrega"). **PR #682 mergeado a `mockup`** —
confirmado con `gh pr view 682 --json state` → `MERGED` y con el contenido real presente en
`origin/mockup`.

**Reconsulta post-PR:** mientras esto se cerraba, PR #677 (C9) y PR #679 (C5) se mergearon a
`mockup` (`963b7283` → `9fa933be`), y Farmacia tocó `navigation.{map,subgroups}.ts` y
`navigation.service.spec.ts` — los mismos archivos donde C7 cambió una línea. Se hizo
`git merge origin/mockup` (regla 35.2.6: "tras mergear la base, el estado se vuelve a consultar"):
sin conflictos. `component-index.generated.ts` quedó con un `TS2307` esperado tras el merge
(memoria conocida: el índice generado queda viejo) — resuelto con
`node scripts/generate-component-index.mjs` (gitignorado, no se commitea). Re-verificado completo:
`yarn typecheck` exit 0, `yarn build` sin errores, `ng test` (9 `--include`) → 15 files / 235 tests
OK (`evidencia/h4-regresion-post-merge.txt`, un test más que antes del merge: la fila del carrito de
Farmacia en `navigation.service.spec.ts`).

Daily de equipo (`Pablo-Daily-Noche-2026-09-25.md`, sección «Carril C») actualizado y pusheado a
`main` del repo `AlovidaPromptManager` — ver commit ahí.
