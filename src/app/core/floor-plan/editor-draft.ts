/* ============================================================================
    Borrador local del editor (CONTRATO-PLANO §5.3): lo que todavía no se guardó
    queda en `localStorage` como comodidad por usuario. El almacenamiento puede
    faltar o fallar (ventana privada, datos bloqueados): todo está en
    `try/catch` y la pantalla funciona igual sin él.
    ========================================================================== */

import { withElement, removeElement } from './editor-elements';
import { withSpace, removeFromPlan, type EditElement, type EditSpace, type EditState } from './editor-model';

export interface EditDraft {
  readonly v: 1;
  readonly planId: string;
  /** `layoutVersion` sobre element que se hicieron los cambios. */
  readonly baseVersion: number;
  readonly savedAt: string;
  readonly spaces: readonly EditSpace[];
  readonly removed: readonly string[];
  /** Muros, puertas y ventanas nuevos o cambiados, y los quitados (un borrador anterior no los traía). */
  readonly elements?: readonly EditElement[];
  readonly removedElements?: readonly string[];
}

export const DRAFT_KEY_PREFIX = 'mantra-core-health.floor-plan.draft.';

export function draftKey(planId: string): string {
  return `${DRAFT_KEY_PREFIX}${planId}`;
}

const sameGeometry = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Solo viaja lo que difiere de lo cargado. */
export function buildDraft(planId: string, baseVersion: number, baseline: EditState, current: EditState, now: Date): EditDraft | null {
  const spaces: EditSpace[] = [];
  for (const space of current.spaces.values()) {
    if (current.removed.has(space.id)) continue;
    const before = baseline.spaces.get(space.id);
    if (!before || !sameGeometry(before.geometry, space.geometry)) spaces.push(space);
  }
  const removed = [...current.removed].filter((id) => baseline.spaces.has(id));
  const elements = [...current.elements.values()].filter((element) => !current.removedElements.has(element.id) && !sameGeometry(baseline.elements.get(element.id), element));
  const removedElements = [...current.removedElements].filter((id) => baseline.elements.has(id));
  if (spaces.length === 0 && removed.length === 0 && elements.length === 0 && removedElements.length === 0) return null;
  return { v: 1, planId, baseVersion, savedAt: now.toISOString(), spaces, removed, elements, removedElements };
}

export function applyDraft(baseline: EditState, draft: EditDraft): EditState {
  let state = baseline;
  for (const space of draft.spaces) state = withSpace(state, space);
  for (const id of draft.removed) state = removeFromPlan(state, id);
  for (const element of draft.elements ?? []) state = withElement(state, element);
  for (const id of draft.removedElements ?? []) state = removeElement(state, id);
  return state;
}

export function parseDraft(raw: string | null): EditDraft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<EditDraft>;
    if (value.v !== 1 || typeof value.planId !== 'string' || typeof value.baseVersion !== 'number' || !Array.isArray(value.spaces) || !Array.isArray(value.removed)) return null;
    return value as EditDraft;
  } catch {
    return null;
  }
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadDraft(planId: string): EditDraft | null {
  try {
    const draft = parseDraft(storage()?.getItem(draftKey(planId)) ?? null);
    return draft && draft.planId === planId ? draft : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: EditDraft): void {
  try {
    storage()?.setItem(draftKey(draft.planId), JSON.stringify(draft));
  } catch {
    /* sin almacenamiento: element borrador es una comodidad */
  }
}

export function clearDraft(planId: string): void {
  try {
    storage()?.removeItem(draftKey(planId));
  } catch {
    /* ídem */
  }
}
