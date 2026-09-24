import { HttpHeaders, provideHttpClient, withInterceptors, type HttpInterceptorFn } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { AI_BASE_URL, leerLectura, TriageIaClient } from './triage-ia.client';

/**
 * Lo que estas pruebas fijan.
 *
 * El cuerpo es **una respuesta real** del servicio desplegado
 * (`https://ai.173.249.39.237.sslip.io`, `symptom-check-bb8e00d6+anatomia-v1`,
 * 2026-09-23) para «se me durmió la mano izquierda y me salieron unas manchas
 * raras en la espalda», recortada a los campos que la pantalla lee.
 */
const RESPUESTA_REAL = {
  symptoms: [
    {
      code: 'hormigueo',
      label: 'hormigueo o adormecimiento',
      kind: 'curated',
      zones: ['manos'],
      bodyPart: { code: 'mano', label: 'mano', side: 'izquierdo' },
      alarm: false,
      especialidades: [
        { nombre: 'Neurología', peso: 3 },
        { nombre: 'Traumatología', peso: 1 },
        { nombre: 'Medicina general', peso: 1 },
      ],
    },
    {
      code: 'mancha:espalda',
      label: 'manchas en la espalda',
      kind: 'anatomy',
      zones: ['espalda', 'piel'],
      bodyPart: { code: 'espalda', label: 'espalda', side: null },
      alarm: false,
      especialidades: [
        { nombre: 'Dermatología', peso: 3 },
        { nombre: 'Medicina general', peso: 1 },
      ],
    },
  ],
  urgency: 'programada',
  knowledgeVersion: 'symptom-check-bb8e00d6+anatomia-v1',
};

/** Un interceptor como `authInterceptor`: si el cliente lo atravesara, la petición llevaría el JWT. */
const conJwt: HttpInterceptorFn = (req, next) =>
  next(req.clone({ headers: new HttpHeaders({ Authorization: 'Bearer jwt-del-paciente' }) }));

describe('TriageIaClient', () => {
  let client: TriageIaClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([conJwt])),
        provideHttpClientTesting(),
        { provide: AI_BASE_URL, useValue: '/ai' },
      ],
    });
    client = TestBed.inject(TriageIaClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('manda el texto al servicio en el mismo origen y devuelve lo que entendió', async () => {
    const lectura = firstValueFrom(client.analizar('se me durmió la mano izquierda'));
    const req = http.expectOne('/ai/v1/triage/analyze');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'se me durmió la mano izquierda' });
    req.flush(RESPUESTA_REAL);
    const resultado = await lectura;
    expect(resultado?.symptoms.map((s) => s.code)).toEqual(['hormigueo', 'mancha:espalda']);
    expect(resultado?.urgency).toBe('programada');
  });

  it('no atraviesa los interceptores de la aplicación: el servicio no recibe el JWT del paciente', async () => {
    const lectura = firstValueFrom(client.analizar('me duele el brazo'));
    const req = http.expectOne('/ai/v1/triage/analyze');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(RESPUESTA_REAL);
    await lectura;
  });

  it('si el servicio falla, devuelve null en vez de un error', async () => {
    const lectura = firstValueFrom(client.analizar('me duele el brazo'));
    http.expectOne('/ai/v1/triage/analyze').flush('caído', { status: 503, statusText: 'Service Unavailable' });
    expect(await lectura).toBeNull();
  });
});

describe('leerLectura', () => {
  it('acepta la respuesta real', () => {
    expect(leerLectura(RESPUESTA_REAL)?.symptoms).toHaveLength(2);
  });

  it('descarta lo que no tiene la forma esperada sin romper', () => {
    expect(leerLectura(null)).toBeNull();
    expect(leerLectura('texto')).toBeNull();
    expect(leerLectura({ symptoms: 'no', urgency: 'programada' })).toBeNull();
    expect(leerLectura({ symptoms: [], urgency: 'otra' })).toBeNull();
    const conBasura = leerLectura({ symptoms: [RESPUESTA_REAL.symptoms[0], { code: 1 }, null], urgency: 'urgente' });
    expect(conBasura?.symptoms.map((s) => s.code)).toEqual(['hormigueo']);
  });
});
