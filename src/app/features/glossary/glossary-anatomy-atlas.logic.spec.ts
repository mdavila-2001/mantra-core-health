import type { AnatomyIndexEntry, AnatomyPart, AnatomyStructure } from '../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import {
  displayName,
  groupRelations,
  meshesOf,
  ontologyUrl,
  partVisibleFor,
  relatedMeshes,
  relatedStructureIds,
  searchIndex,
  sideLabel,
} from './glossary-anatomy-atlas.logic';

/** Una pieza mínima; sólo cambia lo que cada prueba necesita. */
function pieza(meshId: string, structureId: string, extra: Partial<AnatomyPart> = {}): AnatomyPart {
  return { meshId, structureId, layer: 'skeleton', sex: 'shared', shard: 0, side: null, labelEn: meshId, match: 'fma_exact', ...extra };
}

const FEMUR: AnatomyStructure = {
  id: 'UBERON:0000981',
  labelEn: 'femur',
  labelEs: 'fémur',
  synonymsEn: [],
  fma: ['9611'],
  regions: ['R07'],
  definition: null,
  isA: [],
  relations: [
    { type: 'part_of', name: 'forma parte de', target: 'UBERON:0003466', labelEn: 'skeleton of lower leg', labelEs: null, inCatalog: true },
  ],
  incoming: [
    { type: 'has_muscle_origin', name: 'es origen del músculo', source: 'UBERON:0001377', labelEn: 'quadriceps femoris', labelEs: 'cuádriceps femoral' },
    { type: 'has_muscle_origin', name: 'es origen del músculo', source: 'UBERON:0001377', labelEn: 'quadriceps femoris', labelEs: 'cuádriceps femoral' },
  ],
  netter: [],
  meshes: ['FMA24474', 'FMA24475'],
  extendedDescription: null,
  images: [],
};

const PIEZAS: readonly AnatomyPart[] = [
  pieza('FMA24474', 'UBERON:0000981', { side: 'right' }),
  pieza('FMA24475', 'UBERON:0000981', { side: 'left' }),
  pieza('FMA22430', 'UBERON:0001377', { layer: 'muscles' }),
  pieza('FMA9600', 'UBERON:0002367', { layer: 'organs', sex: 'male' }),
];

describe('glossary-anatomy-atlas.logic', () => {
  it('la vista «Mujer» sólo quita lo exclusivo del cuerpo masculino, no agrega nada', () => {
    expect(partVisibleFor(PIEZAS[3], 'female')).toBe(false);
    expect(partVisibleFor(PIEZAS[3], 'male')).toBe(true);
    expect(partVisibleFor(PIEZAS[0], 'female')).toBe(true);
  });

  it('una estructura par resalta sus dos mallas', () => {
    expect(meshesOf(PIEZAS, 'UBERON:0000981', 'male')).toEqual(['FMA24474', 'FMA24475']);
    expect(meshesOf(PIEZAS, 'UBERON:0002367', 'female')).toEqual([]);
  });

  it('las relacionadas salen de lo que la ficha declara, en los dos sentidos, sin la propia', () => {
    expect([...relatedStructureIds(FEMUR)].sort()).toEqual(['UBERON:0001377', 'UBERON:0003466']);
    expect(relatedMeshes(PIEZAS, FEMUR, 'male')).toEqual(['FMA22430']);
  });

  it('agrupa por relación, sin repetir, y dice qué se puede abrir y qué tiene pieza', () => {
    const grupos = groupRelations(FEMUR, new Set(['UBERON:0001377']), new Set(['UBERON:0001377']));
    expect(grupos.map((g) => g.name)).toEqual(['forma parte de', 'es origen del músculo']);
    expect(grupos[1].items).toEqual([
      { id: 'UBERON:0001377', label: 'cuádriceps femoral', hasMesh: true, highlighted: true, inCatalog: true },
    ]);
    expect(grupos[0].items[0]).toMatchObject({ label: 'skeleton of lower leg', hasMesh: false, inCatalog: false });
  });

  it('no dice «resaltada» de una pieza cuya capa está apagada', () => {
    const grupos = groupRelations(FEMUR, new Set(['UBERON:0001377']), new Set(['UBERON:0001377']), new Set());
    expect(grupos[1].items[0]).toMatchObject({ hasMesh: true, highlighted: false });
  });

  it('muestra el nombre castellano si existe y si no el de la ontología', () => {
    expect(displayName('fémur', 'femur', 'X')).toBe('fémur');
    expect(displayName(null, 'femur', 'X')).toBe('femur');
    expect(displayName(null, null, 'X')).toBe('X');
  });

  it('busca sin tildes, en castellano o inglés, y pone primero lo que tiene pieza', () => {
    const indice: AnatomyIndexEntry[] = [
      ['UBERON:1', 'cabeza del fémur', 'head of femur', 0],
      ['UBERON:0000981', 'fémur', 'femur', 1],
      ['UBERON:2', 'útero', 'uterus', 0],
    ];
    expect(searchIndex(indice, 'femur', 10).map((e) => e[0])).toEqual(['UBERON:0000981', 'UBERON:1']);
    expect(searchIndex(indice, 'UTERUS', 10).map((e) => e[0])).toEqual(['UBERON:2']);
    expect(searchIndex(indice, 'f', 10)).toEqual([]);
  });

  it('enlaza UBERON y FMA a sus PURL y nada más', () => {
    expect(ontologyUrl('UBERON:0000981')).toBe('https://purl.obolibrary.org/obo/UBERON_0000981');
    expect(ontologyUrl('FMA:9611')).toBe('https://purl.org/sig/ont/fma/fma9611');
    expect(ontologyUrl('BP3D:BP24')).toBeNull();
  });

  it('dice el lado en castellano', () => {
    expect(sideLabel('right')).toBe('lado derecho');
    expect(sideLabel('left')).toBe('lado izquierdo');
    expect(sideLabel(null)).toBeNull();
  });
});
