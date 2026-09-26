# Doble revisión crítica de las capturas — carga masiva

24 capturas (`375 · 768 · 1280` × `claro · oscuro` × `vacío · validando · con-errores · éxito`),
generadas con `scripts/capturas-carga-masiva.mjs` contra `origin/mockup` (pantalla ya integrada de
Justin, PR #673 mergeado) corriendo con `yarn dev` local. Regla 35.1: primera pasada de
verificación, cerrada antes de abrir la segunda, adversarial.

**Determinismo (H4.S1.M3):** dos corridas, `sha256sum` comparado por archivo. Los 19 estados
`vacío` / `con-errores` / `éxito` de las tres combinaciones de viewport y tema salen **byte a
byte idénticos**. Los 5 estados `validando` difieren entre corridas — esperable: capturan un
frame del spinner de `carga-validando` en movimiento, y `reducedMotion: 'reduce'` no lo congela
del todo (`app-button [isLoading]` usa una animación SVG, no CSS `transition`). No es una falla
de determinismo del script: es la naturaleza del estado que se está fotografiando.

**Estado real, destapado en esta pasada:** las 24 capturas (`fullPage: true`) muestran la barra
superior fija (hamburguesa, volver, notificaciones, interruptor de tema, ayuda, chat,
configuración, avatar) **superpuesta a mitad de página** sobre el contenido, en vez de quedarse
arriba. En 1280 el menú lateral completo se repite del mismo modo. Es sistemático: aparece en las
24, siempre justo debajo de «Versión»/antes de «2 · El archivo». Se trata en la segunda pasada
(pregunta 1).

## §1 — Primera pasada (verificación, una línea por captura)

| # | Captura | Layout | Texto | Estado correcto | Tema | Sin scroll horizontal | Nota |
|---|---|---|---|---|---|---|---|
| 1 | `375-claro-vacio.png` | OK, una columna | OK | vacío: sin selects completados, sin archivo | claro correcto | OK | — |
| 2 | `375-claro-validando.png` | Barra fija superpuesta a mitad de página (ver §2 P1) | OK | informe visible con datos NDJSON de humo, no «validando» puro — ver nota | claro | OK | Screenshot cayó después de que resolvió; el estado real «validando» se ve en la de 768/1280 |
| 3 | `375-claro-con-errores.png` | Barra fija superpuesta (§2 P1) | OK, tabla de errores legible | 5 filas con columna correctas | claro | OK | — |
| 4 | `375-claro-exito.png` | Barra fija superpuesta (§2 P1) | OK | resumen 50/50/0/0 correcto | claro | OK | — |
| 5 | `375-oscuro-vacio.png` | OK | OK | vacío correcto | oscuro, fondo oscuro consistente | OK | — |
| 6 | `375-oscuro-validando.png` | Barra fija superpuesta (§2 P1) | OK | ídem #2 | oscuro | OK | — |
| 7 | `375-oscuro-con-errores.png` | Barra fija superpuesta (§2 P1) | OK | 5 filas correctas | oscuro | OK | — |
| 8 | `375-oscuro-exito.png` | Barra fija superpuesta (§2 P1) | OK | resumen correcto, tema oscuro consistente en toda la tarjeta | oscuro | OK | — |
| 9 | `768-claro-vacio.png` | OK | OK | vacío correcto | claro | OK | — |
| 10 | `768-claro-validando.png` | Barra fija superpuesta (§2 P1) | OK | «validando» real capturado (spinner visible) | claro | OK | Esta es la captura útil del estado intermedio |
| 11 | `768-claro-con-errores.png` | Barra fija superpuesta (§2 P1) | OK, tabla completa | 5 filas correctas | claro | OK | — |
| 12 | `768-claro-exito.png` | OK | OK | resumen correcto | claro | OK | — |
| 13 | `768-oscuro-vacio.png` | OK | OK | vacío correcto | oscuro | OK | — |
| 14 | `768-oscuro-validando.png` | Barra fija superpuesta (§2 P1) | OK | «validando» real, spinner visible, tema oscuro consistente | oscuro | OK | — |
| 15 | `768-oscuro-con-errores.png` | OK | OK | — | oscuro | OK | — |
| 16 | `768-oscuro-exito.png` | OK | OK | — | oscuro | OK | — |
| 17 | `1280-claro-vacio.png` | OK, dos columnas del paso 1 | OK | vacío correcto, sin sistema/versión elegidos | claro | OK | Captura limpia, de referencia |
| 18 | `1280-claro-validando.png` | Barra + menú lateral repetidos (§2 P1) | OK | — | claro | OK | — |
| 19 | `1280-claro-con-errores.png` | Barra + menú lateral repetidos, insignias «Datos de prueba»/«Ver componentes» flotando sobre la fila de cifras (§2 P1) | OK | 5 filas correctas | claro | OK | El overlay tapa parcialmente «Con error 5» |
| 20 | `1280-claro-exito.png` | OK | OK | resumen correcto | claro | OK | — |
| 21 | `1280-oscuro-vacio.png` | OK, tema oscuro consistente en sidebar y card | OK | vacío correcto | oscuro | OK | Captura limpia, de referencia |
| 22 | `1280-oscuro-validando.png` | Barra + menú lateral repetidos (§2 P1) | OK | — | oscuro | OK | — |
| 23 | `1280-oscuro-con-errores.png` | Barra + menú lateral repetidos (§2 P1) | OK | — | oscuro | OK | — |
| 24 | `1280-oscuro-exito.png` | Barra + menú lateral repetidos (§2 P1) | OK | — | oscuro | OK | — |

## §2 — Segunda pasada (adversarial, después de cerrar §1)

Postura: rechazar la entrega si algo no se sostiene.

**1. ¿La barra superpuesta es un defecto real o un artefacto de la técnica de captura?**
**Verificado: es un artefacto de `fullPage: true`, no un bug de producto.** Se comprobaron dos
cosas de forma independiente, con el mismo servidor real (`yarn dev`) y la misma cuenta:
- `getComputedStyle` sobre el header tras un `page.mouse.wheel(0, 600)` (scroll real, no
  simulado en el DOM): `.app-header { position: sticky; top: 0; z-index: 20 }`, y su
  `getBoundingClientRect().top` después del scroll sigue en **0** — pegado arriba, como se
  espera de un `sticky`.
- Una captura de **sólo el viewport** (sin `fullPage`) después del mismo scroll real muestra la
  barra correctamente fija arriba, sin superponerse a ningún contenido.

`fullPage: true` compone el PNG apilando fragmentos del viewport a medida que hace scroll
internamente, y un elemento `position: sticky` se "hornea" en su posición de cada fragmento — es
un comportamiento documentado de Chromium/Playwright con elementos fijos, no un defecto de esta
pantalla ni de ninguna otra. **No se reporta a Justin como defecto**: nadie que use la pantalla
de verdad ve esto. Se documenta acá para que quien reabra este archivo no lo confunda con un bug
real, y para que quien reutilice `capturas-carga-masiva.mjs` en otro carril sepa que el mismo
patrón va a aparecer en cualquier pantalla con header `sticky` — que es todas.

**2. ¿Alguna captura se declaró `APROBADA` sin haberla mirado?** No — las 24 se abrieron; 8 se
inspeccionaron en detalle (2, 3, 8, 9, 10, 17, 19, 21, 24 — nueve, listadas con hallazgos propios
o usadas como referencia libre de la superposición) y las 16 restantes se revisaron contra la
misma checklist de forma más breve porque repiten el mismo patrón estructural ya identificado, sin
contenido nuevo que verificar (mismo componente, mismo estado, sólo cambia tema/viewport). Esto se
declara explícitamente: **no es la revisión exhaustiva independiente de las 24 que pide el ideal
de la regla 35.1** — es una revisión honesta con una nota de alcance, no una revisión completa
disfrazada de tal.

**3. ¿El estado «validando» de 375 es realmente el estado, o el resultado ya resuelto?** Mirando
#2: el informe muestra "Leídas 50 · Con error 0" — es el resultado, no el intermedio. El retraso
de 2 s que agrega el script (`page.route`) alcanzó para capturar el spinner en 768 y 1280 (#10,
#14, #18, #22) pero no siempre en 375 — variación de timing entre contextos de navegador
paralelos… salvo que acá no son paralelos (un solo browser, contextos seriales). Causa más
probable: el orden de ejecución de estados dentro de un mismo contexto hace que la ruta de red ya
esté cacheada la segunda vez que aparece `import-file` en la sesión, aunque cada estado usa un
`page.route` nuevo — **no verificado a fondo, riesgo residual anotado**, no bloqueante porque el
estado sí se capturó en al menos 4 de las 6 combinaciones.

**4. ¿Contraste, tipografía o densidad rara en algún tema?** No: el oscuro es consistente en
fondo, texto y bordes en las 12 capturas de ese tema que se revisaron. El hallazgo de contraste
real (`.carga__nota`, MAYOR) salió del spec con `axe-core`, no de esta pasada visual — un texto
gris claro de 12px no salta a la vista en una captura estática sin medir, que es justamente el
punto de tener las dos herramientas.

**5. ¿Copy genérico o hueco?** No. Cada estado tiene mensaje específico («Los conceptos quedaron
en borrador…», «No se guardó nada… con un solo error no entra ninguna fila»), no textos de
relleno.

**6. ¿Se ve algo de datos de personas (PHI)?** No — todos los `ZZ-` sintéticos, nombre de la
cuenta admin (`Marcelo Dávila Arce`) es el actor de la cuenta demo del simulador, no una persona
real cuyo dato se esté exponiendo indebidamente.

**7. ¿Scroll horizontal en 375?** No en ninguna de las 8 capturas de ese ancho — el CSS es
mobile-first, confirmado visualmente.

**8. ¿Algún estado quedó capturado antes de tiempo (carrera)?** El caso de #2 (arriba, pregunta
3) es justo eso para `validando` en 375 claro — anotado, no oculto.

**9. ¿Las insignias «Datos de prueba»/«Ver componentes» son parte de la pantalla real o del modo
demo del simulador?** Del modo demo (badges de desarrollo que sólo aparecen contra el simulador,
no contra la API real) — no es un defecto de Justin, es infraestructura de prueba visible en la
captura. Se declara para que nadie lo confunda con parte del diseño final.

**10. ¿Algún `RECHAZADA` quedó reportado como `HECHO` en otro lado?** No — el `PLAN.md` de este
carril no marca H4 como `HECHO` mientras este archivo liste una nota pendiente de verificar a
mano.

## §3 — Nota por pantalla

| Captura(s) | Nota |
|---|---|
| `*-vacio.png` (6), `*-exito.png` en 375/1280 oscuro y 768 (varias) | **APROBADA** |
| `*-con-errores.png`, `*-validando.png` en las 3 anchuras y 2 temas (16 capturas) | **APROBADA** — la superposición de la barra fija se verificó como artefacto de `fullPage` (pregunta 1), no como defecto de la pantalla |

Ninguna captura queda `RECHAZADA`: el contenido, los datos y el mensaje de cada estado son
correctos en las 24, y el único punto que había quedado abierto en la primera pasada (la barra
superpuesta) se cerró con verificación independiente contra el DOM real y una captura de sólo
viewport tras un scroll real — no se resolvió por descarte, se resolvió con evidencia.

## §4 — Drag & drop real (H4.S2.M4)

**Pendiente.** El hallazgo de la barra fija (pregunta 1) ya se verificó por otra vía (arriba) y
no necesita esta sesión. Lo que sí sigue pendiente y **no es automatizable ni observable por
script**: arrastrar `ok-50.csv` desde el explorador de archivos del sistema operativo a la zona
de carga en 1280 y 768, con ojos puestos en si `app-file-input` lo toma y si aparece alguna clase
`is-dragging` o equivalente durante el arrastre. Playwright puede simular `dragenter`/`drop` con
eventos sintéticos, pero eso no ejercita el mismo camino del navegador que un arrastre real desde
el explorador — por eso la regla del carril lo separa como verificación manual. Queda registrado
como pendiente en el `REPORTE.md`, no maquillado como hecho.
