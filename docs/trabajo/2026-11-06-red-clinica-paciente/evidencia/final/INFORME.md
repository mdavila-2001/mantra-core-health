# Capturas finales de la red clínica y del portal del paciente

- **HEAD:** `7b198fa62`, rama `claude/charming-cerf-q7sgmk`, árbol limpio. No se tocó código de la app.
- **Compilación:** una sola `ng build --configuration development,demo`, bajo `ng-test.lock` y con `NODE_OPTIONS=--max-old-space-size=6144`. Terminó con rc 0.
- **Servidor y capturas:** la compilación se sirvió estática, con respaldo SPA (`estatico.cjs`, el mismo servidor de las tandas anteriores). Las capturas se tomaron bajo `navegador.lock`, con un Chromium por combinación.
- **Esperas:** nunca `networkidle`; se espera por test ids.
- **Fallos simulados:** se provocan con `sessionStorage['mock:fallos']`.
- **Consola:** cuenta todo error, salvo los que el interceptor registra por los fallos provocados a propósito (`mock-fallo`, «sin respuesta»).

## Resumen

| Bloque | Aserciones ok | n/a | FALLA | Archivo |
|---|---|---|---|---|
| medica | 382 | 8 | 4 | [medica/aserciones-medica.txt](medica/aserciones-medica.txt) |
| panel | 93 | 0 | 0 | [panel/aserciones-c.txt](panel/aserciones-c.txt) |
| panel | 20 | 0 | 0 | [panel/aserciones-i.txt](panel/aserciones-i.txt) |
| aviso | 24 | 0 | 0 | [aviso/aserciones-c-m5.txt](aviso/aserciones-c-m5.txt) |
| paciente | 84 | 0 | 0 | [paciente/aserciones-paciente.txt](paciente/aserciones-paciente.txt) |
| a11y | 35 | 0 | 0 | [a11y/aserciones-a11y.txt](a11y/aserciones-a11y.txt) |

**Fallan 4 de 642 aserciones (638 ok, más 8 `n/a` a 390).** Las cuatro son de la médica a **1024 con el panel abierto**, en claro y en oscuro (ver §1.1). Todo lo demás pasa.

## 1. Médica: `/medical-records/pid-paciente`, vista Recorrido

- **Guion:** [`captura-medica.cjs`](captura-medica.cjs). Usa las mediciones de [`comun.cjs`](comun.cjs).
- **Estados por combinación:**
  1. en reposo;
  2. «Expandir todo», medido en el final, en el inicio y en el medio del lienzo;
  3. el eje pegado: con todo expandido, la página baja 400 px más allá del borde superior del lienzo;
  4. el panel abierto en el estudio TSH.

