import type { PdfSignature } from '../../../core/pdf-branding/pdf-signature';
import type { PdfLogo } from '../../../core/pdf-branding/pdf-logo';
import type { PdfTone } from './pdf-theme';

/** Un dato con su etiqueta. */
export interface PdfField {
  readonly label: string;
  readonly value: string;
}

/** Un panel de datos con título: «Emisor», «Paciente», «Profesional». */
export interface PdfPanel {
  readonly title: string;
  readonly fields: readonly PdfField[];
}

/** Una fila de la caja de totales. */
export interface PdfTotalRow {
  readonly label: string;
  readonly value: string;
  /** El total a pagar: va resaltado al final de la caja. */
  readonly emphasis?: boolean;
}

/**
 * Un código QR ya calculado, como matriz de módulos.
 *
 * Se recibe calculado —y no el texto a codificar— para que el maquetador siga
 * siendo síncrono y no arrastre la librería de QR a todos los documentos:
 * quien lo necesita lo arma con `qrBlock` (`pdf-qr.ts`), que la carga en
 * diferido. Se dibuja en vectores, nítido a cualquier tamaño.
 */
export interface PdfQrMatrix {
  /** Módulos por lado. */
  readonly size: number;
  /** `size × size` módulos por filas; distinto de cero = oscuro. */
  readonly modules: ArrayLike<number | boolean>;
}

/** Quién emite el papel: va en el pie de todas las páginas. */
export interface PdfIssuer {
  /** Razón social o nombre del consultorio. */
  readonly name: string;
  /** NIT, dirección, teléfono, correo: cada uno tal como se lee. */
  readonly details?: readonly string[];
}

/** Un dato del bloque de metadatos, a la derecha del título. */
export interface PdfMetaEntry {
  readonly label: string;
  readonly value: string;
}

/** Opciones de los constructores de documento. */
export interface PdfExportOptions {
  /** Título del documento, impreso bajo el membrete y en los metadatos del PDF. */
  readonly title?: string;
  /** La bajada bajo el título: de quién es el papel, o de qué fecha. */
  readonly subtitle?: string;
  /**
   * La clase de documento, en versalitas sobre el título —«RECETA MÉDICA»—.
   * Es lo que deja identificar el papel de un vistazo, antes de leerlo.
   */
  readonly kind?: string;
  /** Una referencia corta —folio, número de pedido— en el bloque de metadatos. */
  readonly reference?: string;
  /** Datos de más para el bloque de metadatos (vigencia, estado). */
  readonly meta?: readonly PdfMetaEntry[];
  /**
   * Cuándo se emitió el papel. Va en la portada («Fecha de emisión») y en el
   * pie de todas las páginas («Emitido el …»). Sin ella, el papel dice la fecha
   * en que **se generó** y lo rotula así («Fecha de generación», «Generado el
   * …»): nunca presenta la fecha de descarga como si fuera la de emisión.
   */
  readonly issuedAt?: Date;
  /** Quién lo emite. Por omisión, AloVida. */
  readonly issuer?: PdfIssuer;
  /** La línea legal del pie. Por omisión, la de confidencialidad. */
  readonly footerNote?: string;
  /**
   * Una marca de agua en diagonal en cada hoja —«SIN VALIDEZ FISCAL»—, debajo
   * del contenido.
   */
  readonly watermark?: string;
  /**
   * Papel claro: portada sin el degradado oscuro y sin las franjas de borde,
   * para artículos extensos con imágenes clínicas.
   */
  readonly plainPaper?: boolean;
  /**
   * El logo del consultorio, arriba a la derecha de la primera página.
   *
   * Ausente, se usa el de la sesión (ver `establecerLogoDeDocumentos`);
   * `null`, el documento sale **sin logo** aunque la sesión tenga uno. Con o
   * sin él el membrete mide lo mismo: la ranura es de tamaño fijo.
   */
  readonly logo?: PdfLogo | null;
  /**
   * La firma y el sello del médico, al final del contenido, con su nombre y
   * matrícula debajo.
   *
   * Ausente, se usa la del profesional de la sesión (ver
   * `setDocumentSignature`); `null`, el documento sale **sin bloque de
   * firma**. Sin imágenes el bloque sale igual, con la línea de firma vacía.
   * Son imágenes, **no una firma electrónica**.
   */
  readonly firma?: PdfSignature | null;
}

