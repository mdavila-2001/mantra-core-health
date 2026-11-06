/* ============================================================================
    El recorrido guiado (Franja 4, ADR-0022) sobre la red del Recorrido.

    Funciones puras, sin Angular: qué narra el recorrido (las mismas lecturas
    que ya dibujan la red, sin pedir nada más), qué dibuja la red en cada paso
    (lo revelado, cruzado con los filtros) y qué episodio seguir.
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

/** Lo que necesita el recorrido guiado para armar sus pasos. */
export interface GuiaDeLaRed {
  readonly registros: RegistrosDelRecorrido;
  readonly lector: LectorDelRecorrido;
  /** La referencia de «tiene» / «tenía agendada». */
  readonly ahora: Date;
}

/** Las lecturas del expediente que ya están en pantalla. `null`: no llegó. */
export interface FuenteDeLaGuia {
  readonly resumen: Pick<ClinicalSummary, 'encounters' | 'conditions' | 'medicationRequests' | 'careEpisodes'>;
  readonly citas: readonly Booking[] | null;
  readonly derivaciones: readonly Referral[] | null;
  readonly estudios: Pick<PatientDiagnostics, 'orders' | 'reports'> | null;
}

/** Quien mira, si es profesional: el único nombre de profesional que el expediente conoce. */
export interface ProfesionalQueMira {
  readonly profileId: string;
  readonly displayName?: string;
}

/**
 * Del expediente al contrato del recorrido guiado.
 *
 * - Los registros son los mismos que dibuja la red: el resumen clínico y las
 *   lecturas propias de la red (citas, derivaciones, estudios). Los
 *   procedimientos que lee la red son odontológicos (`DentalProcedure`), no
 *   las cirugías (`SurgicalCase`) que narra el recorrido: no se pasan.
 * - `profesional` sólo nombra a quien mira (su perfil propio): ninguna
 *   lectura del expediente trae el nombre de otro profesional.
 * - `servicioDeAtencion` no se pasa: la atención no trae servicio ni
 *   especialidad, y sacarlo de la cita del mismo día sería afirmar lo que la
 *   red sólo infiere. El recorrido dice «Tuvo una atención (…)».
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
 * Un id que ningún registro tiene. Para la red, `visibles` vacío es «todos»:
 * cuando un paso no revela nada que los filtros dejen, se le pasa esto.
 */
export const NINGUNO_VISIBLE = 'recorrido-guiado:ninguno';

/**
 * Lo que dibuja la red en un paso: lo revelado hasta ese paso **y** lo que
 * dejan los filtros (`filtrados`, vacío = todos), sólo entre los registros que
 * la red tiene. Nunca vacío: si no queda nada, `[NINGUNO_VISIBLE]`.
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

/** Los ids que tocan un episodio: lo que se le pasa al recorrido para seguirlo. */
export function idsDelEpisodio(episodio: EpisodioClinico): readonly string[] {
  return [...episodio.miembros, ...episodio.compartidos];
}

/**
 * El episodio que se ofrece seguir al abrir el recorrido: el del nodo abierto
 * en el panel o, si no hay, el del filtro «Solo el hilo de este diagnóstico».
 * El hilo «Sin diagnóstico asociado» no es un problema que seguir.
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
