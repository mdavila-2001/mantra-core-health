# Sexta revisión visual independiente (agente `visual-reviewer`, 2026-10-25)

Rama `feature/anatomy-atlas-literature`, correcciones del commit `c4c9596f0` (hallazgos de
`audit-visual-5.md`). El revisor no escribió este código, no modificó código y no hizo commits.

Al empezar, el puerto 4200 no respondía (`curl` → `000`), así que el revisor levantó
`corepack yarn ng serve --port 4200` sin tocar el código. Las pruebas propias se hicieron en Chromium 1243
(`/opt/pw-browsers/chromium-1243`) con Playwright, con la cuenta `medica@alovida.mock`, a 375×812,
768×1024 y 1440×900, en claro y con `data-theme="dark"` en `<html>`. Se usaron tres fichas:
`UBERON:0000981` (fémur, completa), `UBERON:0001092` (atlas, `extendedDescription.status = no_source`) y
`UBERON:0000002` (cuello del útero, sin imágenes). Los scripts (`r1.mjs` a `r5.mjs`) y las capturas están
fuera del repo, en `/tmp/claude-0/-home-user-mantra-core-health/638ef39d-e061-5f12-9e54-ecd8155c3c30/scratchpad/rev6/`.
`yarn pw --workers=1 atlas-anatomico-literatura` da 4/4 en verde. Las capturas que la spec reescribe en el
repo se restauraron con `git checkout`.

**Veredicto: FAIL, 87.5/100** (umbral 92). Queda un hallazgo HIGH.

## Comprobación de las correcciones de la quinta revisión

| Hallazgo 5.ª | Estado | Evidencia |
|---|---|---|
| H-1 entrada tapada por la barra | **Corregido sólo la primera vez que se navega a cada fuente** (ver H-1 nuevo) | Se probaron 12 combinaciones (375/768/1440 × claro/oscuro × clic/Enter) sobre «[2]». En todas, `li#atlas3d-fuente-2` queda centrada, y `elementFromPoint` devuelve el `LI` en sus cuatro puntos de muestra (las dos esquinas, el centro y el borde inferior). Por ejemplo, 1440: `top 429` (el header termina en 56), 375: `top 385`, 768: `top 501`. Capturas: `1440-light-click.png` y `375-dark-enter.png`. |
| M-1 el foco no llega | **Corregido** | Hay `document.activeElement === li#atlas3d-fuente-2` en los 12 casos. El siguiente Tab va a «PMID 3597501», dentro de la misma entrada. |
| L-1 enlace con ancla al cargar | **Corregido** | Al abrir `…?structure=UBERON:0000981#atlas3d-fuente-2` y al recargar, la entrada queda en `top 429` (1440) o `top 385` (375), visible y con el foco. Atrás y Adelante entre `#fuente-1` y `#fuente-3` también la centran y la enfocan. Un ancla inexistente (`#atlas3d-fuente-99`) o una ficha sin bibliografía con ancla dejan `scrollY 0` y el foco en el `h2`, sin errores. |
| L-2 anillo de la cita | **Mejorado, no del todo** | El anillo mide `2px`, con offset `1px`. Sigue rozando el punto final de la frase (ver L-1 nuevo). |

## Hallazgos

### HIGH

**H-1. Si se toca una cita de la fuente que ya está activa, la entrada vuelve a quedar entera bajo la barra superior.**
Archivo: `src/app/features/glossary/glossary-anatomy-atlas.ts:264-269`. El `effect` sólo reacciona cuando
**cambia** `fragment()`. Si se toca una cita cuyo fragmento ya está en la URL, el fragmento no cambia y el `effect`
no se dispara. En cambio, el `anchorScrolling` del router sí desplaza (`BrowserViewportScroller`, que ignora
`scroll-margin`), y deja la entrada en `top 0`, debajo del `.app-header` sticky (de 0 a 56 px).

El caso es habitual, no rebuscado. La ficha de prueba tiene las citas `[1] [2] [2] [1] [3]`: dos de cinco repiten una fuente.
Un lector toca «[1]» en *Morfología*, lee la fuente, vuelve a subir y toca «[1]» en *Relevancia clínica*.

| Ancho | 1.ª vez | 2.ª cita a la misma fuente | `elementFromPoint` |
|---|---|---|---|
| 1440 | `top 439`, `LI` | `top 0`, `scrollY` 1242 → 1681 | `svg` del header |
| 375 | `top 385`, `LI` | `top 0`, `scrollY` 2336 → 2721 | `A` del header |

