# Octava revisión visual independiente (agente `visual-reviewer`, 2026-10-25)

Esta revisión cubre la rama `feature/anatomy-atlas-literature` y las correcciones del commit `07b052347`, que responden a los hallazgos de
`audit-visual-7.md`. El revisor no escribió este código, no modificó código y no hizo commits.

Al empezar, el puerto 4200 no respondía (`curl` devolvía `000`). Se levantó `corepack yarn ng serve --port 4200` sin tocar el código.
Las pruebas propias se hicieron con Playwright y Chromium 1243, con la cuenta `medica@alovida.mock`. Se probaron tres anchos: 375×812, 768×1024 y 1440×900.
El modo oscuro se aplicó con `data-theme="dark"` en `<html>`, después de cargar la página. Se usaron tres fichas: `UBERON:0000981` (citas `[1] [2] [2] [1] [3]`),
`UBERON:0001092` (sin fuente) y `UBERON:0000002` (sin imagen). Los scripts (`b1.mjs` a `b4.mjs`), sus salidas (`b*.txt`) y las capturas están fuera del repo, en
`/tmp/claude-0/-home-user-mantra-core-health/638ef39d-e061-5f12-9e54-ecd8155c3c30/scratchpad/rev8/`.
La spec `yarn pw` **no se corrió** en esta ronda. Todas las mediciones salen de los scripts propios.

**Veredicto: FAIL, 87/100** (umbral 92). Hay un HIGH nuevo, introducido por la corrección de M-1, y un MEDIUM.

## Comprobación de las correcciones de la séptima revisión

| Hallazgo 7.ª | Estado | Evidencia |
|---|---|---|
| M-1: con Atrás, el foco quedaba en el `<li>` | **Corregido sólo la primera vez** | `b1.txt`, 12 combinaciones (3 anchos × 2 temas × clic o Enter). Tras `cita → Atrás`, el foco queda en `A[cita idx 2 [2]]`, visible (375: `top 397`; 1440: `top 441`). En la secuencia `cita → Atrás → Adelante → Atrás`, el segundo Atrás deja otra vez el foco en `LI#atlas3d-fuente-2`, que a 375 queda cortado (`top 780, bottom 825`, viewport 812). Ver M-1 nuevo. |
| L-1: anillo y fondo pegados al texto | **Corregido** | El `<li>` tiene `padding 1.8px 4.8px` y `outline-offset 1px`. El anillo ya no toca la «T» (`z-1440-light-bibliografia.png`, `z-375-dark-fuente-activa.png`). |
| L-2: la entrada activa apenas se distinguía | **Corregido** | La activa lleva un filete izquierdo de 3 px en `--focus-ring`: `rgb(51,112,108)` en claro y `rgb(159,216,208)` en oscuro. Se distingue sin foco (`z-1440-dark-pmid-foco.png`). |
| L-3: la E2E esperaba la red de Commons | **Aceptado** | El tiempo de espera sube a 120 s. No se volvió a correr. |

Comprobaciones que siguen bien:
- Segunda cita de la misma fuente: la secuencia `#0 → #3 → #4` deja cada entrada centrada, con `elementFromPoint` dentro del `<li>` en las cuatro esquinas, el foco en el `<li>` y la barra terminando en 56 px.
- Enlace abierto con `#atlas3d-fuente-2`: la entrada queda activa, enfocada y sin tapar a los tres anchos y en los dos temas (`b4.txt`, `b4-dark.txt`, `*-deeplink.png`).
- Adelante centra y enfoca la entrada.

## Hallazgos

### HIGH

**H-1. Después de tocar una cita, cualquier navegación sin ancla le quita el foco al control que se está usando y lo manda a la cita, fuera de la vista.**

Archivo: `src/app/features/glossary/glossary-anatomy-atlas.ts:267-281` (suscripción a `Scroll`) y `:360-365` (`citationOrigin`).

Causa:
- `citationOrigin` sólo se borra cuando llega un evento `Scroll` sin ancla, y ese evento no distingue Atrás de una navegación nueva.
- `chooseSex`, `onPicked` y `openStructure` navegan con `setQuery`, que suelta el fragmento. Cada una dispara un `Scroll` sin ancla.
- Ese `Scroll` ejecuta `origen.focus({ preventScroll: true })` sobre la cita.

Reproducción (`b2.mjs`, `b3.mjs`, 3 anchos × 2 temas):
1. Tocar la cita `[2]` (con clic o con Enter).
2. Ir con Tab al selector «Hombre | Mujer» y pulsar `ArrowRight`.
3. Resultado: `activeElement` es `A.atlas3d__cita "[2]"` en `top 2533` (375), `2061` (768) y `1451` (1440), con `scrollY 0`. El foco está a 1,5 a 3 pantallas por debajo de lo visible.

