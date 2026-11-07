/* ============================================================================
    What the chart's new readings share: the record types (the filter and the
    unified table), the interval between two dates and a node's path.

    The network by episodes lives in `red-clinica.model.ts` (grouping) and
    `red-clinica.geometria.ts` (where each thing goes). The per-type lane
    geometry that used to live here was replaced by that network (ADR-0021).
    ========================================================================== */

import type { Tone } from '../../../../shared/components/tone/tone.types';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';
import { diasClinicosEntre } from './dia-clinico';

/**
 * The record types, in the order an encounter is **reasoned**: attend,
 * observe, diagnose, treat, leave a record. It is the lanes' order from top
 * to bottom, so the connections go down.
 */
export const TIPOS_DEL_RECORRIDO = [
  'encuentros',
  'internaciones',
  'observaciones',
  'diagnosticos',
  'medicacion',
  'planes',
  'notas',
  'documentos',
] as const;

export type TipoDelRecorrido = (typeof TIPOS_DEL_RECORRIDO)[number];

/** How each type is presented. Tone never goes alone: it carries icon and name. */
export interface AspectoDelTipo {
  readonly singular: string;
  readonly plural: string;
  readonly tono: Tone | 'neutral';
  readonly icono: NavIconName;
}

export const ASPECTO_DEL_TIPO: Readonly<Record<TipoDelRecorrido, AspectoDelTipo>> = {
  encuentros: { singular: 'Atención', plural: 'Atenciones', tono: 'primary', icono: 'stethoscope' },
  internaciones: {
    singular: 'Internación',
    plural: 'Internaciones',
    tono: 'warning',
    icono: 'hospital',
  },
  observaciones: {
    singular: 'Observación',
    plural: 'Observaciones',
    tono: 'info',
    icono: 'flask',
  },
  diagnosticos: { singular: 'Diagnóstico', plural: 'Diagnósticos', tono: 'error', icono: 'heart' },
  medicacion: { singular: 'Medicación', plural: 'Medicación', tono: 'success', icono: 'pill' },
  planes: {
    singular: 'Plan de cuidados',
    plural: 'Planes de cuidados',
    tono: 'secondary',
    icono: 'clipboard',
  },
  notas: { singular: 'Nota clínica', plural: 'Notas', tono: 'neutral', icono: 'note' },
  documentos: { singular: 'Documento', plural: 'Documentos', tono: 'neutral', icono: 'folder' },
};

/**
 * How much time passed between two dates, as the clinician would say it.
 *
 * Rounds towards the readable —«3 meses», not «94 días»—: the interval guides
 * the reading of the journey, it does not replace the date in the header.
 */
export function describirIntervalo(antes: Date, despues: Date): string {
  // Clinical calendar days (`dia-clinico.ts`), not 24 h spans: two columns on
  // the same clinical day are never «1 día» apart, nor two different days «el mismo día».
  const dias = diasClinicosEntre(antes, despues);
  if (dias <= 0) {
    return 'el mismo día';
  }
  if (dias === 1) {
    return '1 día';
  }
  if (dias < 14) {
    return `${dias} días`;
  }
  if (dias < 60) {
    return `${Math.round(dias / 7)} semanas`;
  }
  if (dias < 365) {
    return `${Math.round(dias / 30)} meses`;
  }
  const anios = Math.round((dias / 365) * 10) / 10;
  return anios === 1 ? '1 año' : `${String(anios).replace('.', ',')} años`;
}

/** The minimum of an edge to walk paths. `clave`, if present, rules. */
export interface AristaConectable {
  readonly desde: string;
  readonly hasta: string;
  readonly motivo: string;
  readonly clave?: string;
}

/**
 * What is connected to a node: what originated it and what was decided from it.
 *
 * Walks backwards (where it comes from) and forwards (what it led to)
 * separately. Joining them in an undirected graph would light up the siblings
 * —the other prescriptions of the same visit— that have nothing to do with the node.
 */
export function conectadosA(
  id: string,
  aristas: readonly AristaConectable[],
): { readonly nodos: ReadonlySet<string>; readonly aristas: ReadonlySet<string> } {
  const nodos = new Set<string>([id]);
  const claves = new Set<string>();
  const clave = (a: AristaConectable): string => a.clave ?? `${a.motivo}:${a.desde}>${a.hasta}`;

  const recorrer = (inicio: string, haciaAdelante: boolean): void => {
    const pendientes = [inicio];
    const vistos = new Set<string>([inicio]);
    while (pendientes.length > 0) {
      const actual = pendientes.pop() as string;
      for (const arista of aristas) {
        const origen = haciaAdelante ? arista.desde : arista.hasta;
        const destino = haciaAdelante ? arista.hasta : arista.desde;
        if (origen === actual) {
          claves.add(clave(arista));
          nodos.add(destino);
          if (!vistos.has(destino)) {
            vistos.add(destino);
            pendientes.push(destino);
          }
        }
      }
    }
  };
  recorrer(id, true);
  recorrer(id, false);
  return { nodos, aristas: claves };
}
