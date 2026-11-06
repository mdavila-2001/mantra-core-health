import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { createOrderKindState, type OrderKindState } from './order-kind-state';

const TARGET_ESTUDIO = 'clinical.service_requests.code_concept_id';
const TARGET_MODALIDAD = 'clinical.service_requests.modality_concept_id';

const opcion = (code: string, display: string) => ({
  conceptId: `id-${code}`,
  code,
  display,
  ordinal: 0,
  isDefault: false,
});

const ESTUDIOS = [
  opcion('LAB_HEMOGRAMA', 'Hemograma completo'),
  opcion('LAB_ORINA', 'Orina completa'),
  opcion('IMG_RX_TORAX', 'Radiografía de tórax'),
  opcion('IMG_ECO_ABDOMINAL', 'Ecografía abdominal'),
  opcion('CAR_ECG', 'Electrocardiograma'),
];
const MODALIDADES = [
  opcion('IMG_MODALITY_BDUS', 'Densitometría por ultrasonido'),
  opcion('IMG_MODALITY_RX', 'Radiografía simple'),
  opcion('IMG_MODALITY_US', 'Ecografía'),
];

function crear(modalidades = MODALIDADES): {
  estado: OrderKindState;
  estudio: ReturnType<typeof signal<string | null>>;
} {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SystemContextClient,
        useValue: {
          dynamicEnum: (target: string) =>
            of({
              options:
                target === TARGET_ESTUDIO
                  ? ESTUDIOS
                  : target === TARGET_MODALIDAD
                    ? modalidades
                    : [],
            }),
        },
      },
    ],
  });
  const estudio = signal<string | null>(null);
  const estado = TestBed.runInInjectionContext(() =>
    createOrderKindState({ study: estudio, studyTarget: TARGET_ESTUDIO }),
  );
  return { estado, estudio };
}

describe('el tipo de orden y lo que organiza', () => {
  describe('correcto', () => {
    it('laboratorio: el tipo de análisis arma el árbol y limita las muestras', () => {
      const { estado } = crear();
      estado.chooseKind('LAB');
      estado.chooseLabType('BLOOD');

      expect(estado.labTree().length).toBeGreaterThan(0);
      expect(estado.specimenAccepts()?.('BLDV')).toBe(true);
      expect(estado.specimenAccepts()?.('UR')).toBe(false);
      expect(estado.performerTitle()).toBe('Qué laboratorio lo realiza');
    });

    it('imagen: el tipo de imagen filtra los estudios y trae su ficha', () => {
      const { estado } = crear();
      estado.chooseKind('IMAGING');
      estado.chooseModality('id-IMG_MODALITY_RX');

      expect(estado.imagingStudyOptions().map((o) => o.label)).toEqual(['Radiografía de tórax']);
      expect(estado.guidance()?.label).toBe('Rayos X');
      expect(estado.performerTitle()).toBe('Qué centro de imagen lo realiza');
    });

    it('imagen: los tipos con ficha propia se ofrecen primero', () => {
      const { estado } = crear();
      expect(estado.modalityOptions().map((o) => o.label)).toEqual([
        'Radiografía simple',
        'Ecografía',
        'Densitometría por ultrasonido',
      ]);
    });

    it('elegir primero el estudio de imagen deduce el tipo de imagen', () => {
      const { estado, estudio } = crear();
      estado.chooseKind('IMAGING');
      estado.chooseImagingStudy('id-IMG_ECO_ABDOMINAL');

      expect(estudio()).toBe('id-IMG_ECO_ABDOMINAL');
      expect(estado.modality()).toBe('id-IMG_MODALITY_US');
    });
  });

  describe('límite', () => {
    it('elegir el mismo tipo de orden no cambia nada y no borra lo elegido', () => {
      const { estado, estudio } = crear();
      estado.chooseKind('OTHER');
      estudio.set('id-CAR_ECG');

      expect(estado.chooseKind('OTHER')).toBe(false);
      expect(estudio()).toBe('id-CAR_ECG');
    });

    it('cambiar de tipo de orden no arrastra el estudio, el tipo de análisis ni el de imagen', () => {
      const { estado, estudio } = crear();
      estado.chooseKind('IMAGING');
      estado.chooseModality('id-IMG_MODALITY_RX');
      estudio.set('id-IMG_RX_TORAX');

      expect(estado.chooseKind('LAB')).toBe(true);

      expect(estudio()).toBeNull();
      expect(estado.modality()).toBeNull();
      expect(estado.labType()).toBeNull();
    });

    it('cambiar el tipo de imagen conserva el estudio sólo si es de ese tipo', () => {
      const { estado, estudio } = crear();
      estado.chooseKind('IMAGING');
      estado.chooseModality('id-IMG_MODALITY_RX');
      estudio.set('id-IMG_RX_TORAX');

      estado.chooseModality('id-IMG_MODALITY_US');

      expect(estudio()).toBeNull();
    });

    it('sin tipo de análisis elegido las muestras no se limitan', () => {
      const { estado } = crear();
      estado.chooseKind('LAB');
      expect(estado.specimenAccepts()).toBeNull();
    });
  });

  describe('inválido', () => {
    it('un estudio cuya modalidad el catálogo no trae deja el tipo de imagen sin elegir', () => {
      const { estado } = crear([opcion('IMG_MODALITY_RX', 'Radiografía simple')]);
      estado.chooseKind('IMAGING');
      estado.chooseImagingStudy('id-IMG_ECO_ABDOMINAL');

      expect(estado.modality()).toBeNull();
    });

    it('sin catálogo de tipos de imagen no se ofrece el filtro y el estudio igual se puede pedir', () => {
      const { estado, estudio } = crear([]);
      estado.chooseKind('IMAGING');
      expect(estado.hasModalities()).toBe(false);

      estado.chooseImagingStudy('id-IMG_RX_TORAX');
      expect(estudio()).toBe('id-IMG_RX_TORAX');
    });

    it('«otro estudio» no ofrece selector de ejecutor distinto del de procedimiento', () => {
      const { estado } = crear();
      estado.chooseKind('OTHER');
      expect(estado.performerApplies()).toBe(false);
      expect(estado.performerTitle()).toBe('Quién realiza el procedimiento');
    });
  });
});
