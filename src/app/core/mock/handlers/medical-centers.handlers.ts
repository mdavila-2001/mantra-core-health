import type {
  MedicalCenterItem,
  MedicalCenterOffer,
  MedicalCenterPage,
} from '../../data-access/medical-centers/medical-centers.types';
import { ordenes } from '../fixtures/clinica';
import { SEDES_DE_CENTROS_MEDICOS, type SedeDeCentroMedico } from '../fixtures/medical-centers';
import { notFound, reply, unauthorized, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { pacienteDeSesion } from './diagnostics.handlers';

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
const LIMITE_POR_DEFECTO = 20;
const RADIO_DE_LA_TIERRA_KM = 6371;

/** Lo que la orden de CM-04/CM-08 agrega y esta maqueta todavía no tipa. */
interface OrdenConSugerencia {
  readonly suggestedPracticeSiteId?: string | null;
}

function badRequest(message: string): MockReply {
  return reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message, error: 'Bad Request' });
}

/** Una lista de ids separados por coma, sin vacíos ni repetidos. */
function idsDe(request: MockRequest, nombre: string): readonly string[] {
  const crudo = request.query.get(nombre) ?? '';
  return [...new Set(crudo.split(',').map((id) => id.trim()).filter((id) => id !== ''))];
}

function origenDe(request: MockRequest): { lat: number; lng: number } | null | MockReply {
  const lat = request.query.get('lat');
  const lng = request.query.get('lng');
  if (lat === null && lng === null) {
    return null;
  }
  if (lat === null || lng === null) {
    return badRequest('lat y lng viajan juntos.');
  }
  const origen = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(origen.lat) && Number.isFinite(origen.lng)
    ? origen
    : badRequest('lat y lng deben ser números.');
}

/** Distancia en línea recta, un decimal: la misma resolución que se muestra. */
function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (grados: number): number => (grados * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * RADIO_DE_LA_TIERRA_KM * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** `null` si la sede no ofrece ninguno de los procedimientos pedidos. */
function evaluar(
  sede: SedeDeCentroMedico,
  pedidos: readonly string[],
  origen: { lat: number; lng: number } | null,
): MedicalCenterItem | null {
  const offers: MedicalCenterOffer[] = pedidos.flatMap((id) =>
    sede.offers.filter((oferta) => oferta.procedureConceptId === id),
  );
  if (offers.length === 0) {
    return null;
  }
  const faltantes = pedidos.filter((id) => !offers.some((oferta) => oferta.procedureConceptId === id));
  const complete = faltantes.length === 0;
  return {
    practiceId: sede.practiceId,
    practiceSiteId: sede.practiceSiteId,
    name: sede.name,
    addressText: sede.addressText,
    latitude: sede.latitude,
    longitude: sede.longitude,
    distanceKm: origen === null ? null : distanciaKm(origen, { lat: sede.latitude, lng: sede.longitude }),
    complete,
    missingProcedureConceptIds: faltantes,
    offers,
    // Un total parcial no se puede comparar con uno completo: no se inventa.
    totalPrice: complete ? offers.reduce((suma, oferta) => suma + oferta.price, 0) : null,
  };
}

/** Nulos al final, y entre números el menor primero. */
function menorPrimero(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

/** El orden de la API. No mira ninguna señal del médico. */
function ordenDeLaApi(a: MedicalCenterItem, b: MedicalCenterItem): number {
  if (a.complete !== b.complete) return a.complete ? -1 : 1;
  return (
    menorPrimero(a.distanceKm, b.distanceKm) ||
    menorPrimero(a.totalPrice, b.totalPrice) ||
    a.name.localeCompare(b.name, 'es')
  );
}

function pagina(request: MockRequest, items: readonly MedicalCenterItem[]): MedicalCenterPage {
  const offset = Math.max(0, Number(request.query.get('offset') ?? 0) || 0);
  const limit = Math.min(100, Math.max(1, Number(request.query.get('limit') ?? LIMITE_POR_DEFECTO) || LIMITE_POR_DEFECTO));
  // Se corta **después** de ordenar.
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset };
}

function buscar(
  request: MockRequest,
  pedidos: readonly string[],
  marcas: ((item: MedicalCenterItem, sede: SedeDeCentroMedico) => MedicalCenterItem) | null,
): MockReply | MedicalCenterPage {
  const origen = origenDe(request);
  if (origen !== null && 'status' in origen) {
    return origen;
  }
  const conParciales = request.query.get('includePartial') === 'true';
  const items = SEDES_DE_CENTROS_MEDICOS.flatMap((sede) => {
    const item = evaluar(sede, pedidos, origen);
    if (item === null || (!item.complete && !conParciales)) {
      return [];
    }
    return [marcas === null ? item : marcas(item, sede)];
  }).sort(ordenDeLaApi);
  return pagina(request, items);
}

export function registerMedicalCenters(router: MockRouter): void {
  router.get('/medical-centers/search', (request) => {
    const ids = idsDe(request, 'procedureConceptIds');
    if (ids.length < 1 || ids.length > MAX_IDS) {
      return badRequest(`procedureConceptIds necesita de 1 a ${MAX_IDS} ids sin repetir.`);
    }
    return buscar(request, ids, null);
  });

  router.get('/medical-centers/search/for-my-orders', (request) => {
    if (request.user === null) {
      return unauthorized();
    }
    const ids = idsDe(request, 'serviceRequestIds');
    if (ids.length < 1 || ids.length > MAX_IDS) {
      return badRequest(`serviceRequestIds necesita de 1 a ${MAX_IDS} ids sin repetir.`);
    }
    const titular = pacienteDeSesion(request);
    const propias = ids.map((id) => ordenes.get(id));
    // Una orden ajena responde igual que una que no existe.
    if (propias.some((orden) => orden === undefined || orden.patientProfileId !== titular)) {
      return notFound('Orden no encontrada');
    }
    const ordenesPropias = propias.flatMap((orden) => (orden === undefined ? [] : [orden]));
    const pedidos = [...new Set(ordenesPropias.map((orden) => orden.codeConceptId))];
    const medicos = new Set(ordenesPropias.map((orden) => orden.requesterProfileId));
    const sugeridas = new Set(
      ordenesPropias.flatMap((orden) => {
        const sede = (orden as typeof orden & OrdenConSugerencia).suggestedPracticeSiteId;
        return sede === undefined || sede === null ? [] : [sede];
      }),
    );
    return buscar(request, pedidos, (item, sede) => ({
      ...item,
      practitionerWorksHere: sede.practitionerProfileIds.some((id) => medicos.has(id)),
      suggestedByPractitioner: sugeridas.has(sede.practiceSiteId),
    }));
  });
}
