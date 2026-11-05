# Cuarta revisión visual independiente (agente `visual-reviewer`, 2026-10-25)

Rama `feature/anatomy-atlas-literature`, correcciones del commit `6afcc51c0`. Material
revisado: `gates-2/playwright.txt` (14/14), las 26 capturas de `screenshots/`,
`glossary-anatomy-atlas.{html,css}`, `anatomy-viewer.css` y
`playwright/atlas-anatomico-literatura.spec.ts`. El revisor no modificó código ni hizo
commits. Además ejecutó pruebas propias en Chromium headless 1243 contra el `ng serve`
del puerto 4200, con la cuenta `medica@alovida.mock` y la ficha `UBERON:0000981`. Los
scripts y las capturas quedaron fuera del repo, en el scratchpad de la sesión.

**Veredicto: FAIL, 82/100** (umbral 92). Hay un hallazgo HIGH.

## Comprobación de las correcciones de la tercera revisión

| Hallazgo 3.ª | Estado | Evidencia |
|---|---|---|
| H-1 foco invisible | **Corregido en parte** | En el navegador, `.atlas3d__opcion:focus-visible` calcula `solid 3px rgb(51,112,108)` en claro y `rgb(159,216,208)` en oscuro. Tras Enter, el `h2` de la ficha recibe el foco y el anillo se ve completo. «Quitar selección» muestra el anillo en `literatura-*-claro/oscuro.png`. En las opciones de búsqueda, en cambio, el anillo queda recortado (ver M-1 nuevo). |
| H-2 oscuro sin evidencia | **Corregido** | Los md5 difieren: `literatura-1440-claro` `a4a99123…` frente a `-oscuro` `4f42ef43…`, e `imagen-1440-claro` `334cdcf5…` frente a `-oscuro` `cd2c79b6…`. En oscuro, la figura tiene borde visible y los enlaces del pie se leen bien. Mi prueba midió `body` `rgb(8,22,28)`. |
| M-1 bibliografía sin números | **Corregido en lo visual, roto en la interacción** | La captura muestra «1. 2. 3.» y el estilo calculado es `list-style-type: decimal`. El resaltado `:target` y el `scroll-margin`, en cambio, nunca se aplican porque la cita saca de la página (H-1 nuevo). |
| M-2 figura angosta | **Corregido** | La figura mide 428/428 px en 1440 y 317/317 en 375 (medido). `max-block-size` con `contain` no deforma la imagen. |
| M-3 «Partes» | **Corregido** | Se lee «Partes y morfología» en todas las capturas. |
| L-1 alt repetido | Corregido | El pie ya no repite el alt. |
| L-2 aviso de IA tenue | Corregido | Usa `--text-secondary`, legible en claro y en oscuro. |
| L-3 área de toque de la cita | **No corregido** | Ver M-3 nuevo: la caja mide 18 × **0** px. |
| L-4 «Artículos citados» | Corregido | Lleva un filete superior y un margen que lo separan de la descripción. |
| L-5 lienzo vacío | Mejorado | `teclado-femur-relacionadas.png` ya muestra el fémur en verde y las relacionadas en ocre. |

## Hallazgos

### HIGH

**H-1. Tocar una cita [n] saca al usuario del atlas y lo lleva al panel.**
`glossary-anatomy-atlas.html:211` renderiza `<a [href]="'#atlas3d-fuente-' + n">`. El
documento tiene `<base href="/">` (`src/index.html:6`), así que el navegador resuelve el
enlace como `http://localhost:4200/#atlas3d-fuente-1`. Como esa ruta no coincide con la
actual, no es un salto dentro del documento sino una navegación a `/`, que redirige a `/dashboard`.
Lo reproduje en Chromium 1243 a 1440 px, con un clic del ratón sobre el texto «[1]» (`elementFromPoint`
devuelve `atlas3d__cita`). Secuencia de `framenavigated`:
`…/glossary/anatomy-atlas?structure=UBERON:0000981` → `…/#atlas3d-fuente-1` → `…/dashboard`.
Después del clic, `atlas3d-ficha-titulo` no está visible y `:target` vale `null`.
El propio repo ya documentó este error y lo corrigió en otro lugar
(`public-profile-card.html:258`: «Eran anclas `href="#…"` y con `<base href="/">` sacaban
de la ficha»). La app tiene `anchorScrolling: 'enabled'` (`app.config.ts:68`), así que la
solución es `routerLink` con `[fragment]` o un manejador de clic. Rompe la navegación, que un
refactor visual tiene que preservar, y anula la corrección M-1 (`:target` y `scroll-margin`). El spec
`atlas-anatomico-literatura.spec.ts:73-74` sólo compara el atributo `href` con una regex y nunca hace clic,
aunque su encabezado (l.10) afirma que las citas «llevan a la bibliografía». El defecto viene de `675b76cee`,
y ninguna de las tres revisiones anteriores lo detectó.

### MEDIUM

