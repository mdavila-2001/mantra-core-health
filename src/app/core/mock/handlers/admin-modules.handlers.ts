import { ESTADO } from '../fixtures/conceptos';
import { MEDICA, PACIENTE } from '../fixtures/personas';
import { notFound, type MockRouter } from '../mock-router';
import { TENANT_CLINICA } from '../mock-session';
import { ahora, cuerpo, iso, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Módulos administrativos de escritura casi pura: acceso delegado,
    geolocalización, contexto de salud y proveedores de identidad federada.
    Cada operación devuelve el registro creado con el estado que la pantalla
    espera leer; el «efecto» se refleja en las lecturas que sí existen.
    ========================================================================== */

export function registrarModulosAdministrativos(router: MockRouter): void {
  /* ---- acceso delegado ----------------------------------------------------- */

  const creado = () => ({ status: 201, body: { id: nuevoId('recurso'), status: 'ACTIVE', createdAt: ahora() } });

  router.post('/org/:membershipId/user-assignments', creado);
  router.patch('/org/user-assignments/:id', (request) => {
    const datos = cuerpo<{ suspend?: boolean }>(request);
    return { id: request.params['id'], status: datos.suspend ? 'SUSPENDED' : 'ACTIVE', createdAt: iso(-30) };
  });
  router.post('/practitioner-delegates', creado);
  router.post('/practitioner-delegates/:id/access-requests', () => ({ status: 201, body: { id: nuevoId('access-request'), status: 'PENDING', createdAt: ahora() } }));
  router.post('/practitioner-delegates/:id/grants', creado);
  router.post('/practitioner-delegates/:id/revoke', () => ({ ok: true }));
  router.post('/access-requests/:id/decision', (request) => {
    const datos = cuerpo<{ decision: 'APPROVED' | 'DENIED' }>(request);
    return { requestId: request.params['id'], decision: datos.decision ?? 'APPROVED', ...(datos.decision === 'DENIED' ? {} : { grantId: nuevoId('grant') }) };
  });
  router.post('/authz/effective-actor/evaluate', (request) => {
    const datos = cuerpo<{ purpose?: string; resourceType?: string }>(request);
    const permitido = datos.purpose !== 'BILLING' || datos.resourceType !== 'CLINICAL_NOTE';
    return { allowed: permitido, requiresStepUp: datos.resourceType === 'PRESCRIPTION', reason: permitido ? 'La delegación vigente cubre la operación.' : 'El conjunto de permisos no alcanza notas clínicas con propósito de facturación.' };
  });
  router.post('/delegated-access/expiry-sweep', () => ({ expiredGrants: 3, expiredDelegations: 1, expiredOrgAssignments: 0 }));
  router.post('/delegated-permission-sets', (request) => {
    const datos = cuerpo<{ items?: unknown[] }>(request);
    return { status: 201, body: { id: nuevoId('permission-set'), versionNumber: 1, itemCount: (datos.items ?? []).length } };
  });
  router.post('/delegated-permission-sets/:id/versions', (request) => {
    const datos = cuerpo<{ items?: unknown[] }>(request);
    return { status: 201, body: { id: nuevoId('permission-set-version'), versionNumber: 2, itemCount: (datos.items ?? []).length } };
  });

  /* ---- geolocalización ------------------------------------------------------ */

  const sujetos = new Map<string, { id: string; subjectId: string; subjectType: string; state: string; createdAt: string; lat: number; lng: number }>();
  const SUJETO_DEMO = uuid('tracked-subject-demo');
  sujetos.set(SUJETO_DEMO, { id: SUJETO_DEMO, subjectId: PACIENTE.id, subjectType: 'PERSON', state: 'ACTIVE', createdAt: iso(-10), lat: -17.7833, lng: -63.1821 });

  router.post('/geo/tracked-subjects', (request) => {
    const datos = cuerpo<{ subjectId: string; subjectType?: string }>(request);
    const nuevo = { id: nuevoId('tracked-subject'), subjectId: datos.subjectId ?? '', subjectType: datos.subjectType ?? 'PERSON', state: 'ACTIVE', createdAt: ahora(), lat: -17.7833, lng: -63.1821 };
    sujetos.set(nuevo.id, nuevo);
    const { lat: _a, lng: _b, ...body } = nuevo;
    return { status: 201, body };
  });
  router.post('/geo/tracked-subjects/:id/pings', (request) => {
    const datos = cuerpo<{ pings?: { latitude: number; longitude: number }[] }>(request);
    const s = sujetos.get(request.params['id']!);
    const ultimo = datos.pings?.at(-1);
    if (s !== undefined && ultimo !== undefined) sujetos.set(s.id, { ...s, lat: ultimo.latitude, lng: ultimo.longitude });
    return { status: 201, body: { recorded: (datos.pings ?? []).length } };
  });
  router.get('/geo/tracked-subjects/:id/last-position', ({ params }) => {
    const s = sujetos.get(params['id']!);
    if (s === undefined) return notFound('Sujeto no encontrado');
    return { pingId: uuid(`ping-${s.id}`), trackedSubjectId: s.id, latitude: String(s.lat), longitude: String(s.lng), accuracyM: '12.5', capturedAt: iso(0, new Date().getHours(), Math.max(0, new Date().getMinutes() - 3)), recordedAt: ahora() };
  });
  router.post('/geo/tracked-subjects/:id/revoke-consent', ({ params }) => {
    const s = sujetos.get(params['id']!);
    if (s !== undefined) sujetos.set(s.id, { ...s, state: 'CONSENT_REVOKED' });
    return { ok: true };
  });
  router.post('/geo/tracking-sessions', (request) => {
    const datos = cuerpo<{ trackedSubjectId: string }>(request);
    return { status: 201, body: { id: nuevoId('tracking-session'), trackedSubjectId: datos.trackedSubjectId ?? SUJETO_DEMO, status: 'ACTIVE', startedAt: ahora(), endedAt: null } };
  });
  router.post('/geo/tracking-sessions/:id/close', ({ params }) => ({ id: params['id'], trackedSubjectId: SUJETO_DEMO, status: 'CLOSED', startedAt: iso(0, 8), endedAt: ahora() }));
  router.post('/geo/trips', (request) => {
    const datos = cuerpo<{ trackingSessionId: string }>(request);
    return { status: 201, body: { id: nuevoId('trip'), trackingSessionId: datos.trackingSessionId ?? '', status: 'IN_PROGRESS', distanceM: null, durationS: null, startedAt: ahora(), endedAt: null } };
  });
  router.post('/geo/trips/:id/close', (request) => {
    const datos = cuerpo<{ distanceM?: number; durationS?: number }>(request);
    return { id: request.params['id'], trackingSessionId: nuevoId('tracking-session'), status: 'COMPLETED', distanceM: String(datos.distanceM ?? 4200), durationS: datos.durationS ?? 900, startedAt: iso(0, 8), endedAt: ahora() };
  });
  router.post('/geo/geofences', (request) => {
    const datos = cuerpo<{ tenantId: string; name: string; shapeType: string }>(request);
    return { status: 201, body: { id: nuevoId('geofence'), tenantId: datos.tenantId ?? TENANT_CLINICA, name: datos.name ?? 'Geocerca', shapeType: datos.shapeType ?? 'CIRCLE', state: 'ACTIVE', createdAt: ahora() } };
  });
  router.post('/geo/geofence-events', (request) => {
    const datos = cuerpo<{ geofenceId: string; trackedSubjectId: string; eventType: string; occurredAt?: string }>(request);
    return { status: 201, body: { id: nuevoId('geofence-event'), geofenceId: datos.geofenceId ?? '', trackedSubjectId: datos.trackedSubjectId ?? '', eventType: datos.eventType ?? 'ENTER', occurredAt: datos.occurredAt ?? ahora(), recordedAt: ahora() } };
  });

  /* ---- contexto de salud ---------------------------------------------------- */

  router.get('/health-context/contexts/resolve', ({ query }) => {
    const country = query.get('country') ?? 'BO';
    const domain = query.get('domain') ?? 'EPIDEMIOLOGY';
    const key = query.get('key') ?? 'dengue-alert';
    return {
      contextId: uuid(`context-${country}-${domain}-${key}`),
      versionId: uuid(`context-version-${key}-3`),
      versionNumber: 3,
      contextPayloadJson: {
        title: key === 'dengue-alert' ? 'Alerta epidemiológica de dengue · Santa Cruz' : `Contexto ${key}`,
        summary: 'Aumento sostenido de casos de dengue en las últimas 4 semanas epidemiológicas; se recomienda reforzar la sospecha clínica ante fiebre sin foco.',
        source: 'SEDES Santa Cruz · Boletín epidemiológico semanal',
        weeks: [{ week: 33, cases: 412 }, { week: 34, cases: 538 }, { week: 35, cases: 690 }, { week: 36, cases: 745 }],
      },
      observedAt: iso(-2, 8),
      expiresAt: iso(5, 8),
      stale: false,
      facts: [
        { id: uuid('fact-1'), factKey: 'cases_last_week', valueType: 'integer', valueJson: 745, metricConceptId: uuid('concept-metric-cases'), unitConceptId: null, confidenceScore: '0.92', evidenceObservationIds: [uuid('obs-hc-1')] },
        { id: uuid('fact-2'), factKey: 'trend', valueType: 'string', valueJson: 'RISING', metricConceptId: null, unitConceptId: null, confidenceScore: '0.88', evidenceObservationIds: [uuid('obs-hc-1'), uuid('obs-hc-2')] },
        { id: uuid('fact-3'), factKey: 'incidence_per_100k', valueType: 'decimal', valueJson: 38.4, metricConceptId: uuid('concept-metric-incidence'), unitConceptId: uuid('concept-unit-per-100k'), confidenceScore: '0.85', evidenceObservationIds: [uuid('obs-hc-2')] },
      ],
    };
  });
  router.post('/health-context/agents', (request) => {
    const datos = cuerpo<{ code: string }>(request);
    return { status: 201, body: { id: nuevoId('agent'), code: datos.code ?? 'AGENT', statusConceptId: ESTADO['ST-ACTIVE']! } };
  });
  router.post('/health-context/sources', (request) => {
    const datos = cuerpo<{ code: string }>(request);
    return { status: 201, body: { id: nuevoId('source'), code: datos.code ?? 'SRC', statusConceptId: ESTADO['ST-ACTIVE']! } };
  });
  router.post('/health-context/schedules', (request) => {
    const datos = cuerpo<{ agentId: string; nextRunAt?: string }>(request);
    return { status: 201, body: { id: nuevoId('schedule'), agentId: datos.agentId ?? '', statusConceptId: ESTADO['ST-ACTIVE']!, nextRunAt: datos.nextRunAt ?? iso(1, 3) } };
  });
  router.post('/health-context/contexts', (request) => {
    const datos = cuerpo<{ contextKey: string }>(request);
    return { status: 201, body: { id: nuevoId('context'), contextKey: datos.contextKey ?? 'ctx', statusConceptId: ESTADO['ST-DRAFT']! } };
  });
  router.post('/health-context/contexts/:id/versions', (request) => {
    const datos = cuerpo<{ facts?: { evidence?: unknown[] }[] }>(request);
    const hechos = datos.facts ?? [];
    return { status: 201, body: { id: nuevoId('context-version'), versionNumber: 1, statusConceptId: ESTADO['ST-DRAFT']!, contentHash: `sha256:${Date.now().toString(16).padStart(16, '0')}`, factIds: hechos.map(() => nuevoId('fact')), evidenceCount: hechos.reduce((s, f) => s + (f.evidence?.length ?? 0), 0) } };
  });
  router.post('/health-context/versions/:id/quality-reviews', (request) => {
    const datos = cuerpo<{ outcome?: 'APPROVED' | 'REJECTED' }>(request);
    return { status: 201, body: { id: nuevoId('review'), contextVersionId: request.params['id'], versionStatusConceptId: datos.outcome === 'REJECTED' ? ESTADO['ST-REJECTED']! : ESTADO['ST-VERIFIED']! } };
  });
  router.post('/health-context/versions/:id/publish', ({ params }) => ({ id: params['id'], versionNumber: 4, statusConceptId: ESTADO['ST-PUBLISHED']!, countryHealthContextId: uuid('context-BO-EPIDEMIOLOGY-dengue-alert'), supersededVersionId: uuid('context-version-dengue-alert-3') }));
  router.post('/health-context/versions/:id/supersede', ({ params }) => ({ id: params['id'], statusConceptId: ESTADO['ST-ARCHIVED']!, contextStatusConceptId: ESTADO['ST-ACTIVE']!, currentVersionId: uuid('context-version-dengue-alert-3') }));
  router.post('/health-context/collection-runs', (request) => {
    const datos = cuerpo<{ idempotencyKey?: string }>(request);
    return { status: 201, body: { id: uuid(`run-${datos.idempotencyKey ?? Date.now()}`), statusConceptId: ESTADO['ST-IN-PROGRESS']!, duplicate: false } };
  });
  router.post('/health-context/collection-runs/:id/observations', (request) => {
    const datos = cuerpo<{ status?: string }>(request);
    return { status: 201, body: { id: nuevoId('observation'), statusConceptId: datos.status === 'REJECTED' ? ESTADO['ST-REJECTED']! : ESTADO['ST-ACTIVE']!, duplicate: false } };
  });
  router.post('/health-context/collection-runs/:id/finish', (request) => {
    const datos = cuerpo<{ outcome?: string }>(request);
    return { id: request.params['id'], statusConceptId: datos.outcome === 'FAILED' ? ESTADO['ST-REJECTED']! : ESTADO['ST-COMPLETED']!, observationsRead: '12', observationsAccepted: datos.outcome === 'FAILED' ? '0' : '11', observationsRejected: datos.outcome === 'FAILED' ? '12' : '1', sourceCount: 3 };
  });

  /* ---- proveedores de identidad federada ----------------------------------- */

  router.post('/auth-providers/identity-providers', (request) => {
    const datos = cuerpo<{ code: string; isGlobal?: boolean }>(request);
    return { status: 201, body: { id: nuevoId('idp'), code: datos.code ?? 'IDP', stateConceptId: ESTADO['ST-ACTIVE']!, isGlobal: datos.isGlobal ?? false } };
  });
  router.put('/auth-providers/identity-providers/:id/protocol-configs', (request) => {
    const datos = cuerpo<{ discoveredKeys?: unknown[] }>(request);
    return { id: nuevoId('protocol-config'), providerId: request.params['id'], environmentConceptId: uuid('concept-env-production'), replaced: true, importedKeyIds: (datos.discoveredKeys ?? []).map(() => nuevoId('key')) };
  });
  router.post('/auth-providers/identity-providers/:id/protocol-configs', (request) => {
    const datos = cuerpo<{ discoveredKeys?: unknown[] }>(request);
    return { status: 201, body: { id: nuevoId('protocol-config'), providerId: request.params['id'], environmentConceptId: uuid('concept-env-production'), replaced: false, importedKeyIds: (datos.discoveredKeys ?? []).map(() => nuevoId('key')) } };
  });
  router.post('/auth-providers/identity-providers/:id/signing-keys', (request) => {
    const datos = cuerpo<{ keyId: string }>(request);
    return { status: 201, body: { id: nuevoId('signing-key'), keyId: datos.keyId ?? 'kid', stateConceptId: ESTADO['ST-ACTIVE']! } };
  });
  router.post('/auth-providers/identity-providers/:id/signing-keys/rotate', (request) => {
    const datos = cuerpo<{ keyId: string; graceHours?: number }>(request);
    return { newKeyId: datos.keyId ?? 'kid-2', retiringCount: 1, graceUntil: iso(Math.ceil((datos.graceHours ?? 24) / 24)) };
  });
  router.put('/auth-providers/identity-providers/:id/attribute-mappings', (request) => {
    const datos = cuerpo<{ mappings?: { sourceClaim: string; isIdentifier?: boolean }[] }>(request);
    return { providerId: request.params['id'], mappingIds: (datos.mappings ?? []).map(() => nuevoId('mapping')), removed: 0, identifierClaim: datos.mappings?.find((m) => m.isIdentifier)?.sourceClaim ?? 'sub' };
  });
  router.post('/auth-providers/tenant-bindings', (request) => {
    const datos = cuerpo<{ providerId: string; tenantId: string; isEnabled?: boolean }>(request);
    return { status: 201, body: { id: nuevoId('binding'), providerId: datos.providerId ?? '', tenantId: datos.tenantId ?? TENANT_CLINICA, isEnabled: datos.isEnabled ?? true, updated: false } };
  });
  router.post('/auth-providers/identity-providers/:id/provisioning-rules', (request) => {
    const datos = cuerpo<{ priority: number; effect: string }>(request);
    return { status: 201, body: { id: nuevoId('rule'), priority: datos.priority ?? 10, effectConceptId: uuid(`concept-effect-${datos.effect ?? 'ALLOW'}`), isActive: true } };
  });
  router.post('/auth-providers/identity-providers/by-code/:code/authorize', () => ({ status: 201, body: { attemptId: nuevoId('attempt'), state: `st-${Date.now().toString(36)}`, nonce: `n-${Date.now().toString(36)}`, authorizeUrl: 'https://idp.mock/authorize', pkceRequired: true } }));
  router.post('/auth-providers/identity-providers/by-code/:code/callback', (request) => {
    const datos = cuerpo<{ userId?: string }>(request);
    return { outcomeConceptId: uuid('concept-federated-outcome-success'), provisioned: datos.userId === undefined, attemptId: nuevoId('attempt'), federatedIdentityId: nuevoId('federated-identity'), userId: datos.userId ?? MEDICA.userId };
  });
  router.post('/auth-providers/account-link-requests', (request) => {
    const datos = cuerpo<{ expiresInMinutes?: number }>(request);
    return { status: 201, body: { id: nuevoId('link-request'), linkToken: `lt-${Date.now().toString(36)}`, expiresAt: new Date(Date.now() + (datos.expiresInMinutes ?? 30) * 60_000).toISOString(), statusConceptId: ESTADO['ST-PENDING']! } };
  });
  router.post('/auth-providers/account-link-requests/complete', () => ({ requestId: nuevoId('link-request'), federatedIdentityId: nuevoId('federated-identity'), userId: MEDICA.userId, statusConceptId: ESTADO['ST-LINKED']! }));
  router.post('/auth-providers/federated-identities/:id/unlink', ({ params }) => ({ id: params['id'], stateConceptId: ESTADO['ST-UNLINKED']!, attemptId: nuevoId('attempt') }));
}
