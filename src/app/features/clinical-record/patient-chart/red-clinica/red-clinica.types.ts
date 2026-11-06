/* ============================================================================
    The patient's clinical network — strip 3's input contract: the nodes and
    their detail (the links live in `red-clinica-vinculos.types.ts`).

    These types are the **stable interface** between whoever builds the network
    (strip 2: `recorrido-clinico/**`, which reads the chart and places the
    nodes) and the three pieces of this folder: the detail panel, the filter
    bar and the support alerts. They are deliberately simple —text already
    translated, dates already converted, ids already resolved— so adapting is
    mechanical:

    - no `*ConceptId`: whoever builds the network already resolved terminology;
    - no API DTO: the panel knows nothing of `Condition` or `Referral`;
    - a node's id is the id of the record it stands for (condition, order,
      referral, encounter, appointment…). The alerts assume it by default, and
      it can be changed with `idDeNodo` (see `red-clinica-alertas.types.ts`).

    What is NOT here: geometry. Where a node is drawn is the map's business.
    ========================================================================== */

import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';
import type { Tone } from '../../../../shared/components/tone/tone.types';

/* -- The nodes --------------------------------------------------------------- */

/**
 * What kind of record a node is. The order is the filter chips': that of a
 * story told — it is booked, attended, thought through, studied, referred,
 * treated.
 */
export const TIPOS_DE_NODO = [
  'cita',
  'reconsulta',
  'atencion',
  'diagnostico',
  'estudio',
  'derivacion',
  'medicacion',
  'procedimiento',
  'plan',
  'observacion',
  'internacion',
  'nota',
  'documento',
] as const;

export type TipoDeNodo = (typeof TIPOS_DE_NODO)[number];

export interface AspectoDeTipo {
  readonly singular: string;
  readonly plural: string;
  readonly icono: NavIconName;
}

/** Each type's name and icon. The type is never conveyed by color alone. */
export const ASPECTO_DE_TIPO: Readonly<Record<TipoDeNodo, AspectoDeTipo>> = {
  cita: { singular: 'Cita', plural: 'Citas', icono: 'calendar' },
  reconsulta: { singular: 'Reconsulta', plural: 'Reconsultas', icono: 'history' },
  atencion: { singular: 'Atención', plural: 'Atenciones', icono: 'stethoscope' },
  diagnostico: { singular: 'Diagnóstico', plural: 'Diagnósticos', icono: 'heart' },
  estudio: { singular: 'Estudio', plural: 'Estudios', icono: 'flask' },
  derivacion: { singular: 'Derivación', plural: 'Derivaciones', icono: 'route' },
  medicacion: { singular: 'Medicación', plural: 'Medicación', icono: 'pill' },
  procedimiento: { singular: 'Procedimiento', plural: 'Procedimientos', icono: 'scalpel' },
  plan: { singular: 'Plan de cuidados', plural: 'Planes de cuidados', icono: 'clipboard' },
  observacion: { singular: 'Observación', plural: 'Observaciones', icono: 'chart' },
  internacion: { singular: 'Internación', plural: 'Internaciones', icono: 'hospital' },
  nota: { singular: 'Nota clínica', plural: 'Notas', icono: 'note' },
  documento: { singular: 'Documento', plural: 'Documentos', icono: 'folder' },
};

/** A person or a specialty: a stable id to filter, a name to read. */
export interface Referencia {
  readonly id: string;
  readonly nombre: string;
}

/** The record's status as it reads in the chart. */
export interface EstadoDeNodo {
  readonly etiqueta: string;
  /** Same tone as in the block's table; never alone, always with the label. */
  readonly tono?: Tone;
}

/**
 * A network node: the minimum to filter it, name it and open its panel.
 *
 * `detalle` is optional: without it the panel shows the header (what, when,
 * who, status) and the links, which is already useful.
 */
export interface NodoDeRed {
  readonly id: string;
  readonly tipo: TipoDeNodo;
  /** What it is: «Hipertensión arterial esencial», «Hemograma completo». */
  readonly titulo: string;
  /** A line of context: «Ambulatorio · Sede Centro». */
  readonly subtitulo?: string;
  /** When it happened or was recorded. `null` if the contract does not bring it. */
  readonly cuando: Date | null;
  /** Who: the practitioner who attended, ordered, diagnosed or referred. */
  readonly profesional?: Referencia | null;
  readonly especialidad?: Referencia | null;
  readonly estado?: EstadoDeNodo | null;
  /** Extra text for the search (reason, codes); not shown. */
  readonly buscable?: string;
  readonly detalle?: DetalleDeNodo;
}

/* -- Each type's analysis ------------------------------------------------------ */

export type DetalleDeNodo =
  | DetalleDeEstudio
  | DetalleDeDiagnostico
  | DetalleDeDerivacion
  | DetalleDeCita
  | DetalleGeneral;

/**
 * How the lab read a value. If present, it rules over the comparison with the
 * range (the lab may use age or sex ranges that are not here).
 */
