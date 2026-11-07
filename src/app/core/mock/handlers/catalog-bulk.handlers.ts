import { HttpHeaders } from '@angular/common/http';

import { forbidden, notFound, validation, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { cuerpo } from '../mock-store';
import type { BulkMode, BulkOutcome, BulkRowResult } from '../../data-access/pharmacy/pharmacy-bulk.types';

/* ============================================================================
    SIMULATED backend of the pharmacy catalog bulk load
    (`POST /pharmacies/:pharmacyId/{categories,products,prices,sites}/bulk`).

    The real endpoints upsert against Postgres. This one reproduces the wire
    contract ({mode, dryRun, rows} → {dryRun, results}) and PERSISTS by
    delegating to the simulator's own single-record handlers (categories,
    products), so a reload of those lists shows the loaded rows. `sites` are
    only kept in memory of this handler (no read endpoint in the simulator).
    Everything here is simulated: it is not a measurement of the real API.
    ========================================================================== */

const MAX_ROWS = 1000;
const WRITERS = new Set(['SECURITY_ADMIN', 'PHARMACY_STAFF', 'SUPERADMIN']);
type Kind = 'categories' | 'products' | 'prices' | 'sites';
type Row = Record<string, unknown>;
interface Existing { readonly id: string; readonly row: Row }
interface Call { readonly status: number; readonly body: Record<string, unknown> }

const sitesByPharmacy = new Map<string, Map<string, Row>>();

/** Lowercase, no accents, trimmed: the same `name_key` the API enforces. */
const nameKey = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() : null;

const rejected = (row: number, field: string, reason: string, message: string): BulkRowResult => ({
  row, outcome: 'REJECTED', errors: [{ field, reason, message }],
});

function call(router: MockRouter, req: MockRequest, method: 'GET' | 'POST' | 'PATCH', path: string, body: unknown = null): Call {
  const match = router.match(method, path);
  if (match === null) return { status: 404, body: {} };
  const [pathOnly, qs = ''] = path.split('?');
  const out = match.handler({ ...req, method, path: pathOnly!, params: match.params, query: new URLSearchParams(qs), body, headers: new HttpHeaders() }) as MockReply | Record<string, unknown>;
  const isReply = typeof out === 'object' && out !== null && 'status' in out && 'body' in out;
  return isReply ? { status: (out as MockReply).status, body: (out as MockReply).body as Record<string, unknown> } : { status: 200, body: out as Record<string, unknown> };
}

const failure = (row: number, res: Call): BulkRowResult =>
  rejected(row, 'row', String(res.body['code'] ?? 'ROW_FAILED'), String(res.body['message'] ?? 'La fila no se pudo cargar.'));

/** Current records of the pharmacy for one kind, indexed by the row key. */
function existing(router: MockRouter, req: MockRequest, kind: Kind, pharmacyId: string): Map<string, Existing> {
  const found = new Map<string, Existing>();
  if (kind === 'categories') {
    const items = call(router, req, 'GET', `/pharmacies/${pharmacyId}/categories`).body['items'] as Row[];
    for (const c of items) found.set(nameKey(c['name'])!, { id: String(c['id']), row: c });
  } else if (kind === 'sites') {
    for (const [code, row] of sitesByPharmacy.get(pharmacyId) ?? []) found.set(code, { id: `site-${code}`, row });
  } else {
    const items = call(router, req, 'GET', `/pharmacy/products?pharmacyId=${pharmacyId}&managed=true&limit=1000`).body['items'] as Row[];
    for (const p of items) found.set(String(p['productCode']), { id: String(p['id']), row: p });
  }
  return found;
}

function keyOf(kind: Kind, row: Row): string | null {
  if (kind === 'categories') return nameKey(row['name']);
  const field = kind === 'sites' ? 'code' : 'productCode';
  return typeof row[field] === 'string' && (row[field] as string).trim() !== '' ? (row[field] as string).trim() : null;
}

/** Equal as stored: amounts travel as strings in the read model, so compare numbers numerically. */
const sameValue = (a: unknown, b: unknown): boolean =>
  typeof b === 'number' && a !== null && a !== '' ? Number(a) === b : a === b;

function validPrice(v: unknown): boolean {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && Math.round(n * 100) / 100 === n;
}

/** Decides and (without dryRun) applies one row; `known` is the pharmacy's current records. */
function apply(router: MockRouter, req: MockRequest, kind: Kind, pharmacyId: string, mode: BulkMode, dryRun: boolean, n: number, row: Row, known: Map<string, Existing>): BulkRowResult {
  const key = keyOf(kind, row)!;
  const found = known.get(key);
  if (found === undefined && mode === 'UPDATE') return rejected(n, 'row', 'NOT_FOUND', 'La clave no existe y el modo es solo actualizar.');
  if (found !== undefined && mode === 'CREATE') return rejected(n, 'row', 'ALREADY_EXISTS', 'La clave ya existe y el modo es solo crear.');
  if (kind === 'prices') {
    if (found === undefined) return rejected(n, 'productCode', 'NOT_FOUND', 'No hay un producto con ese código.');
    if (!validPrice(row['unitPrice'])) return rejected(n, 'unitPrice', 'INVALID', 'El precio debe ser positivo con hasta dos decimales.');
    const price = Number(row['unitPrice']);
    if (Number(found.row['unitPrice']) === price) return { row: n, outcome: 'UNCHANGED', id: found.id };
    if (!dryRun) {
      const res = call(router, req, 'PATCH', `/pharmacies/${pharmacyId}/products/${found.id}`, { unitPrice: price });
      if (res.status >= 400) return failure(n, res);
      known.set(key, { id: found.id, row: { ...found.row, unitPrice: price } });
    }
    return { row: n, outcome: 'UPDATED', id: found.id };
  }
  if (kind === 'sites') {
    if (typeof row['name'] !== 'string' || row['name'].trim() === '') return rejected(n, 'name', 'REQUIRED', 'El nombre es obligatorio.');
    const same = found !== undefined && found.row['name'] === row['name'];
    if (same) return { row: n, outcome: 'UNCHANGED', id: found.id };
    if (!dryRun) {
      const map = sitesByPharmacy.get(pharmacyId) ?? new Map<string, Row>();
      map.set(key, row);
      sitesByPharmacy.set(pharmacyId, map);
      known.set(key, { id: `site-${key}`, row });
    }
    return { row: n, outcome: found === undefined ? 'CREATED' : 'UPDATED', id: `site-${key}` };
  }
  if (kind === 'categories') {
    const name = String(row['name']).trim();
    if (found === undefined) {
      if (dryRun) return { row: n, outcome: 'CREATED' };
      const res = call(router, req, 'POST', `/pharmacies/${pharmacyId}/categories`, { name });
      if (res.status >= 400) return failure(n, res);
      known.set(key, { id: String(res.body['id']), row: { name } });
      return { row: n, outcome: 'CREATED', id: String(res.body['id']) };
    }
    if (found.row['name'] === name) return { row: n, outcome: 'UNCHANGED', id: found.id };
    if (!dryRun) {
      const res = call(router, req, 'PATCH', `/pharmacies/${pharmacyId}/categories/${found.id}`, { name });
      if (res.status >= 400) return failure(n, res);
      known.set(key, { id: found.id, row: { name } });
    }
    return { row: n, outcome: 'UPDATED', id: found.id };
  }
  // products
  if (found === undefined) {
    if (dryRun) return { row: n, outcome: 'CREATED' };
    const res = call(router, req, 'POST', `/pharmacies/${pharmacyId}/products`, row);
    if (res.status >= 400) return failure(n, res);
    known.set(key, { id: String(res.body['id']), row });
    return { row: n, outcome: 'CREATED', id: String(res.body['id']) };
  }
  const { productCode: _code, ...changes } = row;
  const differs = Object.entries(changes).some(([k, v]) => !sameValue(found.row[k], v));
  if (!differs) return { row: n, outcome: 'UNCHANGED', id: found.id };
  if (!dryRun) {
    const res = call(router, req, 'PATCH', `/pharmacies/${pharmacyId}/products/${found.id}`, changes);
    if (res.status >= 400) return failure(n, res);
    known.set(key, { id: found.id, row: { ...found.row, ...changes } });
  }
  return { row: n, outcome: 'UPDATED', id: found.id };
}

export function registrarCargaMasivaDeCatalogo(router: MockRouter): void {
  for (const kind of ['categories', 'products', 'prices', 'sites'] as const) {
    router.post(`/pharmacies/:pharmacyId/${kind}/bulk`, (req) => {
      const roles = req.user?.roles ?? [];
      if (!roles.some((r) => WRITERS.has(r))) return forbidden();
      const pharmacyId = req.params['pharmacyId']!;
      if (call(router, req, 'GET', `/pharmacies/${pharmacyId}/categories`).status === 404) return notFound('Farmacia no encontrada');
      const body = cuerpo<{ mode: BulkMode; dryRun?: boolean; rows: Row[] }>(req);
      const mode = body.mode;
      if (mode === undefined || !['CREATE', 'UPDATE', 'UPSERT'].includes(mode)) return validation('mode must be one of CREATE, UPDATE, UPSERT');
      if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') return validation('dryRun must be a boolean value');
      if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > MAX_ROWS) {
        return validation(`rows must contain between 1 and ${MAX_ROWS} items`);
      }
      const dryRun = body.dryRun === true;
      const known = existing(router, req, kind, pharmacyId);
      const seen = new Set<string>();
      const results: BulkRowResult[] = body.rows.map((row, i) => {
        const n = i + 1;
        const key = keyOf(kind, row);
        if (key === null) return rejected(n, kind === 'categories' ? 'name' : kind === 'sites' ? 'code' : 'productCode', 'REQUIRED', 'La clave de la fila es obligatoria.');
        if (seen.has(key)) return rejected(n, 'row', 'DUPLICATE_IN_FILE', 'La clave está repetida dentro del archivo.');
        seen.add(key);
        return apply(router, req, kind, pharmacyId, mode, dryRun, n, row, known);
      });
      return { dryRun, results: results as (BulkRowResult & { outcome: BulkOutcome })[] };
    });
  }
}
