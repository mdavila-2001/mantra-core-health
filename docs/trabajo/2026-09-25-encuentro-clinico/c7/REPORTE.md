# Reporte — C7: homogeneización de nombres, «Notas médicas», adiós a la hoja en blanco

> **AVANCE: 7 / 8 — 87,5 %.**

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/clinica-c7-nombres`
- Peldaño de evidencia alcanzado: **`VERIFIED_FUNCTIONAL_ONLY`** para «Notas médicas» (Playwright real
  corrido, PASS, tema claro en 5 viewports, doble revisión hecha — falta tema oscuro). `TESTED` para
  el resto de las áreas tocadas (typecheck + build + tests dirigidos en verde). `observation-block` y
  el envoltorio `free-note-block`→`measurement-grid` dentro de la consulta siguen en `TESTED`: no se
  pudieron ejercitar en navegador esta noche por un bloqueo ajeno (ver H3.M1 abajo).

**Corrección sobre un supuesto anterior de este mismo reporte:** se creía que el pase de Playwright
necesitaba levantar Postgres + `mantra-core-health-api`. Es falso — la rama `mockup` corre contra el
interceptor propio del front, sin backend. Lo que sí faltaba, y no se había detectado antes, es que
**`scripts/pw-guard.mjs` no existe en el repo**: los tres prompts clínicos (C9, C5, C7) lo dan por
escrito y corriendo, pero nadie lo escribió nunca. Se corrió con el mecanismo real del repo en su
lugar: `ng serve --port <PUERTO>` + `E2E_BASE_URL=http://localhost:<PUERTO> npx playwright test
<spec>` (`playwright.config.ts:41` ya lee esa variable). Esto se avisa en el daily para que alguien
lo escriba o se corrija la instrucción de los prompts.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| C7.H1.M1 | Arranque, inventario de 56 archivos (13 grupos míos, 19 ajenos anotados) | `corepack yarn typecheck` | exit 0 (`evidencia/inventario.md`, `evidencia/inventario-conteo.txt`) |
| C7.H2.M1 | `note-grid/` → `measurement-grid/` (componente propio, ya no anidado en `free-note-block/`); `free-note-block` reducido a envoltorio `@deprecated` que delega en `measurement-grid` (no se pudo borrar: ver "Desvíos del plan") | `ng test --include=.../free-note-block/*.spec.ts --include=.../measurement-grid/*.spec.ts` | 2 files / 15 tests OK (`evidencia/h2m1-test.txt`) |
| C7.H2.M2 | `observation-block`: «Medición», «Registrar una medición», «Qué se midió», «¿En qué consulta se tomó?» | `ng test --include=.../observation-block/*.spec.ts --include=.../measurement-grid/*.spec.ts` | 2 files / 26 tests OK (`evidencia/h2m2-test.txt`) |
| C7.H2.M3 | `progress-notes` → «Notas médicas»: título, `maxHeight` + `app-pagination` local (ADR-0015), renombres `AttendedEncounter`/`MedicalNoteRow`, todos los rótulos y testids de UI | `ng test --include=src/app/features/progress-notes/*.spec.ts` | 1 file / 16 tests OK (`evidencia/h2m3-test.txt`); kill-test acotado a la carpeta = 0 (`evidencia/h2m3-killtest.txt`) |
| C7.H2.M4 | `procedures-block.html` («Nota clínica»→«Nota médica»), `faker/clinico.ts` (`notaDeEvolucion`→`textoDeNotaMedica` + constante privada) y su export; `care-plan-block`, `toast-samples.ts`, `aviso-ficha-medica.spec.ts` sin términos viejos | `ng test` (4 `--include`) | 5 files / 66 tests OK (`evidencia/h2m4-test.txt`) |
| C7.H4 (parcial) | Regresión ampliada de todo lo tocado + `navigation.service.spec.ts` (fila «Evoluciones»→«Notas médicas», rota por el cambio de H1); merge de `origin/mockup` (C9 #677 y C5 #679 ya integrados) y re-verificación completa | `ng test` (9 `--include`), `corepack yarn typecheck`, `corepack yarn build` | 15 files / 235 tests OK post-merge (`evidencia/h4-regresion-post-merge.txt`); typecheck exit 0; build sin errores |
| C7.H3.M1 | Playwright de «Notas médicas» corrido de verdad contra `ng serve` | `E2E_BASE_URL=http://localhost:4217 npx playwright test playwright/clinica-c7-notas-medicas-pdf.spec.ts` | **PASS** (8.3 s) — heading «Notas médicas», botón PDF, 0 desborde en 5 viewports, descarga real, consola limpia (`evidencia/playwright/pdf-premium/`) |

## A medias

### C7.H3.M1 — `consulta-rejilla.spec.ts`, bloqueado por un archivo ajeno
- Qué anda: se corrió de verdad (`ng serve --port 4217` + Playwright). `clinica-c7-notas-medicas-pdf.spec.ts` da `PASS`.
- Qué no anda: `consulta-rejilla.spec.ts` da `FAIL` — timeout en `/medical-records` esperando `getByRole('textbox', {name:'Buscar por nombre o código'})`. El campo real tiene `label="Nombre o código"` (`clinical-record.html:29`, commit `15e93630`, muy anterior a esta noche): un locator desactualizado en un archivo fuera de mi alcance, no una regresión de C7.
- Qué falta exactamente: que quien pueda tocar `clinical-record.html` o `consulta-rejilla.spec.ts` corrija el locator. Mientras tanto, las dos casillas que a C7 le interesaban de ese spec (`observaciones`→«Registrar una observación», `notas`→«Escribir una nota clínica», ambas en `consultation.ts`, también ajeno) **no se pudieron verificar visualmente** esta noche: el spec nunca llega a esa pantalla.
- Dónde quedó: `claude/clinica-c7-nombres`, evidencia en `evidencia/playwright/consulta-rejilla-fallo/`.

### C7.H3.M2 — Tema oscuro de «Notas médicas»
- Qué anda: tema claro, 5 viewports, corrido y con doble revisión — **APROBADA** (`evidencia/doble-revision.md`).
- Qué no anda: tema oscuro no se capturó — el spec existente no lo alterna.
- Qué falta exactamente: un test o una corrida manual con `data-theme="dark"` en los mismos 5 viewports, con su propia doble revisión.
- Dónde quedó: `A MEDIAS` en `PLAN.md`.

## Entrega — PR #682

`gh pr view 682 --json ...` → `mergeable: MERGEABLE`, `mergeStateStatus: UNSTABLE`,
`reviewDecision: ""` (evidencia literal en `evidencia/h4-pr-checks.txt`). El `UNSTABLE` fue por los
tres checks (`dependencias`, `e2e`, `verificar`) en `pending`, no en `fail` — el runner propio de CI
está caído (memoria conocida: "El CI no corre"), no un fallo introducido por este trabajo.

**Actualización:** `gh pr view 682 --json state` → **`MERGED`**. El propietario lo mergeó a `mockup`
verificado (`git show origin/mockup:src/app/features/progress-notes/progress-notes.html` contiene
«Notas médicas»). C7 queda completamente integrado.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| C7.H3.M1 (`consulta-rejilla.spec.ts`) | BLOQUEADO | Locator desactualizado en `clinical-record.html`/`consulta-rejilla.spec.ts`, ajeno a C7 |
| C7.H3.M2 (tema oscuro) | TODO | Escribir/correr una variante con `data-theme="dark"` |
| Rename de `FreeNoteBlock`/`app-free-note-block` a `measurement-grid` en `patient-chart.ts` | BLOQUEADO | `patient-chart.ts` es de C3, congelado esta noche — ver "Desvíos del plan" |
| Renombrar los títulos de modal «Observación»/«Nota clínica» en `consultation.ts` | BLOQUEADO | `consultation.ts` está explícitamente fuera de mi ficha («ARCHIVOS DE OTROS») |
| Renombrar el nombre de archivo del PDF (`evoluciones-<fecha>.pdf`) en `progress-notes-pdf.ts` | BLOQUEADO / A CONFIRMAR | El archivo no está en mis `ARCHIVOS RESERVADOS`; a confirmar con C8 si debía serlo |

## Evidencia

```text
$ grep -rniE "nota clínica|evoluci[oó]n|hoja en blanco" src/app/features/progress-notes/
(0 líneas)

$ grep -rn "free-note-block\|FreeNoteBlock" src | wc -l
37   # ver evidencia/free-note-block-grep.txt — desglose completo en PLAN.md

$ corepack yarn typecheck
exit 0 — 549 componentes, 306 pantallas (evidencia/h4-typecheck.txt)

$ corepack yarn build 2>&1 | grep -iE "error|✘"
(sin salida = build limpio)

$ ng test (9 --include, todo lo tocado por C7, post-merge de origin/mockup)
Test Files  15 passed (15)
     Tests  235 passed (235)
(evidencia/h4-regresion-post-merge.txt)

$ E2E_BASE_URL=http://localhost:4217 npx playwright test playwright/clinica-c7-notas-medicas-pdf.spec.ts
1 passed (8.3s)
(evidencia/playwright/pdf-premium/)
```

Archivos completos de evidencia: `evidencia/inventario.md`, `evidencia/inventario-conteo.txt`,
`evidencia/free-note-block-grep.txt`, `evidencia/h2m1-test.txt`, `evidencia/h2m2-test.txt`,
`evidencia/h2m3-test.txt`, `evidencia/h2m3-killtest.txt`, `evidencia/h2m4-test.txt`,
`evidencia/h4-regresion.txt`, `evidencia/h4-regresion-post-merge.txt`, `evidencia/h4-typecheck.txt`,
`evidencia/h4-lint.txt`, `evidencia/h4-pr-checks.txt`, `evidencia/doble-revision.md`,
`evidencia/playwright/pdf-premium/`, `evidencia/playwright/consulta-rejilla-fallo/`.

## No cubierto

- El modal «Registrar una medición» (`observation-block`) y el envoltorio `free-note-block`→
  `measurement-grid` dentro de una consulta real no se abrieron en navegador esta noche: el único
  spec que llega ahí (`consulta-rejilla.spec.ts`) falla antes, en un paso ajeno a C7. Siguen en
  peldaño `TESTED` (unitarios dirigidos + build), no `VERIFIED`.
- «Notas médicas» sí se verificó en navegador (tema claro, 5 viewports, PASS) — es la única pieza de
  C7 en peldaño `VERIFIED_FUNCTIONAL_ONLY`. Falta el tema oscuro.
- No se verificó accesibilidad (foco, lector de pantalla) sobre `app-pagination` recién agregado a
  `progress-notes`, más allá de lo que ya cubre el propio componente compartido.
- No se corrió la suite completa (`yarn test`) — por la inestabilidad ya documentada de esta
  máquina bajo carga (ver memoria de sesiones anteriores); se usó regresión acotada por `--include`
  en su lugar, sobre las 9 carpetas/archivos que este carril tocó.

## Desvíos del plan

1. **`free-note-block/**` no se eliminó**, aunque el prompt lo pedía literalmente. `patient-chart.ts`
   (C3, congelado esta noche) importa `FreeNoteBlock` y la usa en su plantilla
   (`patient-chart.ts:74,322`, `patient-chart.html:461`). Borrar la clase habría roto la compilación
   de un archivo fuera de mi alcance — un `NG8001`/`TS2307` real y compartido, no una falta de dato
   simulable con regla 65. Se aplicó la regla 65 de todas formas donde sí correspondía: se aisló la
   pieza reutilizable (`measurement-grid`) y se dejó un envoltorio `@deprecated` mínimo que cumple el
   contrato (`selector`, inputs, outputs) sin ofrecer ya la hoja en blanco, con la instrucción exacta
   para que C3 complete el cambio cuando pueda tocar `patient-chart.ts`. El DoD literal de C7.H2.M1
   (`grep -rn "free-note-block\|FreeNoteBlock" src` = 0) por lo tanto **no da 0, da 37** — desglosado
   en `PLAN.md` §"Bloqueo real" y `evidencia/free-note-block-grep.txt`.
2. **«Una fila por nota» en `progress-notes` no se logró.** El prompt mismo preveía esta salida:
   «si no [existe la lectura de colección], seguís con bookings + chart como hoy y lo anotás». Se
   verificó que `GET /charts/notes?practitionerId&from&to` no existe en este corte
   (`clinical.handlers.ts` sólo expone `POST /charts/notes` y `PUT/POST .../versions`), así que se
   mantuvo la fila por atención (booking) de hoy, con el texto de la nota bajo demanda. Documentado
   en el JSDoc de `progress-notes.ts`.

## Riesgos residuales

- Mientras `patient-chart.ts` no adopte `measurement-grid` directo, el nombre `FreeNoteBlock`/
  `app-free-note-block` sigue vivo en el árbol como envoltorio deprecado. Es intencional y
  documentado, pero es deuda: cualquiera que grep-ee "FreeNoteBlock" sin leer el JSDoc puede
  pensar que la homogeneización no se hizo.
- `progress-notes-pdf.ts` sigue nombrando el archivo descargado `evoluciones-<fecha>.pdf` desde una
  pantalla que ahora se llama «Notas médicas» — inconsistencia visible para quien lo descargue, sin
  dueño claro esta noche.
- Los títulos de los modales «observaciones»/«notas» en la rejilla de consulta (`consultation.ts`)
  siguen diciendo «Observación» y «Nota clínica» — los mismos términos que este carril retira en
  todos sus propios archivos, pero visibles igual porque viven en un archivo congelado (C3).

## Decisiones y ambigüedades

1. **`playwright/formularios-cuadricula.spec.ts`** figuraba en mi ficha de archivos reservados para
   "ajustar a `measurement-grid`", pero es del generador de formularios (pregunta tipo cuadrícula
   Sí/No) y no tiene relación con `note-grid`/`measurement-grid`. Se registró como imprecisión de la
   ficha y no se tocó el archivo. Confirmar con quien armó la ficha si esperaba otra cosa.
2. **`docs/components/catalog.md`** figuraba con "fila de `free-note-block`" en la ficha, pero ese
   documento no tiene una tabla por componente de `features/` (sólo cubre átomos/moléculas/
   organismos de `shared/` y remite al inventario generado para el resto). No había fila que
   actualizar; no se inventó una. El inventario generado (`docs/reports/generated/
   component-inventory.md`) sí tiene esa fila, pero regenerarlo trajo ~148 líneas ajenas a otros
   carriles (drift del baseline, no de este cambio) — se descartó esa regeneración para no mezclar
   trabajo ajeno en este PR.
3. **`shared/utils/progress-notes-pdf/**`** no está en mis `ARCHIVOS RESERVADOS`, aunque genera el
   PDF de la pantalla que sí reescribí. Se decidió no tocarlo (nombre de archivo `evoluciones-
   <fecha>.pdf` sin cambiar) para no invadir alcance ajeno sin confirmación. A confirmar con C8.
4. **`scripts/pw-guard.mjs` no existe.** Los tres prompts clínicos de esta noche (C9, C5, C7) citan
   `node scripts/pw-guard.mjs --port ... --spec ... --serve` como si ya existiera. No se escribió
   nunca en este repo (verificado con una búsqueda completa del árbol). Se decidió **no escribirlo
   esta noche** — es infraestructura compartida, fuera del alcance declarado de C7, y el fallback
   real del repo (`ng serve --port X` + `E2E_BASE_URL=http://localhost:X npx playwright test
   <spec>`, que sí funciona con `playwright.config.ts:41`) alcanza para verificar sin inventar una
   herramienta nueva de paso. Avisado en el daily de equipo para que alguien lo escriba o se corrija
   la instrucción de los tres prompts.
5. **`consulta-rejilla.spec.ts` falla por un locator ajeno** (`clinical-record.html`, «Nombre o
   código» vs. el «Buscar por nombre o código» que el spec espera, desde el commit `15e93630`,
   anterior a esta noche). No se corrigió: ni el archivo ni el spec están en mi alcance declarado
   para ese propósito, y arreglarlo sería un fix de un bug ajeno de paso. Queda avisado en el daily.
