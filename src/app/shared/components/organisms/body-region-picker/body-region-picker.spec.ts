import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { anatomyShardOf } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.client';
import { BodyRegionPicker, type PickerRegion } from './body-region-picker';

const REGIONES: readonly PickerRegion[] = [
  { atlas: 'R03', label: 'Tórax' },
  { atlas: 'R06', label: 'Miembro superior' },
];

const PARTE = (meshId: string, structureId: string) => ({
  meshId, layer: 'skeleton', sex: 'shared', structureId, shard: 0, side: null, labelEn: `part ${meshId}`, match: 'fma_exact',
});

/** La región se elige por dos caminos —tocar el modelo o la lista— y los dos llegan al mismo valor. */
describe('BodyRegionPicker', () => {
  let fixture: ComponentFixture<BodyRegionPicker>;
  let picker: BodyRegionPicker;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BodyRegionPicker);
    picker = fixture.componentInstance;
    fixture.componentRef.setInput('regions', REGIONES);
  });

  afterEach(() => http.verify());

  const cargar = (parts: readonly object[]) => {
    fixture.detectChanges();
    http.expectOne('/anatomy-atlas-3d/catalog/parts.json').flush(parts);
    fixture.detectChanges();
  };

  const fichaDe = (id: string, regions: readonly string[]) => {
    const shard = String(anatomyShardOf(id, 32)).padStart(2, '0');
    http
      .expectOne(`/anatomy-atlas-3d/catalog/structures-${shard}.json`)
      .flush({ [id]: { id, labelEn: 'humerus', labelEs: 'húmero', regions } });
  };

  describe('correcto', () => {
    it('ofrece las regiones en una lista accesible y elegir una la emite', () => {
      cargar([]);
      const opciones = fixture.nativeElement.querySelectorAll('[data-testid="body-region-option"]');
      expect(opciones).toHaveLength(2);
      picker['pickFromList']('R06');
      expect(picker.value()).toBe('R06');
    });

    it('tocar una pieza del modelo propone la región de su estructura y lo dice', () => {
      cargar([PARTE('BP1', 'UBERON:0000976')]);
      picker['onPicked']('BP1');
      fichaDe('UBERON:0000976', ['R06']);
      expect(picker.value()).toBe('R06');
      expect(picker['pickedNote']()).toBe('«húmero» está en Miembro superior.');
      expect(picker['selectedMeshes']()).toEqual(['BP1']);
    });
  });

  describe('límite', () => {
    it('una pieza sin región en el atlas no cambia la elección y lo dice', () => {
      cargar([PARTE('BP2', 'BP3D:BP2')]);
      picker.value.set('R03');
      picker['onPicked']('BP2');
      fichaDe('BP3D:BP2', []);
      expect(picker.value()).toBe('R03');
      expect(picker['pickedNote']()).toContain('no tiene región asignada');
    });

    it('elegir por la lista quita el resalte de la pieza tocada: no contradice la región', () => {
      cargar([PARTE('BP1', 'UBERON:0000976')]);
      picker['onPicked']('BP1');
      fichaDe('UBERON:0000976', ['R06']);
      expect(picker['selectedMeshes']()).toEqual(['BP1']);
      picker['pickFromList']('R03');
      expect(picker['selectedMeshes']()).toEqual([]);
      expect(picker.value()).toBe('R03');
    });

    it('tocar el fondo (sin pieza) limpia la pieza resaltada pero conserva la región', () => {
      cargar([PARTE('BP1', 'UBERON:0000976')]);
      picker.value.set('R03');
      picker['onPicked'](null);
      expect(picker['selectedMeshes']()).toEqual([]);
      expect(picker.value()).toBe('R03');
    });
  });

  describe('inválido', () => {
    it('si el atlas no carga, lo dice y la lista sigue sirviendo', () => {
      fixture.detectChanges();
      http.expectOne('/anatomy-atlas-3d/catalog/parts.json').flush('x', { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('No pudimos cargar el modelo 3D');
      picker['pickFromList']('R03');
      expect(picker.value()).toBe('R03');
    });

    it('una región que el atlas conoce pero la pantalla no ofrece se ignora', () => {
      cargar([PARTE('BP1', 'UBERON:0000976')]);
      picker['onPicked']('BP1');
      fichaDe('UBERON:0000976', ['R99']);
      expect(picker.value()).toBeNull();
    });

    it('un fallo al leer la ficha de la pieza no rompe: pide elegir en la lista', () => {
      cargar([PARTE('BP1', 'UBERON:0000976')]);
      picker['onPicked']('BP1');
      const shard = String(anatomyShardOf('UBERON:0000976', 32)).padStart(2, '0');
      http.expectOne(`/anatomy-atlas-3d/catalog/structures-${shard}.json`).flush('x', { status: 500, statusText: 'Error' });
      expect(picker['pickedNote']()).toContain('elija la región en la lista');
    });
  });
});
