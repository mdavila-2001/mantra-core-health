import { describe, expect, it } from 'vitest';

import { diffRemote } from './editor-remote';
import { setGeometry, type EditSpace, type EditState } from './editor-model';

const space = (id: string, x: number): EditSpace => ({
  id, code: id.toUpperCase(), name: id, parentId: null, formCode: 'ROOM', zOrder: 10, locked: false, rowVersion: 1,
  geometry: { kind: 'RECT', centerXM: x, centerYM: 5, widthM: 3, depthM: 3, rotationDeg: 0 },
});
const state = (...spaces: EditSpace[]): EditState => ({ spaces: new Map(spaces.map((s) => [s.id, s])), removed: new Set() });

describe('editor-remote', () => {
  it('lista lo movido, lo nuevo y lo quitado, y marca lo que yo también toqué', () => {
    const base = state(space('a', 5), space('b', 12), space('c', 20));
    const mine = setGeometry(base, 'a', { kind: 'RECT', centerXM: 6, centerYM: 5, widthM: 3, depthM: 3, rotationDeg: 0 });
    const incoming = state(space('a', 7), space('b', 12), space('d', 30));
    const changes = diffRemote(base, mine, incoming);
    expect(changes).toContainEqual(expect.objectContaining({ id: 'a', what: 'movido', collides: true }));
    expect(changes).toContainEqual(expect.objectContaining({ id: 'd', what: 'nuevo', collides: false }));
    expect(changes).toContainEqual(expect.objectContaining({ id: 'c', what: 'quitado', collides: false }));
    expect(changes.find((c) => c.id === 'b')).toBeUndefined();
  });
});
