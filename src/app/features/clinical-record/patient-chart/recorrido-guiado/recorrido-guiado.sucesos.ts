/* ============================================================================
    Sucesos: cada hecho fechado de la historia que va a ser una frase. Lo
    comparten las plantillas clínicas y las del circuito (citas, derivaciones,
    procedimientos); el armado los agrupa en pasos.
    ========================================================================== */

import type { CareEpisode, Condition, Encounter } from '../../../../core/data-access/clinical/clinical.types';
import type { DiagnosticOrder, DiagnosticReport } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';
import {
  CODIGO_CONFIRMADO,
  CODIGO_DESCARTADO,
  normalizarCodigoDx,
} from '../../../../shared/clinical/diagnosis-state';

import { fechaValida, legible, minusculaInicial } from './recorrido-guiado.texto';
import type { FraseDelPaso, LectorDelRecorrido } from './recorrido-guiado.types';

/* -- Sucesos: un hecho fechado que va a ser una frase ---------------------- */

/** El orden de las frases dentro de un paso: se atiende, se diagnostica, se pide, se trata. */
export const ORDEN = {
  internacion: 0,
  llegada: 1,
  reconsulta: 2,
  atencion: 3,
  diagnostico: 4,
  resultado: 5,
  decision: 6,
  orden: 7,
  receta: 8,
  derivacion: 9,
  procedimiento: 10,
  cita: 11,
  alta: 12,
} as const;

export type ClaseDeSuceso = keyof typeof ORDEN;

export interface Suceso {
  readonly clase: ClaseDeSuceso;
  readonly fecha: Date | null;
  /** La atención (a la vista) en la que ocurrió, si el contrato lo dice. */
  readonly atencionId?: string;
  readonly titulo: string;
  readonly enfocar: readonly string[];
  /** Arma la frase cuando ya se sabe con quién comparte el paso. */
  readonly frase: (contexto: ContextoDelPaso) => FraseDelPaso | null;
  /**
   * Varios sucesos del mismo paso con la misma `clave` se cuentan en una sola
   * frase en plural (tres citas iguales el mismo día no son tres frases).
   */
  readonly plural?: { readonly clave: string; readonly texto: (cuantos: number) => string };
}

export interface ContextoDelPaso {
  /** Atenciones del paso con al menos un diagnóstico propio en el paso. */
  readonly atencionesConDiagnostico: ReadonlySet<string>;
  readonly hayAtencion: boolean;
}

export interface Indices {
  readonly atenciones: ReadonlyMap<string, Encounter>;
  readonly diagnosticos: ReadonlyMap<string, Condition>;
  readonly ordenes: ReadonlyMap<string, DiagnosticOrder>;
  readonly informes: ReadonlyMap<string, DiagnosticReport>;
  readonly citas: ReadonlyMap<string, Booking>;
  readonly internaciones: ReadonlyMap<string, CareEpisode>;
}

export function porId<T extends { readonly id: string }>(lista: readonly T[] | undefined): Map<string, T> {
  return new Map((lista ?? []).map((r) => [r.id, r]));
}

/* -- Nombres legibles ------------------------------------------------------ */

export class Nombres {
  constructor(private readonly lector: LectorDelRecorrido) {}

  concepto(id: string | undefined): string | undefined {
    if (id === undefined) return undefined;
    return legible(this.lector.etiqueta(id));
  }

  diagnostico(c: Condition | undefined): string {
    const nombre = c === undefined ? undefined : this.concepto(c.codeConceptId);
    return nombre === undefined ? 'un diagnóstico sin nombre disponible' : minusculaInicial(nombre);
  }

  estudio(codeConceptId: string | undefined): string {
    const nombre = this.concepto(codeConceptId);
    return nombre === undefined ? 'un estudio sin nombre disponible' : minusculaInicial(nombre);
  }

  medicamento(conceptId: string | undefined): string {
    const nombre = this.concepto(conceptId);
    return nombre === undefined ? 'un medicamento sin nombre disponible' : nombre;
  }

  servicio(a: Encounter): string | undefined {
    return legible(this.lector.servicioDeAtencion?.(a));
  }

  profesional(id: string | undefined): string | undefined {
    return id === undefined ? undefined : legible(this.lector.profesional?.(id));
  }

  /** El resultado de la verificación: primero la decisión de C3, después el código del catálogo. */
  veredicto(c: Condition): 'CONFIRMED' | 'REFUTED' | null {
    if (c.verification?.outcome !== undefined) return c.verification.outcome;
    const codigo = normalizarCodigoDx(this.lector.codigo?.(c.verificationStatusConceptId));
    if (codigo === CODIGO_CONFIRMADO) return 'CONFIRMED';
    if (codigo === CODIGO_DESCARTADO) return 'REFUTED';
    return null;
  }
}

export function fechaDeAtencion(idx: Indices, atencionId: string | undefined): Date | null {
  if (atencionId === undefined) return null;
  return fechaValida(idx.atenciones.get(atencionId)?.startAt);
}

/** La atención a la vista en la que se registró algo, y la fecha que le corresponde. */
export function enAtencion(
  idx: Indices,
  atencionId: string | undefined,
  propia: Date | null,
): { atencionId?: string; fecha: Date | null } {
  if (atencionId !== undefined && idx.atenciones.has(atencionId)) {
    return { atencionId, fecha: fechaDeAtencion(idx, atencionId) ?? propia };
  }
  return { fecha: propia };
}

/* -- Plantillas por tipo --------------------------------------------------- */

export function frase(texto: string, fuentes: readonly string[], inferida = false): FraseDelPaso {
  return { texto, fuentes, inferida };
}
