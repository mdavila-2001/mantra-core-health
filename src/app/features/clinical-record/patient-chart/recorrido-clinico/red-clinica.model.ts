/* ============================================================================
    The clinical network by episodes: what happened to the person, problem by
    problem.

    Pure functions, no Angular. They take the chart records already translated
    to the network's own shape ({@link RegistroDeLaRed}) plus their links, and
    decide which episode each one belongs to. This file holds the vocabulary
    (record classes, link reasons); the inferred links live in
    `red-clinica.vinculos.ts`, the grouping in `red-clinica.episodios.ts`, the
    geometry in `red-clinica.geometria.ts` and the step from the contract types
    in `red-clinica.adaptador.ts`.

    The full rule is in `docs/adr/ADR-0021-red-clinica-por-episodios.md`.
    In short:

    1. An **episode** is a clinical problem: a chain of linked diagnoses (the
       same concept recorded again, or a ruled-out one and the one that replaced
       it) plus everything hanging from them.
    2. **Strong** links (prescription → diagnosis, study → diagnosis, result →
       study, prescription → the one that replaced it, plan → diagnosis,
       evidence of a confirmation) pull the record into its diagnosis' episode.
    3. An **encounter** belongs to every episode whose records were entered in
       it; it is drawn once, in the one with most of its records (tie: the one
       that started first) and connects to the others.
    4. Whatever only hangs from an encounter (observations, notes, referrals,
       follow-ups…) goes to the episode where that encounter is drawn.
    5. Whatever hangs from no diagnosis goes to the «Sin diagnóstico asociado»
       thread.
    ========================================================================== */

import type { Tone } from '../../../../shared/components/tone/tone.types';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';

/** The network's record classes, in the order they stack inside a cell. */
export const CLASES_DE_LA_RED = [
  'atencion',
  'cita',
  'internacion',
  'diagnostico',
  'estudio',
  'resultado',
  'procedimiento',
  'medicacion',
  'derivacion',
  'plan',
  'observacion',
  'nota',
  'documento',
] as const;

export type ClaseDeLaRed = (typeof CLASES_DE_LA_RED)[number];

/**
 * The **detail** classes (level 3): with the episode expanded they are grouped
 * behind a «+N» per moment. Everything else is level 2 and shows on expanding.
 */
export const CLASES_DE_DETALLE: ReadonlySet<ClaseDeLaRed> = new Set<ClaseDeLaRed>([
  'plan',
  'observacion',
  'nota',
  'documento',
]);

export interface AspectoDeLaClase {
  readonly singular: string;
  readonly plural: string;
  readonly tono: Tone | 'neutral';
  readonly icono: NavIconName;
}

/** How each class is presented. Tone never goes alone: it carries icon and name. */
export const ASPECTO_DE_LA_CLASE: Readonly<Record<ClaseDeLaRed, AspectoDeLaClase>> = {
  atencion: { singular: 'Atención', plural: 'Atenciones', tono: 'primary', icono: 'stethoscope' },
  cita: { singular: 'Cita', plural: 'Citas', tono: 'primary', icono: 'calendar' },
  internacion: { singular: 'Internación', plural: 'Internaciones', tono: 'warning', icono: 'hospital' },
  diagnostico: { singular: 'Diagnóstico', plural: 'Diagnósticos', tono: 'error', icono: 'heart' },
  estudio: { singular: 'Estudio pedido', plural: 'Estudios', tono: 'info', icono: 'scan' },
  resultado: { singular: 'Resultado', plural: 'Resultados', tono: 'info', icono: 'results' },
  procedimiento: { singular: 'Procedimiento', plural: 'Procedimientos', tono: 'secondary', icono: 'scalpel' },
  medicacion: { singular: 'Medicación', plural: 'Medicación', tono: 'success', icono: 'pill' },
  derivacion: { singular: 'Derivación', plural: 'Derivaciones', tono: 'secondary', icono: 'share' },
  plan: { singular: 'Plan de cuidados', plural: 'Planes de cuidados', tono: 'secondary', icono: 'clipboard' },
  observacion: { singular: 'Observación', plural: 'Observaciones', tono: 'info', icono: 'flask' },
  nota: { singular: 'Nota clínica', plural: 'Notas', tono: 'neutral', icono: 'note' },
  documento: { singular: 'Documento', plural: 'Documentos', tono: 'neutral', icono: 'folder' },
};

