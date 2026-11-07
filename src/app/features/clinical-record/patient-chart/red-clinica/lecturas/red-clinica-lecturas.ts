/* ============================================================================
    The four side readings of the clinical network (appointments, referrals,
    studies, procedures), each with its own M34 state, and what the screen may
    say about them.

    Each reading fails on its own. What failed is told apart (ADR-0005): a 403
    is the access scope (S5, no retry fixes it), a 404 is «not available»
    without confirming anything exists (S6), anything else is a failure with a
    retry and, if there is one, the request id (S9). A reading the API cut at
    its cap (`truncated`) is said too. Absences are only asserted over what was
    read in full (`comprobadas`): the alerts must not say «no studies» about
    studies that were not read.
    ========================================================================== */

import { forkJoin, map, of, catchError, type Observable } from 'rxjs';

import type { DentalProcedure, DentalProcedurePage } from '../../../../../core/data-access/procedures/procedures.types';
import type { PatientDiagnostics } from '../../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../../core/data-access/referrals/referrals.types';
import type { Booking, BookingPage } from '../../../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';

export type ClaveDeLectura = 'citas' | 'derivaciones' | 'estudios' | 'procedimientos';

/** The readings the network asks for apart from the chart, each with its state. */
export interface LecturasDeLaRed {
  readonly citas: ViewState<readonly Booking[]>;
  readonly derivaciones: ViewState<readonly Referral[]>;
  readonly estudios: ViewState<PatientDiagnostics>;
  readonly procedimientos: ViewState<readonly DentalProcedure[]>;
  /** Readings the API cut at its cap: more exist than arrived. */
  readonly recortadas: readonly ClaveDeLectura[];
}

/** The pages as the clients return them: `truncated`/`total` are kept. */
export interface FuentesDeLaRed {
  readonly citas: Observable<BookingPage>;
  readonly derivaciones: Observable<readonly Referral[]>;
  readonly estudios: Observable<PatientDiagnostics>;
  readonly procedimientos: Observable<DentalProcedurePage>;
}

/** What the absences of the alerts may rely on: read, and read in full. */
export interface LecturasComprobadas {
  /** Every order arrived (ready, not cut): «no study ordered» can be said. */
  readonly ordenes: boolean;
  /** Every report arrived: «no released result» can be said. */
  readonly informes: boolean;
  readonly derivaciones: boolean;
}

export interface FaltasDeLaRed {
  readonly cargando: boolean;
  /** Every reading resolved (ready or failed): the alerts can be shown. */
  readonly listas: boolean;
  /** Failed (S8/S9/validation): retry offered. */
  readonly faltan: string;
  /** 403: outside the access scope (S5). */
  readonly sinAcceso: string;
  /** 404: not available, without saying whether it exists (S6). */
  readonly noDisponibles: string;
  readonly peticion: string;
  /** Cut at the cap, in words, and the cap. */
  readonly recortadas: string;
  readonly tope: number;
  readonly comprobadas: LecturasComprobadas;
}

const NOMBRES: Readonly<Record<ClaveDeLectura, string>> = {
  citas: 'las citas',
  derivaciones: 'las derivaciones',
  estudios: 'los estudios',
  procedimientos: 'los procedimientos',
};
const CLAVES = Object.keys(NOMBRES) as ClaveDeLectura[];

/** Whether the API cut that block (`orders`, `reports`) or any; an answer without `truncated` cut none. */
function cortado(estudios: PatientDiagnostics | null, bloque?: string): boolean {
  const cortados = estudios?.truncated ?? [];
  return bloque === undefined ? cortados.length > 0 : cortados.includes(bloque);
}

/** All four, loading. */
export function lecturasCargando(): LecturasDeLaRed {
  return { citas: loading(), derivaciones: loading(), estudios: loading(), procedimientos: loading(), recortadas: [] };
}

function leer<T>(fuente: Observable<T>): Observable<ViewState<T>> {
  return fuente.pipe(
    map((dato) => ready(dato) as ViewState<T>),
    catchError((error: unknown) => of(errorToViewState<T>(error))),
  );
}

/** Reads the four on their own and keeps which ones came cut. */
export function leerLasLecturas(fuentes: FuentesDeLaRed): Observable<LecturasDeLaRed> {
  return forkJoin({
    citas: leer(fuentes.citas),
    derivaciones: leer(fuentes.derivaciones),
    estudios: leer(fuentes.estudios),
    procedimientos: leer(fuentes.procedimientos),
  }).pipe(
    map((l) => {
      const citas = dataOf(l.citas);
      const procedimientos = dataOf(l.procedimientos);
      const recortadas: ClaveDeLectura[] = [];
      if (citas?.truncated === true) recortadas.push('citas');
      if (cortado(dataOf(l.estudios))) recortadas.push('estudios');
      if (procedimientos !== null && procedimientos.total > procedimientos.items.length) recortadas.push('procedimientos');
      const items = <T>(estado: ViewState<{ readonly items: readonly T[] }>): ViewState<readonly T[]> =>
        'data' in estado ? { ...estado, data: estado.data.items } : estado;
      return {
        citas: items(l.citas),
        derivaciones: l.derivaciones,
        estudios: l.estudios,
        procedimientos: items(l.procedimientos),
        recortadas,
      };
    }),
  );
}

/** What was read in full, for the absences the alerts assert. `null`: nothing read yet. */
export function lecturasComprobadas(lecturas: LecturasDeLaRed | null): LecturasComprobadas {
  const estudios = lecturas === null ? null : dataOf(lecturas.estudios);
  return {
    ordenes: estudios !== null && !cortado(estudios, 'orders'),
    informes: estudios !== null && !cortado(estudios, 'reports'),
    derivaciones: lecturas !== null && lecturas.derivaciones.status === 'ready',
  };
}

/** What is missing from the network, in words, apart by kind (S5 ≠ S6 ≠ S9). */
export function faltasDeLasLecturas(lecturas: LecturasDeLaRed | null, tope: number): FaltasDeLaRed {
  const comprobadas = lecturasComprobadas(lecturas);
  if (lecturas === null) {
    return { cargando: false, listas: false, faltan: '', sinAcceso: '', noDisponibles: '', peticion: '', recortadas: '', tope, comprobadas };
  }
  const con = (pred: (estado: ViewState<unknown>) => boolean) => CLAVES.filter((k) => pred(lecturas[k]));
  const enPalabras = (claves: readonly ClaveDeLectura[]) => claves.map((k) => NOMBRES[k]).join(', ');
  const fallidas = con((e) => !['ready', 'loading', 'forbidden', 'not-found'].includes(e.status));
  const peticion = fallidas
    .map((k) => lecturas[k])
    .map((estado) => (estado.status === 'error' ? estado.requestId : ''))
    .find((id) => id !== '' && id !== 'sin-id');
  const cargando = con((e) => e.status === 'loading').length > 0;
  return {
    cargando,
    listas: !cargando,
    faltan: enPalabras(fallidas),
    sinAcceso: enPalabras(con((e) => e.status === 'forbidden')),
    noDisponibles: enPalabras(con((e) => e.status === 'not-found')),
    peticion: peticion ?? '',
    recortadas: enPalabras(lecturas.recortadas),
    tope,
    comprobadas,
  };
}