/**
 * Un bloque de contenido listo para maquetar.
 *
 * El maquetador es **uno solo** para todo el repo: un documento puede llegar
 * desde el DOM (`buildPdfDocument`) o desde datos (`buildBlocksPdf`), y las dos
 * entradas terminan en la misma lista de bloques.
 *
 * `text` está **siempre**, en todos los tipos, y dice el bloque completo tal
 * como se lee. Los tipos que además parten el dato —`field` en etiqueta y
 * valor, `row` en columnas, `fields` en pares— traen esas partes aparte para
 * poder alinearlas, pero `text` sigue siendo la versión canónica: quien quiera
 * saber qué dice el documento lee `text` y no tiene que conocer cada tipo.
 */
export interface PdfBlock {
  readonly kind:
    /** Título de sección (niveles 1–2) o subtítulo (3–6). */
    | 'heading'
    | 'paragraph'
    /** Una fila de tabla; las filas seguidas forman una tabla. */
    | 'row'
    /** Un dato con etiqueta a la izquierda; los seguidos forman una lista. */
    | 'field'
    /** Varios datos en rejilla, la etiqueta sobre el valor. */
    | 'fields'
    /** Paneles de datos lado a lado: emisor y cliente, paciente y profesional. */
    | 'panels'
    /** Una lista con viñetas. */
    | 'list'
    /**
     * Opciones para marcar a mano, con casillas dibujadas: redondas para una
     * sola respuesta, cuadradas para varias. Es del formulario en blanco.
     */
    | 'choices'
    /** Un aviso sobre un panel teñido, con un tono. */
    | 'note'
    /** Un total suelto, en una banda a la derecha. */
    | 'total'
    /** La caja de totales: subtotal, descuento, total a pagar. */
    | 'totals'
    /** Un código QR con su leyenda al lado. */
    | 'qr'
    | 'divider'
    /** Letra chica al final de un bloque. */
    | 'caption'
    | 'image'
    /**
     * Un hueco para escribir a mano: uno o varios renglones vacíos.
     *
     * Es el único bloque que **no dice nada**, y existe porque hay documentos
     * que se imprimen para completarse en papel —un formulario en blanco—.
     * Cuántos renglones, en {@link PdfBlock.lines}.
     */
    | 'blank'
    /**
     * Corta acá y sigue en una hoja nueva. No abre una hoja en blanco: si la
     * actual está recién empezada, no hace nada.
     */
    | 'pagebreak';
  /** El bloque completo, tal como se lee. Presente en todos los tipos. */
  readonly text: string;
  /** Nivel de encabezado (1–6); sólo en `heading`. */
  readonly level?: number;
  /** La etiqueta de un dato; sólo en `field`. */
  readonly label?: string;
  /** El valor de un dato; sólo en `field`. */
  readonly value?: string;
  /** Las columnas de una fila; sólo en `row`. */
  readonly cells?: readonly string[];
  /** Marca la fila de encabezado de una tabla; sólo en `row`. */
  readonly header?: boolean;
  /** Los datos de una rejilla; sólo en `fields`. */
  readonly fields?: readonly PdfField[];
  /** Columnas de la rejilla (2–4, por omisión 3); sólo en `fields`. */
  readonly columns?: number;
  /** Los paneles; sólo en `panels`. */
  readonly panels?: readonly PdfPanel[];
  /** Los renglones de una lista o las opciones; sólo en `list` y `choices`. */
  readonly items?: readonly string[];
  /** Se puede marcar más de una opción (casillas cuadradas); sólo en `choices`. */
  readonly multiple?: boolean;
  /** Las filas de la caja; sólo en `totals`. */
  readonly totals?: readonly PdfTotalRow[];
  /** El código ya calculado; sólo en `qr`. */
  readonly qr?: PdfQrMatrix;
  /** El tono de un aviso; sólo en `note`. Por omisión, `brand`. */
  readonly tone?: PdfTone;
  /** El título de un aviso o de un código QR. */
  readonly title?: string;
  /**
   * Cuántos renglones vacíos deja; sólo en `blank`. Por omisión, uno.
   *
   * Se declara según lo que se va a escribir encima: una fecha entra en un
   * renglón y un motivo de consulta no.
   */
  readonly lines?: number;
  /** Imagen rasterizada y con licencia validada por el documento que la agrega. */
  readonly image?: PdfLogo;
}
