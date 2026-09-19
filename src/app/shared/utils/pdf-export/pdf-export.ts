import { jsPDF } from 'jspdf';

import { altoDeMarca, dibujarMarcaAlovida, type ColorRgb } from './alovida-mark';
import {
  ANCHO_DE_ISOTIPO_CONTINUACION_PT,
  ANCHO_DE_ISOTIPO_PT,
  COLOR_FILETE,
  COLOR_FILETE_FUERTE,
  COLOR_MARCA,
  COLOR_MARCA_PROFUNDO,
  COLOR_PANEL,
  COLOR_TINTA,
  COLOR_TINTA_SUAVE,
  ESPACIADO,
  FILIGRANA,
  INICIO_DE_CONTENIDO_CONTINUACION_PT,
  INICIO_DE_CONTENIDO_PT,
  MARGEN_INFERIOR_PT,
  MARGEN_LATERAL_PT,
  MARGEN_SUPERIOR_PT,
  RITMO,
  TIPOGRAFIA,
} from './pdf-theme';

/**
 * El maquetador de PDF de AloVida, sobre `jsPDF` puro.
 *
 * ## Por qué no rasteriza (nada de `html2canvas`)
 *
 * Todos los documentos del sistema —presupuesto, receta, historia clínica,
 * orden de estudio, comprobante— son **texto estructurado**: encabezados,
 * datos, párrafos y tablas. Para eso alcanzan las primitivas de `jsPDF`, que no
 * dependen de canvas ni de una librería aparte. `html2canvas` resuelve otro
 * problema —una captura fiel de CSS arbitrario— que ninguno de estos
 * documentos necesita, y sumarlo habría sido la dependencia de más.
 *
 * ## El papel tiene identidad
 *
 * Cada página lleva el isotipo de AloVida: chico y firmado arriba, en el
 * membrete, y enorme y casi transparente detrás del texto, como filigrana. El
 * pie numera las páginas —«3 de 7»— para que un documento clínico incompleto se
 * note al mirarlo. Todo eso lo dibuja **el motor**, no cada documento: un
 * membrete que cada pantalla arme por su cuenta deja de ser un membrete.
 *
 * El isotipo se dibuja en vectores (ver `alovida-mark.ts`), así que no hace
 * falta ni red ni DOM para generar el papel: corre igual en el navegador y en
 * una prueba.
 *
 * ## Qué extrae del elemento
 *
 * Recorre el DOM y arma bloques en el orden en que aparecen: `h1`–`h6` como
 * encabezados con su jerarquía, `p`/`li` como párrafos, `dt`/`dd` como pares de
 * dato, y cada `tr` de una `table` como una fila de columnas. Cualquier otro
 * nodo hoja con texto propio se trata como párrafo. Es deliberadamente simple:
 * no replica el CSS, replica el contenido.
 */

/** Opciones de los tres constructores de documento. */
export interface PdfExportOptions {
  /** Título del documento, impreso en el membrete y en los metadatos del PDF. */
  readonly title?: string;
  /** La bajada bajo el título: de quién es el papel, o de qué fecha. */
  readonly subtitle?: string;
  /**
   * La clase de documento, arriba a la derecha en versalitas —«RECETA MÉDICA»—.
   * Es lo que deja identificar el papel de un vistazo, antes de leerlo.
   */
  readonly kind?: string;
  /** Una referencia corta —folio, número de pedido— junto a la clase. */
  readonly reference?: string;
  /** La línea legal del pie. Por omisión, la de confidencialidad. */
  readonly footerNote?: string;
}

/**
 * Un bloque de contenido listo para maquetar.
 *
 * Se exporta porque el maquetador es **uno solo** para todo el repo: un
 * documento puede llegar desde el DOM (`buildPdfDocument`) o desde datos
 * (`buildBlocksPdf`, que usan los documentos clínicos y el comprobante), y las
 * dos entradas terminan en la misma lista de bloques. Dos maquetadores
 * producirían dos PDF con márgenes distintos para el mismo sistema.
 *
 * `text` está **siempre**, en todos los tipos, y dice la línea completa tal
 * como se lee. Los tipos que además parten el dato —`field` en etiqueta y
 * valor, `row` en columnas— traen esas partes aparte para poder alinearlas,
 * pero `text` sigue siendo la versión canónica: quien quiera saber qué dice el
 * documento lee `text` y no tiene que conocer cada tipo.
 */
export interface PdfBlock {
  readonly kind:
    | 'heading'
    | 'paragraph'
    | 'row'
    | 'field'
    | 'note'
    | 'total'
    | 'divider'
    | 'caption'
    /**
     * Un hueco para escribir a mano: uno o varios renglones vacíos.
     *
     * Es el único bloque que **no dice nada**, y existe porque hay documentos
     * que se imprimen para completarse en papel —un formulario en blanco es el
     * caso— y no para leerse. Antes había que fingirlo con `divider`, que es
     * otra cosa: un separador anuncia que cambia el asunto, y una pila de
     * separadores seguidos se lee como un documento roto.
     *
     * Cuántos renglones, en {@link PdfBlock.lines}.
     */
    | 'blank'
    /**
     * Corta acá y sigue en una hoja nueva.
     *
     * El maquetador reparte solo: pasa de página cuando lo que viene no entra,
     * y eso es lo correcto para un documento que se lee corrido. No lo es para
     * uno cuyas partes **son** hojas —un formulario que en pantalla se sirve de
     * a una página—: ahí el corte es del contenido, no del espacio que quedó
     * libre.
     *
     * No abre una hoja en blanco: si la actual está recién empezada, no hace
     * nada.
     */
    | 'pagebreak';
  /** La línea completa, tal como se lee. Presente en todos los tipos. */
  readonly text: string;
  /** Nivel de encabezado (1–6); sólo en `kind === 'heading'`. */
  readonly level?: number;
  /** La etiqueta de un dato; sólo en `kind === 'field'`. */
  readonly label?: string;
  /** El valor de un dato; sólo en `kind === 'field'`. */
  readonly value?: string;
  /** Las columnas de una fila; sólo en `kind === 'row'`. */
  readonly cells?: readonly string[];
  /** Marca la fila de encabezado de una tabla; sólo en `kind === 'row'`. */
  readonly header?: boolean;
  /**
   * Cuántos renglones vacíos deja; sólo en `kind === 'blank'`. Por omisión, uno.
   *
   * Se declara según lo que se va a escribir encima: una fecha entra en un
   * renglón y un motivo de consulta no. Un campo de texto largo con un solo
   * renglón obliga a escribir en el margen, que es el defecto que este número
   * evita.
   */
  readonly lines?: number;
}

