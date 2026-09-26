import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { InformedConsentBlock } from './informed-consent-block';

/**
 * CL-77 · el médico registra el consentimiento informado en la consulta, ligado
 * al encuentro; paciente y organización no viajan en el cuerpo.
 */
describe('InformedConsentBlock (CL-77)', () => {
  let fixture: ComponentFixture<InformedConsentBlock>;
  let componente: InformedConsentBlock;
  let http: HttpTestingController;
  const avisos: string[] = [];

  beforeEach(() => {
    avisos.length = 0;
    TestBed.configureTestingModule({
      imports: [InformedConsentBlock],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { success: (texto: string) => avisos.push(texto) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InformedConsentBlock);
    componente = fixture.componentInstance;
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /** Una señal, tal cual: `interno` la enlaza y perdería `.set`. */
  function señal(nombre: string): { set: (valor: string) => void } {
    return (componente as unknown as Record<string, { set: (valor: string) => void }>)[nombre]!;
  }

  it('sin encuentro en curso lo dice y no lee ni escribe nada', () => {
    fixture.componentRef.setInput('encounterId', null);
    fixture.detectChanges();

    http.expectNone(() => true);
    expect(fixture.nativeElement.querySelector('[data-testid="consentimiento-sin-encuentro"]')).not.toBeNull();
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);
  });

  it('registra por la ruta del encuentro, sin paciente ni tenant, y relee lo registrado', () => {
    fixture.componentRef.setInput('encounterId', 'e-1');
    fixture.detectChanges();
    http.expectOne('/consent/encounters/e-1/informed-consent').flush({ items: [] });

    señal('decision').set('ACCEPTED');
    señal('versionDeInformacion').set(' v3 ');
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(true);

    interno<() => void>('registrar')();

    const alta = http
      .match('/consent/encounters/e-1/informed-consent')
      .find((pedido) => pedido.request.method === 'POST');
    expect(alta?.request.body).toEqual({ decision: 'ACCEPTED', informationVersion: 'v3' });
    alta?.flush({
      id: 'i-1',
      patientProfileId: 'p-1',
      status: 'SIGNED',
      decision: 'ACCEPTED',
      createdAt: '2026-09-26T10:00:00.000Z',
    });

    // Se relee: lo que se muestra es lo que el servidor tiene.
    http.expectOne('/consent/encounters/e-1/informed-consent').flush({
      items: [{ id: 'i-1', encounterId: 'e-1', decision: 'ACCEPTED', signedAt: '2026-09-26T10:00:00.000Z' }],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="consentimiento-registrados"]')?.textContent).toContain(
      'Aceptó el tratamiento',
    );
    expect(avisos[0]).toContain('Mi privacidad');
  });

  it('un 403 (sin acceso de escritura a la historia) se dice y no queda nada registrado', () => {
    fixture.componentRef.setInput('encounterId', 'e-1');
    fixture.detectChanges();
    http.expectOne('/consent/encounters/e-1/informed-consent').flush({ items: [] });

    señal('decision').set('DECLINED');
    interno<() => void>('registrar')();
    http
      .match('/consent/encounters/e-1/informed-consent')
      .find((pedido) => pedido.request.method === 'POST')
      ?.flush({ code: 'FORBIDDEN', message: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="consentimiento-error"]')?.textContent).toContain(
      'No tenés acceso',
    );
  });
});
