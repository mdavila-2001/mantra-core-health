import type { AnatomyIndexEntry, AnatomyPart, AnatomyStructure } from '../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import {
  displayName,
  groupRelations,
  groupSentences,
  missingAspectsLabel,
  meshesOf,
  ontologyUrl,
  pageOf,
  pageRelationGroups,
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
  ta2: null,
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

  it('ordena por acierto en castellano: el nombre exacto, luego el que empieza así, luego el resto', () => {
    const indice: AnatomyIndexEntry[] = [
      ['UBERON:3', 'articulación humerocubital', 'humeroulnar joint', 1],
      ['UBERON:2', 'cabeza del húmero', 'proximal head of humerus', 1],
      ['UBERON:1', 'húmero distal', 'distal humerus', 0],
      ['UBERON:0', 'húmero', 'humerus', 1],
    ];
    // «humerocubital» sólo empieza con «humero»: entra, pero al final.
    const esperado = ['UBERON:0', 'UBERON:1', 'UBERON:2', 'UBERON:3'];
    expect(searchIndex(indice, 'húmero', 10).map((e) => e[0])).toEqual(esperado);
    expect(searchIndex(indice, 'HUMERO', 10).map((e) => e[0])).toEqual(esperado);
  });

  it('busca por varias palabras en cualquier orden, sin tildes', () => {
    const indice: AnatomyIndexEntry[] = [
      ['UBERON:2', 'cabeza del húmero', 'proximal head of humerus', 1],
      ['UBERON:1', 'cabeza del fémur', 'head of femur', 1],
    ];
    expect(searchIndex(indice, 'humero cabeza', 10).map((e) => e[0])).toEqual(['UBERON:2']);
    expect(searchIndex(indice, 'inexistente', 10)).toEqual([]);
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

  it('agrupa las frases por aspecto y numera las citas según la lista de fuentes', () => {
    const grupos = groupSentences({
      status: 'described',
      searchedQuery: 'femur',
      sentences: [
        { aspect: 'situation', es: 'A.', cites: ['PMID:9'] },
        { aspect: 'situation', es: 'B.', cites: ['PMID:7', 'PMID:9'] },
        { aspect: 'clinical', es: 'C.', cites: ['PMID:7', 'PMID:404'] },
      ],
      missingAspects: [],
      sources: [
        { id: 'PMID:9', pmid: '9', doi: null, title: 't', journal: null, year: null },
        { id: 'PMID:7', pmid: '7', doi: null, title: 't', journal: null, year: null },
      ],
    });
    expect(grupos.map((g) => g.label)).toEqual(['Situación', 'Relevancia clínica']);
    expect(grupos[0].sentences.map((s) => s.refs)).toEqual([[1], [2, 1]]);
    // Una cita fuera de la lista no se numera: no se inventa una fuente.
    expect(grupos[1].sentences[0].refs).toEqual([2]);
    expect(missingAspectsLabel(['irrigation', 'innervation'])).toBe('irrigación, inervación');
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