/** La línea del pie cuando el documento no pide otra. */
const PIE_POR_OMISION = 'Documento confidencial · AloVida';

/**
 * Lo que mide un renglón escrito a mano, en puntos (≈ 7,8 mm).
 *
 * Sale de lo que ocupa una letra manuscrita corriente con su holgura, no de lo
 * que se ve prolijo en pantalla: estos renglones se llenan con una lapicera.
 */
const ALTO_DE_RENGLON = 22;

/** Tamaño de fuente por nivel de encabezado. */
const TAMANO_DE_ENCABEZADO: Readonly<Record<number, number>> = {
  1: TIPOGRAFIA.seccion + 3,
  2: TIPOGRAFIA.subseccion,
  3: TIPOGRAFIA.rotulo,
  4: TIPOGRAFIA.cuerpo,
  5: TIPOGRAFIA.nota,
  6: TIPOGRAFIA.nota,
};

/**
 * Arma el documento PDF a partir del elemento, sin guardarlo.
 *
 * Separado de {@link exportElementToPdf} para que se pueda reusar el mismo PDF
 * —adjuntarlo, previsualizarlo, mandarlo por otro canal— sin repetir la
 * extracción, y para que las pruebas puedan inspeccionar el documento sin
 * disparar una descarga.
 *
 * @param element - Elemento cuyo contenido se exporta.
 * @param options - Título, bajada y clase del documento.
 * @returns El documento `jsPDF` ya maquetado, listo para `.save()` o `.output()`.
 */
export function buildPdfDocument(element: HTMLElement, options: PdfExportOptions = {}): jsPDF {
  return buildBlocksPdf(blocksOf(element), options);
}

/**
 * Arma el documento a partir de bloques ya extraídos.
 *
 * Es el maquetador de verdad: `buildPdfDocument` es esto mismo con un paso
 * previo que saca los bloques del DOM. Existe separado porque hay documentos
 * que **no vienen de una pantalla** —la receta, la historia de una atención, el
 * comprobante— y renderizarlos en el DOM sólo para volver a leerlos sería dar
 * una vuelta larga y frágil, además de imposible bajo SSR.
 *
 * @param blocks - Contenido en orden de lectura.
 * @param options - Título, bajada y clase del documento.
 * @returns El documento `jsPDF` maquetado, listo para `.save()` o `.output()`.
 */
export function buildBlocksPdf(blocks: readonly PdfBlock[], options: PdfExportOptions = {}): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  if (options.title !== undefined) {
    doc.setProperties({ title: options.title });
  }

  const hoja = abrirHoja(doc, options);

  for (const elemento of agrupar(blocks)) {
    if (elemento.tipo === 'tabla') {
      dibujarTabla(hoja, elemento.filas);
      continue;
    }
    dibujarBloque(hoja, elemento.bloque);
  }

  sellarPies(hoja);
  return doc;
}

/**
 * Exporta un elemento del DOM a un archivo PDF descargable.
 *
 * @param element - Elemento cuyo contenido se exporta.
 * @param filename - Nombre del archivo a descargar; se agrega `.pdf` si falta.
 * @param options - Título, bajada y clase del documento.
 */