| Ancho y tema | Reposo | Expandir todo (página entera) | Eje pegado | Panel |
|---|---|---|---|---|
| 390 claro | [reposo](medica/medica-390-claro-1-reposo.png) | [expandido](medica/medica-390-claro-2-expandido.png) | [eje-pegado](medica/medica-390-claro-3-eje-pegado.png) | [panel](medica/medica-390-claro-4-panel.png) |
| 768 claro | [reposo](medica/medica-768-claro-1-reposo.png) | [expandido](medica/medica-768-claro-2-expandido.png) | [eje-pegado](medica/medica-768-claro-3-eje-pegado.png) | [panel](medica/medica-768-claro-4-panel.png) |
| 1024 claro | [reposo](medica/medica-1024-claro-1-reposo.png) | [expandido](medica/medica-1024-claro-2-expandido.png) | [eje-pegado](medica/medica-1024-claro-3-eje-pegado.png) | [panel](medica/medica-1024-claro-4-panel.png) |
| 1440 claro | [reposo](medica/medica-1440-claro-1-reposo.png) | [expandido](medica/medica-1440-claro-2-expandido.png) | [eje-pegado](medica/medica-1440-claro-3-eje-pegado.png) | [panel](medica/medica-1440-claro-4-panel.png) |
| 1920 claro | [reposo](medica/medica-1920-claro-1-reposo.png) | [expandido](medica/medica-1920-claro-2-expandido.png) | [eje-pegado](medica/medica-1920-claro-3-eje-pegado.png) | [panel](medica/medica-1920-claro-4-panel.png) |
| 390 oscuro | [reposo](medica/medica-390-oscuro-1-reposo.png) | [expandido](medica/medica-390-oscuro-2-expandido.png) | [eje-pegado](medica/medica-390-oscuro-3-eje-pegado.png) | [panel](medica/medica-390-oscuro-4-panel.png) |
| 768 oscuro | [reposo](medica/medica-768-oscuro-1-reposo.png) | [expandido](medica/medica-768-oscuro-2-expandido.png) | [eje-pegado](medica/medica-768-oscuro-3-eje-pegado.png) | [panel](medica/medica-768-oscuro-4-panel.png) |
| 1024 oscuro | [reposo](medica/medica-1024-oscuro-1-reposo.png) | [expandido](medica/medica-1024-oscuro-2-expandido.png) | [eje-pegado](medica/medica-1024-oscuro-3-eje-pegado.png) | [panel](medica/medica-1024-oscuro-4-panel.png) |
| 1440 oscuro | [reposo](medica/medica-1440-oscuro-1-reposo.png) | [expandido](medica/medica-1440-oscuro-2-expandido.png) | [eje-pegado](medica/medica-1440-oscuro-3-eje-pegado.png) | [panel](medica/medica-1440-oscuro-4-panel.png) |
| 1920 oscuro | [reposo](medica/medica-1920-oscuro-1-reposo.png) | [expandido](medica/medica-1920-oscuro-2-expandido.png) | [eje-pegado](medica/medica-1920-oscuro-3-eje-pegado.png) | [panel](medica/medica-1920-oscuro-4-panel.png) |

**Qué mide cada aserción** (en [`comun.cjs`](comun.cjs) → `medirRed` y `afirmarRed`; cada estado repite todo lo que aplica):

| Hallazgo | Cómo se mide | Resultado |
|---|---|---|
| Ningún nombre de episodio cortado | La caja de `Range.selectNodeContents` del texto contra la caja del `span` (ancho, alto y borde derecho), y la caja contra el área visible del lienzo | ok en todo, **salvo 1024 claro y oscuro con el panel abierto** |
| Los chips del borde no tocan los puntos del eje | Intersección de cada `.red__borde-salto` con cada `.red__marca-eje` (los puntos) y con el `Range` de cada fecha visible | ok en todos los estados y anchos |
| Los dos chips del borde no se pisan entre sí | Intersección entre «Lo más antiguo» y «Lo más reciente» (aserción agregada en esta pasada) | ok, **salvo 1024 claro y oscuro con el panel abierto** |
| El eje no queda bajo la barra | Toda fecha del eje pintada en la ventana tiene `top ≥ bottom` del `header[app-header]`. Con el eje pegado, además, `data-eje-pegado`, el lienzo detrás de la barra y las fechas en `[barra, barra+40]` | ok en 768–1920, en claro y oscuro. Ejemplo a 1440: barra 56, fechas 85 |
| La primera columna visible muestra el año | La primera `.red__columna` con el centro dentro del lienzo dice `20xx`, y ningún «mismo día» queda sin su día de referencia a la vista | ok en todos los estados |
| Las franjas vacías miden 80 o 48 px | Cada franja desplegada sin nodos dentro de la ventana del lienzo mide 80 (plegada) o 48 (solo la cabecera), medido en el final, el inicio y el medio | ok en todo. Ejemplo a 1440 inicio: 80, 48, 48, 80, 80, 80 |
| Ninguna arista termina fuera del lienzo sin su indicador | Cada extremo de cada `path.red__arista`, pasado a pantalla con `getScreenCTM`: dentro del lienzo, y sobre el borde de un nodo o con `marker` = `#red-sigue` | ok en todo. Ejemplo a 1440 inicio: 40 extremos, 3 con «sigue», 0 sueltos |
| Sin desplazamiento horizontal | `scrollWidth ≤ clientWidth` del documento | ok en todo |
| Consola sin errores | `pageerror` y `console.error` | ok en las 10 combinaciones |

