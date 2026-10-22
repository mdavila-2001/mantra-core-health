# Doble revisión adversarial — carril «reserva y Cotizaciones» (2026-09-24)

Regla 35.1. La primera pasada (verificación) la hizo quien implementó, captura por captura. Las
pasadas adversariales las hizo **un agente distinto**, de solo lectura, que no implementó nada del
carril, con la postura de rechazar la entrega (35.1.6).

## Ronda 1 — sobre el primer set (16 capturas) · veredicto: **RECHAZADA**

Resumen de lo que encontró, con la respuesta de quien implementó:

| # | Hallazgo | Severidad | Respuesta |
|---|---|---|---|
| 1 | `cotizaciones-cargando-1440-light.png` mostraba los resultados, no la carga, y el REPORTE la daba como evidencia | BLOQUEANTE | **Cierto.** Una regeneración del set la sobrescribió después de haberla mirado. Ahora se toma con el reloj de Playwright en pausa (`page.clock`) y el spec asevera **después** de la foto que la carga sigue visible |
| 2 | Precios sintéticos del simulador atribuidos a sedes con nombre real bajo «Lista/Tarifario PUBLICO de …» | BLOQUEANTE | **Cierto.** Primer intento: «publicado por … · dato de la maqueta» — la ronda 2 lo volvió a rechazar (R2-01), con razón. Ver ronda 2 |
| 3 | «4 UMA — Colegio Médico de Santa Cruz 2025» sin procedencia demostrada | BLOQUEANTE | **No se corrige el dato, se documenta:** la maqueta sirve `fee-schedules.generated.ts`, cuya cabecera declara los aranceles **reales** entregados por el propietario (OCR del PDF del Colegio Médico, 1 686 filas marcadas `ocrSuspect`). Por eso no lleva «dato de la maqueta», y las filas dudosas muestran la advertencia de escaneo |
| 4 | «Ver farmacias» a ≈ 3,4:1 en oscuro | BLOQUEANTE | **Cierto.** `alovida.css` pisa todo `a[app-link]` con `--petroleo`. Se devolvió la acción a `--brand-primary`, como ya hace `login.css`: **8,03:1 claro · 8,77:1 oscuro**, medido en el navegador |
| 5 | «▼» sin rótulo que escondía dónde y distancia en 390/768 | MAYOR | **Cierto.** Dónde va dentro de «Qué y dónde» y todas las columnas tienen prioridad 1: la tabla ya no colapsa |
| 6 | Buscador sin rótulo visible | MAYOR | **Cierto.** `app-form-field label="Qué querés cotizar"` |
| 7 | Código crudo «PUBLICO» y decimales mezclados («30.5 BOB» / «0,8 km») | MAYOR | **Cierto.** Sin código de lista; importes y km con formato `es-BO` |
| 8 | «El centro no publica su ubicación» culpa al centro de una limitación nuestra | MAYOR | **Cierto.** «No disponible: el directorio de centros no trae su ubicación». Y sin origen elegido, las farmacias dicen «Elegí desde dónde medir» |
| 9 | «Precio no publicado» no decía quién no lo publicó; el REPORTE afirmaba que sí | MAYOR | Ahora: «El arancel de referencia no fija precio para esta prestación», y el dónde dice «Arancel de referencia · <especialidad>». El REPORTE se corrigió |
| 10 | Vacío sugería «Todas» con «Todas» ya elegido | MENOR | **Cierto.** La sugerencia depende de la vertical |
| 11 | Procedencia partida en 5 renglones en 390 px | MENOR | La procedencia pasó a la celda ancha; la columna Precio muestra sólo el importe |
| 12 | Matriz incompleta: sin error, sin ubicación, fuente caída, estados en oscuro, ficha a 768, carga por sede | MAYOR | **Completada**: error y fuente caída provocados con `sessionStorage['mock:fallos']` (`core/mock/fallos-simulados.ts`); sin ubicación haciendo fallar `/profiles/patients/me`; sin término y vacío en oscuro; ficha en 390/768/1440 × claro/oscuro; carga por sede con el reloj en pausa |
| — | Paginación duplicada y «1–10 de N»; toast «Se liberó un horario»; píldoras de la maqueta; «Semana anterior/siguiente» sin ícono; credenciales «Verificado» de instituciones reales en la ficha sintética | — | **Fuera del carril**, preexistentes (organismos compartidos o pantallas de otros dueños). Registrados; no se tocan |

