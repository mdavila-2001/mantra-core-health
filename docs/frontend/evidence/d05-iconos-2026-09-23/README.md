# «Editar» y el calendario con ícono y nombre; las excepciones, justificadas — 2026-09-23

Pedido del cliente del 22/09 (**D-05**): «cada botón de acción tiene ícono + nombre». La única
excepción es la del ADR-0012 §3: significado universal en su contexto (cerrar un diálogo, quitar
un elemento, pasar de página), con `aria-label` **y** globo visible, justificada en una línea al
lado del botón.

- **«Editar» de «Mi perfil»** pasa de lápiz solo a lápiz + «Editar».
- **El calendario** pasa sus siete botones a ícono + nombre: «Cerrar», «Año», «Mes», «Mes», «Año»
  y, en la grilla de años, «30 años» a cada lado. La excepción no le sirve: su globo quedaría
  debajo del diálogo modal (ver el hallazgo, más abajo). Las cuatro flechas del mes siguen en un
  renglón en todas las celdas medidas, la más angosta de 360 px.
- **Los botones que quitan la ubicación de un mapa** pasan a ícono + «Quitar la ubicación»: los
  del mapa compartido (`ubicacion-picker`, que usan el editor del paciente, el del médico y las
  altas del médico, de aseguradora, de laboratorio y de imagenología) y los de la copia del mapa
  que tiene el alta del paciente. Se habían tomado como excepción («quitar un elemento»), pero no
  hay lista de la que quitar y el aro con un menos queda junto al «−» del zoom del plano: se lee
  como «alejar». El texto visible es el comienzo del nombre accesible, que sigue completo («Quitar
  la ubicación de tu casa»). Con el mapa abierto y todavía sin punto no hay ubicación que quitar:
  ahí el mismo botón sólo cierra el mapa, y pasa a cruz + «Cerrar el mapa».
- **Las excepciones** (quitar un elemento de una lista, pasar de página, volver) quedan como
  estaban y ganan su línea de justificación en la plantilla. Son comentarios: no llegan a la
  página.

Guion: `playwright/d05-iconos.mjs`, en dos pasadas. `antes` corre sobre `mockup` sin este cambio
(`b11dfdd3`) y guarda la referencia; `despues` corre sobre este cambio y compara.
**«antes» 3/3 en verde · «después» 216/216 en verde.** Consola sin errores y red sin respuestas
4xx/5xx en las dos.

Datos: la cuenta sintética de la maqueta `paciente@alovida.mock`; las altas y la vitrina se
recorren sin sesión.

Viewports: los cinco que pide la evidencia visual del repo —1440×900, 1920×1080, 1024×768,
768×1024 y 390×844—, en tema claro, más el oscuro en 1440 y en 390. Se suma **360×800**, porque es
el ancho donde las flechas del mes ya no entran en un renglón (ver el defecto corregido). Cada
celda se carga de cero, con su propia sesión, en su tamaño y su tema. Las capturas son de la
ventana, no de la página entera, y se toman después de esperar las fuentes y las animaciones.

## Qué comprueba

**Formulario por páginas** (lo usan 52 pantallas; este cambio sólo le agrega dos comentarios). En
seis pantallas —las altas de profesional, organización, laboratorio y centro de imagen, la vitrina
y el alta del paciente— la botonera del «después» es **idéntica** a la del «antes», y ningún
comentario de la justificación llega a la página. Se compara el HTML de la botonera ya hidratada,
sin los atributos de encapsulado de estilos. Las dos lecturas quedan en
`dom-formulario-por-paginas-antes.json` y `dom-formulario-por-paginas-despues.json`.

**«Editar»**, en las ocho celdas: dice «Editar», conserva el lápiz, ya no es botón de sólo ícono,
entra entero en la pantalla y la página no desborda más que antes
(`desborde-mi-perfil-antes.json`: 0 px en todas las celdas salvo 360, que da 4 px; después, lo
mismo). En 1440 claro, además, sigue abriendo el formulario en la misma pantalla.

**El calendario** (fecha de nacimiento, en el editor del paciente), en las ocho celdas: «Cerrar»
dice su nombre y conserva la cruz; las flechas dicen «Año», «Mes», «Mes», «Año» y conservan sus
nombres completos («Año anterior», «Mes anterior», «Mes siguiente», «Año siguiente»); ningún botón
queda de sólo ícono; el panel no desborda; las flechas de «anterior» quedan en la mitad izquierda
y las de «siguiente» en la derecha, **las cuatro en un renglón**. En la grilla de años, lo mismo
con «30 años».

