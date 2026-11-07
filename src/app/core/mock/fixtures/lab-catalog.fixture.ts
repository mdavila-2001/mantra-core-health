import type {
  LabCatalogComponent,
  LabCatalogSection,
  LabSuggestedPrice,
} from '../../data-access/lab-portal/lab-import.types';

/* ============================================================================
    A small slice of the API's study catalog (`study_catalog/data`), for the
    simulator: same codes, LOINC and suggested prices as
    `precios-referencia-laboratorio.json` (INLASA 2026 first, else FONASA 2026
    in Bs). A component without a reviewed equivalence has no price.
    ========================================================================== */

const inlasa = (sourceCode: string, sourceName: string, priceBs: string): LabSuggestedPrice => ({
  source: 'INLASA',
  sourceCode,
  sourceName,
  priceBs,
});
const fonasa = (sourceCode: string, sourceName: string, priceBs: string): LabSuggestedPrice => ({
  source: 'FONASA',
  sourceCode,
  sourceName,
  priceBs,
});

let next = 0;
const id = (): string => `c0a7a1d0-0000-4000-8000-${String((next += 1)).padStart(12, '0')}`;

type Part = [
  code: string,
  name: string,
  loinc: string | null,
  unit: string | null,
  price?: LabSuggestedPrice,
];
const parts = (panel: string, list: readonly Part[]): LabCatalogComponent[] =>
  list.map(([code, name, loinc, unit, price]) => ({
    conceptId: id(),
    code: `${panel}.${code}`,
    name,
    loinc,
    unit,
    suggestedPrice: price ?? null,
  }));

export const LAB_CATALOG_SECTIONS: readonly LabCatalogSection[] = [
  {
    code: 'BIOQ',
    name: 'Bioquímica clínica',
    items: [
      {
        conceptId: id(),
        code: 'CREATININA',
        name: 'Creatinina',
        loinc: '2160-0',
        specimen: 'Suero',
        sampleType: 'BLOOD',
        suggestedPrice: inlasa('LAC-014', 'CREATININA SÉRICA', '40.00'),
        offeredServiceId: null,
        components: [],
      },
      {
        conceptId: id(),
        code: 'GLUCOSA',
        name: 'Glucosa en suero',
        loinc: '2345-7',
        specimen: 'Suero',
        sampleType: 'BLOOD',
        suggestedPrice: inlasa('LAC-025', 'GLUCOSA EN SANGRE', '40.00'),
        offeredServiceId: null,
        components: [],
      },
      {
        conceptId: id(),
        code: 'PERFIL_LIPIDICO',
        name: 'Perfil lipídico',
        loinc: '24331-1',
        specimen: 'Suero',
        sampleType: 'BLOOD',
        suggestedPrice: inlasa('LAC-039', 'PERFIL LIPIDICO', '138.00'),
        offeredServiceId: null,
        components: parts('PERFIL_LIPIDICO', [
          [
            'COL_TOTAL',
            'Colesterol total',
            '2093-3',
            'mg/dL',
            inlasa('LAC-010', 'COLESTEROL TOTAL', '40.00'),
          ],
          ['TRIGLICERIDOS', 'Triglicéridos', '2571-8', 'mg/dL'],
          [
            'HDL',
            'Colesterol HDL',
            '2085-9',
            'mg/dL',
            inlasa('LAC-009', 'HDL COLESTEROL', '48.00'),
          ],
          ['LDL', 'Colesterol LDL (calculado)', '13457-7', 'mg/dL'],
        ]),
      },
    ],
  },
  {
    code: 'ENDOCRINO',
    name: 'Endocrinología y hormonas',
    items: [
      {
        conceptId: id(),
        code: 'TSH',
        name: 'Hormona estimulante de tiroides (TSH)',
        loinc: '3016-3',
        specimen: 'Suero',
        sampleType: 'BLOOD',
        suggestedPrice: inlasa('LAC-071', 'TSH POR QUIMIOLUMINISCENCIA', '127.00'),
        offeredServiceId: null,
        components: [],
      },
    ],
  },
  {
    code: 'HEMATO',
    name: 'Hematología',
    items: [
      {
        conceptId: id(),
        code: 'HEMOGRAMA',
        name: 'Hemograma completo (con fórmula leucocitaria)',
        loinc: '57021-8',
        specimen: 'Sangre total con EDTA',
        sampleType: 'BLOOD',
        suggestedPrice: inlasa('LAC-030', 'HEMOGRAMA COMPLETO', '60.00'),
        offeredServiceId: null,
        components: parts('HEMOGRAMA', [
          [
            'LEUCOCITOS',
            'Leucocitos (recuento)',
            '6690-2',
            '10*3/uL',
            fonasa('03-01-065', 'RECUENTO DE LEUCOCITOS, ABSOLUTO (PROC. AUT.)', '9.25'),
          ],
          [
            'ERITROCITOS',
            'Eritrocitos (recuento)',
            '789-8',
            '10*6/uL',
            fonasa('03-01-064', 'RECUENTO DE ERITROCITOS, ABSOLUTO (PROC. AUT.)', '9.50'),
          ],
          [
            'HB',
            'Hemoglobina',
            '718-7',
            'g/dL',
            fonasa('03-01-038', 'HEMOGLOBINA EN SANGRE TOTAL (PROC. AUT.)', '9.75'),
          ],
          [
            'HTO',
            'Hematocrito',
            '4544-3',
            '%',
            fonasa('03-01-036', 'HEMATOCRITO (PROC. AUT.)', '9.75'),
          ],
          ['VCM', 'Volumen corpuscular medio (VCM)', '787-2', 'fL'],
          [
            'PLAQUETAS',
            'Plaquetas (recuento)',
            '777-3',
            '10*3/uL',
            inlasa('LAC-047', 'RECUENTO DE PLAQUETAS', '38.00'),
          ],
        ]),
      },
    ],
  },
  {
    code: 'URIANALISIS',
    name: 'Uroanálisis y orina',
    items: [
      {
        conceptId: id(),
        code: 'EGO',
        name: 'Examen general de orina',
        loinc: '24356-8',
        specimen: 'Orina aislada',
        sampleType: 'URINE',
        suggestedPrice: inlasa('LAC-019', 'EXAMEN GENERAL DE ORINA', '29.00'),
        offeredServiceId: null,
        components: parts('EGO', [
          ['COLOR', 'Color', '5778-6', null],
          ['DENSIDAD', 'Densidad', '5811-5', null],
          ['PH', 'pH', '5803-2', null],
          ['PROTEINAS', 'Proteínas', '5804-0', 'mg/dL'],
          ['GLUCOSA', 'Glucosa', '5792-7', 'mg/dL'],
          ['LEUCOCITOS', 'Leucocitos (sedimento)', '5821-4', '/[HPF]'],
        ]),
      },
    ],
  },
];
