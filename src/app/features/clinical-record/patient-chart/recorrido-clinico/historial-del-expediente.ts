/* ============================================================================
    Del contrato a las dos lecturas nuevas del expediente: qué vínculos
    respalda cada registro y cómo se ordena la tabla unificada.

    Funciones puras y fuera de `patient-chart.ts` por dos razones: el
    componente ya es largo, y esto es exactamente lo que más importa probar —
    que el recorrido no dibuje ningún vínculo que el contrato no guarde—.
    ========================================================================== */

import type { SortState } from '../../../../shared/components/organisms/data-table/data-table.types';
import { TIPOS_DEL_RECORRIDO, type AristaDelRecorrido, type TipoDelRecorrido } from './recorrido-clinico.model';

/**
 * Lo mínimo que hace falta de las dos lecturas (`clinical` y `chart`). Tipos
 * estructurales y no los del contrato: así las pruebas no fabrican un resumen
 * clínico entero para probar una arista.
 */
export interface FuenteDelHistorial {
  readonly encounters: readonly { readonly id: string }[];
  readonly conditions: readonly { readonly id: string; readonly encounterId?: string }[];
  readonly medicationRequests: readonly {
    readonly id: string;
    readonly encounterId?: string;
    readonly indicationConditionId?: string;
  }[];
  readonly observations: readonly { readonly id: string; readonly encounterId?: string }[];
  readonly notes: readonly { readonly noteId: string; readonly encounterId?: string }[];
}

/**
 * La atención que **declara** cada registro, por id de registro.
 *
 * Sólo los cuatro bloques cuyo contrato la guarda. Alergias, internaciones,
 * planes y documentos no la traen, y suponérsela sería inventar el vínculo.
 *
 * Se devuelve aunque la atención no haya llegado en esta lectura (quedó fuera
 * del tope): el registro igual se hizo en una consulta, y el recorrido no debe
 * rotularlo «sin atención». Para trazar una línea, en cambio, hace falta que
 * la atención esté: eso lo decide {@link aristasDelHistorial}.
 */
export function atencionDeCadaRegistro(fuente: FuenteDelHistorial): ReadonlyMap<string, string> {
  const mapa = new Map<string, string>();
  const anotar = (id: string, encounterId: string | undefined): void => {
    if (encounterId !== undefined && encounterId !== '') {
      mapa.set(id, encounterId);
    }
  };
  fuente.conditions.forEach((fila) => anotar(fila.id, fila.encounterId));
  fuente.medicationRequests.forEach((fila) => anotar(fila.id, fila.encounterId));
  fuente.observations.forEach((fila) => anotar(fila.id, fila.encounterId));
  fuente.notes.forEach((fila) => anotar(fila.noteId, fila.encounterId));
  return mapa;
}

/**
 * Las conexiones del recorrido: las dos que el contrato respalda, y sólo
 * cuando sus **dos** extremos llegaron en esta lectura.
 *
 * - atención → registro, por `encounterId`;
 * - diagnóstico → receta, por `indicationConditionId`.
 *
 * Una receta con el motivo escrito a mano (`indicationText`) no se conecta:
 * no apunta a ningún diagnóstico registrado.
 */
export function aristasDelHistorial(fuente: FuenteDelHistorial): readonly AristaDelRecorrido[] {
  const atenciones = new Set(fuente.encounters.map((e) => e.id));
  const diagnosticos = new Set(fuente.conditions.map((c) => c.id));
  const aristas: AristaDelRecorrido[] = [];
  for (const [id, atencion] of atencionDeCadaRegistro(fuente)) {
    if (atenciones.has(atencion)) {
      aristas.push({ desde: atencion, hasta: id, motivo: 'atencion' });
    }
  }
  for (const receta of fuente.medicationRequests) {
    const diagnostico = receta.indicationConditionId;
    if (diagnostico !== undefined && diagnosticos.has(diagnostico)) {
      aristas.push({ desde: diagnostico, hasta: receta.id, motivo: 'indicacion' });
    }
  }
  return aristas;
}

/** Lo que el orden de la tabla unificada necesita de cada fila. */
export interface FilaOrdenable {
  readonly tipo: TipoDelRecorrido;
  readonly principal: string;
  readonly cuando: Date | null;
}

/**
 * El comparador de la tabla unificada.
 *
 * - Por fecha: lo que no tiene fecha va **siempre** al final, en los dos
 *   sentidos —no es ni lo más viejo ni lo más nuevo—.
 * - Por tipo: en el orden del recorrido y, dentro de cada tipo, lo más
 *   reciente primero.
 * - Por registro: alfabético en castellano.
 */
export function compararFilas<Fila extends FilaOrdenable>(
  orden: SortState,
): (a: Fila, b: Fila) => number {
  const signo = orden.direction === 'asc' ? 1 : -1;
  const porFechaSinNulos = (a: Fila, b: Fila, sentido: number): number => {
    if (a.cuando === null) return b.cuando === null ? 0 : 1;
    if (b.cuando === null) return -1;
    return sentido * (a.cuando.getTime() - b.cuando.getTime());
  };
  if (orden.key === 'tipo') {
    return (a, b) =>
      signo * (TIPOS_DEL_RECORRIDO.indexOf(a.tipo) - TIPOS_DEL_RECORRIDO.indexOf(b.tipo)) ||
      porFechaSinNulos(a, b, -1);
  }
  if (orden.key === 'principal') {
    return (a, b) => signo * a.principal.localeCompare(b.principal, 'es');
  }
  return (a, b) => porFechaSinNulos(a, b, signo);
}
