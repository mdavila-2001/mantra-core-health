import { ESTADO_DE_CASO } from '../fixtures/conceptos';
import { MEDICA, PACIENTE, PACIENTES, PROFESIONALES } from '../fixtures/personas';
import { notFound, type MockRequest, type MockRouter } from '../mock-router';
import { TENANT_CLINICA } from '../mock-session';
import { ahora, Coleccion, cuerpo, iso, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Verificación de identidad: los casos propios (paciente, profesional,
    organización) y la cola administrativa con sus chequeos, señales de fraude,
    revisiones manuales y aserciones.
    ========================================================================== */

export const SUJETO = {
  PATIENT: uuid('concept-subject-patient'),
  PRACTITIONER: uuid('concept-subject-practitioner'),
  TENANT: uuid('concept-subject-tenant'),
} as const;

export const POLITICA = {
  paciente: uuid('policy-patient-identity'),
  profesional: uuid('policy-practitioner-identity'),
  matricula: uuid('policy-practitioner-license'),
  organizacion: uuid('policy-tenant'),
} as const;

/**
 * El estado de un caso, **como concepto**.
 *
 * El backend real no emite `'VERIFIED'`: emite el identificador del concepto
 * `identity_assurance:CASE_VERIFIED`, y la interfaz lo resuelve contra
 * terminología (`features/identity-verification/case-status.ts`). El simulador
 * mandaba el enum interno en texto plano, así que la búsqueda por concepto no
 * encontraba nada y **las dos pantallas de trámites pintaban «Desconocido» en
 * todas las filas** — el defecto que el propietario señaló el 2026-09-10.
 *
 * Se guarda el enum corto en los datos, que es lo que se lee al escribirlos, y
 * se traduce al salir. `CHECKS_PENDING` y `IN_REVIEW` son los dos nombres que
 * el simulador ya usaba para estados que el catálogo llama distinto.
 */
const CONCEPTO_DE_ESTADO: Readonly<Record<string, string>> = {
  OPEN: ESTADO_DE_CASO['identity_assurance:CASE_OPEN']!,
  CHECKS_PENDING: ESTADO_DE_CASO['identity_assurance:CASE_CHECKS_PENDING']!,
  IN_REVIEW: ESTADO_DE_CASO['identity_assurance:CASE_IN_VERIFICATION']!,
  MANUAL_REVIEW: ESTADO_DE_CASO['identity_assurance:CASE_MANUAL_REVIEW']!,
  AT_RISK: ESTADO_DE_CASO['identity_assurance:CASE_AT_RISK']!,
  VERIFIED: ESTADO_DE_CASO['identity_assurance:CASE_VERIFIED']!,
  ASSERTED: ESTADO_DE_CASO['identity_assurance:CASE_ASSERTED']!,
  REJECTED: ESTADO_DE_CASO['identity_assurance:CASE_REJECTED']!,
  REVOKED: ESTADO_DE_CASO['identity_assurance:CASE_REVOKED']!,
  EXPIRED: ESTADO_DE_CASO['identity_assurance:CASE_EXPIRED']!,
};

/** El concepto del estado, o el enum tal cual si es uno que no está en el catálogo. */
function conceptoDeEstado(estado: string): string {
  return CONCEPTO_DE_ESTADO[estado] ?? estado;
}

interface CasoSimulado {
  readonly id: string;
  readonly status: string;
  readonly subjectTypeConceptId: string;
  readonly subjectEntityId: string;
  readonly identityVerificationPolicyId: string;
  readonly riskScore: string;
  readonly openedAt: string;
  readonly expiresAt: string;
  readonly completedAt: string | null;
  readonly userId: string;
  readonly type: string;
  readonly evidenceFileId: string | null;
  readonly checkIds: string[];
}

const casos = new Coleccion<CasoSimulado>([
  { id: uuid('case-paciente-identidad'), status: 'VERIFIED', subjectTypeConceptId: SUJETO.PATIENT, subjectEntityId: PACIENTE.id, identityVerificationPolicyId: POLITICA.paciente, riskScore: '0.12', openedAt: iso(-46, 10), expiresAt: iso(319), completedAt: iso(-45, 15), userId: PACIENTE.userId, type: 'PATIENT_IDENTITY', evidenceFileId: uuid('file-ci-paciente'), checkIds: [uuid('check-1')] },
  { id: uuid('case-medica-identidad'), status: 'VERIFIED', subjectTypeConceptId: SUJETO.PRACTITIONER, subjectEntityId: MEDICA.id, identityVerificationPolicyId: POLITICA.profesional, riskScore: '0.05', openedAt: iso(-38, 9), expiresAt: iso(327), completedAt: iso(-37, 11), userId: MEDICA.userId, type: 'PRACTITIONER_IDENTITY', evidenceFileId: uuid('file-ci-medica'), checkIds: [uuid('check-2')] },
  { id: uuid('case-medica-matricula'), status: 'VERIFIED', subjectTypeConceptId: SUJETO.PRACTITIONER, subjectEntityId: MEDICA.id, identityVerificationPolicyId: POLITICA.matricula, riskScore: '0.03', openedAt: iso(-12, 9), expiresAt: iso(353), completedAt: iso(-11, 16), userId: MEDICA.userId, type: 'PRACTITIONER_LICENSE', evidenceFileId: uuid('file-matricula-medica'), checkIds: [uuid('check-3')] },
  { id: uuid('case-medica-sanlucas'), status: 'IN_REVIEW', subjectTypeConceptId: SUJETO.TENANT, subjectEntityId: TENANT_CLINICA, identityVerificationPolicyId: POLITICA.organizacion, riskScore: '0.20', openedAt: iso(-3, 12), expiresAt: iso(4), completedAt: null, userId: MEDICA.userId, type: 'TENANT', evidenceFileId: uuid('file-nit-olivos'), checkIds: [uuid('check-4')] },
  { id: uuid('case-cola-1'), status: 'OPEN', subjectTypeConceptId: SUJETO.PRACTITIONER, subjectEntityId: PROFESIONALES[14]!.id, identityVerificationPolicyId: POLITICA.profesional, riskScore: '0.41', openedAt: iso(-2, 8), expiresAt: iso(5), completedAt: null, userId: PROFESIONALES[14]!.userId, type: 'PRACTITIONER_IDENTITY', evidenceFileId: uuid('file-ci-14'), checkIds: [uuid('check-5')] },
  { id: uuid('case-cola-2'), status: 'MANUAL_REVIEW', subjectTypeConceptId: SUJETO.PATIENT, subjectEntityId: PACIENTES[6]!.id, identityVerificationPolicyId: POLITICA.paciente, riskScore: '0.67', openedAt: iso(-5, 14), expiresAt: iso(2), completedAt: null, userId: PACIENTES[6]!.userId, type: 'PATIENT_IDENTITY', evidenceFileId: uuid('file-ci-p6'), checkIds: [uuid('check-6')] },
  { id: uuid('case-cola-3'), status: 'CHECKS_PENDING', subjectTypeConceptId: SUJETO.TENANT, subjectEntityId: uuid('tenant-clinica-nueva'), identityVerificationPolicyId: POLITICA.organizacion, riskScore: '0.30', openedAt: iso(-1, 16), expiresAt: iso(6), completedAt: null, userId: uuid('user-owner-nueva'), type: 'TENANT', evidenceFileId: uuid('file-nit-nueva'), checkIds: [] },
  { id: uuid('case-cola-4'), status: 'EXPIRED', subjectTypeConceptId: SUJETO.PRACTITIONER, subjectEntityId: PROFESIONALES[13]!.id, identityVerificationPolicyId: POLITICA.matricula, riskScore: '0.15', openedAt: iso(-30, 9), expiresAt: iso(-23), completedAt: null, userId: PROFESIONALES[13]!.userId, type: 'PRACTITIONER_LICENSE', evidenceFileId: null, checkIds: [] },
]);

function casoPropio(c: CasoSimulado) {
  return {
    id: c.id,
    status: conceptoDeEstado(c.status),
    openedAt: c.openedAt,
    completedAt: c.completedAt,
    type: c.type,
    expiresAt: c.expiresAt,
    evidence: c.evidenceFileId === null ? null : { fileId: c.evidenceFileId, submittedAt: c.openedAt },
    manualReview: c.status === 'MANUAL_REVIEW' ? { id: uuid(`review-${c.id}`), status: 'OPEN', reason: 'Documento con baja legibilidad' } : null,
  };
}

function abrirCaso(request: MockRequest, type: string, subject: keyof typeof SUJETO, policy: string): { status: number; body: unknown } {
  const datos = cuerpo<{ evidenceFileId: string }>(request);
  const user = request.user;
  const id = nuevoId('case');
  const check = nuevoId('check');
  casos.agregar({
    id,
    status: 'CHECKS_PENDING',
    subjectTypeConceptId: SUJETO[subject],
    subjectEntityId: user?.practitionerProfileId ?? user?.patientProfileId ?? user?.id ?? '',
    identityVerificationPolicyId: policy,
    riskScore: '0.10',
    openedAt: ahora(),
    expiresAt: iso(7),
    completedAt: null,
    userId: user?.id ?? '',
    type,
    evidenceFileId: datos.evidenceFileId ?? null,
    checkIds: [check],
  });
  return { status: 201, body: { caseId: id, checkId: check, status: 'CHECKS_PENDING' } };
}

export function registrarIdentidad(router: MockRouter): void {
  router.post('/identity/me/identity-verification', (request) => abrirCaso(request, 'PATIENT_IDENTITY', 'PATIENT', POLITICA.paciente));
  router.post('/identity/me/practitioner/identity-verification', (request) => abrirCaso(request, 'PRACTITIONER_IDENTITY', 'PRACTITIONER', POLITICA.profesional));
  router.post('/identity/me/practitioner/license-verification', (request) => abrirCaso(request, 'PRACTITIONER_LICENSE', 'PRACTITIONER', POLITICA.matricula));
  router.post('/identity/me/tenants/:id/verification', (request) => abrirCaso(request, 'TENANT', 'TENANT', POLITICA.organizacion));

  router.get('/identity/verification-types', () => [
    { type: 'PATIENT_IDENTITY', label: 'Identidad de paciente', description: 'Carnet de identidad o pasaporte vigente.', requiresFile: true, forRoles: ['PATIENT'] },
    { type: 'PRACTITIONER_IDENTITY', label: 'Identidad profesional', description: 'Carnet de identidad del profesional.', requiresFile: true, forRoles: ['PRACTITIONER', 'CLINICIAN'] },
    { type: 'PRACTITIONER_LICENSE', label: 'Matrícula profesional', description: 'Registro SEDES o matrícula del Colegio Médico.', requiresFile: true, forRoles: ['PRACTITIONER', 'CLINICIAN'] },
    { type: 'TENANT', label: 'Organización', description: 'NIT y licencia de funcionamiento.', requiresFile: true, forRoles: ['SECURITY_ADMIN'] },
  ]);

  router.get('/identity/me/verification-cases', (request) => casos.filtrar((c) => c.userId === request.user?.id).map(casoPropio));

  router.get('/identity/me/verification-cases/:id', ({ params }) => {
    const c = casos.get(params['id']!);
    return c === undefined ? notFound('Caso no encontrado') : casoPropio(c);
  });

  /* ---- administración ------------------------------------------------------ */

  router.get('/identity/verification-cases', ({ query }) => {
    const status = query.get('status');
    const limit = Number(query.get('limit') ?? 50) || 50;
    const items = casos
      .todos()
      .filter((c) => status === null || status === '' || c.status === status)
      .slice(0, limit)
      .map((c) => ({ id: c.id, status: conceptoDeEstado(c.status), subjectTypeConceptId: c.subjectTypeConceptId, subjectEntityId: c.subjectEntityId, identityVerificationPolicyId: c.identityVerificationPolicyId, riskScore: c.riskScore, openedAt: c.openedAt, expiresAt: c.expiresAt }));
    return { items, count: items.length };
  });

  router.post('/identity/verification-cases', (request) => {
    const datos = cuerpo<{ identityVerificationPolicyId: string; subjectTypeConceptId: string; subjectEntityId: string; expiresInHours?: number }>(request);
    const nuevo = casos.agregar({
      id: nuevoId('case'),
      status: 'OPEN',
      subjectTypeConceptId: datos.subjectTypeConceptId ?? SUJETO.PATIENT,
      subjectEntityId: datos.subjectEntityId ?? '',
      identityVerificationPolicyId: datos.identityVerificationPolicyId ?? POLITICA.paciente,
      riskScore: '0.00',
      openedAt: ahora(),
      expiresAt: iso(Math.ceil((datos.expiresInHours ?? 168) / 24)),
      completedAt: null,
      userId: '',
      type: 'ADMIN',
      evidenceFileId: null,
      checkIds: [],
    });
    return { status: 201, body: { id: nuevo.id, status: nuevo.status, openedAt: nuevo.openedAt, expiresAt: nuevo.expiresAt } };
  });

  router.post('/identity/authorities', (request) => {
    const datos = cuerpo<{ authorityCode: string }>(request);
    return { status: 201, body: { id: nuevoId('authority'), authorityCode: datos.authorityCode ?? 'AUT', status: 'ACTIVE', createdAt: ahora() } };
  });
  router.post('/identity/authorities/:id/endpoints', ({ params }) => ({ status: 201, body: { id: nuevoId('endpoint'), identityAuthorityId: params['id'], status: 'ACTIVE', createdAt: ahora() } }));
  router.post('/identity/verification-policies', (request) => {
    const datos = cuerpo<{ policyCode: string }>(request);
    return { status: 201, body: { id: nuevoId('policy'), policyCode: datos.policyCode ?? 'POL', status: 'ACTIVE', createdAt: ahora() } };
  });

  router.post('/identity/verification-cases/:id/evidence', ({ params }) => {
    const c = casos.get(params['id']!);
    if (c !== undefined) casos.actualizar(c.id, { status: 'CHECKS_PENDING' });
    return { status: 201, body: { id: nuevoId('evidence'), verificationStatus: 'PENDING', createdAt: ahora() } };
  });

  router.post('/identity/verification-cases/:id/checks:plan', (request) => {
    const c = casos.get(request.params['id']!);
    if (c === undefined) return notFound('Caso no encontrado');
    const datos = cuerpo<{ checks?: unknown[] }>(request);
    const ids = (datos.checks ?? [{}]).map(() => nuevoId('check'));
    casos.actualizar(c.id, { checkIds: [...c.checkIds, ...ids], status: 'CHECKS_PENDING' });
    return { caseId: c.id, checkIds: ids, caseStatus: 'CHECKS_PENDING' };
  });

  router.post('/identity/verification-cases/:id/fraud-signals', ({ params }) => {
    const c = casos.get(params['id']!);
    if (c !== undefined) casos.actualizar(c.id, { status: 'MANUAL_REVIEW', riskScore: '0.75' });
    return { status: 201, body: { id: nuevoId('fraud'), resolution: 'ESCALATED', caseStatus: 'MANUAL_REVIEW' } };
  });

  router.post('/identity/verification-cases/:id/manual-review', ({ params }) => {
    const c = casos.get(params['id']!);
    if (c !== undefined) casos.actualizar(c.id, { status: 'MANUAL_REVIEW' });
    return { status: 201, body: { id: nuevoId('review'), status: 'OPEN', caseStatus: 'MANUAL_REVIEW' } };
  });

  router.post('/identity/verification-cases/:id/assertions', ({ params }) => {
    const c = casos.get(params['id']!);
    if (c !== undefined) casos.actualizar(c.id, { status: 'VERIFIED', completedAt: ahora() });
    return { status: 201, body: { id: nuevoId('assertion'), assertionIdentifier: `IAL2-${Date.now().toString(36)}`, assuranceLevel: 'IAL2', issuedAt: ahora(), caseStatus: 'VERIFIED' } };
  });

  router.post('/identity/verification-cases/expire-sweep', () => {
    const vencidos = casos.filtrar((c) => c.completedAt === null && c.expiresAt < ahora());
    for (const c of vencidos) casos.actualizar(c.id, { status: 'EXPIRED' });
    return { expiredCount: vencidos.length, caseIds: vencidos.map((c) => c.id) };
  });

  router.post('/identity/checks/:id/attempts', (request) => {
    const datos = cuerpo<{ outcome?: string }>(request);
    return { status: 201, body: { id: nuevoId('attempt'), attemptNumber: 1, outcome: datos.outcome ?? 'SUCCESS', checkStatus: datos.outcome === 'FAILED' ? 'FAILED' : 'COMPLETED' } };
  });

  router.post('/identity/checks/:id/results', (request) => {
    const datos = cuerpo<{ result?: string }>(request);
    return { status: 201, body: { id: nuevoId('result'), resultVersion: 1, result: datos.result ?? 'MATCH', checkStatus: 'COMPLETED', caseStatus: datos.result === 'NO_MATCH' ? 'MANUAL_REVIEW' : 'VERIFIED' } };
  });

  router.post('/identity/manual-review/:id/decision', (request) => {
    const datos = cuerpo<{ decision?: 'APPROVED' | 'REJECTED' }>(request);
    const enRevision = casos.filtrar((c) => c.status === 'MANUAL_REVIEW')[0];
    if (enRevision !== undefined) casos.actualizar(enRevision.id, { status: datos.decision === 'REJECTED' ? 'REJECTED' : 'VERIFIED', completedAt: ahora() });
    return { id: request.params['id'], status: datos.decision ?? 'APPROVED', caseStatus: datos.decision === 'REJECTED' ? 'REJECTED' : 'VERIFIED' };
  });

  router.post('/identity/assertions/:id/revoke', ({ params }) => ({ id: params['id'], revokedAt: ahora(), caseStatus: 'REVOKED' }));
}
