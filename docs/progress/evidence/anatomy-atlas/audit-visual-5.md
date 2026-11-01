# Quinta revisión visual independiente (agente `visual-reviewer`, 2026-10-25)

Rama `feature/anatomy-atlas-literature`, correcciones del commit `2c889188a` (hallazgos de
`audit-visual-4.md`). El revisor no escribió este código, no modificó código y no hizo commits.

Cuando empezó la revisión, el puerto 4200 no respondía (`curl` → `000`), así que el revisor
levantó `yarn ng serve --port 4200` sin tocar el código. Pruebas propias en Chromium 1243
(`/opt/pw-browsers/chromium-1243`) con Playwright, cuenta `medica@alovida.mock`, ficha
`UBERON:0000981`, a 375×812, 768×1024 y 1440×900, en claro y con `data-theme="dark"` en `<html>`.
Los scripts (`r1.mjs` a `r5.mjs`) y las capturas están fuera del repo, en
`/tmp/claude-0/-home-user-mantra-core-health/638ef39d-e061-5f12-9e54-ecd8155c3c30/scratchpad/rev5/`.

**Veredicto: FAIL, 84.5/100** (umbral 92). Hay un hallazgo HIGH.

## Comprobación de las correcciones de la cuarta revisión

| Hallazgo 4.ª | Estado | Evidencia |
|---|---|---|
| H-1 la cita saca del atlas | **Corregido en la navegación, no en el resultado visible** | `href` = `/glossary/anatomy-atlas?structure=UBERON:0000981#atlas3d-fuente-1`. Secuencia de `framenavigated` tras el clic: `…?structure=UBERON:0000981` → `…#atlas3d-fuente-1`. La ficha sigue visible y «Atrás» vuelve a la ficha sin fragmento. Pero la entrada citada queda tapada por la barra superior (H-1 nuevo). |
| M-1 anillo recortado en las opciones | **Corregido** | La opción «tibia» enfocada con Tab tiene `outline: solid 3px`, `offset -3px`, caja de 426×39 a 1440 y de 315×39 a 375. El anillo se ve entero en claro (`1440-light-resultados-foco.png`) y en oscuro (`375-dark-resultados-foco.png`). En la lista femenina larga también (`1440-lista-larga-foco.png`). |
| M-2 cita huérfana al comienzo de línea | **Corregido** | Ninguna cita cae en `x = 0` de su párrafo a 375, 768 ni 1440 (medido: por ejemplo, 375 → `[1]@216 [2]@261 [2]@115 [1]@71 [3]@49`). Visualmente, en `375-light-descripcion-foco.png`, «[2]» queda pegado a «cervicodiafisario.». |
| M-3 área de toque de 0 px | **Corregido** | `getBoundingClientRect` da 18×17 en «[1]» y 21×17 en «[2]». Playwright puede hacer clic en el enlace. |

## Hallazgos

### HIGH

**H-1. La entrada citada queda escondida detrás de la barra superior fija, en todos los anchos y temas.**
`glossary-anatomy-atlas.css:377-379` confía en `scroll-margin-block: var(--sp-16)`. Pero el
desplazamiento al ancla ya no lo hace el navegador sino el router (`routerLink` + `fragment`).
`BrowserViewportScroller.scrollToElement` de `@angular/common` 21.2.18 calcula
`window.scrollTo(rect.top + pageYOffset - offset[1])`, que **ignora `scroll-margin`**. Además,
`app.config.ts:68` (`withInMemoryScrolling({ anchorScrolling: 'enabled' })`) no configura
`scrollOffset`. Resultado: la entrada queda en `top = 0`, debajo del `.app-header`
(`position: sticky`, de 0 a 56 px).

| Ancho / tema | Entrada `li#atlas3d-fuente-1` | Header | `elementFromPoint` sobre la entrada |
|---|---|---|---|
| 1440 claro (clic) | top 0, bottom 21 | bottom 56 | `NAV.app-header__rapidos-lista` |
| 1440 oscuro (Enter) | top 0, bottom 21 | bottom 56 | `app-header` |
| 768 claro (Enter) | top 0, bottom 21 | bottom 56 | `app-header` |
| 375 claro (Enter) | top 0, bottom 42 | bottom 56 | `app-header` (arriba) y un botón del header (abajo) |

