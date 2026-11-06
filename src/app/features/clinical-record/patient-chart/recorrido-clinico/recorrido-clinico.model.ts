/* ============================================================================
    Lo que comparten las lecturas nuevas del expediente: los tipos de registro
    (el filtro y la tabla unificada), el intervalo entre dos fechas y el camino
    de un nodo.

    La red por episodios vive en `red-clinica.model.ts` (agrupación) y
    `red-clinica.geometria.ts` (dónde va cada cosa). La geometría de carriles
    por tipo que vivía acá se reemplazó por esa red (ADR-0021).
    ========================================================================== */

import type { Tone } from '../../../../shared/components/tone/tone.types';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';

/**
 * Los tipos de registro, en el orden en que se **razona** una atención: se
 * atiende, se observa, se diagnostica, se trata, se deja constancia. Es el
 * orden de los carriles de arriba abajo, así las conexiones bajan.
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

/** Cómo se presenta cada tipo. El tono nunca va solo: lleva ícono y nombre. */
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
 * Cuánto pasó entre dos fechas, como lo diría quien atiende.
 *
 * Redondea hacia lo legible —«3 meses», no «94 días»—: el intervalo orienta la
 * lectura del recorrido, no reemplaza a la fecha, que va en la cabecera.
 */
export function describirIntervalo(antes: Date, despues: Date): string {
  // Días de calendario, no tramos de 24 h: dos columnas con la misma fecha en
  // la cabecera no pueden quedar a «1 día», ni dos fechas distintas al «mismo día».
  const medianoche = (fecha: Date): number =>
    Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const dias = Math.round((medianoche(despues) - medianoche(antes)) / 86_400_000);
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

/** Lo mínimo de una arista para recorrer caminos. `clave`, si la trae, manda. */
export interface AristaConectable {
  readonly desde: string;
  readonly hasta: string;
  readonly motivo: string;
  readonly clave?: string;
}

/**
 * Lo conectado a un nodo: lo que lo originó y lo que se decidió a partir de él.
 *
 * Recorre hacia atrás (de dónde viene) y hacia adelante (qué derivó) por
 * separado. Juntarlos en un grafo sin sentido iluminaría a los hermanos —las
 * otras recetas de la misma consulta— que no tienen nada que ver con el nodo.
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
