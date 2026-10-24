# Papel — los PDF del sistema

Todo documento que la aplicación entrega como PDF —receta, historia clínica,
orden de estudio, comprobante, presupuesto, formulario, informe contable, ficha
de paciente— sale de **un solo maquetador**: `src/app/shared/utils/pdf-export/`.
Las pantallas no dibujan; arman bloques (`PdfBlock[]`) y el motor los pone en
la hoja con el mismo membrete, la misma tipografía y el mismo pie. Doce
documentos con seis identidades distintas es exactamente lo que un membrete
existe para evitar.

| Pieza | Archivo | Qué decide |
|---|---|---|
| Motor | `pdf-export.ts` | Membrete, filigrana, pie numerado, bloques, tablas, bloque de firma, extracción desde el DOM |
| Tema | `pdf-theme.ts` | Colores, tamaños, espaciados, cajas fijas (logo, firma y sello), filigrana |
| Marca | `alovida-mark.ts` | El isotipo en vectores: no necesita red ni DOM |
| Fuentes | `pdf-fuentes.ts` | Poppins e Inter en TTF, bajadas una vez por sesión |
| Logo | `pdf-logo.ts` | El logo del consultorio, preparado por `PdfBrandingService` |
| Firma | `pdf-firma.ts` | Firma y sello del profesional, idem |

## Tipografía

Las mismas familias que la pantalla (`--font-display` y `--font-body`), con
el reparto **por estilo**: todo lo que el motor escribe en negrita es un título
o un rótulo y va en **Poppins SemiBold**; todo lo normal es lectura y va en
**Inter Regular**. `jsPDF` sólo embebe TTF, así que los dos archivos viven en
`public/alovida/tipografias/` (`poppins-600.ttf`, `inter-400.ttf`; licencias en
su `LICENCIAS.md`) y pesan ~570 KB entre los dos: **no entran en el paquete**,
`PdfBrandingService` los baja en segundo plano al arrancar la sesión.

Si no se pudieron bajar —sin red, bajo SSR, en una prueba— el papel sale en
Helvetica. Las dos o ninguna: un documento con los títulos en Poppins y el
cuerpo en Helvetica se vería como un error de maquetado.

| Rol | Tamaño (pt) | Familia |
|---|---|---|
| Título del documento | 20 | Poppins |
| Bajada | 10,5 | Inter |
| Logotipo «ALOVIDA» | 12,5 · espaciado 2,4 | Poppins |
| Clase de documento | 7 · espaciado 1,5 | Poppins |
| Título de sección | 8,5 · espaciado 1,2 · versalitas | Poppins |
| Etiqueta de dato | 7,5 · espaciado 0,6 · versalitas | Poppins |
| Cuerpo y valor de dato | 9,5 | Inter |
| Cabecera de tabla | 8,5 | Poppins |
| Fila de tabla | 9 | Inter |
| Nota y letra chica | 8,5 | Inter |
| Pie | 7,5 | Inter |

## Color

`jsPDF` no lee CSS, así que `pdf-theme.ts` copia los colores en RGB. La prueba
`pdf-theme.spec.ts` lee `src/styles.css` y compara cada constante con la
variable de la que dice salir: si la rampa cambia, el papel se entera por una
prueba en rojo.

| Constante | Token | Uso |
|---|---|---|
| `COLOR_MARCA` | `--c-petrol-500` | Isotipo, títulos de sección, cabecera de tabla |
| `COLOR_MARCA_PROFUNDO` | `--c-petrol-700` | Título del documento, total |
| `COLOR_TINTA` | `--c-neutral-500` | Cuerpo |
| `COLOR_TINTA_SUAVE` | `--c-neutral-400` | Etiquetas, bajada, pie |
| `COLOR_FILETE` | `--c-petrol-50` | Filetes de un cabello |
| `COLOR_FILETE_FUERTE` | `--c-petrol-200` | Bordes de tabla y de sección |
| `COLOR_PANEL` | `--c-petrol-50` al 40 % sobre blanco | Cabecera de tabla, panel de nota |
| `COLOR_CEBRA` | `--c-petrol-50` al 20 % sobre blanco | Filas impares de una tabla |

Es sobrio a propósito: estos papeles se imprimen en blanco y negro y se
fotocopian. Un diseño de rellenos y colores se vuelve manchas grises; uno de
aire, filetes finos y jerarquía tipográfica sobrevive la fotocopia.

## La hoja