**El calendario en otro consumidor y en su otro modo**: la vitrina (`/design-system`, sin sesión)
monta uno en modo fecha y hora. En 1440, 390 y 360, claro: «Cerrar» con nombre, las cuatro
flechas con nombre y en un renglón, ningún botón de sólo ícono y el panel sin desborde, con la
fila de la hora debajo de la grilla.

**El botón del mapa**, en 1440 y 390, claro, en cada estado: con punto dice «Quitar la
ubicación» y sin punto «Cerrar el mapa»; lleva su ícono, ya no es de sólo ícono y su nombre
accesible empieza por el texto visible.
- El mapa compartido, en el editor del paciente: el domicilio con el punto ya guardado y después
  de correr el pin (sin confirmar, el estado de tres botones); el trabajo, que no tiene punto,
  abierto y vacío.
- La copia del alta del paciente («¿Dónde vivís?»): sin punto, sin confirmar y confirmado. Se
  entra directo a esa página del formulario; las anteriores no cambian nada ahí.

## Capturas y lo que se miró en cada una

Referencia (`antes-*`, 29): «Editar» en las ocho celdas; el calendario, días y años, en 1440, 390
y 360 claro; la vitrina en modo fecha y hora en 1440, 390 y 360; los seis estados del mapa en
1440 y 390 claro. Muestran el lápiz solo y redondo a la derecha de «Tus datos», las flechas de
sólo ícono a los lados del mes y el aro con un menos al lado de los botones del mapa.

