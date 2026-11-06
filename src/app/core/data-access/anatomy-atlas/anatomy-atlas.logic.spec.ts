import { displayName, meshesOf, normalizeSearch, searchIndex, sideLabel } from './anatomy-atlas.logic';
import type { AnatomyIndexEntry, AnatomyPart } from './anatomy-atlas.types';

const PARTE = (meshId: string, structureId: string, side: AnatomyPart['side']): AnatomyPart => ({
  meshId,
  layer: 'skeleton',
  sex: 'shared',
  structureId,
  shard: 0,
  side,
  labelEn: meshId,
  match: 'fma_exact',
});

describe('la lógica del atlas que comparten el glosario y la orden de estudios', () => {
  it('busca sin tildes ni mayúsculas, en castellano o en inglés, y primero lo que tiene pieza', () => {
    const entradas: AnatomyIndexEntry[] = [
      ['UBERON:1', 'fémur sin pieza', 'femur x', 0],
      ['UBERON:2', 'Fémur', 'femur', 1],
    ];
    expect(searchIndex(entradas, 'FEMUR', 10).map((e) => e[0])).toEqual(['UBERON:2', 'UBERON:1']);
    expect(searchIndex(entradas, 'f', 10)).toEqual([]);
    expect(normalizeSearch('  Húmero ')).toBe('humero');
  });

  it('las mallas de una estructura incluyen sus dos lados y respetan el sexo', () => {
    const partes = [PARTE('R', 'UBERON:2', 'right'), PARTE('L', 'UBERON:2', 'left'), { ...PARTE('F', 'UBERON:3', null), sex: 'female' as const }];
    expect(meshesOf(partes, 'UBERON:2', 'male')).toEqual(['R', 'L']);
    expect(meshesOf(partes, 'UBERON:3', 'male')).toEqual([]);
    expect(meshesOf(partes, 'UBERON:3', 'female')).toEqual(['F']);
  });

  it('el nombre y el lado en palabras', () => {
    expect(displayName(null, 'femur', 'X')).toBe('femur');
    expect(displayName(null, null, 'X')).toBe('X');
    expect(sideLabel('left')).toBe('lado izquierdo');
    expect(sideLabel(null)).toBeNull();
  });
});