A4, márgenes de 54 pt a los lados, 44 arriba y 58 abajo. El contenido arranca
en 156 pt en la primera página (bajo el membrete con título) y en 116 en las
siguientes (membrete corto). Esas dos alturas son **fijas**: con o sin logo del
consultorio, con o sin bajada, el papel mide lo mismo.

- **Membrete.** Isotipo + «ALOVIDA» a la izquierda; clase de documento y
  referencia a la derecha, en versalitas; la caja del logo del consultorio
  (120×34 pt) a la derecha de la primera página. Debajo, filete, título y bajada.
- **Filigrana.** El isotipo al 25 % del ancho y 4 % de opacidad, abajo a la
  derecha, apoyado sobre el filete del pie. Antes iba enorme y centrada detrás
  de las tablas, y en pantalla se leía como una mancha gris.
- **Pie.** Filete, la línea legal a la izquierda («Documento confidencial ·
  AloVida», o `footerNote`) y «Página X de N» a la derecha, sellado al final
  cuando ya se sabe cuántas páginas hay.
- **Bloque de firma.** Firma y sello (cajas fijas de 150×56 y 56×56), línea,
  nombre y matrícula, al pie de la última página; pasa a una página nueva si
  el contenido llega hasta ahí.

## Tablas

Las filas consecutivas (`kind: 'row'`) forman una tabla. Reglas:

- **Ancho de columnas.** Cada una pide lo que mide su celda más larga
  (*preferido*) y no baja de su palabra más larga (*mínimo*). Si entran, el
  sobrante va a la más ancha. Si no entran, cada una recibe su mínimo y el
  resto se reparte en proporción a la *holgura* (preferido − mínimo): una
  numeración, un recuento o una fecha corta no tienen holgura y conservan su
  ancho; el texto largo cede y se parte en líneas.
- **Columnas numéricas a la derecha.** Toda columna cuyas celdas del cuerpo
  sean números (con signo, moneda, separadores o porcentaje) se alinea a la
  derecha. Una fecha o un número de documento tienen cifras y **no** son
  números: no se alinean.
- **Cabecera** sobre `COLOR_PANEL`, en Poppins y color de marca; se repite si
  la tabla sigue en otra página.
- **Cebra**: filas impares sobre `COLOR_CEBRA`, filete de un cabello entre
  renglones, filete marcado bajo la cabecera y al cerrar.
- Alto de fila: líneas × 12,5 + 5 arriba y abajo.

## Exportar una pantalla

`<app-pdf-export-button>` recorre el DOM de su `target` (o de la `section`,
`article`, `form` o `[data-pdf-root]` que lo contiene) y arma bloques:
`h1`–`h6` → encabezados, `p`/`li` → párrafos, `dl` → datos con etiqueta,
`table` → filas. No replica el CSS: replica el contenido.

Lo que **no** copia: nodos con `aria-hidden="true"`, `.sr-only`,
`[data-pdf-ignore]` y los controles (`button`, `input`, `select`, `textarea`,
el propio botón de exportar). Dentro de una celda sí se conserva el texto de un
`<button>`: el encabezado ordenable de `app-data-table` es un botón y su texto
es el nombre de la columna; la flecha de orden ya viene con `aria-hidden`.

Dos reglas al enchufar el botón:

1. **La raíz exportable envuelve todo lo que debe salir.** En contabilidad el
   botón apuntaba al `div` del encabezado y el PDF salía con el título y nada
   más; ahora cada informe va dentro de un `<div data-pdf-root #xxxPdf>` que
   contiene el encabezado **y** la tabla.
2. **Marcá con `data-pdf-ignore` lo que es control y no dato.**
   `app-data-table` ya lo hace con sus celdas de selección y de detalle.

## Deuda conocida

- **La API (`mantra-core-health-api`) tiene tres PDF con pdfkit sin capa
  común** —receta oficial, encuentro cerrado, certificado de portabilidad—,
  cada uno con su margen, su tamaño de hoja (A4 o LETTER) y su azul
  (`#0b3d4d`, que no es `--c-petrol-500`), sin logo del consultorio, sin firma
  y sin numeración de páginas. Fase 2: un `src/common/pdf/` que espeje
  `pdf-theme.ts` (membrete, pie, marca, QR) y migre los tres servicios. Mientras
  tanto, la maqueta sirve la receta oficial por este mismo motor
  (`clinical.handlers.ts`).
- `features/billing/representacion-grafica.ts` dibuja la marca de agua
  «SIMULADO» y el QR con jsPDF crudo, fuera del tema.
