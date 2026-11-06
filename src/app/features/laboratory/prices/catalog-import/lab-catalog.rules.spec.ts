import { describe, expect, it } from 'vitest';

import type {
  LabCatalog,
  LabCatalogItem,
} from '../../../../core/data-access/lab-portal/lab-import.types';
import { catalogGroups } from './lab-catalog.rules';

const item = (code: string, sampleType: string, name = code): LabCatalogItem => ({
  conceptId: code,
  code,
  name,
  loinc: null,
  specimen: null,
  sampleType,
  suggestedPrice: null,
  offeredServiceId: null,
  components: [],
});

const CATALOG: LabCatalog = {
  count: 3,
  priceRule: '',
  catalogVersion: '2026-10-31',
  sampleTypes: [
    { code: 'BLOOD', name: 'Análisis de sangre' },
    { code: 'URINE', name: 'Análisis de orina' },
    { code: 'STOOL', name: 'Análisis de heces' },
  ],
  sections: [
    { code: 'BIOQ', name: 'Bioquímica', items: [item('GLU', 'BLOOD', 'Glucosa')] },
    {
      code: 'URO',
      name: 'Uroanálisis',
      items: [item('EGO', 'URINE', 'Examen general de orina'), item('UROCULTIVO', 'URINE')],
    },
  ],
};

const all = { sample: '', section: '', text: '' };

describe('catalogGroups', () => {
  it('one group per sample type with análisis, in the API order, with their section', () => {
    const groups = catalogGroups(CATALOG, all);
    expect(groups.map((g) => g.label)).toEqual(['Análisis de sangre', 'Análisis de orina']);
    expect(groups[1].items.map((i) => [i.code, i.sectionName])).toEqual([
      ['EGO', 'Uroanálisis'],
      ['UROCULTIVO', 'Uroanálisis'],
    ]);
  });

  it('filters by sample type, section and text', () => {
    expect(catalogGroups(CATALOG, { ...all, sample: 'URINE' }).map((g) => g.conceptId)).toEqual([
      'URINE',
    ]);
    expect(catalogGroups(CATALOG, { ...all, section: 'BIOQ' })[0].items).toHaveLength(1);
    expect(catalogGroups(CATALOG, { ...all, text: 'orina' })[0].items[0].code).toBe('EGO');
  });
});
