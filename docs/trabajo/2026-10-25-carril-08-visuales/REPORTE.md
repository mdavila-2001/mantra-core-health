# Reporte — Carril 08: corrección sobre visuales generales (fondo reactivo)

- Fecha: 2026-10-25 · Plan: [PLAN.md](./PLAN.md) · Rama(s): `leonardo/carril-08-visuales-dev` (PR #1328 → `dev`), `leonardo/carril-08-visuales-test` (PR #1331 → `test`)
- Peldaño de evidencia alcanzado: **`VERIFIED`**, sólo en modo demo (`ng serve`, mock). **No** `REGRESSION_VERIFIED`: el spec oficial del carril no corrió (necesita la API real) y no hay checks de GitHub (el CI propio del repo está caído, `CLAUDE.md`). No se declara «listo» ni «cerrado».
- Avance: **11 / 14** microtareas (78,6 %) — 11 hechas, 1 a medias (H1.S2.M1), 2 pendientes (H1.S4.M1 bloqueada, H1.S5.M2 se registra en cada PR).

## Completado

| ID | Qué se logró | Evidencia | Resultado |
|---|---|---|---|
| H1.S1.M1 | La opacidad de las capas de celeste en claro se deriva de `--fondo-presencia` (`alovida.css`, una regla) | sonda Playwright; `medicion-pixeles-gota-fps.json` | reposo `0`; puntero activo `0.3`; quieto vuelve a `0` |
| H1.S1.M2 | Tope `.30` con margen de contraste | `peor-caso-contraste.txt`; `medicion-pixeles-gota-fps.json` | peor caso teórico `--tinta-3` 4,73:1 (margen 0,23; a `.6` daba 4,11:1); píxel más oscuro medido [242,249,248] → 5,33:1 |
| H1.S2.M2 | REQ-005: no bloquea | sonda | `pointer-events: none`; un `input` recibe foco y texto; scroll en 3 anchos |
| H1.S2.M3 | REQ-006: reduced-motion | sonda | opacidad `0` tras mover el puntero |
| H1.S2.M4 | REQ-007: rendimiento | `medicion-pixeles-gota-fps.json` | reposo 16,6 ms (p95 16,8); moviendo 17 ms (p95 16,7; un cuadro de 33 ms) |
| H1.S3.M1 | Modo oscuro sin cambios, visto con el botón real | `04-oscuro-boton-real.png` | opacidad `1`; sin franja blanca |
| H1.S3.M2 | 390 / 768 / 1440 px y teclado | sonda | sin scroll horizontal, scroll vertical, consola limpia; Tab llega a un enlace con contorno de 4 px |
| H1.S4.M2 | Suite completa contra la base limpia | `suite-D1-…dev-base.txt` vs `suite-G-…dev-base.txt` | **idéntico**: 1 fallo (`standard-sheets`) y 12 286 en verde, con y sin el cambio |
| H1.S4.M3 | `lint` y `typecheck` | `yarn lint`, `yarn typecheck` | ambos código 0 |
| H1.S5.M1 | Dos revisiones independientes | `visual-reviewer` y `frontend-reviewer` (ver Decisiones) | aprueban con observaciones; atendidas o registradas abajo |
| H1.S5.M3 | Este reporte en `docs/trabajo/` | — | escrito |

## A medias

### H1.S2.M1 — REQ-004, gota de agua
- **Qué anda:** la gota se dispara con el clic (`data-gota`), anima 0,9 s y decae. Medida: sin clic 0 píxeles distintos; con clic ~285 000 (máx 25/255 a 100 ms, 16 a 250 ms, 13 a 450 ms, 2 a 800 ms). Estilo calculado: opacidad .70 → .01 y escala .17 → .99.
- **Qué no anda / no se probó:** a simple vista el anillo casi no se distingue en pantallas con feed denso. Vive en `html::after` con `z-index: -1`, detrás de las tarjetas opacas, y sólo se ve en el fondo libre. Además la diferencia de píxeles mezcla el anillo con el celeste que sube con el clic. Nadie la ha mirado en un navegador real.
- **Qué falta exactamente:** que una persona la mire en `localhost:4200` y decida si es suficiente o si hay que cambiar su `z-index` (fuera del alcance de este carril, §1.3).
- **Dónde quedó:** sin cambios de código; el diseño de la gota es el que ya existía (TAREA-08, 2026-09-04).

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S4.M1 | `BLOQUEADO-EXTERNAL` | `playwright/lane-08-reactive-background.spec.ts` salta sus 5 tests porque `apiViva()` exige el backend real. Levantar `mantra-core-health-api` y repetir. |
| H1.S5.M2 | se registra en cada PR | La salida literal de `gh pr view … --json isDraft,mergeable,mergeStateStatus` y `gh pr checks` se publica como comentario en #1328 y #1331 tras el push: depende de un PR ya abierto y de este mismo commit. |

## Evidencia

```text
Base dev  / sin cambio : Test Files 1 failed | 896 passed (897) · Tests 1 failed | 12286 passed (12287)   suite-D1-sin-cambio-dev-base.txt
Base dev  / con cambio : Test Files 1 failed | 896 passed (897) · Tests 1 failed | 12286 passed (12287)   suite-G-con-cambio-dev-base.txt
   único fallo en ambas: standard-sheets.spec.ts > «son tantas como los JSON que siembra el backend»
Base test / sin cambio : 156 fallos, 13 archivos   suite-B3-sin-cambio-test-base.txt
Base test / con cambio : 83 fallos, 11 archivos    suite-A2-con-cambio-test-base.txt
   (los fallos de `test` cambian de una corrida a otra: `appointments` falla sólo sin el cambio,
    `billing` sólo con él; aislados con el cambio sólo fallan los mismos 4 que fallan sin él —
    `billing` «puerta por omisión» y 3 de `inventory-upload-dialog` —  suite-F-aislados-…txt)
Aislados con cambio    : medical-record.spec.ts + a11y.spec.ts → 62/62 (fallaron en la corrida completa
                         con «Cannot configure the test module when the test module has already been
                         instantiated», contaminación entre tests)      suite-E-aislados-con-cambio.txt
Contraste medido       : píxel más oscuro [242,249,248] → tinta-3 5,33:1 · tinta-2 7,51:1
Diferencia reposo→activo: 19,3 % de píxeles, máx 13/255, media 5,85   diff-reposo-vs-activo.json
```

## No cubierto

- El spec oficial del carril (ver H1.S4.M1).
- Contraste del texto sobre **cada** superficie: sólo se midió el margen derecho y el peor caso teórico.
- Rendimiento en otra máquina o con GPU/CPU limitada; móvil real (se emuló el ancho, no el táctil).
- Modo oscuro sólo en la ruta de inicio.
- Axe / lector de pantalla (la capa es decorativa, pero no se auditó).
- La base `test` no tiene una línea base estable: no se pudo demostrar «sin regresiones» allí más que por aislamiento.

## Desvíos del plan

- El plan se escribió **después** del primer cambio de código y de abrir los PR (§2.1).
- La primera versión usaba el tope `.35` (contraste 4,61:1, margen 0,11). Un compañero lo señaló como estrecho y se bajó a `.30` (4,73:1, margen 0,23).
- Una primera afirmación («los 8 fallos ya existían en `dev`») no tenía evidencia en disco y el recuento era inconsistente (8 vs. 7 listados): salía de un `dev` más antiguo. Se sustituyó por las corridas de arriba. Tres corridas sobre `test` quedaron marcadas `INVALIDA-indice-desactualizado` (el índice de componentes generado era de otra rama) y se conservan en `evidencia/` por honestidad.
- La ficha `tareas/TAREA-08-visuales-generales.md` no existe; se trabajó contra `requirements.md`.

## Riesgos residuales

- **El celeste es muy sutil** (diferencia máxima 13/255): puede parecer que «no aparece». Subir el tope cuesta contraste: a `.35` el margen baja a 0,11, a `.6` ya no cumple AA.
- **Táctil sin puntero:** el fondo queda blanco permanente y la gota se descarta a propósito para `pointerType` distinto de `mouse` (`alovida-runtime.service.ts`, ~línea 920). Coherente con «blancos predominantes», pero sin interacción visual en móvil y tablet.
- **Con reduced-motion el celeste no aparece nunca** (decisión de este cambio, ver abajo).
- **La gota se tapa con las tarjetas** (`z-index: -1`); es el diseño previo.
- **Carril 34** («fondo blanco ancho completo») toca el mismo tema: conviene avisar a quien lo lleve antes de fusionar.
- La base `test` tiene ~100 tests inestables que no se pueden atribuir ni descartar a un cambio concreto.

## Decisiones y ambigüedades

- **«Fondo blanco» del propietario (2026-09-10) vs. REQ-08-002 (celeste al interactuar).** *Supuesto tomado:* el propietario quería un fondo que **descansa** blanco, y REQ-08-002 pide celeste **sólo al interactuar**; se cumplen los dos. *A quién confirmárselo:* al propietario del diseño. Esto **reintroduce celeste** donde la decisión del 10 de septiembre lo había apagado del todo.
- **Reduced-motion:** el celeste no aparece nunca; se priorizó REQ-08-006 sobre REQ-08-002. *A quién confirmárselo:* al propietario del diseño.
- **Intensidad:** el tope `.30` es una elección por contraste, no un valor dado por la ficha.
- **Revisores independientes:** `visual-reviewer` (APRUEBA CON OBSERVACIONES: celeste sutil, gota poco legible, 4,73:1 no respaldado en disco → se añadió `peor-caso-contraste.mjs` y la medición de píxeles) y `frontend-reviewer` (APRUEBA CON OBSERVACIONES el CSS: sin otros consumidores de `--fondo-presencia`, sin reglas que pisen la nueva, sin salto en SSR). La misma revisión detectó una regresión de accesibilidad en el arreglo de la ambulancia; ver el reporte del PR de esa pantalla. La puntuación por categorías (/10) que pide `visual-reviewer.md` no se calculó.
- **Alcance de este PR:** sólo `alovida.css` y documentación. No se tocó el runtime ni la gota.
