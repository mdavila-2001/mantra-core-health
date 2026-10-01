# C0 — revisión visual P1

Estado de esta pasada: HECHO. Revisor: agente c0_guard. Fecha: 2026-09-25.

Se inspeccionaron individualmente las **60 capturas finales**: **50 OK, 8 con defecto menor y 2 con defecto mayor**. La pasada está completa; el layout global no está aprobado por los defectos abiertos. Este documento solo acredita P1. **No acredita P2, E2E verde, cierre global ni verificación contra backend real.**

## Método y procedencia

Se aplicaron [critical-double-review](../../../../../../AlovidaPromptManager/.agents/skills/critical-double-review/SKILL.md) y [fable-visual-proof](../../../../../../.agents/skills/fable-visual-proof/SKILL.md). El revisor no implementó la UI clínica; sí colaboró con el guard y el encuadre de las pruebas.

Se abrieron los PNG originales mediante lectura binaria local y visualización de cada imagen, sin editar, redimensionar ni recomponer archivos. Las lecturas se agruparon para ahorrar tiempo; cada captura recibió observación propia. Se comprobó el SHA256 de cada archivo al finalizar: **60 coincidencias con las versiones observadas, 0 archivos cambiados, 0 hashes duplicados**. No se aprobó ninguna captura por semejanza con otra.

Las 30 capturas de modales corresponden a la recaptura posterior al ajuste de destrucción del modal/foco. Las versiones anteriores y las sondas con skeleton o carga pendiente quedan reemplazadas. Rejilla e historia usan capturas completas; la dimensión del PNG puede superar la altura del viewport.

Todos los datos proceden de fixtures sintéticos del simulador. No se transcriben aquí nombres, notas, diagnósticos ni otros contenidos clínicos de las imágenes.

## Hallazgos abiertos

| ID | Gravedad | Archivos | Observación y límite |
|---|---|---|---|
| P1-01 | MAYOR | history-390-dark/light | La cabecera global ocupa403px con viewport390px: desbordamiento horizontal13px. Los tres grupos clínicos están completos. La comparación con base y su origen preexistente fueron confirmados por el agente raíz; fuera del alcance UI de C0. No se aprueba el layout global. |
| P1-02 | MENOR | history-1024-dark/light | La pestaña seleccionada Diagnósticos queda fuera del tramo visible de la tira, aunque su contenido se muestra. El sello fijo de demo tapa parte de una cabecera de tarjeta activa. Los tres grupos permanecen identificables. |
| P1-03 | MENOR | grid-1440-dark/light | Los doce títulos están completos y en orden; el sello fijo de demo cubre parcialmente el título inferior del registro del encuentro. |
| P1-04 | MENOR | stock-medical-note-1440-dark/light | El stub se lee entero y el tema es correcto. El sello fijo de demo invade el borde superior del inspector y su pestaña Entradas. |
| P1-05 | MENOR | stock-medical-note-1920-dark/light | El stub se lee entero y el tema es correcto. El sello fijo de demo tapa una etiqueta de entrada del inspector inferior. |

No se detectaron solapes, desbordamiento horizontal ni skeleton en los 30 modales finales. En órdenes390/1024 el formulario está completo y la lista continúa por desplazamiento interno; estas imágenes no muestran la totalidad del historial interno en un único encuadre.

## Contrato visual del stock

El cromo del stock es **claro de forma intencional** (`component-stock.css`, `color-scheme: light`); `prepararDocumento()` copia `data-theme` y `data-tema` al iframe. Las diez capturas finales muestran el stub en el tema esperado, incluidas las dos de390 que antes no lo encuadraban.

Los cinco tamaños de la matriz describen el viewport exterior. Se conserva el preset nativo **Portátil1280×800**, mostrado en la herramienta; no se añadieron presets de producto. Esta revisión no equivale a medir cinco tamaños independientes del documento interior.

El stock monta con valores generados y conserva una entrada sin verificar. La observación acredita la apariencia del stub; no acredita interacciones ni validez de todas las entradas generadas.

## Veredicto por archivo

OK significa ausencia de defecto visual observado en la superficie indicada; no prueba comportamiento funcional. Las observaciones de foco describen el contorno visible, no sustituyen el recorrido de teclado.

