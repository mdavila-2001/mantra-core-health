# Los documentos PDF

Cómo se ven y cómo se arman los PDF que genera el portal: receta, atención,
orden de estudio, historia clínica, formulario respondido, formulario en
blanco, comprobante, cotización, factura de farmacia, factura simulada y nota
de venta. Todos pasan por un solo maquetador (`src/app/shared/utils/pdf-export/`)
y llevan la identidad de AloVida.

## Identidad

- **Colores:** sólo tokens de `src/styles/alovida.css` (AloVida v1.1), copiados
  en RGB en `pdf-theme.ts`. `pdf-theme.spec.ts` compara cada uno con la hoja: un
  hex inventado o el ámbar de acción como color de bloque ponen la prueba en
  rojo. Las transparencias (`--sombra-azul`, `--sombra-azul-suave`) se
  reproducen con opacidad.
- **Tipografías:** Poppins 600 (títulos) y 500 (rótulos, versalitas, cabeceras
  de tabla); Nunito Sans 400 (cuerpo, datos, tablas) y 700 (cifras). TTF
  estáticos en `public/alovida/tipografias/` (origen y licencias en su
  `LICENCIAS.md`), bajados en diferido por `PdfBrandingService`; sin ellos el
  papel cae a Helvetica.
- **Todo vector:** degradados (`ShadingPattern`), isotipo, filetes, casillas y
  QR. Nada se rasteriza salvo las imágenes que trae el dato (logo del
  consultorio, firma, sello, ilustraciones del glosario, nunca por debajo de
  200 ppp).

## La hoja

- A4, márgenes de 48 pt, retícula de 12 columnas con calle de 12 pt.
- **Portada** (primera hoja): banda a sangre en el degradado de los azules
  profundos, isotipo y marca en blanco, logo del consultorio en una ficha
  blanca, clase de documento, título, bajada y, a la derecha, folio, fecha de
  emisión (o «de generación» si el dato no la trae) y metadatos. Con
  `plainPaper` la portada es clara, sin banda (formularios en blanco, artículos).
- **Hojas siguientes:** franja fina, marca chica, título y folio.
- **Pie** de todas las hojas: emisor y sus datos, nota legal, «Emitido el …» /
  «Generado el …» y «Página X de Y».
- **Marca de agua** opcional, encima del contenido con poca opacidad (el QR se
  redibuja limpio encima de ella).

## Bloques

`heading` (niveles 1–2 abren sección), `paragraph`, `list`, `field` (lista de
datos), `fields` (rejilla), `panels` (tarjetas lado a lado), `row` (tablas con
cabecera repetida y aviso de continuación), `totals`/`total` (caja de totales
con el total a pagar en una banda), `note` (avisos por tono: neutral, brand,
info, success, warning, alert, con una marca que se distingue sin color),
`qr`, `choices` (casillas dibujadas para marcar a mano), `blank` (renglones
para escribir), `image`, `caption`, `divider`, `pagebreak`. Constructores en
`pdf-export.ts`; formatos comunes de monto (`1.234,56 Bs`), fecha
(`dd/mm/aaaa`) y hora (24 h) en `pdf-format.ts`.

Reglas de paginación: nada se encima ni se sale de la hoja; un título reserva el
arranque de lo que lo sigue; una cabecera de tabla, la última fila, la caja de
totales o el aviso que cierran una tabla nunca quedan solos; los huecos de
hasta seis renglones no se parten; la firma va pegada al contenido y, si
quedaría sola en la última hoja, se lleva el último bloque (o el último dato)
con ella.

## Muestras

`yarn pdf:samples` genera en `artifacts/pdf-samples/` (o en `PDF_SAMPLES_DIR`)
un PDF de muestra por plantilla con datos ficticios
(`scripts/pdf-samples/*.pdf-sample.ts`).

## Pendiente en el backend

Los PDF del backend (`mantra-core-health-api`, pdfkit:
`encounter-pdf.service.ts`, `prescription-pdf.service.ts`,
`insurance-portability-pdf.service.ts`) no se tocaron: es otro repositorio.
Para que salgan con la misma identidad habría que portar:

1. **Tokens** de `pdf-theme.ts` (`PDF_TOKENS`, `PDF_COLORS`, `PDF_TONES`,
   `PDF_GRADIENTS`, `PDF_TYPE`, `PDF_SPACE`) a un módulo compartido del backend;
   pdfkit acepta los mismos RGB y tiene `linearGradient` para la portada.
2. **Fuentes:** los cuatro TTF de `public/alovida/tipografias/` registrados con
   `doc.registerFont` (pdfkit sí subsetea y aplica el interletrado).
3. **Marco de hoja:** portada, membrete de continuación y pie con
   «Página X de Y» (en pdfkit, con `bufferPages: true` y un recorrido final).
4. **Bloques** equivalentes: tarjetas, rejilla, tabla con cabecera repetida,
   caja de totales, avisos por tono, firma y QR (con `qrcode`, ≥ 3 × 3 cm).
5. **Formatos** de `pdf-format.ts` (monto, fecha, hora de 24 h).
6. **Fecha de emisión** del dato, nunca la de generación rotulada como emisión.
