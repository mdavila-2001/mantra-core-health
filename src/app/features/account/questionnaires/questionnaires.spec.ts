import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { PatientSurveyInbox } from '../../../core/patient-surveys/patient-survey-inbox';
import { Questionnaires } from './questionnaires';

const LISTA = '/surveys/me/invitations';
const PUENTE = '/patients/me/reviewable-care';
const RESEÑA = '/patients/me/reviews';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Un solo «ahora» para todo el archivo: la lista ordena por vencimiento, y con
 * un `Date.now()` por invitación dos tarjetas armadas seguidas difieren por
 * milisegundos y el orden esperado dependía del reloj.
 */
const AHORA = Date.now();

/** Una invitación como viaja: fechas en texto y opcionales en `null`. */
function enElCable(id: string, status: 'PENDING' | 'ANSWERED' | 'EXPIRED', diasDeRespuesta = 2) {
  return {
    id,
    title: `Encuesta ${id}`,
    description: null,
    status,
    issuedAt: new Date(AHORA - 5 * DIA_MS).toISOString(),
    expiresAt: new Date(AHORA + 3 * DIA_MS).toISOString(),
    answeredAt:
      status === 'ANSWERED' ? new Date(AHORA - diasDeRespuesta * DIA_MS).toISOString() : null,
    appointmentBookingId: `bk-${id}`,
  };
}

const RESEÑABLE = (reserva: string, encuentro: string, canReview = true) => ({
  encounterId: encuentro,
  appointmentBookingId: reserva,
  practitionerDisplayName: 'Dra. Rojas',
  startAt: '2026-10-20T14:00:00.000Z',
  alreadyReviewed: !canReview,
  canReview,
});

