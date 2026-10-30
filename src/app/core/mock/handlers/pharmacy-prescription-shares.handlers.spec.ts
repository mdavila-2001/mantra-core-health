import { HttpHeaders } from '@angular/common/http';

import { prescriptionList } from '../fixtures/clinic';
import { PRESCRIPTION_STATUS } from '../fixtures/concepts';
import { PACIENTE } from '../fixtures/people';
import { isMockReply, MockRouter, type MockHandler, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, TENANT_FARMACIA, type MockUser } from '../mock-session';
import { sha256Hex } from '../sha256';
import { crearRouterSimulado } from './index';
import { productos } from './pharmacy.handlers';
import { registerPharmacyPrescriptionShares, sitePositionList } from './pharmacy-prescription-shares.handlers';
import { activeItemsOf, issueShareToken, shareList, type SimulatedShare } from './prescription-shares.handlers';

/**
 * «Abrir receta» de la farmacia en el simulador (FAR-02): la forma del DTO de
 * la API, solo `PHARMACY_STAFF`, 404 / 410 como el caso de uso, el paciente
 * enmascarado, el cruce con el catálogo de la farmacia por sus propias rutas,
 * y el `PUT` de disponibilidad por sede del §4.
 */
describe('receta compartida abierta por la farmacia en el mock', () => {
  const router = crearRouterSimulado();
  const pharmacist = buscarUsuario('farmacia@alovida.mock')!;
  const patient = buscarUsuario('paciente@alovida.mock')!;
  const doctor = buscarUsuario('medica@alovida.mock')!;
  const superadmin = buscarUsuario('superadmin@alovida.mock')!;

  const DAY_MS = 24 * 60 * 60 * 1000;

  function send(
    method: MockMethod,
    path: string,
    { body = null, user = pharmacist, tenant }: { body?: unknown; user?: MockUser | null; tenant?: string } = {},
  ): MockReply {
    const url = new URL(path, 'http://localhost');
    const route = router.match(method, url.pathname);
    if (!route) throw new Error(`Falta ruta ${method} ${path}`);
    const output = route.handler({
      method,
      path: url.pathname,
      params: route.params,
      query: url.searchParams,
      body,
      headers: tenant === undefined ? new HttpHeaders() : new HttpHeaders({ 'X-Tenant-Id': tenant }),
      user,
    });
    return isMockReply(output) ? output : { status: 200, body: output };
  }

  /** Un ítem emitido y vigente del paciente cuyo fármaco tiene la farmacia. */
  const item = prescriptionList
    .filtrar((row) => row.patientProfileId === PACIENTE.id && row.statusConceptId === PRESCRIPTION_STATUS['MR_ISSUED'])
    .find((row) => {
      const products = send('GET', `/pharmacy/products?pharmacyId=${TENANT_FARMACIA}&conceptId=${row.medicationConceptId}`);
      return (products.body as { items: unknown[] }).items.length > 0 && activeItemsOfItem(row.id).length > 0;
    })!;

  function activeItemsOfItem(id: string) {
    return activeItemsOf({ resourceType: 'MEDICATION_REQUEST', resourceId: id } as SimulatedShare);
  }

  function seedShare(changes: Partial<SimulatedShare> = {}): { token: string; share: SimulatedShare } {
    const token = issueShareToken();
    const share = shareList.agregar({
      id: `share-far02-${shareList.todos().length + 1}`,
      tokenHash: sha256Hex(token),
      resourceType: 'MEDICATION_REQUEST',
      resourceId: item.id,
      patientProfileId: item.patientProfileId,
      createdByUserId: patient.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * DAY_MS).toISOString(),
      revokedAt: null,
      uses: 0,
      ...changes,
    });
    return { token, share };
  }

  interface SiteView {
    readonly siteId: string;
    readonly siteName: string;
    readonly available: boolean;
    readonly quantity: number | null;
    readonly stockUpdatedAt: string | null;
  }
  interface MatchView {
    readonly pharmacyId: string;
    readonly pharmacyProductId: string;
    readonly outOfStockDeclared: boolean;
    readonly sites: readonly SiteView[];
  }
  interface ShareView {
    readonly patient: { readonly maskedName: string | null; readonly documentLast3: string | null };
    readonly items: readonly { readonly matches: readonly MatchView[] }[];
  }

  function open(token: string): ShareView {
    const response = send('GET', `/pharmacy/prescription-shares/${token}`);
    expect(response.status).toBe(200);
    return response.body as ShareView;
  }

  beforeEach(() => {
    for (const position of sitePositionList.todos()) sitePositionList.borrar(position.id);
  });

  it('la semilla tiene un ítem vigente del paciente con producto en Farmacia Vida', () => {
    expect(item).toBeDefined();
  });

  it('200: la forma exacta del DTO, no-store, el cruce con las sedes de la farmacia y un uso más', () => {
    const { token, share } = seedShare();

    const response = send('GET', `/pharmacy/prescription-shares/${token}`);

    expect(response.status).toBe(200);
    expect(response.headers).toEqual({ 'Cache-Control': 'no-store' });
    const body = response.body as Record<string, unknown> & ShareView;
    expect(Object.keys(body).sort()).toEqual(['issuedAt', 'items', 'patient', 'prescriber', 'shareId', 'validTo']);
    expect(body['shareId']).toBe(share.id);
    expect(Object.keys(body['prescriber'] as object).sort()).toEqual(['license', 'name']);
    expect(body.items).toHaveLength(1);
    const view = body.items[0] as Record<string, unknown> & { matches: readonly MatchView[] };
    expect(Object.keys(view).sort()).toEqual([
      'dispensedQuantity',
      'display',
      'dosageText',
      'matches',
      'medicationConceptId',
      'medicationRequestId',
      'prescribedQuantity',
      'remainingQuantity',
      'unitCode',
    ]);
    expect(view['medicationRequestId']).toBe(item.id);
    // Sin cantidad en la receta simulada: sin control de cantidad (D-5).
    expect(view['remainingQuantity']).toBeNull();
    const match = view.matches[0]!;
    expect(Object.keys(match).sort()).toEqual([
      'currencyCode',
      'name',
      'outOfStockDeclared',
      'pharmacyId',
      'pharmacyProductId',
      'price',
      'requiresPrescription',
      'sites',
    ]);
    expect(view.matches.every((row) => row.pharmacyId === TENANT_FARMACIA)).toBe(true);
    // Farmacia Vida tiene tres sedes en la maqueta, por nombre.
    const names = match.sites.map((site) => site.siteName);
    expect(names).toHaveLength(3);
    expect([...names].sort((a, b) => a.localeCompare(b, 'es'))).toEqual(names);
    expect(Object.keys(match.sites[0]!).sort()).toEqual(['available', 'quantity', 'siteId', 'siteName', 'stockUpdatedAt']);
    expect(shareList.get(share.id)?.uses).toBe(1);
  });

  it('404: token desconocido', () => {
    const response = send('GET', `/pharmacy/prescription-shares/${issueShareToken()}`);

    expect(response.status).toBe(404);
    expect((response.body as { code: string }).code).toBe('NOT_FOUND');
  });

  it('404 con su motivo si el tenant no es una farmacia, sin contar un uso', () => {
    const { token, share } = seedShare();

    const response = send('GET', `/pharmacy/prescription-shares/${token}`, { user: superadmin });

    expect(response.status).toBe(404);
    expect((response.body as { reason: string }).reason).toBe('PHARMACY_INVENTORY_RESOURCE_NOT_AVAILABLE');
    expect(shareList.get(share.id)?.uses).toBe(0);
  });

  it('410: vencido → PRESCRIPTION_SHARE_EXPIRED; revocado → PRESCRIPTION_SHARE_REVOKED; sin uso', () => {
    const expired = seedShare({ expiresAt: new Date(Date.now() - DAY_MS).toISOString() });
    const revoked = seedShare({ revokedAt: new Date().toISOString() });

    const first = send('GET', `/pharmacy/prescription-shares/${expired.token}`);
    const second = send('GET', `/pharmacy/prescription-shares/${revoked.token}`);

    expect(first.status).toBe(410);
    expect(first.body).toMatchObject({
      code: 'PRECONDITION_FAILED',
      reason: 'PRESCRIPTION_SHARE_EXPIRED',
      details: { reason: 'PRESCRIPTION_SHARE_EXPIRED' },
    });
    expect(second.status).toBe(410);
    expect(second.body).toMatchObject({ reason: 'PRESCRIPTION_SHARE_REVOKED' });
    expect(shareList.get(expired.share.id)?.uses).toBe(0);
    expect(shareList.get(revoked.share.id)?.uses).toBe(0);
  });

  it('403 a un rol ajeno (paciente, médica) y 401 sin sesión', () => {
    const { token } = seedShare();

    expect(send('GET', `/pharmacy/prescription-shares/${token}`, { user: patient }).status).toBe(403);
    expect(send('GET', `/pharmacy/prescription-shares/${token}`, { user: doctor }).status).toBe(403);
    expect(send('GET', `/pharmacy/prescription-shares/${token}`, { user: null }).status).toBe(401);
  });

  it('no sale ningún dato del paciente en claro: solo iniciales y los últimos 3 dígitos', () => {
    const { token } = seedShare();

    const view = open(token);
    const json = JSON.stringify(view);

    const parts = [PACIENTE.name, PACIENTE.middleName, PACIENTE.lastName, PACIENTE.motherLastName].filter(
      (part): part is string => part !== undefined && part !== '',
    );
    expect(view.patient.maskedName).toBe(parts.map((part) => `${part[0]!.toLocaleUpperCase('es')}.`).join(' '));
    expect(view.patient.documentLast3).toBe(PACIENTE.nationalId.replace(/\D/g, '').slice(-3));
    for (const secret of [PACIENTE.displayName, ...parts, PACIENTE.nationalId, PACIENTE.id, PACIENTE.email]) {
      expect(json).not.toContain(secret);
    }
  });

  it('PUT: «No lo tengo» deja la sede en 0, completa las posiciones de la sede y la receta lo muestra', () => {
    const { token } = seedShare();
    const match = open(token).items[0]!.matches[0]!;
    const [site, otherSite] = match.sites;

    const response = send(
      'PUT',
      `/pharmacies/${TENANT_FARMACIA}/sites/${site!.siteId}/products/${match.pharmacyProductId}/availability`,
      { body: { available: false } },
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      siteId: site!.siteId,
      productId: match.pharmacyProductId,
      available: false,
      quantity: 0,
      stockUpdatedAt: null,
    });
    expect(sitePositionList.filtrar((row) => row.siteId === site!.siteId).length).toBeGreaterThan(1);
    const after = open(token).items[0]!.matches[0]!;
    expect(after.sites.find((row) => row.siteId === site!.siteId)).toMatchObject({ available: false, quantity: 0 });
    // La otra sede no se toca.
    expect(after.sites.find((row) => row.siteId === otherSite!.siteId)).toEqual(otherSite);

    const back = send(
      'PUT',
      `/pharmacies/${TENANT_FARMACIA}/sites/${site!.siteId}/products/${match.pharmacyProductId}/availability`,
      { body: { available: true } },
    );
    expect(back.status).toBe(200);
    expect(back.body).toMatchObject({ available: true });
    expect((back.body as { quantity: number }).quantity).toBeGreaterThanOrEqual(1);
    expect(open(token).items[0]!.matches[0]!.sites.find((row) => row.siteId === site!.siteId)).toMatchObject({
      available: true,
      stockUpdatedAt: (back.body as { stockUpdatedAt: string }).stockUpdatedAt,
    });
  });

  it('PUT: 403 fuera de la farmacia, 400 sin `available`, 404 sede ajena, 422 marcado sin stock', () => {
    const { token } = seedShare();
    const match = open(token).items[0]!.matches[0]!;
    const siteId = match.sites[0]!.siteId;
    const path = `/pharmacies/${TENANT_FARMACIA}/sites/${siteId}/products/${match.pharmacyProductId}/availability`;

    expect(send('PUT', path, { body: { available: true }, user: patient }).status).toBe(403);
    expect(send('PUT', path, { body: { available: 'sí' } }).status).toBe(400);
    expect(
      send('PUT', `/pharmacies/${TENANT_FARMACIA}/sites/no-existe/products/${match.pharmacyProductId}/availability`, {
        body: { available: true },
      }).status,
    ).toBe(404);

    const mark = (inStock: boolean) =>
      send('PATCH', `/pharmacies/${TENANT_FARMACIA}/inventory`, {
        body: { lines: [{ productId: match.pharmacyProductId, inStock }] },
      });
    expect(mark(false).status).toBe(200);
    try {
      const rejected = send('PUT', path, { body: { available: true } });
      expect(rejected.status).toBe(422);
      expect((rejected.body as { reason: string }).reason).toBe('PRODUCT_OUT_OF_STOCK_DECLARED');
      expect(open(token).items[0]!.matches[0]!.outOfStockDeclared).toBe(true);
    } finally {
      expect(mark(true).status).toBe(200);
    }
  });

  it('PUT: «No lo tengo» acepta cantidad 0; «Lo tengo» con 0 es 400 (como `SetSiteAvailabilityDto`)', () => {
    const { token } = seedShare();
    const match = open(token).items[0]!.matches[0]!;
    const path = `/pharmacies/${TENANT_FARMACIA}/sites/${match.sites[0]!.siteId}/products/${match.pharmacyProductId}/availability`;

    const off = send('PUT', path, { body: { available: false, quantity: 0 } });
    expect(off.status).toBe(200);
    expect(off.body).toMatchObject({ available: false, quantity: 0 });

    const zero = send('PUT', path, { body: { available: true, quantity: 0 } });
    expect(zero.status).toBe(400);
    expect((zero.body as { reason: string }).reason).toBe('SITE_AVAILABILITY_QUANTITY_INVALID');
    expect(send('PUT', path, { body: { available: true, quantity: -1 } }).status).toBe(400);
    expect(send('PUT', path, { body: { available: true, quantity: 2 } }).status).toBe(200);
  });

  it('la marca «sin stock» se respeta aunque las existencias estén en 0: «Lo tengo» da 422, «No lo tengo» pasa', () => {
    const { token } = seedShare();
    const match = open(token).items[0]!.matches[0]!;
    const productId = match.pharmacyProductId;
    const path = `/pharmacies/${TENANT_FARMACIA}/sites/${match.sites[0]!.siteId}/products/${productId}/availability`;
    const inventory = (line: Record<string, unknown>) =>
      send('PATCH', `/pharmacies/${TENANT_FARMACIA}/inventory`, { body: { lines: [{ productId, ...line }] } });
    const original = productos.get(productId)!.stock;

    // Primero las existencias en 0 y después la marca: la marca no toca el conteo.
    expect(inventory({ stock: 0 }).status).toBe(200);
    expect(inventory({ inStock: false }).status).toBe(200);
    try {
      expect(productos.get(productId)).toMatchObject({ stock: 0, sinStock: true });
      expect(open(token).items[0]!.matches[0]!.outOfStockDeclared).toBe(true);
      const rejected = send('PUT', path, { body: { available: true } });
      expect(rejected.status).toBe(422);
      expect((rejected.body as { reason: string }).reason).toBe('PRODUCT_OUT_OF_STOCK_DECLARED');
      expect(send('PUT', path, { body: { available: false } }).status).toBe(200);
    } finally {
      expect(inventory({ inStock: true }).status).toBe(200);
      if (original !== null) expect(inventory({ stock: original }).status).toBe(200);
    }
    expect(open(token).items[0]!.matches[0]!.outOfStockDeclared).toBe(false);
  });

  it('crearRouterSimulado() resuelve las dos rutas a estos manejadores, con un único dueño', () => {
    const registered = new Map<string, MockHandler[]>();
    const original = MockRouter.prototype.on;
    const spy = vi.spyOn(MockRouter.prototype, 'on').mockImplementation(function (
      this: MockRouter,
      method: MockMethod,
      pattern: string,
      handler: MockHandler,
    ) {
      const key = `${method} ${pattern}`;
      registered.set(key, [...(registered.get(key) ?? []), handler]);
      return original.call(this, method, pattern, handler);
    });
    const own = new MockRouter();
    registerPharmacyPrescriptionShares(own);
    const ownKeys = [...registered.keys()];
    registered.clear();
    const full = crearRouterSimulado();
    spy.mockRestore();

    expect(ownKeys).toEqual([
      'GET /pharmacy/prescription-shares/:token',
      'PUT /pharmacies/:pharmacyId/sites/:siteId/products/:productId/availability',
    ]);
    const cases: readonly [MockMethod, string, string][] = [
      ['GET', '/pharmacy/prescription-shares/abc', ownKeys[0]!],
      ['PUT', '/pharmacies/p/sites/s/products/x/availability', ownKeys[1]!],
    ];
    for (const [method, path, key] of cases) {
      expect(registered.get(key)).toHaveLength(1);
      expect(full.match(method, path)?.handler).toBe(registered.get(key)![0]);
    }
  });
});