## Ronda 2 — sobre el set re-capturado (24 capturas) · veredicto: **RECHAZADA**

Otro agente revisor, también de solo lectura. De los 9 hallazgos de la ronda 1 dio 5 por resueltos
(carga real, «▼», rótulo del buscador, mensajes de distancia y contraste a la vista), 2 por
parciales y 2 por no resueltos. Encontró además 7 MAYOR nuevos.

| ID | Hallazgo | Severidad | Respuesta |
|---|---|---|---|
| R2-01 | «Precio/Tarifario publicado por <sede> · dato de la maqueta» sigue afirmando que la sede lo publicó | BLOQUEANTE | **Cierto.** En la maqueta ahora dice «Precio/Tarifario de ejemplo de la maqueta: <sede> no lo publicó» (`procedenciaDeSede()`); con el backend real, «publicado por <sede>» |
| R2-02 | Subtítulo «no lo inventamos» sobre precios de ejemplo | MAYOR | **Cierto.** Con el backend simulado dice: «En esta maqueta, los precios de farmacias y de estudios son de ejemplo; el arancel de referencia es el real» |
| R2-03 | Scroll interno de la tabla con «1–10 de 62» | MAYOR | Fuera del carril: alto máximo con scroll vertical y paginación en cliente es el patrón de **ADR-0015** (`app-data-table`, `app-pagination`, de Pablo) que el carril pide aplicar (H3.S2.M3) |
| R2-04 | Tabla comprimida en 390 | MAYOR | Parcial: la columna Precio ya muestra sólo el importe. El colapso a tarjetas es del organismo compartido |
| R2-05 | Vacío S2 con título S1 (ADR-0005) | MAYOR | **Cierto.** Vacío propio: «No encontramos cotizaciones», con el término y «Limpiar la búsqueda» (ícono + texto) |
| R2-06 | «Sin ubicación» remitía a un selector inexistente | MAYOR | **Cierto.** «Elegilo arriba de la tabla, o seguí ordenando por precio» |
| R2-07 | Error con el mensaje de la fuente («Simulado: fallo del servidor.») | MAYOR | Fuera del carril: lo arma `app-view-state-host` compartido con `errorToViewState`; el texto es el que devuelve el doble de fallos del mockup |
| R2-08 | Fuente caída sin acción | MAYOR | **Cierto.** «Volver a consultar» (ícono + texto) |
| R2-09 | Teclado sin reserva de cupo ni foco visible | MAYOR | **Cierto.** El recorrido ahora activa la acción con Enter y reserva un cupo con Tab + Enter; dos capturas del foco visible (con Tab real: `.focus()` no dispara `:focus-visible`) |
| R2-10 | «30,5 BOB» junto a «35 BOB» | MENOR | **Cierto.** Dinero con dos decimales fijos; la UMA, como la publica el Colegio |
| R2-11 | Tarjetas de sede pegadas | MENOR | **Cierto.** Separación entre sedes |
| R2-12 | Botones del error pegados | MENOR | Fuera del carril (componente compartido) |
| R2-13 | Pares claro/oscuro con estados distintos | MENOR | **Cierto.** Cada grupo de estados corre entero en los dos temas, en las mismas condiciones |
| R2-14 | «medica» sin tilde | MENOR | Dato de la fuente (tabla OCR del Colegio); no se corrige en la pantalla |
| R2-15 | «Buscando cotizaciones…» chico | MENOR | **Cierto.** Texto de cuerpo |
| R2-16 | «Ver farmacias» ambiguo | MENOR | **Cierto.** «Directorio de farmacias» |
| R2-17 | Matriz incompleta | MENOR | **Completada**: todos los estados de Cotizaciones en claro y oscuro; error y sin ubicación también en 390; ficha en 390/768/1440 × 2 temas, con carga y con error por sede |

## Ronda 3 — sobre el set re-capturado (39 capturas) · veredicto: **RECHAZADA**