| Captura | Viewport · tema | Qué se miró | Resultado |
|---|---|---|---|
| `despues-editar-1440-claro.png` | 1440 · claro | Lápiz + «Editar» con borde, a la derecha de «Tus datos», alineado con el título | OK |
| `despues-editar-1440-oscuro.png` | 1440 · oscuro | Botón legible sobre la tarjeta oscura; borde visible | OK |
| `despues-editar-1920-claro.png` | 1920 · claro | Igual que en 1440, con la columna de contenido centrada | OK |
| `despues-editar-1024-claro.png` | 1024 · claro | En el renglón del nombre; las cinco pestañas entran | OK |
| `despues-editar-768-claro.png` | 768 · claro | En el renglón del nombre; las cinco pestañas entran | OK |
| `despues-editar-390-claro.png` | 390 · claro | Todavía entra al lado del nombre, sin desborde | OK |
| `despues-editar-390-oscuro.png` | 390 · oscuro | Igual que en claro, legible | OK |
| `despues-editar-360-claro.png` | 360 · claro | Ya no entra al lado del nombre: baja debajo, alineado a la izquierda | OK |
| `despues-calendario-dias-1440-claro.png` | 1440 · claro | «Cerrar» con su cruz; el mes arriba y centrado; «‹‹ Año ‹ Mes» a la izquierda y «Mes › Año ››» a la derecha | OK |
| `despues-calendario-dias-1440-oscuro.png` | 1440 · oscuro | Todo legible sobre el panel oscuro | OK |
| `despues-calendario-dias-1920-claro.png` | 1920 · claro | Como en 1440 | OK |
| `despues-calendario-dias-1024-claro.png` | 1024 · claro | Como en 1440 | OK |
| `despues-calendario-dias-768-claro.png` | 768 · claro | Como en 1440 | OK |
| `despues-calendario-dias-390-claro.png` | 390 · claro | Las cuatro flechas en un renglón, «anterior» a la izquierda y «siguiente» a la derecha | OK |
| `despues-calendario-dias-390-oscuro.png` | 390 · oscuro | Igual que en claro, legible | OK |
| `despues-calendario-dias-360-claro.png` | 360 · claro | Las cuatro flechas siguen en un renglón (ver el defecto corregido); sin desborde | OK |
| `despues-calendario-anios-1440-claro.png` | 1440 · claro | «‹‹ 30 años» a la izquierda y «30 años ››» a la derecha; 1990 marcado | OK |
| `despues-calendario-anios-1440-oscuro.png` | 1440 · oscuro | Legible; 1990 marcado en aqua | OK |
| `despues-calendario-anios-1920-claro.png` | 1920 · claro | Como en 1440 | OK |
| `despues-calendario-anios-1024-claro.png` | 1024 · claro | Como en 1440 | OK |
| `despues-calendario-anios-768-claro.png` | 768 · claro | Como en 1440 | OK |
| `despues-calendario-anios-390-claro.png` | 390 · claro | Las dos flechas en un renglón, una a cada lado; la grilla de cinco columnas entra | OK |
| `despues-calendario-anios-390-oscuro.png` | 390 · oscuro | Igual que en claro, legible | OK |
| `despues-calendario-anios-360-claro.png` | 360 · claro | Las dos flechas siguen entrando en un renglón; la grilla entra | OK |
| `despues-vitrina-fecha-y-hora-1440-claro.png` | 1440 · claro | Otro consumidor, en modo fecha y hora: «Seleccionar fecha y hora», «Cerrar» con su cruz, las cuatro flechas con nombre en un renglón y la fila «Hora» debajo de la grilla | OK |
| `despues-vitrina-fecha-y-hora-390-claro.png` | 390 · claro | Lo mismo en el teléfono; la fila de la hora entra sin desborde | OK |
| `despues-vitrina-fecha-y-hora-360-claro.png` | 360 · claro | Las cuatro flechas en un renglón; el título «Seleccionar fecha y hora» se parte en dos renglones al lado de «Cerrar» (en el «antes», con la cruz sola, entraba en uno; ver observación 5) | OK |
| `despues-mapa-quitar-1440-claro.png` | 1440 · claro | Editor, punto guardado: «Volver a ubicarme» y, al lado, el aro con un menos + «Quitar la ubicación»; el «−» del zoom queda arriba, dentro del plano | OK |
| `despues-mapa-quitar-390-claro.png` | 390 · claro | Los dos botones en un renglón y legibles | OK |
| `despues-mapa-sin-confirmar-1440-claro.png` | 1440 · claro | Editor, pin corrido sin confirmar: «Confirmar dirección actual», «Volver a ubicarme» y «Quitar la ubicación» en un renglón | OK |
| `despues-mapa-sin-confirmar-390-claro.png` | 390 · claro | «Confirmar dirección actual» en su renglón y los otros dos debajo, sin desborde | OK |
| `despues-mapa-sin-punto-1440-claro.png` | 1440 · claro | Editor, trabajo sin punto: «Usar mi ubicación» y, al lado, cruz + «Cerrar el mapa» | OK |
| `despues-mapa-sin-punto-390-claro.png` | 390 · claro | Lo mismo, en un renglón | OK |
| `despues-alta-mapa-sin-punto-1440-claro.png` | 1440 · claro | Alta, mapa abierto sin punto: «Usar mi ubicación» y cruz + «Cerrar el mapa» | OK |
| `despues-alta-mapa-sin-punto-390-claro.png` | 390 · claro | Lo mismo, en un renglón | OK |
| `despues-alta-mapa-sin-confirmar-1440-claro.png` | 1440 · claro | Alta, pin sin confirmar: los tres botones en un renglón | OK |
| `despues-alta-mapa-sin-confirmar-390-claro.png` | 390 · claro | «Confirmar dirección actual» arriba y los otros dos debajo, sin desborde | OK |
| `despues-alta-mapa-confirmada-1440-claro.png` | 1440 · claro | Alta, punto confirmado: «Volver a ubicarme» y «Quitar la ubicación» | OK |
| `despues-alta-mapa-confirmada-390-claro.png` | 390 · claro | Lo mismo, en un renglón | OK |

## Defectos encontrados en las pasadas y corregidos

1. **Las flechas de «siguiente» caían a la izquierda.** Con nombre, los dos grupos de flechas del
   mes dejaban de entrar en un renglón por debajo de unos 390 px, y el de «siguiente» bajaba
   **pegado a la izquierda**, de modo que «Mes ›» quedaba justo debajo de «‹ Mes». Ahora ese grupo
   se queda a la derecha si el renglón llega a partirse (`organisms/date-picker/date-picker.css`,
   regla `.nav-controls + .nav-controls`).
2. **Aun a la derecha, el encabezado crecía en escalera.** La segunda revisión de las capturas
   marcó que a 360 el encabezado del panel pasaba de 112 a unos 199 px, con un grupo por renglón.
   Cada flecha con nombre pedía unos 70 px con el relleno lateral de un botón `sm`; dentro de la
   barra del calendario ese relleno baja a `--sp-2` (`.nav-controls > [app-button]`) y las cuatro
   entran en un renglón en todas las celdas medidas, la más angosta de 360 px. El guion lo comprueba
   en las ocho celdas y en la vitrina.
