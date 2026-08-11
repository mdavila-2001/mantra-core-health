import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IdentityAdminClient } from './identity-admin.client';
import type {
  IssuedAssertion,
  OpenedCase,
  QueuedCase,
  RegisteredAuthority,
  RevokedAssertion,
} from './identity-admin.types';

const ORGANIZACION = '21212121-2121-2121-2121-212121212121';
const AUTORIDAD = '22222222-2222-2222-2222-222222222222';
const CASO = '23232323-2323-2323-2323-232323232323';
const CHECK = '24242424-2424-2424-2424-242424242424';
const REVISION = '25252525-2525-2525-2525-252525252525';
const ASERCION = '26262626-2626-2626-2626-262626262626';
const CONCEPTO = '27272727-2727-2727-2727-272727272727';

describe('IdentityAdminClient', () => {
  let client: IdentityAdminClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(IdentityAdminClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('pide la cola sin filtros y convierte las fechas', () => {
    let cola: readonly QueuedCase[] | undefined;
    client.listCaseQueue().subscribe((casos) => (cola = casos));

    const req = http.expectOne('/identity/verification-cases');
    expect(req.request.method).toBe('GET');
    // Sin filtros no viaja ningún parámetro: el backend decide qué estados
    // esperan revisión, y el front no duplica esa regla.
    expect(req.request.params.keys()).toEqual([]);
    req.flush({
      cases: [
        {
          id: CASO,
          status: CONCEPTO,
          subjectTypeConceptId: CONCEPTO,
          subjectEntityId: ORGANIZACION,
          identityVerificationPolicyId: AUTORIDAD,
          openedAt: '2026-08-10T12:00:00.000Z',
        },
      ],
    });

    expect(cola?.length).toBe(1);
    expect(cola?.[0].openedAt).toEqual(new Date('2026-08-10T12:00:00.000Z'));
    expect(cola?.[0].id).toBe(CASO);
  });

  it('omite los campos opcionales que no llegan, en vez de dejarlos indefinidos', () => {
    let cola: readonly QueuedCase[] | undefined;
    client.listCaseQueue().subscribe((casos) => (cola = casos));

    http.expectOne('/identity/verification-cases').flush({
      cases: [
        {
          id: CASO,
          status: CONCEPTO,
          subjectTypeConceptId: CONCEPTO,
          subjectEntityId: ORGANIZACION,
          identityVerificationPolicyId: AUTORIDAD,
        },
      ],
    });

    expect(cola?.[0]).not.toHaveProperty('openedAt');
    expect(cola?.[0]).not.toHaveProperty('riskScore');
  });

  it('manda status y limit cuando se los pide', () => {
    client.listCaseQueue({ status: CONCEPTO, limit: 10 }).subscribe();

    const req = http.expectOne(
      (r) =>
        r.url === '/identity/verification-cases' &&
        r.params.get('status') === CONCEPTO &&
        r.params.get('limit') === '10',
    );
    req.flush({ cases: [] });
  });

  it('registra la autoridad y convierte la fecha de alta', () => {
    let registrada: RegisteredAuthority | undefined;
    client
      .registerAuthority({
        tenantId: ORGANIZACION,
        authorityCode: 'RENAPER',
        name: 'Registro Nacional de las Personas',
        authorityTypeConceptId: CONCEPTO,
      })
      .subscribe((resultado) => (registrada = resultado));

    const req = http.expectOne('/identity/authorities');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tenantId: ORGANIZACION,
      authorityCode: 'RENAPER',
      name: 'Registro Nacional de las Personas',
      authorityTypeConceptId: CONCEPTO,
    });

    req.flush({
      id: 'a-1',
      authorityCode: 'RENAPER',
      status: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
    expect(registrada?.createdAt).toEqual(new Date('2026-08-08T12:00:00.000Z'));
  });

  it('publica el endpoint de la autoridad en su ruta anidada', () => {
    client
      .addAuthorityEndpoint(AUTORIDAD, {
        integrationEndpointId: CONCEPTO,
        capabilityConceptId: CONCEPTO,
      })
      .subscribe();

    const req = http.expectOne(`/identity/authorities/${AUTORIDAD}/endpoints`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      integrationEndpointId: CONCEPTO,
      capabilityConceptId: CONCEPTO,
    });

    req.flush({
      id: 'e-1',
      identityAuthorityId: AUTORIDAD,
      status: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
  });

  it('crea la política de verificación', () => {
    client
      .createVerificationPolicy({
        policyCode: 'IAL2-PACIENTE',
        subjectTypeConceptId: CONCEPTO,
        transactionRiskConceptId: CONCEPTO,
        requiredIdentityAssuranceLevelConceptId: CONCEPTO,
        versionNumber: 2,
      })
      .subscribe();

    const req = http.expectOne('/identity/verification-policies');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      policyCode: 'IAL2-PACIENTE',
      subjectTypeConceptId: CONCEPTO,
      transactionRiskConceptId: CONCEPTO,
      requiredIdentityAssuranceLevelConceptId: CONCEPTO,
      versionNumber: 2,
    });

    req.flush({
      id: 'p-1',
      policyCode: 'IAL2-PACIENTE',
      status: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
  });

  it('abre el caso y convierte apertura y vencimiento cuando llegan', () => {
    let abierto: OpenedCase | undefined;
    client
      .openCase({
        identityVerificationPolicyId: CONCEPTO,
        subjectTypeConceptId: CONCEPTO,
        subjectEntityId: ORGANIZACION,
        expiresInHours: 24,
      })
      .subscribe((resultado) => (abierto = resultado));

    const req = http.expectOne('/identity/verification-cases');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      identityVerificationPolicyId: CONCEPTO,
      subjectTypeConceptId: CONCEPTO,
      subjectEntityId: ORGANIZACION,
      expiresInHours: 24,
    });

    req.flush({ id: CASO, status: 'estado-uuid', expiresAt: '2026-08-09T12:00:00.000Z' });
    expect(abierto?.expiresAt).toEqual(new Date('2026-08-09T12:00:00.000Z'));
    // La apertura no llegó: la clave no se inventa.
    expect(abierto && 'openedAt' in abierto).toBe(false);
  });

  it('aporta la evidencia del caso', () => {
    client
      .submitEvidence(CASO, {
        evidenceTypeConceptId: CONCEPTO,
        evidenceFileId: ORGANIZACION,
      })
      .subscribe();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/evidence`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      evidenceTypeConceptId: CONCEPTO,
      evidenceFileId: ORGANIZACION,
    });

    req.flush({ id: 'ev-1', verificationStatus: 'estado-uuid', createdAt: '2026-08-08T12:00:00.000Z' });
  });

  it('planifica los checks contra el segmento con dos puntos, tal cual', () => {
    client
      .planChecks(CASO, {
        checks: [{ checkTypeConceptId: CONCEPTO, authorityId: AUTORIDAD, required: true }],
      })
      .subscribe();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/checks:plan`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      checks: [{ checkTypeConceptId: CONCEPTO, authorityId: AUTORIDAD, required: true }],
    });

    req.flush({ caseId: CASO, checkIds: [CHECK], caseStatus: 'estado-uuid' });
  });

  it('registra la señal de fraude con su puntaje como string numérico', () => {
    client
      .raiseFraudSignal(CASO, {
        signalTypeConceptId: CONCEPTO,
        severityConceptId: CONCEPTO,
        confidenceScore: '0.75',
      })
      .subscribe();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/fraud-signals`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      signalTypeConceptId: CONCEPTO,
      severityConceptId: CONCEPTO,
      confidenceScore: '0.75',
    });

    req.flush({ id: 'f-1', resolution: 'estado-uuid', caseStatus: 'estado-uuid' });
  });

  it('escala el caso a revisión manual', () => {
    client.openManualReview(CASO, { reviewReasonConceptId: CONCEPTO }).subscribe();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/manual-review`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reviewReasonConceptId: CONCEPTO });

    req.flush({ id: REVISION, status: 'estado-uuid', caseStatus: 'estado-uuid' });
  });

  it('emite la aserción y convierte la fecha de emisión', () => {
    let emitida: IssuedAssertion | undefined;
    client
      .issueAssertion(CASO, { issuerIdentityAuthorityId: AUTORIDAD, expiresInHours: 8760 })
      .subscribe((resultado) => (emitida = resultado));

    const req = http.expectOne(`/identity/verification-cases/${CASO}/assertions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      issuerIdentityAuthorityId: AUTORIDAD,
      expiresInHours: 8760,
    });

    req.flush({
      id: ASERCION,
      assuranceLevel: 'ial2-uuid',
      issuedAt: '2026-08-08T12:00:00.000Z',
      caseStatus: 'estado-uuid',
    });
    expect(emitida?.issuedAt).toEqual(new Date('2026-08-08T12:00:00.000Z'));
  });

  it('barre los casos vencidos con un cuerpo vacío', () => {
    client.sweepExpiredCases().subscribe();

    const req = http.expectOne('/identity/verification-cases/expire-sweep');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({ expiredCount: 3, caseIds: [CASO] });
  });

  it('registra el intento del check contra la autoridad', () => {
    client
      .recordCheckAttempt(CHECK, {
        identityAuthorityEndpointId: CONCEPTO,
        outcome: 'FAILED',
        retryEligible: true,
      })
      .subscribe();

    const req = http.expectOne(`/identity/checks/${CHECK}/attempts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      identityAuthorityEndpointId: CONCEPTO,
      outcome: 'FAILED',
      retryEligible: true,
    });

    req.flush({ id: 'i-1', attemptNumber: 1, outcome: 'estado-uuid', checkStatus: 'estado-uuid' });
  });

  it('registra el resultado del check con su puntaje y discrepancias', () => {
    client
      .recordCheckResult(CHECK, {
        result: 'NO_MATCH',
        matchScore: '0.12',
        discrepancyCodes: ['DOB_MISMATCH'],
      })
      .subscribe();

    const req = http.expectOne(`/identity/checks/${CHECK}/results`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      result: 'NO_MATCH',
      matchScore: '0.12',
      discrepancyCodes: ['DOB_MISMATCH'],
    });

    req.flush({ id: 'r-1', resultVersion: 1, result: 'estado-uuid', checkStatus: 'estado-uuid' });
  });

  it('decide la revisión manual', () => {
    client
      .decideManualReview(REVISION, { decision: 'REJECTED', decisionReason: 'Evidencia vencida' })
      .subscribe();

    const req = http.expectOne(`/identity/manual-review/${REVISION}/decision`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      decision: 'REJECTED',
      decisionReason: 'Evidencia vencida',
    });

    req.flush({ id: REVISION, status: 'estado-uuid', caseStatus: 'estado-uuid' });
  });

  it('revoca la aserción y convierte la fecha de revocación', () => {
    let revocada: RevokedAssertion | undefined;
    client
      .revokeAssertion(ASERCION, { raiseFraudSignal: false })
      .subscribe((resultado) => (revocada = resultado));

    const req = http.expectOne(`/identity/assertions/${ASERCION}/revoke`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ raiseFraudSignal: false });

    req.flush({ id: ASERCION, revokedAt: '2026-08-08T12:00:00.000Z', caseStatus: 'estado-uuid' });
    expect(revocada?.revokedAt).toEqual(new Date('2026-08-08T12:00:00.000Z'));
  });
});
