import type { MyTrackingConsentStatus, TrackingConsent } from '../../data-access/telemetry/telemetry-consent.client';
import { notFound, reply, unauthorized, validation, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, nuevoId, uuid } from '../mock-store';

/*
 * SIMULATED tracking-consent backend (M28 `TelemetryConsentController`):
 *   GET  /telemetry/tracking-consents/me?purposeDefinitionId=...
 *   POST /telemetry/tracking-consents
 *   POST /telemetry/tracking-consents/:id/withdraw
 *
 * Always about the authenticated user: the body never names anyone and a
 * `userId` key is rejected, like the API does. Append-only: withdrawing keeps
 * the grant and stamps `withdrawnAt`.
 *
 * NOT verified against the real API: what a second withdraw of the same
 * consent answers (undocumented). Here it is idempotent and returns the same,
 * already withdrawn record.
 */

/** A grant by one person; the withdrawal completes it, it does not replace it. */
interface StoredConsent extends TrackingConsent {
  readonly consentVersion: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Decision concepts: the same for everybody, stable across reloads. */
const DECISION_GRANTED = uuid('tracking-decision-granted');
const DECISION_WITHDRAWN = uuid('tracking-decision-withdrawn');

export const trackingConsents = new Coleccion<StoredConsent>([]).persistirEn('mock.telemetria.consentimientos');

function esUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID.test(valor);
}

function publicar({ consentVersion: _version, ...consentimiento }: StoredConsent): TrackingConsent {
  return consentimiento;
}

/** The most recent consent of that person for that purpose. */
function ultimoDe(userId: string, purposeDefinitionId: string): StoredConsent | undefined {
  return trackingConsents
    .filtrar((c) => c.userId === userId && c.purposeDefinitionId === purposeDefinitionId)
    .sort((a, b) => (b.grantedAt ?? '').localeCompare(a.grantedAt ?? ''))[0];
}

function propositoInvalido() {
  return validation('purposeDefinitionId debe ser un UUID.', [
    { field: 'purposeDefinitionId', message: 'purposeDefinitionId must be a UUID' },
  ]);
}

function estadoDe(request: MockRequest) {
  const user = request.user;
  if (user === null) return unauthorized();

  const purposeDefinitionId = request.query.get('purposeDefinitionId');
  if (!esUuid(purposeDefinitionId)) return propositoInvalido();

  const ultimo = ultimoDe(user.id, purposeDefinitionId);
  const respuesta: MyTrackingConsentStatus =
    ultimo === undefined
      ? { status: 'NONE', purposeDefinitionId }
      : ultimo.withdrawnAt !== undefined
        ? { status: 'WITHDRAWN', purposeDefinitionId }
        : { status: 'GRANTED', consentId: ultimo.id, purposeDefinitionId };
  return respuesta;
}

function otorgar(request: MockRequest) {
  const user = request.user;
  if (user === null) return unauthorized();

  const datos = cuerpo<{ purposeDefinitionId: unknown; consentVersion: unknown; userId: unknown }>(request);
  if ('userId' in datos) {
    return validation('property userId should not exist', [{ field: 'userId', message: 'property userId should not exist' }]);
  }
  if (!esUuid(datos.purposeDefinitionId)) return propositoInvalido();
  if (typeof datos.consentVersion !== 'string' || datos.consentVersion.trim() === '') {
    return validation('consentVersion es obligatorio.', [
      { field: 'consentVersion', message: 'consentVersion should not be empty' },
    ]);
  }

  // Granting twice does not add a second record: the standing one comes back.
  const vigente = ultimoDe(user.id, datos.purposeDefinitionId);
  if (vigente !== undefined && vigente.withdrawnAt === undefined) return reply(201, publicar(vigente));

  const nuevo: StoredConsent = {
    id: nuevoId('consent'),
    userId: user.id,
    purposeDefinitionId: datos.purposeDefinitionId,
    decisionConceptId: DECISION_GRANTED,
    grantedAt: ahora(),
    consentVersion: datos.consentVersion.trim(),
  };
  trackingConsents.agregar(nuevo);
  return reply(201, publicar(nuevo));
}

function retirar(request: MockRequest) {
  const user = request.user;
  if (user === null) return unauthorized();

  // Somebody else's consent is a 404, not a 403: its existence is not confirmed.
  const consentimiento = trackingConsents.get(request.params['id'] ?? '');
  if (consentimiento === undefined || consentimiento.userId !== user.id) {
    return notFound('No se encontró el consentimiento.');
  }
  if (consentimiento.withdrawnAt !== undefined) return reply(201, publicar(consentimiento));

  const retirado = trackingConsents.actualizar(consentimiento.id, {
    decisionConceptId: DECISION_WITHDRAWN,
    withdrawnAt: ahora(),
  });
  return reply(201, publicar(retirado ?? consentimiento));
}

export function registrarConsentimientoDeTracking(router: MockRouter): void {
  router.get('/telemetry/tracking-consents/me', estadoDe);
  router.post('/telemetry/tracking-consents', otorgar);
  router.post('/telemetry/tracking-consents/:id/withdraw', retirar);
}
