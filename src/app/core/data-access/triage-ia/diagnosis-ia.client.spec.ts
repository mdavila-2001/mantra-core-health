import {
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
  type HttpInterceptorFn,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { DiagnosisIaClient, leerSugerencia } from './diagnosis-ia.client';
import { AI_BASE_URL } from './triage-ia.client';

/**
 * Lo que estas pruebas fijan.
 *
 * El cuerpo es **una respuesta real** del servicio (`AlovidaAIService`,
 * rama `feat/triage-service`, `knowledgeVersion` con `glosario-v1`,
 * 2026-09-26) para `{"symptomCodes":["fiebre","tos","dolor-de-pecho"]}`,
 * recortada a los campos que la pantalla lee.
 */
const RESPUESTA_REAL = {
  source: 'catalog',
  recognized: true,
  symptoms: [
    { code: 'fiebre', label: 'fiebre' },
    { code: 'tos', label: 'tos' },
    { code: 'dolor-de-pecho', label: 'dolor de pecho' },
  ],
  tentativeDiagnoses: [
    {
      slug: 'neumonia',
      code: 'J18.9',
      codeSystem: 'icd10cm',
      label: 'Neumonía',
      score: 0.63,
      why: 'Por fiebre, tos y dolor de pecho.',
      matchedSymptoms: ['fiebre', 'tos', 'dolor-de-pecho'],
      suggestedTests: [
        {
          slug: 'radiografia-de-torax',
          code: '36643-5',
          codeSystem: 'loinc',
          label: 'Radiografía de tórax',
          category: 'IMAGING',
        },
      ],
    },
  ],
  suggestedOrders: [
    {
      slug: 'radiografia-de-torax',
      code: '36643-5',
      codeSystem: 'loinc',
      label: 'Radiografía de tórax',
      category: 'IMAGING',
      forDiagnoses: ['neumonia'],
    },
  ],
  disclaimer:
    'Apoyo al criterio médico; no es un diagnóstico. El diagnóstico nace como presuntivo y lo confirma o rechaza el profesional.',
  knowledgeVersion: 'symptom-check-2862369d+anatomia-v1+glosario-v1-2862369d',
  model: null,
  providerLatencyMs: null,
  usage: { promptTokens: null, completionTokens: null, totalTokens: null },
};

/** Un interceptor como `authInterceptor`: si el cliente lo atravesara, la petición llevaría el JWT. */
const conJwt: HttpInterceptorFn = (req, next) =>
  next(req.clone({ headers: new HttpHeaders({ Authorization: 'Bearer jwt-del-medico' }) }));

describe('DiagnosisIaClient', () => {
  let client: DiagnosisIaClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([conJwt])),
        provideHttpClientTesting(),
        { provide: AI_BASE_URL, useValue: '/ai' },
      ],
    });
    client = TestBed.inject(DiagnosisIaClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('manda las respuestas al servicio en el mismo origen y devuelve los tentativos', async () => {
    const sugerencia = firstValueFrom(
      client.sugerir({
        answers: [{ question: '¿Tiene fiebre?', answer: 'sí, desde hace tres días' }],
        symptomCodes: ['tos'],
      }),
    );
    const req = http.expectOne('/ai/v1/diagnosis/suggest');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      answers: [{ question: '¿Tiene fiebre?', answer: 'sí, desde hace tres días' }],
      symptomCodes: ['tos'],
    });
    req.flush(RESPUESTA_REAL);

    const resultado = await sugerencia;
    expect(resultado?.tentativeDiagnoses.map((d) => d.slug)).toEqual(['neumonia']);
    expect(resultado?.tentativeDiagnoses[0].suggestedTests[0].category).toBe('IMAGING');
    expect(resultado?.suggestedOrders[0].forDiagnoses).toEqual(['neumonia']);
    expect(resultado?.disclaimer).toContain('no es un diagnóstico');
  });

  it('no atraviesa los interceptores: la petición sale sin el JWT', () => {
    client.sugerir({ freeText: 'fiebre y tos' }).subscribe();
    const req = http.expectOne('/ai/v1/diagnosis/suggest');
    expect(req.request.headers.has('Authorization')).toBe(false);
    // Las claves vacías no viajan: el servicio exige al menos una con valor.
    expect(req.request.body).toEqual({ freeText: 'fiebre y tos' });
    req.flush(RESPUESTA_REAL);
  });

  it('límite: sin tentativos devuelve listas vacías, no null', async () => {
    const sugerencia = firstValueFrom(client.sugerir({ symptomCodes: ['no-existe'] }));
    http.expectOne('/ai/v1/diagnosis/suggest').flush({
      ...RESPUESTA_REAL,
      recognized: false,
      symptoms: [],
      tentativeDiagnoses: [],
      suggestedOrders: [],
    });
    const resultado = await sugerencia;
    expect(resultado).not.toBeNull();
    expect(resultado?.tentativeDiagnoses).toEqual([]);
    expect(resultado?.suggestedOrders).toEqual([]);
    expect(resultado?.recognized).toBe(false);
  });

  it('límite: un score fuera de rango se recorta y una fila rota se descarta', () => {
    const leida = leerSugerencia({
      ...RESPUESTA_REAL,
      tentativeDiagnoses: [
        { ...RESPUESTA_REAL.tentativeDiagnoses[0], score: 1.7 },
        { ...RESPUESTA_REAL.tentativeDiagnoses[0], slug: 'otra', score: -3 },
        { slug: 'sin-etiqueta', score: 0.5 },
        'no soy un objeto',
      ],
      suggestedOrders: [
        { ...RESPUESTA_REAL.suggestedOrders[0], category: 'RARA' },
        RESPUESTA_REAL.suggestedOrders[0],
      ],
    });
    expect(leida?.tentativeDiagnoses.map((d) => [d.slug, d.score])).toEqual([
      ['neumonia', 1],
      ['otra', 0],
    ]);
    expect(leida?.suggestedOrders).toHaveLength(1);
  });

  it('inválido: el HTML del SSR, un 502 o el tiempo agotado se leen como «sin sugerencia»', async () => {
    const html = firstValueFrom(client.sugerir({ freeText: 'fiebre' }));
    http.expectOne('/ai/v1/diagnosis/suggest').flush('<!doctype html><html></html>');
    expect(await html).toBeNull();

    const caida = firstValueFrom(client.sugerir({ freeText: 'fiebre' }));
    http
      .expectOne('/ai/v1/diagnosis/suggest')
      .flush({ message: 'Bad Gateway' }, { status: 502, statusText: 'Bad Gateway' });
    expect(await caida).toBeNull();

    expect(leerSugerencia(null)).toBeNull();
    expect(leerSugerencia({ source: 'model' })).toBeNull();
    expect(leerSugerencia({ ...RESPUESTA_REAL, source: 'oraculo' })).toBeNull();
  });
});
