import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClinicalClient } from './clinical.client';
import type { ClinicalSummary, EncounterRegistration, PatientChart } from './clinical.types';

/** Un resumen mínimo con todos los bloques presentes, que es como llega. */
const RESUMEN_VACIO = {
  patientProfileId: 'p-1',
  conditions: [],
  allergies: [],
  medicationRequests: [],
  observations: [],
  encounters: [],
  limit: 50,
  truncated: [],
};

const CHART_VACIO = {
  patientProfileId: 'p-1',
  notes: [],
  carePlans: [],
  documents: [],
  limit: 50,
  truncated: [],
};

/** Un encuentro recién abierto: `endAt` es `null`, no ausente. */
const ENCUENTRO_ABIERTO = {
  id: 'e-1',
  patientProfileId: 'p-1',
  episodeId: null,
  status: 'st-en-curso',
  participantIds: [],
  locationIds: [],
  startAt: '2026-03-01T10:00:00.000Z',
  endAt: null,
  createdAt: '2026-03-01T10:00:00.000Z',
};

describe('ClinicalClient', () => {
  let client: ClinicalClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(ClinicalClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getSummary sin tope no manda `limit`: la API tiene el suyo', () => {
    client.getSummary('p-1').subscribe();

    const req = http.expectOne((r) => r.url === '/clinical/patients/p-1/summary');
    expect(req.request.params.has('limit')).toBe(false);

    req.flush(RESUMEN_VACIO);
  });

  it('getSummary con tope lo manda', () => {
    client.getSummary('p-1', 50).subscribe();

    const req = http.expectOne((r) => r.url === '/clinical/patients/p-1/summary');
    expect(req.request.params.get('limit')).toBe('50');

    req.flush(RESUMEN_VACIO);
  });

  it('getSummary convierte las fechas de cada bloque', () => {
    let resumen: ClinicalSummary | undefined;
    client.getSummary('p-1').subscribe((r) => (resumen = r));

    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({
        ...RESUMEN_VACIO,
        conditions: [
          {
            id: 'c-1',
            codeConceptId: 'con-1',
            onsetAt: '2026-01-02T00:00:00.000Z',
            createdAt: '2026-01-03T00:00:00.000Z',
          },
        ],
        encounters: [{ id: 'e-1', statusConceptId: 'st-1', startAt: '2026-02-01T09:00:00.000Z' }],
      });

    expect(resumen?.conditions[0].onsetAt).toBeInstanceOf(Date);
    expect(resumen?.conditions[0].createdAt).toBeInstanceOf(Date);
    expect(resumen?.encounters[0].startAt).toBeInstanceOf(Date);
  });

  /**
   * Una fecha ausente tiene que quedar **ausente**, no `undefined` declarado:
   * con la clave presente, `'resolvedAt' in condicion` diría que la condición
   * está resuelta cuando no lo está.
   */
  it('una fecha que no vino no deja la clave declarada', () => {
    let resumen: ClinicalSummary | undefined;
    client.getSummary('p-1').subscribe((r) => (resumen = r));

    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({
        ...RESUMEN_VACIO,
        conditions: [{ id: 'c-1', codeConceptId: 'con-1', createdAt: '2026-01-03T00:00:00.000Z' }],
      });

    expect('resolvedAt' in (resumen?.conditions[0] ?? {})).toBe(false);
    expect('onsetAt' in (resumen?.conditions[0] ?? {})).toBe(false);
  });

  it('getChart pega contra `charts`, que es otro módulo del backend', () => {
    client.getChart('p-1', 50).subscribe();

    const req = http.expectOne((r) => r.url === '/charts/patients/p-1/chart');
    expect(req.request.params.get('limit')).toBe('50');

    req.flush(CHART_VACIO);
  });

  it('getChart convierte las fechas de las notas y las actividades del plan', () => {
    let chart: PatientChart | undefined;
    client.getChart('p-1').subscribe((c) => (chart = c));

    http
      .expectOne((r) => r.url === '/charts/patients/p-1/chart')
      .flush({
        ...CHART_VACIO,
        notes: [
          {
            noteId: 'n-1',
            lifecycleStatusConceptId: 'st-1',
            releasedToPatient: false,
            signedAt: '2026-03-01T10:00:00.000Z',
            createdAt: '2026-03-01T09:00:00.000Z',
          },
        ],
        carePlans: [
          {
            id: 'cp-1',
            statusConceptId: 'st-2',
            activities: [{ id: 'a-1', scheduledAt: '2026-03-05T08:00:00.000Z' }],
            createdAt: '2026-03-01T09:00:00.000Z',
          },
        ],
      });

    expect(chart?.notes[0].signedAt).toBeInstanceOf(Date);
    expect(chart?.carePlans[0].activities[0].scheduledAt).toBeInstanceOf(Date);
    expect(chart?.carePlans[0].createdAt).toBeInstanceOf(Date);
  });

  it('reenvía `truncated` tal cual: un expediente recortado en silencio miente', () => {
    let resumen: ClinicalSummary | undefined;
    client.getSummary('p-1').subscribe((r) => (resumen = r));

    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({ ...RESUMEN_VACIO, truncated: ['observations'] });

    expect(resumen?.truncated).toEqual(['observations']);
  });

  it('escapa el identificador del paciente en la ruta', () => {
    client.getSummary('p/1').subscribe();
    http.expectOne('/clinical/patients/p%2F1/summary').flush(RESUMEN_VACIO);
  });

  /* ---- escrituras del encuentro ------------------------------------------ */

  /**
   * El backend valida con `forbidNonWhitelisted`: una clave declarada con
   * `undefined` no es «no la mandé», es «la mandé vacía», y vuelve 400. Es el
   * mismo defecto que ya costó caro en los clientes con query params.
   */
  it('checkInEncounter no manda las claves opcionales ausentes', () => {
    client.checkInEncounter({ patientProfileId: 'p-1', tenantId: 't-1' }).subscribe();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect(req.request.method).toBe('POST');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'patientProfileId',
      'tenantId',
    ]);

    req.flush(ENCUENTRO_ABIERTO);
  });

  it('checkInEncounter manda el motivo cuando lo hay', () => {
    client
      .checkInEncounter({
        patientProfileId: 'p-1',
        tenantId: 't-1',
        reasonText: 'Control anual',
      })
      .subscribe();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect((req.request.body as Record<string, unknown>)['reasonText']).toBe('Control anual');

    req.flush(ENCUENTRO_ABIERTO);
  });

  /**
   * Los tres instantes llegan `nullable`, no ausentes: un encuentro recién
   * abierto trae `endAt: null`. Convertir eso a `new Date(null)` daría la época
   * Unix, que en una historia clínica se lee como un encuentro cerrado en 1970.
   */
  it('checkInEncounter convierte los instantes y respeta el `null`', () => {
    let encuentro: EncounterRegistration | undefined;
    client
      .checkInEncounter({ patientProfileId: 'p-1', tenantId: 't-1' })
      .subscribe((e) => (encuentro = e));

    http.expectOne('/clinical/encounters/check-in').flush(ENCUENTRO_ABIERTO);

    expect(encuentro?.startAt).toBeInstanceOf(Date);
    expect(encuentro?.endAt).toBeNull();
    expect(encuentro?.createdAt).toBeInstanceOf(Date);
  });

  it('closeEncounter sin versión esperada manda un cuerpo vacío', () => {
    client.closeEncounter('e-1').subscribe();

    const req = http.expectOne('/clinical/encounters/e-1/close');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({ ...ENCUENTRO_ABIERTO, endAt: '2026-03-01T11:00:00.000Z' });
  });

  it('closeEncounter manda la versión esperada para el bloqueo optimista', () => {
    client.closeEncounter('e-1', 3).subscribe();

    const req = http.expectOne('/clinical/encounters/e-1/close');
    expect(req.request.body).toEqual({ expectedRowVersion: 3 });

    req.flush({ ...ENCUENTRO_ABIERTO, endAt: '2026-03-01T11:00:00.000Z' });
  });

  it('escapa el identificador del encuentro en la ruta del cierre', () => {
    client.closeEncounter('e/1').subscribe();
    http.expectOne('/clinical/encounters/e%2F1/close').flush(ENCUENTRO_ABIERTO);
  });
});
