import type { LayoutItemError } from '../../../core/data-access/floor-plan/floor-plan.types';
import { elementAxis, elementLabel } from '../../../core/floor-plan/editor-elements';
import { verticesOfEdit, type EditState } from '../../../core/floor-plan/editor-model';
import type { Point } from '../../../core/floor-plan/geometry';
import type { LayoutIssue } from '../../../core/floor-plan/layout-validation';
import { pathOf } from '../../../core/floor-plan/plan-view';

/** Un problema de la figura, venga de la ayuda local o del servidor (que decide). */
export interface EditorIssue {
  readonly id: string;
  readonly kind: 'SPACE' | 'ELEMENT' | 'CANVAS';
  readonly code: string;
  readonly message: string;
  readonly source: 'local' | 'server';
  readonly conflictsWith: readonly { readonly id: string; readonly code: string; readonly name: string; readonly overlapAreaM2?: number }[];
  readonly nextAction: { readonly label: string; readonly hint: string } | null;
}

export type SaveFailure =
  | { readonly kind: 'invalid'; readonly requestId: string | null }
  | { readonly kind: 'conflict'; readonly currentVersion: number | null; readonly summary: string | null; readonly requestId: string | null }
  | { readonly kind: 'forbidden'; readonly requestId: string | null }
  | { readonly kind: 'offline' }
  | { readonly kind: 'error'; readonly message: string; readonly requestId: string | null };


const conflictsOf = (list: readonly { id: string; code: string; name: string; overlapAreaM2?: number }[] | undefined): EditorIssue['conflictsWith'] =>
  (list ?? []).map((c) => ({ id: c.id, code: c.code, name: c.name, ...(c.overlapAreaM2 !== undefined ? { overlapAreaM2: c.overlapAreaM2 } : {}) }));

/** Los errores del servidor mandan; la ayuda local suma lo que el servidor no dijo. */
export function mergeIssues(server: readonly LayoutItemError[], local: readonly LayoutIssue[]): EditorIssue[] {
  const fromServer = server.map<EditorIssue>((e) => ({
    id: e.id, kind: e.kind, code: e.code, message: e.message, source: 'server', conflictsWith: conflictsOf(e.conflictsWith), nextAction: e.nextAction ?? null,
  }));
  const known = new Set(fromServer.map((e) => `${e.id}:${e.code}`));
  const fromLocal = local
    .filter((i) => !known.has(`${i.id}:${i.code}`))
    .map<EditorIssue>((i) => ({
      id: i.id, kind: i.kind, code: i.code, message: i.message, source: 'local', conflictsWith: conflictsOf(i.conflictsWith), nextAction: i.nextAction ?? null,
    }));
  return [...fromServer, ...fromLocal];
}

/** Texto corto para rotular la figura en el plano; el detalle completo está en la lista de problemas. */
export function shortIssueLabel(issue: EditorIssue): string {
  const other = issue.conflictsWith[0]?.code;
  switch (issue.code) {
    case 'PLAN_SIBLING_OVERLAP':
      return other ? `Se solapa con ${other}` : 'Se solapa';
    case 'PLAN_CHILD_OUTSIDE_PARENT':
      return 'Sale de su espacio padre';
    case 'PLAN_OUT_OF_BOUNDS':
      return 'Sale del lienzo';
    case 'PLAN_GEOMETRY_INVALID':
      return 'Figura no válida';
    case 'PLAN_PARENT_NOT_PLACED':
      return 'Su espacio padre no está dibujado';
    case 'PLAN_OPENING_OUTSIDE_WALL':
      return 'No cabe en su muro';
    case 'PLAN_HOST_NOT_WALL':
      return 'No tiene muro';
    default:
      return issue.message.length > 42 ? `${issue.message.slice(0, 40)}…` : issue.message;
  }
}

/** Qué figuras se pintan con error (la propia y su vecina), con qué mensaje y con qué rótulo corto. */
export function errorMarks(
  issues: readonly EditorIssue[],
  state: EditState,
): {
  errors: Map<string, string>;
  shapes: Map<string, readonly Point[]>;
  labels: Map<string, string>;
  elements: Map<string, { path: string; label: string; at: Point }>;
} {
  const errors = new Map<string, string>();
  const shapes = new Map<string, readonly Point[]>();
  const labels = new Map<string, string>();
  const elements = new Map<string, { path: string; label: string; at: Point }>();
  const mark = (id: string, message: string): void => {
    const space = state.spaces.get(id);
    if (!space || state.removed.has(id)) return;
    if (!errors.has(id)) errors.set(id, message);
    shapes.set(id, verticesOfEdit(space));
  };
  for (const issue of issues) {
    if (issue.kind === 'ELEMENT') {
      const element = state.elements.get(issue.id);
      const axis = element && !state.removedElements.has(element.id) ? elementAxis(state, element) : null;
      if (element && axis && !elements.has(element.id)) {
        const mid = axis[Math.floor(axis.length / 2)]!;
        elements.set(element.id, { path: pathOf(axis, false), label: `${elementLabel(element)}: ${shortIssueLabel(issue)}`, at: mid });
      }
      continue;
    }
    if (issue.kind !== 'SPACE') continue;
    mark(issue.id, issue.message);
    if (!labels.has(issue.id) && state.spaces.has(issue.id)) labels.set(issue.id, shortIssueLabel(issue));
    for (const other of issue.conflictsWith) mark(other.id, `Choca con ${state.spaces.get(issue.id)?.code ?? 'otra figura'}.`);
  }
  return { errors, shapes, labels, elements };
}
