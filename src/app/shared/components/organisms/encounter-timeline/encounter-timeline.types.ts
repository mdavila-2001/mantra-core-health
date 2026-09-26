import type { Hecho } from '../../molecules/fact-list/fact-list.types';
import type { Tone } from '../../tone/tone.types';

/* ============================================================================
    El contrato de la **línea del encuentro**: lo que pasó en una atención,
    ordenado como sucedió.

    ## Todo llega ya resuelto y rotulado

    Ningún campo es un uuid de concepto ni una fecha sin formato de dominio: la
    pantalla que monta la línea ya tradujo la terminología y ya decidió cómo se
    llama cada cosa para quien la lee. El organismo **no inyecta ningún
    cliente** — es la misma regla que ya cumplen `app-fact-list` y
    `app-fact-section`, y es lo que permite que la misma línea la monte el
    archivo del paciente y, más adelante, la consulta del profesional (C8) sin
    que cada una arme su propia versión del mismo hecho clínico.

    ## Por qué los identificadores viajan igual

    `id` no se pinta nunca: es la clave de `@for` y lo que permite volver a
    dibujar sin perder el foco. Si se pintara, sería exactamente el uuid que
    esta pantalla tiene prohibido mostrar.
    ========================================================================== */

/**
 * Los cinco tipos de hecho de una atención, **en el orden en que se cuentan**.
 *
 * El orden es el de la consulta real: primero se escribe la nota, después se
 * piden los estudios, después se registra el diagnóstico, después se agenda la
 * reconsulta y al final se emite la receta. Es lo que desempata dos hechos del
 * mismo instante —o sin instante— y lo que evita que la línea cambie de orden
 * entre dos dibujos.
 */
export const TIPOS_DE_HECHO = ['nota', 'orden', 'diagnostico', 'reconsulta', 'receta'] as const;

export type TipoDeHecho = (typeof TIPOS_DE_HECHO)[number];

/** La atención a la que pertenece la línea, ya en palabras. */
export interface EncounterHeader {
  /** Clave de dibujo. Jamás se pinta. */
  readonly id: string;
  /** Motivo de consulta, tal como se lee. */
  readonly motivo: string;
  /** Cuándo empezó, o `null` si el registro no lo declara. */
  readonly cuando: Date | null;
  readonly cerrada: boolean;
}

/**
 * Una nota médica de la atención.
 *
 * `filas` son los apartados que el profesional escribió, ya elegidos por quien
 * monta la línea: el organismo no sabe cuáles existen ni cuál falta.
 */
export interface TimelineNote {
  readonly id: string;
  /** «Nota #a1b2»: un nombre corto y estable, nunca el identificador entero. */
  readonly rotulo: string;
  readonly cuando: Date | null;
  readonly filas: readonly Hecho[];
}

/** Una orden de estudio pedida en la atención. */
export interface TimelineOrder {
  readonly id: string;
  /** «Hemograma». */
  readonly estudio: string;
  /** «Análisis de laboratorio», del catálogo. Vacío si el registro no la trae. */
  readonly categoria: string;
  /** El estado en palabras: «Pedida», «Cumplida». */
  readonly estado: string;
  readonly cuando: Date | null;
  /**
   * Hay un informe **liberado** que esta persona puede leer.
   *
   * Lo decide el servidor, no la pantalla: que exista un informe no quiere
   * decir que esté validado ni que corresponda mostrarlo.
   */
  readonly resultadoDisponible: boolean;
}

/** Un diagnóstico registrado en la atención. */
export interface TimelineCondition {
  readonly id: string;
  /** «Hipertensión». */
  readonly nombre: string;
  /** «Diagnóstico confirmado» / «En estudio» / «Descartado», del catálogo. */
  readonly estado: string;
  readonly tono: Tone;
  /** «activa hasta 24/11», «crónica», «resuelta el 03/09». `null` si no consta. */
  readonly detalle: string | null;
  readonly cuando: Date | null;
}

/**
 * La reconsulta agendada a partir de esta atención.
 *
 * Es un solo hecho y no una lista: una atención deriva en una reconsulta o en
 * ninguna. Si algún día derivara en varias, el tipo cambia — inventar el plural
 * ahora sería declarar una regla que el modelo no declara.
 */
export interface TimelineFollowUp {
  readonly id: string;
  readonly cuando: Date | null;
  /** Con quién, si la reserva lo expone. `null` no es «con nadie». */
  readonly profesional: string | null;
  readonly estado: string;
}

/** Una receta emitida en la atención. */
export interface TimelinePrescription {
  readonly id: string;
  readonly medicamento: string;
  /** «por Hipertensión»: el diagnóstico o el motivo que la justifica. */
  readonly indicacion: string | null;
  /** «10 mg · una vez al día». */
  readonly detalle: string | null;
  readonly cuando: Date | null;
}

/**
 * Un hecho de la línea, ya normalizado.
 *
 * Es lo que el organismo dibuja: los cinco tipos entran con formas distintas
 * —una nota tiene apartados, una orden tiene estado— y salen como una sola
 * cosa que se puede ordenar por tiempo. Se exporta porque su spec lo mira.
 */
export interface HechoDeLaLinea {
  readonly id: string;
  readonly tipo: TipoDeHecho;
  /** La frase que encabeza el hecho: «Diagnóstico confirmado: Hipertensión». */
  readonly titulo: string;
  /** El matiz, cuando lo hay: «activa hasta 24/11». */
  readonly detalle: string | null;
  /** El sello, cuando el hecho tiene estado propio. */
  readonly sello: string | null;
  readonly tono: Tone;
  readonly cuando: Date | null;
  /** Los pares campo → valor del hecho. Vacío = el hecho se cuenta en su título. */
  readonly hechos: readonly Hecho[];
}