**M-1. El anillo de foco de las opciones de búsqueda queda recortado: sólo se ve el borde inferior.**
`glossary-anatomy-atlas.css:158-163` usa `outline: 3px` con `outline-offset: 2px`. Pero la lista
`.atlas3d__resultados` (`css:113-118`) tiene `overflow-y: auto`, y la opción ocupa todo el ancho de
la lista (caja 956→1382, medida). Los lados superior, izquierdo y derecho del anillo caen fuera del área de
recorte. Con Tab hasta «tibia», a 1440 claro, sólo se dibuja una línea bajo la opción, que se confunde con un
separador. La captura propia del viewport lo muestra: comparar la opción enfocada con el `h2` enfocado tras Enter,
que se ve completo. Técnicamente el foco «se ve» (WCAG 2.4.7), pero no se percibe como foco. Con
`outline-offset` negativo (como hace `anatomy-viewer.css`, con `-3px`) se resuelve. La prueba E2E nueva sólo verifica
`outlineStyle !== 'none'` en «Quitar selección», que no tiene contenedor recortado. Por eso no lo detecta.

**M-2. Una cita queda sola al comienzo de una línea, separada de su frase.**
La plantilla deja un espacio en blanco entre `{{ frase.es }}` y el `<a>` (`html:210-211`), y además la cita
es `inline-block` con `margin-inline-start`, así que el navegador puede cortar la línea antes de «[n]».
Pasa en varias fichas y anchos: en `literatura-375-claro.png` y `literatura-768-claro.png`,
«[2]» queda solo bajo «cervicodiafisario.»; en `female-utero-sin-pieza.png`, «[1]» queda solo bajo «(lútea) del ciclo no gestante.»; y en
`female-1440-oscuro.png`, «[1]» aparece bajo «las normales.». La cita parece pertenecer al
párrafo siguiente. Es un defecto tipográfico visible en el contenido central de la ficha.

**M-3. El «área de toque mayor» de la cita mide 0 px de alto.**
`css:351-358` combina `display: inline-block` y `min-inline-size: 1.5em` con `line-height: 0`. La caja que
se mide es de `18 × 0` px (`getBoundingClientRect`, 1440 y 375), y Playwright considera el enlace
«not visible» y no puede hacerle clic. El área real de toque es sólo la de los glifos, unos 18 × 15 px,
así que la promesa del commit («citas con área de toque mayor») no se cumple. Hoy no se nota porque el clic
sobre el texto funciona, pero tampoco permite escribir la prueba que habría detectado H-1.

### LOW

- **L-1.** El diagrama rotulado del útero (`female-utero-sin-pieza.png`) ya ocupa el ancho del
  panel, pero el panel mide 428 px a 1440, y los rótulos de OpenStax siguen sin leerse. No hay forma de
  ampliar la imagen: la miniatura no es un enlace, y sólo «Wikimedia Commons», en el pie, lleva a verla más grande.
- **L-2.** El spec de literatura no prueba el foco en las opciones ni en el `h2`, sólo en «Quitar selección». Tampoco
  hay ninguna captura de la lista de búsqueda con foco.
- **L-3. Artefacto, no defecto.** El dock inferior fijo, la barra superior y las insignias «Datos de
  prueba / Ver componentes» aparecen sobre la ficha en `literatura-*.png`, `literatura-imagen-375/768-claro.png`,
  `female-1440-oscuro.png` y `teclado-femur-relacionadas.png`. Son elementos `position: fixed` capturados en
  mitad de un elemento más alto que el viewport. En mi captura del viewport a 1440 no se superponen a la ficha.
- **L-4. Artefacto, no defecto.** El borde derecho del anillo de «Quitar selección» sale cortado en
  `literatura-*.png`, porque la captura recorta a la caja de `.atlas3d__panel` y el anillo sobresale 5 px. No
  hay ningún ancestro con `overflow` distinto de `visible` (medido), así que en pantalla se ve completo.
- **L-5. Artefacto, no defecto.** En las capturas `*-pagina.png` y `teclado-*`, la columna izquierda queda vacía
  bajo el visor. Ocurre porque `.atlas3d__visor` es `position: sticky` (`css:334-337`) y la captura de página completa no
  lo arrastra.

## Sin hallazgos

- No hay desborde horizontal: `scrollWidth` es igual a `clientWidth` (1440) con la lista de búsqueda abierta.
- En consola, sólo aparecen dos avisos de CSP sobre scripts inline en `/auth`, ajenos al atlas. No hay respuestas HTTP ≥ 400
  en la ficha.
- Los estados vacíos siguen distinguiendo causa y alcance: no hay imagen, faltan aspectos sin fuente, la búsqueda no se hizo o no hay literatura.

## Puntaje

| Dimensión | /10 |
|---|---|
| Tipografía | 8.5 |
| Espaciado | 9 |
| Jerarquía | 9 |
| Consistencia | 8.5 |
| Responsive | 9 |
| Accesibilidad | 7 |
| Interacción | 5 |
| Estados | 9 |
| Densidad | 9 |
| Acabado | 8 |
| **Total** | **82/100** |

`PASS = >= 92 Y cero BLOCKER/CRITICAL/HIGH`: **FAIL** (82 puntos, con un HIGH).