Consecuencias:
- El siguiente `Space` desplaza la página (`scrollY 710`) en lugar de operar el selector.
- El siguiente Tab salta a la otra cita `[2]` en mitad de la descripción.

Control: sin una cita previa, la misma secuencia deja el foco en `BUTTON.segmentado__opcion "Mujer"` (`b3.txt`, «control sin cita»). Antes de este commit no pasaba, así que es una regresión introducida por la corrección de M-1. Incumple WCAG 2.4.3 (orden del foco) y 3.2.2. Con el ratón pasa lo mismo (`b2.txt`, `*-cita-luego-sexo.png`).

Arreglo sugerido:
- Devolver el foco sólo cuando la navegación es `popstate`. Se puede leer `NavigationStart.navigationTrigger === 'popstate'` o `restoredState`.
- Borrar `citationOrigin` en cualquier navegación que no sea un Atrás a la URL de origen.

### MEDIUM

**M-1. Tras Atrás, Adelante y Atrás, el foco vuelve a quedar en la entrada de la bibliografía.**

Archivo: `glossary-anatomy-atlas.ts:274-278`.

Causa: el primer Atrás consume `citationOrigin` (lo pone en `null`). Adelante no lo vuelve a guardar, porque `revealSource` no sabe de dónde se vino.

Resultado: en el segundo Atrás, `activeElement = LI#atlas3d-fuente-2`, sin clase activa.

| Ancho | `<li>` con foco `top`/`bottom` | viewport |
|---|---|---|
| 375 | 780 / 825 (`elementFromPoint` de las esquinas inferiores: `null`) | 812 |
| 768 | 760 / 784 | 1024 |
| 1440 | 761 / 806 | 900 |

Es el mismo defecto que M-1 de la séptima revisión, en un recorrido que la E2E no cubre: la spec hace un solo `goBack()`. Captura: `375-light-click-back2.png`.

Arreglo sugerido: indexar el origen por entrada de historial, por ejemplo con `history.state.navigationId`, en lugar de una sola ranura.

### LOW

- **L-1. El número de la lista queda pegado al anillo de foco.** `glossary-anatomy-atlas.css:450-454`. Con foco, el anillo (`outline-offset 1px`) cae justo después de «2.» y el filete de 3 px se suma al anillo en el borde izquierdo, que se ve como un borde doble. Capturas: `z-1440-light-bibliografia.png` y `z-375-dark-fuente-activa.png`.
- **L-2. Valores sueltos fuera de los tokens.** `glossary-anatomy-atlas.css:382-385` usa `padding: 0.15em 0.4em` y `border-inline-start: 3px`. Lo correcto sería `--sp-*` y el token de ancho de borde que corresponda (skill `project-design-system`).
- **L-3. El foco de vuelta va a la última cita usada, no a la de la entrada de historial.** En la cadena `[1] → [1] → [3] → Atrás → Atrás`, el foco termina en la cita `[3]` (`top 602`), mientras el navegador restaura el scroll de la primera. Es visible, así que la gravedad es baja, pero el foco no corresponde a la posición restaurada (`b1.txt`, «chain back2»). Se resuelve con el mismo arreglo de M-1.
- **L-4. Artefactos, no defectos.** Barra superior fija, insignias «Demo» y «Datos de prueba», columna bajo el visor sticky e imágenes `lazy` sin cargar en capturas de página completa. La composición sigue siendo una tarjeta con pestañas (§5).

## Sin hallazgos

- No hay desborde horizontal: `scrollWidth = clientWidth` a 375, 768 y 1440, claro y oscuro, en las tres fichas.
- Consola y red: cero errores de consola, cero `pageerror` de la app y cero respuestas ≥ 400 (`b1.txt`, `b4-dark.txt`). Los `pageerror` de la primera corrida de `b4` venían del `addInitScript` del propio revisor y se descartaron. Esa corrida se repitió.
- Ficha sin fuente (`UBERON:0001092`): explica la búsqueda hecha, no muestra citas ni bibliografía y el contraste es bueno en oscuro (`UBERON0001092-375-dark.png`).
- Ficha sin imagen (`UBERON:0000002`): explica el motivo y tiene 5 citas y 5 entradas (`UBERON0000002-768-dark.png`).
- Teclado: desde la entrada enfocada, Tab va a su «PMID», con anillo visible en los dos temas.

## Puntaje

| Dimensión | /10 |
|---|---|
| Tipografía | 9 |
| Espaciado | 9 |
| Jerarquía | 9.5 |
| Consistencia | 8.5 |
| Responsive | 9.5 |
| Accesibilidad | 7 |
| Interacción | 7.5 |
| Estados | 9.5 |
| Densidad | 9 |
| Acabado | 8.5 |
| **Total** | **87/100** |

`PASS = >= 92 Y cero BLOCKER/CRITICAL/HIGH`: **FAIL** por H-1 (regresión del foco) y por puntaje.