| Archivo | Viewport exterior | PNG | Tema | Estado | P1 | Observación |
|---|---|---|---|---|---|---|
| [grid-390-dark.png](visual/grid-390-dark.png) | 390×844 | 390×1792 | Oscuro | Rejilla | OK | Doce casillas completas y en orden, una columna; sin toast ni recorte horizontal. |
| [history-390-dark.png](visual/history-390-dark.png) | 390×844 | 403×1440 | Oscuro | Historia | DEFECTO/MAYOR | Tres grupos completos. Cabecera global excede390px: PNG403px; overflow13px preexistente confirmado por agente raíz. |
| [notas-390-dark.png](visual/notas-390-dark.png) | 390×844 | 390×844 | Oscuro | Nota médica | OK | Stub C1, título y cierre enfocado completos; modal legible y dentro del viewport. |
| [ordenes-390-dark.png](visual/ordenes-390-dark.png) | 390×844 | 390×844 | Oscuro | Orden de análisis | OK | Formulario y selector enfocado legibles; órdenes cargadas con continuación en scroll interno. Modal dentro de390px. |
| [reconsulta-390-dark.png](visual/reconsulta-390-dark.png) | 390×844 | 390×844 | Oscuro | Reconsulta | OK | Fecha enfocada, motivo y acción completos; textos envueltos legibles y modal dentro del viewport, sin skeleton. |
| [stock-medical-note-390-dark.png](visual/stock-medical-note-390-dark.png) | 390×844 | 390×844 | Oscuro | Stock / Nota médica | OK | Stub C1 visible completo en móvil; tema del iframe correcto y cromo claro intencional, sin solapes. |
| [grid-390-light.png](visual/grid-390-light.png) | 390×844 | 390×1792 | Claro | Rejilla | OK | Doce casillas completas y en orden, una columna; sin toast ni recorte horizontal. |
| [history-390-light.png](visual/history-390-light.png) | 390×844 | 403×1440 | Claro | Historia | DEFECTO/MAYOR | Tres grupos completos. Cabecera global excede390px: PNG403px; overflow13px preexistente confirmado por agente raíz. |
| [notas-390-light.png](visual/notas-390-light.png) | 390×844 | 390×844 | Claro | Nota médica | OK | Stub C1, título y cierre enfocado completos; modal legible y dentro del viewport. |
| [ordenes-390-light.png](visual/ordenes-390-light.png) | 390×844 | 390×844 | Claro | Orden de análisis | OK | Formulario y selector enfocado legibles; órdenes cargadas con continuación en scroll interno. Modal dentro de390px. |
| [reconsulta-390-light.png](visual/reconsulta-390-light.png) | 390×844 | 390×844 | Claro | Reconsulta | OK | Fecha enfocada, motivo y acción completos; textos envueltos legibles y modal dentro del viewport, sin skeleton. |
| [stock-medical-note-390-light.png](visual/stock-medical-note-390-light.png) | 390×844 | 390×844 | Claro | Stock / Nota médica | OK | Stub C1 visible completo en móvil; tema del iframe correcto y cromo claro intencional, sin solapes. |
| [grid-768-dark.png](visual/grid-768-dark.png) | 768×1024 | 768×1193 | Oscuro | Rejilla | OK | Doce casillas completas en dos columnas, orden correcto y textos legibles. |
| [history-768-dark.png](visual/history-768-dark.png) | 768×1024 | 768×1163 | Oscuro | Historia | OK | Tres grupos completos y legibles; pestaña Diagnósticos seleccionada visible, sin superposiciones de contenido. |
| [notas-768-dark.png](visual/notas-768-dark.png) | 768×1024 | 768×1024 | Oscuro | Nota médica | OK | Stub C1, título y cierre enfocado completos; modal legible y dentro del viewport. |
| [ordenes-768-dark.png](visual/ordenes-768-dark.png) | 768×1024 | 768×1024 | Oscuro | Orden de análisis | OK | Formulario y cuatro órdenes completos; selector enfocado y botón deshabilitado coherente con campos vacíos. |
| [reconsulta-768-dark.png](visual/reconsulta-768-dark.png) | 768×1024 | 768×1024 | Oscuro | Reconsulta | OK | Fecha enfocada, motivo y acción completos; textos envueltos legibles y modal dentro del viewport, sin skeleton. |
| [stock-medical-note-768-dark.png](visual/stock-medical-note-768-dark.png) | 768×1024 | 768×1024 | Oscuro | Stock / Nota médica | OK | Stub C1 completo y tema del iframe correcto; cromo claro intencional y sin superposiciones sobre el contenido. |
| [grid-768-light.png](visual/grid-768-light.png) | 768×1024 | 768×1193 | Claro | Rejilla | OK | Doce casillas completas en dos columnas, orden correcto y textos legibles. |
| [history-768-light.png](visual/history-768-light.png) | 768×1024 | 768×1163 | Claro | Historia | OK | Tres grupos completos y legibles; pestaña Diagnósticos seleccionada visible, sin superposiciones de contenido. |
| [notas-768-light.png](visual/notas-768-light.png) | 768×1024 | 768×1024 | Claro | Nota médica | OK | Stub C1, título y cierre enfocado completos; modal legible y dentro del viewport. |
| [ordenes-768-light.png](visual/ordenes-768-light.png) | 768×1024 | 768×1024 | Claro | Orden de análisis | OK | Formulario y cuatro órdenes completos; selector enfocado y botón deshabilitado coherente con campos vacíos. |
| [reconsulta-768-light.png](visual/reconsulta-768-light.png) | 768×1024 | 768×1024 | Claro | Reconsulta | OK | Fecha enfocada, motivo y acción completos; textos envueltos legibles y modal dentro del viewport, sin skeleton. |
| [stock-medical-note-768-light.png](visual/stock-medical-note-768-light.png) | 768×1024 | 768×1024 | Claro | Stock / Nota médica | OK | Stub C1 completo y tema del iframe correcto; cromo claro intencional y sin superposiciones sobre el contenido. |
| [grid-1024-dark.png](visual/grid-1024-dark.png) | 1024×768 | 1024×1163 | Oscuro | Rejilla | OK | Doce casillas completas y ordenadas; texto envuelto legible. Sello de demo sobre margen de Medición sin tapar título. |
| [history-1024-dark.png](visual/history-1024-dark.png) | 1024×768 | 1024×1055 | Oscuro | Historia | DEFECTO/MENOR | Tres grupos presentes; sello fijo de demo tapa parte de una cabecera. Pestaña Diagnósticos fuera del tramo visible de la tira. |
| [notas-1024-dark.png](visual/notas-1024-dark.png) | 1024×768 | 1024×768 | Oscuro | Nota médica | OK | Stub C1 completo; título, cierre enfocado y contenido legibles. Modal centrado sin solapes ni cortes. |
| [ordenes-1024-dark.png](visual/ordenes-1024-dark.png) | 1024×768 | 1024×768 | Oscuro | Orden de análisis | OK | Formulario completo, selector enfocado y órdenes cargadas. Historial continúa en scroll interno; sin recorte horizontal. |
| [reconsulta-1024-dark.png](visual/reconsulta-1024-dark.png) | 1024×768 | 1024×768 | Oscuro | Reconsulta | OK | Fecha enfocada, motivo y acción completos; sin skeleton, solapes ni recorte horizontal. |
| [stock-medical-note-1024-dark.png](visual/stock-medical-note-1024-dark.png) | 1024×768 | 1024×768 | Oscuro | Stock / Nota médica | OK | Stub C1 completo y tema correcto en iframe; cromo claro intencional. Sello sobre zona vacía sin ocultar stub. |
| [grid-1024-light.png](visual/grid-1024-light.png) | 1024×768 | 1024×1163 | Claro | Rejilla | OK | Doce casillas completas y ordenadas; texto envuelto legible. Sello de demo sobre margen de Medición sin tapar título. |
| [history-1024-light.png](visual/history-1024-light.png) | 1024×768 | 1024×1055 | Claro | Historia | DEFECTO/MENOR | Tres grupos presentes; sello fijo de demo tapa parte de una cabecera. Pestaña Diagnósticos fuera del tramo visible de la tira. |
| [notas-1024-light.png](visual/notas-1024-light.png) | 1024×768 | 1024×768 | Claro | Nota médica | OK | Stub C1 completo; título, cierre enfocado y contenido legibles. Modal centrado sin solapes ni cortes. |
| [ordenes-1024-light.png](visual/ordenes-1024-light.png) | 1024×768 | 1024×768 | Claro | Orden de análisis | OK | Formulario completo, selector enfocado y órdenes cargadas. Historial continúa en scroll interno; sin recorte horizontal. |
| [reconsulta-1024-light.png](visual/reconsulta-1024-light.png) | 1024×768 | 1024×768 | Claro | Reconsulta | OK | Fecha enfocada, motivo y acción completos; sin skeleton, solapes ni recorte horizontal. |
| [stock-medical-note-1024-light.png](visual/stock-medical-note-1024-light.png) | 1024×768 | 1024×768 | Claro | Stock / Nota médica | OK | Stub C1 completo y tema correcto en iframe; cromo claro intencional. Sello sobre zona vacía sin ocultar stub. |
| [grid-1440-dark.png](visual/grid-1440-dark.png) | 1440×900 | 1440×995 | Oscuro | Rejilla | DEFECTO/MENOR | Doce casillas completas y ordenadas; sello fijo de demo cubre parcialmente título inferior del registro del encuentro. |
| [history-1440-dark.png](visual/history-1440-dark.png) | 1440×900 | 1440×1074 | Oscuro | Historia | OK | Tres grupos y pestaña seleccionada visibles. Sello de demo sobre margen inferior de tarjeta, sin ocultar contenido clínico. |
| [notas-1440-dark.png](visual/notas-1440-dark.png) | 1440×900 | 1440×900 | Oscuro | Nota médica | OK | Stub C1 completo; título, cierre enfocado y contenido legibles. Modal centrado sin solapes ni cortes. |
| [ordenes-1440-dark.png](visual/ordenes-1440-dark.png) | 1440×900 | 1440×900 | Oscuro | Orden de análisis | OK | Formulario y cuatro órdenes completos; selector enfocado, acción deshabilitada por campos vacíos; sin solapes. |
| [reconsulta-1440-dark.png](visual/reconsulta-1440-dark.png) | 1440×900 | 1440×900 | Oscuro | Reconsulta | OK | Fecha enfocada, motivo y acción completos; sin skeleton, solapes ni recorte horizontal. |
| [stock-medical-note-1440-dark.png](visual/stock-medical-note-1440-dark.png) | 1440×900 | 1440×900 | Oscuro | Stock / Nota médica | DEFECTO/MENOR | Stub C1 completo y tema correcto; sello fijo de demo se superpone al borde superior del inspector/Entradas. |
| [grid-1440-light.png](visual/grid-1440-light.png) | 1440×900 | 1440×995 | Claro | Rejilla | DEFECTO/MENOR | Doce casillas completas y ordenadas; sello fijo de demo cubre parcialmente título inferior del registro del encuentro. |
| [history-1440-light.png](visual/history-1440-light.png) | 1440×900 | 1440×1074 | Claro | Historia | OK | Tres grupos y pestaña seleccionada visibles. Sello de demo sobre margen inferior de tarjeta, sin ocultar contenido clínico. |
| [notas-1440-light.png](visual/notas-1440-light.png) | 1440×900 | 1440×900 | Claro | Nota médica | OK | Stub C1 completo; título, cierre enfocado y contenido legibles. Modal centrado sin solapes ni cortes. |
| [ordenes-1440-light.png](visual/ordenes-1440-light.png) | 1440×900 | 1440×900 | Claro | Orden de análisis | OK | Formulario y cuatro órdenes completos; selector enfocado, acción deshabilitada por campos vacíos; sin solapes. |
| [reconsulta-1440-light.png](visual/reconsulta-1440-light.png) | 1440×900 | 1440×900 | Claro | Reconsulta | OK | Fecha enfocada, motivo y acción completos; sin skeleton, solapes ni recorte horizontal. |
| [stock-medical-note-1440-light.png](visual/stock-medical-note-1440-light.png) | 1440×900 | 1440×900 | Claro | Stock / Nota médica | DEFECTO/MENOR | Stub C1 completo y tema correcto; sello fijo de demo se superpone al borde superior del inspector/Entradas. |
| [grid-1920-dark.png](visual/grid-1920-dark.png) | 1920×1080 | 1920×1080 | Oscuro | Rejilla | OK | Doce casillas completas y en orden, tres columnas; márgenes amplios, sin solapes de contenido. |
| [history-1920-dark.png](visual/history-1920-dark.png) | 1920×1080 | 1920×1080 | Oscuro | Historia | OK | Tres grupos completos y legibles; pestaña Diagnósticos seleccionada visible, sin superposiciones de contenido. |
| [notas-1920-dark.png](visual/notas-1920-dark.png) | 1920×1080 | 1920×1080 | Oscuro | Nota médica | OK | Stub C1 completo; título, cierre enfocado y contenido legibles. Modal centrado sin solapes ni cortes. |
| [ordenes-1920-dark.png](visual/ordenes-1920-dark.png) | 1920×1080 | 1920×1080 | Oscuro | Orden de análisis | OK | Formulario y cuatro órdenes completos; selector enfocado, acción deshabilitada por campos vacíos; sin solapes. |
| [reconsulta-1920-dark.png](visual/reconsulta-1920-dark.png) | 1920×1080 | 1920×1080 | Oscuro | Reconsulta | OK | Fecha enfocada, motivo y acción completos; textos envueltos legibles y modal dentro del viewport, sin skeleton. |
| [stock-medical-note-1920-dark.png](visual/stock-medical-note-1920-dark.png) | 1920×1080 | 1920×1080 | Oscuro | Stock / Nota médica | DEFECTO/MENOR | Stub C1 completo y tema correcto; sello fijo de demo cubre etiqueta de una entrada en inspector inferior. |
| [grid-1920-light.png](visual/grid-1920-light.png) | 1920×1080 | 1920×1080 | Claro | Rejilla | OK | Doce casillas completas y en orden, tres columnas; márgenes amplios, sin solapes de contenido. |
| [history-1920-light.png](visual/history-1920-light.png) | 1920×1080 | 1920×1080 | Claro | Historia | OK | Tres grupos completos y legibles; pestaña Diagnósticos seleccionada visible, sin superposiciones de contenido. |
| [notas-1920-light.png](visual/notas-1920-light.png) | 1920×1080 | 1920×1080 | Claro | Nota médica | OK | Stub C1 completo; título, cierre enfocado y contenido legibles. Modal centrado sin solapes ni cortes. |
| [ordenes-1920-light.png](visual/ordenes-1920-light.png) | 1920×1080 | 1920×1080 | Claro | Orden de análisis | OK | Formulario y cuatro órdenes completos; selector enfocado, acción deshabilitada por campos vacíos; sin solapes. |
| [reconsulta-1920-light.png](visual/reconsulta-1920-light.png) | 1920×1080 | 1920×1080 | Claro | Reconsulta | OK | Fecha enfocada, motivo y acción completos; textos envueltos legibles y modal dentro del viewport, sin skeleton. |
| [stock-medical-note-1920-light.png](visual/stock-medical-note-1920-light.png) | 1920×1080 | 1920×1080 | Claro | Stock / Nota médica | DEFECTO/MENOR | Stub C1 completo y tema correcto; sello fijo de demo cubre etiqueta de una entrada en inspector inferior. |

