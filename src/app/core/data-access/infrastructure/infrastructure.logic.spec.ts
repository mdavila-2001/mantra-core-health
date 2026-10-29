import { parseSpacesCsv } from './infrastructure.csv';
import {
  allowedChildForms,
  ancestorsOf,
  buildSpaceTree,
  expandPattern,
  functionsFor,
  missingRequiredFunctions,
  subtreeIds,
} from './infrastructure.logic';
import type { CareSpaceNode, InfrastructureCatalog } from './infrastructure.types';

function nodo(id: string, code: string, parentId: string | null, fn = 'SPACE_FN_GENERIC', estado = 'SPACE_ACTIVE'): CareSpaceNode {
  return {
    id,
    parentId,
    code,
    name: code,
    form: { code: 'LOC_FORM_ROOM', display: 'Local' },
    function: { code: fn, display: fn },
    status: { code: estado, display: estado },
    operationalStatus: null,
    clinicalUnitId: null,
    capacity: null,
    rowVersion: 1,
    childCount: 0,
  };
}

describe('expandPattern', () => {
  it('expande letras: 301-{A..H} son ocho camas', () => {
    const r = expandPattern('301-{A..H}', 'Cama 301-{A..H}');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items.length).toBe(8);
      expect(r.items[0]).toEqual({ code: '301-A', name: 'Cama 301-A' });
      expect(r.items[7]).toEqual({ code: '301-H', name: 'Cama 301-H' });
    }
  });

  it('expande números y conserva el relleno con ceros', () => {
    const r = expandPattern('CAMA-{01..12}', 'Cama {01..12}');
    expect(r.ok && r.items.map((i) => i.code).slice(0, 2)).toEqual(['CAMA-01', 'CAMA-02']);
    expect(r.ok && r.items.at(-1)?.code).toBe('CAMA-12');
  });

  it('agrega el valor al nombre si el patrón del nombre no trae rango', () => {
    const r = expandPattern('B-{1..2}', 'Box');
    expect(r.ok && r.items.map((i) => i.name)).toEqual(['Box 1', 'Box 2']);
  });

  it('rechaza más de 200, rangos al revés, mezclas y varios rangos', () => {
    expect(expandPattern('X-{1..201}', 'X {1..201}').ok).toBe(false);
    expect(expandPattern('X-{1..200}', 'X {1..200}').ok).toBe(true);
    expect(expandPattern('X-{9..1}', 'X').ok).toBe(false);
    expect(expandPattern('X-{A..9}', 'X').ok).toBe(false);
    expect(expandPattern('X-{A..C}-{1..2}', 'X').ok).toBe(false);
    expect(expandPattern('X-1', 'X').ok).toBe(false);
    expect(expandPattern('', 'X').ok).toBe(false);
  });
});

describe('árbol', () => {
  const lista = [
    nodo('a', 'ED-A', null),
    nodo('p3', 'P3', 'a'),
    nodo('p10', 'P10', 'a'),
    nodo('h', 'HAB-301', 'p3'),
    nodo('huerfano', 'Z', 'no-existe'),
  ];

  it('ordena hermanos con los números en orden natural', () => {
    const arbol = buildSpaceTree(lista);
    const piso = arbol.find((n) => n.space.id === 'a')!;
    expect(piso.children.map((c) => c.space.code)).toEqual(['P3', 'P10']);
  });

  it('cuelga de la raíz el nodo cuyo padre no está, en vez de perderlo', () => {
    expect(buildSpaceTree(lista).map((n) => n.space.id)).toContain('huerfano');
  });

  it('un filtro quita nodos y los hijos quedan colgados de la raíz', () => {
    const arbol = buildSpaceTree(lista, (s) => s.id !== 'p3');
    expect(arbol.some((n) => n.space.id === 'h')).toBe(true);
  });

  it('sobrevive a un ciclo en los datos', () => {
    const ciclo = [nodo('x', 'X', 'y'), nodo('y', 'Y', 'x')];
    expect(() => buildSpaceTree(ciclo)).not.toThrow();
    expect(ancestorsOf(ciclo, 'x').length).toBeLessThanOrEqual(2);
  });

  it('subtreeIds incluye al nodo y a todos sus descendientes', () => {
    expect([...subtreeIds(lista, 'a')].sort()).toEqual(['a', 'h', 'p10', 'p3']);
  });

  it('ancestorsOf va de la raíz hacia el nodo', () => {
    expect(ancestorsOf(lista, 'h').map((n) => n.id)).toEqual(['a', 'p3']);
  });
});

