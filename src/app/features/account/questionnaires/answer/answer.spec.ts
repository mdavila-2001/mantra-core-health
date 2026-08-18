import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';

import { QuestionnaireAnswer } from './answer';

/**
 * Responder un cuestionario es la única escritura del paciente en este módulo,
 * y hasta acá se enviaba con el `submit` nativo del formulario: el botón
 * «Enviar respuestas» recargaba la página y las respuestas no salían nunca.
 * Las pruebas van por el DOM —click y `submit`— porque llamar al método directo
 * no ve ese defecto.
 */
const CUESTIONARIO = {
  id: 'inv-1',
  title: 'Cómo te sentiste después de la consulta',
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
      questionText: '¿Te atendieron a horario?',
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
  });

  it('el botón «Enviar respuestas» manda las respuestas y no recarga', async () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    raiz().querySelector<HTMLButtonElement>('[data-testid="responder-enviar"]')?.click();
    await fixture.whenStable();

    const envio = http.expectOne('/surveys/me/invitations/inv-1/responses');
    expect(envio.request.method).toBe('POST');
    envio.flush({});
  });
});
