import type { ErrorGroup, ErrorGroupState } from '@core/data-access/observability/observability.types';
import { NO_DATA } from '@core/data-access/reporting/reporting-format';
import { fechaHora, textoEntero } from './obs-format';

export type Tono = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** El estado de un grupo, dicho con palabra (el color sólo refuerza). */
export const ESTADO_GRUPO: Readonly<Record<ErrorGroupState, { readonly texto: string; readonly tono: Tono; readonly glifo: string }>> = {
  NEW: { texto: 'Nuevo', tono: 'error', glifo: '●' },
  SEEN: { texto: 'Visto', tono: 'warning', glifo: '◐' },
  RESOLVED: { texto: 'Resuelto', tono: 'success', glifo: '✔' },
  IGNORED: { texto: 'Ignorado', tono: 'neutral', glifo: '–' },
};

export interface FilaGrupo {
  readonly id: string;
  readonly titulo: string;
  readonly codigo: string;
  readonly estado: ErrorGroupState;
  readonly modulo: string;
  readonly ocurrencias: string;
  readonly ultimas24h: string;
  readonly ultimo: string;
  readonly requestId: string | null;
}

export function filaDeGrupo(g: ErrorGroup, zona: string): FilaGrupo {
  return {
    id: g.id,
    titulo: g.title,
    codigo: g.httpStatus === null ? g.code : `${g.httpStatus} · ${g.code}`,
    estado: g.state,
    modulo: g.moduleCode,
    ocurrencias: textoEntero(g.occurrencesTotal),
    ultimas24h: textoEntero(g.occurrences24h),
    ultimo: fechaHora(g.lastSeenAt, zona),
    requestId: g.lastRequestId,
  };
}

/** Transiciones que se ofrecen desde un estado: cualquiera menos el actual. Resolver o ignorar pide motivo. */
export function estadosElegibles(actual: ErrorGroupState): readonly ErrorGroupState[] {
  return (['NEW', 'SEEN', 'RESOLVED', 'IGNORED'] as const).filter((e) => e !== actual);
}

export function pideMotivo(destino: ErrorGroupState): boolean {
  return destino === 'RESOLVED' || destino === 'IGNORED';
}

/** El motivo de un cambio de estado es válido si no se exige, o si trae al menos 3 caracteres útiles (igual que la API). */
export function motivoValido(destino: ErrorGroupState, nota: string): boolean {
  return !pideMotivo(destino) || nota.trim().length >= 3;
}

/** «Personas afectadas»: `null` ≠ 0; si no se mide dice por qué. */
export function textoAfectados(g: Pick<ErrorGroup, 'affectedActors24h' | 'affectedActors24hReason'>): string {
  if (g.affectedActors24h !== null) return textoEntero(g.affectedActors24h);
  return g.affectedActors24hReason === 'MUESTRA_INSUFICIENTE'
    ? 'Muestra insuficiente'
    : g.affectedActors24hReason === 'ACTOR_HASH_NOT_AVAILABLE'
      ? 'No se mide'
      : NO_DATA;
}
