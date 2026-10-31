import { bedDayKey, bedDays, validityOverlaps, validOn, type BedPeriod } from '../../data-access/space-billing/space-billing.rules';
import type { ChargeCapture, CreateSpaceTariffRequest, SpaceTariff } from '../../data-access/space-billing/space-billing.types';
import { PRACTICE_SANLUCAS } from '../fixtures/agenda';
import { conceptoDe, SITIOS_INFRA } from '../fixtures/infraestructura';
import { PATIENTS } from '../fixtures/people';
import type { MockRequest, MockRouter } from '../mock-router';
import { Coleccion, fecha, isoDia, nuevoId, texto, uuid } from '../mock-store';
import { espacios, tenantDePractica, unidades } from './infrastructure.handlers';
import { conflictReply, forbiddenReply, hasRole, notFoundReply, preconditionReply, tenantOf } from './operating-rooms.state';
import { servicios } from './practice.handlers';

/* ============================================================================
    Facturación por espacio — franja F5e (`CONTRATO-F2-F5.md` §F5e).

    - Tarifas versionadas con `EXCLUDE` de vigencia (409 `TARIFF_OVERLAP`) y el
      ítem de catálogo de la misma práctica (422 `TARIFF_SERVICE_NOT_IN_PRACTICE`).
    - Día-cama por la **regla de medianoche** sobre las estancias de abajo
      (las mismas camas del árbol de F1), idempotente por `BEDDAY:<enc>:<fecha>`;
      sin tarifa vigente, el cargo queda con `unitPrice: null` y alerta.
    - Cada cargo lleva el centro de costo de la unidad dueña de la cama (F5f).
    - Permisos: Facturación todo; Admin org tarifas; el resto 403.
    ========================================================================== */

const BILLING_ROLES = ['BILLING'] as const;
const TARIFF_ROLES = ['BILLING', 'SECURITY_ADMIN'] as const;
const READ_ROLES = ['BILLING', 'SECURITY_ADMIN', 'SUPERADMIN', 'PLATFORM_ADMIN'] as const;

const SAN_LUCAS = SITIOS_INFRA[0]!;
const bed = (code: string) => espacios.todos().find((e) => e.siteId === SAN_LUCAS.id && e.code === code)!;

/* Ítems del catálogo de San Lucas que facturan el espacio. */
const SERVICE_SEEDS = [
  ['DIA-CAMA-COMP', 'Día-cama en habitación compartida', '450.00'],
  ['DIA-CAMA-PRIV', 'Día-cama en habitación privada', '780.00'],
  ['USO-QX', 'Uso de quirófano (fracción de 30 min)', '600.00'],
] as const;
for (const [code, name, price] of SERVICE_SEEDS) {
  servicios.agregar({ id: uuid(`service-${code}`), practiceId: PRACTICE_SANLUCAS, code, name, defaultPrice: price, currencyConceptId: uuid('concept-currency-bob'), currencyCode: 'BOB', isActive: true });
}

interface SimulatedTariff {
  readonly id: string;
  readonly practiceId: string;
  readonly tariffKindCode: 'TARIFF_BED_DAY' | 'TARIFF_OR_TIME';
  readonly bedCategoryCode: string | null;
  readonly careSpaceId: string | null;
  readonly serviceCatalogId: string;
  readonly unitMinutes: number | null;
  readonly minimumUnits: number | null;
  readonly unitPrice: string;
  readonly currencyCode: string;
  readonly validFrom: string;
  readonly validTo: string | null;
}

const tariffs = new Coleccion<SimulatedTariff>([
  { id: uuid('tariff-bed-shared'), practiceId: PRACTICE_SANLUCAS, tariffKindCode: 'TARIFF_BED_DAY', bedCategoryCode: 'BED_CAT_SHARED', careSpaceId: null, serviceCatalogId: uuid('service-DIA-CAMA-COMP'), unitMinutes: null, minimumUnits: null, unitPrice: '450.000000', currencyCode: 'BOB', validFrom: '2026-01-01', validTo: null },
  { id: uuid('tariff-bed-private'), practiceId: PRACTICE_SANLUCAS, tariffKindCode: 'TARIFF_BED_DAY', bedCategoryCode: 'BED_CAT_PRIVATE', careSpaceId: null, serviceCatalogId: uuid('service-DIA-CAMA-PRIV'), unitMinutes: null, minimumUnits: null, unitPrice: '780.000000', currencyCode: 'BOB', validFrom: '2026-01-01', validTo: null },
  { id: uuid('tariff-or-time'), practiceId: PRACTICE_SANLUCAS, tariffKindCode: 'TARIFF_OR_TIME', bedCategoryCode: null, careSpaceId: null, serviceCatalogId: uuid('service-USO-QX'), unitMinutes: 30, minimumUnits: 2, unitPrice: '600.000000', currencyCode: 'BOB', validFrom: '2026-01-01', validTo: null },
]);

