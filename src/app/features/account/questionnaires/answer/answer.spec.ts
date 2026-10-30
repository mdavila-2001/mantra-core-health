import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { QuestionnaireAnswer } from './answer';

const RESPUESTAS = '/surveys/me/invitations/inv-1/responses';
const BANDEJA = '/surveys/me/invitations';
const PUENTE = '/patients/me/reviewable-care';
const RESEÑA = '/patients/me/reviews';
const RESUMEN_CLINICO = /\/clinical\/patients\/.*\/summary/;

/** Lo que `reviewable-care` responde cuando la atención se puede reseñar. */
const RESEÑABLE = {
  encounterId: 'enc-7',
  appointmentBookingId: 'bk-1',
  practitionerDisplayName: 'Dra. Rojas',
  startAt: '2026-10-20T14:00:00.000Z',
  alreadyReviewed: false,
  canReview: true,
};

/**
 * Responder un cuestionario es la única escritura del paciente en este módulo,
 * y hasta acá se enviaba con el `submit` nativo del formulario: el botón
 * «Enviar respuestas» recargaba la página y las respuestas no salían nunca.
 * Las pruebas van por el DOM —click y `submit`— porque llamar al método directo
 * no ve ese defecto.
 */
const CUESTIONARIO = {
  id: 'inv-1',
  title: 'Cómo se sintió después de la consulta',
  description: '',
  status: 'PENDING',
  issuedAt: '2026-08-10T12:00:00.000Z',
  expiresAt: null,
  answeredAt: null,
  appointmentBookingId: 'bk-1',
  questions: [
    {
      id: 'q-1',
      position: 1,
      questionText: '¿Le atendieron a horario?',
      answerType: 'TEXT',
      required: false,
      options: [],
    },
  ],
};

