/* ============================================================================
    De qué se está hablando: la tarjeta de contexto de un chat del marketplace.

    ## Para qué

    Quien escribe a una farmacia desde un pedido, un producto o un servicio no
    quiere explicar de qué habla: el chat lo pone arriba, como la tarjeta del
    pedido en una app de delivery. Del otro lado, la farmacia ve el mismo
    renglón y sabe a qué pedido responder sin preguntar.

    ## Por qué viaja como texto

    Porque el contrato del mensaje (`POST /community/conversations/:id/
    messages`) tiene `bodyText` y `attachmentFileId`, y nada más. Un campo nuevo
    exigiría migrar la tabla; un texto legible no. El formato es el que leería
    una persona en cualquier cliente —la exportación JSON, la notificación, una
    versión vieja de la app—:

        Pedido: Farmacia Chávez · Sucursal Miraflores
        2 productos · Bs 69,00
        /my-account/pharmacy-orders/7f3c…

    La primera línea es `<etiqueta>: <título>`, la última es la ruta interna, y
    la del medio (opcional) es el detalle. El hilo reconoce esa forma y la pinta
    como tarjeta; si no la reconoce, queda como un mensaje común, que también
    se entiende.

    ## Lo que nunca va acá

    Datos clínicos. El título y el detalle son lo que ya muestra la ficha
    pública o el pedido —nombre de la farmacia, del producto, un total—, nunca
    un diagnóstico ni la receta.
   ========================================================================== */

/** Sobre qué se abre el chat. */
export type TipoDeContexto = 'pedido' | 'producto' | 'servicio' | 'farmacia';

/** La tarjeta, ya leída. */
export interface ContextoDeChat {
  readonly tipo: TipoDeContexto;
  /** Lo que va en negrita: el producto, la farmacia, el servicio. */
  readonly titulo: string;
  /** Una línea de apoyo: presentación, precio, cantidad. Opcional. */
  readonly detalle?: string;
  /** Ruta interna absoluta (empieza con `/`) a la que lleva la tarjeta. */
  readonly ruta: string;
}

/** La etiqueta visible de cada tipo, que además es la marca del formato. */
export const ETIQUETA_DE_CONTEXTO: Readonly<Record<TipoDeContexto, string>> = {
  pedido: 'Pedido',
  producto: 'Producto',
  servicio: 'Servicio',
  farmacia: 'Farmacia',
};

/** Tope de cada línea: una tarjeta no es un párrafo. */
const TOPE_DE_LINEA = 140;

const TIPO_POR_ETIQUETA: ReadonlyMap<string, TipoDeContexto> = new Map(
  (Object.entries(ETIQUETA_DE_CONTEXTO) as [TipoDeContexto, string][]).map(
    ([tipo, etiqueta]) => [etiqueta, tipo],
  ),
);

/** Una línea sin saltos ni espacios de más, recortada al tope. */
function linea(texto: string): string {
  const limpia = texto.replace(/\s+/gu, ' ').trim();
  return limpia.length <= TOPE_DE_LINEA ? limpia : `${limpia.slice(0, TOPE_DE_LINEA - 1)}…`;
}

/**
 * Una ruta interna aceptable: absoluta, sin esquema ni host, sin `//`.
 *
 * Es lo que impide que la tarjeta se convierta en un enlace a otro sitio: el
 * texto lo escribe cualquiera, y quien lo recibe lo va a tocar.
 */
export function esRutaInterna(ruta: string): boolean {
  return /^\/(?!\/)[\w\-./?=&%~]*$/u.test(ruta) && !ruta.includes('..');
}

/**
 * El texto del mensaje que lleva la tarjeta.
 *
 * @throws Error si la ruta no es interna o el título está vacío: es un error
 *   de programación de quien arma el contexto, no un dato del usuario.
 */
export function textoDeContexto(contexto: ContextoDeChat): string {
  const titulo = linea(contexto.titulo);
  if (titulo === '') {
    throw new Error('Un contexto de chat necesita título.');
  }
  if (!esRutaInterna(contexto.ruta)) {
    throw new Error(`Ruta de contexto no interna: ${contexto.ruta}`);
  }
  const detalle = contexto.detalle === undefined ? '' : linea(contexto.detalle);
  const lineas = [`${ETIQUETA_DE_CONTEXTO[contexto.tipo]}: ${titulo}`];
  if (detalle !== '') {
    lineas.push(detalle);
  }
  lineas.push(contexto.ruta);
  return lineas.join('\n');
}

/**
 * La tarjeta escondida en un texto, o `null` si el texto no tiene esa forma.
 *
 * Estricto a propósito: dos o tres líneas, etiqueta conocida, ruta interna al
 * final. Un mensaje que se le parece pero no calza se muestra como texto.
 */
export function contextoDelTexto(texto: string | null | undefined): ContextoDeChat | null {
  if (typeof texto !== 'string') return null;
  const lineas = texto.split('\n').map((l) => l.trim());
  if (lineas.length < 2 || lineas.length > 3) return null;

  const primera = /^([^:]+):\s+(.+)$/u.exec(lineas[0] ?? '');
  const tipo = primera === null ? undefined : TIPO_POR_ETIQUETA.get(primera[1] ?? '');
  const titulo = primera?.[2]?.trim() ?? '';
  const ruta = lineas[lineas.length - 1] ?? '';
  if (tipo === undefined || titulo === '' || !esRutaInterna(ruta)) return null;

  const detalle = lineas.length === 3 ? lineas[1] : undefined;
  return detalle === undefined || detalle === ''
    ? { tipo, titulo, ruta }
    : { tipo, titulo, detalle, ruta };
}

/**
 * Lo que se lee en la bandeja o en una notificación cuando el último mensaje
 * es una tarjeta: «Pedido · Farmacia Chávez», no tres líneas con una ruta.
 */
export function resumenDeContexto(contexto: ContextoDeChat): string {
  return `${ETIQUETA_DE_CONTEXTO[contexto.tipo]} · ${contexto.titulo}`;
}
