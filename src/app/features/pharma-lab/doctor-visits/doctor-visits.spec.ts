import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DoctorVisits } from './doctor-visits';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const PENDIENTE = {
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

const AGENDA = {
  doctorUserId: '44444444-4444-4444-4444-444444444444',
  timeZone: 'America/La_Paz',
  autoConfirm: false,
  minNoticeHours: 24,
  rescheduleCutoffHours: 12,
  windows: [
    {
      weekday: 2,
      startTime: '15:00',
      endTime: '17:00',
      slotDurationMinutes: 30,
      modalityConceptId: 'c-presencial',
      location: 'Consultorio 3',
    },
  ],
};

const CONCEPTOS = [
  {
    key: 'VISIT_PENDING_CONFIRMATION',
    id: 'c-pendiente',
    code: 'X',
    display: 'Pendiente de confirmación',
  },
  { key: 'VISIT_CONFIRMED', id: 'c-confirmada', code: 'X', display: 'Confirmada' },
  { key: 'MODALITY_IN_PERSON', id: 'c-presencial', code: 'X', display: 'Presencial' },
];

describe('DoctorVisits', () => {
  let fixture: ComponentFixture<DoctorVisits>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DoctorVisits);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  /** Contesta la carga de la pantalla. */
  function cargar(
    options: {
      requests?: readonly unknown[];
      agendaStatus?: number;
      esPrimeraCarga?: boolean;
    } = {},
  ): void {
    http.expectOne('/visit-requests/inbox').flush(options.requests ?? [PENDIENTE]);
    http.expectOne('/visit-records/inbox').flush([]);
    const agenda = http.expectOne('/visit-agenda/me');
    if (options.agendaStatus === 404) {
      agenda.flush({ message: 'sin agenda' }, { status: 404, statusText: 'Not Found' });
    } else {
      agenda.flush(AGENDA);
    }
    if (options.esPrimeraCarga !== false) {
      http.expectOne('/pharma-labs/reference/concepts').flush(CONCEPTOS);
    }
    fixture.detectChanges();
  }

  function abrirPestania(label: string): void {
    const raiz = fixture.nativeElement as HTMLElement;
    [...raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      .find((candidato) => candidato.textContent?.trim() === label)
      ?.click();
    fixture.detectChanges();
  }

  it('lista las solicitudes recibidas con su estado rotulado', () => {
    cargar();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Presentación de Andexal');
    expect(texto).toContain('Pendiente de confirmación');
  });

  it('acepta una solicitud pendiente', () => {
    cargar();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>(`[data-testid="accept-${REQUEST_ID}"]`)!
      .click();

    const peticion = http.expectOne(`/visit-requests/${REQUEST_ID}/accept`);
    expect(peticion.request.method).toBe('POST');
    peticion.flush({ id: REQUEST_ID, statusConceptId: 'c-confirmada' });

    cargar({
      requests: [{ ...PENDIENTE, statusConceptId: 'c-confirmada' }],
      esPrimeraCarga: false,
    });

    const aviso = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="visit-notice"]',
    );
    expect(aviso?.textContent).toContain('Confirmada');
  });

  it('una solicitud ya resuelta no ofrece decisión', () => {
    cargar({ requests: [{ ...PENDIENTE, statusConceptId: 'c-confirmada' }] });

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector(`[data-testid="accept-${REQUEST_ID}"]`)).toBeNull();
    expect(raiz.querySelector(`[data-testid="reject-${REQUEST_ID}"]`)).toBeNull();
  });

  it('muestra el error del servidor tal como llega', () => {
    cargar();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>(`[data-testid="reject-${REQUEST_ID}"]`)!
      .click();

    http
      .expectOne(`/visit-requests/${REQUEST_ID}/reject`)
      .flush(
        { message: 'La solicitud está en un estado final y ya no admite cambios' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    const aviso = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="visit-notice"]',
    );
    expect(aviso?.textContent).toContain('estado final');
  });

  it('un doctor sin agenda de visitas no ve un error, ve la explicación', () => {
    cargar({ agendaStatus: 404 });
    abrirPestania('Mi agenda de visitas');

    const vacio = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="agenda-empty"]',
    );
    expect(vacio?.textContent).toContain('no recibís visitas de laboratorio');
  });

  it('muestra las franjas configuradas de la agenda de visitas', () => {
    cargar();
    abrirPestania('Mi agenda de visitas');

    const tabla = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="agenda-table"]',
    );
    expect(tabla?.textContent).toContain('Martes');
    expect(tabla?.textContent).toContain('Consultorio 3');
  });
});
