import { prescriptionList, type SimulatedPrescription } from '../fixtures/clinic';
import { PRESCRIPTION_STATUS } from '../fixtures/concepts';
import { professionalById } from '../fixtures/people';
import {
  forbidden,
  noContent,
  notFound,
  preconditionFailed,
  unauthorized,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import type { MockUser } from '../mock-session';
import { ahora, Coleccion, cuerpo, nuevoId } from '../mock-store';
import { sha256Hex } from '../sha256';

/* ============================================================================
    El enlace para compartir una receta (FAR-01, `CONTRATO.md` §1), con las
    formas de `delegated_access/dto/prescription-shares.dto.ts` de la API.
    «Abrir receta» de la farmacia (`/pharmacy/prescription-shares/:token`) es
    de FAR-02: usa {@link shareByToken} y {@link activeItemsOf} de acá.
    ========================================================================== */

/** Qué se compartió: la receta de una consulta o un fármaco suelto. */
export type ShareResourceType = 'PRESCRIPTION_ENCOUNTER' | 'MEDICATION_REQUEST';

/** El estado calculado al leer (S-5): vencido aunque la fila no lo diga. */
export type ShareStatus = 'VALID' | 'EXPIRED' | 'REVOKED';

/**
 * Un enlace guardado. Como en la API, **sin el token**: solo su SHA-256. El
 * token en claro sale una vez, en el 201, y no hay forma de volver a pedirlo.
 */
export interface SimulatedShare {
  readonly id: string;
  readonly tokenHash: string;
  readonly resourceType: ShareResourceType;
  readonly resourceId: string;
  readonly patientProfileId: string;
  readonly createdByUserId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  /** Aperturas `OPENED` de una farmacia (las suma FAR-02). */
  readonly uses: number;
}

/** Sin `valid_to`, el enlace vence a los 30 días (S-5). */
const MAX_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const shareList = new Coleccion<SimulatedShare>([]).persistirEn('mock.clinica.enlaces-de-receta');

/** 32 bytes aleatorios en base64url: 43 caracteres, como `randomBytes(32)` de la API. */
export function issueShareToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function shareByToken(token: string): SimulatedShare | undefined {
  const hash = sha256Hex(token);
  return shareList.filtrar((share) => share.tokenHash === hash)[0];
}

export function shareStatusOf(share: SimulatedShare, now = Date.now()): ShareStatus {
  if (share.revokedAt !== null) return 'REVOKED';
  return Date.parse(share.expiresAt) <= now ? 'EXPIRED' : 'VALID';
}

/** Los ítems de la receta: el encuentro entero o el fármaco suelto (S-2). */
function itemsOf(resourceType: ShareResourceType, resourceId: string): SimulatedPrescription[] {
  if (resourceType === 'MEDICATION_REQUEST') {
    const item = prescriptionList.get(resourceId);
    return item === undefined ? [] : [item];
  }
  return prescriptionList.filtrar((item) => item.encounterId === resourceId);
}

/** Emitido y con `valid_to` futuro: lo que cuenta como receta vigente (S-2). */
function isActive(item: SimulatedPrescription, now: number): boolean {
  return (
    item.statusConceptId === PRESCRIPTION_STATUS['MR_ISSUED'] &&
    item.issuedAt !== null &&
    endOfValidity(item) > now
  );
}

/**
 * Hasta cuándo vale un ítem. `validTo` es un día (`YYYY-MM-DD`) y vale hasta el
 * final de ese día; sin `validTo` no vence (el enlace tope: 30 días).
 */
function endOfValidity(item: SimulatedPrescription): number {
  const validTo = item.validTo;
  if (validTo === null) return Number.POSITIVE_INFINITY;
  const end = Date.parse(validTo.length === 10 ? `${validTo}T23:59:59.999Z` : validTo);
  return Number.isNaN(end) ? Number.POSITIVE_INFINITY : end;
}

export function activeItemsOf(share: SimulatedShare, now = Date.now()): SimulatedPrescription[] {
  return itemsOf(share.resourceType, share.resourceId).filter((item) => isActive(item, now));
}

/** El dueño (el paciente) o quien lo creó: los únicos que lo ven y lo revocan. */
function ownsOrCreated(share: SimulatedShare, user: MockUser): boolean {
  return share.patientProfileId === user.patientProfileId || share.createdByUserId === user.id;
}

/** La lista del paciente: nunca el token ni su hash. */
function summaryOf(share: SimulatedShare) {
  return {
    shareId: share.id,
    resourceType: share.resourceType,
    resourceId: share.resourceId,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    status: shareStatusOf(share),
    uses: share.uses,
  };
}

/** El origen de la aplicación, para armar `url` como `WEB_APP_BASE_URL` en la API. */
function webAppOrigin(): string {
  return typeof location === 'undefined' ? '' : location.origin;
}

function create(request: MockRequest) {
  const user = request.user;
  if (user === null) return unauthorized('Inicie sesión para compartir una receta.');

  const body = cuerpo<{ encounterId: string; medicationRequestId: string }>(request);
  const hasEncounter = typeof body.encounterId === 'string' && body.encounterId !== '';
  const hasItem = typeof body.medicationRequestId === 'string' && body.medicationRequestId !== '';
  if (hasEncounter === hasItem) {
    return validation('Indique exactamente uno: encounterId o medicationRequestId.');
  }

  const resourceType: ShareResourceType = hasEncounter ? 'PRESCRIPTION_ENCOUNTER' : 'MEDICATION_REQUEST';
  const resourceId = (hasEncounter ? body.encounterId : body.medicationRequestId) ?? '';
  const items = itemsOf(resourceType, resourceId);
  // Receta inexistente y receta de otro paciente: el mismo 404, sin filtrar existencia.
  const patientProfileId = items[0]?.patientProfileId;
  if (patientProfileId === undefined) return notFound('Receta no encontrada');

  const isOwner = user.patientProfileId === patientProfileId;
  const isPrescriber =
    user.practitionerProfileId !== undefined &&
    items.every((item) => item.prescriberProfileId === user.practitionerProfileId);
  if (!isOwner && !isPrescriber) {
    return user.practitionerProfileId !== undefined
      ? forbidden('Solo la médica que emitió la receta o su paciente pueden compartirla.')
      : notFound('Receta no encontrada');
  }

  const now = Date.now();
  const active = items.filter((item) => isActive(item, now));
  if (active.length === 0) {
    // S-9: el motivo va en `details.reason` y también arriba, como la API.
    const reason = 'PRESCRIPTION_SHARE_NO_ACTIVE_ITEMS';
    const rejected = preconditionFailed('La receta no tiene medicamentos emitidos y vigentes para compartir.', {
      reason,
    });
    return { ...rejected, body: { ...(rejected.body as object), reason } };
  }

  // Vence con la receta (el `valid_to` más próximo) o a los 30 días, lo que ocurra primero.
  const expires = Math.min(now + MAX_DAYS * DAY_MS, ...active.map(endOfValidity));
  const token = issueShareToken();
  const share = shareList.agregar({
    id: nuevoId('share'),
    tokenHash: sha256Hex(token),
    resourceType,
    resourceId,
    patientProfileId,
    createdByUserId: user.id,
    createdAt: ahora(),
    expiresAt: new Date(expires).toISOString(),
    revokedAt: null,
    uses: 0,
  });

  return {
    status: 201,
    body: {
      shareId: share.id,
      url: `${webAppOrigin()}/rx/${token}`,
      token,
      expiresAt: share.expiresAt,
      itemCount: active.length,
    },
  };
}

function listForPatient(request: MockRequest) {
  const user = request.user;
  if (user === null) return unauthorized();
  const patientProfileId = request.query.get('patientProfileId') ?? '';
  const isPatient = user.patientProfileId === patientProfileId;
  // Otro paciente: 404, como la API. La médica ve solo los que creó para ese paciente.
  if (!isPatient && user.practitionerProfileId === undefined) return notFound();
  return shareList
    .filtrar(
      (share) =>
        share.patientProfileId === patientProfileId && (isPatient || share.createdByUserId === user.id),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(summaryOf);
}

function resolveOwnership(request: MockRequest) {
  const user = request.user;
  if (user === null) return unauthorized();
  const share = shareByToken(request.params['token'] ?? '');
  if (share === undefined || !ownsOrCreated(share, user)) return notFound();
  return { shareId: share.id, resourceType: share.resourceType, resourceId: share.resourceId };
}

function revoke(request: MockRequest) {
  const user = request.user;
  if (user === null) return unauthorized();
  const share = shareList.get(request.params['shareId'] ?? '');
  if (share === undefined || !ownsOrCreated(share, user)) return notFound();
  // Revocar dos veces es 204 sin cambios.
  if (share.revokedAt === null) {
    shareList.actualizar(share.id, { revokedAt: ahora() });
  }
  return noContent();
}

/**
 * La vista sin sesión: estado, cuándo y quién la emitió (nombre y matrícula),
 * cuántos ítems vigentes. **Nada del paciente ni de los fármacos.** Revocado,
 * solo dice `REVOKED`.
 */
function readPublic(request: MockRequest) {
  const share = shareByToken(request.params['token'] ?? '');
  if (share === undefined) return notFound();

  const status = shareStatusOf(share);
  const headers = { 'Cache-Control': 'no-store' };
  if (status === 'REVOKED') {
    return {
      status: 200,
      body: { status, issuedAt: null, prescriberName: null, prescriberLicense: null, itemCount: 0 },
      headers,
    };
  }

  const active = activeItemsOf(share);
  const shown = active.length > 0 ? active : itemsOf(share.resourceType, share.resourceId);
  const issued = shown.map((item) => item.issuedAt).filter((value): value is string => value !== null).sort();
  const prescriber = professionalById(shown[0]?.prescriberProfileId ?? '');
  return {
    status: 200,
    body: {
      status,
      issuedAt: issued[0] ?? null,
      prescriberName: prescriber?.displayName ?? null,
      prescriberLicense:
        prescriber !== undefined && prescriber.matricula !== ''
          ? { number: prescriber.matricula, authority: null, state: prescriber.verified ? 'ACTIVE' : 'PENDING' }
          : null,
      itemCount: active.length,
    },
    headers,
  };
}

export function registerPrescriptionShares(router: MockRouter): void {
  router.post('/clinical/prescription-shares', create);
  router.get('/clinical/prescription-shares', listForPatient);
  router.get('/clinical/prescription-shares/by-token/:token', resolveOwnership);
  router.post('/clinical/prescription-shares/:shareId/revoke', revoke);
  router.get('/public/prescription-shares/:token', readPublic);
}
