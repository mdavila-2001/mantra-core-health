import { CATALOG, CBC, GLUCOSE, LIPIDS, component } from './lab-analysis-picker.fixtures';
import {
  buildSearchIndex,
  countBySection,
  defaultComponentIds,
  filterAnalyses,
  highlightSegments,
  isOrderable,
  normalizeText,
  parentState,
  queryTokens,
  removeAnalysis,
  selectMany,
  serializeSelection,
  setSpecimen,
  summarize,
  summaryText,
  toggleAnalysis,
  toggleComponent,
  type LabAnalysisOption,
  type LabSelection,
} from './lab-analysis-picker.logic';

const EMPTY: LabSelection = new Map();

describe('lab-analysis-picker.logic', () => {
  describe('texto', () => {
    it('normaliza tildes, mayúsculas y espacios', () => {
      expect(normalizeText('  Biometría HEMÁTICA ')).toBe('biometria hematica');
      expect(normalizeText('Ñandú')).toBe('nandu');
    });

    it('parte la búsqueda en palabras y devuelve vacío si no hay nada', () => {
      expect(queryTokens('  Hemoglobina   Glicosilada ')).toEqual(['hemoglobina', 'glicosilada']);
      expect(queryTokens('   ')).toEqual([]);
    });

    it('resalta sobre el texto original sin perder tildes ni mayúsculas', () => {
      const segments = highlightSegments('Biometría Hemática', ['biometria']);
      expect(segments).toEqual([
        { text: 'Biometría', match: true },
        { text: ' Hemática', match: false },
      ]);
    });

    it('resalta varias palabras y coincidencias repetidas', () => {
      const segments = highlightSegments('colesterol HDL colesterol', ['colesterol']);
      expect(segments.filter((s) => s.match).map((s) => s.text)).toEqual(['colesterol', 'colesterol']);
      expect(segments.map((s) => s.text).join('')).toBe('colesterol HDL colesterol');
    });

    it('sin coincidencia o sin palabras devuelve un único trozo', () => {
      expect(highlightSegments('Plaquetas', ['zzz'])).toEqual([{ text: 'Plaquetas', match: false }]);
      expect(highlightSegments('Plaquetas', [])).toEqual([{ text: 'Plaquetas', match: false }]);
      expect(highlightSegments('', ['a'])).toEqual([{ text: '', match: false }]);
    });
  });

  describe('filtro', () => {
    const index = buildSearchIndex(CATALOG);
    const ids = (q: string, section: string | null = null): string[] =>
      filterAnalyses(CATALOG, index, q, section).map((h) => h.analysis.conceptId);

    it('sin búsqueda ni sección devuelve todo en el orden del catálogo', () => {
      expect(ids('')).toEqual(['a-cbc', 'a-glu', 'a-lip']);
    });

    it('encuentra por nombre, código y sinónimo, sin tildes', () => {
      expect(ids('hemograma')).toEqual(['a-cbc']);
      expect(ids('GLUCOSA')).toEqual(['a-glu']);
      expect(ids('biometria hematica')).toEqual(['a-cbc']);
      expect(ids('glicemia')).toEqual(['a-glu']);
    });

    it('encuentra un análisis por el nombre de un componente y lo informa', () => {
      const [hit] = filterAnalyses(CATALOG, index, 'hemoglobina', null);
      expect(hit?.analysis.conceptId).toBe('a-cbc');
      expect(hit?.matchedAnalysis).toBe(false);
      expect([...(hit?.matchedComponentIds ?? [])]).toEqual(['c-hb']);
    });

    it('todas las palabras deben aparecer, repartidas entre análisis y componentes', () => {
      expect(ids('hemograma plaquetas')).toEqual(['a-cbc']);
      expect(ids('hemograma colesterol')).toEqual([]);
    });

    it('filtra por sección y la combina con la búsqueda', () => {
      expect(ids('', 'QUIM')).toEqual(['a-glu', 'a-lip']);
      expect(ids('colesterol', 'QUIM')).toEqual(['a-lip']);
      expect(ids('colesterol', 'HEMATO')).toEqual([]);
    });

    it('cuenta análisis por sección', () => {
      expect(Object.fromEntries(countBySection(CATALOG))).toEqual({ HEMATO: 1, QUIM: 2 });
    });
  });

  describe('marcar un análisis', () => {
    it('entran los componentes por defecto y la muestra del catálogo (D3)', () => {
      const next = toggleAnalysis(EMPTY, CBC);
      expect([...(next.get('a-cbc')?.components ?? [])]).toEqual(['c-hb', 'c-hto', 'c-plq']);
      expect(next.get('a-cbc')?.specimenConceptId).toBe('s-edta');
    });

    it('si ningún componente viene por defecto entran todos', () => {
      const panel: LabAnalysisOption = { ...LIPIDS, components: [component('x', 'X', false), component('y', 'Y', false)] };
      expect([...defaultComponentIds(panel)]).toEqual(['x', 'y']);
    });

    it('no muta la selección original', () => {
      const next = toggleAnalysis(EMPTY, CBC);
      expect(EMPTY.size).toBe(0);
      expect(next).not.toBe(EMPTY);
    });

    it('un análisis simple alterna presente / ausente', () => {
      const on = toggleAnalysis(EMPTY, GLUCOSE);
      expect(on.has('a-glu')).toBe(true);
      expect(parentState(GLUCOSE, on.get('a-glu'))).toBe('all');
      expect(toggleAnalysis(on, GLUCOSE).has('a-glu')).toBe(false);
    });

    it('un análisis simple sin muestra en el catálogo queda con muestra null', () => {
      const simple: LabAnalysisOption = { ...GLUCOSE, specimen: undefined };
      expect(toggleAnalysis(EMPTY, simple).get('a-glu')?.specimenConceptId).toBeNull();
    });
  });

  describe('tri-estado del padre', () => {
    it('none / some / all según los componentes marcados', () => {
      expect(parentState(CBC, undefined)).toBe('none');
      const marked = toggleAnalysis(EMPTY, CBC); // 3 de 4
      expect(parentState(CBC, marked.get('a-cbc'))).toBe('some');
      const all = toggleComponent(marked, CBC, 'c-vsg', true);
      expect(parentState(CBC, all.get('a-cbc'))).toBe('all');
      const none = ['c-hb', 'c-hto', 'c-plq'].reduce((s, id) => toggleComponent(s, CBC, id, false), marked);
      expect(parentState(CBC, none.get('a-cbc'))).toBe('none');
    });

    it('clic en el padre: none → por defecto, some → todos, all → quita', () => {
      const first = toggleAnalysis(EMPTY, CBC);
      expect(first.get('a-cbc')?.components.size).toBe(3);
      const second = toggleAnalysis(first, CBC);
      expect(second.get('a-cbc')?.components.size).toBe(4);
      const third = toggleAnalysis(second, CBC);
      expect(third.has('a-cbc')).toBe(false);
    });

    it('clic en el padre de un panel presente pero vacío vuelve a los componentes por defecto y conserva la muestra', () => {
      let s = setSpecimen(toggleAnalysis(EMPTY, LIPIDS), 'a-lip', 's-otro');
      s = toggleComponent(toggleComponent(s, LIPIDS, 'c-col', false), LIPIDS, 'c-hdl', false);
      expect(parentState(LIPIDS, s.get('a-lip'))).toBe('none');
      const again = toggleAnalysis(s, LIPIDS);
      expect(again.get('a-lip')?.components.size).toBe(2);
      expect(again.get('a-lip')?.specimenConceptId).toBe('s-otro');
    });
  });

  describe('marcar componentes', () => {
    it('marcar un componente de un análisis no elegido lo elige con sólo ese componente', () => {
      const next = toggleComponent(EMPTY, CBC, 'c-hb', true);
      expect([...(next.get('a-cbc')?.components ?? [])]).toEqual(['c-hb']);
      expect(next.get('a-cbc')?.specimenConceptId).toBe('s-edta');
    });

    it('desmarcar en un análisis no elegido no hace nada', () => {
      expect(toggleComponent(EMPTY, CBC, 'c-hb', false)).toBe(EMPTY);
    });

    it('un componente ajeno al análisis se ignora', () => {
      const s = toggleAnalysis(EMPTY, CBC);
      expect(toggleComponent(s, CBC, 'c-col', true)).toBe(s);
    });

    it('desmarcar el último deja el análisis presente pero sin pedido', () => {
      let s = toggleComponent(EMPTY, CBC, 'c-hb', true);
      s = toggleComponent(s, CBC, 'c-hb', false);
      expect(s.has('a-cbc')).toBe(true);
      expect(isOrderable(CBC, s.get('a-cbc'))).toBe(false);
    });
  });

  describe('muestra, quitar y marcar muchos', () => {
    it('cambia la muestra de un análisis elegido', () => {
      const s = setSpecimen(toggleAnalysis(EMPTY, CBC), 'a-cbc', 's-otro');
      expect(s.get('a-cbc')?.specimenConceptId).toBe('s-otro');
      expect([...(s.get('a-cbc')?.components ?? [])]).toHaveLength(3);
    });

    it('cambiar la muestra de algo no elegido, o a la misma, devuelve la misma selección', () => {
      expect(setSpecimen(EMPTY, 'a-cbc', 's-x')).toBe(EMPTY);
      const s = toggleAnalysis(EMPTY, CBC);
      expect(setSpecimen(s, 'a-cbc', 's-edta')).toBe(s);
    });

    it('la muestra puede quedar en null', () => {
      expect(setSpecimen(toggleAnalysis(EMPTY, CBC), 'a-cbc', null).get('a-cbc')?.specimenConceptId).toBeNull();
    });

    it('quitar un análisis ausente devuelve la misma selección', () => {
      expect(removeAnalysis(EMPTY, 'a-cbc')).toBe(EMPTY);
      expect(removeAnalysis(toggleAnalysis(EMPTY, CBC), 'a-cbc').size).toBe(0);
    });

    it('selectMany marca los visibles sin pisar lo ya elegido y los quita al desmarcar', () => {
      const custom = toggleComponent(EMPTY, CBC, 'c-hb', true);
      const all = selectMany(custom, CATALOG, true);
      expect([...(all.get('a-cbc')?.components ?? [])]).toEqual(['c-hb']);
      expect(all.has('a-glu')).toBe(true);
      expect(all.get('a-lip')?.components.size).toBe(2);
      expect(selectMany(all, [GLUCOSE], false).has('a-glu')).toBe(false);
    });
  });

  describe('resumen y serialización', () => {
    it('cuenta análisis y componentes; un simple cuenta como un componente', () => {
      let s = toggleAnalysis(EMPTY, CBC); // 3
      s = toggleAnalysis(s, GLUCOSE); // 1
      const summary = summarize(CATALOG, s);
      expect(summary).toMatchObject({ analysisCount: 2, componentCount: 4, incompleteAnalysisIds: [] });
      expect(summaryText(summary)).toBe('2 análisis · 4 componentes');
    });

    it('usa singular cuando corresponde', () => {
      const s = toggleAnalysis(EMPTY, GLUCOSE);
      expect(summaryText(summarize(CATALOG, s))).toBe('1 análisis · 1 componente');
    });

    it('un panel sin componentes se avisa y NO cuenta ni se serializa', () => {
      let s = toggleComponent(EMPTY, LIPIDS, 'c-col', true);
      s = toggleComponent(s, LIPIDS, 'c-col', false);
      const summary = summarize(CATALOG, s);
      expect(summary.analysisCount).toBe(0);
      expect(summary.incompleteAnalysisIds).toEqual(['a-lip']);
      expect(serializeSelection(CATALOG, s)).toEqual([]);
    });

    it('serializa en el orden del catálogo, con componentes en orden del catálogo', () => {
      let s = toggleComponent(EMPTY, CBC, 'c-plq', true);
      s = toggleComponent(s, CBC, 'c-hb', true);
      s = toggleAnalysis(s, LIPIDS);
      s = toggleAnalysis(s, GLUCOSE);
      expect(serializeSelection(CATALOG, s)).toEqual([
        { analysisConceptId: 'a-cbc', componentConceptIds: ['c-hb', 'c-plq'], specimenConceptId: 's-edta' },
        { analysisConceptId: 'a-glu', componentConceptIds: [], specimenConceptId: 's-suero' },
        { analysisConceptId: 'a-lip', componentConceptIds: ['c-col', 'c-hdl'], specimenConceptId: null },
      ]);
    });

    it('ignora entradas de análisis que ya no están en el catálogo', () => {
      const s: LabSelection = new Map([['viejo', { components: new Set(['x']), specimenConceptId: null }]]);
      expect(serializeSelection(CATALOG, s)).toEqual([]);
      expect(summarize(CATALOG, s).analysisCount).toBe(0);
    });

    it('selección vacía: todo en cero', () => {
      expect(summarize(CATALOG, EMPTY)).toEqual({ analysisCount: 0, componentCount: 0, incompleteAnalysisIds: [] });
      expect(serializeSelection(CATALOG, EMPTY)).toEqual([]);
    });
  });
});
