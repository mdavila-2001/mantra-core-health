# Séptima revisión visual independiente (agente `visual-reviewer`, 2026-10-25)

Rama `feature/anatomy-atlas-literature`, correcciones del commit `92b5c27cf` (hallazgos de
`audit-visual-6.md`). El revisor no escribió este código, no modificó código y no hizo commits.

El puerto 4200 no respondía al empezar (`curl` → `000`); se levantó `corepack yarn ng serve --port 4200` sin tocar
el código. Pruebas propias en Chromium 1243 (`/opt/pw-browsers/chromium-1243`) con Playwright, cuenta
`medica@alovida.mock`, a 375×812, 768×1024 y 1440×900, claro y `data-theme="dark"` en `<html>`. Fichas:
`UBERON:0000981` (fémur, citas `[1] [2] [2] [1] [3]`), `UBERON:0001092` (sin fuente) y `UBERON:0000002` (sin imagen).
Scripts (`a1.mjs` a `a4.mjs`) y capturas fuera del repo, en
`/tmp/claude-0/-home-user-mantra-core-health/638ef39d-e061-5f12-9e54-ecd8155c3c30/scratchpad/rev7/`.
`yarn pw --workers=1 atlas-anatomico-literatura`: 3/4 en la primera corrida (1440-claro agotó los 60 s esperando la
imagen de Commons), 1/1 al repetir ese caso (ver L-3). Las capturas que la spec reescribió se restauraron con `git checkout`.

**Veredicto: FAIL, 91.5/100** (umbral 92). Cero BLOCKER, CRITICAL y HIGH; un MEDIUM.

## Comprobación de las correcciones de la sexta revisión

| Hallazgo 6.ª | Estado | Evidencia |
|---|---|---|
| H-1 segunda cita de la misma fuente bajo la barra | **Corregido** | `a1.mjs`: 12 combinaciones (3 anchos × 2 temas × clic/Enter), secuencia de citas `#0 #3 #1 #2 #4 #0` (dos veces la fuente 1, dos veces la 2, y la última sin volver arriba). En las 72 mediciones la entrada queda centrada (1440: `top 439/429/418`; 768: `top 501/491`; 375: `top 385/364`, con el header terminando en 56), `elementFromPoint` devuelve el `LI` en los cuatro puntos y `activeElement` es el `<li>`. Capturas: `1440-light-click-seq1.png`, `375-dark-enter-seq3.png`. |
| L-1 anillo de la cita sobre el punto | **Corregido** | `z-375-light-cita-foco.png` (×2): anillo de 2 px, offset 0, separado del «.» de «fémur.» por el `margin-inline-start` de 3 px. |
| L-2 anillo de la entrada contra el número | **Mejorado, no del todo** | Ya no pisa el «1.», pero ahora pisa el texto (ver L-1 nuevo). |
| L-3 activa = foco | **Corregido** | La activa lleva fondo (`--bg-hover`) y el anillo sólo aparece con foco. Con Tab hacia «PMID» ya no hay dos anillos anidados (`z-1440-dark-fuente-activa-pmid.png`). |

Además: el enlace con `#atlas3d-fuente-2` y la recarga dejan la entrada en `top 385` (375) y `top 429` (1440), visible,
activa y con foco. Atrás y Adelante entre fuentes la centran y la enfocan (`a1.mjs`, `back`/`fwd`).

## Hallazgos

### HIGH

Ninguno.

### MEDIUM

**M-1. Al volver con Atrás desde la entrada al texto, el foco se queda en el `<li>` de la bibliografía, y a 375 queda fuera de la vista.**
Archivo: `src/app/features/glossary/glossary-anatomy-atlas.ts:260-277`. Ni la suscripción a `Scroll` ni el `effect` hacen
nada cuando la navegación vuelve a una URL sin ancla. El navegador restaura el scroll a la frase de la cita, pero
`activeElement` sigue siendo `LI#atlas3d-fuente-2`, ya sin la clase activa.
`a4.mjs` (Enter sobre la cita `[2]` y luego `goBack()`):

| Ancho | `scrollY` | cita `top` | `<li>` con foco `top` | viewport |
|---|---|---|---|---|
| 375 | 1907 | 397 | **860 (fuera)** | 812 |
| 768 | 1434 | 503 | 798 | 1024 |
| 1440 | 907 | 441 | 799 | 900 |