La entrada **resaltada** (con el `outline` de `--focus-ring`) queda entera fuera de la vista. Lo que el usuario ve
arriba es la cola de la entrada anterior («1987. PMID 3597501») y la entrada 3
(`1440-tras-cita.png`, `375-light-tras-enter.png`, `1440-dark-tras-enter.png`). La cita «lleva» a
una entrada que no se puede leer, así que la corrección M-1 de la tercera revisión (resaltar la fuente) sigue
sin verse en pantalla. La prueba E2E (`atlas-anatomico-literatura.spec.ts`, la línea con `await expect(entrada).toBeInViewport()`)
pasa en falso: `toBeInViewport` mide la intersección con el viewport, no si otra capa la tapa.

Posibles soluciones: `ViewportScroller.setOffset(() => [0, alto del header + margen])`, o
`withInMemoryScrolling({ anchorScrolling: 'enabled' })` más un `scrollOffset`, o un manejador que llame a
`scrollIntoView()` (este sí respeta `scroll-margin`, que también tendría que ser ≥ `--h-header`). La prueba
tendría que verificar que `elementFromPoint` sobre la entrada devuelve la entrada misma.

### MEDIUM

**M-1. El foco no llega a la entrada citada: para quien usa teclado o lector de pantalla, la cita no lleva a ningún lado.**
Angular llama a `elSelected.focus({ preventScroll: true })` sobre el `<li>`, pero el `<li>`
(`glossary-anatomy-atlas.html:233`) no tiene `tabindex`, así que esa llamada no hace nada.
Después de Enter sobre «[1]», `document.activeElement` sigue siendo `a.atlas3d__cita [1]` (medido a 375, 768 y 1440),
que ya quedó fuera de la vista. El siguiente Tab vuelve a subir, a «[2]» dentro del texto (`top = 441`).
El lector de pantalla no anuncia la fuente, y la vista y el foco quedan desincronizados. Solución:
`tabindex="-1"` en cada `<li>` de la bibliografía (el anillo de `.atlas3d__fuente--activa` ya existe).

### LOW

- **L-1. Un enlace con fragmento no desplaza la página al cargar.** Al abrir
  `…?structure=UBERON:0000981#atlas3d-fuente-2` (al recargar después de tocar una cita, o desde un enlace compartido), la entrada 2
  aparece resaltada pero con `scrollY = 0` y `top = 1706`. El desplazamiento al ancla ocurre en
  `NavigationEnd`, antes de que la ficha esté renderizada.
- **L-2. El anillo de foco de la cita tapa el texto vecino.** El anillo global (`alovida.css:424`, 4 px, offset 0) sobre un
  enlace de 18×17 en `vertical-align: super` cubre el punto final de la frase y roza la línea anterior
  (`375-light-descripcion-foco.png`: «fémur.[1] En»). Es legible, pero queda tosco.
- **L-3.** El área de toque de la cita (18×17 o 21×17) está por debajo de 24×24. Entra en la excepción «en línea» de
  WCAG 2.5.8, así que no la incumple, pero en táctil a 375 cuesta acertarle.
- **L-4. Artefacto, no defecto.** A 1440, las insignias de desarrollo «Datos de prueba / Ver componentes» tapan
  la entrada 3. A 375, la insignia «Demo» queda sobre la imagen. Son elementos fijos de desarrollo y no forman parte de la ficha.
- **L-5. Artefacto, no defecto.** Bajo el visor queda una columna izquierda vacía, porque `.atlas3d__visor` es
  `sticky` y la captura se tomó con el scroll en la bibliografía. No es una composición pegada a la izquierda.

## Sin hallazgos

- No hay desborde horizontal: `scrollWidth = clientWidth` a 375, 768 y 1440.
- En consola, sólo aparecen los dos avisos de CSP de scripts inline en `/auth`, ajenos al atlas. No hay respuestas HTTP ≥ 400 en la ficha.
- Tras Enter en una opción de búsqueda, el foco pasa al `h2` de la ficha, en claro y en oscuro.
- En oscuro, el resaltado de la fuente usa `rgb(159,216,208)` y el texto `rgb(246,243,237)`. El anillo de la cita es `rgb(87,194,183)`.
- Al elegir otra estructura (`router.navigate` sin `preserveFragment`), el fragmento se descarta y el resaltado no se arrastra.

## Puntaje

| Dimensión | /10 |
|---|---|
| Tipografía | 9 |
| Espaciado | 9 |
| Jerarquía | 9 |
| Consistencia | 9 |
| Responsive | 9 |
| Accesibilidad | 7.5 |
| Interacción | 6 |
| Estados | 9 |
| Densidad | 9 |
| Acabado | 8 |
| **Total** | **84.5/100** |

`PASS = >= 92 Y cero BLOCKER/CRITICAL/HIGH`: **FAIL** (84.5 puntos, con un HIGH).
