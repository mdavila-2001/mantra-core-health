# Tercera revisión visual independiente (agente `visual-reviewer`, 2026-10-24)

Rama `feature/anatomy-atlas-literature`, HEAD `f37df3467`. Material revisado:
`gates-2/playwright.txt` (14/14), las 25 capturas de `screenshots/`, y
`src/app/features/glossary/glossary-anatomy-atlas.{html,css}`, más
`playwright/atlas-anatomico-literatura.spec.ts`. El revisor no modificó código
ni hizo commits. Hizo una sola prueba propia en Chromium 1243 (abajo, H-1).

**Veredicto: FAIL, 82/100** (umbral 92), con dos hallazgos HIGH.

## Hallazgos

### HIGH

**H-1. El foco de teclado es invisible en las opciones de búsqueda y de lista, en «Quitar selección» y en el título de la ficha.**
`glossary-anatomy-atlas.css:158-162` y `:194-197` hacen `outline: none; box-shadow: var(--focus-ring)`.
Pero `--focus-ring` es un **color** (`src/styles.css:224`, `--focus-ring: var(--c-aqua-700)`;
oscuro `:293`/`:342`), no una sombra. Así, `box-shadow: #…` no es válido y se descarta,
el `outline: none` anula el anillo global de `:focus-visible` (`src/styles.css:426-429`, 4 px sólido)
y no queda ningún indicador. Lo comprobé en Chromium 1243 con la misma cascada. Al llegar con Tab al botón, el estilo calculado es
`{ outline: 'none', boxShadow: 'none' }`. Esto incumple WCAG 2.4.7. Afecta al camino de teclado que
el spec 10 dice probar: la prueba sólo verifica `toBeFocused()`, que no dice nada de si el foco se ve, y
ninguna captura lo muestra. El mismo patrón está en `anatomy-viewer.css:30` y
`billing/plan-de-pagos/plan-de-pagos.css:141`. Viene de commits anteriores (`81610f8a8`, `37cd09bf0`),
y las dos revisiones previas no lo detectaron.

**H-2. La captura «oscuro» de la ficha con literatura es la clara. El modo oscuro de lo nuevo no tiene evidencia.**
`literatura-1440-oscuro.png` y `literatura-1440-claro.png` son **idénticas byte a byte**
(md5 `a3e0d698…`), y lo mismo pasa con `literatura-imagen-1440-{claro,oscuro}.png` (md5 `7308dcd5…`).
La causa está en `playwright/atlas-anatomico-literatura.spec.ts:59`, que sólo hace `emulateMedia({ colorScheme })`,
mientras que la app tematiza con `data-theme="dark"`. El spec del visor sí lo pone
(`atlas-anatomico-3d.spec.ts:137-138`). El commit `f37df3467` afirma tener capturas «1440 oscuro» que no
existen. Cobertura parcial: `male-1440-oscuro.png` (vejiga) sí muestra en oscuro la descripción
extendida, las citas, la bibliografía, TA2 y el vacío «Sin imagen», y se leen bien.
Lo que **no tiene ninguna evidencia en oscuro** es la figura de Wikimedia: miniatura sobre `--bg-surface`
con borde `--border-subtle` y su pie con enlaces. Por `NO_EVIDENCE_NO_DONE`, ese estado no está demostrado.

### MEDIUM

**M-1. Las citas [n] no tienen número visible en «Artículos citados».**
`html:222` usa `<ol class="atlas3d__bibliografia">`, pero el reset global `ul, ol { list-style: none }`
(`src/styles/alovida.css:388`) borra los marcadores, y `css:356-364` no los repone.
Las capturas `literatura-*.png`, `female-utero-sin-pieza.png` y `male-1440-*.png` muestran las entradas sangradas pero sin «1.», «2.»…
Quien lee «[3]» tiene que contar. Es justo la trazabilidad que promete la sección. Además, el destino
`#atlas3d-fuente-n` no tiene `:target` resaltado ni `scroll-margin-top`, y la barra del armazón es sticky
(`--h-header: 56px`), así que el salto puede dejar la entrada tapada. Esto último es un riesgo
deducido del código, no lo verifiqué en el navegador.

