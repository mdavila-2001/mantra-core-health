# Segunda revisión visual independiente (agente `visual-reviewer`, 2026-10-24)

Sobre las capturas de la corrida Playwright de `fe53b834` (10/10). Resumen fiel
del informe del agente; el agente no modificó archivos.

**Veredicto: FAIL, 79/100**, con un hallazgo HIGH.

Los siete problemas de la primera pasada (lienzo vacío, ocre sin evidencia,
captura del útero sin la ficha, pestaña «ha» en 375 px, panel cortado en
escritorio, realce de puntero, ubicación del rótulo de traducción):
**corregidos**, cada uno verificado en una captura.

Hallazgos nuevos y qué se hizo (commit siguiente a `fe53b834`):

| Severidad | Hallazgo | Corrección |
|---|---|---|
| HIGH | «Relaciones» decía «resaltada en el modelo» de músculos cuya capa estaba apagada | sólo se dice si la pieza se está dibujando; si no, «tiene pieza en una capa apagada»; prueba unitaria nueva |
| MEDIUM | enlaces con el azul del navegador, no `--text-link` | `.atlas3d a { color: var(--text-link) }` |
| MEDIUM | la ficha de una estructura sin malla no lo decía | rótulo «Sin pieza 3D en este modelo…» bajo el título; Playwright lo exige |
| MEDIUM | lista femenina de 121 filas estiraba el panel | lista acotada (20rem) con scroll propio |
| LOW | insignias de desarrollo tapan «Quitar selección» en 1440 | no se tocó: son superposiciones sólo de la maqueta |
| LOW | placeholder cortado en 375 px | más corto |
| LOW | la prueba «de teclado» usaba `focus()` | ahora llega a la opción con Tab |
| riesgo | visor sticky bajo la barra del armazón | `inset-block-start: calc(var(--h-header) + var(--sp-4))` |

No se pidió una tercera revisión: la evidencia final son las capturas y las
aserciones de Playwright de `gates/playwright.txt`.
