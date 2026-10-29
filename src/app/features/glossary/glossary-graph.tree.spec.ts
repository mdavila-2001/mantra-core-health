import { describe, expect, it } from 'vitest';

import type {
  GlossaryNeighbor,
  GlossaryNeighborGroup,
  GlossaryNeighborhood,
} from '../../core/data-access/terminology/terminology.types';
import { buildTermTree, countNodes, GRAPH_GROUP_PAGE, termsOf, type TreeInputs } from './glossary-graph.tree';

const category = (internalCode: string, name: string) => ({ internalCode, name }) as never;

function neighbor(id: string, display: string, code: string, name: string): GlossaryNeighbor {
  return { conceptId: id, slug: id, display, category: category(code, name) };
}

function hood(id: string, display: string, groups: readonly GlossaryNeighborGroup[], def = ''): GlossaryNeighborhood {
  return {
    focus: { conceptId: id, slug: id, display, category: null, shortDefinition: def },
    groups,
  };
}

const symptoms = (ids: readonly string[]): GlossaryNeighborGroup => ({
  type: 'SYMPTOM',
  direction: 'outgoing',
  total: ids.length,
  items: ids.map((id) => neighbor(id, `Síntoma ${id}`, 'glossary-category-signs-symptoms', 'Signos y síntomas')),
});

function inputs(over: Partial<TreeInputs> = {}): TreeInputs {
  return {
    rootId: 'neumonia',
    neighborhoods: new Map([['neumonia', hood('neumonia', 'Neumonía', [symptoms(['tos', 'fiebre'])], 'Infección del pulmón.')]]),
    expanded: new Set(['neumonia']),
    loading: new Set(),
    definitions: new Map(),
    visibleByGroup: new Map(),
    showDefinitions: false,
    ...over,
  };
}

describe('buildTermTree', () => {
  it('sin vecindario de la raíz no hay árbol', () => {
    expect(buildTermTree(inputs({ neighborhoods: new Map() }))).toBeNull();
  });

  it('la raíz abierta tiene un grupo por columna y un término por vecino', () => {
    const tree = buildTermTree(inputs())!;
    expect(tree.label).toBe('Neumonía');
    expect(tree.definition).toBe('Infección del pulmón.');
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].kind).toBe('group');
    expect(tree.children[0].children.map((child) => child.label)).toEqual(['Síntoma fiebre', 'Síntoma tos']);
  });

  it('una raíz cerrada no tiene hijos', () => {
    expect(buildTermTree(inputs({ expanded: new Set() }))!.children).toEqual([]);
  });

  it('corta el grupo en la página y ofrece «+N más»', () => {
    const ids = Array.from({ length: GRAPH_GROUP_PAGE + 3 }, (_, i) => `s${String(i).padStart(2, '0')}`);
    const tree = buildTermTree(
      inputs({ neighborhoods: new Map([['neumonia', hood('neumonia', 'Neumonía', [symptoms(ids)])]]) }),
    )!;
    const children = tree.children[0].children;
    expect(children).toHaveLength(GRAPH_GROUP_PAGE + 1);
    expect(children.at(-1)).toMatchObject({ kind: 'more', label: '+3 más' });
  });

  it('un término abierto despliega sus propios grupos y no vuelve a su origen', () => {
    const neighborhoods = new Map([
      ['neumonia', hood('neumonia', 'Neumonía', [symptoms(['tos'])])],
      [
        'tos',
        hood('tos', 'Tos', [
          {
            type: 'SYMPTOM',
            direction: 'incoming',
            total: 2,
            items: [
              neighbor('neumonia', 'Neumonía', 'glossary-category-disease', 'Enfermedad'),
              neighbor('asma', 'Asma', 'glossary-category-disease', 'Enfermedad'),
            ],
          },
        ], 'Reflejo para expulsar el aire.'),
      ],
    ]);
    const tree = buildTermTree(inputs({ neighborhoods, expanded: new Set(['neumonia', 'tos']) }))!;
    const tos = tree.children[0].children[0];
    expect(tos.definition).toBe('Reflejo para expulsar el aire.');
    const nombres = termsOf(tos).map((term) => term.label);
    expect(nombres).toContain('Asma');
    expect(nombres.filter((name) => name === 'Neumonía')).toHaveLength(0);
  });

  it('las definiciones leídas aparte sólo se dibujan si se pidieron', () => {
    const definitions = new Map([['tos', 'Definición de la tos.']]);
    const sin = buildTermTree(inputs({ definitions }))!;
    expect(sin.children[0].children.find((c) => c.conceptId === 'tos')?.definition).toBeUndefined();
    const con = buildTermTree(inputs({ definitions, showDefinitions: true }))!;
    expect(con.children[0].children.find((c) => c.conceptId === 'tos')?.definition).toBe('Definición de la tos.');
  });

  it('cuenta términos y grupos', () => {
    expect(countNodes(buildTermTree(inputs())!)).toEqual({ terms: 3, groups: 1 });
  });
});