**M-2. La figura queda angosta y pegada a la izquierda, y los diagramas rotulados no se leen.**
`css:366-369` usa `repeat(auto-fill, minmax(min(100%, 12rem), 1fr))`. Con una sola imagen, `auto-fill`
reserva pistas vacías: la figura mide unos 207 px en el panel de 1440 (`literatura-1440-claro.png`) y unos 222 px
en 768 (`literatura-768-claro.png`), con más de la mitad del ancho vacía a su derecha. Además, el pie se parte en 4-5 líneas.
Con el útero (`female-utero-sin-pieza.png`), el diagrama de OpenStax lleva rótulos que a ese tamaño no se pueden leer, y
la imagen no se puede ampliar: sólo el enlace del pie lleva a Commons. Esto va contra el espíritu de
`composition-rules.md` §5 (no dejar un bloque a la izquierda con una columna vacía al lado). Con `auto-fit`, o con
una figura a todo el ancho del panel, se resuelve. En 375 la figura sí ocupa el ancho (`literatura-imagen-375-claro.png`).

**M-3. El subtítulo de aspecto no corresponde al contenido.**
`html:207` muestra `grupo.label`. En el fémur, bajo «Partes», se lee «ningún hueso supera al fémur en tamaño y
resistencia» y un ángulo valgo (`literatura-375-claro.png`, `literatura-768-claro.png`). En el útero, también bajo
«Partes», se lee «leucocitos CD56 … proliferan» (`female-utero-sin-pieza.png`). La jerarquía visual
promete una cosa y el párrafo dice otra. Es un problema de datos que se ve como un defecto de jerarquía.

### LOW

- **L-1.** El `alt` es genérico y además se repite en el `figcaption` (`html:252-262`): «Fémur: imagen de anatomía
  humana que Wikidata asocia a esta estructura». No describe lo que muestra (los fémures resaltados en rojo),
  y un lector de pantalla lo lee dos veces.
- **L-2.** El aviso «Redactada con asistencia de inteligencia artificial y sin revisión humana» va en
  `.atlas3d__marca` (`--text-tertiary`, 12 px). Es el aviso más importante de la sección y es el texto
  más tenue. Conviene que use `--text-secondary` o una nota del sistema.
- **L-3.** Los `[n]` superíndice tienen un área de toque de unos 14 px. Como son enlaces dentro de una frase, WCAG 2.5.8 los
  exime, pero en 375 px cuesta acertarlos.
- **L-4.** «Artículos citados» usa el mismo `h4.atlas3d__aspecto` que «Función» o «Partes», así que la bibliografía
  parece un aspecto más de la descripción.
- **L-5. Artefacto de captura, no defecto:** el lienzo sale vacío en `teclado-femur-relacionadas.png`,
  `female-utero-sin-pieza.png` y `*-pagina.png`. Son capturas más altas que el viewport, y WebGL no se recompone.
  La prueba cuenta píxeles verdes y ocres en el lienzo (`atlas-anatomico-3d.spec.ts`), así que el resaltado está
  afirmado, pero **no hay imagen** de las relacionadas resaltadas. Las capturas `male-1440-*.png` sí muestran el modelo.
- **L-6. Artefacto, no defecto:** el dock inferior fijo («Tutoriales / Chats / … / Ajustes»), la barra superior y las
  insignias «Datos de prueba / Ver componentes» aparecen superpuestos en las capturas de elemento
  (`literatura-375-claro.png` sobre la cita original y la descripción, `literatura-1440-claro.png` sobre «Partes»).
  Son barras `position: fixed` de la app capturadas en mitad del elemento, no un solapamiento del panel.

## Qué está bien (verificado en captura)

- TA2 con su cruce (Wikidata, FIPAT) y estado vacío propio (`atlas3d-sin-ta2`).
- Estados vacíos redactados con su causa: sin imagen (`male-1440-claro.png`), aspectos sin fuente,
  no buscada, sin literatura. Distinguen bien «no hay» de «no se buscó» (S1≠S2).
- Sin desborde horizontal en 375 (lo afirma el spec, y la captura no muestra corte). Las pestañas entran completas en 375.
- En oscuro (`male-1440-oscuro.png`), las citas y los enlaces DOI/PMID usan `--text-link` y tienen contraste suficiente.
- Crédito y licencia de la imagen, con enlace a la licencia y a la página de Commons.

## Puntaje

| Dimensión | /10 |
|---|---|
| Tipografía | 9 |
| Espaciado | 8.5 |
| Jerarquía | 7.5 |
| Consistencia | 8 |
| Responsive | 8.5 |
| Accesibilidad | 6 |
| Interacción | 8 |
| Estados | 9 |
| Densidad | 8.5 |
| Acabado | 9 |
| **Total** | **82/100** |

`PASS = >= 92 Y cero BLOCKER/CRITICAL/HIGH`: **FAIL** (82, dos HIGH).