describe('Questionnaires (Mis cuestionarios)', () => {
  let fixture: ComponentFixture<Questionnaires>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Questionnaires],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: new BehaviorSubject(convertToParamMap({ seccion: 'encuestas' })) },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Questionnaires);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  function raiz(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function cargar(invitaciones: readonly unknown[]): void {
    http.expectOne(LISTA).flush(invitaciones);
    fixture.detectChanges();
  }

  it('le pasa a la cabecera lo que leyó, sin una segunda petición a la bandeja', () => {
    cargar([enElCable('i-1', 'PENDING'), enElCable('i-2', 'EXPIRED')]);

    const bandeja = TestBed.inject(PatientSurveyInbox);
    expect(bandeja.hayInvitaciones()).toBe(true);
    expect(bandeja.pendientes()).toBe(1);
    http.expectNone(LISTA);
  });

  it('sin ninguna encuesta la bandeja de la cabecera queda vacía', () => {
    cargar([]);

    expect(TestBed.inject(PatientSurveyInbox).hayInvitaciones()).toBe(false);
  });

  it('ofrece «Dejar reseña pública» sólo en las respondidas cuya atención se puede reseñar', () => {
    cargar([
      enElCable('i-1', 'ANSWERED'),
      enElCable('i-2', 'ANSWERED'),
      enElCable('i-3', 'PENDING'),
    ]);
    // Una consulta por reserva respondida, y ninguna por la pendiente.
    http.expectOne((r) => r.url === PUENTE && r.params.get('appointmentBookingId') === 'bk-i-1')
      .flush(RESEÑABLE('bk-i-1', 'enc-1'));
    http.expectOne((r) => r.url === PUENTE && r.params.get('appointmentBookingId') === 'bk-i-2')
      .flush(RESEÑABLE('bk-i-2', 'enc-2', false));
    http.expectNone((r) => r.url === PUENTE && r.params.get('appointmentBookingId') === 'bk-i-3');

    expect(raiz().querySelector('[data-testid="resenar-i-1"]')).not.toBeNull();
    expect(raiz().querySelector('[data-testid="resenar-i-2"]')).toBeNull();
    expect(raiz().querySelector('[data-testid="resenar-i-3"]')).toBeNull();
    expect(raiz().querySelector('[data-testid="resenar-i-1"]')?.textContent).toContain(
      'Dejar reseña pública',
    );
  });

  it('no dispara una ráfaga: consulta como mucho las 5 respondidas más recientes', () => {
    cargar(
      Array.from({ length: 8 }, (_, k) => enElCable(`i-${k}`, 'ANSWERED', k + 1)),
    );

    const consultas = http.match((r) => r.url === PUENTE);
    expect(consultas.length).toBe(5);
    expect(consultas.map((c) => c.request.params.get('appointmentBookingId'))).toEqual([
      'bk-i-0',
      'bk-i-1',
      'bk-i-2',
      'bk-i-3',
      'bk-i-4',
    ]);
    consultas.forEach((c) => c.flush(RESEÑABLE('x', 'e', false)));
  });

  it('una consulta que falla no rompe la lista: esa encuesta sólo queda sin acción', () => {
    cargar([enElCable('i-1', 'ANSWERED'), enElCable('i-2', 'ANSWERED', 3)]);
    http
      .expectOne((r) => r.params.get('appointmentBookingId') === 'bk-i-1')
      .flush({ message: 'boom' }, { status: 500, statusText: 'x' });
    http
      .expectOne((r) => r.params.get('appointmentBookingId') === 'bk-i-2')
      .flush(RESEÑABLE('bk-i-2', 'enc-2'));

    expect(raiz().querySelector('[data-testid="cuestionarios-lista"]')).not.toBeNull();
    expect(raiz().querySelector('[data-testid="resenar-i-1"]')).toBeNull();
    expect(raiz().querySelector('[data-testid="resenar-i-2"]')).not.toBeNull();
  });

  it('«Dejar reseña pública» abre el diálogo con la atención prefijada y, publicada, la acción desaparece', () => {
    cargar([enElCable('i-1', 'ANSWERED')]);
    http.expectOne((r) => r.url === PUENTE).flush(RESEÑABLE('bk-i-1', 'enc-1'));

    raiz().querySelector<HTMLButtonElement>('[data-testid="resenar-i-1"]')?.click();
    fixture.detectChanges();

    expect(raiz().querySelector('app-rate-encounter-dialog')).not.toBeNull();
    // Atención prefijada: ni selector ni lectura del resumen clínico.
    expect(raiz().querySelector('[data-testid="calificar-atencion"]')).toBeNull();
    http.expectNone((r) => /\/clinical\//.test(r.url));

    raiz().querySelector<HTMLButtonElement>('[data-testid="calificar-enviar"]')?.click();
    const reseña = http.expectOne(RESEÑA);
    expect(reseña.request.body).toEqual({
      verifiedEncounterId: 'enc-1',
      overallRating: 5,
      displayMode: 'ANONYMOUS',
    });
    reseña.flush({ id: 'r-1', overallRating: 5, verified: true });

    expect(raiz().querySelector('app-rate-encounter-dialog')).toBeNull();
    expect(raiz().querySelector('[data-testid="resenar-i-1"]')).toBeNull();
  });

  describe('de qué atención es cada encuesta', () => {
    const ATENDIDA = '2026-10-20T14:00:00.000Z';

    function contextos(): string[] {
      return Array.from(
        raiz().querySelectorAll('[data-testid="cuestionario-contexto"]'),
        (el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
      );
    }

    it('una consulta dice «Consulta con <médico> · <fecha>» y un servicio «<servicio> · <fecha>»', () => {
      cargar([
        {
          ...enElCable('i-1', 'PENDING'),
          kind: 'CONSULTATION',
          practitionerDisplayName: 'Dra. Rojas',
          attendedAt: ATENDIDA,
        },
        {
          ...enElCable('i-2', 'PENDING'),
          kind: 'SERVICE',
          serviceName: 'Ecografía abdominal',
          attendedAt: ATENDIDA,
        },
      ]);

      const [consulta, servicio] = contextos();
      expect(consulta).toMatch(/^Consulta con Dra\. Rojas · .*2026$/);
      expect(servicio).toMatch(/^Ecografía abdominal · .*2026$/);
    });

    it('con el contexto presente no repite la consigna larga en cada tarjeta', () => {
      cargar([
        {
          ...enElCable('i-1', 'PENDING'),
          description: 'Le pedimos un minuto para contarnos cómo fue su consulta.',
          kind: 'CONSULTATION',
          practitionerDisplayName: 'Dra. Rojas',
          attendedAt: ATENDIDA,
        },
      ]);

      expect(raiz().querySelector('.cuestionarios__consigna')).toBeNull();
      expect(raiz().textContent).not.toContain('Le pedimos un minuto');
    });

    it('sin los campos nuevos (API anterior) degrada al texto de siempre, sin romper', () => {
      cargar([
        {
          ...enElCable('i-1', 'PENDING'),
          description: 'Le pedimos un minuto para contarnos cómo fue su consulta.',
        },
      ]);

      expect(contextos()).toEqual([]);
      expect(raiz().querySelector('.cuestionarios__consigna')?.textContent).toContain(
        'Le pedimos un minuto',
      );
      expect(raiz().querySelector('[data-testid="responder-i-1"]')).not.toBeNull();
    });

    it('con kind pero sin nombre ni fecha dice sólo lo que sabe, sin inventar', () => {
      cargar([
        { ...enElCable('i-1', 'PENDING'), kind: 'CONSULTATION', practitionerDisplayName: null },
        { ...enElCable('i-2', 'PENDING'), kind: 'SERVICE', serviceName: null, attendedAt: null },
      ]);

      expect(contextos()).toEqual(['Consulta', 'Servicio de salud']);
    });
  });
});
