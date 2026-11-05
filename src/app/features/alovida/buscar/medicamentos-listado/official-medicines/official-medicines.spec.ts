import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { OfficialMedicines } from './official-medicines';

describe('OfficialMedicines', () => {
  it('lista lo del registro oficial y se oculta cuando no hay nada', () => {
    const fixture = TestBed.createComponent(OfficialMedicines);
    fixture.componentRef.setInput('products', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="vitrina-registro-oficial"]')).toBeNull();

    fixture.componentRef.setInput('products', [
      {
        id: 'r1',
        name: 'BUSCAPINA 10 mg grageas',
        holder: 'Boehringer',
        strengthText: '10 mg',
        dosageForm: 'Gragea',
        sourceName: 'AGEMED',
        atc: ['A03BB01'],
        uses: ['Dolor abdominal y cólicos'],
        requiresPrescription: false,
      },
    ]);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('BUSCAPINA 10 mg grageas');
    expect(texto).toContain('Boehringer · AGEMED');
    expect(texto).toContain('Sirve para: Dolor abdominal y cólicos');
  });
});
