import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import { Cotizaciones } from './cotizaciones';

describe('Cotizaciones', () => {
  let fixture: ComponentFixture<Cotizaciones>;
  const getOwnOrders = vi.fn();
  const readConceptLabels = vi.fn();

  beforeEach(() => {
    getOwnOrders.mockClear();
    readConceptLabels.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: DiagnosticsClient, useValue: { getOwnOrders } },
        { provide: TerminologyClient, useValue: { readConceptLabels } },
      ],
    });
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

  it('no carga ni muestra estudios personales dentro del comparador', () => {
    const texto: string = fixture.nativeElement.textContent;

    expect(getOwnOrders).not.toHaveBeenCalled();
    expect(readConceptLabels).not.toHaveBeenCalled();
    expect(texto).not.toContain('Estudios en tus documentos actuales');
    expect(texto).not.toContain('Tu orden de diagnóstico');
  });
});
