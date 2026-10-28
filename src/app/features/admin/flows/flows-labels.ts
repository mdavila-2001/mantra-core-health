import type {
  BranchQaCase,
  EndpointContract,
  FlowBranchKind,
  FlowNodeKind,
} from '../../../core/data-access/admin-portal/flows.types';
import { conceptStatus, type Rotulo } from '../platform/platform-labels';

/* ============================================================================
    Rótulos del catálogo de flujos. Traducen los códigos de la API a texto y a
    tono; un código que no está acá se muestra tal cual, sin inventarle
    significado.
    ========================================================================== */

export const NODE_KIND: Readonly<Record<FlowNodeKind, Rotulo>> = {
  SCREEN: { label: 'Pantalla', tone: 'info' },
  API_CALL: { label: 'Llamada a la API', tone: 'primary' },
  DECISION: { label: 'Decisión', tone: 'warning' },
  OUTCOME: { label: 'Resultado', tone: 'success' },
};

/** Mismo vocabulario que `qa_lab`: HAPPY_PATH = válido, EDGE = límite, NEGATIVE = inválido. */
export const BRANCH_KIND: Readonly<Record<FlowBranchKind, Rotulo>> = {
  HAPPY_PATH: { label: 'Válido', tone: 'success' },
  EDGE: { label: 'Límite', tone: 'warning' },
  NEGATIVE: { label: 'Inválido', tone: 'error' },
};

export const CONTRACT: Readonly<Record<EndpointContract, Rotulo>> = {
  DECLARED: { label: 'En el contrato', tone: 'success' },
  MISSING: { label: 'No existe en el contrato', tone: 'warning' },
};

export const NODE_KIND_ORDER: readonly FlowNodeKind[] = ['SCREEN', 'API_CALL', 'DECISION', 'OUTCOME'];

/** Qué se sabe de un caso de prueba: no sembrado, desactualizado, sin correr o su último veredicto. */
export function veredicto(caso: BranchQaCase): Rotulo & { readonly detail: string | null } {
  if (!caso.seeded) return { label: 'No sembrado', tone: 'secondary', detail: 'La suite no tiene este caso activo en el QA Lab.' };
  if (caso.drifted) {
    return { label: 'Desactualizado', tone: 'warning', detail: 'Lo sembrado ya no coincide con el artefacto: hay que volver a sembrar.' };
  }
  const r = caso.lastResult;
  if (!r) return { label: 'Sin correr', tone: 'secondary', detail: null };
  const base = conceptStatus(r.status);
  const observado = r.observedStatus === null ? '' : ` · devolvió ${r.observedStatus}`;
  return { label: `${base.label}${observado}`, tone: base.tone, detail: r.message };
}
