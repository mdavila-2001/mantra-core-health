import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { SystemContextClient } from '../../../../../core/data-access/system-context/system-context.client';
import type { StudyFamily } from '../study-category';
import { StudyDetailSection } from './study-detail-section';

const opcion = (code: string) => ({
  conceptId: `id-${code}`,
  code,
  display: code,
  ordinal: 0,
  isDefault: false,
});

@Component({
  imports: [StudyDetailSection],
  template: `<app-study-detail-section
    [family]="family()"
    [specimenAccepts]="accepts()"
    [modalityPreset]="preset()"
  />`,
})
class Anfitrion {
  readonly family = signal<StudyFamily | null>('IMAGING');
  readonly accepts = signal<((code: string) => boolean) | null>(null);
  readonly preset = signal<string | null>(null);
}

describe('StudyDetailSection: tipo de imagen y contraste', () => {
  function montar() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SystemContextClient,
          useValue: {
            dynamicEnum: (target: string) =>
              of({
                options: target.includes('specimen')
                  ? [opcion('BLDV'), opcion('UR')]
                  : target.includes('contrast')
                    ? [opcion('IMG_CONTRAST_NONE')]
                    : [],
              }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const seccion = fixture.debugElement.children[0]!.componentInstance as StudyDetailSection;
    return {
      fixture,
      host: fixture.componentInstance,
      seccion,
      el: fixture.nativeElement as HTMLElement,
    };
  }

  describe('correcto', () => {
    it('el tipo de imagen elegido arriba viaja como modalidad y no se vuelve a preguntar', () => {
      const { fixture, host, seccion, el } = montar();
      host.preset.set('id-IMG_MODALITY_RX');
      fixture.detectChanges();

      expect(seccion.fields().modalityConceptId).toBe('id-IMG_MODALITY_RX');
      expect(el.querySelector('[data-testid="order-modality"]')).toBeNull();
    });

    it('con tipo de imagen se ofrece el contraste y viaja', () => {
      const { fixture, host, seccion, el } = montar();
      host.preset.set('id-IMG_MODALITY_RX');
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="order-contrast"]')).not.toBeNull();

      seccion['contrast'].set('id-IMG_CONTRAST_NONE');
      expect(seccion.fields().contrastConceptId).toBe('id-IMG_CONTRAST_NONE');
    });

    it('laboratorio: la muestra se limita a las que admite el tipo de análisis', () => {
      const { fixture, host, el } = montar();
      host.family.set('LAB');
      host.accepts.set((code) => code === 'BLDV');
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="order-specimen"]')).not.toBeNull();
    });
  });

  describe('límite', () => {
    it('sin tipo de imagen elegido arriba se ofrece el campo de modalidad opcional', () => {
      const { el } = montar();
      expect(el.querySelector('[data-testid="order-modality"]')).not.toBeNull();
    });

    it('cambiar el tipo de imagen borra el contraste: era de otro tipo', () => {
      const { fixture, host, seccion } = montar();
      host.preset.set('id-IMG_MODALITY_RX');
      fixture.detectChanges();
      seccion['contrast'].set('id-IMG_CONTRAST_NONE');

      host.preset.set('id-IMG_MODALITY_US');
      fixture.detectChanges();

      expect(seccion.fields().contrastConceptId).toBeUndefined();
    });

    it('reiniciar el detalle conserva el tipo de imagen elegido arriba', () => {
      const { fixture, host, seccion } = montar();
      host.preset.set('id-IMG_MODALITY_RX');
      fixture.detectChanges();

      seccion.reset();

      expect(seccion.fields().modalityConceptId).toBe('id-IMG_MODALITY_RX');
    });
  });

  describe('inválido', () => {
    it('el contraste no viaja sin tipo de imagen: la API lo rechazaría', () => {
      const { seccion } = montar();
      seccion['contrast'].set('id-IMG_CONTRAST_NONE');
      expect(seccion.fields().contrastConceptId).toBeUndefined();
    });

    it('quitar el tipo de imagen elegido arriba quita la modalidad que viajaba', () => {
      const { fixture, host, seccion } = montar();
      host.preset.set('id-IMG_MODALITY_RX');
      fixture.detectChanges();
      host.preset.set(null);
      fixture.detectChanges();

      expect(seccion.fields().modalityConceptId).toBeUndefined();
    });
  });
});
