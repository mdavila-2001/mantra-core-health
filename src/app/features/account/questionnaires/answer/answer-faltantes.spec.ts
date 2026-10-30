import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { QuestionnaireAnswer } from './answer';

const pregunta = (n: number, required: boolean) => ({
  id: `q-${n}`,
  position: n,
  questionText: `Pregunta ${n}`,
  answerType: 'TEXT',
  required,
  options: [],
});

const CUESTIONARIO = {
  id: 'inv-1',
  title: 'Cómo le fue',
  description: '',
  status: 'PENDING',
  issuedAt: '2026-08-10T12:00:00.000Z',
  expiresAt: null,
  answeredAt: null,
  appointmentBookingId: 'bk-1',
  questions: [pregunta(1, true), pregunta(2, true), pregunta(3, false)],
};

/**
 * Hallazgo de la prueba real de navegador: con la encuesta larga, al enviar con
 * obligatorias faltantes el aviso «Faltan responder N…» aparecía arriba, fuera
 * del viewport, y el foco se quedaba en el botón. Para quien no ve el borde de
 * la pantalla —o usa lector— el envío «no hacía nada».
 */
describe('QuestionnaireAnswer — aviso de obligatorias faltantes', () => {
  let fixture: ComponentFixture<QuestionnaireAnswer>;
  let http: HttpTestingController;
  let desplazar: ReturnType<typeof vi.fn>;

  function montar(movimientoReducido: boolean): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((consulta: string) => ({
        matches: movimientoReducido && consulta.includes('prefers-reduced-motion'),
        media: consulta,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    desplazar = vi.fn();
    HTMLElement.prototype.scrollIntoView = desplazar as unknown as typeof HTMLElement.prototype.scrollIntoView;

    TestBed.configureTestingModule({
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
    });
    fixture = TestBed.createComponent(QuestionnaireAnswer);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/surveys/me/invitations/inv-1').flush(CUESTIONARIO);
    fixture.detectChanges();
  }

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function enviarIncompleto(): Promise<void> {
    raiz().querySelector<HTMLButtonElement>('[data-testid="responder-enviar"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function aviso(): HTMLElement | null {
    return raiz().querySelector<HTMLElement>('[data-testid="responder-faltantes"]');
  }

  it('al fallar la validación muestra el aviso, lo enfoca y lo lleva a la vista', async () => {
    montar(false);
    document.body.appendChild(raiz());

    await enviarIncompleto();

    const alerta = aviso();
    expect(alerta).not.toBeNull();
    expect(alerta?.textContent).toContain('Faltan responder 2 preguntas obligatorias.');
    expect(alerta?.getAttribute('role')).toBe('alert');
    expect(alerta?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(alerta);
    expect(desplazar).toHaveBeenCalledTimes(1);
    expect(desplazar).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    // Ninguna escritura salió: el servidor no vio un envío incompleto.
    http.expectNone('/surveys/me/invitations/inv-1/responses');
  });

  it('con prefers-reduced-motion el desplazamiento es inmediato, sin animación', async () => {
    montar(true);
    document.body.appendChild(raiz());

    await enviarIncompleto();

    expect(desplazar).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
    expect(document.activeElement).toBe(aviso());
  });

  it('un segundo intento fallido vuelve a llevar el foco al aviso', async () => {
    montar(false);
    document.body.appendChild(raiz());

    await enviarIncompleto();
    const boton = raiz().querySelector<HTMLButtonElement>('[data-testid="responder-enviar"]');
    boton?.focus();
    expect(document.activeElement).toBe(boton);

    await enviarIncompleto();

    expect(document.activeElement).toBe(aviso());
    expect(desplazar).toHaveBeenCalledTimes(2);
  });

  it('un envío completo no mueve el foco ni el desplazamiento', async () => {
    montar(false);
    document.body.appendChild(raiz());
    const campos = raiz().querySelectorAll<HTMLTextAreaElement | HTMLInputElement>('textarea, input[type="text"]');
    campos.forEach((campo) => {
      campo.value = 'sí';
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    fixture.detectChanges();

    raiz().querySelector<HTMLButtonElement>('[data-testid="responder-enviar"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(aviso()).toBeNull();
    expect(desplazar).not.toHaveBeenCalled();
    const envio = http.expectOne('/surveys/me/invitations/inv-1/responses');
    envio.flush({});
    http.expectOne('/surveys/me/invitations').flush([]);
    http.expectOne((r) => r.url === '/patients/me/reviewable-care').flush({ canReview: false });
  });
});
