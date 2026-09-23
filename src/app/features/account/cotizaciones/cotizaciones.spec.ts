import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import { Cotizaciones } from './cotizaciones';

describe('Cotizaciones', () => {
  let fixture: ComponentFixture<Cotizaciones>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DiagnosticsClient,
          useValue: {
            getOwnOrders: () => of({
              patientProfileId: 'pp-propio',
              items: [{
                id: 'orden-interna',
                codeConceptId: 'concepto-hemograma',
                createdAt: new Date('2026-09-23T00:00:00.000Z'),
                hasReleasedResult: false,
              }],
              limit: 20,
              truncated: false,
            }),
          },
        },
        {
          provide: TerminologyClient,
          useValue: {
            readConceptLabels: () => of(new Map([
              ['concepto-hemograma', { display: 'Hemograma', value: 'concepto-hemograma' }],
            ])),
          },
        },
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

  it('muestra los estudios de las órdenes propias sin exponer identificadores', () => {
    const texto: string = fixture.nativeElement.textContent;

    expect(texto).toContain('Estudios en tus documentos actuales');
    expect(texto).toContain('Hemograma');
    expect(texto).toContain('Tu orden de diagnóstico');
    expect(texto).not.toContain('orden-interna');
    expect(texto).not.toContain('concepto-hemograma');
  });
});
