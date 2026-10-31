import type { LabAnalysisOption, LabComponentOption } from './lab-analysis-picker.logic';

/** Fábricas de catálogo para las pruebas (no se usan en producción). */
export function component(id: string, label: string, defaultSelected = true, unit?: string): LabComponentOption {
  return { conceptId: id, code: id.toUpperCase(), label, defaultSelected, ...(unit ? { unit } : {}) };
}

export const CBC: LabAnalysisOption = {
  conceptId: 'a-cbc',
  code: 'HEMOGRAMA',
  label: 'Hemograma completo',
  synonyms: ['biometría hemática', 'CBC'],
  section: 'HEMATO',
  specimen: { conceptId: 's-edta', label: 'Sangre con EDTA' },
  components: [
    component('c-hb', 'Hemoglobina', true, 'g/dL'),
    component('c-hto', 'Hematocrito', true, '%'),
    component('c-plq', 'Plaquetas', true),
    component('c-vsg', 'Velocidad de sedimentación', false),
  ],
};

export const GLUCOSE: LabAnalysisOption = {
  conceptId: 'a-glu',
  code: 'GLUCOSA',
  label: 'Glucosa en ayunas',
  synonyms: ['glicemia'],
  section: 'QUIM',
  specimen: { conceptId: 's-suero', label: 'Suero' },
  components: [],
};

export const LIPIDS: LabAnalysisOption = {
  conceptId: 'a-lip',
  code: 'LIPIDOS',
  label: 'Perfil lipídico',
  section: 'QUIM',
  components: [component('c-col', 'Colesterol total'), component('c-hdl', 'Colesterol HDL')],
};

export const CATALOG: readonly LabAnalysisOption[] = [CBC, GLUCOSE, LIPIDS];

/** Catálogo sintético del tamaño real: 532 análisis con `perPanel` componentes. */
export function bigCatalog(analyses = 532, perPanel = 20): readonly LabAnalysisOption[] {
  return Array.from({ length: analyses }, (_, i) => ({
    conceptId: `a-${i}`,
    code: `AN_${i}`,
    label: `Análisis ${i}`,
    section: `SEC_${i % 20}`,
    specimen: { conceptId: 's-suero', label: 'Suero' },
    components: Array.from({ length: perPanel }, (_, k) => component(`c-${i}-${k}`, `Componente ${i}.${k}`)),
  }));
}
