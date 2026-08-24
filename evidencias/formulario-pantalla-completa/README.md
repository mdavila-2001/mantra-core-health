# El alta pública ocupa la pantalla entera — 22/08/2026

Pedido: «prefiero que el formulario ocupe toda la pantalla para que no haya
chance que se vea pequeño».

Antes, las tres altas públicas vivían en la mitad derecha de la ventana —la
otra mitad es la columna de marca— y ahí dentro en una tarjeta con tope de
40 rem. Con el motor sirviendo cuatro campos por página, ese paso se leía como
una tarjetita en una esquina en vez de como la tarea que la persona vino a
hacer.

## Qué cambió

`AuthSplit.contentWidth` gana un tercer valor, `full`, y es el único que toca la
**grilla** y no sólo el ancho del hueco:

- se va la columna de marca y el panel ocupa la celda única;
- el hueco del formulario pierde su `max-width`;
- lo que mantiene legible una línea de texto en un monitor ancho no es un tope
  sino el aire de la columna, que crece con la ventana
  (`padding-inline: clamp(--sp-6, 6vw, --sp-20)`): 24 px a 1024, ~115 px a 1920;
- el fondo vivo se queda —la aurora se estira con el panel—, y hay que devolver
  el remapeo del foco de luz, porque el puntero vuelve a medir contra la escena
  entera, igual que en teléfono;
- la píldora `__marca-mini`, que existía sólo para el teléfono, se muestra
  también en escritorio: sin la columna es lo único que dice de qué producto es
  la pantalla.

Lo usan `register-patient` (paciente y profesional) y `register-organization`.
La rejilla de tipos de cuenta (`/auth/register`) sigue en `wide`: es una
elección, no un formulario.

## Y se fue el alto fijo de la tarjeta

Las dos pantallas tenían, desde 1024x900, `max-height: min(80–85dvh, 44–48rem)`
con el cuerpo scrolleando por dentro. Con la ventana entera eso dejaba la
tarjeta flotando en un monitor de 1080 px **con dos barras de scroll a la vez**
—se ve en la primera corrida de `02`, con «Apellido materno» cortado—. Las dos
razones que lo justificaban ya no existen: el tipo de cuenta se elige antes, en
otra pantalla, así que la tarjeta no cambia de alto al tocar una pestaña; y una
página del motor tiene cuatro campos como tope, no diez.

## Capturas

| archivo | qué muestra |
|---|---|
| `01-paciente-paso-1-1366x768.png` | paso 1 de 4 del alta de paciente, de borde a borde |
| `02-profesional-paso-1-1920x1080.png` | los cinco pasos del profesional a 1920: cuatro campos y el botón, sin scroll interno |
| `03-aseguradora-paso-1-1366x768.png` | el alta de aseguradora, misma forma |
| `04-paciente-telefono-390x844.png` | teléfono: sin cambios, la columna ya era una sola |

## Lo que quedó verde

    yarn lint                      ✓
    yarn tsc -p tsconfig.app.json  ✓
    yarn test                      ✓ 3479/3479, 335 archivos
    node scripts/check-form-pages.mjs      ✓ 78 formularios
    node scripts/check-route-prefixes.mjs  ✓
    node scripts/check-tokens.mjs          ✓
    node scripts/check-contrast.mjs        ✓
    node scripts/check-doc-coverage.mjs    ✓