Tercer revisor, de solo lectura. Dio por **resueltos los dos BLOQUEANTE de procedencia** (R2-01,
R2-02), el vacío S2, sin ubicación, fuente caída, teclado, moneda, separación de sedes y pares
claro/oscuro. Validó como honestas las exclusiones de R2-07, R2-12 y R2-14, y **corrigió una**:
el alto máximo de la tabla (R2-03) lo enciende el carril (`maxHeight="560px"`, opt-in en
ADR-0015), no se hereda. Quedó un MAYOR del carril.

| ID | Hallazgo | Severidad | Respuesta |
|---|---|---|---|
| R3-01 | En 390 los resultados seguían siendo una tabla de escritorio (~290 px por fila) | MAYOR | **Cierto.** Por debajo de 780 px los resultados son **tarjetas**; la tabla queda para 780 px en adelante y para carga/error |
| R3-02 | Importe partido de su moneda | MENOR | **Cierto.** Espacio duro |
| R3-03 | Scroll interno de 560 px | MENOR | Se acepta la corrección: es **decisión del carril**, por la disciplina de tabla que pide H3.S2.M3 (scroll vertical + paginación en cliente, ADR-0015). Se mantiene y se declara así |
| R3-04 | «Elegilo arriba de la tabla» sin tabla | MENOR | **Cierto.** «Elegí desde dónde medir, arriba, o seguí ordenando por precio» |
| R3-05 | «Usar mi ubicación actual» sin ícono y con más peso que «Reintentar» | MENOR | Del selector compartido `app-search-origin-picker` (Lugares cercanos); fuera del carril, anotado |
| R3-06 | Textos de estado de la ficha chicos | MENOR | **Cierto.** Texto de cuerpo |
| R3-07 | Contraste del anillo de foco sin medir | MENOR | **Medido en el navegador**: `--focus-ring: rgba(79, 179, 169, 0.45)` compuesto sobre blanco da **1,48:1** (< 3:1, WCAG 1.4.11). Es el token global de `src/styles.css:217`: afecta a toda la app. Hallazgo para el dueño del sistema de diseño; queda en «No cubierto» del REPORTE |
| R3-08 | Doble con precios poco plausibles; orden no determinista | MENOR | Orden: **cierto**, desempate estable (precio → distancia → nombre → id), con test. Los datos del doble son de `pharmacy.handlers.ts` (fixtures de otros dueños) y ya van rotulados de ejemplo |
| R3-09 | Barra de maqueta tapa filas; hover en capturas | MENOR | Barra fuera del carril; hover: higiene de captura, anotado |
| R3-10 | Skeleton pálido en claro | MENOR | Del host compartido; anotado |
| R3-11 | Celdas faltantes | MENOR | Agregadas: fuente caída 390 × 2 temas, error por sede × 2 temas, sin-ubicación 390 con la acción en cuadro. El resto va a «No cubierto» |

## Ronda 4 — sobre el set re-capturado (42 capturas) · veredicto: **RECHAZADA**

Cuarto revisor, de solo lectura. Confirmó resueltos R3-02, R3-04, R3-06 y el desempate de R3-08;
validó R3-03 como decisión legítima del carril (ADR-0015) y las demás exclusiones como honestas.
Encontró **un solo MAYOR del carril**: la corrección de R3-01 (tarjetas <780px) solo se había
verificado con el caso fácil (farmacias con precio en BOB); faltaba capturar los tres estados que
demuestran los criterios centrales — UMA, precio no publicado y distancia no disponible — en el
componente nuevo. Además marcó que el anillo de foco (medido en la ronda 3: 1,48:1) no figuraba en
`REPORTE.md`, solo en `teclado.md` (regla 40 §7: lo no cubierto sube a la raíz).