describe('reglas del catálogo', () => {
  const perfil = (code: string, forms: string[]) =>
    ({
      code,
      display: code,
      forms,
      schedulable: false,
      inpatient: false,
      billable: false,
      allowOverlap: false,
      isolationCapable: false,
      stockPoint: false,
      hostsEquipment: false,
      requiresTerminalCleaning: false,
      requiresArea: false,
      requiresHvac: false,
    }) as const;

  const catalogo = {
    forms: [],
    functions: [
      perfil('SPACE_FN_CONSULTING_ROOM', ['LOC_FORM_ROOM']),
      perfil('SPACE_FN_OPERATING_ROOM', ['LOC_FORM_ROOM']),
      perfil('SPACE_FN_BED_STANDARD', ['LOC_FORM_BED']),
    ],
    parentRules: [
      { parent: 'LOC_FORM_BUILDING', child: 'LOC_FORM_LEVEL' },
      { parent: 'LOC_FORM_ROOM', child: 'LOC_FORM_BED' },
    ],
    typologyRules: [
      { typology: 'TYPOLOGY_HEALTH_POST', function: 'SPACE_FN_CONSULTING_ROOM', rule: 'TYPO_ALLOWED' },
      { typology: 'TYPOLOGY_HOSPITAL_L2', function: 'SPACE_FN_OPERATING_ROOM', rule: 'TYPO_REQUIRED' },
      { typology: 'TYPOLOGY_HOSPITAL_L2', function: 'SPACE_FN_CONSULTING_ROOM', rule: 'TYPO_ALLOWED' },
    ],
  } as unknown as InfrastructureCatalog;

  it('ofrece sólo las formas que el catálogo deja bajo el padre', () => {
    expect(allowedChildForms(catalogo, 'LOC_FORM_ROOM')).toEqual(['LOC_FORM_BED']);
    expect(allowedChildForms(catalogo, 'LOC_FORM_BED')).toEqual([]);
  });

  it('sin regla de raíz en el catálogo usa la de reserva', () => {
    expect(allowedChildForms(catalogo, null)).toContain('LOC_FORM_BUILDING');
    expect(allowedChildForms(catalogo, null)).not.toContain('LOC_FORM_BED');
  });

  it('la tipología con lista restringe las funciones; sin reglas no restringe', () => {
    expect(functionsFor(catalogo, 'LOC_FORM_ROOM', 'TYPOLOGY_HEALTH_POST').map((f) => f.code)).toEqual([
      'SPACE_FN_CONSULTING_ROOM',
    ]);
    expect(functionsFor(catalogo, 'LOC_FORM_ROOM', null).length).toBe(2);
    expect(functionsFor(catalogo, 'LOC_FORM_ROOM', 'TYPOLOGY_LABORATORY').length).toBe(2);
  });

  it('las funciones obligatorias que faltan ignoran los espacios clausurados', () => {
    const q = nodo('q', 'Q', null, 'SPACE_FN_OPERATING_ROOM', 'SPACE_RETIRED');
    expect(missingRequiredFunctions(catalogo, 'TYPOLOGY_HOSPITAL_L2', [q])).toEqual(['SPACE_FN_OPERATING_ROOM']);
    const activo = nodo('q', 'Q', null, 'SPACE_FN_OPERATING_ROOM');
    expect(missingRequiredFunctions(catalogo, 'TYPOLOGY_HOSPITAL_L2', [activo])).toEqual([]);
  });
});

describe('parseSpacesCsv', () => {
  it('lee filas y numera por línea del archivo, saltando las vacías', () => {
    const csv = 'code,name,formCode,functionCode,parentCode,capacity\nA,Uno,LOC_FORM_ROOM,SPACE_FN_X,,\n\nB,Dos,LOC_FORM_ROOM,SPACE_FN_X,A,2';
    const r = parseSpacesCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.line)).toEqual([2, 4]);
    expect(r.rows[1].row).toMatchObject({ code: 'B', parentCode: 'A', capacity: 2 });
  });

  it('acepta punto y coma y comillas', () => {
    const r = parseSpacesCsv('code;name;formCode;functionCode\nA;"Sala ""norte"", 2";LOC_FORM_ROOM;F');
    expect(r.rows[0].row.name).toBe('Sala "norte", 2');
  });

  it('informa columna desconocida y obligatoria ausente', () => {
    const r = parseSpacesCsv('code,nombre\nA,B');
    expect(r.rows).toEqual([]);
    expect(r.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['nombre', 'name', 'formCode', 'functionCode']));
  });

  it('un número mal escrito se informa con su línea y no entra', () => {
    const r = parseSpacesCsv('code,name,formCode,functionCode,areaM2\nA,Uno,F,G,abc\nB,Dos,F,G,12,5');
    expect(r.errors).toEqual([{ line: 2, field: 'areaM2', reason: '«abc» no es un número.' }]);
  });

  it('archivo vacío y sin datos', () => {
    expect(parseSpacesCsv('').errors[0].reason).toMatch(/vacío/);
    expect(parseSpacesCsv('code,name,formCode,functionCode').errors[0].reason).toMatch(/ninguna fila/);
  });
});