Pasa lo mismo con Enter. El foco queda en el `<li>`, pero el `<li>` está fuera de la vista.
Capturas: `1440-misma-cita-2a-vez.png` y `375-misma-cita-2a-vez.png`. En la parte de arriba sólo se ve «3. Surgical
Management…», y la entrada 1 resaltada no aparece. Es el mismo defecto que el H-1 de la quinta revisión, por otro
camino. La E2E no lo detecta porque sólo hace un clic.

Posibles soluciones:
- Centrar la entrada al recibir los eventos `Scroll` del router (que salen también en la navegación al mismo fragmento) en lugar de usar un `effect` sobre la señal.
- O usar `ViewportScroller.setOffset` con la altura del header.
- O desactivar `anchorScrolling` para esta ruta y manejar el clic de la cita.

La prueba tendría que tocar dos citas de la misma fuente.

### MEDIUM

Ninguno.

### LOW

- **L-1. El anillo de la cita sigue tocando el punto de la frase.** `glossary-anatomy-atlas.css:434-437`
  (`outline 2px`, `offset 1px`, sobre `margin-inline-start: 0.1em`). A 375 claro, con zoom ×2
  (`375-light-cita-foco-zoom.png`), el borde izquierdo del anillo cae sobre el «.» de «fémur.», y el borde superior roza el
  renglón anterior. Es legible y mejoró respecto de la quinta revisión.
- **L-2. El anillo de la entrada activa choca con el número de la lista.** `glossary-anatomy-atlas.css:381-385` y `443-447`
  (`outline-offset: 2px` sobre un `<li>` con el marcador fuera de la caja). El borde izquierdo pasa pegado al «1.» o al «2.»
  (`1440-dark-fuente-foco-zoom.png`, `1440-light-click.png`). Con `outline-offset` 0 o con un relleno inline en la entrada se evitaría.
- **L-3. «Activa» y «con foco» se ven igual.** La entrada citada se resalta con el mismo anillo `--focus-ring` que el foco del
  teclado (`:381`). Con Tab hacia «PMID», se ven dos anillos anidados (el de la entrada y el del enlace). Convendría marcar la
  entrada activa con un fondo o un filete (`--surface-*`) y reservar el anillo para el foco.
- **L-4. Artefacto de captura, no defecto.** En `sin-fuente-1440-dark.png`, la primera imagen de «atlas» aparece con su texto
  alternativo. La imagen es `loading="lazy"` y no había terminado de cargar en la captura por elemento. Medido 8 s después,
  las dos tienen `complete: true`, `naturalWidth 500`, y las respuestas son 200 de `upload.wikimedia.org`.
- **L-5. Artefactos.** Las barras fijas en las capturas por elemento, y las insignias «Datos de prueba», «Ver componentes» y «Demo»,
  son elementos de desarrollo. La columna vacía bajo el visor a 1440 se debe a que `.atlas3d__visor` es sticky y el scroll estaba en
  la bibliografía. No es una composición pegada a la izquierda.

## Sin hallazgos

- No hay desborde horizontal: `scrollWidth = clientWidth` a 375, 768 y 1440, en las tres fichas.
- Consola y red: cero errores, cero `pageerror` y cero respuestas ≥ 400 en las fichas probadas.
- Ficha sin fuente (`UBERON:0001092`): el estado vacío se explica con su causa («Se buscó … en PubMed y Europe PMC y ningún
  resumen encontrado sustenta una frase…»), no hay bibliografía y el resto de la ficha sigue igual. En oscuro, el contraste es correcto.
- Ficha sin imagen (`UBERON:0000002`): «Imágenes» explica el motivo («Sin imagen: sólo se publica una imagen de Wikimedia Commons
  cuyo autor y licencia se leyeron de su API…»). Hay 5 citas y 5 entradas.
- Teclado: llegar a la primera cita desde el título de la ficha lleva 8 Tab. El anillo de la cita usa `rgb(51,112,108)` en claro
  y `rgb(87,194,183)` en oscuro. El anillo de la entrada usa `rgb(159,216,208)` en oscuro.

## Puntaje

| Dimensión | /10 |
|---|---|
| Tipografía | 9 |
| Espaciado | 9 |
| Jerarquía | 9 |
| Consistencia | 9 |
| Responsive | 9.5 |
| Accesibilidad | 8.5 |
| Interacción | 7 |
| Estados | 9 |
| Densidad | 9 |
| Acabado | 8.5 |
| **Total** | **87.5/100** |

`PASS = >= 92 Y cero BLOCKER/CRITICAL/HIGH`: **FAIL** (87.5 puntos, con un HIGH).
