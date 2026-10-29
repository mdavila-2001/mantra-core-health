import type { LayoutItemError } from '../../../core/data-access/floor-plan/floor-plan.types';
import { verticesOfEdit, type EditState } from '../../../core/floor-plan/editor-model';
import type { Point } from '../../../core/floor-plan/geometry';
import type { LayoutIssue } from '../../../core/floor-plan/layout-validation';

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

/** Qué figuras se pintan con error (la propia y su vecina) y con qué mensaje. */
export function errorMarks(issues: readonly EditorIssue[], state: EditState): { errors: Map<string, string>; shapes: Map<string, readonly Point[]> } {
  const errors = new Map<string, string>();
  const shapes = new Map<string, readonly Point[]>();
  const mark = (id: string, message: string): void => {
    const space = state.spaces.get(id);
    if (!space || state.removed.has(id)) return;
    if (!errors.has(id)) errors.set(id, message);
    shapes.set(id, verticesOfEdit(space));
  };
  for (const issue of issues) {
    if (issue.kind !== 'SPACE') continue;
    mark(issue.id, issue.message);
    for (const other of issue.conflictsWith) mark(other.id, `Choca con ${state.spaces.get(issue.id)?.code ?? 'otra figura'}.`);
  }
  return { errors, shapes };
}
