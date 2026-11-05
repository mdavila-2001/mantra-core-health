import { describe, expect, it } from 'vitest';

import { buildGraphSvg, graphDefinitions, graphFileName, type GraphExportColors } from './glossary-graph.export';
import { layoutTree, type GraphNode } from './glossary-graph.layout';

const colors: GraphExportColors = {
  surface: '#fff',
  ink: '#111',
  inkMuted: '#555',
  line: '#aaa',
  tones: { aqua: '#0aa', petrol: '#058', mint: '#0a6', sage: '#6a5', neutral: '#777' },
};

const arbol: GraphNode = {
  key: 'raiz',
  kind: 'term',
  label: 'Tos <aguda> & seca',
  sublabel: 'Signos y síntomas',
  conceptId: 'tos',
  tone: 'petrol',
  definition: 'Expulsión brusca del aire.',
  expandable: true,
  expanded: true,
  loading: false,
  children: [
    {
      key: 'raiz/g',
      kind: 'group',
      label: 'Enfermedades',
      sublabel: '1 término',
      tone: 'petrol',
      expandable: false,
      expanded: true,
      loading: false,
      children: [
        {
          key: 'raiz/g/t',
          kind: 'term',
          label: 'Neumonía',
          conceptId: 'neumonia',
          tone: 'petrol',
          expandable: true,
          expanded: false,
          loading: false,
          children: [],
        },
      ],
    },
  ],
};

describe('graphFileName', () => {
  it('quita acentos y espacios', () => {
    expect(graphFileName('Neumonía por Streptococcus', 'svg')).toBe('arbol-de-terminos-neumonia-por-streptococcus.svg');
    expect(graphFileName('', 'pdf')).toBe('arbol-de-terminos.pdf');
  });
});

describe('buildGraphSvg', () => {
  const svg = buildGraphSvg(layoutTree(arbol), 'Árbol de términos · Tos', colors);

  it('es un SVG autónomo con título, un nodo por término y una curva por rama', () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('<title>Árbol de términos · Tos</title>');
    expect((svg.match(/<path /g) ?? []).length).toBe(2);
    expect(svg).toContain('Neumonía');
    expect(svg).toContain('Expulsión brusca del aire.');
  });

  it('escapa el texto que viene del catálogo', () => {
    expect(svg).not.toContain('<aguda>');
    expect(svg).toContain('Tos &lt;aguda&gt; &amp; seca');
  });

  it('usa los colores ya resueltos, no variables de hoja de estilo', () => {
    expect(svg).toContain('#058');
    expect(svg).not.toContain('var(--');
  });
});

describe('graphDefinitions', () => {
  it('lista cada término una sola vez y avisa si no hay definición leída', () => {
    const filas = graphDefinitions(arbol);
    expect(filas.map((fila) => fila.term)).toEqual(['Tos <aguda> & seca', 'Neumonía']);
    expect(filas[0].definition).toBe('Expulsión brusca del aire.');
    expect(filas[1].definition).toContain('Sin definición leída');
  });
});
