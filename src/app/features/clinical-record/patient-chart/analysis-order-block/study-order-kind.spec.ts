import { describe, expect, it } from 'vitest';

import {
  BODY_REGIONS,
  IMAGING_MODALITIES,
  LAB_TYPES,
  bodyRegionOfAtlas,
  bodyRegionOfCode,
  imagingModalityCodeOf,
  imagingStudyOptions,
  labTreeFor,
  labTypeOfStudy,
  labTypesFor,
  labeledOptions,
  specimenFitsLabType,
  type StudyOption,
} from './study-order-kind';

const estudio = (code: string, label = code): StudyOption => ({ conceptId: `id-${code}`, code, label });

const CATALOGO: readonly StudyOption[] = [
  estudio('LAB_HEMOGRAMA', 'Hemograma completo'),
  estudio('clinical:LAB_ORINA', 'Orina completa'),
  estudio('LAB_COPROCULTIVO', 'Coprocultivo'),
  estudio('LAB_BACILOSCOPIA', 'Baciloscopia'),
  estudio('IMG_RX_TORAX', 'Radiografía de tórax'),
  estudio('IMG_ECO_ABDOMINAL', 'Ecografía abdominal'),
  estudio('CAR_ECG', 'Electrocardiograma'),
];

describe('árbol de laboratorio por tipo', () => {
  describe('correcto', () => {
    it('cada tipo muestra sólo sus estudios, con o sin prefijo de módulo', () => {
      const sangre = labTreeFor('BLOOD', CATALOGO);
      expect(sangre.map((g) => g.label)).toEqual(['Hematología']);
      expect(sangre[0].items.map((i) => i.label)).toEqual(['Hemograma completo']);
      expect(labTreeFor('URINE', CATALOGO)[0].items[0].value).toBe('id-clinical:LAB_ORINA');
      expect(labTreeFor('STOOL', CATALOGO)[0].items).toHaveLength(1);
    });
    it('clasifica un estudio por su código', () => {
      expect(labTypeOfStudy('LAB_HEMOGRAMA')).toBe('BLOOD');
      expect(labTypeOfStudy('clinical:lab_orina')).toBe('URINE');
    });
    it('la muestra se limita al tipo de análisis', () => {
      expect(specimenFitsLabType('URINE', 'UR24')).toBe(true);
      expect(specimenFitsLabType('URINE', 'BLDV')).toBe(false);
      expect(specimenFitsLabType('BLOOD', 'SER')).toBe(true);
    });
  });

  describe('límite', () => {
    it('Genético existe y no inventa estudios: su árbol está vacío y admite cualquier muestra', () => {
      expect(LAB_TYPES.map((t) => t.id)).toContain('GENETIC');
      expect(labTreeFor('GENETIC', CATALOGO)).toEqual([]);
      expect(specimenFitsLabType('GENETIC', 'SAL')).toBe(true);
    });
    it('un análisis fuera de la clasificación cae en «Otros análisis», que sólo aparece si hace falta', () => {
      expect(labTypesFor(CATALOGO).some((t) => t.id === 'UNCLASSIFIED')).toBe(false);
      const conNuevo = [...CATALOGO, estudio('LAB_NUEVO', 'Análisis nuevo')];
      expect(labTypesFor(conNuevo).at(-1)?.id).toBe('UNCLASSIFIED');
      expect(labTypeOfStudy('LAB_NUEVO')).toBe('UNCLASSIFIED');
      expect(labTreeFor('UNCLASSIFIED', conNuevo)[0].items.map((i) => i.label)).toEqual(['Análisis nuevo']);
    });
    it('una rama sin estudios en el catálogo no se muestra', () => {
      expect(labTreeFor('BLOOD', [estudio('LAB_TSH', 'TSH')]).map((g) => g.label)).toEqual(['Hormonas y marcadores']);
    });
  });

  describe('inválido', () => {
    it('un tipo desconocido o un catálogo vacío dan un árbol vacío, no un error', () => {
      expect(labTreeFor('BLOOD', [])).toEqual([]);
      expect(labTreeFor('NOPE' as never, CATALOGO)).toEqual([]);
    });
    it('un estudio de imagen o cardiología nunca entra al árbol de laboratorio', () => {
      const todo = LAB_TYPES.flatMap((t) => labTreeFor(t.id, CATALOGO)).flatMap((g) => g.items.map((i) => i.value));
      expect(todo).not.toContain('id-IMG_RX_TORAX');
      expect(todo).not.toContain('id-CAR_ECG');
    });
  });
});

describe('imagenología', () => {
  describe('correcto', () => {
    it('relaciona cada estudio con su modalidad por el prefijo de su código', () => {
      expect(imagingModalityCodeOf('IMG_RX_TORAX')).toBe('DU_MODALITY_XRAY');
      expect(imagingModalityCodeOf('IMG_ECO_RENAL')).toBe('DU_MODALITY_ULTRASOUND');
      expect(imagingModalityCodeOf('IMG_TC_CRANEO')).toBe('DU_MODALITY_CT');
      expect(imagingModalityCodeOf('IMG_RM_CEREBRAL')).toBe('DU_MODALITY_MRI');
      expect(imagingModalityCodeOf('IMG_MAMOGRAFIA')).toBe('DU_MODALITY_MAMMOGRAPHY');
      expect(imagingModalityCodeOf('IMG_DENSITOMETRIA')).toBe('DU_MODALITY_BONE_DENSITOMETRY');
    });
    it('filtra los estudios por la modalidad elegida; sin modalidad, todos los de imagen', () => {
      expect(imagingStudyOptions(CATALOGO, 'DU_MODALITY_XRAY').map((o) => o.label)).toEqual(['Radiografía de tórax']);
      expect(imagingStudyOptions(CATALOGO, null).map((o) => o.label)).toEqual([
        'Radiografía de tórax',
        'Ecografía abdominal',
      ]);
    });
    it('toda modalidad trae su ficha: qué hace y al menos algo que revisar', () => {
      for (const m of IMAGING_MODALITIES) {
        expect(m.whatItDoes.length).toBeGreaterThan(10);
        expect(m.review.length).toBeGreaterThan(0);
      }
    });
  });

  describe('límite', () => {
    it('las siete regiones se resuelven por código del atlas y por concepto', () => {
      expect(BODY_REGIONS).toHaveLength(7);
      expect(bodyRegionOfAtlas('R06')?.code).toBe('SR_REGION_UPPER_LIMB');
      expect(bodyRegionOfCode('clinical:SR_REGION_THORAX')?.atlas).toBe('R03');
    });
    it('las etiquetas de catálogo caen al nombre del catálogo si la pantalla no tiene palabra propia', () => {
      const opciones = labeledOptions(
        [
          { conceptId: 'a', code: 'COND_LAT_LEFT', display: 'Left' },
          { conceptId: 'b', code: 'OTRA', display: 'Other', displayEs: 'Otra' },
        ],
        { COND_LAT_LEFT: 'Izquierdo' },
      );
      expect(opciones.map((o) => o.label)).toEqual(['Izquierdo', 'Otra']);
    });
  });

  describe('inválido', () => {
    it('un código que no es de imagen, o desconocido, no tiene modalidad ni región', () => {
      expect(imagingModalityCodeOf('CAR_ECG')).toBeNull();
      expect(imagingModalityCodeOf('IMG_OTRA_COSA')).toBeNull();
      expect(bodyRegionOfAtlas('R99')).toBeNull();
      expect(bodyRegionOfCode(null)).toBeNull();
    });
  });
});
