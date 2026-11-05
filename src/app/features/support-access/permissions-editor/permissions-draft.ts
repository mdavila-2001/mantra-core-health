import type {
  ExpansionMode,
  LocationNode,
  SupportActionCode,
  SupportScopeTarget,
} from '../../../core/data-access/support-access/support-access.types';
import type { SupportActionInput } from '../../../core/data-access/support-access/support-atom-grants.types';
import { targetKey } from '../../../core/data-access/support-access/support-grant-draft';
import { normalizeActions, pruneConditions, type EditorGrant } from './editor-grant';

/** Una fila del borrador: un permiso con sus acciones (alias o átomos), efecto y condiciones. */
type DraftGrant = EditorGrant;

/**
 * Operaciones **puras** sobre el borrador de permisos del editor. Cada una
 * devuelve un borrador nuevo; la pantalla guarda el resultado en una señal.
 * Separadas del componente para poder probarlas sin montar nada.
 */

let secuencia = 0;

/** Clave estable para una fila nueva. No viaja a la API. */
function nuevaClave(): string {
  secuencia += 1;
  return `nuevo-${secuencia}`;
}

export function hasTarget(draft: readonly DraftGrant[], target: SupportScopeTarget): boolean {
  const clave = targetKey(target);
  return draft.some((row) => targetKey(row) === clave);
}

/** Agrega el objetivo con las acciones por defecto del rol, o lo quita si ya estaba. */
export function toggleTarget(
  draft: readonly DraftGrant[],
  target: SupportScopeTarget,
  defaultActions: readonly SupportActionCode[],
  mode: ExpansionMode,
): readonly DraftGrant[] {
  const clave = targetKey(target);
  if (draft.some((row) => targetKey(row) === clave)) {
    return draft.filter((row) => targetKey(row) !== clave);
  }
  return [
    ...draft,
    { key: nuevaClave(), ...target, actions: [...defaultActions], expansionMode: mode },
  ];
}

/** Agrega varios objetivos de una vez; los que ya estaban se respetan (no se duplican ni se quitan). */
export function addTargets(
  draft: readonly DraftGrant[],
  targets: readonly SupportScopeTarget[],
  defaultActions: readonly SupportActionCode[],
  mode: ExpansionMode,
): readonly DraftGrant[] {
  return targets.reduce(
    (acumulado, target) =>
      hasTarget(acumulado, target)
        ? acumulado
        : toggleTarget(acumulado, target, defaultActions, mode),
    draft,
  );
}

/** Quita varios objetivos de una vez. */
export function removeTargets(
  draft: readonly DraftGrant[],
  targets: readonly SupportScopeTarget[],
): readonly DraftGrant[] {
  const claves = new Set(targets.map(targetKey));
  return draft.filter((row) => !claves.has(targetKey(row)));
}

export function removeRow(draft: readonly DraftGrant[], key: string): readonly DraftGrant[] {
  return draft.filter((row) => row.key !== key);
}

export function setActions(
  draft: readonly DraftGrant[],
  key: string,
  actions: readonly SupportActionInput[],
): readonly DraftGrant[] {
  return draft.map((row) =>
    row.key === key ? pruneConditions({ ...row, actions: normalizeActions(actions) }) : row,
  );
}

/** Marca o desmarca **una** acción de **una** fila (una celda de la matriz). */
export function toggleAction(
  draft: readonly DraftGrant[],
  key: string,
  action: SupportActionCode,
  on: boolean,
): readonly DraftGrant[] {
  return draft.map((row) => {
    if (row.key !== key) return row;
    const actions = on ? [...row.actions, action] : row.actions.filter((code) => code !== action);
    return pruneConditions({ ...row, actions: normalizeActions(actions) });
  });
}

export function setMode(
  draft: readonly DraftGrant[],
  key: string,
  mode: ExpansionMode,
): readonly DraftGrant[] {
  return draft.map((row) => (row.key === key ? { ...row, expansionMode: mode } : row));
}

/** Vuelve todas las filas al paquete de acciones del rol. */
export function applyPackage(
  draft: readonly DraftGrant[],
  defaultActions: readonly SupportActionCode[],
): readonly DraftGrant[] {
  return draft.map((row) => pruneConditions({ ...row, actions: [...defaultActions] }));
}

