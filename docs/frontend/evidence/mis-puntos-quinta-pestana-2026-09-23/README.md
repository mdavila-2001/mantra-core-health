# «Mis puntos» como quinta pestaña del perfil del paciente — 2026-09-23

Pedido del cliente (N-03): la billetera de puntos deja de ser una pantalla aparte con su propia
cabecera y pasa a ser la quinta pestaña de «Mi perfil», dentro de la misma tarjeta.

Cuenta sintética de la maqueta: `paciente@alovida.mock`. Ruta: `/my-account`. Guion:
`playwright/mis-puntos-quinta-pestana.mjs`: **61/61 comprobaciones en verde**, consola sin errores
y red sin respuestas 4xx/5xx. Además informa dos mediciones que no son criterio de este cambio, y
las dos dan negativo: son los hallazgos 1 y 2, más abajo.

**Capturas rehechas el 24/09.** La primera tanda (la del #606) tenía la captura del editor tomada
a mitad de la animación de la barra lateral, y le faltaban 390, 1024 y 1920. Ésta sale de
`mockup` con el cambio de D-05 aplicado, por eso «Editar» ya lleva nombre. Viewports: 1440×900,
1920×1080, 1024×768, 768×1024 y 390×844 en tema claro, más el oscuro en 1440 y en 390. Cada celda
se carga de cero en su tamaño y su tema. La página entera se fotografía después de agrandar la
ventana a su alto y de esperar a que no quede ninguna animación con fin en curso, así que la
barra lateral sale entera y en su ancho en todas. La línea decorativa del fondo de la barra es una
animación continua: aparece en otra posición en cada captura, y eso es lo esperado. Antes de cada foto el puntero se lleva al borde, para que
ninguna pestaña salga con su fondo de «puntero encima».

## Capturas y lo que se miró en cada una

| Captura | Viewport · tema | Qué se miró | Resultado |
|---|---|---|---|
| `despues-ficha-1440-claro.png` | 1440 · claro | Cinco pestañas en su orden, «Mis puntos» al final; se entra por «Datos personales»; barra lateral entera | OK |
| `despues-ficha-1440-oscuro.png` | 1440 · oscuro | Lo mismo, legible sobre la tarjeta oscura | OK |
| `despues-ficha-1920-claro.png` | 1920 · claro | Lo mismo, con la columna de contenido centrada | OK |
| `despues-ficha-1024-claro.png` | 1024 · claro | Las cinco pestañas entran en la tira | OK |
| `despues-ficha-768-claro.png` | 768 · claro | Las cinco pestañas entran en la tira; sin desborde | OK |
| `despues-ficha-390-claro.png` | 390 · claro | La tira muestra dos pestañas y sus flechas; la página entera, sin desborde | OK |
| `despues-ficha-390-oscuro.png` | 390 · oscuro | Lo mismo, legible | OK |
| `despues-puntos-1440-claro.png` | 1440 · claro | La billetera dentro de la tarjeta, sin cabecera propia; una sola cabecera en la pantalla («Mi perfil»); vacío con explicación y salida («Ver mis pedidos») | OK |
| `despues-puntos-1440-oscuro.png` | 1440 · oscuro | Lo mismo en oscuro; subrayado de la pestaña activa visible | OK |
| `despues-puntos-1920-claro.png` | 1920 · claro | Lo mismo | OK |
| `despues-puntos-1024-claro.png` | 1024 · claro | Lo mismo; la tira entra entera | OK |
| `despues-puntos-768-claro.png` | 768 · claro | Lo mismo; sin desborde | OK |
| `despues-puntos-390-claro.png` | 390 · claro | Al elegirla, la tira se corre y «Mis puntos» queda a la vista, subrayada; la billetera se lee entera | OK |
| `despues-puntos-390-oscuro.png` | 390 · oscuro | Lo mismo, legible | OK |
| `despues-url-directa-1440-claro.png` | 1440 · claro | `/my-account?pestana=puntos` entra con la billetera abierta y «Mis puntos» subrayada | OK |
| `despues-url-directa-390-claro.png` | 390 · claro | Entra con la billetera abierta, pero la pestaña activa queda fuera de la parte visible de la tira (hallazgo 2) | OK para este cambio; ver hallazgo |
| `despues-ruta-vieja-1440-claro.png` | 1440 · claro | `/my-account/loyalty` ya no pinta una pantalla aparte: termina en la ficha, en «Datos personales» (hallazgo 1) | OK para este cambio; ver hallazgo |
| `despues-editor-1440-claro.png` | 1440 · claro | Con el lápiz abierto, «Mis puntos» sigue en la tira pero apagada; pulsarla no abre nada; barra lateral entera, rótulos en un renglón | OK |
| `despues-editor-1440-oscuro.png` | 1440 · oscuro | Lo mismo, legible | OK |
| `despues-editor-1920-claro.png` | 1920 · claro | Lo mismo | OK |
| `despues-editor-1024-claro.png` | 1024 · claro | Lo mismo; el formulario pasa a dos columnas | OK |
| `despues-editor-768-claro.png` | 768 · claro | «Mis puntos» apagada al final de la tira; formulario en una columna, sin desborde | OK |
| `despues-editor-390-claro.png` | 390 · claro | Formulario en una columna, sin desborde; la pestaña apagada queda detrás de las flechas de la tira | OK |
| `despues-editor-390-oscuro.png` | 390 · oscuro | Lo mismo, legible | OK |

## Hallazgos, no de este cambio

1. **La dirección vieja abre la ficha en la primera pestaña, no en «Mis puntos».** En `mockup`,
   `/my-account/loyalty` redirige a `/my-account` (`src/app/app.routes.ts:1072`), y «Mis puntos»
   ya no está en el menú lateral (`src/app/core/navigation/navigation.map.ts:1363`). Las dos cosas
   entraron el 23/09, cuando la pestaña todavía no existía; el comentario de
   `src/app/app.routes.ts:1065-1069` dice que la redirección es «hasta que la pestaña exista».
   Ahora existe y la entrada directa funciona (`?pestana=puntos`), así que el destino puede ser
   `/my-account?pestana=puntos`. Es de quien lleva la redirección de la ruta vieja.
2. **En el teléfono, una pestaña elegida desde afuera no se trae a la vista.** La tira de
   pestañas sólo se corre hasta la pestaña cuando la persona la elige
   (`src/app/shared/components/molecules/tabs/tabs.ts:88-95`). Si la selección llega por
   `[(selectedIndex)]` —como al entrar por `?pestana=puntos`—, la tira no se mueve y a 390 la
   pestaña activa queda fuera de la vista. El guion lo mide y lo informa. Cuando la ruta vieja
   redirija a la pestaña, es lo que va a ver quien entre desde el teléfono. Es de quien lleve la
   molécula.

La captura del editor que salió cortada en la primera tanda era un efecto de la forma de
capturar, no del producto: con la pantalla quieta, la barra lateral sale entera en las siete celdas.

## Observaciones, no defectos de este cambio

- En tema oscuro, «Ver mis pedidos» y la miga «Panel» se leen apagados.
- La etiqueta «Demo» pisa el borde del encabezado en 390 y 768, y las píldoras «Datos de prueba»
  y «Ver componentes» quedan sobre el contenido en 1024.

## Estados de la billetera

La cuenta de la maqueta no tiene programa activo, así que la pestaña se vio en su estado vacío
(S3, con próxima acción). Los estados con saldo, canje y comprobante son los de la pantalla
propia y no cambian con este trabajo: los cubre `loyalty.spec.ts`.

## No cubierto

- La pestaña con saldo real: la cuenta de la maqueta no tiene programa.
- El recorrido con teclado de la tira en el navegador.
