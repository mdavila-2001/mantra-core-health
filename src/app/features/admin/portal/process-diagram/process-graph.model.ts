import type { Grafo, NodoGrafo, Riesgo } from '../../../../core/data-access/admin-portal/portal.types';

/* ============================================================================
    Del grafo del inventario a carriles legibles.

    El grafo de un proceso trae etapas, operaciones, actores y tablas, unidos
    por aristas `CONTIENE` (etapa → operación), `ACTUA` (actor → operación) y
    `LEE`/`ESCRIBE`/`BORRA` (operación → tabla). Dibujado como red son cientos
    de líneas cruzadas; ordenado por etapa se lee de izquierda a derecha.
    ========================================================================== */

const TABLE_EFFECTS = ['ESCRIBE', 'BORRA', 'LEE'] as const;
export type TableEffect = (typeof TABLE_EFFECTS)[number];

export interface GraphTableRef {
  readonly qualified: string;
  readonly schema: string;
  readonly table: string;
}

export interface GraphOperation {
  readonly nodeId: string;
  readonly operationId: string | null;
  readonly label: string;
  readonly risk: Riesgo | null;
  readonly actors: readonly string[];
  readonly tables: Readonly<Record<TableEffect, readonly GraphTableRef[]>>;
}

export interface GraphLane {
  readonly id: string;
  readonly label: string;
  readonly operations: readonly GraphOperation[];
}

export interface GraphSummary {
  readonly nodes: Readonly<Record<string, number>>;
  readonly edges: Readonly<Record<string, number>>;
}

export const EFFECT_ORDER = TABLE_EFFECTS;

function count(values: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

export function summarize(graph: Grafo): GraphSummary {
  return {
    nodes: count(graph.nodos.map((n) => n.tipo)),
    edges: count(graph.aristas.map((a) => a.tipo)),
  };
}

function tableRef(label: string): GraphTableRef {
  const dot = label.indexOf('.');
  return dot > 0
    ? { qualified: label, schema: label.slice(0, dot), table: label.slice(dot + 1) }
    : { qualified: label, schema: '', table: label };
}

/** Indexa las aristas que salen (o llegan) a cada nodo, por tipo. */
function index(graph: Grafo, by: 'de' | 'a'): Map<string, { type: string; other: string }[]> {
  const out = new Map<string, { type: string; other: string }[]>();
  for (const edge of graph.aristas) {
    const key = by === 'de' ? edge.de : edge.a;
    const other = by === 'de' ? edge.a : edge.de;
    out.set(key, [...(out.get(key) ?? []), { type: edge.tipo, other }]);
  }
  return out;
}

/**
 * Los carriles del proceso: una etapa por carril, en el orden en que el
 * inventario las declara, y al final las operaciones que ninguna etapa contiene.
 */
export function buildLanes(graph: Grafo): readonly GraphLane[] {
  const byId = new Map<string, NodoGrafo>(graph.nodos.map((n) => [n.id, n]));
  const outgoing = index(graph, 'de');
  const incoming = index(graph, 'a');
  const placed = new Set<string>();

  const operation = (node: NodoGrafo): GraphOperation => {
    placed.add(node.id);
    const tables = Object.fromEntries(
      TABLE_EFFECTS.map((effect) => [
        effect,
        (outgoing.get(node.id) ?? [])
          .filter((e) => e.type === effect)
          .map((e) => tableRef(byId.get(e.other)?.etiqueta ?? e.other)),
      ]),
    ) as Record<TableEffect, GraphTableRef[]>;
    return {
      nodeId: node.id,
      operationId: node.operacionId ?? null,
      label: node.etiqueta,
      risk: node.riesgo ?? null,
      actors: (incoming.get(node.id) ?? [])
        .filter((e) => e.type === 'ACTUA')
        .map((e) => byId.get(e.other)?.etiqueta ?? e.other),
      tables,
    };
  };

  const lanes: GraphLane[] = graph.nodos
    .filter((n) => n.tipo === 'ETAPA')
    .map((stage) => ({
      id: stage.id,
      label: stage.etiqueta,
      operations: (outgoing.get(stage.id) ?? [])
        .filter((e) => e.type === 'CONTIENE')
        .map((e) => byId.get(e.other))
        .filter((n): n is NodoGrafo => n?.tipo === 'OPERACION')
        .map(operation),
    }));

  const loose = graph.nodos.filter((n) => n.tipo === 'OPERACION' && !placed.has(n.id));
  return loose.length > 0
    ? [...lanes, { id: 'unassigned', label: 'Sin etapa asignada', operations: loose.map(operation) }]
    : lanes;
}
