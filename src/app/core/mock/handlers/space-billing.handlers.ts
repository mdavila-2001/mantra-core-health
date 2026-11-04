import { bedDayKey, bedDays, orTimeUnits, validityOverlaps, validOn, type BedPeriod } from '../../data-access/space-billing/space-billing.rules';
import { BED_CATEGORY_CONCEPTS, CURRENCY_CONCEPTS } from '../../data-access/infra-concepts';
import type { ChargeCapture, CreateSpaceTariffRequest, Inpatient, SpaceTariff } from '../../data-access/space-billing/space-billing.types';
import { PRACTICE_SANLUCAS } from '../fixtures/agenda';
import { SITIOS_INFRA } from '../fixtures/infraestructura';
import { PATIENTS } from '../fixtures/people';
import type { MockRequest, MockRouter } from '../mock-router';
import { Coleccion, fecha, nuevoId, texto, uuid } from '../mock-store';
import { espacios, tenantDePractica } from './infrastructure.handlers';
import { conflictReply, forbiddenReply, hasRole, notFoundReply, preconditionReply, tenantOf } from './operating-rooms.state';
import { servicios } from './practice.handlers';
import { costCenterOfUnit } from './infra-accounting.handlers';

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
  readonly tariffKind: 'BED_DAY' | 'OR_TIME';
  readonly bedCategoryCode: string | null;
  readonly careSpaceId: string | null;
  readonly serviceCatalogId: string;
  readonly unitMinutes: number | null;
  readonly minimumUnits: number | null;
  readonly unitPrice: string;
  readonly currencyConceptId: string | null;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly rowVersion: number;
}

const BOB = CURRENCY_CONCEPTS['BOB']!;