export type InterpretacionDeValor = 'normal' | 'bajo' | 'alto' | 'critico-bajo' | 'critico-alto' | 'critico' | 'anormal';

export interface RangoDeReferencia {
  readonly bajo?: number;
  readonly alto?: number;
  /** The range as the report prints it, if not numeric: «Negativo». */
  readonly texto?: string;
}

/** A value of a released result. */
export interface ValorDeResultado {
  readonly nombre: string;
  /** The value's number or text; a text is not compared with the range. */
  readonly valor: number | string;
  readonly unidad?: string;
  readonly rango?: RangoDeReferencia;
  readonly interpretacion?: InterpretacionDeValor;
  /**
   * The lab's own label («Alto», «Anormal»), shown as text. What decides
   * «out of range» is `interpretacion`, mapped from the HL7 v3 code
   * (`interpretacionDelCodigo`); without a code, the number vs. the range.
   */
  readonly interpretacionDelInforme?: string;
}

/** A report file: what is opened or downloaded. */
export interface ArchivoDeInforme {
  /** The file, downloaded through the report's route (`…/reports/:reportId/files/:fileId/content`). */
  readonly fileId: string;
  readonly nombre: string;
}

/** The **released** result. A draft never gets here. */
export interface ResultadoDeEstudio {
  /**
   * When it was released. `null` when the contract says there is a released
   * version but not when (the practitioner read,
   * `GET /diagnostics/patients/:id/orders`, publishes `currentReleasedVersionId`
   * and not the date): the panel says «Liberado» without making up the day.
   */
  readonly liberadoEn: Date | null;
  readonly conclusion?: string;
  readonly valores: readonly ValorDeResultado[];
  readonly archivos: readonly ArchivoDeInforme[];
  /**
   * The released report. With it (and the patient, which the panel receives
   * separately) the panel reads values, conclusion and files through
   * `GET /diagnostics/patients/:id/reports/:reportId` and downloads the files
   * through that same route.
   */
  readonly informeId?: string;
  /** `false`: the report was released without publishing it to the patient. Absent: unknown. */
  readonly publicadoAlPaciente?: boolean;
}

export interface DetalleDeEstudio {
  readonly tipo: 'estudio';
  /** «Laboratorio», «Imagen». */
  readonly categoria?: string;
  readonly prioridad?: string;
  /** Why it was ordered, in text (the order's note). */
  readonly motivo?: string;
  /** `null` = ordered with no released result yet. */
  readonly resultado: ResultadoDeEstudio | null;
}

/** The diagnosis' certainty, in C3's vocabulary. */
export type CertezaDiagnostica = 'presuntivo' | 'confirmado' | 'descartado';

export interface EvidenciaDeDecision {
  readonly tipo: 'nota' | 'analisis';
  /** What reads: «Hemograma del 12/10», «Nota de evolución». */
  readonly etiqueta: string;
  /** If the evidence is in the network, to navigate to it. */
  readonly nodoId?: string;
}

/** C3's decision (P41): who confirmed or ruled out, when and why. */
export interface DecisionDiagnostica {
  readonly resultado: 'confirmado' | 'descartado';
  readonly decididoEn: Date;
  readonly decididoPor?: string | null;
  readonly motivo?: string | null;
  readonly evidencia?: EvidenciaDeDecision | null;
}

export interface DetalleDeDiagnostico {
  readonly tipo: 'diagnostico';
  readonly certeza: CertezaDiagnostica;
  /** Findings and clinical justification (`noteText`). */
  readonly nota?: string;
  readonly decision?: DecisionDiagnostica | null;
  /** The diagnosis that took this one's place (`replacedByConditionId`). */
  readonly reemplazadoPor?: { readonly nodoId: string; readonly etiqueta: string } | null;
  readonly inicio?: Date | null;
}

export interface DetalleDeDerivacion {
  readonly tipo: 'derivacion';
  /** «Interconsulta», «Estudio diagnóstico». */
  readonly tipoDeDerivacion?: string;
  readonly destino?: string;
  readonly motivo?: string;
  readonly resumenClinico?: string;
  readonly respuesta?: {
    readonly decision: 'aceptada' | 'rechazada';
    readonly en?: Date | null;
    readonly motivoDeRechazo?: string | null;
  } | null;
  readonly llegada?: {
    readonly en: Date;
    /** The encounter where the destination received them (`targetEncounterId`). */
    readonly atencionNodoId?: string | null;
    readonly notas?: string | null;
  } | null;
  readonly contrarreferencia?: { readonly texto: string; readonly en?: Date | null } | null;
}

export interface DetalleDeCita {
  readonly tipo: 'cita' | 'reconsulta';
  readonly motivo?: string;
  readonly modalidad?: string;
  readonly lugar?: string;
}

/** Encounter, medication, note, document…: a summary and label/value pairs. */
export interface DetalleGeneral {
  readonly tipo: 'general';
  readonly resumen?: string;
  readonly datos?: readonly { readonly rotulo: string; readonly valor: string }[];
}