/** Estancias de internación de San Lucas: los períodos de cama que F3 registra. */
interface SimulatedStay {
  readonly id: string;
  readonly siteId: string;
  readonly practiceId: string;
  readonly patientProfileId: string;
  readonly patientName: string;
  readonly periods: readonly BedPeriod[];
  readonly dischargedAt: string | null;
}

function staySeeds(): SimulatedStay[] {
  const shared = bed('301-A');
  const privateBed = bed('303-A');
  const other = bed('302-A');
  if (shared === undefined || privateBed === undefined || other === undefined) return [];
  return [
    {
      // El criterio del contrato, corrido a hoy: ingreso −4 d 15:00 en compartida,
      // traslado a privada −3 d 10:00, egreso −1 d 09:00 → 3 días-cama.
      id: uuid('encounter-stay-1'),
      siteId: SAN_LUCAS.id,
      practiceId: PRACTICE_SANLUCAS,
      patientProfileId: PATIENTS[40]!.id,
      patientName: PATIENTS[40]!.displayName,
      periods: [
        { careSpaceId: shared.id, bedCategoryCode: 'BED_CAT_SHARED', start: fecha(-4, 15).toISOString(), end: fecha(-3, 10).toISOString() },
        { careSpaceId: privateBed.id, bedCategoryCode: 'BED_CAT_PRIVATE', start: fecha(-3, 10).toISOString(), end: fecha(-1, 9).toISOString() },
      ],
      dischargedAt: fecha(-1, 9).toISOString(),
    },
    {
      id: uuid('encounter-stay-2'),
      siteId: SAN_LUCAS.id,
      practiceId: PRACTICE_SANLUCAS,
      patientProfileId: PATIENTS[41]!.id,
      patientName: PATIENTS[41]!.displayName,
      periods: [{ careSpaceId: other.id, bedCategoryCode: 'BED_CAT_SHARED', start: fecha(-2, 18).toISOString(), end: null }],
      dischargedAt: null,
    },
  ];
}

const stays = new Coleccion<SimulatedStay>(staySeeds());

type SimulatedCharge = Omit<ChargeCapture, 'careSpace' | 'bedCategory' | 'sourceKind' | 'status' | 'costCenter'> & {
  readonly careSpaceId: string;
  readonly bedCategoryCode: string | null;
  readonly sourceKindCode: 'CHG_SRC_BED_DAY' | 'CHG_SRC_OR_TIME';
  readonly statusCode: 'CHG_PENDING' | 'CHG_INVOICED' | 'CHG_VOIDED';
  readonly costCenterUnitId: string | null;
};

const charges = new Coleccion<SimulatedCharge>([]);

/* ---- vistas ---------------------------------------------------------------- */

const KIND_LABELS = { TARIFF_BED_DAY: 'Día-cama', TARIFF_OR_TIME: 'Quirófano por tiempo' } as const;
const SOURCE_LABELS = { CHG_SRC_BED_DAY: 'Día-cama', CHG_SRC_OR_TIME: 'Uso de quirófano' } as const;
const STATUS_LABELS = { CHG_PENDING: 'Pendiente de revisión', CHG_INVOICED: 'Facturado', CHG_VOIDED: 'Anulado' } as const;

function spaceRef(id: string | null) {
  const e = id === null ? undefined : espacios.get(id);
  return e === undefined ? null : { id: e.id, code: e.code, name: e.name };
}

