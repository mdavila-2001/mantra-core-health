/* ============================================================================
    The guided tour (Strip 4, ADR-0022) over the Tour's network.

    Pure functions, no Angular: what the tour narrates (the same reads that
    already draw the network, requesting nothing else), what the network draws
    at each step (what is revealed, crossed with the filters) and which
    episode to follow.
    ========================================================================== */

import type { ClinicalSummary } from '../../../../../core/data-access/clinical/clinical.types';
import type { PatientDiagnostics } from '../../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../../../core/data-access/scheduling/scheduling.types';
import type { EpisodioClinico, RedPorEpisodios } from '../../recorrido-clinico/red-clinica.episodio';
import type {
  LectorDelRecorrido,
  RegistrosDelRecorrido,
} from '../../recorrido-guiado/recorrido-guiado.model';

/** What the guided tour needs to build its steps. */
export interface GuiaDeLaRed {
  readonly registros: RegistrosDelRecorrido;
  readonly lector: LectorDelRecorrido;
  /** The reference for «tiene» / «tenía agendada». */
  readonly ahora: Date;
}

/** The chart reads already on screen. `null`: it did not arrive. */
export interface FuenteDeLaGuia {
  readonly resumen: Pick<ClinicalSummary, 'encounters' | 'conditions' | 'medicationRequests' | 'careEpisodes'>;
  readonly citas: readonly Booking[] | null;
  readonly derivaciones: readonly Referral[] | null;
  readonly estudios: Pick<PatientDiagnostics, 'orders' | 'reports'> | null;
}

/** Who is looking, if a practitioner: the only practitioner name the chart knows. */
export interface ProfesionalQueMira {
  readonly profileId: string;
  readonly displayName?: string;
}

/**
 * From the chart to the guided tour's contract.
 *
 * - The records are the same the network draws: the clinical summary and the
 *   network's own reads (appointments, referrals, studies). The procedures
 *   the network reads are dental (`DentalProcedure`), not the surgeries
 *   (`SurgicalCase`) the tour narrates: they are not passed.
 * - `profesional` only names who is looking (their own profile): no chart
 *   read brings another practitioner's name.
 * - `servicioDeAtencion` is not passed: the encounter brings neither service
 *   nor specialty, and taking it from the same-day appointment would assert
 *   what the network only infers. The tour says «Tuvo una atención (…)».
 */
export function guiaDelExpediente(
  fuente: FuenteDeLaGuia,
  etiquetaDe: (conceptId: string) => { readonly display?: string; readonly code?: string } | undefined,
  quienMira: ProfesionalQueMira | null,
  ahora: Date,
): GuiaDeLaRed {
  const de = (id: string | undefined) => (id === undefined || id === '' ? undefined : etiquetaDe(id));
  return {
    registros: {
      atenciones: fuente.resumen.encounters,
      diagnosticos: fuente.resumen.conditions,
      recetas: fuente.resumen.medicationRequests,
      internaciones: fuente.resumen.careEpisodes,
      citas: fuente.citas ?? [],
      derivaciones: fuente.derivaciones ?? [],
      ordenes: fuente.estudios?.orders ?? [],
      informes: fuente.estudios?.reports ?? [],
    },
    lector: {
      etiqueta: (id) => de(id)?.display,
      codigo: (id) => de(id)?.code,
      profesional: (id) =>
        quienMira !== null && id !== undefined && id === quienMira.profileId ? quienMira.displayName : undefined,
    },
    ahora,
  };
}

/**
 * An id no record has. For the network, empty `visibles` is «all»: when a
 * step reveals nothing the filters let through, this is passed.
 */
export const NINGUNO_VISIBLE = 'recorrido-guiado:ninguno';

/**
 * What the network draws at a step: what is revealed up to that step **and**
 * what the filters let through (`filtrados`, empty = all), only among the
 * records the network has. Never empty: if nothing is left, `[NINGUNO_VISIBLE]`.
 */
export function visiblesDelPaso(
  revelados: readonly string[],
  filtrados: readonly string[],
  presentes: ReadonlySet<string>,
): readonly string[] {
  const filtro = filtrados.length === 0 ? null : new Set(filtrados);
  const quedan = [...new Set(revelados)].filter((id) => presentes.has(id) && (filtro === null || filtro.has(id)));
  return quedan.length === 0 ? [NINGUNO_VISIBLE] : quedan;
}

/** The ids touching an episode: what is passed to the tour to follow it. */
export function idsDelEpisodio(episodio: EpisodioClinico): readonly string[] {
  return [...episodio.miembros, ...episodio.compartidos];
}

/**
 * The episode offered to follow on opening the tour: the panel's open node's
 * or, if none, the «Solo el hilo de este diagnóstico» filter's. The «Sin
 * diagnóstico asociado» thread is not a problem to follow.
 */
export function episodioPropuesto(
  red: RedPorEpisodios,
  criterio: { readonly seleccionado: string | null; readonly hiloDeDiagnosticoId: string | null },
): EpisodioClinico | null {
  const problemas = red.episodios.filter((e) => e.clase === 'problema');
  const delNodo = criterio.seleccionado === null ? undefined : red.episodioDe.get(criterio.seleccionado);
  const elegido = problemas.find((e) => e.id === delNodo);
  if (elegido !== undefined) return elegido;
  const hilo = criterio.hiloDeDiagnosticoId;
  return hilo === null ? null : (problemas.find((e) => e.diagnosticos.includes(hilo)) ?? null);
}