/* ---- árbol de ubicaciones ------------------------------------------------------ */

export interface LocationTreeNode {
  readonly node: LocationNode;
  readonly children: readonly LocationTreeNode[];
}

/** Arma el árbol a partir de la lista plana. Un nodo cuyo padre no está en la lista es raíz. */
export function buildLocationTree(locations: readonly LocationNode[]): readonly LocationTreeNode[] {
  const ids = new Set(locations.map((node) => node.id));
  const hijos = new Map<string | null, LocationNode[]>();
  for (const node of locations) {
    const padre = node.parentId !== null && ids.has(node.parentId) ? node.parentId : null;
    hijos.set(padre, [...(hijos.get(padre) ?? []), node]);
  }
  const armar = (padre: string | null): readonly LocationTreeNode[] =>
    (hijos.get(padre) ?? []).map((node) => ({ node, children: armar(node.id) }));
  return armar(null);
}

/** El objetivo de permiso de un nodo: una sede es `practiceSiteId`, lo demás `careSpaceId`. */
export function locationTarget(node: LocationNode): SupportScopeTarget {
  return node.kind === 'SITE'
    ? { targetKind: 'LOCATION', practiceSiteId: node.id }
    : { targetKind: 'LOCATION', careSpaceId: node.id };
}

export type LocationSelection =
  /** Elegido directamente. */
  | { readonly state: 'selected' }
  /** Lo cubre un ancestro elegido: se ve marcado y no se toca. */
  | { readonly state: 'inherited'; readonly by: LocationNode }
  /** Alguno de sus descendientes está elegido, él no. */
  | { readonly state: 'partial' }
  | { readonly state: 'none' };

/** Cómo se ve un nodo del árbol según lo elegido. */
export function selectionOf(
  node: LocationNode,
  locations: readonly LocationNode[],
  draft: readonly DraftGrant[],
): LocationSelection {
  if (hasTarget(draft, locationTarget(node))) return { state: 'selected' };
  const ancestro = locations.find(
    (otro) =>
      otro.id !== node.id &&
      node.path.startsWith(otro.path) &&
      hasTarget(draft, locationTarget(otro)),
  );
  if (ancestro !== undefined) return { state: 'inherited', by: ancestro };
  const descendiente = locations.some(
    (otro) =>
      otro.id !== node.id &&
      otro.path.startsWith(node.path) &&
      hasTarget(draft, locationTarget(otro)),
  );
  return descendiente ? { state: 'partial' } : { state: 'none' };
}

/**
 * «Seleccionar todo» en un nivel: los hijos directos de un nodo.
 *
 * Con **lo nuevo automático** se elige el nodo padre (una sola fila que cubre
 * también lo que se agregue después). Con el modo **fijo** se eligen los hijos
 * de hoy, uno por uno: lo que se agregue más tarde no queda cubierto.
 */
export function selectLevel(
  draft: readonly DraftGrant[],
  parent: LocationNode,
  children: readonly LocationNode[],
  defaultActions: readonly SupportActionCode[],
  mode: ExpansionMode,
): readonly DraftGrant[] {
  if (mode === 'DYNAMIC') {
    const sinHijos = removeTargets(draft, children.map(locationTarget));
    return addTargets(sinHijos, [locationTarget(parent)], defaultActions, 'DYNAMIC');
  }
  const sinPadre = removeTargets(draft, [locationTarget(parent)]);
  return addTargets(sinPadre, children.map(locationTarget), defaultActions, 'FIXED');
}

/** Nombre del nivel que se está seleccionando, en plural: «pisos», «consultorios». */
export function levelNoun(children: readonly LocationNode[]): string {
  const kind = children[0]?.kind;
  switch (kind) {
    case 'BUILDING':
      return 'edificios';
    case 'LEVEL':
      return 'pisos';
    case 'WING':
      return 'alas';
    case 'CONSULTING_ROOM':
      return 'consultorios';
    case 'OPERATING_ROOM':
      return 'quirófanos';
    case 'PROCEDURE_ROOM':
      return 'salas';
    case 'BED':
      return 'camas';
    case 'SITE':
      return 'sedes';
    default:
      return 'lugares';
  }
}
