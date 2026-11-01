import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { MEDICATION_TARGET, MedicationLink } from './medication-link';

/** El catálogo con que se receta, como lo sirve la API. */
const CATALOG = {
  code: 'medication',
  name: 'Medicamento',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  options: [
    { conceptId: 'c-amox', code: 'J01CA04', display: 'Amoxicillin', displayEs: 'Amoxicilina', ordinal: 1, isDefault: false },
    { conceptId: 'c-amcl', code: 'J01CR02', display: 'Amoxicillin and enzyme inhibitor', displayEs: 'Amoxicilina con ácido clavulánico', ordinal: 2, isDefault: false },
    { conceptId: 'c-par', code: 'N02BE01', display: 'Paracetamol', ordinal: 3, isDefault: false },
  ],
};

interface Internal {
  search: (text: string) => void;
  choose: (option: ReferenceOption | null) => void;
  options: () => readonly ReferenceOption[];
  selected: () => ReferenceOption | null;
  hint: () => string;
}

describe('MedicationLink', () => {
  let fixture: ComponentFixture<MedicationLink>;
  let http: HttpTestingController;
  let chosen: (string | null)[];

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

  function mount(inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(MedicationLink);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    chosen = [];
    fixture.componentInstance.chosen.subscribe((value) => chosen.push(value));
    fixture.detectChanges();
  }

  function answerCatalog(): void {
    const request = http.expectOne((r) => r.url.endsWith('/system-context/dynamic-enums'));
    expect(request.request.params.get('target')).toBe(MEDICATION_TARGET);
    request.flush(CATALOG);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el catálogo de la receta al primer uso, y busca por el nombre en castellano, sin tildes ni mayúsculas', () => {
    mount();
    http.expectNone((r) => r.url.endsWith('/system-context/dynamic-enums'));

    internal().search('AMOXICILINA CON ACIDO');
    answerCatalog();
    expect(internal().options()).toEqual([{ value: 'c-amcl', label: 'Amoxicilina con ácido clavulánico' }]);
    internal().search('paracet');
    expect(internal().options()).toEqual([{ value: 'c-par', label: 'Paracetamol' }]);
  });

  it('elegir emite el concepto; limpiar emite null (desvincular); sin tocar no emite nada', () => {
    mount({ current: { code: 'J01CA04', display: 'Amoxicillin' } });
    expect(internal().selected()).toEqual({ value: '', label: 'Amoxicillin' });
    internal().search('amox');
    answerCatalog();

    expect(internal().selected()).toEqual({ value: 'c-amox', label: 'Amoxicilina' });
    expect(chosen).toEqual([]);
    internal().choose({ value: 'c-par', label: 'Paracetamol' });
    internal().choose(null);
    expect(chosen).toEqual(['c-par', null]);
  });

  it('un producto que pide receta sin medicamento lo avisa', () => {
    mount({ requiresPrescription: true });

    expect(internal().hint()).toContain('ninguna receta lo va a encontrar');
  });

  it('un vínculo del registro oficial se muestra sin buscador', () => {
    mount({ current: { code: 'J01CA04', display: 'Amoxicilina' }, locked: true });

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="medication-link-locked"]')?.textContent).toContain('Amoxicilina');
    expect(root.querySelector('app-reference-combobox')).toBeNull();
  });
});
