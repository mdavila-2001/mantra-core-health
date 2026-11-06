import type { AnatomyIndexEntry, AnatomyPart, AnatomyStructure } from '../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import {
  displayName,
  drawnStructures,
  groupRelations,
  meshesOf,
  ontologyUrl,
  pageOf,
  pageRelationGroups,
  partVisibleFor,
  relatedMeshes,
  relatedStructureIds,
  searchIndex,
  sideLabel,
  structureIdsOf,
  structuresWithMesh,
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
  it('cada cuerpo dibuja lo compartido y lo suyo, nunca lo del otro', () => {
    const utero = pieza('VH_F_body_of_uterus', 'UBERON:0009853', { layer: 'organs', sex: 'female', match: 'hra_exact' });
    expect(partVisibleFor(PIEZAS[3], 'female')).toBe(false);
    expect(partVisibleFor(PIEZAS[3], 'male')).toBe(true);
    expect(partVisibleFor(PIEZAS[0], 'female')).toBe(true);
    expect(partVisibleFor(PIEZAS[0], 'male')).toBe(true);
    expect(partVisibleFor(utero, 'female')).toBe(true);
    expect(partVisibleFor(utero, 'male')).toBe(false);
  });

  it('en «Mujer» el sacro resalta el femenino y no el de referencia, y en «Hombre» al revés', () => {
    const sacros = [
      pieza('FMA16202', 'UBERON:0003690', { sex: 'male' }),
      pieza('VH_F_sacrum', 'UBERON:0003690', { sex: 'female', match: 'hra_exact' }),
    ];
    expect(meshesOf(sacros, 'UBERON:0003690', 'female')).toEqual(['VH_F_sacrum']);
    expect(meshesOf(sacros, 'UBERON:0003690', 'male')).toEqual(['FMA16202']);
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

  describe('estructuras compuestas (el pulmón no tiene malla, sus lóbulos sí)', () => {
    const LOBULOS: readonly AnatomyPart[] = [
      pieza('FMA7316', 'UBERON:0002170', { layer: 'organs', side: 'right' }),
      pieza('FMA7317', 'UBERON:0002171', { layer: 'organs', side: 'right' }),
      pieza('FMA7318', 'UBERON:0008952', { layer: 'organs', side: 'left' }),
      pieza('FMA9999', 'UBERON:0000981'),
    ];
    const COMPUESTAS = {
      'UBERON:0002048': ['UBERON:0002170', 'UBERON:0002171', 'UBERON:0008952'],
      'UBERON:0002167': ['UBERON:0002170', 'UBERON:0002171'],
    };

    it('una compuesta resalta las mallas de sus partes', () => {
      expect(meshesOf(LOBULOS, 'UBERON:0002167', 'male', COMPUESTAS)).toEqual(['FMA7316', 'FMA7317']);
      expect(meshesOf(LOBULOS, 'UBERON:0002048', 'male', COMPUESTAS)).toEqual(['FMA7316', 'FMA7317', 'FMA7318']);
    });

    it('sin el archivo de compuestas, una compuesta no resalta nada (como antes)', () => {
      expect(meshesOf(LOBULOS, 'UBERON:0002167', 'male')).toEqual([]);
    });

    it('una estructura de malla propia se resalta igual con o sin compuestas', () => {
      expect(meshesOf(LOBULOS, 'UBERON:0000981', 'male', COMPUESTAS)).toEqual(['FMA9999']);
      expect(structureIdsOf('UBERON:0000981', COMPUESTAS)).toEqual(['UBERON:0000981']);
    });

    it('las partes de una compuesta respetan la vista «Mujer»', () => {
      const soloVaron = [pieza('FMA1', 'UBERON:0000001', { sex: 'male' })];
      expect(meshesOf(soloVaron, 'UBERON:0000009', 'female', { 'UBERON:0000009': ['UBERON:0000001'] })).toEqual([]);
    });

    it('«tiene pieza» incluye a las compuestas', () => {
      const con = structuresWithMesh(LOBULOS, COMPUESTAS);
      expect(con.has('UBERON:0002048')).toBe(true);
      expect(con.has('UBERON:0002170')).toBe(true);
      expect(con.has('UBERON:0000007')).toBe(false);
    });

    it('una compuesta se dibuja si alguna parte suya está en una capa encendida', () => {
      expect(drawnStructures(LOBULOS, new Set(['organs']), 'male', COMPUESTAS).has('UBERON:0002167')).toBe(true);
      expect(drawnStructures(LOBULOS, new Set(['skeleton']), 'male', COMPUESTAS).has('UBERON:0002167')).toBe(false);
    });

    it('al relacionar con una compuesta se resaltan sus partes, no las de la propia estructura', () => {
      const ficha: AnatomyStructure = {
        ...FEMUR,
        id: 'UBERON:0002167',
        relations: [],
        incoming: [{ type: 'part_of', name: 'tiene como parte', source: 'UBERON:0008952', labelEn: 'x', labelEs: null }],
      };
      expect(relatedMeshes(LOBULOS, ficha, 'male', COMPUESTAS)).toEqual(['FMA7318']);
    });
  });
});

describe('pageOf', () => {
  const lista = Array.from({ length: 25 }, (_, i) => i + 1);

  it('devuelve la página pedida, de a `size`', () => {
    expect(pageOf(lista, 1, 10)).toEqual(lista.slice(0, 10));
    expect(pageOf(lista, 3, 10)).toEqual([21, 22, 23, 24, 25]);
  });

  it('acota una página fuera de rango a la última o a la primera', () => {
    expect(pageOf(lista, 99, 10)).toEqual([21, 22, 23, 24, 25]);
    expect(pageOf(lista, 0, 10)).toEqual(lista.slice(0, 10));
  });

  it('una lista vacía da una página vacía', () => {
    expect(pageOf([], 1, 10)).toEqual([]);
  });
});

describe('pageRelationGroups', () => {
  const item = (id: string) => ({ id, label: id, hasMesh: false, highlighted: false, inCatalog: true });
  const grupos = [
    { name: 'conectado con', items: [item('a'), item('b'), item('c')] },
    { name: 'forma parte de', items: [item('d'), item('e')] },
  ];

  it('cuenta filas entre todos los grupos, no grupos', () => {
    expect(pageRelationGroups(grupos, 1, 4).map((g) => [g.name, g.items.length])).toEqual([
      ['conectado con', 3],
      ['forma parte de', 1],
    ]);
  });

  it('un grupo partido entre dos páginas continúa en la siguiente', () => {
    const segunda = pageRelationGroups(grupos, 2, 4);
    expect(segunda.map((g) => [g.name, g.items.map((i) => i.id)])).toEqual([['forma parte de', ['e']]]);
  });
});
