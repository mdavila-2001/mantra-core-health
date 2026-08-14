import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClinicalClient } from './clinical.client';
import type {
  AllergyIntoleranceRegistration,
  ClinicalSummary,
  ConditionRegistration,
  DiagnosticReportRegistration,
  EncounterRegistration,
  MedicationRequestRegistration,
  ObservationRegistration,
  PatientChart,
} from './clinical.types';

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

/** Una receta recién prescrita: en borrador y sin firmar. */
const RECETA_BORRADOR = {
  id: 'rx-1',
  patientProfileId: 'p-1',
  status: 'st-borrador',
  replacesRequestId: null,
  replacedByRequestId: null,
  renewedFromRequestId: null,
  signedAt: null,
  createdAt: '2026-08-13T12:00:00.000Z',
};

const CONDICION_REGISTRADA = {
  id: 'c-1',
  patientProfileId: 'p-1',
  clinicalStatus: 'st-activa',
  verificationStatus: 'st-confirmada',
  createdAt: '2026-08-13T12:00:00.000Z',
};

const ALERGIA_REGISTRADA = {
  id: 'a-1',
  patientProfileId: 'p-1',
  clinicalStatus: 'st-activa',
  reactionIds: ['re-1'],
  createdAt: '2026-08-13T12:00:00.000Z',
};

const OBSERVACION_REGISTRADA = {
  id: 'o-1',
  patientProfileId: 'p-1',
  status: 'st-final',
  componentIds: [],
  rowVersion: 1,
  createdAt: '2026-08-13T12:00:00.000Z',
};

