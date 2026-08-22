import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { mensajeDeError, VisitorVisits } from './visitor-visits';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const SOLICITUD = {
  id: REQUEST_ID,
  medicalVisitorId: '22222222-2222-4222-8222-222222222222',
  pharmaLabId: '33333333-3333-4333-8333-333333333333',
  doctorUserId: '44444444-4444-4444-4444-444444444444',
  reason: 'Presentación de Andexal',
  requestedStartAt: '2026-09-01T19:00:00.000Z',
  durationMinutes: 30,
  timeZone: 'America/La_Paz',
  modalityConceptId: 'c-presencial',
  statusConceptId: 'c-pendiente',
  proposedStartAt: null,
  confirmedAt: null,
};

const CONCEPTOS = [
  { key: 'VISIT_PENDING_CONFIRMATION', id: 'c-pendiente', code: 'X', display: 'Pendiente de confirmación' },
  {
    key: 'VISIT_CANCELLED_BY_VISITOR',
    id: 'c-cancelada',
    code: 'X',
    display: 'Cancelada por el visitador',
  },
  { key: 'MODALITY_IN_PERSON', id: 'c-presencial', code: 'X', display: 'Presencial' },
];

describe('VisitorVisits', () => {
  let fixture: ComponentFixture<VisitorVisits>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VisitorVisits);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function cargar(requests: readonly unknown[] = [SOLICITUD], esPrimeraCarga = true): void {
    http.expectOne('/visit-requests/mine').flush(requests);
    if (esPrimeraCarga) {
      http.expectOne('/pharma-labs/reference/concepts').flush(CONCEPTOS);
    }
    fixture.detectChanges();
  }

  it('lista las solicitudes propias con el estado rotulado', () => {
    cargar();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Presentación de Andexal');
    expect(texto).toContain('Pendiente de confirmación');
    expect(texto).not.toContain('c-pendiente');
  });

  it('no pide en ningún momento datos clínicos de pacientes', () => {
    cargar();

    // La pantalla del visitador no consulta pacientes, recetas ni diagnósticos.
    http.expectNone((request) => /patients|prescriptions|clinical|charts/.test(request.url));
  });

  it('no cancela sin motivo', () => {
    cargar();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>(`[data-testid="cancel-${REQUEST_ID}"]`)!
      .click();
    fixture.detectChanges();

    http.expectNone(`/visit-requests/${REQUEST_ID}/cancel`);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="visit-notice"]')
        ?.textContent,
    ).toContain('Escribí el motivo');
  });

  it('cancela con motivo y refleja el estado resultante', () => {
    cargar();

    const raiz = fixture.nativeElement as HTMLElement;
    const campo = raiz.querySelector<HTMLInputElement>('[data-testid="cancel-reason"]')!;
    campo.value = 'Imprevisto de agenda';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    raiz.querySelector<HTMLButtonElement>(`[data-testid="cancel-${REQUEST_ID}"]`)!.click();

    const peticion = http.expectOne(`/visit-requests/${REQUEST_ID}/cancel`);
    expect(peticion.request.body).toEqual({ reason: 'Imprevisto de agenda' });
    peticion.flush({ id: REQUEST_ID, statusConceptId: 'c-cancelada' });

    cargar([{ ...SOLICITUD, statusConceptId: 'c-cancelada' }], false);

    expect(
      raiz.querySelector('[data-testid="visit-notice"]')?.textContent,
    ).toContain('Cancelada por el visitador');
  });

  it('muestra el rechazo por plazo tal como lo explica el servidor', () => {
    cargar();

    const raiz = fixture.nativeElement as HTMLElement;
    const campo = raiz.querySelector<HTMLInputElement>('[data-testid="cancel-reason"]')!;
    campo.value = 'Tarde';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    raiz.querySelector<HTMLButtonElement>(`[data-testid="cancel-${REQUEST_ID}"]`)!.click();
    http.expectOne(`/visit-requests/${REQUEST_ID}/cancel`).flush(
      { message: 'El plazo para reprogramar o cancelar venció (12 horas antes del inicio)' },
      { status: 412, statusText: 'Precondition Failed' },
    );
    fixture.detectChanges();

    expect(raiz.querySelector('[data-testid="visit-notice"]')?.textContent).toContain(
      'El plazo para reprogramar o cancelar venció',
    );
  });
});

describe('mensajeDeError', () => {
  it('devuelve el mensaje del servidor cuando viene como texto', () => {
    expect(mensajeDeError({ error: { message: 'Producto no autorizado' } })).toBe(
      'Producto no autorizado',
    );
  });

  it('une los mensajes de validación cuando vienen como lista', () => {
    expect(mensajeDeError({ error: { message: ['Falta el motivo', 'Falta la fecha'] } })).toBe(
      'Falta el motivo. Falta la fecha',
    );
  });

  it('cae en un texto genérico sólo cuando el cuerpo no dice nada', () => {
    expect(mensajeDeError(new Error('boom'))).toBe('No se pudo completar la operación.');
  });
});
