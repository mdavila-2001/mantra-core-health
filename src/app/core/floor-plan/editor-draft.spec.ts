import { describe, expect, it } from 'vitest';

import { applyDraft, buildDraft, parseDraft } from './editor-draft';
import { removeFromPlan, setGeometry, withSpace, type EditSpace, type EditState } from './editor-model';

const space = (id: string, x: number): EditSpace => ({
  id, code: id.toUpperCase(), name: id, parentId: null, formCode: 'ROOM', zOrder: 10, locked: false, rowVersion: 1,
  geometry: { kind: 'RECT', centerXM: x, centerYM: 5, widthM: 3, depthM: 3, rotationDeg: 0 },
});
const base: EditState = { spaces: new Map([['a', space('a', 5)], ['b', space('b', 12)]]), removed: new Set() };

describe('editor-draft', () => {
  it('sin cambios no hay borrador', () => {
    expect(buildDraft('p', 3, base, base, new Date())).toBeNull();
  });

  it('guarda solo lo que cambió y se puede volver a aplicar', () => {
    let current = setGeometry(base, 'a', { kind: 'RECT', centerXM: 9, centerYM: 5, widthM: 3, depthM: 3, rotationDeg: 0 });
    current = removeFromPlan(current, 'b');
    current = withSpace(current, space('c', 20));
    const draft = buildDraft('p', 3, base, current, new Date('2026-10-29T10:00:00Z'))!;
    expect(draft.spaces.map((s) => s.id).sort()).toEqual(['a', 'c']);
    expect(draft.removed).toEqual(['b']);
    const back = applyDraft(base, parseDraft(JSON.stringify(draft))!);
    expect(back.spaces.get('a')!.geometry).toEqual(current.spaces.get('a')!.geometry);
    expect(back.removed.has('b')).toBe(true);
    expect(back.spaces.has('c')).toBe(true);
  });

  it('un texto roto no es un borrador', () => {
    expect(parseDraft('{no es json')).toBeNull();
    expect(parseDraft('{"v":2}')).toBeNull();
    expect(parseDraft(null)).toBeNull();
  });
});
