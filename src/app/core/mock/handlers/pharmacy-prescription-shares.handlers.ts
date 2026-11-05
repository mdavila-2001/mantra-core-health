import { HttpHeaders } from '@angular/common/http';

import type { SimulatedPrescription } from '../fixtures/clinic';
import { displayOf } from '../fixtures/concepts';
import { patientById, professionalById } from '../fixtures/people';
import {
  forbidden,
  isMockReply,
  notFound,
  preconditionFailed,
  reply,
  unauthorized,
  validation,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { TENANT_TYPES, type MockUser } from '../mock-session';
import { ahora, Coleccion, cuerpo } from '../mock-store';
import { productos } from './pharmacy.handlers';
import { activeItemsOf, shareByToken, shareList, shareStatusOf, type SimulatedShare } from './prescription-shares.handlers';

/* ============================================================================
    FAR-02 · la farmacia abre la receta que el paciente le compartió
    (`CONTRATO.md` §2) y marca «Lo tengo / No lo tengo» por sede (§4), con las
    formas de `pharmacy-prescription-share.dto.ts` de la API y el
    comportamiento de `open-prescription-share.use-case.ts`.

    El catálogo y las sedes de la farmacia son de `pharmacy.handlers.ts`, que
    no exporta su almacén: se leen por sus propias rutas
    (`GET /pharmacy/pharmacies/:id` y `GET /pharmacy/products?managed=true`)
    sobre el mismo router. Así la receta ve lo que la farmacia cargó o editó
    en la maqueta, sin una segunda copia del catálogo.
    ========================================================================== */

/** Un producto del catálogo de la farmacia, tal como lo da su ruta de gestión. */
interface CatalogProduct {
  readonly id: string;
  readonly pharmacyId: string;
  readonly productCode: string;
  readonly brandName: string | null;
  readonly genericName: string | null;
  readonly strengthText: string | null;
  readonly medication: { readonly code: string } | null;
  readonly requiresPrescription: boolean | null;
  readonly unitPrice: string | null;
  readonly currency: string | null;
  readonly inStock: boolean;
  readonly stock: number | null;
  readonly status: string;
}

interface CatalogSite {
  readonly id: string;
  readonly name: string;
}

/**
 * Una posición de stock de un producto en una sede: lo que escribe el `PUT`
 * del §4. Una sede con alguna posición pasa entera a stock por posición.
 */
interface SitePosition {
  /** `siteId:productId`, como `stockKey` en la API. */
  readonly id: string;
  readonly pharmacyId: string;
  readonly siteId: string;
  readonly productId: string;
  readonly quantity: number;
  readonly updatedAt: string;
}

export const sitePositionList = new Coleccion<SitePosition>([]).persistirEn('mock.farmacia.posiciones-por-sede');

const NO_PHARMACY_REASON = 'PHARMACY_INVENTORY_RESOURCE_NOT_AVAILABLE';
const OUT_OF_STOCK_DECLARED_REASON = 'PRODUCT_OUT_OF_STOCK_DECLARED';
const QUANTITY_INVALID_REASON = 'SITE_AVAILABILITY_QUANTITY_INVALID';
/** Tope de existencias, el mismo que acepta el inventario de la farmacia. */
const MAX_QUANTITY = 1_000_000;
/** Cuántas filas se piden a las rutas de catálogo y sedes: todas. */
const ALL_ROWS = '10000';

function positionKey(siteId: string, productId: string): string {
  return `${siteId}:${productId}`;
}

/* ---- quién pide -------------------------------------------------------- */

/**
 * `PHARMACY_STAFF` como lo deriva el login de la API
 * (`iam-auth.service.ts`, `withPharmacyStaffRole`): una membresía en un tenant
 * de tipo `PHARMACY`. `SUPERADMIN` es el comodín del guard de roles.
 */
function isPharmacyStaff(user: MockUser): boolean {
  return (
    user.roles.includes('PHARMACY_STAFF') ||
    user.roles.includes('SUPERADMIN') ||
    user.tenants.some((tenantId) => TENANT_TYPES[tenantId] === 'PHARMACY')
  );
}

/** El tenant del pedido (`requireTenantId()`): el del contexto o el primero de la cuenta. */
function tenantOf(request: MockRequest): string | null {
  const user = request.user;
  const header = request.headers.get('X-Tenant-Id');
  if (header !== null) return user?.tenants.includes(header) === true ? header : null;
  return user?.tenants[0] ?? null;
}

/* ---- lecturas por las rutas de la farmacia ------------------------------ */

/** Llama a otra ruta del simulador con la misma sesión; `null` si no responde 200. */
function readRoute(router: MockRouter, path: string, query: Record<string, string>, user: MockUser | null): unknown {
  const route = router.match('GET', path);
  if (route === null) return null;
  const output: unknown = route.handler({
    method: 'GET',
    path,
    params: route.params,
    query: new URLSearchParams(query),
    body: null,
    headers: new HttpHeaders(),
    user,
  });
  if (output instanceof Promise) return null;
  if (isMockReply(output)) return output.status === 200 ? output.body : null;
  return output;
}

/** Las sedes de una farmacia, por nombre (el orden de la API). */
function sitesOf(router: MockRouter, pharmacyId: string, user: MockUser | null): CatalogSite[] {
  const body = readRoute(router, `/pharmacy/pharmacies/${encodeURIComponent(pharmacyId)}`, {}, user) as {
    sites?: readonly CatalogSite[];
  } | null;
  return [...(body?.sites ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Los productos activos de una farmacia, opcionalmente de un fármaco. Activo
 * es publicado: ni borrador ni retirado (`PRODUCT_ACTIVE` en la API).
 */
function productsOf(
  router: MockRouter,
  pharmacyId: string,
  user: MockUser | null,
  conceptId: string | null = null,
): CatalogProduct[] {
  const query: Record<string, string> = { pharmacyId, managed: 'true', limit: ALL_ROWS };
  if (conceptId !== null) query['conceptId'] = conceptId;
  const body = readRoute(router, '/pharmacy/products', query, user) as { items?: readonly CatalogProduct[] } | null;
  return (body?.items ?? []).filter((product) => product.status === 'PUBLISHED');
}

/**
 * La farmacia lo marcó «no tengo» para todas sus sedes (`out_of_stock_declared`
 * en la API). La ruta de gestión no expone la marca, y deducirla de las
 * existencias no alcanza: un producto en 0 puede estar marcado o no. Se lee
 * del almacén del simulador de farmacia.
 */
function isOutOfStockDeclared(product: CatalogProduct): boolean {
  return productos.get(product.id)?.sinStock === true;
}

/** Lo que pone una posición nueva: el stock declarado, 1 sin conteo, 0 si no hay. */
function declaredQuantity(product: CatalogProduct): number {
  if (!product.inStock) return 0;
  return product.stock !== null && product.stock > 0 ? product.stock : 1;
}

/* ---- la receta, como la ve la farmacia (§2) ----------------------------- */

const NAME_PARTICLES: ReadonlySet<string> = new Set([
  'de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'das', 'do', 'dos', 'di', 'van', 'von',
]);

/** Iniciales de una parte del nombre, como `domain/masked-patient.ts` de la API. */
function initialsOf(part: string | null | undefined): string[] {
  if (!part) return [];
  return part
    .split(/[\s\-‐-―]+/u)
    .filter((word) => word !== '' && !NAME_PARTICLES.has(word))
    .map((word) => /\p{L}/u.exec(word)?.[0])
    .filter((letter): letter is string => letter !== undefined)
    .map((letter) => `${letter.toLocaleUpperCase('es')}.`);
}

/** Del paciente, solo iniciales y los últimos 3 dígitos del documento (S-4). */
function maskedPatientOf(patientProfileId: string): { maskedName: string | null; documentLast3: string | null } {
  const patient = patientById(patientProfileId);
  if (patient === undefined) return { maskedName: null, documentLast3: null };
  const fromParts = [patient.name, patient.middleName, patient.lastName, patient.motherLastName].flatMap(initialsOf);
  const initials = fromParts.length > 0 ? fromParts : initialsOf(patient.displayName);
  const digits = /\d+(?:[.\s-]\d{3}(?!\d))*/.exec(patient.nationalId)?.[0].replace(/\D/g, '') ?? '';
  return {
    maskedName: initials.length > 0 ? initials.join(' ') : null,
    // Con 3 dígitos o menos, «los últimos 3» serían el documento entero.
    documentLast3: digits.length > 3 ? digits.slice(-3) : null,
  };
}

/** `validTo` de un día vale hasta el final de ese día, como lo lee FAR-01. */
function validToIso(validTo: string): string {
  return new Date(validTo.length === 10 ? `${validTo}T23:59:59.999Z` : validTo).toISOString();
}

function earliest(values: readonly (string | null)[]): string | null {
  const present = values.filter((value): value is string => value !== null).sort();
  return present[0] ?? null;
}

function dosageTextOf(item: SimulatedPrescription): string | null {
  const parts = [item.doseText, item.frequencyText].map((part) => part.trim()).filter((part) => part !== '');
  return parts.length > 0 ? parts.join(' · ') : null;
}

function productNameOf(product: CatalogProduct): string {
  const base = product.brandName?.trim() || product.genericName?.trim() || product.productCode;
  const strength = product.strengthText?.trim();
  return strength ? `${base} ${strength}` : base;
}

/**
 * Una sede con la disponibilidad del producto. Sin posiciones en la sede
 * manda el catálogo (stock declarado, `null` sin conteo); con posiciones,
 * la de este producto, y sin la suya no está disponible.
 */
function siteView(site: CatalogSite, product: CatalogProduct) {
  const sitePositions = sitePositionList.filtrar((position) => position.siteId === site.id);
  const declared = isOutOfStockDeclared(product);
  if (sitePositions.length === 0) {
    const available = product.inStock;
    return {
      siteId: site.id,
      siteName: site.name,
      available,
      quantity: available ? product.stock : 0,
      stockUpdatedAt: null,
    };
  }
  const position = sitePositions.find((row) => row.productId === product.id);
  const available = !declared && position !== undefined && position.quantity > 0;
  return {
    siteId: site.id,
    siteName: site.name,
    available,
    quantity: available ? position.quantity : 0,
    stockUpdatedAt: available ? position.updatedAt : null,
  };
}

function matchView(product: CatalogProduct, sites: readonly CatalogSite[]) {
  return {
    pharmacyId: product.pharmacyId,
    pharmacyProductId: product.id,
    name: productNameOf(product),
    price: product.unitPrice,
    currencyCode: product.unitPrice === null ? null : product.currency,
    requiresPrescription: product.requiresPrescription === true,
    outOfStockDeclared: isOutOfStockDeclared(product),
    sites: sites.map((site) => siteView(site, product)),
  };
}

/**
 * Un ítem vigente. Las recetas del simulador no guardan cantidad ni unidad:
 * todo ítem queda sin control de cantidad (D-5), con las tres cantidades en
 * `null`, que es lo que la API responde en ese caso.
 */
function itemView(item: SimulatedPrescription, matchesOf: (conceptId: string) => unknown[]) {
  return {
    medicationRequestId: item.id,
    medicationConceptId: item.medicationConceptId,
    display: displayOf(item.medicationConceptId) || null,
    dosageText: dosageTextOf(item),
    prescribedQuantity: null,
    unitCode: null,
    dispensedQuantity: null,
    remainingQuantity: null,
    matches: matchesOf(item.medicationConceptId),
  };
}

function prescriberOf(items: readonly SimulatedPrescription[]) {
  const prescriber = professionalById(items[0]?.prescriberProfileId ?? '');
  return {
    name: prescriber?.displayName ?? null,
    license:
      prescriber !== undefined && prescriber.matricula !== ''
        ? { number: prescriber.matricula, authority: null, state: prescriber.verified ? 'ACTIVE' : 'PENDING' }
        : null,
  };
}

/** 410 como `prescription-shares.service.ts` (`gone`): `PRECONDITION_FAILED` y el motivo. */
function gone(share: SimulatedShare): MockReply {
  const revoked = shareStatusOf(share) === 'REVOKED';
  const reason = revoked ? 'PRESCRIPTION_SHARE_REVOKED' : 'PRESCRIPTION_SHARE_EXPIRED';
  return reply(410, {
    statusCode: 410,
    code: 'PRECONDITION_FAILED',
    message: revoked ? 'El paciente dejó de compartir esta receta.' : 'Esta receta venció.',
    error: 'Gone',
    reason,
    details: { reason },
  });
}

function open(router: MockRouter, request: MockRequest): MockReply {
  const user = request.user;
  if (user === null) return unauthorized();
  if (!isPharmacyStaff(user)) return forbidden();

  // Antes de abrir: sin farmacia del tenant no queda un uso registrado.
  const tenantId = tenantOf(request);
  const pharmacyIds = tenantId !== null && TENANT_TYPES[tenantId] === 'PHARMACY' ? [tenantId] : [];
  if (pharmacyIds.length === 0) {
    const rejected = notFound('Esta organización no tiene una farmacia verificada.');
    return reply(404, { ...(rejected.body as object), reason: NO_PHARMACY_REASON, details: { reason: NO_PHARMACY_REASON } });
  }

  const share = shareByToken(request.params['token'] ?? '');
  if (share === undefined) return notFound();
  if (shareStatusOf(share) !== 'VALID') return gone(share);

  const items = activeItemsOf(share);
  const sitesByPharmacy = new Map(pharmacyIds.map((id) => [id, sitesOf(router, id, user)]));
  const matchesOf = (conceptId: string) =>
    pharmacyIds.flatMap((pharmacyId) =>
      productsOf(router, pharmacyId, user, conceptId).map((product) =>
        matchView(product, sitesByPharmacy.get(pharmacyId) ?? []),
      ),
    );
  const body = {
    shareId: share.id,
    issuedAt: earliest(items.map((item) => item.issuedAt)),
    validTo: earliest(items.map((item) => (item.validTo === null ? null : validToIso(item.validTo)))),
    prescriber: prescriberOf(items),
    patient: maskedPatientOf(share.patientProfileId),
    items: items.map((item) => itemView(item, matchesOf)),
  };

  // El `OPENED` se cuenta después de armar la respuesta, como la API.
  shareList.actualizar(share.id, { uses: share.uses + 1 });
  return { status: 200, body, headers: { 'Cache-Control': 'no-store' } };
}

/* ---- «Lo tengo / No lo tengo» por sede (§4) ------------------------------ */

function canWriteFor(user: MockUser, pharmacyId: string): boolean {
  if (user.roles.includes('SECURITY_ADMIN') || user.roles.includes('SUPERADMIN')) return true;
  return isPharmacyStaff(user) && user.tenants.includes(pharmacyId);
}

function setAvailability(router: MockRouter, request: MockRequest): MockReply {
  const user = request.user;
  if (user === null) return unauthorized();
  const pharmacyId = request.params['pharmacyId'] ?? '';
  const siteId = request.params['siteId'] ?? '';
  const productId = request.params['productId'] ?? '';
  if (!canWriteFor(user, pharmacyId)) return forbidden();

  const body = cuerpo<{ available: unknown; quantity: unknown }>(request);
  if (typeof body.available !== 'boolean') {
    return validation('available must be a boolean value', [{ field: 'available', message: 'must be a boolean value' }]);
  }
  const quantity = body.quantity;
  // Como `SetSiteAvailabilityDto`: de 0 a 1 000 000. El 0 sólo vale con «No lo
  // tengo»; con «Lo tengo» es el 400 del caso de uso.
  if (
    quantity !== undefined &&
    (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_QUANTITY)
  ) {
    return validation(`quantity must be an integer from 0 to ${MAX_QUANTITY}`, [
      { field: 'quantity', message: `must be an integer from 0 to ${MAX_QUANTITY}` },
    ]);
  }
  if (body.available && quantity === 0) {
    const rejected = validation('«Lo tengo» necesita una cantidad mayor que cero', [
      { field: 'quantity', message: 'must be greater than zero' },
    ]);
    return reply(400, { ...(rejected.body as object), reason: QUANTITY_INVALID_REASON });
  }

  const site = sitesOf(router, pharmacyId, user).find((row) => row.id === siteId);
  if (site === undefined) return notFound('Sede de farmacia no encontrada');
  const catalog = productsOf(router, pharmacyId, user);
  const product = catalog.find((row) => row.id === productId);
  if (product === undefined) return notFound('Producto no encontrado');
  if (body.available && isOutOfStockDeclared(product)) {
    // Una sede no apaga la marca de toda la farmacia (§4); «No lo tengo» sí vale.
    const rejected = preconditionFailed('El producto está marcado sin stock para toda la farmacia.', {
      reason: OUT_OF_STOCK_DECLARED_REASON,
    });
    return reply(422, { ...(rejected.body as object), reason: OUT_OF_STOCK_DECLARED_REASON });
  }

  const now = ahora();
  // La sede pasa entera a stock por posición: se completan las que falten
  // con el stock declarado, para que ningún producto quede «no disponible»
  // de rebote.
  for (const other of catalog) {
    const key = positionKey(siteId, other.id);
    if (other.id === productId || sitePositionList.get(key) !== undefined) continue;
    sitePositionList.agregar({
      id: key,
      pharmacyId,
      siteId,
      productId: other.id,
      quantity: declaredQuantity(other),
      updatedAt: now,
    });
  }

  const written = body.available ? (typeof quantity === 'number' ? quantity : declaredQuantity(product) || 1) : 0;
  const key = positionKey(siteId, productId);
  const position = { id: key, pharmacyId, siteId, productId, quantity: written, updatedAt: now };
  if (sitePositionList.get(key) === undefined) {
    sitePositionList.agregar(position);
  } else {
    sitePositionList.actualizar(key, position);
  }

  return {
    status: 200,
    body: {
      siteId,
      productId,
      available: written > 0,
      quantity: written,
      stockUpdatedAt: written > 0 ? now : null,
    },
  };
}

export function registerPharmacyPrescriptionShares(router: MockRouter): void {
  router.get('/pharmacy/prescription-shares/:token', (request) => open(router, request));
  router.put('/pharmacies/:pharmacyId/sites/:siteId/products/:productId/availability', (request) =>
    setAvailability(router, request),
  );
}
