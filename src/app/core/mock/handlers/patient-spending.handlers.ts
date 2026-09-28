import type {
  PatientSpendingResponseDto,
  SpendingConceptDto,
  SpendingMovementDto,
} from '../../data-access/patient-spending/patient-spending.dto';
import { semillaDe } from '../faker/semilla';
import { preconditionFailed, validation, type MockRouter } from '../mock-router';
import {
  TENANT_ASEGURADORA,
  TENANT_CLINICA,
  TENANT_CONSULTORIO,
  TENANT_FARMACIA,
  TENANT_HOSPITAL,
  TENANT_LABORATORIO,
  TENANT_NAMES,
} from '../mock-session';
import { hoy, uuid } from '../mock-store';

/* ============================================================================
    Gastos de salud del paciente (P43): `GET /patient-spending/me?from=&to=`.

    La API real todavía no lo tiene. El doble genera los movimientos de cada
    mes **a partir de una semilla por paciente y por mes**, así que:

      · el mismo paciente ve las mismas cifras en cada recarga y en cada
        máquina, y
      · pedir un rango u otro no cambia lo que hubo en un mes dado — la
        comparación «este año contra el pasado» no depende de qué se pidió.

    Cobran los tenants del propio simulador (Consultorio Dra. Rojas, Clínica
    Los Olivos, Farmacia Vida…): nada de instituciones ajenas. Las cifras son
    de demostración y no se presentan como reales.
    ========================================================================== */

const CURRENCY = 'BOB';

/** El rango más largo que se acepta: dos años enteros más el corriente. */
const MAX_RANGE_DAYS = 3 * 366;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function concept(code: string, display: string): SpendingConceptDto {
  return { code, display };
}

const CATEGORY = {
  consultation: concept('SPEND_CONSULTATION', 'Consultations'),
  pharmacy: concept('SPEND_PHARMACY', 'Pharmacy'),
  laboratory: concept('SPEND_LABORATORY', 'Laboratory'),
  imaging: concept('SPEND_IMAGING', 'Imaging'),
  procedure: concept('SPEND_PROCEDURE', 'Procedures'),
  premium: concept('SPEND_INSURANCE_PREMIUM', 'Insurance premium'),
} as const;

/** Cuánto sube todo de un año al siguiente: la comparación necesita moverse. */
const YEARLY_GROWTH = 0.11;

/** Mayo a julio es invierno en Bolivia: más consultas y más farmacia. */
const WINTER_MONTHS: readonly number[] = [4, 5, 6];
const WINTER_FACTOR = 1.3;

const MONTHLY_PREMIUM = 420;