**A 390** la red es una lista vertical, sin lienzo. El eje, los chips del borde y las aristas no existen allí y se anotan como `n/a` (8 líneas). A 390 sí se miden los nombres, el desborde y la consola. La captura «eje pegado» a 390 es la página desplazada 600 px.

### 1.1 Lo que falla: 1024 con el panel abierto

Capturas: [`medica-1024-claro-4-panel.png`](medica/medica-1024-claro-4-panel.png) y [`medica-1024-oscuro-4-panel.png`](medica/medica-1024-oscuro-4-panel.png).

- **El lienzo se encoge.** Con el panel al costado, el lienzo queda en **280 px de ancho**, medido con una sonda aparte: va de x 298 a x 578.
- **Los chips se pisan.** «Lo más antiguo» y «Lo más reciente» se superponen: el segundo tapa al primero, que se lee «Lo más antig».
- **Nombres cortados.** La aserción marcó los 7 nombres de episodio.
  - En la sonda aparte, el ancho del texto (`Range`) cabe en su caja: por ejemplo, «Hipotiroidismo» mide 96 de 96 px.
  - Entonces el corte viene del alto o de la posición en el momento de la captura.
  - En la imagen se ve la píldora «Hipotiroidismo» con el borde superior metido bajo el eje.
  - No determiné cuál de las dos condiciones disparó la marca.
- **Descarga partida.** El botón de descarga del panel se parte en dos líneas.
- Es un defecto real de diseño a ese ancho, no del guion. Queda para quien corresponda; este agente no toca código.

### 1.2 Observaciones visuales que no cubre ninguna aserción

Salen de mirar [`medica-1440-claro-3-eje-pegado.png`](medica/medica-1440-claro-3-eje-pegado.png):

- **Eje pegado:**
  - El chip «← 13 antes» de la franja que pasa por debajo queda medio tapado por el eje. Es el contenido que se desplaza bajo un elemento sticky.
  - En el borde izquierdo del eje asoma el resto de la fecha de la columna anterior, cortado. La aserción del año mide la primera columna **con su centro** en vista, así que no lo cuenta.
- **Barra superior translúcida:** se transparenta el texto de la cabecera del episodio que quedó detrás. Lo que se ve son cabeceras, no fechas del eje.
- No revisé a ojo las 40 capturas de la médica. Las aserciones son la verificación; solo se miraron algunas.

## 2. El panel en sus estados M34

- **Guiones:** [`parte-2/c/captura-c.cjs`](../parte-2/c/captura-c.cjs) y [`parte-3/I/captura-i.cjs`](../parte-3/I/captura-i.cjs), reutilizados sin cambios y con salida en `final/panel/`.
- **Aserciones:**
  - [`aserciones-c.txt`](panel/aserciones-c.txt): 93 ok.
  - [`aserciones-i.txt`](panel/aserciones-i.txt): 20 ok. Cubren M-1 (S3 con próxima acción y sin «días» huérfano), M-2 (S4 sin el texto del 422 ni «Reintentar»), M-3 (tono de aviso en «Pendiente»), M-6 y L-3.

