import type { VerticalReporte } from '@core/data-access/reporting/reporting.types';

/** Una medida ofrecida como botón («¿Quisiste decir…?»). Al pulsarla se contesta esa medida, sin volver a adivinar. */
export interface SugerenciaMedida {
  readonly pestana: VerticalReporte;
  readonly kpiId: string;
  readonly titulo: string;
  /** Nombre de la pestaña donde vive: dos medidas pueden llamarse igual. */
  readonly etiquetaPestana: string;
}

export interface VariacionRespuesta {
  /** «+4,2 %» / «Sin comparativo». */
  readonly texto: string;
  /** Lo que dice con palabras (el sentido no puede ir solo en el color). */
  readonly descripcion: string;
  /** `null` cuando no hay comparativo o no hay cambio. */
  readonly favorable: boolean | null;
}

/** Todo lo que se dice de una medida; la cifra ya viene formateada por `formatearValor`. */
export interface RespuestaMedida {
  readonly titulo: string;
  /** «de tu organización» / «de toda la plataforma». */
  readonly ambito: string;
  readonly periodo: string;
  readonly filtros: readonly string[];
  readonly valorTexto: string;
  readonly sinDato: boolean;
  readonly motivoSinDato: string | null;
  /** `null` si el portal no tiene comparación activa. */
  readonly variacion: VariacionRespuesta | null;
  readonly definicion: string;
  readonly formula: string | null;
  readonly fuente: string;
  readonly frescura: string;
  readonly generadoEn: string | null;
  readonly esEjemplo: boolean;
  readonly ruta: string;
}

interface MensajeBase {
  readonly id: number;
}

export interface MensajeUsuario extends MensajeBase {
  readonly rol: 'usuario';
  readonly texto: string;
}

interface MensajeAsistenteBase extends MensajeBase {
  readonly rol: 'asistente';
  /** Pestañas que no se pudieron revisar (la respuesta puede estar incompleta). */
  readonly noRevisadas?: readonly string[];
}

export type MensajeAsistente =
  | (MensajeAsistenteBase & { readonly tipo: 'respuesta'; readonly respuesta: RespuestaMedida })
  | (MensajeAsistenteBase & { readonly tipo: 'ambigua'; readonly medidas: readonly SugerenciaMedida[] })
  | (MensajeAsistenteBase & { readonly tipo: 'sin-medida'; readonly medidas: readonly SugerenciaMedida[] })
  | (MensajeAsistenteBase & { readonly tipo: 'personas' })
  | (MensajeAsistenteBase & { readonly tipo: 'sin-pregunta' })
  | (MensajeAsistenteBase & { readonly tipo: 'catalogo-vacio' })
  | (MensajeAsistenteBase & {
      readonly tipo: 'error';
      readonly estado: 'forbidden' | 'offline' | 'error';
      readonly mensaje: string;
      readonly requestId: string | null;
      /** Qué se estaba preguntando, para reintentar sin escribirlo de nuevo. */
      readonly reintento: { readonly pregunta: string; readonly medida: SugerenciaMedida | null } | null;
    });

export type Mensaje = MensajeUsuario | MensajeAsistente;
