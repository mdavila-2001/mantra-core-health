import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import { Cotizaciones } from './cotizaciones';

describe('Cotizaciones', () => {
  let fixture: ComponentFixture<Cotizaciones>;
  const patientProfileId = signal<string | null>('pp-propio');
  const getOwnOrders = vi.fn();
  const readConceptLabels = vi.fn();

  beforeEach(() => {
    patientProfileId.set('pp-propio');
    getOwnOrders.mockClear();
    readConceptLabels.mockClear();
    getOwnOrders.mockReturnValue(of({
      patientProfileId: 'pp-propio',
      items: [{
        id: 'orden-interna',
        codeConceptId: 'concepto-hemograma',
        createdAt: new Date('2026-09-23T00:00:00.000Z'),
        hasReleasedResult: false,
      }],
      limit: 20,
      truncated: false,
    }));
    readConceptLabels.mockReturnValue(of(new Map([
      ['concepto-hemograma', { display: 'Hemograma', value: 'concepto-hemograma' }],
    ])));

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { patientProfileId } },
        {
          provide: DiagnosticsClient,
          useValue: { getOwnOrders },
        },
        {
          provide: TerminologyClient,
          useValue: { readConceptLabels },
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
    const html: string = fixture.nativeElement.innerHTML;

    expect(getOwnOrders).toHaveBeenCalledWith(20);
    expect(readConceptLabels).toHaveBeenCalledWith(['concepto-hemograma']);
    expect(texto).toContain('Estudios en tus documentos actuales');
    expect(texto).toContain('Hemograma');
    expect(texto).toContain('Tu orden de diagnóstico');
    expect(texto).not.toContain('orden-interna');
    expect(texto).not.toContain('concepto-hemograma');
    expect(html).not.toContain('orden-interna');
    expect(html).not.toContain('concepto-hemograma');
  });

  it('declara cuando la lista de órdenes fue recortada por el contrato', () => {
    getOwnOrders.mockReturnValue(of({
      patientProfileId: 'pp-propio', items: [], limit: 20, truncated: true,
    }));
    fixture = TestBed.createComponent(Cotizaciones);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Mostramos las 20 órdenes más recientes');
  });

  it('explica el fallo al leer las órdenes en vez de simular una lista vacía', () => {
    getOwnOrders.mockReturnValue(throwError(() => new Error('sin conexión')));
    fixture = TestBed.createComponent(Cotizaciones);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar tus órdenes diagnósticas');
  });

  it('no consulta órdenes propias cuando la sesión no tiene perfil de paciente', () => {
    patientProfileId.set(null);
    getOwnOrders.mockClear();
    fixture = TestBed.createComponent(Cotizaciones);
    fixture.detectChanges();

    expect(getOwnOrders).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Esta cuenta no tiene un perfil de paciente activo');
  });
});