| Combinación | S2 | S3 | S4 | S5 | S6 | S8 | S9 | Éxito | Descarga (S4) |
|---|---|---|---|---|---|---|---|---|---|
| 1440-claro | [ver](panel/1440-claro-s2-cargando.png) | [ver](panel/1440-claro-s3-sin-resultado.png) | [ver](panel/1440-claro-s4-validacion.png) | [ver](panel/1440-claro-s5-403.png) | [ver](panel/1440-claro-s6-404.png) | [ver](panel/1440-claro-s8-sin-conexion.png) | [ver](panel/1440-claro-s9-error-con-id.png) | [ver](panel/1440-claro-exito.png) | [ver](panel/1440-claro-descarga-validacion.png) |
| 1440-oscuro | [ver](panel/1440-oscuro-s2-cargando.png) | [ver](panel/1440-oscuro-s3-sin-resultado.png) | [ver](panel/1440-oscuro-s4-validacion.png) | [ver](panel/1440-oscuro-s5-403.png) | [ver](panel/1440-oscuro-s6-404.png) | [ver](panel/1440-oscuro-s8-sin-conexion.png) | [ver](panel/1440-oscuro-s9-error-con-id.png) | [ver](panel/1440-oscuro-exito.png) | [ver](panel/1440-oscuro-descarga-validacion.png) |
| 390-claro | [ver](panel/390-claro-s2-cargando.png) | [ver](panel/390-claro-s3-sin-resultado.png) | [ver](panel/390-claro-s4-validacion.png) | [ver](panel/390-claro-s5-403.png) | [ver](panel/390-claro-s6-404.png) | [ver](panel/390-claro-s8-sin-conexion.png) | [ver](panel/390-claro-s9-error-con-id.png) | [ver](panel/390-claro-exito.png) | [ver](panel/390-claro-descarga-validacion.png) |

Extras de `captura-i`, a 1440 claro y 390 claro:

- [`1440-claro-m1-s3.png`](panel/1440-claro-m1-s3.png)
- [`1440-claro-m2-s4.png`](panel/1440-claro-m2-s4.png)
- [`1440-claro-l3-descarga.png`](panel/1440-claro-l3-descarga.png)
- [`390-claro-m1-s3.png`](panel/390-claro-m1-s3.png)
- [`390-claro-m2-s4.png`](panel/390-claro-m2-s4.png)
- [`390-claro-l3-descarga.png`](panel/390-claro-l3-descarga.png)

`captura-i` no corre a 1440 oscuro. El S3 de 1440 oscuro viene de `captura-c`, cuyas aserciones de S3 verifican el texto, no la próxima acción.

## 3. El aviso de paso con «Quitar filtros»

- **Guion:** [`parte-2/c/captura-c-m5.cjs`](../parte-2/c/captura-c-m5.cjs), reutilizado.
- **Aserciones:** [`aserciones-c-m5.txt`](aviso/aserciones-c-m5.txt): 24 ok, **incluido 1440 oscuro**, que antes se caía por memoria.
- **Qué comprueban:**
  - el aviso nombra el filtro activo («con este filtro: el hilo de Trastorno de ansiedad generalizada»);
  - «Quitar filtros» limpia el filtro y el paso no cambia;
  - el foco no cae en `body` (queda en `recorrido-nodo`);
  - al salir del paso a paso, el filtro sigue quitado.

| Combinación | Aviso | Tras «Quitar filtros» |
|---|---|---|
| 1440 claro | [ver](aviso/1440-claro-m5-aviso-de-paso.png) | [ver](aviso/1440-claro-m5-tras-quitar-filtros.png) |
| **1440 oscuro** | [ver](aviso/1440-oscuro-m5-aviso-de-paso.png) | [ver](aviso/1440-oscuro-m5-tras-quitar-filtros.png) |
| 390 claro | [ver](aviso/390-claro-m5-aviso-de-paso.png) | [ver](aviso/390-claro-m5-tras-quitar-filtros.png) |

## 4 y 5. Portal del paciente y portada

- **Guion:** [`captura-paciente.cjs`](captura-paciente.cjs).
- **Aserciones:** [`aserciones-paciente.txt`](paciente/aserciones-paciente.txt): 84 ok.

