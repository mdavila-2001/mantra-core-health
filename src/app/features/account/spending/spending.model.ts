import type {
  PatientSpendingResponseDto,
  SpendingMovementDto,
} from '@core/data-access/patient-spending/patient-spending.dto';
import { displayCurrency } from '@core/money/display-currency';
import type { NavIconName } from '@shared/components/atoms/nav-icon/nav-icon.types';

/* ============================================================================
    El tablero de «Mis gastos», como funciones puras sobre la lista de
    movimientos.

    ## Comparaciones justas

    El mes en curso está a medias. Compararlo con el mes anterior **entero**
    haría que todo mes pareciera más barato hasta el día 30. Por eso los deltas
    comparan contra **el mismo tramo** del período anterior: del 1 al día de hoy
    del mes pasado, y del 1 de enero al día de hoy del año pasado. Los totales
    completos del mes y del año anterior se muestran igual, en su propia
    tarjeta, sin delta que los tuerza.

    ## Dinero en centavos

    Los importes llegan como texto decimal exacto. Se pasan a centavos enteros
    una sola vez, al entrar, y toda suma es entera: 0,1 + 0,2 no se equivoca.
    ========================================================================== */

/** Presentación de cada categoría del contrato: rótulo en castellano e ícono. */
const CATEGORY_PRESENTATION: Readonly<Record<string, { label: string; icon: NavIconName }>> = {
  SPEND_CONSULTATION: { label: 'Consultas', icon: 'stethoscope' },
  SPEND_PHARMACY: { label: 'Farmacia', icon: 'pill' },
  SPEND_LABORATORY: { label: 'Laboratorio', icon: 'flask' },
  SPEND_IMAGING: { label: 'Imagenología', icon: 'scan' },
  SPEND_PROCEDURE: { label: 'Procedimientos', icon: 'scalpel' },
  SPEND_INSURANCE_PREMIUM: { label: 'Seguro de salud', icon: 'umbrella' },
};

const FALLBACK_ICON: NavIconName = 'folder';

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Cuántos proveedores muestra «Dónde gastás más». */
const TOP_PROVIDERS = 4;
/** Cuántos movimientos muestra «Últimos movimientos». */
const RECENT_MOVEMENTS = 8;
/** Meses de la tendencia del mes en curso (incluido). */
const TREND_MONTHS = 12;

export interface SpendingMovement {
  readonly id: string;
  readonly occurredAt: Date;
  readonly description: string;
  readonly categoryCode: string;
  readonly categoryLabel: string;
  readonly categoryIcon: NavIconName;
  readonly providerName: string | null;
  readonly grossCents: number;
  readonly coveredCents: number;
  readonly discountCents: number;
  readonly paidCents: number;
}

/** Una cifra contra la del período con que se compara. */
export interface Comparison {
  readonly cents: number;
  readonly previousCents: number;
  /** Variación relativa (0,12 = +12 %); `null` si antes no hubo gasto. */
  readonly ratio: number | null;
}

export interface CategoryShare {
  readonly code: string;
  readonly label: string;
  readonly icon: NavIconName;
  readonly cents: number;
  /** Parte del total del período, de 0 a 1. */
  readonly share: number;
  readonly comparison: Comparison;
}

export interface ProviderTotal {
  readonly name: string;
  readonly cents: number;
  readonly count: number;
}

export interface MonthPoint {
  /** 0 = enero. */
  readonly monthIndex: number;
  readonly label: string;
  readonly shortLabel: string;
  /** `null` para los meses que todavía no llegaron. */
  readonly currentCents: number | null;
  readonly previousCents: number;
}

export interface TrendPoint {
  readonly label: string;
  readonly cents: number;
}

export interface SpendingDashboard {
  readonly currencyLabel: string;
  readonly currentYear: number;
  readonly previousYear: number;
  readonly currentMonthLabel: string;
  readonly previousMonthLabel: string;
  readonly dayOfMonth: number;
  /** Este mes, contra el mismo tramo del mes anterior. */
  readonly thisMonth: Comparison;
  /** El mes anterior completo, contra el mes que lo precedió. */
  readonly previousMonth: Comparison;
  /** Lo que va del año, contra el mismo tramo del año pasado. */
  readonly yearToDate: Comparison;
  readonly previousYearTotalCents: number;
  readonly monthlyAverageCents: number;
  /** Al ritmo actual, cuánto cerraría el año. */
  readonly projectedYearCents: number;
  /** En el año: lo que costó, lo que cubrió el seguro y lo que se descontó. */
  readonly yearGrossCents: number;
  readonly yearCoveredCents: number;
  readonly yearDiscountCents: number;
  readonly months: readonly MonthPoint[];
  readonly trend: readonly TrendPoint[];
  readonly categoriesThisMonth: readonly CategoryShare[];
  readonly categoriesThisYear: readonly CategoryShare[];
  readonly topProviders: readonly ProviderTotal[];
  readonly biggestThisYear: SpendingMovement | null;
  readonly movementsThisYear: number;
  readonly recent: readonly SpendingMovement[];
}