| ID | Hallazgo | Severidad | Respuesta |
|---|---|---|---|
| R4-01 | Tarjetas <780px sin capturar con UMA, precio no publicado ni sin distancia | **MAYOR** | **Cierto.** Nuevo test: los tres casos en tarjeta, 390 y 768 × 2 temas (12 capturas) |
| R4-02 | La tarjeta no mostraba la vertical ni «en línea recta» (la tabla sí) | MENOR | **Cierto.** Agregados a la tarjeta |
| R4-03 | «Ver el centro» se partía en 2 renglones, ícono desalineado | MENOR | **Cierto.** `white-space: nowrap` en la acción |
| R4-04 | Encuadre: primera fila bajo la barra, distintivo «Demo» tapando la distancia, subtítulo cortado | MENOR | **Cierto.** `encuadrar()` reemplaza los `scrollIntoViewIfNeeded()` sueltos: lleva el bloque justo debajo de la barra fija en cada captura |
| R4-05 | «Farmacorp · Grigotá · Grigotá» | MENOR | **Cierto.** `donde` no repite el sufijo si `pharmacyName` ya lo incluye |
| R4-06 | El REPORTE no declaraba el 1,48:1 del foco | MENOR (de proceso) | Se agrega en el REPORTE final, con el dueño (sistema de diseño, token global) y sin afirmar AA cumplido en foco |
| — | Fila resaltada por hover en varias capturas | MENOR | **Cierto.** `foto()` mueve el mouse a `(0, 0)` antes de cada captura |
| — | Foco del cupo sin medir en oscuro | MENOR | **Cierto.** `teclado-foco-cupo-1440-dark.png` + medición |

## Ronda 5 — sobre el set final (55 capturas) · veredicto: **RECHAZADA**

Quinto revisor, de solo lectura. Confirmó R4-01 a R4-06 genuinamente resueltos, cruzando cada uno
contra el código (no sólo contra la captura). Encontró **un solo defecto nuevo, MAYOR**:

| ID | Hallazgo | Severidad | Respuesta |
|---|---|---|---|
| R5-01 | `cotizaciones-sin-ubicacion-390-{light,dark}`: un renglón del subtítulo de la página quedaba cortado a la mitad, justo bajo la barra fija — la reaparición puntual del síntoma que R4-04 había cerrado, en una pantalla que la ronda 4 no había capturado con ese ancho | MAYOR | **Cierto.** Causa: `encuadrar()` calculaba la posición con `window.scrollTo`/`scrollBy` a mano, y el contenedor que de verdad scrollea no siempre es `window`. Reescrito con `elemento.scrollIntoViewIfNeeded()` (Playwright encuentra el contenedor real) + `page.mouse.wheel()` para retroceder el alto de la barra — el mismo mecanismo con el que un usuario scrollea, sin adivinar el contenedor |

También señaló, sin bloquear, que `REPORTE.md` afirmaba «doble revisión… 5 rondas» *antes* de que
la ronda 5 terminara: corregido (ver arriba, ahora dice 6 rondas y explica por qué). Y que la
descripción de R4-04 decía «reemplaza los `scrollIntoViewIfNeeded()` sueltos» en plural absoluto
cuando quedaban 5 usos directos fuera de `encuadrar()`: eso es correcto — esos 5 son casos donde
`scrollIntoViewIfNeeded()` sin más ya alcanzaba (sin barra fija tapando el objetivo), y `encuadrar()`
sólo hacía falta donde SÍ tapaba.

## Ronda 6 — sobre el defecto de R5-01, re-capturado · veredicto: **APROBADA**

Sexto revisor, de solo lectura, acotado a verificar el cierre de R5-01 y buscar regresión.

| Captura | Nota | Hallazgos |
|---|---|---|
| `cotizaciones-sin-ubicacion-390-light.png` | APROBADA | Estado vacío completo bajo la barra fija: ícono, título y descripción visibles sin cortes ni solapamiento. R5-01 resuelto |
| `cotizaciones-sin-ubicacion-390-dark.png` | APROBADA | Mismo resultado en oscuro, sin corte de renglón |
| `cotizaciones-sin-ubicacion-1440-light.png` | APROBADA | Sin cambios visibles, sin regresión |
| `cotizaciones-sin-ubicacion-1440-dark.png` | APROBADA | Sin regresión |
| `cotizaciones-paracetamol-390-light.png` | APROBADA | `encuadrar()` no rompió esta vista |
| `cotizaciones-arancel-uma-390-light.png` | APROBADA | Sin cortes ni solapamientos |

**Veredicto global: APROBADA.** R5-01 resuelto; sin regresión en las capturas de control. Cierra
la doble revisión adversarial de este carril: 6 rondas, 5 rechazos con motivo real corregido cada
vez, aprobación final.