| Ancho y tema | Portada | Mi recorrido (hilo y anidados) | S5 403 | S9 500 | Por fecha: `historia-detalle-falta` | Por fecha: `historia-citas-sin-cargar` |
|---|---|---|---|---|---|---|
| 390 claro | [ver](paciente/paciente-390-claro-0-portada.png) | [ver](paciente/paciente-390-claro-1-recorrido-hilo.png) | [ver](paciente/paciente-390-claro-2-recorrido-s5-403.png) | [ver](paciente/paciente-390-claro-3-recorrido-s9-500.png) | [ver](paciente/paciente-390-claro-4-por-fecha-detalle-falta.png) | [ver](paciente/paciente-390-claro-4-por-fecha-citas-sin-cargar.png) |
| 1024 claro | [ver](paciente/paciente-1024-claro-0-portada.png) | [ver](paciente/paciente-1024-claro-1-recorrido-hilo.png) | [ver](paciente/paciente-1024-claro-2-recorrido-s5-403.png) | [ver](paciente/paciente-1024-claro-3-recorrido-s9-500.png) | [ver](paciente/paciente-1024-claro-4-por-fecha-detalle-falta.png) | [ver](paciente/paciente-1024-claro-4-por-fecha-citas-sin-cargar.png) |
| 1440 claro | [ver](paciente/paciente-1440-claro-0-portada.png) | [ver](paciente/paciente-1440-claro-1-recorrido-hilo.png) | [ver](paciente/paciente-1440-claro-2-recorrido-s5-403.png) | [ver](paciente/paciente-1440-claro-3-recorrido-s9-500.png) | [ver](paciente/paciente-1440-claro-4-por-fecha-detalle-falta.png) | [ver](paciente/paciente-1440-claro-4-por-fecha-citas-sin-cargar.png) |
| 390 oscuro | [ver](paciente/paciente-390-oscuro-0-portada.png) | [ver](paciente/paciente-390-oscuro-1-recorrido-hilo.png) | [ver](paciente/paciente-390-oscuro-2-recorrido-s5-403.png) | [ver](paciente/paciente-390-oscuro-3-recorrido-s9-500.png) | [ver](paciente/paciente-390-oscuro-4-por-fecha-detalle-falta.png) | [ver](paciente/paciente-390-oscuro-4-por-fecha-citas-sin-cargar.png) |
| 1024 oscuro | [ver](paciente/paciente-1024-oscuro-0-portada.png) | [ver](paciente/paciente-1024-oscuro-1-recorrido-hilo.png) | [ver](paciente/paciente-1024-oscuro-2-recorrido-s5-403.png) | [ver](paciente/paciente-1024-oscuro-3-recorrido-s9-500.png) | [ver](paciente/paciente-1024-oscuro-4-por-fecha-detalle-falta.png) | [ver](paciente/paciente-1024-oscuro-4-por-fecha-citas-sin-cargar.png) |
| 1440 oscuro | [ver](paciente/paciente-1440-oscuro-0-portada.png) | [ver](paciente/paciente-1440-oscuro-1-recorrido-hilo.png) | [ver](paciente/paciente-1440-oscuro-2-recorrido-s5-403.png) | [ver](paciente/paciente-1440-oscuro-3-recorrido-s9-500.png) | [ver](paciente/paciente-1440-oscuro-4-por-fecha-detalle-falta.png) | [ver](paciente/paciente-1440-oscuro-4-por-fecha-citas-sin-cargar.png) |

**Qué se afirma en cada combinación:**

- **Portada:** síntomas y próxima cita a la vista; sin desplazamiento horizontal.
- **Mi recorrido:**
  - hay a la vez un hijo abierto y un hijo plegado dentro del hilo abierto;
  - cada flecha sigue a su propio `aria-expanded` (0 discrepancias);
  - sin desplazamiento horizontal.
- **S5:** tono de aviso (`.alert--warning`), nada en tono de error, sin «Código de soporte» ni «Reintentar», y lo que llegó sigue dibujado.
- **S9:** muestra el ID de petición `mock-fallo` y una sola acción «Reintentar».
- **Por fecha:**
  - cada aviso parcial aparece con las 11 atenciones todavía dibujadas;
  - el aviso es S9, con su ID y «Reintentar»;
  - sin desplazamiento horizontal.
- **Consola:** sin errores ajenos a los fallos provocados.

**Nota honesta sobre «Por fecha».** Los dos avisos parciales no aparecen juntos.