A 375, el foco está en un elemento que no se ve. A cualquier ancho, Shift+Tab lleva a «PMID 23322864» (fuente 1)
en lugar de volver al texto, y a 375 salta el scroll a `2336`. Para quien usa teclado, el camino de vuelta de la
nota no existe. Lo esperable es devolver el foco a la cita de origen cuando se vuelve a la URL sin ancla, o dar un
enlace «volver al texto» en la entrada. Captura: `375-atras-sin-ancla.png`.

### LOW

- **L-1. El anillo y el fondo de la entrada quedan pegados al texto.** `glossary-anatomy-atlas.css:381-385` y `444-448`.
  El `<li>` no tiene relleno (`padding 0`; el borde izquierdo del texto coincide con el del `<li>`, medido) y
  `outline-offset: 0`. El anillo cae entre el «1.» y la «T» de «The» y toca la «T»; el fondo arranca justo en la letra.
  Capturas a ×2: `z-1440-light-fuente-foco.png` y `z-375-light-fuente-foco.png`. Con un relleno inline de `--sp-1`
  (y el margen negativo equivalente para no correr el texto) se resolvería.
- **L-2. La entrada activa sin foco apenas se distingue.** El fondo es `rgba(11,85,126,0.06)` en claro y
  `rgba(255,255,255,0.07)` en oscuro (`z-1440-light-fuente-activa-sinfoco.png`, `z-1440-dark-fuente-activa-sinfoco.png`).
  Se ve en una pantalla buena, pero se pierde en una de bajo contraste. Un filete lateral con `--focus-ring` o `--brand-*`
  lo haría inequívoco.
- **L-3. La E2E depende de la red de Commons y falla de forma intermitente.** `playwright/atlas-anatomico-literatura.spec.ts:121-123`:
  1440-claro agotó los 60 s esperando `naturalWidth > 0` y pasó al repetirlo (15,3 s). No es un defecto de la UI, pero da rojos falsos.
- **L-4. Artefactos, no defectos.** Barras fijas y la columna bajo el visor sticky en `UBERON0000002-1440-full.png`, las insignias
  «Datos de prueba», «Ver componentes» y «Demo», y las imágenes `loading="lazy"` de `UBERON:0001092` sin cargar mientras no
  entran en la vista (a 1440 oscuro, una vez en vista: `naturalWidth 500`). La composición sigue siendo una tarjeta con
  pestañas «Ficha | Relaciones | Fuentes» (§5).

## Sin hallazgos

- No hay desborde horizontal: `scrollWidth = clientWidth` a 375, 768 y 1440, claro y oscuro, en las tres fichas.
- Consola y red: cero errores de consola, cero `pageerror` y cero respuestas ≥ 400 en todas las corridas (`a1.mjs`, `a3.mjs`).
- Ficha sin fuente (`UBERON:0001092`): el vacío explica la causa («Se buscó «vertebral bone 1» en PubMed y Europe PMC…»),
  sin citas ni bibliografía, con buen contraste en oscuro (`UBERON0001092-375-dark.png`).
- Ficha sin imagen (`UBERON:0000002`): «Imágenes» explica el motivo; 5 citas y 5 entradas (`UBERON0000002-768-dark.png`).
- Teclado: 8 Tab desde el título hasta la primera cita; Enter la lleva a la entrada con foco, y el siguiente Tab va a su «PMID».
  Anillo de la cita `rgb(51,112,108)` en claro y `rgb(87,194,183)` en oscuro.

## Puntaje

| Dimensión | /10 |
|---|---|
| Tipografía | 9 |
| Espaciado | 9 |
| Jerarquía | 9.5 |
| Consistencia | 9 |
| Responsive | 9.5 |
| Accesibilidad | 8.5 |
| Interacción | 9 |
| Estados | 9.5 |
| Densidad | 9 |
| Acabado | 8.5 |
| **Total** | **91.5/100** |

`PASS = >= 92 Y cero BLOCKER/CRITICAL/HIGH`: **FAIL**. No hay HIGH, pero el puntaje queda debajo del umbral
por M-1 (accesibilidad) y L-1 (acabado).