export function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  options: PdfExportOptions = {},
): void {
  const doc = buildPdfDocument(element, options);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/* ---- la hoja ------------------------------------------------------------ */

/** Todo lo que hace falta saber para seguir escribiendo donde se quedó. */
interface Hoja {
  readonly doc: jsPDF;
  readonly opciones: PdfExportOptions;
  /** Ancho y alto de la página, en puntos. */
  readonly ancho: number;
  readonly alto: number;
  /** Borde izquierdo del contenido y ancho disponible. */
  readonly izquierda: number;
  readonly util: number;
  /** La última línea que se puede escribir antes de pasar de página. */
  readonly fondo: number;
  /**
   * Dónde empieza el contenido de la hoja **en curso**, bajo su membrete.
   *
   * Cambia al pasar de página —el membrete de continuación es más chico—, y es
   * lo que distingue una hoja recién abierta de una a medio escribir: con la
   * constante de la continuación, una hoja primera y vacía daba `y` mayor y se
   * leía como escrita.
   */
  inicio: number;
  /** Dónde va la próxima línea. Lo único que se mueve. */
  y: number;
}

/** Abre la primera página con su membrete y deja la pluma lista. */
function abrirHoja(doc: jsPDF, opciones: PdfExportOptions): Hoja {
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const izquierda = MARGEN_LATERAL_PT;
  const util = ancho - MARGEN_LATERAL_PT * 2;

  const hoja: Hoja = {
    doc,
    opciones,
    ancho,
    alto,
    izquierda,
    util,
    fondo: alto - MARGEN_INFERIOR_PT,
    inicio: INICIO_DE_CONTENIDO_PT,
    y: 0,
  };

  dibujarFiligrana(hoja);
  hoja.y = dibujarMembrete(hoja, true);
  hoja.inicio = hoja.y;
  return hoja;
}

/**
 * Pasa a una página nueva, con su filigrana y su membrete corto.
 *
 * El membrete de continuación es más chico a propósito: repetir el título
 * grande en cada página convierte un documento de cinco carillas en cinco
 * portadas.
 */
function pasarDePagina(hoja: Hoja): void {
  hoja.doc.addPage();
  dibujarFiligrana(hoja);
  hoja.y = dibujarMembrete(hoja, false);
  hoja.inicio = hoja.y;
}

/**
 * Deja lugar para un bloque de `alto` puntos, pasando de página si no entra.
 *
 * No pasa de página cuando todavía no se escribió nada en la actual: un bloque
 * más alto que la caja de texto entraría en un bucle de páginas vacías, y es
 * preferible que se corte a que el documento no termine de generarse nunca.
 */
function abrirEspacio(hoja: Hoja, alto: number): void {
  if (hoja.y + alto > hoja.fondo && hoja.y > hoja.inicio) {
    pasarDePagina(hoja);
  }
}

/* ---- el membrete, la filigrana y el pie --------------------------------- */

/**
 * El isotipo enorme y casi transparente detrás del texto.
 *
 * Va **antes** que cualquier contenido de la página: en un PDF lo que se dibuja
 * después tapa lo anterior, así que la filigrana tiene que ser lo primero de
 * cada página para quedar debajo del texto y no encima.
 */
function dibujarFiligrana(hoja: Hoja): void {
  const anchoMarca = hoja.ancho * FILIGRANA.anchoRelativo;
  dibujarMarcaAlovida(hoja.doc, {
    x: (hoja.ancho - anchoMarca) / 2,
    y: (hoja.alto - altoDeMarca(anchoMarca)) / 2,
    ancho: anchoMarca,
    color: COLOR_MARCA,
    opacidad: FILIGRANA.opacidad,
  });
}

/**
 * El membrete. Devuelve la altura donde puede empezar el contenido.
 *
 * @param primera - La primera página lleva título y bajada; las siguientes,
 *   sólo la firma de la marca y el título en chico.
 */
function dibujarMembrete(hoja: Hoja, primera: boolean): number {
  const { doc } = hoja;
  const derecha = hoja.izquierda + hoja.util;
  const anchoMarca = primera ? ANCHO_DE_ISOTIPO_PT : ANCHO_DE_ISOTIPO_CONTINUACION_PT;
  const topeMarca = MARGEN_SUPERIOR_PT;

  dibujarMarcaAlovida(doc, {
    x: hoja.izquierda,
    y: topeMarca,
    ancho: anchoMarca,
    color: COLOR_MARCA,
  });

  const baseLogotipo = topeMarca + altoDeMarca(anchoMarca) - (primera ? 1 : 0.5);
  escribirEspaciado(hoja, {
    texto: 'ALOVIDA',
    x: hoja.izquierda + anchoMarca + (primera ? 11 : 7),
    y: baseLogotipo,
    tamano: primera ? TIPOGRAFIA.logotipo : TIPOGRAFIA.logotipo - 4,
    espaciado: primera ? ESPACIADO.logotipo : ESPACIADO.logotipo - 0.8,
    estilo: 'bold',
    color: COLOR_MARCA_PROFUNDO,
  });

  // La clase de documento, a la derecha y a la altura del logotipo. Si el
  // documento no declara una, ahí no va nada: repetir el título en versalitas
  // al lado del título grande no agrega información, agrega ruido.
  const clase = hoja.opciones.kind;
  const referencia = hoja.opciones.reference;
  const hayClase = clase !== undefined && clase.trim() !== '';
  // La referencia sólo va en la primera página: en las siguientes, el folio
  // repetido compite con la numeración del pie sin decir nada nuevo.
  const hayReferencia = primera && referencia !== undefined && referencia.trim() !== '';

  if (hayClase) {
    escribirEspaciado(hoja, {
      texto: clase.toLocaleUpperCase('es'),
      x: derecha,
      // Con folio debajo, la clase sube para que el par quede centrado sobre
      // la misma línea que el logotipo.
      y: baseLogotipo - (hayReferencia ? 6 : 0),
      tamano: TIPOGRAFIA.clase,
      espaciado: ESPACIADO.clase,
      estilo: 'bold',
      color: COLOR_TINTA_SUAVE,
      alineacion: 'right',
    });
  }
  if (hayReferencia) {
    escribirEspaciado(hoja, {
      texto: referencia,
      x: derecha,
      y: baseLogotipo + (hayClase ? 8 : 0),
      tamano: TIPOGRAFIA.clase,
      espaciado: 0.4,
      estilo: 'normal',
      color: COLOR_TINTA_SUAVE,
      alineacion: 'right',
    });
  }

  const yFilete = topeMarca + altoDeMarca(anchoMarca) + (primera ? 16 : 10);
  filete(hoja, yFilete, COLOR_FILETE, 0.6);

  if (!primera) {
    const titulo = hoja.opciones.title;
    // El título sólo se repite cuando dice algo que la clase no dice ya: con
    // «HISTORIA CLÍNICA» arriba a la derecha, un «Historia clínica» debajo es
    // ruido que se lee dos veces y no informa nada.
    const repetido =
      titulo !== undefined &&
      clase !== undefined &&
      titulo.trim().toLocaleLowerCase('es') === clase.trim().toLocaleLowerCase('es');
    if (!repetido && titulo !== undefined && titulo.trim() !== '') {
      escribir(hoja, {
        texto: titulo,
        x: derecha,
        y: yFilete + 13,
        tamano: TIPOGRAFIA.nota,
        estilo: 'normal',
        color: COLOR_TINTA_SUAVE,
        alineacion: 'right',
      });
    }
    return INICIO_DE_CONTENIDO_CONTINUACION_PT;
  }

  const titulo = hoja.opciones.title;
  let y = yFilete + 34;
  if (titulo !== undefined && titulo.trim() !== '') {
    const lineas = partir(hoja, titulo, hoja.util, TIPOGRAFIA.titulo, 'bold');
    escribirLineas(hoja, {
      lineas,
      x: hoja.izquierda,
      y,
      tamano: TIPOGRAFIA.titulo,
      estilo: 'bold',
      color: COLOR_MARCA_PROFUNDO,
      interlineado: TIPOGRAFIA.titulo + 6,
    });
    y += (lineas.length - 1) * (TIPOGRAFIA.titulo + 6);
  }

  const bajada = hoja.opciones.subtitle;
  if (bajada !== undefined && bajada.trim() !== '') {
    y += 17;
    const lineas = partir(hoja, bajada, hoja.util, TIPOGRAFIA.bajada, 'normal');
    escribirLineas(hoja, {
      lineas,
      x: hoja.izquierda,
      y,
      tamano: TIPOGRAFIA.bajada,
      estilo: 'normal',
      color: COLOR_TINTA_SUAVE,
      interlineado: RITMO.linea,
    });
    y += (lineas.length - 1) * RITMO.linea;
  }

  return Math.max(INICIO_DE_CONTENIDO_PT, y + 30);
}

/**
 * El pie de todas las páginas, con la numeración completa.
 *
 * Se estampa **al final**, cuando ya se sabe cuántas páginas hay: «Página 2 de
 * 7» no se puede escribir mientras todavía se está escribiendo la 2. Un
 * documento clínico sin ese «de 7» no deja notar que falta una carilla.
 */
function sellarPies(hoja: Hoja): void {
  const { doc } = hoja;
  const total = doc.getNumberOfPages();
  const derecha = hoja.izquierda + hoja.util;
  const yFilete = hoja.alto - MARGEN_INFERIOR_PT + 24;
  const yTexto = yFilete + 13;

  for (let pagina = 1; pagina <= total; pagina += 1) {
    doc.setPage(pagina);
    filete(hoja, yFilete, COLOR_FILETE, 0.6);
    escribir(hoja, {
      texto: hoja.opciones.footerNote ?? PIE_POR_OMISION,
      x: hoja.izquierda,
      y: yTexto,
      tamano: TIPOGRAFIA.pie,
      estilo: 'normal',
      color: COLOR_TINTA_SUAVE,
    });
    escribir(hoja, {
      texto: `Página ${pagina} de ${total}`,
      x: derecha,
      y: yTexto,
      tamano: TIPOGRAFIA.pie,
      estilo: 'normal',
      color: COLOR_TINTA_SUAVE,
      alineacion: 'right',
    });
  }
}

/* ---- los bloques -------------------------------------------------------- */

/** Un bloque suelto, o una tabla armada con las filas que venían seguidas. */
type Elemento =
  | { readonly tipo: 'bloque'; readonly bloque: PdfBlock }
  | { readonly tipo: 'tabla'; readonly filas: readonly PdfBlock[] };

/**
 * Junta las filas consecutivas en una tabla.
 *
 * Las columnas se alinean entre sí, y para eso hay que medirlas todas juntas
 * antes de dibujar la primera: una fila que decide su ancho sola no es una
 * tabla, es una lista de textos que casualmente van uno debajo del otro.
 */
function agrupar(blocks: readonly PdfBlock[]): readonly Elemento[] {
  const elementos: Elemento[] = [];
  let filas: PdfBlock[] = [];

  const cerrarTabla = (): void => {
    if (filas.length > 0) {
      elementos.push({ tipo: 'tabla', filas });
      filas = [];
    }
  };

  for (const bloque of blocks) {
    if (bloque.kind === 'row') {
      filas.push(bloque);
      continue;
    }
    cerrarTabla();
    elementos.push({ tipo: 'bloque', bloque });
  }
  cerrarTabla();
  return elementos;
}

/** Dibuja un bloque que no es fila de tabla. */
function dibujarBloque(hoja: Hoja, bloque: PdfBlock): void {
  switch (bloque.kind) {
    case 'heading':
      dibujarEncabezado(hoja, bloque);
      return;
    case 'field':
      dibujarDato(hoja, bloque);
      return;
    case 'note':
      dibujarNota(hoja, bloque);
      return;
    case 'total':
      dibujarTotal(hoja, bloque);
      return;
    case 'divider':
      dibujarSeparador(hoja);
      return;
    case 'blank':
      dibujarRenglones(hoja, bloque);
      return;
    case 'pagebreak':
      cortarHoja(hoja);
      return;
    case 'caption':
      dibujarPieDeBloque(hoja, bloque);
      return;
    default:
      dibujarParrafo(hoja, bloque);
  }
}

/**
 * Un encabezado.
 *
 * El nivel 2 —el que usan casi todas las secciones— sale en versalitas
 * espaciadas sobre un filete a todo el ancho: marca la sección sin robarle
 * peso al título del documento, y sobrevive a una fotocopia mucho mejor que un
 * bloque de color.
 */
function dibujarEncabezado(hoja: Hoja, bloque: PdfBlock): void {
  const nivel = bloque.level ?? 6;
  const tamano = TAMANO_DE_ENCABEZADO[nivel] ?? TIPOGRAFIA.cuerpo;

  if (nivel <= 2) {
    abrirEspacio(
      hoja,
      RITMO.antesDeSeccion + RITMO.despuesDeSeccion + tamano + RITMO.linea * 2,
    );
    hoja.y += RITMO.antesDeSeccion;
    escribirEspaciado(hoja, {
      texto: bloque.text.toLocaleUpperCase('es'),
      x: hoja.izquierda,
      y: hoja.y,
      tamano: nivel === 1 ? TIPOGRAFIA.subseccion + 1.5 : TIPOGRAFIA.subseccion,
      espaciado: ESPACIADO.subseccion,
      estilo: 'bold',
      color: COLOR_MARCA,
    });
    hoja.y += 7;
    filete(hoja, hoja.y, nivel === 1 ? COLOR_FILETE_FUERTE : COLOR_FILETE, nivel === 1 ? 0.9 : 0.6);
    hoja.y += RITMO.despuesDeSeccion;
    return;
  }

  const lineas = partir(hoja, bloque.text, hoja.util, tamano, 'bold');
  const alto = lineas.length * (tamano + 4);
  // Se reserva el encabezado **y dos líneas de lo que venga**: un rótulo solo
  // al pie de una página, con su contenido en la siguiente, se lee como si la
  // sección estuviera vacía.
  abrirEspacio(hoja, alto + 12 + RITMO.linea * 2);
  hoja.y += 12;
  escribirLineas(hoja, {
    lineas,
    x: hoja.izquierda,
    y: hoja.y,
    tamano,
    estilo: 'bold',
    color: nivel === 3 ? COLOR_TINTA : COLOR_TINTA_SUAVE,
    interlineado: tamano + 4,
  });
  hoja.y += alto + 4;
}

/** Un párrafo del cuerpo. */
function dibujarParrafo(hoja: Hoja, bloque: PdfBlock): void {
  const lineas = partir(hoja, bloque.text, hoja.util, TIPOGRAFIA.cuerpo, 'normal');
  const alto = lineas.length * RITMO.linea;
  abrirEspacio(hoja, alto);
  escribirLineas(hoja, {
    lineas,
    x: hoja.izquierda,
    y: hoja.y,
    tamano: TIPOGRAFIA.cuerpo,
    estilo: 'normal',
    color: COLOR_TINTA,
    interlineado: RITMO.linea,
  });
  hoja.y += alto + RITMO.entreBloques;
}

/**
 * Un dato: la etiqueta a la izquierda, el valor a la derecha.
 *
 * Las etiquetas van en una columna fija y en versalitas suaves, así que la
 * vista baja por los valores sin tropezar con «Paciente:», «Documento:»,
 * «Profesional:» repetidos. Es la diferencia entre una ficha y una lista de
 * frases.
 */
function dibujarDato(hoja: Hoja, bloque: PdfBlock): void {
  const etiqueta = bloque.label ?? '';
  const valor = bloque.value ?? bloque.text;
  const xValor = hoja.izquierda + RITMO.columnaDeEtiqueta;
  const anchoValor = hoja.util - RITMO.columnaDeEtiqueta;

  const lineas = partir(hoja, valor, anchoValor, TIPOGRAFIA.cuerpo, 'normal');
  const alto = lineas.length * RITMO.linea;
  abrirEspacio(hoja, alto);

  if (etiqueta !== '') {
    escribirEspaciado(hoja, {
      texto: etiqueta.toLocaleUpperCase('es'),
      x: hoja.izquierda,
      y: hoja.y,
      tamano: TIPOGRAFIA.etiqueta,
      espaciado: ESPACIADO.etiqueta,
      estilo: 'bold',
      color: COLOR_TINTA_SUAVE,
    });
  }
  escribirLineas(hoja, {
    lineas,
    x: xValor,
    y: hoja.y,
    tamano: TIPOGRAFIA.cuerpo,
    estilo: 'normal',
    color: COLOR_TINTA,
    interlineado: RITMO.linea,
  });
  hoja.y += alto + 4;
}

/**
 * Una nota: letra chica sobre un panel apenas teñido, con una barra de marca a
 * la izquierda. Es para lo que hay que leer pero no es el dato —advertencias,
 * el pie de emisión, «esto no es una factura»—.
 */
function dibujarNota(hoja: Hoja, bloque: PdfBlock): void {
  const relleno = RITMO.panel;
  const anchoTexto = hoja.util - relleno * 2 - 4;
  const lineas = partir(hoja, bloque.text, anchoTexto, TIPOGRAFIA.nota, 'normal');
  const altoTexto = lineas.length * (TIPOGRAFIA.nota + 3.5);
  const altoPanel = altoTexto + relleno * 2 - 3;

  abrirEspacio(hoja, altoPanel + RITMO.entreBloques);
  hoja.y += 4;

  hoja.doc.setFillColor(COLOR_PANEL[0], COLOR_PANEL[1], COLOR_PANEL[2]);
  hoja.doc.rect(hoja.izquierda, hoja.y - TIPOGRAFIA.nota, hoja.util, altoPanel, 'F');
  hoja.doc.setFillColor(COLOR_MARCA[0], COLOR_MARCA[1], COLOR_MARCA[2]);
  hoja.doc.rect(hoja.izquierda, hoja.y - TIPOGRAFIA.nota, 2.2, altoPanel, 'F');

  escribirLineas(hoja, {
    lineas,
    x: hoja.izquierda + relleno + 4,
    y: hoja.y + relleno - 5,
    tamano: TIPOGRAFIA.nota,
    estilo: 'normal',
    color: COLOR_TINTA_SUAVE,
    interlineado: TIPOGRAFIA.nota + 3.5,
  });

  hoja.y += altoPanel - TIPOGRAFIA.nota + RITMO.entreBloques;
}

/**
 * El total de un comprobante: grande, en color de marca y alineado a la
 * derecha, debajo del filete con que cierra la tabla. No dibuja un filete
 * propio: el de la tabla ya está ahí, y dos líneas seguidas se ven como un
 * error de maquetado.
 */
function dibujarTotal(hoja: Hoja, bloque: PdfBlock): void {
  abrirEspacio(hoja, TIPOGRAFIA.total + 20);
  hoja.y += 12;
  escribir(hoja, {
    texto: bloque.text,
    x: hoja.izquierda + hoja.util,
    y: hoja.y,
    tamano: TIPOGRAFIA.total,
    estilo: 'bold',
    color: COLOR_MARCA_PROFUNDO,
    alineacion: 'right',
  });
  hoja.y += RITMO.entreBloques + 6;
}

/**
 * La letra chica del final: quién emitió el papel y cuándo.
 *
 * Va en gris y en cuerpo chico, separada del contenido por aire: es lo que hace
 * rastreable al documento, pero no es el documento.
 */
function dibujarPieDeBloque(hoja: Hoja, bloque: PdfBlock): void {
  const lineas = partir(hoja, bloque.text, hoja.util, TIPOGRAFIA.nota, 'normal');
  const alto = lineas.length * (TIPOGRAFIA.nota + 3.5);
  abrirEspacio(hoja, alto + 14);
  hoja.y += 14;
  escribirLineas(hoja, {
    lineas,
    x: hoja.izquierda,
    y: hoja.y,
    tamano: TIPOGRAFIA.nota,
    estilo: 'normal',
    color: COLOR_TINTA_SUAVE,
    interlineado: TIPOGRAFIA.nota + 3.5,
  });
  hoja.y += alto + RITMO.entreBloques;
}

/**
 * Cierra la hoja y sigue en la siguiente.
 *
 * Sobre una hoja recién abierta no hace nada: un corte pedido dos veces
 * seguidas —o justo después de que el contenido pasara de página por su
 * cuenta— dejaría una carilla en blanco, que en un documento impreso se lee
 * como una falla de la impresora.
 */
function cortarHoja(hoja: Hoja): void {
  if (hoja.y <= hoja.inicio) {
    return;
  }
  pasarDePagina(hoja);
}

/**
 * Los renglones en blanco de un documento que se completa a mano.
 *
 * El alto no es decorativo: {@link ALTO_DE_RENGLON} es lo que mide una línea
 * de escritura a mano en papel. Un renglón más apretado se ve bien en pantalla
 * y no se puede llenar con una lapicera, que es lo único para lo que existe.
 *
 * Cada renglón pide su propio espacio, así que un corte de página cae **entre**
 * dos renglones y no encima de uno.
 */
function dibujarRenglones(hoja: Hoja, bloque: PdfBlock): void {
  const cuantos = Math.max(1, Math.trunc(bloque.lines ?? 1));
  for (let i = 0; i < cuantos; i += 1) {
    abrirEspacio(hoja, ALTO_DE_RENGLON);
    hoja.y += ALTO_DE_RENGLON - 5;
    filete(hoja, hoja.y, COLOR_FILETE_FUERTE, 0.5);
  }
  hoja.y += RITMO.entreBloques;
}

/** Un respiro con un filete al medio, cuando cambia el asunto sin cambiar de sección. */
function dibujarSeparador(hoja: Hoja): void {
  abrirEspacio(hoja, 20);
  hoja.y += 8;
  filete(hoja, hoja.y, COLOR_FILETE, 0.6);
  hoja.y += 14;
}

/* ---- las tablas --------------------------------------------------------- */

/**
 * Hasta qué fracción del ancho útil una columna cuenta como angosta.
 *
 * Por debajo de esto no se la achica cuando la tabla no entra: son las columnas
 * de una numeración o un recuento, donde el texto no tiene por dónde partirse.
 */
const ANCHO_DE_COLUMNA_ANGOSTA = 0.18;

/** Cómo se parten las columnas cuando la fila no las trae ya separadas. */
const SEPARADOR_DE_COLUMNAS = /\t|\s{3,}/;

/**
 * Una tabla: columnas alineadas, cabecera sobre un panel y un filete por fila.
 *
 * La última columna se alinea a la derecha cuando todos sus valores traen algún
 * número —importes, cantidades—: una columna de precios alineada a la izquierda
 * obliga a leer cifra por cifra para compararlas.
 */
function dibujarTabla(hoja: Hoja, filas: readonly PdfBlock[]): void {
  const celdas = filas.map((fila) => columnasDe(fila));
  const columnas = Math.max(...celdas.map((fila) => fila.length));
  if (columnas === 0) {
    return;
  }

  const anchos = repartirColumnas(hoja, filas, celdas, columnas);
  const derechaUltima = ultimaColumnaEsNumerica(filas, celdas, columnas);
  const cabecera = filas.findIndex((fila) => fila.header === true);

  abrirEspacio(hoja, 46);
  hoja.y += 6;

  for (const [indice, fila] of filas.entries()) {
    const esCabecera = fila.header === true;
    const partidas = partirFila(hoja, celdas[indice], anchos, esCabecera);
    const altoFila = altoDeFila(partidas);

    const paginaAntes = hoja.doc.getNumberOfPages();
    abrirEspacio(hoja, altoFila);

    // La tabla siguió en otra carilla: se repite la fila de encabezado antes
    // de seguir. Una columna de números sin su nombre, en la página 3, obliga
    // a volver a la 2 para saber cuál es el capital y cuál el interés — y en
    // un papel impreso, a veces esa página ya no está.
    if (hoja.doc.getNumberOfPages() > paginaAntes && cabecera !== -1 && indice > cabecera) {
      const partidasCabecera = partirFila(hoja, celdas[cabecera], anchos, true);
      dibujarFila(hoja, partidasCabecera, anchos, columnas, true, derechaUltima);
      filete(hoja, hoja.y, COLOR_FILETE, 0.5);
      hoja.y += 13;
    }

    dibujarFila(hoja, partidas, anchos, columnas, esCabecera, derechaUltima);

    // El filete de la última fila cierra la tabla, así que se dibuja más
    // marcado: es el borde de la tabla, no una separación entre dos renglones.
    const ultima = indice === filas.length - 1;
    filete(hoja, hoja.y, ultima ? COLOR_FILETE_FUERTE : COLOR_FILETE, ultima ? 0.9 : 0.5);
    hoja.y += 13;
  }

  hoja.y += RITMO.entreBloques - 5;
}

/** Las celdas de una fila, ya partidas en las líneas que entran en su columna. */
function partirFila(
  hoja: Hoja,
  celdas: readonly string[],
  anchos: readonly number[],
  esCabecera: boolean,
): readonly (readonly string[])[] {
  return celdas.map((texto, columna) =>
    partir(hoja, texto, anchos[columna] - 8, TIPOGRAFIA.fila, esCabecera ? 'bold' : 'normal'),
  );
}

/** El alto de una fila: manda la celda que más líneas ocupa. */
function altoDeFila(partidas: readonly (readonly string[])[]): number {
  const lineas = Math.max(1, ...partidas.map((parte) => parte.length));
  return lineas * RITMO.lineaDeFila + 9;
}

/** Pinta una fila donde está la pluma y deja la pluma bajo su última línea. */
function dibujarFila(
  hoja: Hoja,
  partidas: readonly (readonly string[])[],
  anchos: readonly number[],
  columnas: number,
  esCabecera: boolean,
  derechaUltima: boolean,
): void {
  const tamano = TIPOGRAFIA.fila;
  const altoFila = altoDeFila(partidas);

  if (esCabecera) {
    hoja.doc.setFillColor(COLOR_PANEL[0], COLOR_PANEL[1], COLOR_PANEL[2]);
    hoja.doc.rect(hoja.izquierda, hoja.y - tamano - 2, hoja.util, altoFila, 'F');
  }

  let x = hoja.izquierda;
  for (let columna = 0; columna < columnas; columna += 1) {
    const alineacion =
      derechaUltima && columna === columnas - 1 ? ('right' as const) : ('left' as const);
    const xTexto = alineacion === 'right' ? x + anchos[columna] - 4 : x + 4;
    escribirLineas(hoja, {
      lineas: partidas[columna] ?? [''],
      x: xTexto,
      y: hoja.y,
      tamano,
      estilo: esCabecera ? 'bold' : 'normal',
      color: esCabecera ? COLOR_MARCA : COLOR_TINTA,
      interlineado: RITMO.lineaDeFila,
      alineacion,
    });
    x += anchos[columna];
  }

  hoja.y += altoFila - 9 + 5;
}

/** Las columnas de una fila: las que trae, o las que salen de partir su texto. */
function columnasDe(fila: PdfBlock): readonly string[] {
  if (fila.cells !== undefined && fila.cells.length > 0) {
    return fila.cells.map((celda) => celda.trim());
  }
  return fila.text.split(SEPARADOR_DE_COLUMNAS).map((celda) => celda.trim());
}

/**
 * Reparte el ancho entre las columnas.
 *
 * Cada una pide lo que mide su contenido más largo; si entre todas entran, el
 * sobrante se lo queda la **más ancha**, que es la de la descripción: la que
 * gana algo con el espacio de más. Dárselo a la primera columna dejaría una
 * numeración de tres caracteres ocupando media hoja. Si no entran, se achican
 * todas en proporción antes que dejar que una se salga del margen.
 */
function repartirColumnas(
  hoja: Hoja,
  filas: readonly PdfBlock[],
  celdas: readonly (readonly string[])[],
  columnas: number,
): readonly number[] {
  const relleno = 12;
  const pedidos: number[] = [];

  for (let columna = 0; columna < columnas; columna += 1) {
    let ancho = 0;
    for (const [indice, fila] of filas.entries()) {
      const texto = celdas[indice][columna] ?? '';
      hoja.doc.setFont('helvetica', fila.header === true ? 'bold' : 'normal');
      hoja.doc.setFontSize(TIPOGRAFIA.fila);
      ancho = Math.max(ancho, medir(hoja, texto));
    }
    pedidos.push(Math.min(ancho + relleno, hoja.util * 0.7));
  }

  const total = pedidos.reduce((suma, ancho) => suma + ancho, 0);
  if (total <= 0) {
    return pedidos.map(() => hoja.util / columnas);
  }
  if (total <= hoja.util) {
    const anchos = [...pedidos];
    const masAncha = pedidos.indexOf(Math.max(...pedidos));
    anchos[masAncha] += hoja.util - total;
    return anchos;
  }

  // No entran. Se achican **las anchas**, que son las de texto y se parten en
  // varias líneas sin quedar mal; las angostas —una numeración, un recuento,
  // el rótulo «Atenciones»— conservan lo que piden.
  //
  // El defecto que esto cierra: repartir la falta entre todas por igual dejaba
  // un encabezado de una palabra partido en dos renglones («Atencion / es»),
  // que es lo primero que se ve como descuido en un documento.
  const esAngosta = (ancho: number): boolean => ancho <= hoja.util * ANCHO_DE_COLUMNA_ANGOSTA;
  const reservado = pedidos.filter(esAngosta).reduce((suma, ancho) => suma + ancho, 0);
  const aRepartir = hoja.util - reservado;
  const pedidoDeLasAnchas = total - reservado;
  if (aRepartir > 0 && pedidoDeLasAnchas > 0) {
    return pedidos.map((ancho) =>
      esAngosta(ancho) ? ancho : (ancho / pedidoDeLasAnchas) * aRepartir,
    );
  }
  return pedidos.map((ancho) => (ancho / total) * hoja.util);
}

/** Si la última columna es de números —importes, cantidades—, va a la derecha. */
function ultimaColumnaEsNumerica(
  filas: readonly PdfBlock[],
  celdas: readonly (readonly string[])[],
  columnas: number,
): boolean {
  if (columnas < 2) {
    return false;
  }
  const cuerpo = filas
    .map((fila, indice) => ({ fila, texto: celdas[indice][columnas - 1] ?? '' }))
    .filter((entrada) => entrada.fila.header !== true && entrada.texto !== '');
  return cuerpo.length > 0 && cuerpo.every((entrada) => /\d/.test(entrada.texto));
}

/* ---- primitivas de dibujo ----------------------------------------------- */

/** Un filete de un cabello a todo el ancho útil. */
function filete(hoja: Hoja, y: number, color: ColorRgb, grosor: number): void {
  hoja.doc.setDrawColor(color[0], color[1], color[2]);
  hoja.doc.setLineWidth(grosor);
  hoja.doc.line(hoja.izquierda, y, hoja.izquierda + hoja.util, y);
}

/** Lo que hace falta para poner texto en la hoja. */
interface Escritura {
  readonly texto: string;
  readonly x: number;
  readonly y: number;
  readonly tamano: number;
  readonly estilo: 'normal' | 'bold' | 'italic';
  readonly color: ColorRgb;
  readonly alineacion?: 'left' | 'right';
}

/** Una línea suelta. */
function escribir(hoja: Hoja, escritura: Escritura): void {
  escribirLineas(hoja, {
    ...escritura,
    lineas: [escritura.texto],
    interlineado: escritura.tamano + 3,
  });
}

/** Varias líneas ya partidas, de arriba hacia abajo. */
function escribirLineas(
  hoja: Hoja,
  escritura: Omit<Escritura, 'texto'> & {
    readonly lineas: readonly string[];
    readonly interlineado: number;
  },
): void {
  const { doc } = hoja;
  doc.setFont('helvetica', escritura.estilo);
  doc.setFontSize(escritura.tamano);
  doc.setTextColor(escritura.color[0], escritura.color[1], escritura.color[2]);
  for (const [indice, linea] of escritura.lineas.entries()) {
    doc.text(linea, escritura.x, escritura.y + indice * escritura.interlineado, {
      align: escritura.alineacion ?? 'left',
    });
  }
}

/**
 * Texto con las letras separadas, para las versalitas del membrete y las
 * secciones. El espaciado se devuelve a cero enseguida: en un PDF es un ajuste
 * global, y dejarlo puesto le abre las letras al primer párrafo que venga.
 */
function escribirEspaciado(
  hoja: Hoja,
  escritura: Escritura & { readonly espaciado: number },
): void {
  hoja.doc.setCharSpace(escritura.espaciado);
  escribir(hoja, escritura);
  hoja.doc.setCharSpace(0);
}

/** Cuánto mide un texto con la fuente que está puesta. */
function medir(hoja: Hoja, texto: string): number {
  return hoja.doc.getTextWidth(texto);
}

/** Parte un texto en líneas que entran en `ancho`, con la fuente indicada. */
function partir(
  hoja: Hoja,
  texto: string,
  ancho: number,
  tamano: number,
  estilo: 'normal' | 'bold' | 'italic',
): readonly string[] {
  hoja.doc.setFont('helvetica', estilo);
  hoja.doc.setFontSize(tamano);
  return hoja.doc.splitTextToSize(texto, Math.max(1, ancho)) as string[];
}

/* ---- la extracción desde el DOM ----------------------------------------- */

/** Los bloques de contenido del elemento, en el orden en que aparecen. */
function blocksOf(element: HTMLElement): readonly PdfBlock[] {
  const blocks: PdfBlock[] = [];
  walk(element, blocks);
  return blocks;
}

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const PARAGRAPH_TAGS = new Set(['P', 'LI']);

function walk(node: Element, blocks: PdfBlock[]): void {
  if (node.tagName === 'TABLE') {
    for (const row of Array.from(node.querySelectorAll(':scope tr'))) {
      const celdas = Array.from(row.querySelectorAll('th, td')).map((cell) =>
        (cell.textContent ?? '').trim(),
      );
      const texto = celdas.join('   ');
      if (texto.trim() !== '') {
        // La fila de `th` es la cabecera de la tabla: se marca acá, donde se
        // sabe, y no se adivina después mirando el texto.
        blocks.push({
          kind: 'row',
          text: texto,
          cells: celdas,
          header: row.querySelector('th') !== null,
        });
      }
    }
    return;
  }

  // `dt`/`dd` es un dato con su etiqueta y su valor: el DOM ya lo dice así, y
  // maquetarlo como dos párrafos sueltos perdería esa relación.
  if (node.tagName === 'DL') {
    const hijos = Array.from(node.children);
    for (const [indice, hijo] of hijos.entries()) {
      if (hijo.tagName !== 'DT') {
        continue;
      }
      const etiqueta = (hijo.textContent ?? '').trim();
      const siguiente = hijos[indice + 1];
      const valor =
        siguiente !== undefined && siguiente.tagName === 'DD'
          ? (siguiente.textContent ?? '').trim()
          : '';
      if (etiqueta !== '' && valor !== '') {
        blocks.push(campoDeBloque(etiqueta, valor));
      }
    }
    return;
  }

  if (HEADING_TAGS.has(node.tagName)) {
    const texto = (node.textContent ?? '').trim();
    if (texto !== '') {
      blocks.push({ kind: 'heading', text: texto, level: Number(node.tagName[1]) });
    }
    return;
  }

  if (PARAGRAPH_TAGS.has(node.tagName)) {
    const texto = (node.textContent ?? '').trim();
    if (texto !== '') {
      blocks.push({ kind: 'paragraph', text: texto });
    }
    return;
  }

  const hijos = Array.from(node.children);
  if (hijos.length === 0) {
    const texto = (node.textContent ?? '').trim();
    if (texto !== '') {
      blocks.push({ kind: 'paragraph', text: texto });
    }
    return;
  }

  for (const child of hijos) {
    walk(child, blocks);
  }
}

/**
 * Un dato con su etiqueta, para armar bloques desde cualquier documento.
 *
 * Se exporta porque los cuatro constructores de documentos —clínicos,
 * comprobante y los que vengan— arman los mismos pares etiqueta/valor, y cada
 * uno repitiendo el `${etiqueta}: ${valor}` de `text` es la clase de detalle
 * que se desincroniza entre archivos sin que nadie lo note.
 */
export function campoDeBloque(etiqueta: string, valor: string): PdfBlock {
  return { kind: 'field', text: `${etiqueta}: ${valor}`, label: etiqueta, value: valor };
}
