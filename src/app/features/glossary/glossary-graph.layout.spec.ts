import { describe, expect, it } from 'vitest';

import { GRAPH_METRICS, layoutTree, wrapText, type GraphNode } from './glossary-graph.layout';

function node(key: string, children: readonly GraphNode[] = [], extra: Partial<GraphNode> = {}): GraphNode {
  return {
    key,
    kind: 'term',
    label: key,
    tone: 'petrol',
    expandable: children.length > 0,
    expanded: children.length > 0,
    loading: false,
    children,
    ...extra,
  };
}

describe('wrapText', () => {
  it('parte por palabras sin pasarse del ancho', () => {
    expect(wrapText('dolor de cabeza intenso y persistente', 14, 4)).toEqual([
      'dolor de',
      'cabeza intenso',
      'y persistente',
    ]);
  });

  it('termina en puntos suspensivos cuando sobra texto', () => {
    const lines = wrapText('uno dos tres cuatro cinco seis siete ocho', 10, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(lines.every((line) => line.length <= 10)).toBe(true);
  });

  it('corta una palabra más larga que el renglón en vez de desbordarlo', () => {
    const [line] = wrapText('electroencefalografía', 8, 1);
    expect(line.length).toBeLessThanOrEqual(8);
    expect(line.endsWith('…')).toBe(true);
  });

  it('un texto vacío no tiene renglones', () => {
    expect(wrapText('   ', 10, 2)).toEqual([]);
  });
});

describe('layoutTree', () => {
  const tree = node('raiz', [
    node('a', [node('a1'), node('a2')]),
    node('b'),
  ]);
  const placed = layoutTree(tree);
  const at = (key: string) => placed.nodes.find((entry) => entry.node.key === key)!;

  it('pone cada nivel en su propia columna, de izquierda a derecha', () => {
    expect(at('raiz').x).toBeLessThan(at('a').x);
    expect(at('a').x).toBeLessThan(at('a1').x);
    expect(at('a').x).toBe(at('b').x);
  });

  it('centra al padre sobre sus hijos', () => {
    const centro = (key: string) => at(key).y + at(key).height / 2;
    expect(centro('a')).toBeCloseTo((centro('a1') + centro('a2')) / 2, 5);
    expect(centro('raiz')).toBeCloseTo((centro('a') + centro('b')) / 2, 5);
  });

  it('no superpone nodos de la misma columna', () => {
    const columna = placed.nodes.filter((entry) => entry.depth === 2).sort((p, q) => p.y - q.y);
    expect(columna[1].y).toBeGreaterThanOrEqual(columna[0].y + columna[0].height + GRAPH_METRICS.rowGap - 0.001);
  });

  it('une cada hijo con su padre y deja el lienzo del tamaño del árbol', () => {
    expect(placed.links.map((link) => `${link.from}>${link.to}`).sort()).toEqual(['a>a1', 'a>a2', 'raiz>a', 'raiz>b']);
    expect(placed.width).toBeGreaterThan(at('a1').x + at('a1').width);
    expect(placed.height).toBeGreaterThan(at('a2').y + at('a2').height);
  });

  it('un término con definición es más alto que uno sin ella', () => {
    const con = layoutTree(node('t', [], { definition: 'Una definición bastante larga para ocupar varios renglones del nodo.' }));
    const sin = layoutTree(node('t'));
    expect(con.nodes[0].height).toBeGreaterThan(sin.nodes[0].height);
    expect(con.nodes[0].lines.filter((line) => line.role === 'definition').length).toBeLessThanOrEqual(
      GRAPH_METRICS.maxDefinitionLines,
    );
    expect(con.nodes[0].separatorDy).not.toBeNull();
    expect(sin.nodes[0].separatorDy).toBeNull();
  });
});
