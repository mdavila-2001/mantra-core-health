import type { AnatomyPart } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import {
  highlightedMeshes,
  pickableEntries,
  selectionOfMesh,
  selectionOfStructure,
  sideWords,
} from './body-site-picker.logic';

const PARTE = (meshId: string, structureId: string, side: AnatomyPart['side'], layer: AnatomyPart['layer'] = 'skeleton', sex: AnatomyPart['sex'] = 'shared'): AnatomyPart => ({
  meshId, layer, sex, structureId, shard: 0, side, labelEn: meshId, match: 'fma_exact',
});

const PARTES = [
  PARTE('FEM_R', 'UBERON:0000981', 'right'),
  PARTE('FEM_L', 'UBERON:0000981', 'left'),
  PARTE('STERNUM', 'UBERON:0000975', null),
  PARTE('LIVER', 'UBERON:0002107', null, 'organs'),
  PARTE('UTERUS', 'UBERON:0000995', null, 'organs', 'female'),
];

describe('body-site-picker.logic: el puntero y la lista eligen lo mismo', () => {
  it('tocar una malla da malla, estructura, capa y lado', () => {
    expect(selectionOfMesh(PARTES, 'FEM_L')).toEqual({ meshId: 'FEM_L', structureId: 'UBERON:0000981', layer: 'skeleton', side: 'left' });
  });

  it('elegir en la lista una pieza sin par da la misma selección que tocarla', () => {
    expect(selectionOfStructure(PARTES, 'UBERON:0000975', 'male')).toEqual(selectionOfMesh(PARTES, 'STERNUM'));
    expect(selectionOfStructure(PARTES, 'UBERON:0002107', 'male')).toEqual(selectionOfMesh(PARTES, 'LIVER'));
  });

  it('límite: un hueso par elegido por nombre NO elige lado por el médico; el que ya había marcado se respeta', () => {
    expect(selectionOfStructure(PARTES, 'UBERON:0000981', 'male')).toMatchObject({ structureId: 'UBERON:0000981', side: null });
    expect(selectionOfStructure(PARTES, 'UBERON:0000981', 'male', 'right')).toMatchObject({ meshId: 'FEM_R', side: 'right' });
  });

  it('inválido: una malla o una estructura que el catálogo no tiene, o de otro cuerpo, no se elige', () => {
    expect(selectionOfMesh(PARTES, 'NOEXISTE')).toBeNull();
    expect(selectionOfStructure(PARTES, 'UBERON:9', 'male')).toBeNull();
    expect(selectionOfStructure(PARTES, 'UBERON:0000995', 'male')).toBeNull();
    expect(selectionOfStructure(PARTES, 'UBERON:0000995', 'female')).not.toBeNull();
  });

  it('resalta sólo la malla tocada si se conoce el lado; ambas si se eligió por nombre', () => {
    expect(highlightedMeshes(PARTES, selectionOfMesh(PARTES, 'FEM_R'), 'male')).toEqual(['FEM_R']);
    expect(highlightedMeshes(PARTES, selectionOfStructure(PARTES, 'UBERON:0000981', 'male'), 'male')).toEqual(['FEM_R', 'FEM_L']);
    expect(highlightedMeshes(PARTES, null, 'male')).toEqual([]);
  });

  it('la lista ofrece sólo estructuras con pieza, y el lado se dice en palabras', () => {
    expect(pickableEntries([['a', null, 'A', 1], ['b', null, 'B', 0]]).map((e) => e[0])).toEqual(['a']);
    expect(sideWords('right')).toBe('derecho');
    expect(sideWords(null)).toBeNull();
  });
});