/** Generador pequeño y determinista (mulberry32): la semilla manda. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface MovementDraft {
  readonly category: SpendingConceptDto;
  readonly description: string;
  readonly providerTenant: string;
  readonly gross: number;
  readonly coveredRatio: number;
  readonly discountRatio: number;
  readonly day: number;
}

function between(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)]!;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Los gastos de un mes, antes de fecharlos y de recortarlos al rango. */
function draftsForMonth(
  patientProfileId: string,
  year: number,
  monthIndex: number,
  baseYear: number,
): readonly MovementDraft[] {
  const random = seededRandom(semillaDe(`${patientProfileId}:${year}-${monthIndex + 1}`));
  const lastDay = daysInMonth(year, monthIndex);
  const day = (): number => 1 + Math.floor(random() * lastDay);
  const growth = 1 + YEARLY_GROWTH * (year - baseYear);
  const season = WINTER_MONTHS.includes(monthIndex) ? WINTER_FACTOR : 1;
  const drafts: MovementDraft[] = [
    {
      category: CATEGORY.premium,
      description: 'Prima mensual del seguro de salud',
      providerTenant: TENANT_ASEGURADORA,
      gross: roundTo(MONTHLY_PREMIUM * growth, 10),
      coveredRatio: 0,
      discountRatio: 0,
      day: Math.min(5, lastDay),
    },
  ];

  const consultations = 1 + (random() < 0.45 * season ? 1 : 0);
  for (let i = 0; i < consultations; i++) {
    drafts.push({
      category: CATEGORY.consultation,
      description: pick(random, [
        'Consulta de medicina general',
        'Consulta de control',
        'Consulta de especialidad',
      ]),
      providerTenant: pick(random, [TENANT_CONSULTORIO, TENANT_CLINICA, TENANT_HOSPITAL]),
      gross: roundTo(between(random, 180, 320) * growth, 10),
      coveredRatio: 0.5,
      discountRatio: 0,
      day: day(),
    });
  }

  const purchases = 1 + Math.floor(random() * 3 * season);
  for (let i = 0; i < purchases; i++) {
    drafts.push({
      category: CATEGORY.pharmacy,
      description: pick(random, [
        'Compra de medicamentos',
        'Medicamentos de la receta',
        'Productos de farmacia',
      ]),
      providerTenant: TENANT_FARMACIA,
      gross: between(random, 45, 360) * growth * season,
      coveredRatio: 0,
      discountRatio: random() < 0.35 ? 0.1 : 0,
      day: day(),
    });
  }

  if (random() < 0.45) {
    drafts.push({
      category: CATEGORY.laboratory,
      description: pick(random, ['Hemograma y química sanguínea', 'Perfil lipídico', 'Examen general de orina']),
      providerTenant: TENANT_LABORATORIO,
      gross: roundTo(between(random, 120, 480) * growth, 5),
      coveredRatio: 0.4,
      discountRatio: 0,
      day: day(),
    });
  }

  if (random() < 0.18) {
    drafts.push({
      category: CATEGORY.imaging,
      description: pick(random, ['Ecografía', 'Radiografía de tórax', 'Tomografía']),
      providerTenant: TENANT_HOSPITAL,
      gross: roundTo(between(random, 350, 950) * growth, 10),
      coveredRatio: 0.5,
      discountRatio: 0,
      day: day(),
    });
  }

  if (random() < 0.07) {
    drafts.push({
      category: CATEGORY.procedure,
      description: 'Procedimiento ambulatorio',
      providerTenant: TENANT_CLINICA,
      gross: roundTo(between(random, 900, 2800) * growth, 50),
      coveredRatio: 0.7,
      discountRatio: 0,
      day: day(),
    });
  }

  return drafts;
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function amount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function localDate(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function toMovement(
  patientProfileId: string,
  year: number,
  monthIndex: number,
  draft: MovementDraft,
  index: number,
): SpendingMovementDto {
  const grossCents = toCents(draft.gross);
  const coveredCents = Math.round(grossCents * draft.coveredRatio);
  const discountCents = Math.round((grossCents - coveredCents) * draft.discountRatio);
  const hour = 8 + ((index * 3 + draft.day) % 11);
  const occurredAt = new Date(year, monthIndex, draft.day, hour, 15).toISOString();
  return {
    id: uuid(`spending:${patientProfileId}:${year}-${monthIndex + 1}:${index}`),
    occurredAt,
    description: draft.description,
    category: draft.category,
    providerName: TENANT_NAMES[draft.providerTenant] ?? null,
    grossAmount: amount(grossCents),
    coveredAmount: amount(coveredCents),
    discountAmount: amount(discountCents),
    paidAmount: amount(grossCents - coveredCents - discountCents),
  };
}

/**
 * Los movimientos del paciente entre `from` y `to` (inclusive), del más
 * reciente al más antiguo. Nada posterior a hoy: el futuro no se gastó.
 */
export function spendingMovementsFor(
  patientProfileId: string,
  from: string,
  to: string,
  today: Date = hoy(),
): readonly SpendingMovementDto[] {
  const todayKey = localDate(today.getFullYear(), today.getMonth(), today.getDate());
  const upper = to < todayKey ? to : todayKey;
  const [fromYear, fromMonth] = from.split('-').map(Number) as [number, number];
  const [toYear, toMonth] = upper.split('-').map(Number) as [number, number];
  const baseYear = today.getFullYear() - 1;
  const movements: SpendingMovementDto[] = [];

  for (let year = fromYear; year <= toYear; year++) {
    const firstMonth = year === fromYear ? fromMonth - 1 : 0;
    const lastMonth = year === toYear ? toMonth - 1 : 11;
    for (let monthIndex = firstMonth; monthIndex <= lastMonth; monthIndex++) {
      draftsForMonth(patientProfileId, year, monthIndex, baseYear).forEach((draft, index) => {
        const dateKey = localDate(year, monthIndex, draft.day);
        if (dateKey < from || dateKey > upper) return;
        movements.push(toMovement(patientProfileId, year, monthIndex, draft, index));
      });
    }
  }

  return movements.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

function rangeDays(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000;
}

export function registerPatientSpending(router: MockRouter): void {
  router.get('/patient-spending/me', ({ user, query }) => {
    if (user?.patientProfileId === undefined) {
      return preconditionFailed('La cuenta no tiene perfil de paciente');
    }
    const from = query.get('from') ?? '';
    const to = query.get('to') ?? '';
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return validation('`from` y `to` son obligatorios, con formato YYYY-MM-DD');
    }
    if (from > to) {
      return validation('`from` no puede ser posterior a `to`');
    }
    if (rangeDays(from, to) > MAX_RANGE_DAYS) {
      return validation('El rango no puede superar los tres años');
    }
    return {
      currency: CURRENCY,
      from,
      to,
      items: spendingMovementsFor(user.patientProfileId, from, to),
    } satisfies PatientSpendingResponseDto;
  });
}
