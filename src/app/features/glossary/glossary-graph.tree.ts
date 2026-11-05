import type {
  GlossaryNeighbor,
  GlossaryNeighborhood,
} from '../../core/data-access/terminology/terminology.types';
import { buildClinicalRoute, type RouteColumn, type RouteColumnKey } from './glossary-clinical-route';
import type { GraphNode, GraphTone } from './glossary-graph.layout';

/** Términos por grupo antes de «+N más»: alcanza para ver de qué trata el grupo sin tapar el lienzo. */
export const GRAPH_GROUP_PAGE = 6;

/** Qué color lleva cada grupo. El color acompaña al rótulo, nunca lo reemplaza. */
const TONE_BY_COLUMN: Readonly<Record<RouteColumnKey, GraphTone>> = {
  criteria: 'aqua',
  symptoms: 'aqua',
  riskFactors: 'neutral',
  anatomy: 'sage',
  diseases: 'petrol',
  tests: 'mint',
  requiredTests: 'mint',
  referral: 'neutral',
  complications: 'neutral',
  treatments: 'sage',
  procedures: 'sage',
  specialties: 'petrol',
  equipment: 'neutral',
  related: 'neutral',
};

export interface TreeInputs {
  readonly rootId: string;
  /** Los vecindarios ya leídos (y completados), por término. */
  readonly neighborhoods: ReadonlyMap<string, GlossaryNeighborhood>;
  /** Los términos abiertos. */
  readonly expanded: ReadonlySet<string>;
  /** Los términos cuyo vecindario está en camino. */
  readonly loading: ReadonlySet<string>;
  /** Definiciones leídas por separado (sin abrir el término). */
  readonly definitions: ReadonlyMap<string, string>;
  /** Cuántos términos se ven de cada grupo (clave del nodo de grupo). */
  readonly visibleByGroup: ReadonlyMap<string, number>;
  readonly showDefinitions: boolean;
}

/** La clave de un grupo: el término que lo abre y la columna, para que sobreviva a reordenar. */
export function groupKey(parentKey: string, column: RouteColumnKey): string {
  return `${parentKey}/g:${column}`;
}

function toneOfNeighbor(column: RouteColumnKey): GraphTone {
  return TONE_BY_COLUMN[column];
}

function groupSublabel(column: RouteColumn): string {
  const count = column.items.length;
  const noun = count === 1 ? 'término' : 'términos';
  return column.complete ? `${count} ${noun}` : `${count}+ ${noun}`;
}

/**
 * Arma el árbol de términos a partir de lo ya leído. No pide nada: lo que falta
 * (un término abierto sin vecindario) se dibuja como cargando.
 *
 * - Un término no vuelve a aparecer debajo de sí mismo: el camino hasta la raíz
 *   se descarta de sus hijos, así que el árbol nunca da vueltas en círculo.
 * - Los grupos salen de la **ruta clínica** del término (la misma que el mapa en
 *   columnas), con sus mismos títulos.
 */
export function buildTermTree(inputs: TreeInputs): GraphNode | null {
  const rootHood = inputs.neighborhoods.get(inputs.rootId);
  if (rootHood === undefined) return null;
  return termNode(
    inputs,
    inputs.rootId,
    rootHood.focus.display,
    rootHood.focus.category?.name,
    'petrol',
    [],
    inputs.rootId,
  );
}

function definitionOf(inputs: TreeInputs, conceptId: string): string | undefined {
  const own = inputs.neighborhoods.get(conceptId)?.focus.shortDefinition;
  if (own !== undefined && own !== '') return own;
  if (!inputs.showDefinitions) return undefined;
  return inputs.definitions.get(conceptId);
}

function termNode(
  inputs: TreeInputs,
  conceptId: string,
  display: string,
  category: string | undefined,
  tone: GraphTone,
  ancestors: readonly string[],
  key: string,
): GraphNode {
  const expanded = inputs.expanded.has(conceptId);
  const loading = inputs.loading.has(conceptId);
  const hood = inputs.neighborhoods.get(conceptId);
  const path = [...ancestors, conceptId];
  // Las definiciones sólo se dibujan si se pidieron o si el término es la raíz
  // o está abierto: un árbol entero con párrafos no se lee.
  const showOwn = inputs.showDefinitions || expanded || conceptId === inputs.rootId;
  const definition = showOwn ? definitionOf({ ...inputs, showDefinitions: true }, conceptId) : undefined;

  const children: GraphNode[] =
    expanded && hood !== undefined ? groupNodes(inputs, hood, path, key) : [];

  return {
    key,
    kind: 'term',
    label: display,
    ...(category === undefined ? {} : { sublabel: category }),
    conceptId,
    tone,
    ...(definition === undefined ? {} : { definition }),
    expandable: true,
    expanded,
    loading,
    children,
  };
}

function groupNodes(
  inputs: TreeInputs,
  hood: GlossaryNeighborhood,
  path: readonly string[],
  parentKey: string,
): GraphNode[] {
  const route = buildClinicalRoute(hood);
  const columns = [...route.findings, ...route.next, ...route.context].filter(
    (column) => column.items.length > 0,
  );
  return columns.map((column) => {
    const key = groupKey(parentKey, column.key);
    const tone = toneOfNeighbor(column.key);
    const visible = inputs.visibleByGroup.get(key) ?? GRAPH_GROUP_PAGE;
    const usable = column.items.filter((item) => !path.includes(item.conceptId));
    const shown = usable.slice(0, visible);
    const children: GraphNode[] = shown.map((item) => neighborNode(inputs, item, tone, path, key));
    const hidden = usable.length - shown.length;
    const unseen = column.complete ? 0 : 1;
    if (hidden > 0 || unseen > 0) {
      children.push({
        key: `${key}/more`,
        kind: 'more',
        // El término que abre el grupo: «Ver todos» pide a la API el resto de
        // SU vecindario, y el nodo tiene que saber de quién es.
        conceptId: path[path.length - 1],
        label: hidden > 0 ? `+${hidden} más` : 'Ver todos',
        tone,
        expandable: false,
        expanded: false,
        loading: false,
        children: [],
      });
    }
    return {
      key,
      kind: 'group',
      label: column.title,
      sublabel: groupSublabel(column),
      tone,
      expandable: false,
      expanded: true,
      loading: false,
      children,
    };
  });
}

function neighborNode(
  inputs: TreeInputs,
  neighbor: GlossaryNeighbor,
  tone: GraphTone,
  path: readonly string[],
  groupKeyValue: string,
): GraphNode {
  return termNode(
    inputs,
    neighbor.conceptId,
    neighbor.display,
    neighbor.category?.name,
    tone,
    path,
    `${groupKeyValue}/t:${neighbor.conceptId}`,
  );
}

/** Cuántos nodos hay en el árbol, por tipo: lo que la pantalla dice en la cabecera. */
export function countNodes(root: GraphNode): { terms: number; groups: number } {
  let terms = 0;
  let groups = 0;
  const walk = (node: GraphNode): void => {
    if (node.kind === 'term') terms += 1;
    if (node.kind === 'group') groups += 1;
    node.children.forEach(walk);
  };
  walk(root);
  return { terms, groups };
}

/** Todos los nodos de término del árbol, en orden de lectura. */
export function termsOf(root: GraphNode): readonly GraphNode[] {
  const found: GraphNode[] = [];
  const walk = (node: GraphNode): void => {
    if (node.kind === 'term') found.push(node);
    node.children.forEach(walk);
  };
  walk(root);
  return found;
}
