import type { FlowNode } from '../../../../core/data-access/admin-portal/flows.types';

/** Una llamada a la API de un flujo que el contrato declara y que se puede cruzar con el inventario. */
export interface DeclaredCall {
  readonly nodeId: string;
  readonly step: string;
  readonly method: string;
  readonly path: string;
  readonly operationId: string;
}

/** Un paso que llama a la API pero no se puede cruzar, y por qué. */
export interface UncrossableStep {
  readonly nodeId: string;
  readonly step: string;
  readonly reason: string;
}

export interface FlowOperationPlan {
  readonly calls: readonly DeclaredCall[];
  readonly uncrossable: readonly UncrossableStep[];
  /** Identificadores distintos a pedir al inventario (dos pasos pueden llamar a la misma operación). */
  readonly operationIds: readonly string[];
}

/**
 * Qué pasos de un flujo se cruzan con `getOperation()` y cuáles no.
 *
 * Se cruza sólo un paso `API_CALL` cuyo endpoint el contrato declara
 * (`DECLARED`) y trae `operationId`. El `operationId` del catálogo de flujos lo
 * calcula la API como `<Controlador>_<handler>` (`RouteIndexService`) y el `id`
 * del inventario es el mismo (`inventario/endpoints/*.json`); se comprobó para
 * los 22 pasos de los 3 flujos del catálogo. Un id con sufijo de alias
 * (`Controlador_handler[1]`) no coincidiría: ese caso se ve como «no está en el
 * inventario», no se corrige a mano.
 */
export function planFlowOperations(nodes: readonly FlowNode[]): FlowOperationPlan {
  const calls: DeclaredCall[] = [];
  const uncrossable: UncrossableStep[] = [];
  for (const node of nodes) {
    if (node.kind !== 'API_CALL') continue;
    const endpoint = node.endpoint;
    if (!endpoint) {
      uncrossable.push({
        nodeId: node.id,
        step: node.title,
        reason: node.gap ?? 'El paso no declara un endpoint.',
      });
    } else if (endpoint.contract !== 'DECLARED' || !endpoint.operationId) {
      uncrossable.push({
        nodeId: node.id,
        step: node.title,
        reason: `${endpoint.method} ${endpoint.path} no existe en el contrato de la API que se está leyendo.`,
      });
    } else {
      calls.push({
        nodeId: node.id,
        step: node.title,
        method: endpoint.method,
        path: endpoint.path,
        operationId: endpoint.operationId,
      });
    }
  }
  return { calls, uncrossable, operationIds: [...new Set(calls.map((c) => c.operationId))] };
}
