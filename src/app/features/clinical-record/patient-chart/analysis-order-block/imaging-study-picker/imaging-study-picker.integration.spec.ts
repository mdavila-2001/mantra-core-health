import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, PLATFORM_ID, signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { BodyRegionPicker } from '../../../../../shared/components/organisms/body-region-picker/body-region-picker';
import {
  ARCHIVO,
  CATALOGO,
  PARTES,
} from '../../../../../shared/components/organisms/body-region-picker/body-region-picker.testing';
import { CONTRAST, MODALITIES, RX_MANO, STUDIES } from './imaging-study-picker.fixtures';
import { ImagingStudyPicker } from './imaging-study-picker';
import type { ImagingSelection } from './imaging-study-picker.logic';

/** Con el selector de región REAL (sin doble): el contrato entre los dos componentes. */
@Component({
  imports: [ImagingStudyPicker],
  template: `
    <app-imaging-study-picker
      [modalities]="modalities"
      [studies]="studies"
      [regions]="regions"
      [contrastOptions]="contrast"
      [(selection)]="selection"
    />
  `,
})
class HostComponent {
  readonly modalities = MODALITIES;
  readonly studies = STUDIES;
  readonly regions = CATALOGO;
  readonly contrast = CONTRAST;
  readonly selection = signal<ImagingSelection | null>(null);
}

describe('ImagingStudyPicker con el selector de región real', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('al elegir un estudio, el selector de región carga el atlas y queda con la región del estudio', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PLATFORM_ID, useValue: 'browser' }],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    const fixture = TestBed.createComponent(HostComponent);
    const http = TestBed.inject(HttpTestingController);
    const settle = async (): Promise<void> => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    await settle();
    expect(fixture.debugElement.query(By.directive(BodyRegionPicker))).toBeNull();

    fixture.componentInstance.selection.set({
      studyConceptId: RX_MANO.conceptId,
      modalityCode: 'RX',
      region: 'MANO',
      laterality: null,
      contrastConceptId: 'c-sin',
    });
    await settle();
    http.expectOne('/anatomy-atlas-3d/catalog/parts.json').flush(PARTES);
    http.expectOne('/anatomy-atlas-3d/catalog/body-regions.json').flush(ARCHIVO);
    await settle();

    const real = fixture.debugElement.query(By.directive(BodyRegionPicker)).componentInstance as BodyRegionPicker;
    expect(real.allowed()).toEqual(['MANO']);
    expect(real.modality()).toBe('RX');
    expect(real.value()).toEqual({ region: 'MANO', laterality: null });

    // un gesto en el selector real escribe la selección (y sólo entonces)
    real.value.set({ region: 'MANO', laterality: 'DER' });
    await settle();
    expect(fixture.componentInstance.selection()).toMatchObject({ region: 'MANO', laterality: 'DER' });
    http.verify();
  });
});
