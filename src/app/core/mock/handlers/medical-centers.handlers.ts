import type {
  MedicalCenterItem,
  MedicalCenterOffer,
  MedicalCenterPage,
} from '../../data-access/medical-centers/medical-centers.types';
import { orderList } from '../fixtures/clinic';
import { MEDICAL_CENTER_SITES, type MedicalCenterSite } from '../fixtures/medical-centers';
import { PACIENTE } from '../fixtures/people';
import { notFound, reply, unauthorized, type MockReply, type MockRequest, type MockRouter } from '../mock-router';

/* ============================================================================
    Búsqueda de centros médicos por procedimiento (CM-09, doble de CM-05).

      GET /medical-centers/search                     público
      GET /medical-centers/search/for-my-orders       autenticado, solo el titular

    Contrato en `CONTRATO.md` §4. El orden es el de la API y el mismo para
    todos: completos primero, después la distancia (sin distancia, al final),
    después el precio total y por último el nombre. Las sugerencias del médico
    (`practitionerWorksHere`, `suggestedByPractitioner`) **no** entran en la
    comparación, ni siquiera como desempate.
    ========================================================================== */

const MAX_IDS = 50;
const DEFAULT_LIMIT = 20;
const EARTH_RADIUS_KM = 6371;

/** Lo que la orden de CM-04/CM-08 agrega y esta maqueta todavía no tipa. */
interface OrderWithSuggestion {
  readonly suggestedPracticeSiteId?: string | null;
}

interface GeoOrigin {
  readonly lat: number;
  readonly lng: number;
}

type SiteMarker = (item: MedicalCenterItem, site: MedicalCenterSite) => MedicalCenterItem;

function badRequest(message: string): MockReply {
  return reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message, error: 'Bad Request' });
}

/** Quién pide, como paciente: el de la sesión, o el de ejemplo si pide la médica. */
function sessionPatientId(request: MockRequest): string {
  return request.user?.patientProfileId ?? (request.user?.key === 'medica' ? PACIENTE.id : '');
}

/** Una lista de ids separados por coma, sin vacíos ni repetidos. */
function idsOf(request: MockRequest, name: string): readonly string[] {
  const raw = request.query.get(name) ?? '';
  return [...new Set(raw.split(',').map((id) => id.trim()).filter((id) => id !== ''))];
}

function originOf(request: MockRequest): GeoOrigin | null | MockReply {
  const lat = request.query.get('lat');
  const lng = request.query.get('lng');
  if (lat === null && lng === null) {
    return null;
  }
  if (lat === null || lng === null) {
    return badRequest('lat y lng viajan juntos.');
  }
  const origin = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(origin.lat) && Number.isFinite(origin.lng)
    ? origin
    : badRequest('lat y lng deben ser números.');
}

/** Distancia en línea recta, un decimal: la misma resolución que se muestra. */
function distanceKm(from: GeoOrigin, to: GeoOrigin): number {
  const radians = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** `null` si la sede no ofrece ninguno de los procedimientos pedidos. */
function evaluate(
  site: MedicalCenterSite,
  requested: readonly string[],
  origin: GeoOrigin | null,
): MedicalCenterItem | null {
  const offers: MedicalCenterOffer[] = requested.flatMap((id) =>
    site.offers.filter((offer) => offer.procedureConceptId === id),
  );
  if (offers.length === 0) {
    return null;
  }
  const missing = requested.filter((id) => !offers.some((offer) => offer.procedureConceptId === id));
  const complete = missing.length === 0;
  return {
    practiceId: site.practiceId,
    practiceSiteId: site.practiceSiteId,
    name: site.name,
    addressText: site.addressText,
    latitude: site.latitude,
    longitude: site.longitude,
    distanceKm: origin === null ? null : distanceKm(origin, { lat: site.latitude, lng: site.longitude }),
    complete,
    missingProcedureConceptIds: missing,
    offers,
    // Un total parcial no se puede comparar con uno completo: no se inventa.
    totalPrice: complete ? offers.reduce((sum, offer) => sum + offer.price, 0) : null,
  };
}

/** Nulos al final, y entre números el menor primero. */
function smallestFirst(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** El orden de la API. No mira ninguna señal del médico. */
function apiOrder(a: MedicalCenterItem, b: MedicalCenterItem): number {
  if (a.complete !== b.complete) return a.complete ? -1 : 1;
  return (
    smallestFirst(a.distanceKm, b.distanceKm) ||
    smallestFirst(a.totalPrice, b.totalPrice) ||
    a.name.localeCompare(b.name, 'es')
  );
}

function pageOf(request: MockRequest, items: readonly MedicalCenterItem[]): MedicalCenterPage {
  const offset = Math.max(0, Number(request.query.get('offset') ?? 0) || 0);
  const limit = Math.min(100, Math.max(1, Number(request.query.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));
  // Se corta **después** de ordenar.
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}

function search(
  request: MockRequest,
  requested: readonly string[],
  mark: SiteMarker | null,
): MockReply | MedicalCenterPage {
  const origin = originOf(request);
  if (origin !== null && 'status' in origin) {
    return origin;
  }
  const withPartial = request.query.get('includePartial') === 'true';
  const items = MEDICAL_CENTER_SITES.flatMap((site) => {
    const item = evaluate(site, requested, origin);
    if (item === null || (!item.complete && !withPartial)) {
      return [];
    }
    return [mark === null ? item : mark(item, site)];
  }).sort(apiOrder);
  return pageOf(request, items);
}

export function registerMedicalCenters(router: MockRouter): void {
  router.get('/medical-centers/search', (request) => {
    const ids = idsOf(request, 'procedureConceptIds');
    if (ids.length < 1 || ids.length > MAX_IDS) {
      return badRequest(`procedureConceptIds necesita de 1 a ${MAX_IDS} ids sin repetir.`);
    }
    return search(request, ids, null);
  });

  router.get('/medical-centers/search/for-my-orders', (request) => {
    if (request.user === null) {
      return unauthorized();
    }
    const ids = idsOf(request, 'serviceRequestIds');
    if (ids.length < 1 || ids.length > MAX_IDS) {
      return badRequest(`serviceRequestIds necesita de 1 a ${MAX_IDS} ids sin repetir.`);
    }
    const holder = sessionPatientId(request);
    const found = ids.map((id) => orderList.get(id));
    // Una orden ajena responde igual que una que no existe.
    if (found.some((order) => order === undefined || order.patientProfileId !== holder)) {
      return notFound('Orden no encontrada');
    }
    const ownOrders = found.flatMap((order) => (order === undefined ? [] : [order]));
    const requested = [...new Set(ownOrders.map((order) => order.codeConceptId))];
    const doctors = new Set(ownOrders.map((order) => order.requesterProfileId));
    const suggested = new Set(
      ownOrders.flatMap((order) => {
        const siteId = (order as typeof order & OrderWithSuggestion).suggestedPracticeSiteId;
        return siteId === undefined || siteId === null ? [] : [siteId];
      }),
    );
    return search(request, requested, (item, site) => ({
      ...item,
      practitionerWorksHere: site.practitionerProfileIds.some((id) => doctors.has(id)),
      suggestedByPractitioner: suggested.has(site.practiceSiteId),
    }));
  });
}