const tariffs = new Coleccion<SimulatedTariff>([
  { id: uuid('tariff-bed-shared'), practiceId: PRACTICE_SANLUCAS, tariffKind: 'BED_DAY', bedCategoryCode: 'BED_CAT_SHARED', careSpaceId: null, serviceCatalogId: uuid('service-DIA-CAMA-COMP'), unitMinutes: null, minimumUnits: null, unitPrice: '450.000000', currencyConceptId: BOB, validFrom: '2026-01-01', validTo: null, rowVersion: 1 },
  { id: uuid('tariff-bed-private'), practiceId: PRACTICE_SANLUCAS, tariffKind: 'BED_DAY', bedCategoryCode: 'BED_CAT_PRIVATE', careSpaceId: null, serviceCatalogId: uuid('service-DIA-CAMA-PRIV'), unitMinutes: null, minimumUnits: null, unitPrice: '780.000000', currencyConceptId: BOB, validFrom: '2026-01-01', validTo: null, rowVersion: 1 },
  { id: uuid('tariff-or-time'), practiceId: PRACTICE_SANLUCAS, tariffKind: 'OR_TIME', bedCategoryCode: null, careSpaceId: null, serviceCatalogId: uuid('service-USO-QX'), unitMinutes: 30, minimumUnits: 2, unitPrice: '600.000000', currencyConceptId: BOB, validFrom: '2026-01-01', validTo: null, rowVersion: 1 },
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

/** El cargo como lo guarda la maqueta (la vista de la API sale de `chargeView`). */
interface SimulatedCharge {
  readonly id: string;
  readonly encounterId: string;
  readonly source: 'BED_DAY' | 'OR_TIME';
  readonly sourceRefId: string;
  readonly serviceDate: string;
  readonly careSpaceId: string;
  readonly bedCategoryCode: string | null;
  readonly spaceTariffId: string | null;
  readonly quantity: string;
  readonly unitPrice: string | null;
  readonly costCenterUnitId: string | null;
  readonly status: 'CHG_PENDING' | 'CHG_INVOICED' | 'CHG_VOIDED';
  readonly idempotencyKey: string;
  readonly voidReason: string | null;
  /** Interno de la maqueta: la API no lo devuelve en `chargeView`. */
  readonly minutes?: number;
}

const charges = new Coleccion<SimulatedCharge>([]);

/* ---- vistas ---------------------------------------------------------------- */

/** `tariffView` de la API. */
function tariffView(t: SimulatedTariff): SpaceTariff {
  return {
    id: t.id,
    practiceId: t.practiceId,
    tariffKind: t.tariffKind,
    bedCategoryConceptId: t.bedCategoryCode === null ? null : (BED_CATEGORY_CONCEPTS[t.bedCategoryCode] ?? null),
    careSpaceId: t.careSpaceId,
    serviceCatalogId: t.serviceCatalogId,
    unitMinutes: t.unitMinutes,
    minimumUnits: t.minimumUnits,
    unitPrice: t.unitPrice,
    validFrom: t.validFrom,
    validTo: t.validTo,
    rowVersion: t.rowVersion,
  };
}

/** `chargeView` de la API: ids sueltos, el centro de costo vigente de la unidad (F5f). */
function chargeView(c: SimulatedCharge): ChargeCapture {
  return {
    id: c.id,
    encounterId: c.encounterId,
    source: c.source,
    sourceRefId: c.sourceRefId,
    serviceDate: c.serviceDate,
    careSpaceId: c.careSpaceId,
    bedCategoryConceptId: c.bedCategoryCode === null ? null : (BED_CATEGORY_CONCEPTS[c.bedCategoryCode] ?? null),
    spaceTariffId: c.spaceTariffId,
    quantity: c.quantity,
    unitPrice: c.unitPrice,
    costCenterId: costCenterOfUnit(c.costCenterUnitId)?.id ?? null,
    status: c.status,
    idempotencyKey: c.idempotencyKey,
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

/* ---- F4/F5e · quirófano por tiempo -------------------------------------------- */

interface SurgicalEncounter {
  readonly id: string;
  readonly practiceId: string;
  readonly patientName: string;
}

/** Los encuentros quirúrgicos con cargo de quirófano (los de internación están en `stays`). */
const surgicalEncounters = new Coleccion<SurgicalEncounter>([]);

/** Un encuentro con cargos, de internación o quirúrgico, si es del tenant activo. */
function encounterVisible(request: MockRequest): { id: string; practiceId: string; patientName: string } | null {
  const id = request.params['encounterId']!;
  const e = stays.get(id) ?? surgicalEncounters.get(id);
  return e === undefined || !practiceVisible(request, e.practiceId) ? null : e;
}

/**
 * El cargo de uso de quirófano al cerrar el caso (Salida OMS hecha): minutos =
 * salida − entrada a sala; unidades = `max(mínimo, ⌈minutos ÷ fracción⌉)`;
 * tarifa propia de la sala o la general vigente al inicio. Idempotente por
 * `ORTIME:<caso>`. Sin tarifa, pendiente sin precio (no se inventa).
 */
export function createOrTimeCharge(input: { caseId: string; encounterId: string; patientName: string; practiceId: string; operatingRoomId: string; startedAt: string; minutes: number }): void {
  const key = `ORTIME:${input.caseId}`;
  if (charges.todos().some((c) => c.idempotencyKey === key && c.status !== 'CHG_VOIDED')) return;
  surgicalEncounters.agregar({ id: input.encounterId, practiceId: input.practiceId, patientName: input.patientName });
  const day = new Date(input.startedAt);
  const serviceDate = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const tariff = tariffFor(input.practiceId, 'OR_TIME', serviceDate, input.operatingRoomId, null);
  const units = tariff?.unitMinutes ? orTimeUnits(input.minutes, tariff.unitMinutes, tariff.minimumUnits ?? 0) : 1;
  charges.agregar({
    id: nuevoId('charge'),
    encounterId: input.encounterId,
    source: 'OR_TIME',
    sourceRefId: input.caseId,
    serviceDate,
    careSpaceId: input.operatingRoomId,
    bedCategoryCode: null,
    spaceTariffId: tariff?.id ?? null,
    quantity: String(units),
    unitPrice: tariff?.unitPrice ?? null,
    costCenterUnitId: espacios.get(input.operatingRoomId)?.clinicalUnitId ?? null,
    status: 'CHG_PENDING',
    idempotencyKey: key,
    voidReason: null,
    minutes: input.minutes,
  });
}

/** La tarifa vigente en el día: la propia de la sala gana sobre la general. */
function tariffFor(practiceId: string, kind: SimulatedTariff['tariffKind'], day: string, careSpaceId: string, category: string | null) {
  const live = tariffs.filtrar((t) => t.practiceId === practiceId && t.tariffKind === kind && validOn(day, t.validFrom, t.validTo));
  return live.find((t) => t.careSpaceId === careSpaceId) ?? live.find((t) => t.careSpaceId === null && (category === null || t.bedCategoryCode === category));
}

/** Devenga el día-cama de una estancia hasta ahora. Idempotente. */
export function runBedDayFor(stay: SimulatedStay, now = new Date()): { created: SimulatedCharge[]; skipped: number } {
  const created: SimulatedCharge[] = [];
  let skipped = 0;
  for (const day of bedDays(stay.periods, now)) {
    const key = bedDayKey(stay.id, day.serviceDate);
    if (charges.todos().some((c) => c.idempotencyKey === key && c.status !== 'CHG_VOIDED')) {
      skipped += 1;
      continue;
    }
    const tariff = tariffFor(stay.practiceId, 'BED_DAY', day.serviceDate, day.careSpaceId, day.bedCategoryCode);
    created.push(
      charges.agregar({
        id: nuevoId('charge'),
        encounterId: stay.id,
        source: 'BED_DAY',
        sourceRefId: stay.id,
        serviceDate: day.serviceDate,
        careSpaceId: day.careSpaceId,
        bedCategoryCode: day.bedCategoryCode,
        spaceTariffId: tariff?.id ?? null,
        quantity: '1',
        unitPrice: tariff?.unitPrice ?? null,
        costCenterUnitId: espacios.get(day.careSpaceId)?.clinicalUnitId ?? null,
        status: 'CHG_PENDING',
        idempotencyKey: key,
        voidReason: null,
      }),
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
      .sort((a, b) => a.tariffKind.localeCompare(b.tariffKind) || (a.bedCategoryCode ?? '').localeCompare(b.bedCategoryCode ?? '') || a.validFrom.localeCompare(b.validFrom))
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
    if (body.tariffKind !== 'BED_DAY' && body.tariffKind !== 'OR_TIME') return preconditionReply('VALIDATION_FAILED', 'tariffKind debe ser BED_DAY u OR_TIME.');
    const kind = body.tariffKind;
    if (kind === 'OR_TIME' && !(Number(body.unitMinutes) > 0)) return preconditionReply('TARIFF_UNIT_MINUTES_REQUIRED', 'La tarifa de quirófano exige la fracción de minutos.');
    if (body.bedCategoryCode && !(body.bedCategoryCode in BED_CATEGORY_CONCEPTS)) return preconditionReply('TARIFF_OVERLAP', 'Categoría de cama desconocida');
    if (kind === 'BED_DAY' && !body.bedCategoryCode && !body.careSpaceId) return preconditionReply('TARIFF_TARGET_REQUIRED', 'Indique la categoría de cama o la sala.');
    if (!body.validFrom || !/^\d+(\.\d{1,6})?$/.test(body.unitPrice ?? '')) return preconditionReply('TARIFF_INVALID', 'Revise el precio y la vigencia.');
    if (body.validTo && body.validTo <= body.validFrom) return preconditionReply('TARIFF_INVALID_PERIOD', 'La vigencia tiene que terminar después de empezar.');
    const clash = tariffs.todos().find(
      (t) =>
        t.practiceId === body.practiceId &&
        t.tariffKind === kind &&
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
      tariffKind: kind,
      bedCategoryCode: body.bedCategoryCode ?? null,
      careSpaceId: body.careSpaceId ?? null,
      serviceCatalogId: service.id,
      unitMinutes: kind === 'OR_TIME' ? Number(body.unitMinutes) : null,
      minimumUnits: body.minimumUnits ?? null,
      unitPrice: Number(body.unitPrice).toFixed(6),
      currencyConceptId: body.currencyConceptId ?? null,
      validFrom: body.validFrom,
      validTo: body.validTo ?? null,
      rowVersion: 1,
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
    return tariffView(tariffs.actualizar(t.id, { validTo, rowVersion: t.rowVersion + 1 })!);
  });

  // F3 · `GET /sites/:siteId/inpatients`: las internaciones vigentes. Si el
  // simulador de internación (W-F2F3) ya la registró, no se pisa.
  if (router.match('GET', '/sites/x/inpatients') === null) {
    router.get('/sites/:siteId/inpatients', (request) => {
      const site = SITIOS_INFRA.find((x) => x.id === request.params['siteId']);
      if (site === undefined || !practiceVisible(request, site.practiceId)) return notFoundReply();
      if (!hasRole(request, READ_ROLES)) return forbiddenReply('Su rol no consulta la internación.', READ_ROLES);
      return stays
        .filtrar((st) => st.siteId === site.id && st.dischargedAt === null)
        .map((st): Inpatient => {
          const current = st.periods.at(-1)!;
          return {
            encounterId: st.id,
            patientProfileId: st.patientProfileId,
            bed: { careSpaceId: current.careSpaceId, clinicalUnitId: espacios.get(current.careSpaceId)?.clinicalUnitId ?? null },
            since: current.start,
            levelOfCare: null,
            expectedDischargeAt: null,
            losDays: Math.max(1, Math.floor((Date.now() - Date.parse(st.periods[0]!.start)) / 86_400_000)),
          };
        });
    });
  }

  router.get('/billing/encounters/:encounterId/pending-charges', (request) => {
    const s = encounterVisible(request);
    if (s === null) return notFoundReply();
    if (!hasRole(request, READ_ROLES)) return forbiddenReply('Su rol no consulta cargos.', READ_ROLES);
    // Arreglo de cargos **pendientes**, como `SpaceChargesService.pending`.
    return charges
      .filtrar((c) => c.encounterId === s.id && c.status === 'CHG_PENDING')
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
      .map(chargeView);
  });

  router.post('/billing/encounters/:encounterId/bed-day-charges/run', (request) => {
    const s = stayVisible(request);
    if (s === null) return notFoundReply();
    if (!hasRole(request, BILLING_ROLES)) return forbiddenReply('Sólo Facturación devenga cargos.', BILLING_ROLES);
    const { created, skipped } = runBedDayFor(s);
    return { created: created.map(chargeView), skipped };
  });

  router.post('/billing/charge-captures/:id/void', (request) => {
    const c = charges.get(request.params['id']!);
    const s = c === undefined ? undefined : (stays.get(c.encounterId) ?? surgicalEncounters.get(c.encounterId));
    if (c === undefined || s === undefined || !practiceVisible(request, s.practiceId)) return notFoundReply();
    if (!hasRole(request, BILLING_ROLES)) return forbiddenReply('Sólo Facturación anula cargos.', BILLING_ROLES);
    const reason = (request.body as { reason?: string } | null)?.reason?.trim();
    if (!reason) return preconditionReply('VOID_REASON_REQUIRED', 'Anular un cargo exige el motivo.');
    if (c.status === 'CHG_INVOICED') return conflictReply('CHARGE_ALREADY_INVOICED', 'El cargo ya está facturado: corresponde una nota de crédito.');
    if (c.status !== 'CHG_PENDING') return conflictReply('CHARGE_NOT_PENDING', 'El cargo no está pendiente.');
    return chargeView(charges.actualizar(c.id, { status: 'CHG_VOIDED', voidReason: reason })!);
  });
}

/* Sobreviven a F5 dentro de la pestaña: la cadena UI → recarga → UI. */
tariffs.persistirEn('mock.billing.spaceTariffs');
surgicalEncounters.persistirEn('mock.billing.surgicalEncounters');
charges.persistirEn('mock.billing.chargeCaptures');