function tariffView(t: SimulatedTariff): SpaceTariff {
  const today = isoDia(0);
  return {
    id: t.id,
    practiceId: t.practiceId,
    tariffKind: { code: t.tariffKindCode, display: KIND_LABELS[t.tariffKindCode] },
    bedCategory: t.bedCategoryCode === null ? null : conceptoDe(t.bedCategoryCode),
    careSpace: spaceRef(t.careSpaceId),
    serviceCatalogId: t.serviceCatalogId,
    serviceName: servicios.get(t.serviceCatalogId)?.name ?? 'Ítem del catálogo',
    unitMinutes: t.unitMinutes,
    minimumUnits: t.minimumUnits,
    unitPrice: t.unitPrice,
    currencyCode: t.currencyCode,
    validFrom: t.validFrom,
    validTo: t.validTo,
    status: validOn(today, t.validFrom, t.validTo) ? { code: 'TARIFF_ACTIVE', display: 'Vigente' } : t.validFrom > today ? { code: 'TARIFF_FUTURE', display: 'Futura' } : { code: 'TARIFF_CLOSED', display: 'Cerrada' },
  };
}

function chargeView(c: SimulatedCharge): ChargeCapture {
  const { careSpaceId, bedCategoryCode, sourceKindCode, statusCode, costCenterUnitId, ...rest } = c;
  const unit = costCenterUnitId === null ? undefined : unidades.get(costCenterUnitId);
  return {
    ...rest,
    careSpace: spaceRef(careSpaceId) ?? { id: careSpaceId, code: '—', name: 'Espacio' },
    bedCategory: bedCategoryCode === null ? null : conceptoDe(bedCategoryCode),
    sourceKind: { code: sourceKindCode, display: SOURCE_LABELS[sourceKindCode] },
    status: { code: statusCode, display: STATUS_LABELS[statusCode] },
    costCenter: unit === undefined ? null : { id: `cc-${unit.id}`, name: `Centro de costo · ${unit.name}` },
  };
}

/* ---- reglas ---------------------------------------------------------------- */

function practiceVisible(request: MockRequest, practiceId: string | null): boolean {
  if (practiceId === null) return false;
  const tenant = tenantOf(request);
  const owner = tenantDePractica(practiceId);
  return owner !== null && (tenant === null || tenant === owner);
}

function stayVisible(request: MockRequest): SimulatedStay | null {
  const s = stays.get(request.params['encounterId']!);
  return s === undefined || !practiceVisible(request, s.practiceId) ? null : s;
}

/** La tarifa vigente en el día: la propia de la sala gana sobre la general. */
function tariffFor(practiceId: string, kind: SimulatedTariff['tariffKindCode'], day: string, careSpaceId: string, category: string | null) {
  const live = tariffs.filtrar((t) => t.practiceId === practiceId && t.tariffKindCode === kind && validOn(day, t.validFrom, t.validTo));
  return live.find((t) => t.careSpaceId === careSpaceId) ?? live.find((t) => t.careSpaceId === null && (category === null || t.bedCategoryCode === category));
}

/** Devenga el día-cama de una estancia hasta ahora. Idempotente. */
export function runBedDayFor(stay: SimulatedStay, now = new Date()): { created: SimulatedCharge[]; skipped: number } {
  const created: SimulatedCharge[] = [];
  let skipped = 0;
  for (const day of bedDays(stay.periods, now)) {
    const key = bedDayKey(stay.id, day.serviceDate);
    if (charges.todos().some((c) => c.idempotencyKey === key && c.statusCode !== 'CHG_VOIDED')) {
      skipped += 1;
      continue;
    }
    const tariff = tariffFor(stay.practiceId, 'TARIFF_BED_DAY', day.serviceDate, day.careSpaceId, day.bedCategoryCode);
    created.push(
      charges.agregar({
        id: nuevoId('charge'),
        encounterId: stay.id,
        sourceKindCode: 'CHG_SRC_BED_DAY',
        sourceRefId: stay.id,
        serviceDate: day.serviceDate,
        careSpaceId: day.careSpaceId,
        bedCategoryCode: day.bedCategoryCode,
        spaceTariffId: tariff?.id ?? null,
        serviceCatalogId: tariff?.serviceCatalogId ?? null,
        quantity: '1',
        unitPrice: tariff?.unitPrice ?? null,
        currencyCode: 'BOB',
        costCenterUnitId: espacios.get(day.careSpaceId)?.clinicalUnitId ?? null,
        statusCode: 'CHG_PENDING',
        idempotencyKey: key,
        voidReason: null,
      } as SimulatedCharge),
    );
  }
  return { created, skipped };
}