3. **El aro con un menos del mapa se leía como «alejar».** Lo marcó la misma revisión: pasa a
   ícono + «Quitar la ubicación» en los tres estados del mapa compartido (`ubicacion-picker.html`)
   y, al repetir la revisión, también en los seis botones de la copia del mapa que tiene el alta
   del paciente (`register-patient.html`). El texto visible, primero «Quitar», pasó a «Quitar la
   ubicación»: con dos mapas en Contacto, «Quitar» a secas se podía leer como «quitar la
   dirección».
4. **Sin punto, «Quitar la ubicación» cerraba el mapa.** Lo marcó la revisión repetida: con el mapa
   abierto y vacío, el mismo botón (`quitarUbicacion()`) no quita nada, cierra el mapa. Antes
   del cambio ese nombre sólo lo oía el lector de pantalla; con el texto a la vista se notaba. En
   ese estado pasa a cruz + «Cerrar el mapa», en el mapa compartido y en las dos copias del alta.

El orden del teclado no cambia en ninguno. Las capturas son las de después de las correcciones.

## Hallazgo, confirmado en el navegador

**El globo de ayuda no se puede ver dentro de un diálogo modal.** `atoms/tooltip/tooltip.ts:131`
cuelga el globo del `<body>`. Un `<dialog>` abierto con `showModal()` (el calendario:
`organisms/date-picker/date-picker.ts:521`) se pinta en la capa superior, por encima de cualquier
`z-index`. El guion lo prueba: agrega al `<body>` un elemento con `z-index: 2147483647` sobre el
panel del calendario y pregunta qué hay en ese punto. Responde el calendario. Por eso ningún botón
de sólo ícono dentro de un modal nativo puede cumplir la condición «globo visible» del ADR-0012
§3. Es para quien lleve el átomo.

## Observaciones, no defectos de este cambio

1. **«Mi perfil» desborda 4 px a lo ancho en 360**, antes y después de este cambio: el avatar del
   encabezado sale cortado contra el borde derecho (`antes-editar-360-claro.png`,
   `despues-editar-360-claro.png`). En 390 y más no desborda.
2. **Las altas de laboratorio, de centro de imagen y del médico** también encienden las flechas de
   sólo ícono del formulario por páginas (`register-laboratory.html:67`,
   `register-imaging-center.html:68`, `register-practitioner.html:57`). Les corresponde el mismo
   veredicto que al alta del paciente (pasar de página: excepción), pero no están en este cambio y
   no tienen la línea de justificación. La del médico va con la parte de D-05 del médico.
3. **`playwright/mi-perfil-paciente.mjs:93-94` y `:99`** afirman que «Editar» es un lápiz sin
   texto. Con este cambio esas comprobaciones quedan viejas; no se tocan desde acá.
4. Se ven y no son de este cambio: la etiqueta «Demo» pisa el borde del encabezado en 390 y 768;
   las píldoras «Datos de prueba» y «Ver componentes» quedan sobre el contenido en 1024; la miga
   «Panel» se lee apagada en tema oscuro.

## Lo que este cambio sí mueve y se deja así

A 360, en el modo fecha y hora, el título «Seleccionar fecha y hora» se parte en dos renglones al
lado de «Cerrar» (`despues-vitrina-fecha-y-hora-360-claro.png`). En el «antes», con la cruz sola,
entraba en uno; a 390 entra en uno también ahora. A cambio, en el «antes» a 360 era el mes
(«Septiembre 2026») el que se partía entre las flechas.

## No cubierto

- En el navegador no se recorrió el calendario con el teclado. El orden (el mes antes que las
  flechas) y la trampa de foco los cubre `date-picker.spec.ts`.
- Lector de pantalla real.
- Las pantallas del médico: su parte de D-05 va por separado.
- El calendario se vio en dos de sus 22 consumidores (el editor del paciente y la vitrina, en sus
  dos modos). Los demás montan el mismo organismo sin estilos propios sobre su barra.
- Ninguna captura muestra una de las 14 excepciones con su globo abierto, ni las flechas
  deshabilitadas, con foco o con el puntero encima. El tema oscuro se vio en 1440 y 390; el mapa y
  la vitrina, sólo en claro.
- El mapa compartido se vio en uno de sus consumidores (el editor del paciente); los demás (el
  editor del médico y las altas del médico, de aseguradora, de laboratorio y de imagenología)
  montan el mismo componente.