describe('QuestionnaireAnswer', () => {
  let fixture: ComponentFixture<QuestionnaireAnswer>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionnaireAnswer],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['invitationId', 'inv-1']]) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuestionnaireAnswer);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/surveys/me/invitations/inv-1').flush(CUESTIONARIO);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function formulario(): HTMLFormElement {
    const form = raiz().querySelector<HTMLFormElement>('form[data-testid="responder-form"]');
    if (form === null) {
      throw new Error('el formulario de respuestas no se renderizó');
    }
    return form;
  }

  it('el submit nativo queda prevenido y es el que envía: la pantalla no recarga', () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const envio = new Event('submit', { bubbles: true, cancelable: true });

    formulario().dispatchEvent(envio);

    expect(envio.defaultPrevented).toBe(true);
    // Enter dentro de una pregunta llega por acá mismo: un solo camino de envío.
    http.expectOne('/surveys/me/invitations/inv-1/responses').flush({});
    cerrarSeguimiento();
  });

  it('el botón «Enviar respuestas» manda las respuestas y no recarga', async () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    raiz().querySelector<HTMLButtonElement>('[data-testid="responder-enviar"]')?.click();
    await fixture.whenStable();

    const envio = http.expectOne('/surveys/me/invitations/inv-1/responses');
    expect(envio.request.method).toBe('POST');
    envio.flush({});
    cerrarSeguimiento();
  });

  /**
   * Tras guardar la encuesta la pantalla hace DOS lecturas más: la bandeja de la
   * cabecera (queda una pendiente menos) y si la atención se puede reseñar.
   * Las pruebas de arriba no hablan de eso: las contestan «no».
   */
  function cerrarSeguimiento(): void {
    http.expectOne(BANDEJA).flush([]);
    http.expectOne((r) => r.url === PUENTE).flush({ ...RESEÑABLE, canReview: false });
  }

  function enviar(): void {
    raiz().querySelector<HTMLButtonElement>('[data-testid="responder-enviar"]')?.click();
    http.expectOne(RESPUESTAS).flush({});
    http.expectOne(BANDEJA).flush([]);
  }

  function oferta(): HTMLElement | null {
    fixture.detectChanges();
    return raiz().querySelector<HTMLElement>('[data-testid="responder-resena"]');
  }

  describe('el puente a la reseña pública (F7)', () => {
    const navegar = vi.fn(() => Promise.resolve(true));

    beforeEach(() => {
      navegar.mockClear();
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockImplementation(navegar);
    });

    it('pregunta por la RESERVA de la invitación, con un solo parámetro', () => {
      enviar();

      const consulta = http.expectOne((r) => r.url === PUENTE);
      expect(consulta.request.params.get('appointmentBookingId')).toBe('bk-1');
      expect(consulta.request.params.keys()).toEqual(['appointmentBookingId']);
      consulta.flush({ ...RESEÑABLE, canReview: false });
    });

    it('si se puede reseñar, ofrece «¿Quiere compartir una reseña pública?» y NO navega todavía', () => {
      enviar();
      http.expectOne((r) => r.url === PUENTE).flush(RESEÑABLE);

      const panel = oferta();
      expect(panel).not.toBeNull();
      expect(panel?.textContent).toContain('¿Quiere compartir una reseña pública?');
      expect(panel?.textContent).toContain('Dra. Rojas');
      expect(panel?.textContent).toContain(
        'Su encuesta es privada y sólo la ve su médico. Una reseña es pública.',
      );
      expect(raiz().querySelector('[data-testid="responder-resena-dejar"]')).not.toBeNull();
      expect(raiz().querySelector('[data-testid="responder-resena-ahora-no"]')).not.toBeNull();
      // El formulario ya no está: la encuesta quedó guardada y no se reenvía.
      expect(raiz().querySelector('[data-testid="responder-form"]')).toBeNull();
      expect(navegar).not.toHaveBeenCalled();
    });

    it('si NO se puede reseñar (ya reseñada, médico sin reseñas), navega como siempre sin ofrecer nada', () => {
      enviar();
      http
        .expectOne((r) => r.url === PUENTE)
        .flush({ ...RESEÑABLE, canReview: false, alreadyReviewed: true });

      expect(oferta()).toBeNull();
      expect(navegar).toHaveBeenCalledWith('/my-account/questionnaires?seccion=encuestas');
    });

    it('si la consulta FALLA, no muestra nada y navega como hoy', () => {
      enviar();
      http
        .expectOne((r) => r.url === PUENTE)
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

      expect(oferta()).toBeNull();
      expect(navegar).toHaveBeenCalledWith('/my-account/questionnaires?seccion=encuestas');
    });

    it('si la atención no existe para el servidor (404), tampoco molesta', () => {
      enviar();
      http
        .expectOne((r) => r.url === PUENTE)
        .flush({ message: 'no' }, { status: 404, statusText: 'Not Found' });

      expect(oferta()).toBeNull();
      expect(navegar).toHaveBeenCalledWith('/my-account/questionnaires?seccion=encuestas');
    });

    it('«Ahora no» vuelve a la lista y no escribe ninguna reseña', () => {
      enviar();
      http.expectOne((r) => r.url === PUENTE).flush(RESEÑABLE);
      oferta();

      raiz().querySelector<HTMLButtonElement>('[data-testid="responder-resena-ahora-no"]')?.click();

      expect(navegar).toHaveBeenCalledWith('/my-account/questionnaires?seccion=encuestas');
      http.expectNone(RESEÑA);
    });

    it('«Dejar una reseña» abre el diálogo con la atención ya elegida, sin pedir el resumen clínico', () => {
      enviar();
      http.expectOne((r) => r.url === PUENTE).flush(RESEÑABLE);
      oferta();

      raiz().querySelector<HTMLButtonElement>('[data-testid="responder-resena-dejar"]')?.click();
      fixture.detectChanges();

      expect(raiz().querySelector('app-rate-encounter-dialog')).not.toBeNull();
      expect(raiz().querySelector('[data-testid="calificar-atencion"]')).toBeNull();
      http.expectNone((r) => RESUMEN_CLINICO.test(r.url));
    });

    it('publicar la reseña manda SÓLO la reseña (anónima) y vuelve a la lista', () => {
      enviar();
      http.expectOne((r) => r.url === PUENTE).flush(RESEÑABLE);
      oferta();
      raiz().querySelector<HTMLButtonElement>('[data-testid="responder-resena-dejar"]')?.click();
      fixture.detectChanges();

      raiz().querySelector<HTMLButtonElement>('[data-testid="calificar-enviar"]')?.click();
      const reseña = http.expectOne(RESEÑA);
      // Dos escrituras separadas: nada de la encuesta viaja en la reseña.
      expect(reseña.request.body).toEqual({
        verifiedEncounterId: 'enc-7',
        overallRating: 5,
        displayMode: 'ANONYMOUS',
      });
      reseña.flush({ id: 'r-1', overallRating: 5, verified: true });

      expect(navegar).toHaveBeenCalledWith('/my-account/questionnaires?seccion=encuestas');
    });

    it('cerrar el diálogo sin publicar deja la oferta a la vista', () => {
      enviar();
      http.expectOne((r) => r.url === PUENTE).flush(RESEÑABLE);
      oferta();
      raiz().querySelector<HTMLButtonElement>('[data-testid="responder-resena-dejar"]')?.click();
      fixture.detectChanges();

      (fixture.componentInstance as unknown as { cerrarResena(): void }).cerrarResena();
      fixture.detectChanges();

      expect(raiz().querySelector('app-rate-encounter-dialog')).toBeNull();
      expect(oferta()).not.toBeNull();
      expect(navegar).not.toHaveBeenCalled();
      http.expectNone(RESEÑA);
    });

    it('un envío rechazado por el servidor NO consulta la reseña: la encuesta no se guardó', () => {
      raiz().querySelector<HTMLButtonElement>('[data-testid="responder-enviar"]')?.click();
      http
        .expectOne(RESPUESTAS)
        .flush({ code: 'PRECONDITION_FAILED', message: 'Ya respondida' }, { status: 422, statusText: 'x' });

      http.expectNone((r) => r.url === PUENTE);
      http.expectNone(BANDEJA);
      expect(navegar).not.toHaveBeenCalled();
    });
  });
});