/* ---- rutas ----------------------------------------------------------------- */

export function registerSpaceBilling(router: MockRouter): void {
  router.get('/billing/space-tariffs', (request) => {
    const practiceId = texto(request.query, 'practiceId');
    if (!practiceVisible(request, practiceId)) return notFoundReply();
    if (!hasRole(request, READ_ROLES)) return forbiddenReply('Su rol no consulta tarifas.', READ_ROLES);
    return tariffs
      .filtrar((t) => t.practiceId === practiceId)
      .sort((a, b) => a.tariffKindCode.localeCompare(b.tariffKindCode) || (a.bedCategoryCode ?? '').localeCompare(b.bedCategoryCode ?? '') || a.validFrom.localeCompare(b.validFrom))
      .map(tariffView);
  });

  router.post('/billing/space-tariffs', (request) => {
    const body = { ...(request.body as Partial<CreateSpaceTariffRequest>) };
    if (!practiceVisible(request, body.practiceId ?? null)) return notFoundReply();
    if (!hasRole(request, TARIFF_ROLES)) return forbiddenReply('Las tarifas las cargan Facturación o la administración de la organización.', TARIFF_ROLES);
    const service = body.serviceCatalogId === undefined ? undefined : servicios.get(body.serviceCatalogId);
    if (service === undefined || service.practiceId !== body.practiceId) {
      return preconditionReply('TARIFF_SERVICE_NOT_IN_PRACTICE', 'El ítem de catálogo no es de esta práctica.');
    }
    if (body.careSpaceId !== undefined) {
      const space = espacios.get(body.careSpaceId);
      if (space === undefined || tenantDePractica(body.practiceId!) !== space.tenantId) return notFoundReply();
    }
    const kind = body.tariffKindCode === 'TARIFF_OR_TIME' ? 'TARIFF_OR_TIME' : 'TARIFF_BED_DAY';
    if (kind === 'TARIFF_OR_TIME' && !(Number(body.unitMinutes) > 0)) return preconditionReply('TARIFF_UNIT_MINUTES_REQUIRED', 'La tarifa de quirófano exige la fracción de minutos.');
    if (kind === 'TARIFF_BED_DAY' && !body.bedCategoryCode && !body.careSpaceId) return preconditionReply('TARIFF_TARGET_REQUIRED', 'Indique la categoría de cama o la sala.');
    if (!body.validFrom || !/^\d+(\.\d{1,6})?$/.test(body.unitPrice ?? '')) return preconditionReply('TARIFF_INVALID', 'Revise el precio y la vigencia.');
    if (body.validTo && body.validTo <= body.validFrom) return preconditionReply('TARIFF_INVALID_PERIOD', 'La vigencia tiene que terminar después de empezar.');
    const clash = tariffs.todos().find(
      (t) =>
        t.practiceId === body.practiceId &&
        t.tariffKindCode === kind &&
        (t.bedCategoryCode ?? null) === (body.bedCategoryCode ?? null) &&
        (t.careSpaceId ?? null) === (body.careSpaceId ?? null) &&
        validityOverlaps(t.validFrom, t.validTo, body.validFrom!, body.validTo ?? null),
    );
    if (clash !== undefined) {
      return conflictReply('TARIFF_OVERLAP', `Ya hay una tarifa igual vigente desde ${clash.validFrom}${clash.validTo ? ` hasta ${clash.validTo}` : ''}: ciérrela antes.`, { conflictingTariffId: clash.id });
    }
    const created = tariffs.agregar({
      id: nuevoId('tariff'),
      practiceId: body.practiceId!,
      tariffKindCode: kind,
      bedCategoryCode: body.bedCategoryCode ?? null,
      careSpaceId: body.careSpaceId ?? null,
      serviceCatalogId: service.id,
      unitMinutes: kind === 'TARIFF_OR_TIME' ? Number(body.unitMinutes) : null,
      minimumUnits: body.minimumUnits ?? null,
      unitPrice: Number(body.unitPrice).toFixed(6),
      currencyCode: body.currencyCode ?? 'BOB',
      validFrom: body.validFrom,
      validTo: body.validTo ?? null,
    });
    return { status: 201, body: tariffView(created) };
  });

  router.post('/billing/space-tariffs/:id/close', (request) => {
    const t = tariffs.get(request.params['id']!);
    if (t === undefined || !practiceVisible(request, t.practiceId)) return notFoundReply();
    if (!hasRole(request, TARIFF_ROLES)) return forbiddenReply('Las tarifas las cierran Facturación o la administración.', TARIFF_ROLES);
    const validTo = (request.body as { validTo?: string } | null)?.validTo;
    if (!validTo || validTo <= t.validFrom) return preconditionReply('TARIFF_INVALID_PERIOD', 'La fecha de cierre tiene que ser posterior al inicio de la vigencia.');
    if (t.validTo !== null && t.validTo <= validTo) return conflictReply('TARIFF_ALREADY_CLOSED', 'La tarifa ya está cerrada en esa fecha o antes.');
    return tariffView(tariffs.actualizar(t.id, { validTo })!);
  });

  router.get('/billing/bed-day/stays', (request) => {
    const siteId = texto(request.query, 'siteId');
    const site = SITIOS_INFRA.find((s) => s.id === siteId);
    if (site === undefined || !practiceVisible(request, site.practiceId)) return notFoundReply();
    if (!hasRole(request, READ_ROLES)) return forbiddenReply('Su rol no consulta cargos.', READ_ROLES);
    return stays
      .filtrar((s) => s.siteId === site.id)
      .map((s) => ({
        encounterId: s.id,
        patientName: s.patientName,
        admittedAt: s.periods[0]!.start,
        dischargedAt: s.dischargedAt,
        currentBed: spaceRef(s.periods.at(-1)!.careSpaceId)?.name ?? '—',
        pendingCharges: charges.filtrar((c) => c.encounterId === s.id && c.statusCode === 'CHG_PENDING').length,
      }));
  });

  router.get('/billing/encounters/:encounterId/pending-charges', (request) => {
    const s = stayVisible(request);
    if (s === null) return notFoundReply();
    if (!hasRole(request, READ_ROLES)) return forbiddenReply('Su rol no consulta cargos.', READ_ROLES);
    return {
      encounterId: s.id,
      patientName: s.patientName,
      asOf: new Date().toISOString(),
      charges: charges.filtrar((c) => c.encounterId === s.id).sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)).map(chargeView),
    };
  });

  router.post('/billing/encounters/:encounterId/bed-day-charges/run', (request) => {
    const s = stayVisible(request);
    if (s === null) return notFoundReply();
    if (!hasRole(request, BILLING_ROLES)) return forbiddenReply('Sólo Facturación devenga cargos.', BILLING_ROLES);
    const { created, skipped } = runBedDayFor(s);
    return { status: 201, body: { created: created.length, skipped, charges: created.map(chargeView) } };
  });

  router.post('/billing/charge-captures/:id/void', (request) => {
    const c = charges.get(request.params['id']!);
    const s = c === undefined ? undefined : stays.get(c.encounterId);
    if (c === undefined || s === undefined || !practiceVisible(request, s.practiceId)) return notFoundReply();
    if (!hasRole(request, BILLING_ROLES)) return forbiddenReply('Sólo Facturación anula cargos.', BILLING_ROLES);
    const reason = (request.body as { reason?: string } | null)?.reason?.trim();
    if (!reason) return preconditionReply('VOID_REASON_REQUIRED', 'Anular un cargo exige el motivo.');
    if (c.statusCode === 'CHG_INVOICED') return conflictReply('CHARGE_ALREADY_INVOICED', 'El cargo ya está facturado: corresponde una nota de crédito.');
    if (c.statusCode === 'CHG_VOIDED') return conflictReply('CHARGE_ALREADY_VOIDED', 'El cargo ya está anulado.');
    return chargeView(charges.actualizar(c.id, { statusCode: 'CHG_VOIDED', voidReason: reason })!);
  });
}

/* Sobreviven a F5 dentro de la pestaña: la cadena UI → recarga → UI. */
tariffs.persistirEn('mock.billing.spaceTariffs');
charges.persistirEn('mock.billing.chargeCaptures');