/** The certainty of a diagnosis, as C3 decides it. */
export type CertezaDiagnostica = 'presuntivo' | 'confirmado' | 'descartado' | 'historico';

/** A chart record, ready for the network. The `id` is the real record's id. */
export interface RegistroDeLaRed {
  readonly id: string;
  readonly clase: ClaseDeLaRed;
  readonly titulo: string;
  readonly detalle: string;
  readonly estado: string;
  readonly tonoDelEstado?: Tone;
  readonly cuando: Date | null;
  /**
   * The encounter whose column it goes in. It is the contract's (`encounterId`,
   * `sourceEncounterId`) and, for an appointment, the same-day encounter
   * inferred for it: placing is not asserting —the line joining them is marked
   * as inferred—.
   */
  readonly encuentroId?: string;
  /** Diagnoses only. */
  readonly certeza?: CertezaDiagnostica;
  /**
   * Diagnoses only: the concept. Two diagnoses of the same concept are the
   * same problem recorded twice.
   */
  readonly concepto?: string;
}

/**
 * Why two records are joined. Each one names a contract field (see
 * `CONTRATO-RED-CLINICA.md`), except the two `inferido-*`, which the network
 * deduces and draws differently.
 */
export type MotivoDelVinculo =
  /** encounter → record (`encounterId`). */
  | 'registrado-en'
  /** diagnosis → prescription (`indicationConditionId`). */
  | 'indicado-para'
  /** diagnosis → study (`reasonConditionId`). */
  | 'pedido-para'
  /** study → result (the report's `serviceRequestId`). */
  | 'resultado-de'
  /** ruled out → the one that replaced it (`replacedByConditionId`). */
  | 'reemplazado-por'
  /** prescription → the one that replaced it (`replacedByRequestId`). */
  | 'receta-reemplazada'
  /** evidence → diagnosis (`verification.basedOn`). */
  | 'evidencia'
  /** diagnosis → plan (the plan's `conditionId`). */
  | 'plan-para'
  /** encounter → referral (`sourceEncounterId`). */
  | 'derivado-desde'
  /** referral → destination encounter (`targetEncounterId`). */
  | 'recibido-en'
  /** source appointment or encounter → follow-up (`followUpOf`). */
  | 'reconsulta-de'
  /** admission → encounter inside it (the encounter's `episodeId`). */
  | 'durante-internacion'
  /** presumptive → study ordered in the same encounter, without `reasonConditionId`. */
  | 'inferido-misma-atencion'
  /** appointment → same-day encounter, with no stored link. */
  | 'inferido-mismo-dia';

export interface VinculoDeLaRed {
  readonly desde: string;
  readonly hasta: string;
  readonly motivo: MotivoDelVinculo;
}

/** What each reason says, in the legend and in the accessible names. */
export const NOMBRE_DEL_MOTIVO: Readonly<Record<MotivoDelVinculo, string>> = {
  'registrado-en': 'Se registró en esa atención',
  'indicado-para': 'Se indicó para ese diagnóstico',
  'pedido-para': 'Se pidió para ese diagnóstico',
  'resultado-de': 'Resultado del estudio',
  'reemplazado-por': 'Descartado y reemplazado por',
  'receta-reemplazada': 'Receta reemplazada por',
  evidencia: 'Evidencia de la decisión',
  'plan-para': 'Plan para ese diagnóstico',
  'derivado-desde': 'Derivación desde esa atención',
  'recibido-en': 'Recibido por el destino en esa atención',
  'reconsulta-de': 'Reconsulta de',
  'durante-internacion': 'Atención durante la internación',
  'inferido-misma-atencion': 'Inferido: pedido en la misma atención que el presuntivo',
  'inferido-mismo-dia': 'Inferido: cita y atención del mismo día',
};

export function esInferido(motivo: MotivoDelVinculo): boolean {
  return motivo.startsWith('inferido-');
}
