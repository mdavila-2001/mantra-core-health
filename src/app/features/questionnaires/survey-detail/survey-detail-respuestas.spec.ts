import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { API_BASE_URL } from '../../../core/data-access/api';
import { diaDeEnvio, SurveyDetailScreen } from './survey-detail';

/* ============================================================================
    «Respuestas recibidas»: privacidad de la fecha.

    La API devuelve `submittedAt` redondeado al DÍA (medianoche UTC) y deja de
    devolver `appointmentBookingId`. Fecha y hora exactas junto a un comentario
    permitirían atribuirlo a una cita. Lo que fija:
    1. La ficha muestra sólo el día —sin hora— y no lo corre un día al oeste de
       Greenwich (se formatea en UTC).
    2. Una respuesta sin `appointmentBookingId` se muestra igual.
    3. El CSV exporta sólo `AAAA-MM-DD`, sin hora ni reserva.
    ========================================================================== */

const pregunta = {
  id: 'q-1',
  position: 1,
  questionText: '¿Cómo fue?',
  answerType: 'TEXT',
  required: false,
};

function ficha(): Record<string, unknown> {
  return {
    id: 's-1',
    title: 'Satisfacción',
    status: 'ACTIVE',
    latestVersionNumber: 1,
    latestVersionId: 'ver-1',
    published: true,
    questionCount: 1,
    responseWindowDays: 7,
    effectiveFrom: null,
    effectiveTo: null,
    questions: [pregunta],
  };
}

/** Como la manda la API nueva: día redondeado y SIN `appointmentBookingId`. */
const respuesta = (n: number, dia: string) => ({
  id: `r-${n}`,
  invitationId: `i-${n}`,
  submittedAt: `${dia}T00:00:00.000Z`,
  answers: [
    {
      questionId: 'q-1',
      questionText: '¿Cómo fue?',
      answerType: 'TEXT',
      valueText: `Comentario ${n}`,
    },
  ],
});

describe('SurveyDetailScreen · respuestas recibidas', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let pantalla: SurveyDetailScreen;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        provideRouter([{ path: 'questionnaires/:surveyId', component: SurveyDetailScreen }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    pantalla = await harness.navigateByUrl('/questionnaires/s-1', SurveyDetailScreen);
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(ficha());
    http
      .expectOne((r) => r.url === '/surveys/templates/s-1/responses')
      .flush([
        respuesta(1, '2026-10-28'),
        respuesta(2, '2026-10-27'),
        respuesta(3, '2026-10-26'),
        respuesta(4, '2026-10-25'),
        respuesta(5, '2026-10-24'),
      ]);
    http.expectOne((r) => r.url === '/scheduling/service-offerings').flush({ items: [] });
    harness.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  const raiz = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  it('muestra sólo el día de cada respuesta, sin hora', () => {
    const fechas = Array.from(raiz().querySelectorAll('.encuesta__respuesta-fecha'), (el) =>
      (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(fechas).toHaveLength(5);
    // Primer día y año; nada con hora («10:30», «AM», «PM»).
    expect(fechas[0]).toMatch(/28/);
    expect(fechas[0]).toMatch(/2026/);
    for (const fecha of fechas) {
      expect(fecha).not.toMatch(/\d:\d/);
      expect(fecha).not.toMatch(/\b(AM|PM|a\. ?m\.|p\. ?m\.)\b/i);
    }
  });

  it('el día no retrocede aunque el huso local esté al oeste de Greenwich', () => {
    // Medianoche UTC del 28 es la tarde del 27 en La Paz: se formatea en UTC.
    const fechas = Array.from(raiz().querySelectorAll('.encuesta__respuesta-fecha'), (el) =>
      (el.textContent ?? '').trim(),
    );
    expect(fechas[0]).toMatch(/\b28\b/);
    expect(fechas[0]).not.toMatch(/\b27\b/);
  });

  it('una respuesta sin appointmentBookingId se muestra con su comentario', () => {
    expect(raiz().textContent).toContain('Comentario 1');
    expect(raiz().textContent).toContain('Comentario 5');
  });

  it('el CSV exporta sólo AAAA-MM-DD, sin hora ni reserva', async () => {
    let blob: Blob | null = null;
    vi.stubGlobal('URL', {
      createObjectURL: (b: Blob) => {
        blob = b;
        return 'blob:prueba';
      },
      revokeObjectURL: () => undefined,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    pantalla['descargarCsv']();

    expect(blob).not.toBeNull();
    const texto = await new Promise<string>((resolver) => {
      const lector = new FileReader();
      lector.onload = () => resolver(String(lector.result));
      lector.readAsText(blob!);
    });
    const filas = texto.replace(/^\uFEFF/, '').split('\r\n');
    expect(filas[0]).toBe('Fecha de envío,¿Cómo fue?');
    expect(filas[1]).toBe('2026-10-28,Comentario 1');
    expect(texto).not.toMatch(/T\d\d:\d\d/);
    expect(texto).not.toContain('bkg');
    vi.unstubAllGlobals();
  });
});

describe('diaDeEnvio', () => {
  it('devuelve el día en UTC, sin hora', () => {
    expect(diaDeEnvio(new Date('2026-10-28T00:00:00.000Z'))).toBe('2026-10-28');
    expect(diaDeEnvio(new Date('2026-10-28T23:59:59.000Z'))).toBe('2026-10-28');
  });

  it('sin fecha o con una fecha inválida devuelve vacío', () => {
    expect(diaDeEnvio(null)).toBe('');
    expect(diaDeEnvio(new Date('no es una fecha'))).toBe('');
  });
});
