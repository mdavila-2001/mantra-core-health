/* ============================================================================
    «Ver cambios» del 412 (CONTRATO-PLANO §5.3): qué movió la otra persona desde
    que se abrió el plano, y cuáles de esos espacios también se tocaron acá
    (esos no se reaplican solos).
    ========================================================================== */

import type { EditState } from './editor-model';

export interface RemoteChange {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly what: 'movido' | 'nuevo' | 'quitado';
  readonly collides: boolean;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function diffRemote(baseline: EditState, mine: EditState, incoming: EditState): RemoteChange[] {
  const touchedByMe = (id: string): boolean => mine.removed.has(id) || !same(mine.spaces.get(id)?.geometry, baseline.spaces.get(id)?.geometry);
  const changes: RemoteChange[] = [];
  for (const [id, now] of incoming.spaces) {
    const before = baseline.spaces.get(id);
    if (!before) changes.push({ id, code: now.code, name: now.name, what: 'nuevo', collides: touchedByMe(id) });
    else if (!same(before.geometry, now.geometry)) changes.push({ id, code: now.code, name: now.name, what: 'movido', collides: touchedByMe(id) });
  }
  for (const [id, before] of baseline.spaces) {
    if (!incoming.spaces.has(id)) changes.push({ id, code: before.code, name: before.name, what: 'quitado', collides: touchedByMe(id) });
  }
  return changes;
}
