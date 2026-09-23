import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Cotizaciones } from './cotizaciones';

describe('Cotizaciones', () => {
  let fixture: ComponentFixture<Cotizaciones>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(Cotizaciones);
    fixture.detectChanges();
  });

  it('declara la procedencia de cada importe y no convierte UMA', () => {
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Maqueta');
    expect(texto).toContain('5 UMA');
    expect(texto).not.toContain('Bs');
  });

  it('filtra la lista con la búsqueda del paciente', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="cotizaciones-busqueda"]') as HTMLInputElement;
    input.value = 'tomografia';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Tomografía');
    expect(fixture.nativeElement.textContent).not.toContain('Paracetamol');
  });
});