/* ---- entrada ------------------------------------------------------------- */

function toCents(amount: string): number {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function movementFromContract(dto: SpendingMovementDto): SpendingMovement {
  const presentation = CATEGORY_PRESENTATION[dto.category.code];
  return {
    id: dto.id,
    occurredAt: new Date(dto.occurredAt),
    description: dto.description,
    categoryCode: dto.category.code,
    categoryLabel: presentation?.label ?? dto.category.display,
    categoryIcon: presentation?.icon ?? FALLBACK_ICON,
    providerName: dto.providerName,
    grossCents: toCents(dto.grossAmount),
    coveredCents: toCents(dto.coveredAmount),
    discountCents: toCents(dto.discountAmount),
    paidCents: toCents(dto.paidAmount),
  };
}

/* ---- rangos -------------------------------------------------------------- */

function isoDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** El rango que el tablero pide: del 1 de enero del año pasado a hoy. */
export function requestedRange(today: Date): { readonly from: string; readonly to: string } {
  return { from: `${today.getFullYear() - 1}-01-01`, to: isoDate(today) };
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Inicio del día `day` del mes, recortado al último día si ese mes es más corto. */
function dayStart(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex)));
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function within(movement: SpendingMovement, from: Date, to: Date): boolean {
  const time = movement.occurredAt.getTime();
  return time >= from.getTime() && time <= to.getTime();
}

/* ---- agregados ----------------------------------------------------------- */

function sumPaid(movements: readonly SpendingMovement[]): number {
  return movements.reduce((total, movement) => total + movement.paidCents, 0);
}

function compare(cents: number, previousCents: number): Comparison {
  return {
    cents,
    previousCents,
    ratio: previousCents === 0 ? null : (cents - previousCents) / previousCents,
  };
}

function inRange(movements: readonly SpendingMovement[], from: Date, to: Date): SpendingMovement[] {
  return movements.filter((movement) => within(movement, from, to));
}

function categoryShares(
  current: readonly SpendingMovement[],
  previous: readonly SpendingMovement[],
): readonly CategoryShare[] {
  const total = sumPaid(current);
  const codes = new Set([...current, ...previous].map((movement) => movement.categoryCode));
  const shares = [...codes].map((code) => {
    const mine = current.filter((movement) => movement.categoryCode === code);
    const before = previous.filter((movement) => movement.categoryCode === code);
    const sample = mine[0] ?? before[0]!;
    const cents = sumPaid(mine);
    return {
      code,
      label: sample.categoryLabel,
      icon: sample.categoryIcon,
      cents,
      share: total === 0 ? 0 : cents / total,
      comparison: compare(cents, sumPaid(before)),
    };
  });
  return shares
    .filter((share) => share.cents > 0 || share.comparison.previousCents > 0)
    .sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));
}