## Evidencia de integridad

Los siguientes hashes corresponden a los archivos abiertos y coinciden con los archivos presentes al escribir esta pasada:

```text
94f7353a531bb4e037340164b2a85b575d08558c0241c6396d0fabaf5efae3ec  visual/grid-1024-dark.png
430202cb7d93212c70f948c45b6f1bde1d57dbdc601f221f7ba55ad3190f446f  visual/grid-1024-light.png
81f5203cdc21c8f2e4f83ed43101e9d5eb59e484ee12d9df89ae1ce5326d27a5  visual/grid-1440-dark.png
0f3cca3c5f5168a2cf4b19445b75f5a6351b6a16609e90941e4bb6ac8d009b45  visual/grid-1440-light.png
3464c3a1238831c24361bef13c4c9ec8b73e35500ed5875279816819fcd67990  visual/grid-1920-dark.png
9664717f7cbe9f7de2f5b555f03ee511a23b1f49a2683e2824719a511760fc8c  visual/grid-1920-light.png
10ab6b1f9cc0821346b1ab318233ef731eceea5c2fb051651726038c91046623  visual/grid-390-dark.png
64a9760cf1d69d37b2858629c61861ffad1a42cba1ea4886ef06e444fbe02371  visual/grid-390-light.png
c77d223f0daa53f1b68f46184419a5a9dfb34a22608cdde5723f6dd1c9e6c128  visual/grid-768-dark.png
9966cf55b731c03ce2ce8199cd684b511790b1f05a0ede9942a1c0b7abf434f7  visual/grid-768-light.png
be25eb79605e08b2c34ca612f20d39346420e24d6dfdf3317f0769aa8e5210f1  visual/history-1024-dark.png
236c33f3d727375d2a2cd340f46737e45d5496ab0bbe04ead6d85cb7e5875c68  visual/history-1024-light.png
d33cfc36ba89499739dc22993c759fdd61bde84ed764957df16db99e9350c7ce  visual/history-1440-dark.png
82c19815615c1da71ee8968362195084353359ec633edcd88e4ebbc569e44cd5  visual/history-1440-light.png
905ae1e8e78df2126f8d84cb4e50a4458e371f13f8a7637028a285270176411e  visual/history-1920-dark.png
d8a1bb0174dcf461f7e8afefa093148195265fcb41bdc4edf21de3b895d40ae3  visual/history-1920-light.png
ad57db460f695fc8f454c993a9a6507dcb4688e0ee2984f0118cf73698836f67  visual/history-390-dark.png
074a7d4b0fa482394eb3bcc58edf7383998d7720895653cfaf77fbc60c0bb559  visual/history-390-light.png
51e115230d0ddd1fe21d1264086adef605e5c7bb289a5f258a2f9709f651c9d7  visual/history-768-dark.png
674163c6d6584f115a2e3250bd87a4746aac8e6cc3633913e6d1299b59a02e9f  visual/history-768-light.png
c5a4e859534de642df35b0e522d5c9dc9dcdc82e6d2387d2e8c24d03ea3eeee8  visual/notas-1024-dark.png
4e541228f6929fec15407fa11366c5c631cd35a59f26e21d980a3f906a3f448a  visual/notas-1024-light.png
af2525ba39fec5db71ec6a3868cbbcc115d3de846f085a80fa9a38a3c4f6084e  visual/notas-1440-dark.png
f842529cc754bc3d86d09044f857a189c1d8d2e9120e636757a085d94a124d7e  visual/notas-1440-light.png
4216af681e5fd45aa8ec73853d6a227bddf02c87bd53af81a4e21a5dd4bde3ce  visual/notas-1920-dark.png
098f7cc5803a4efa4b48a32ef52217d380c9279bee6778c4fe006ca6caad67fa  visual/notas-1920-light.png
82708c9fa48f97091952aad03a7d5619d2b87073188fcbceab45b99431e9b346  visual/notas-390-dark.png
2fe3a344182d2e1e87f4d094342eec257ec5f61466c3e49abb907dc662cf30c6  visual/notas-390-light.png
4d64bba56414d105a160fcd4627148c506a30f1c163bf6374a730ef1d560cf8e  visual/notas-768-dark.png
fd40b2082bca5416eb636ca3c080979661152fa974f612a77f45c71adfd1a1c5  visual/notas-768-light.png
072c701bec000afb099a0fff879e38bc1aba7ff408d568af786a5fcd2e606e01  visual/ordenes-1024-dark.png
981e85b6c5e535f2187ada2ed2ee58f238262e5ab9c79b6586b9e559e38eef28  visual/ordenes-1024-light.png
1c7187c5ba9798c52bf883e1a8581a8aa503e05ac65d7ba4e692a66e33cbc112  visual/ordenes-1440-dark.png
044635f0cff1c296dd212834dc7a31e926a31effaf6f33c718f50d630d2ac797  visual/ordenes-1440-light.png
68c9863c4ce0ce75488d96f4311be3be0a5ea01ee00846514c090b539bc958f4  visual/ordenes-1920-dark.png
40614d4935a3943de53ed87231f8ed048bf447f7441113a5e2b4e955c7e5468a  visual/ordenes-1920-light.png
8f86d23b109873ba0c01c7d64ddc62d0ebc112b38836bc623accb53df0855cb7  visual/ordenes-390-dark.png
6ca4f5d90778f69e1e33fc5581d11a20524992c9a1455bbcada7ad1ec8f05de4  visual/ordenes-390-light.png
4c7bbbbf15a7094aff462e530477962ca222469c7b501fd9b29513ccc49382a4  visual/ordenes-768-dark.png
004d49f8a0d93230f3155a7200106f4ab0b42a3460e6aeb7e889a0ca5d2554e7  visual/ordenes-768-light.png
6049013aaa86dfe2d25e99859584d6f0281af2be39526ca2e34368fd74452bd6  visual/reconsulta-1024-dark.png
f6493a3a4bc5b18f511e6350b946c4dc8f1efde4583b7bb6e75ed17134b83d2b  visual/reconsulta-1024-light.png
cfb2236c66d0197baf833c536ff360f86bdabfe200169f2bc2ffd6abec568d58  visual/reconsulta-1440-dark.png
ffb58653a10257c52c25498722ebed6c4e7faca3e4e8799aebbfb15d51165abf  visual/reconsulta-1440-light.png
ed15bf113836556790bf6856784395aea972145be76a665f776bc53a7eac0048  visual/reconsulta-1920-dark.png
bef1d9da7b2558a65e5d695e08e85fea78fe12d0ba2567c9c7be2d7fd44a6be1  visual/reconsulta-1920-light.png
e3eaa38dc7f5ea82d11f69eb2dabe960e03f88cfa5b109264632e675c18b0998  visual/reconsulta-390-dark.png
41675aaca1ae480740f5a3ce1408972ee471cbb25e1330a23f3acffad23e7b1f  visual/reconsulta-390-light.png
cd70a5da68c186ad46df456f92d405bcc7823d76fe1ea48ea74973dbec6936d6  visual/reconsulta-768-dark.png
81dd7508df0dcf8bba364aa5c03a4e7a4d3a8797b4783fc1cb3d974a3ab36289  visual/reconsulta-768-light.png
0af1a27dfeb0386ed0aa68083ed36c01a3bf36c2ffcdbb26c08647c30ec9b279  visual/stock-medical-note-1024-dark.png
b4199a4fcafe9d48b040d8408670bacd78f42599e308bdaa2065fbe1a9d9dcfc  visual/stock-medical-note-1024-light.png
4c6a6c060d5f8c0a1c5dc23c7155f7acc46f2dcdfe9edb26dd84360eef61992b  visual/stock-medical-note-1440-dark.png
5caf2c1df5fd5cab5fe3a36584a7653a7b4cf35ca766948e5d79c6dd00fe8604  visual/stock-medical-note-1440-light.png
90d73467df9d49b91118ef590247a4c9aacf25631415e97d23b4cb84f588806c  visual/stock-medical-note-1920-dark.png
490e7c8dc8fc70203bf7c22e0c936375d4bcf6688152f3a812f9770ecb1cd9d3  visual/stock-medical-note-1920-light.png
15306a73cabff9fb7c6d8c22c3cc3c96925a4239b9b5e402047abd3872fdd1ef  visual/stock-medical-note-390-dark.png
9991bf263c33c54fd1ddad20078b2857079fb8adc30f98d4fa35ee08338eca13  visual/stock-medical-note-390-light.png
35d1a6d976be480945cfef045d451ed2444de4fbbb423274209970911d6071a5  visual/stock-medical-note-768-dark.png
e10531216091762c3d3e0c584d83b037e6a872b8c1128bf24924211ee86fce98  visual/stock-medical-note-768-light.png
```

## Límites de la revisión

- Se conserva el estado real de las pruebas funcionales: estas imágenes no convierten en verdes los fallos E2E de consola/CSP ni las aserciones de overflow.
- No se midieron ratios de contraste ni se hicieron pruebas de lector de pantalla mediante esta pasada.
- No se prueba creación, persistencia, firma, reconsulta reservada ni comportamiento del backend real con una captura estática.
- P2 debe realizarla otro revisor sobre estas versiones. Los defectos abiertos se mantienen explícitos; no se declaró cierre visual global.