/** Un informe recién emitido: su resultado todavía no se liberó. */
const INFORME_EMITIDO = {
  id: 'dr-1',
  patientProfileId: 'p-1',
  lifecycleStatus: 'st-final',
  resultReleaseStatus: null,
  serviceRequestId: null,
  createdAt: '2026-08-13T12:00:00.000Z',
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

  /* ---- la receta: prescribir, firmar, emitir ------------------------------ */

  it('createMedicationRequest manda sólo los tres obligatorios cuando no hay más', () => {
    client
      .createMedicationRequest({
        custodianTenantId: 't-1',
        patientProfileId: 'p-1',
        medicationConceptId: 'med-1',
      })
      .subscribe();

    const req = http.expectOne('/clinical/medication-requests');
    expect(req.request.method).toBe('POST');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'custodianTenantId',
      'medicationConceptId',
      'patientProfileId',
    ]);

    req.flush(RECETA_BORRADOR);
  });

  it('createMedicationRequest manda los textos libres y la cantidad tal cual', () => {
    client
      .createMedicationRequest({
        custodianTenantId: 't-1',
        patientProfileId: 'p-1',
        medicationConceptId: 'med-1',
        encounterId: 'e-1',
        doseText: '500 mg',
        frequencyText: 'cada 8 horas',
        quantityDecimal: 21,
      })
      .subscribe();

    const req = http.expectOne('/clinical/medication-requests');
    const body = req.request.body as Record<string, unknown>;
    expect(body['doseText']).toBe('500 mg');
    expect(body['frequencyText']).toBe('cada 8 horas');
    expect(body['quantityDecimal']).toBe(21);
    expect(body['encounterId']).toBe('e-1');

    req.flush(RECETA_BORRADOR);
  });

  /**
   * El contrato declara las vigencias como `date-time` y las valida con
   * `IsDateString`: el cuerpo lleva texto ISO, no el `Date` del formulario.
   */
  it('createMedicationRequest serializa las vigencias a ISO', () => {
    client
      .createMedicationRequest({
        custodianTenantId: 't-1',
        patientProfileId: 'p-1',
        medicationConceptId: 'med-1',
        validFrom: new Date('2026-08-13T12:00:00.000Z'),
      })
      .subscribe();

    const req = http.expectOne('/clinical/medication-requests');
    const body = req.request.body as Record<string, unknown>;
    expect(body['validFrom']).toBe('2026-08-13T12:00:00.000Z');
    expect('validTo' in body).toBe(false);

    req.flush(RECETA_BORRADOR);
  });

  /**
   * `signedAt: null` **es** el dato: dice que la receta sigue sin firmar, que es
   * lo que decide si emitir responde 200 o 422. Borrar la clave —el tratamiento
   * habitual de los nulos en la frontera— perdería justo esa distinción.
   */
  it('createMedicationRequest conserva el `signedAt` nulo del borrador', () => {
    let receta: MedicationRequestRegistration | undefined;
    client
      .createMedicationRequest({
        custodianTenantId: 't-1',
        patientProfileId: 'p-1',
        medicationConceptId: 'med-1',
      })
      .subscribe((r) => (receta = r));

    http.expectOne('/clinical/medication-requests').flush(RECETA_BORRADOR);

    expect(receta?.signedAt).toBeNull();
    expect(receta?.createdAt).toBeInstanceOf(Date);
  });

  it('signMedicationRequest va sin cuerpo: quién firma sale del token', () => {
    let receta: MedicationRequestRegistration | undefined;
    client.signMedicationRequest('rx-1').subscribe((r) => (receta = r));

    const req = http.expectOne('/clinical/medication-requests/rx-1/sign');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({ ...RECETA_BORRADOR, signedAt: '2026-08-13T12:30:00.000Z' });

    expect(receta?.signedAt).toBeInstanceOf(Date);
  });

  it('issueMedicationRequest pega contra el segmento `issue`', () => {
    client.issueMedicationRequest('rx-1').subscribe();

    const req = http.expectOne('/clinical/medication-requests/rx-1/issue');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({ ...RECETA_BORRADOR, status: 'st-emitida' });
  });

  it('escapa el identificador de la receta en las dos acciones', () => {
    client.signMedicationRequest('rx/1').subscribe();
    http.expectOne('/clinical/medication-requests/rx%2F1/sign').flush(RECETA_BORRADOR);

    client.issueMedicationRequest('rx/1').subscribe();
    http.expectOne('/clinical/medication-requests/rx%2F1/issue').flush(RECETA_BORRADOR);
  });

  /* ---- los tres registros de la ficha ------------------------------------- */

  it('createCondition serializa el inicio y omite lo que no vino', () => {
    let condicion: ConditionRegistration | undefined;
    client
      .createCondition({
        custodianTenantId: 't-1',
        patientProfileId: 'p-1',
        codeConceptId: 'cod-1',
        onsetAt: new Date('2026-07-01T00:00:00.000Z'),
      })
      .subscribe((c) => (condicion = c));

    const req = http.expectOne('/clinical/conditions');
    const body = req.request.body as Record<string, unknown>;
    expect(body['onsetAt']).toBe('2026-07-01T00:00:00.000Z');
    expect('severityConceptId' in body).toBe(false);

    req.flush(CONDICION_REGISTRADA);

    expect(condicion?.clinicalStatus).toBe('st-activa');
    expect(condicion?.createdAt).toBeInstanceOf(Date);
  });

  /**
   * Las reacciones son objetos anidados y el `forbidNonWhitelisted` del backend
   * también valida adentro: limpiar sólo el primer nivel dejaba pasar un
   * `severityConceptId: undefined` dentro de cada reacción.
   */
  it('createAllergyIntolerance limpia también las claves de cada reacción', () => {
    client
      .createAllergyIntolerance({
        custodianTenantId: 't-1',
        patientProfileId: 'p-1',
        substanceConceptId: 'sus-1',
        reactions: [{ manifestationConceptId: 'man-1' }],
      })
      .subscribe();

    const req = http.expectOne('/clinical/allergy-intolerances');
    const body = req.request.body as { reactions: readonly object[] };
    expect(Object.keys(body.reactions[0])).toEqual(['manifestationConceptId']);

    req.flush(ALERGIA_REGISTRADA);
  });

  it('createAllergyIntolerance sin reacciones no declara la clave', () => {
    let alergia: AllergyIntoleranceRegistration | undefined;
    client
      .createAllergyIntolerance({
        custodianTenantId: 't-1',
        patientProfileId: 'p-1',
        substanceConceptId: 'sus-1',
      })
      .subscribe((a) => (alergia = a));

    const req = http.expectOne('/clinical/allergy-intolerances');
    expect('reactions' in (req.request.body as object)).toBe(false);

    req.flush(ALERGIA_REGISTRADA);

    expect(alergia?.reactionIds).toEqual(['re-1']);
  });

  it('createObservation manda los ejecutantes y serializa la vigencia clínica', () => {
    let observacion: ObservationRegistration | undefined;
    client
      .createObservation({
        custodianTenantId: 't-1',
        patientProfileId: 'p-1',
        codeConceptId: 'cod-1',
        performers: [{ performerTypeConceptId: 'tipo-1', performerId: 'hp-1' }],
        valueDecimal: 36.8,
        effectiveStartAt: new Date('2026-08-13T09:00:00.000Z'),
      })
      .subscribe((o) => (observacion = o));

    const req = http.expectOne('/clinical/observations');
    const body = req.request.body as Record<string, unknown>;
    expect(body['effectiveStartAt']).toBe('2026-08-13T09:00:00.000Z');
    expect(body['valueDecimal']).toBe(36.8);
    expect(body['performers']).toEqual([
      { performerTypeConceptId: 'tipo-1', performerId: 'hp-1' },
    ]);
    expect('components' in body).toBe(false);

    req.flush(OBSERVACION_REGISTRADA);

    expect(observacion?.rowVersion).toBe(1);
    expect(observacion?.createdAt).toBeInstanceOf(Date);
  });

  /* ---- el informe diagnóstico: contrato sin pantalla ---------------------- */

  /**
   * Estos dos no los usa ninguna vista todavía —el informe no aparece en
   * ninguna lectura del backend— pero el contrato está verificado y estas
   * pruebas lo fijan: el día que exista el `GET`, la pantalla es lo único que
   * falta.
   */
  it('createDiagnosticReport omite lo que no vino', () => {
    let informe: DiagnosticReportRegistration | undefined;
    client
      .createDiagnosticReport({
        custodianTenantId: 't-1',
        patientProfileId: 'p-1',
        codeConceptId: 'cod-1',
      })
      .subscribe((i) => (informe = i));

    const req = http.expectOne('/clinical/diagnostic-reports');
    expect(req.request.method).toBe('POST');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'codeConceptId',
      'custodianTenantId',
      'patientProfileId',
    ]);

    req.flush(INFORME_EMITIDO);

    // `resultReleaseStatus` nulo **es** el dato: el informe existe y su
    // resultado todavía no se liberó a la persona.
    expect(informe?.resultReleaseStatus).toBeNull();
    expect(informe?.createdAt).toBeInstanceOf(Date);
  });

  it('releaseDiagnosticReport manda la versión esperada sólo si la hay', () => {
    client.releaseDiagnosticReport('dr-1').subscribe();
    const sinVersion = http.expectOne('/clinical/diagnostic-reports/dr-1/release');
    expect(sinVersion.request.body).toEqual({});
    sinVersion.flush(INFORME_EMITIDO);

    client.releaseDiagnosticReport('dr-1', 2).subscribe();
    const conVersion = http.expectOne('/clinical/diagnostic-reports/dr-1/release');
    expect(conVersion.request.body).toEqual({ expectedRowVersion: 2 });
    conVersion.flush({ ...INFORME_EMITIDO, resultReleaseStatus: 'st-liberado' });
  });

  /* -- la internación (UC-08-01) ------------------------------------------ */

  it('getSummary trae las internaciones con sus instantes convertidos', () => {
    let resumen: { careEpisodes: readonly { startAt?: Date; endAt?: Date }[] } | undefined;
    client.getSummary('p-1').subscribe((r) => (resumen = r));

    http.expectOne((r) => r.url === '/clinical/patients/p-1/summary').flush({
      ...RESUMEN_VACIO,
      careEpisodes: [
        {
          id: 'ce-1',
          tenantId: 't-1',
          statusConceptId: 'c-activo',
          startAt: '2026-08-13T10:00:00.000Z',
          endAt: null,
          createdAt: '2026-08-13T10:00:00.000Z',
        },
      ],
    });

    expect(resumen?.careEpisodes[0].startAt).toBeInstanceOf(Date);
    // Sin fin, la internación sigue abierta. La clave queda **ausente** y no en
    // `undefined`, que es lo que deja que `endAt === undefined` signifique eso.
    expect(resumen?.careEpisodes[0].endAt).toBeUndefined();
  });

  /**
   * El bloque es aditivo al contrato y frontend y API se despliegan por
   * separado: contra una API que todavía no lo publica, el expediente entero
   * reventaría por un bloque que esa versión no tiene.
   */
  it('getSummary tolera una API que todavía no publica las internaciones', () => {
    let resumen: { careEpisodes: readonly unknown[] } | undefined;
    client.getSummary('p-1').subscribe((r) => (resumen = r));

    http.expectOne((r) => r.url === '/clinical/patients/p-1/summary').flush(RESUMEN_VACIO);

    expect(resumen?.careEpisodes).toEqual([]);
  });

  it('createCareEpisode omite lo opcional y manda el inicio como instante ISO', () => {
    client
      .createCareEpisode({ patientProfileId: 'pp-1', tenantId: 't-1' })
      .subscribe();

    const sinOpcionales = http.expectOne('/clinical/care-episodes');
    expect(sinOpcionales.request.method).toBe('POST');
    // El backend valida con `forbidNonWhitelisted`: una clave en `undefined`
    // viajaría declarada y volvería 400.
    expect(sinOpcionales.request.body).toEqual({
      patientProfileId: 'pp-1',
      tenantId: 't-1',
    });
    sinOpcionales.flush({
      id: 'ce-1',
      patientProfileId: 'pp-1',
      tenantId: 't-1',
      status: 'c-activo',
      startAt: '2026-08-13T10:00:00.000Z',
      createdAt: '2026-08-13T10:00:00.000Z',
    });

    client
      .createCareEpisode({
        patientProfileId: 'pp-1',
        tenantId: 't-1',
        responsiblePractitionerId: 'prac-1',
        startAt: new Date('2026-08-13T10:00:00.000Z'),
      })
      .subscribe();

    const completo = http.expectOne('/clinical/care-episodes');
    expect(completo.request.body).toEqual({
      patientProfileId: 'pp-1',
      tenantId: 't-1',
      responsiblePractitionerId: 'prac-1',
      startAt: '2026-08-13T10:00:00.000Z',
    });
    completo.flush({
      id: 'ce-2',
      patientProfileId: 'pp-1',
      tenantId: 't-1',
      status: 'c-activo',
      startAt: null,
      createdAt: '2026-08-13T10:00:00.000Z',
    });
  });
});