function providerTotals(movements: readonly SpendingMovement[]): readonly ProviderTotal[] {
  const byName = new Map<string, { cents: number; count: number }>();
  for (const movement of movements) {
    if (movement.providerName === null) continue;
    const entry = byName.get(movement.providerName) ?? { cents: 0, count: 0 };
    byName.set(movement.providerName, {
      cents: entry.cents + movement.paidCents,
      count: entry.count + 1,
    });
  }
  return [...byName.entries()]
    .map(([name, entry]) => ({ name, ...entry }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, TOP_PROVIDERS);
}

function monthLabel(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

function shortMonth(monthIndex: number): string {
  return MONTH_NAMES[monthIndex]!.slice(0, 3);
}

function monthTotal(
  movements: readonly SpendingMovement[],
  year: number,
  monthIndex: number,
): number {
  return sumPaid(
    movements.filter(
      (movement) =>
        movement.occurredAt.getFullYear() === year && movement.occurredAt.getMonth() === monthIndex,
    ),
  );
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000) + 1;
}

function daysInYear(year: number): number {
  return dayOfYear(new Date(year, 11, 31));
}

/**
 * Arma el tablero completo a partir de la respuesta del contrato.
 *
 * `today` se inyecta para que las pruebas no dependan del reloj.
 */
export function buildDashboard(
  response: PatientSpendingResponseDto,
  today: Date,
): SpendingDashboard {
  const movements = response.items.map(movementFromContract);
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  const todayEnd = endOfDay(today);

  const prevMonthYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevPrevMonthYear = prevMonth === 0 ? prevMonthYear - 1 : prevMonthYear;
  const prevPrevMonth = prevMonth === 0 ? 11 : prevMonth - 1;

  const thisMonthMovements = inRange(movements, new Date(year, month, 1), todayEnd);
  const prevMonthSameSpan = inRange(
    movements,
    new Date(prevMonthYear, prevMonth, 1),
    endOfDay(dayStart(prevMonthYear, prevMonth, day)),
  );
  const yearMovements = inRange(movements, new Date(year, 0, 1), todayEnd);
  const lastYearSameSpan = inRange(
    movements,
    new Date(year - 1, 0, 1),
    endOfDay(dayStart(year - 1, month, day)),
  );
  const lastYearMovements = inRange(movements, new Date(year - 1, 0, 1), endOfDay(new Date(year - 1, 11, 31)));

  const ytdCents = sumPaid(yearMovements);
  const biggest = yearMovements.reduce<SpendingMovement | null>(
    (max, movement) => (max === null || movement.paidCents > max.paidCents ? movement : max),
    null,
  );

  const trend: TrendPoint[] = [];
  for (let offset = TREND_MONTHS - 1; offset >= 0; offset--) {
    const point = new Date(year, month - offset, 1);
    trend.push({
      label: monthLabel(point.getFullYear(), point.getMonth()),
      cents: monthTotal(movements, point.getFullYear(), point.getMonth()),
    });
  }

  return {
    currencyLabel: displayCurrency(response.currency),
    currentYear: year,
    previousYear: year - 1,
    currentMonthLabel: monthLabel(year, month),
    previousMonthLabel: monthLabel(prevMonthYear, prevMonth),
    dayOfMonth: day,
    thisMonth: compare(sumPaid(thisMonthMovements), sumPaid(prevMonthSameSpan)),
    previousMonth: compare(
      monthTotal(movements, prevMonthYear, prevMonth),
      monthTotal(movements, prevPrevMonthYear, prevPrevMonth),
    ),
    yearToDate: compare(ytdCents, sumPaid(lastYearSameSpan)),
    previousYearTotalCents: sumPaid(lastYearMovements),
    monthlyAverageCents: Math.round(ytdCents / (month + 1)),
    projectedYearCents: Math.round((ytdCents / dayOfYear(today)) * daysInYear(year)),
    yearGrossCents: yearMovements.reduce((total, m) => total + m.grossCents, 0),
    yearCoveredCents: yearMovements.reduce((total, m) => total + m.coveredCents, 0),
    yearDiscountCents: yearMovements.reduce((total, m) => total + m.discountCents, 0),
    months: MONTH_NAMES.map((_, monthIndex) => ({
      monthIndex,
      label: MONTH_NAMES[monthIndex]!,
      shortLabel: shortMonth(monthIndex),
      currentCents: monthIndex > month ? null : monthTotal(movements, year, monthIndex),
      previousCents: monthTotal(movements, year - 1, monthIndex),
    })),
    trend,
    categoriesThisMonth: categoryShares(thisMonthMovements, prevMonthSameSpan),
    categoriesThisYear: categoryShares(yearMovements, lastYearSameSpan),
    topProviders: providerTotals(yearMovements),
    biggestThisYear: biggest,
    movementsThisYear: yearMovements.length,
    recent: movements.slice(0, RECENT_MOVEMENTS),
  };
}

/* ---- formato ------------------------------------------------------------- */

const MONEY = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WHOLE = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });

/** «Bs 1.234,50». */
export function formatMoney(cents: number, currencyLabel: string): string {
  return `${currencyLabel} ${MONEY.format(cents / 100)}`;
}

/** «Bs 1.235»: para cifras grandes donde los centavos son ruido. */
export function formatWholeMoney(cents: number, currencyLabel: string): string {
  return `${currencyLabel} ${WHOLE.format(Math.round(cents / 100))}`;
}

/**
 * «38 %», con el espacio que pide la norma del castellano. A mano y no con
 * `Intl` en estilo `percent`: ese espacio depende del ICU de cada motor, y el
 * servidor SSR y el navegador no siempre coinciden.
 */
export function formatShare(ratio: number): string {
  return `${WHOLE.format(Math.round(ratio * 100))} %`;
}

export type DeltaDirection = 'up' | 'down' | 'flat' | 'new';

/** Menos de medio punto porcentual se lee como «igual». */
const FLAT_THRESHOLD = 0.005;

export function deltaDirection(comparison: Comparison): DeltaDirection {
  if (comparison.ratio === null) return comparison.cents === 0 ? 'flat' : 'new';
  if (Math.abs(comparison.ratio) < FLAT_THRESHOLD) return 'flat';
  return comparison.ratio > 0 ? 'up' : 'down';
}

/**
 * La variación en palabras, para verla y para el lector de pantalla:
 * «12 % más que …», «8 % menos que …», «Igual que …», «Sin gasto en …».
 */
export function describeDelta(comparison: Comparison, against: string): string {
  switch (deltaDirection(comparison)) {
    case 'up':
      return `${formatShare(comparison.ratio!)} más que ${against}`;
    case 'down':
      return `${formatShare(-comparison.ratio!)} menos que ${against}`;
    case 'new':
      return `Sin gasto en ${against}`;
    default:
      return `Igual que ${against}`;
  }
}
