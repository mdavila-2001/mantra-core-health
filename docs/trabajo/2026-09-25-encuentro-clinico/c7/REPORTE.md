# Reporte — C7: homogeneización de nombres, «Notas médicas», adiós a la hoja en blanco

> **AVANCE: 6 / 8 — 75,0 %.**

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/clinica-c7-nombres`
- Peldaño de evidencia alcanzado: `TESTED` en todas las áreas tocadas (typecheck + build + tests
  dirigidos en verde, con salida pegada). No `VERIFIED`: nada de esto se ejercitó en navegador
  todavía — ver H3 y "No cubierto".

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| C7.H1.M1 | Arranque, inventario de 56 archivos (13 grupos míos, 19 ajenos anotados) | `corepack yarn typecheck` | exit 0 (`evidencia/inventario.md`, `evidencia/inventario-conteo.txt`) |
| C7.H2.M1 | `note-grid/` → `measurement-grid/` (componente propio, ya no anidado en `free-note-block/`); `free-note-block` reducido a envoltorio `@deprecated` que delega en `measurement-grid` (no se pudo borrar: ver "Desvíos del plan") | `ng test --include=.../free-note-block/*.spec.ts --include=.../measurement-grid/*.spec.ts` | 2 files / 15 tests OK (`evidencia/h2m1-test.txt`) |
| C7.H2.M2 | `observation-block`: «Medición», «Registrar una medición», «Qué se midió», «¿En qué consulta se tomó?» | `ng test --include=.../observation-block/*.spec.ts --include=.../measurement-grid/*.spec.ts` | 2 files / 26 tests OK (`evidencia/h2m2-test.txt`) |
| C7.H2.M3 | `progress-notes` → «Notas médicas»: título, `maxHeight` + `app-pagination` local (ADR-0015), renombres `AttendedEncounter`/`MedicalNoteRow`, todos los rótulos y testids de UI | `ng test --include=src/app/features/progress-notes/*.spec.ts` | 1 file / 16 tests OK (`evidencia/h2m3-test.txt`); kill-test acotado a la carpeta = 0 (`evidencia/h2m3-killtest.txt`) |
| C7.H2.M4 | `procedures-block.html` («Nota clínica»→«Nota médica»), `faker/clinico.ts` (`notaDeEvolucion`→`textoDeNotaMedica` + constante privada) y su export; `care-plan-block`, `toast-samples.ts`, `aviso-ficha-medica.spec.ts` sin términos viejos | `ng test` (4 `--include`) | 5 files / 66 tests OK (`evidencia/h2m4-test.txt`) |
| C7.H4 (parcial) | Regresión ampliada de todo lo tocado + `navigation.service.spec.ts` (fila «Evoluciones»→«Notas médicas», rota por el cambio de H1) | `ng test` (9 `--include`), `corepack yarn typecheck`, `corepack yarn build` | 15 files / 234 tests OK (`evidencia/h4-regresion.txt`); typecheck exit 0 (`evidencia/h4-typecheck.txt`); build sin errores |

## A medias

### C7.H3.M1 — Playwright: renombre y ajuste de specs
- Qué anda: `playwright/pdf-premium-evoluciones.spec.ts` → `playwright/clinica-c7-notas-medicas-pdf.spec.ts` (`git mv`), con el título del test, el `heading` esperado, los nombres de captura y los mensajes de aserción actualizados a «Notas médicas». `consulta-rejilla.spec.ts` y `formularios-cuadricula.spec.ts` fueron revisados: ninguno necesitaba cambios (ver "Decisiones y ambigüedades"). `tsc -p playwright/tsconfig.json --noEmit` da exit 0.
- Qué no anda: ninguno de los tres specs se corrió contra un navegador real esta noche.
- Qué falta exactamente: `node scripts/pw-guard.mjs --port 4217 --spec playwright/clinica-c7-notas-medicas-pdf.spec.ts --spec playwright/consulta-rejilla.spec.ts --serve`, con Postgres + `mantra-core-health-api` arriba, en el pase final consolidado de la noche (mismo criterio ya usado en Farmacia/C9/C5, para no levantar el stack completo cuatro veces).
- Dónde quedó: rama `claude/clinica-c7-nombres`, compila, sin ejecutar.

### C7.H3.M2 — Capturas de «Notas médicas» y doble revisión crítica
- Qué anda: nada todavía — no se empezó.
- Qué no anda: no hay capturas.
- Qué falta exactamente: cinco viewports, claro/oscuro, con la doble revisión (regla 35) sobre las capturas finales, en el mismo pase consolidado de H3.M1.
- Dónde quedó: `TODO` en `PLAN.md`.

## Entrega — PR #682

`gh pr view 682 --json ...` → `mergeable: MERGEABLE`, `mergeStateStatus: UNSTABLE`,
`reviewDecision: ""` (evidencia literal en `evidencia/h4-pr-checks.txt`). El `UNSTABLE` es por los
tres checks (`dependencias`, `e2e`, `verificar`) en `pending`, no en `fail` — el runner propio de CI
está caído (memoria conocida: "El CI no corre"), no un fallo introducido por este trabajo. La entrega
queda a un check verde/una review de distancia de `MERGEABLE` limpio; no depende de código nuevo de
este carril.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| C7.H3.M1 (ejecución) | A MEDIAS | Levantar el stack (`ng serve` puerto 4217 + Postgres + API) para el pase consolidado de Playwright de la noche |
| C7.H3.M2 | TODO | Depende de C7.H3.M1 ejecutado |
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

$ ng test (9 --include, todo lo tocado por C7)
Test Files  15 passed (15)
     Tests  234 passed (234)
(evidencia/h4-regresion.txt)
```

Archivos completos de evidencia: `evidencia/inventario.md`, `evidencia/inventario-conteo.txt`,
`evidencia/free-note-block-grep.txt`, `evidencia/h2m1-test.txt`, `evidencia/h2m2-test.txt`,
`evidencia/h2m3-test.txt`, `evidencia/h2m3-killtest.txt`, `evidencia/h2m4-test.txt`,
`evidencia/h4-regresion.txt`, `evidencia/h4-typecheck.txt`, `evidencia/h4-lint.txt`.

## No cubierto

- Nada de esto se abrió en un navegador esta noche: ni el modal de «Registrar una medición», ni la
  pantalla «Notas médicas» con datos reales, ni el envoltorio `free-note-block` dentro de la
  consulta de verdad. Todo lo `HECHO` de arriba es peldaño `TESTED` (unitarios dirigidos + build),
  no `VERIFIED`.
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
