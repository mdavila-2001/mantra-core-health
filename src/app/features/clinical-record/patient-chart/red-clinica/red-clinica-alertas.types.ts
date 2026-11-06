/* ============================================================================
    The support alerts' contract: what goes in (the records as the API sends
    them) and what comes out. The rules live in `red-clinica-alertas.ts` and
    `red-clinica-alertas.pendientes.ts`.
    ========================================================================== */

import type { Condition, Encounter } from '../../../../core/data-access/clinical/clinical.types';
import type {
  DiagnosticOrder,
  DiagnosticReport,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { ResolverCodigo } from '../../../../shared/clinical/diagnosis-state';
import type { PrioridadDeAlerta } from './red-clinica-alertas.plazos';
import type { LecturasComprobadas } from './lecturas/red-clinica-lecturas';
import type { TipoDeNodo, ValorDeResultado } from './red-clinica.types';

/* -- The output contract ---------------------------------------------------- */

export const TIPOS_DE_ALERTA = [
  'resultado-critico',
  'resultado-fuera-de-rango',
  'presuntivo-sin-resolver',
  'estudio-sin-resultado',
  'derivacion-sin-respuesta',
  'derivacion-sin-contrarreferencia',
  'diagnostico-repetido',
  'motivo-repetido',
] as const;

export type TipoDeAlerta = (typeof TIPOS_DE_ALERTA)[number];

export interface AlertaDeApoyo {
  /** Stable across recomputations: `tipo:idDelRegistro`. */
  readonly id: string;
  readonly tipo: TipoDeAlerta;
  readonly prioridad: PrioridadDeAlerta;
  /** One line: what was left open. */
  readonly titulo: string;
  /** The fact backing it: age, how many times, which value. */
  readonly detalle: string;
  /** The node the click leads to. */
  readonly nodoId: string;
  /** Every node the network must highlight (includes `nodoId`). */
  readonly nodoIds: readonly string[];
  /** Days since the fact that triggers it, if applicable. */
  readonly dias?: number;
}

/* -- The input contract ----------------------------------------------------- */

/** A released result with its values, already translated (see `ValorDeResultado`). */
export interface ResultadoParaAlertas {
  /** The study's (or report's) node in the network. */
  readonly nodoId: string;
  readonly estudio: string;
  readonly valores: readonly ValorDeResultado[];
}

export interface Umbrales {
  /** Days after which an unresolved presumptive rises to medium priority. */
  readonly presuntivoDias: number;
  /** Days after which a study without a result rises to medium priority. */
  readonly estudioDias: number;
  /** Days after which an unanswered referral rises to medium priority. */
  readonly derivacionDias: number;
  /** Days since arrival after which the counter-referral is missing. */
  readonly contrarreferenciaDias: number;
  /** How many times a reason has to appear to warn. */
  readonly repeticiones: number;
}

/**
 * The default deadlines. They are a **reference**, not clinical norms: each
 * service may pass its own. Three times the deadline rises to high priority.
 */
export const UMBRALES_POR_OMISION: Umbrales = Object.freeze({
  presuntivoDias: 14,
  estudioDias: 7,
  derivacionDias: 7,
  contrarreferenciaDias: 14,
  repeticiones: 2,
});

export interface EntradaDeAlertas {
  readonly ahora: Date;
  readonly diagnosticos?: readonly Condition[];
  readonly ordenes?: readonly DiagnosticOrder[];
  readonly informes?: readonly DiagnosticReport[];
  readonly derivaciones?: readonly Referral[];
  readonly atenciones?: readonly Encounter[];
  readonly resultados?: readonly ResultadoParaAlertas[];
  /** concept → catalogue code (`TerminologyClient.readConceptLabels`). */
  readonly codigoDe?: ResolverCodigo;
  /** concept → readable name; without it, «Diagnóstico», «Estudio» is said. */
  readonly etiquetaDe?: (conceptId: string | undefined) => string | undefined;
  /** A record's node id. By default, the record's id. */
  readonly idDeNodo?: (tipo: TipoDeNodo, idDelRegistro: string) => string;
  readonly umbrales?: Partial<Umbrales>;
  /**
   * Which side readings arrived whole (`lecturasComprobadas`). Absent: all of
   * them. An alert never asserts an absence over what was not read: no «sin
   * estudios pedidos» without the orders, no «sin resultado» without every report.
   */
  readonly leidas?: LecturasComprobadas;
}