- La lectura del detalle es un `forkJoin`. Si fallan las órdenes, se cancela antes de que respondan las citas, y entonces solo se ve `historia-detalle-falta`.
- La primera pasada los forzó juntos y falló 6 veces por eso (`citas: false`).
- Se tomaron por separado, con una recarga entre los dos: órdenes en 500 da `detalle-falta`, y `/scheduling/bookings` en 500 da `citas-sin-cargar`.
- No lo considero un defecto: si falta el detalle entero, el aviso de reconsultas no agrega nada. Igual lo anoto.

## 6. Accesibilidad: axe-core y teclado

- **Guion:** [`a11y-final.cjs`](a11y-final.cjs).
- **Aserciones:** [`aserciones-a11y.txt`](a11y/aserciones-a11y.txt): 35 ok.
- **axe-core:** se inyecta desde `node_modules/axe-core/axe.min.js`, como en `tanda-visual-3/a11y-tanda-3.cjs`, con las etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` y `wcag22aa`.
  - Médica a 1440 claro y oscuro y a 390 claro y oscuro: red plegada, red expandida y panel TSH. **0 violaciones en las 12 pasadas.**
  - Paciente «Mi recorrido» a 1440 claro y oscuro y a 390 claro: **0 violaciones.**
- **Teclado**, a 1440 claro y oscuro. Tras cada tecla se lee `document.activeElement`.
  - Recorrido con Tab desde «Expandir todo»: Contraer, Lo más antiguo, lienzo, episodios…
  - «Expandir todo» y «Contraer todo» con Enter: se desactivan solos y el foco no cae en `body`.
  - «Lo más antiguo» con Enter: el foco queda en el lienzo.
  - Enter despliega el episodio, y el nodo enfocado queda entero en la pantalla.
  - Enter sobre el nodo abre el panel con el foco en su título (`h2`).
  - Tab recorre Cerrar, Descargar y los 3 vínculos, y sale a «Datos de prueba». A este ancho el panel no es modal.
  - Shift+Tab vuelve al panel, y Escape lo cierra con el foco devuelto al nodo TSH.
  - **El foco nunca cayó en `body` en 27 pulsaciones.**
- **Capturas:**
  - [`teclado-1440-claro-1-foco-en-nodo.png`](a11y/teclado-1440-claro-1-foco-en-nodo.png)
  - [`teclado-1440-claro-2-panel-teclado.png`](a11y/teclado-1440-claro-2-panel-teclado.png)
  - [`teclado-1440-oscuro-1-foco-en-nodo.png`](a11y/teclado-1440-oscuro-1-foco-en-nodo.png)
  - [`teclado-1440-oscuro-2-panel-teclado.png`](a11y/teclado-1440-oscuro-2-panel-teclado.png)
- **Corrección del guion en la primera pasada:** el Tab seguía hasta salir del documento. El navegador deja entonces `activeElement = body`, y el Escape se pulsaba fuera del panel. El guion ahora se detiene al salir del panel y vuelve con Shift+Tab. Lo que se mide de la app no cambió.

## Qué no se pudo capturar o no se verificó

- **El fallo de 1024 con el panel abierto** (§1.1) queda abierto. No es tarea de este agente corregirlo.
- **Teclado a 390:** no se hizo. Ahí el panel es una hoja modal y la trampa de foco no se midió.
- **axe** no corrió sobre «Por fecha» ni sobre la portada del paciente.
- **S3 a 1440 oscuro:** no tiene la aserción de «próxima acción» (M-1); solo la cubren 1440 claro y 390 claro.
- **Revisión a ojo:** solo se miraron algunas capturas (médica 1440 eje pegado, médica 1024 panel, aviso 1440 oscuro, paciente 1440 oscuro con citas sin cargar). Las observaciones de §1.2 no están medidas.
- **Pruebas:** no se corrieron la puerta de pre-push, `ng test` ni Playwright del repo. Esto es evidencia visual, no la puerta.
- **Navegador:** Chromium no se cayó por memoria en ninguna corrida, así que no hizo falta reintentar.
- **Aprobación:** quien tomó estas capturas no aprueba el trabajo (`NO_SELF_APPROVAL`).
