import type {
  CatalogService,
  LocationNode,
  SupportAgenda,
  SupportAgendaItem,
} from '../../../core/data-access/support-access/support-access.types';
import {
  isReservedBlock,
  RESERVED_BLOCK_LABEL,
} from '../../../core/access-challenge/access-challenge';
import { DOCTOR_COLOR_FAMILIES, clock, isVisible } from './agenda-grouping';

/**
 * El modelo de la agenda combinada: lo que las tres vistas (día, semana y línea
 * de tiempo) comparten. Lógica **pura**, sin Angular ni red, para que se pruebe
 * sin montar nada.
 *
 * Una persona puede ayudar en varias organizaciones. La API responde una agenda
 * por organización; acá se **unen** y cada evento recuerda de cuál viene
 * (`orgId`, `orgShort`), porque toda acción tiene que decir en qué organización
 * se actúa.
 */

export type AgendaViewKind = 'DAY' | 'WEEK' | 'TIMELINE';

/** Una organización donde la persona trabaja, con lo que se necesita para rotular sus eventos. */
export interface AgendaOrg {
  readonly id: string;
  readonly name: string;
  /**
   * Si algún permiso del vínculo en esta organización incluye una acción de agenda (`schedule.*`).
   * Sin ninguno, la API **no** responde 403: devuelve la lista vacía. Ausente = no se sabe.
   */
  readonly scheduleAccess?: boolean;
  /** Iniciales para la insignia del evento: «HPM». */
  readonly short: string;
  /** Posición en la lista: elige el color de la insignia. */
  readonly tone: number;
}

export interface AgendaDoctor {
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  readonly orgId: string;
}

/** Un horario o una cita de la agenda, con la organización de la que viene. */
export interface AgendaEvent extends SupportAgendaItem {
  readonly orgId: string;
  readonly orgName: string;
  readonly orgShort: string;
  readonly orgTone: number;
  readonly doctorName: string;
  /** La asignación de rol del doctor (lo que piden las aprobaciones y el «¿por qué no puedo?»); ausente si el catálogo no la dio. */
  readonly roleAssignmentId?: string;
}

export interface AgendaData {
  readonly orgs: readonly AgendaOrg[];
  readonly doctors: readonly AgendaDoctor[];
  readonly services: readonly (CatalogService & { readonly orgId: string })[];
  readonly locations: readonly (LocationNode & { readonly orgId: string })[];
  readonly events: readonly AgendaEvent[];
}

const PALABRAS_VACIAS = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'y',
  'dr',
  'dra',
  'dr.',
  'dra.',
]);

/** «Hospital Piloto Mantra» → «HPM». Sin artículos ni tratamientos. */
export function orgShortName(name: string): string {
  const iniciales = name
    .split(/\s+/)
    .filter((w) => w !== '' && !PALABRAS_VACIAS.has(w.toLocaleLowerCase('es')))
    .slice(0, 3)
    .map((w) => w[0]!.toLocaleUpperCase('es'))
    .join('');
  return iniciales === '' ? name.slice(0, 3).toLocaleUpperCase('es') : iniciales;
}

/** Si algún permiso vigente del vínculo incluye una acción de agenda. Sin ninguna, la agenda llega vacía (no 403). */
export function hasScheduleAccess(
  grants: readonly { readonly status: string; readonly actions: readonly string[] }[],
): boolean {
  return grants.some(
    (g) => g.status === 'ACTIVE' && g.actions.some((a) => a.startsWith('schedule.')),
  );
}

export function makeOrg(
  id: string,
  name: string,
  tone: number,
  scheduleAccess?: boolean,
): AgendaOrg {
  return {
    id,
    name,
    short: orgShortName(name),
    tone,
    ...(scheduleAccess === undefined ? {} : { scheduleAccess }),
  };
}

/** Une las agendas de varias organizaciones en una sola. */
function doctorDe(
  agenda: SupportAgenda,
  item: SupportAgendaItem,
): SupportAgenda['doctors'][number] | undefined {
  return agenda.doctors.find((d) => d.id === item.practitionerRoleAssignmentId);
}

export function mergeAgendas(
  parts: readonly { readonly org: AgendaOrg; readonly agenda: SupportAgenda }[],
): AgendaData {
  const doctors: AgendaDoctor[] = [];
  const events: AgendaEvent[] = [];
  const services: (CatalogService & { orgId: string })[] = [];
  const locations: (LocationNode & { orgId: string })[] = [];
  for (const { org, agenda } of parts) {
    for (const d of agenda.doctors) doctors.push({ ...d, orgId: org.id });
    for (const s of agenda.services) services.push({ ...s, orgId: org.id });
    for (const l of agenda.locations) locations.push({ ...l, orgId: org.id });
    for (const item of agenda.items) {
      events.push({
        ...item,
        orgId: org.id,
        orgName: org.name,
        orgShort: org.short,
        orgTone: org.tone,
        doctorName:
          agenda.doctors.find((d) => d.id === item.practitionerRoleAssignmentId)?.name ?? 'Doctor',
        ...(doctorDe(agenda, item)?.roleAssignmentId === undefined
          ? {}
          : { roleAssignmentId: doctorDe(agenda, item)!.roleAssignmentId! }),
      });
    }
  }
  return { orgs: parts.map((p) => p.org), doctors, services, locations, events };
}

/* ---- colores ------------------------------------------------------------------- */

/** El color de un doctor: estable según su posición en «Mis doctores» (todas las organizaciones juntas). */
export function colorOfDoctor(
  doctors: readonly AgendaDoctor[],
  doctorId: string,
): {
  readonly family: string;
  readonly bg: string;
  readonly border: string;
  readonly index: number;
} {
  const index = Math.max(
    0,
    doctors.findIndex((d) => d.id === doctorId),
  );
  const family = DOCTOR_COLOR_FAMILIES[index % DOCTOR_COLOR_FAMILIES.length]!;
  return { family, bg: `var(--c-${family}-100)`, border: `var(--c-${family}-600)`, index };
}

export const ORG_TONES: readonly string[] = ['petrol', 'amber', 'sage', 'info'];

export function orgToneColors(tone: number): { readonly bg: string; readonly fg: string } {
  const family = ORG_TONES[tone % ORG_TONES.length]!;
  return { bg: `var(--c-${family}-700)`, fg: 'var(--c-neutral-50)' };
}

/* ---- fechas -------------------------------------------------------------------- */

const DIA_EN_MS = 24 * 60 * 60 * 1000;

export function addDays(day: Date, days: number): Date {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);
  return d;
}

export function startOfDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

/** El lunes de la semana de ese día (la semana boliviana empieza el lunes). */
export function startOfWeek(day: Date): Date {
  const offset = (day.getDay() + 6) % 7;
  return addDays(day, -offset);
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `YYYY-MM-DD` en hora local. */
export function toDayKey(day: Date): string {
  const mm = String(day.getMonth() + 1).padStart(2, '0');
  const dd = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${mm}-${dd}`;
}

/** Lee `YYYY-MM-DD` como día local; `null` si no es una fecha real. */
export function fromDayKey(key: string | null): Date | null {
  if (key === null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (match === null) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const day = new Date(y, m - 1, d);
  return day.getFullYear() === y && day.getMonth() === m - 1 && day.getDate() === d ? day : null;
}

/** El día local de un instante ISO, como `YYYY-MM-DD`. */
export function dayKeyOf(instant: string): string {
  return toDayKey(new Date(instant));
}

/** Los días que cubre la vista: uno (día), siete desde el lunes (semana) o los de la línea de tiempo. */
export function daysOf(kind: AgendaViewKind, anchor: Date, timelineSpan: 1 | 7): readonly Date[] {
  const sieteDias = kind === 'WEEK' || (kind === 'TIMELINE' && timelineSpan === 7);
  if (!sieteDias) return [startOfDay(anchor)];
  const lunes = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
}

/** Inicio y fin, como ISO, para pedir a la API exactamente los días que se ven. */
export function boundsOf(days: readonly Date[]): { readonly from: string; readonly to: string } {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  return {
    from: new Date(
      first.getFullYear(),
      first.getMonth(),
      first.getDate(),
      0,
      0,
      0,
      0,
    ).toISOString(),
    to: new Date(
      last.getFullYear(),
      last.getMonth(),
      last.getDate(),
      23,
      59,
      59,
      999,
    ).toISOString(),
  };
}

/** Cuántos días hay entre dos días locales (positivo si `b` es posterior). */
export function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DIA_EN_MS);
}

export function titleOf(kind: AgendaViewKind, days: readonly Date[]): string {
  const first = days[0]!;
  if (days.length === 1)
    return first.toLocaleDateString('es-BO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  const last = days[days.length - 1]!;
  const mismoMes = first.getMonth() === last.getMonth();
  const desde = first.toLocaleDateString(
    'es-BO',
    mismoMes ? { day: 'numeric' } : { day: 'numeric', month: 'short' },
  );
  const hasta = last.toLocaleDateString('es-BO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${desde} – ${hasta}`;
}

/* ---- tiempo dentro del día ------------------------------------------------------ */

export function minutesOfDay(instant: string): number {
  const d = new Date(instant);
  return d.getHours() * 60 + d.getMinutes();
}

/** La ventana de horas visible: desde la primera hora con algo hasta la última, redondeadas a la hora. */
export interface TimeWindow {
  readonly startMin: number;
  readonly endMin: number;
}

const VENTANA_POR_DEFECTO: TimeWindow = { startMin: 8 * 60, endMin: 18 * 60 };

export function windowFor(events: readonly SupportAgendaItem[]): TimeWindow {
  if (events.length === 0) return VENTANA_POR_DEFECTO;
  let min = Infinity;
  let max = -Infinity;
  for (const e of events) {
    min = Math.min(min, minutesOfDay(e.start));
    const fin = minutesOfDay(e.end);
    // Un horario que termina pasada la medianoche (o justo a las 00:00) cuenta como el final del día.
    max = Math.max(max, fin <= minutesOfDay(e.start) ? 24 * 60 : fin);
  }
  const startMin = Math.max(0, Math.floor(min / 60) * 60 - 0);
  const endMin = Math.min(24 * 60, Math.ceil(max / 60) * 60);
  return endMin - startMin < 4 * 60
    ? { startMin, endMin: Math.min(24 * 60, startMin + 4 * 60) }
    : { startMin, endMin };
}

/** Un evento ya ubicado en una columna vertical: su posición y su carril (para los que se pisan). */
export interface PlacedEvent {
  readonly event: AgendaEvent;
  readonly top: number;
  readonly height: number;
  readonly lane: number;
  readonly lanes: number;
}

const ALTO_MINIMO_PX = 22;

/**
 * Reparte los eventos de una columna en **carriles**, como Google Calendar: los
 * que se pisan en el tiempo quedan lado a lado y los demás ocupan todo el ancho.
 */
export function layoutColumn(
  events: readonly AgendaEvent[],
  window: TimeWindow,
  pxPerMinute: number,
): readonly PlacedEvent[] {
  const ordenados = [...events].sort(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
  );
  const asignados = assignLanes(
    ordenados,
    (e) => new Date(e.start).getTime(),
    (e) => new Date(e.end).getTime(),
  );
  return asignados.map(({ item, lane, lanes }) => {
    const inicio = minutesOfDay(item.start);
    const fin = minutesOfDay(item.end);
    const duracion = fin > inicio ? fin - inicio : 30;
    return {
      event: item,
      top: (inicio - window.startMin) * pxPerMinute,
      height: Math.max(duracion * pxPerMinute, ALTO_MINIMO_PX),
      lane,
      lanes,
    };
  });
}

/**
 * Carriles para intervalos: cada grupo de intervalos que se pisan encadenados
 * comparte el mismo número de carriles. Asigna el primer carril libre.
 */
export function assignLanes<T>(
  sorted: readonly T[],
  startOf: (item: T) => number,
  endOf: (item: T) => number,
): readonly { readonly item: T; readonly lane: number; readonly lanes: number }[] {
  const result: { item: T; lane: number; lanes: number }[] = [];
  let grupo: { item: T; lane: number; lanes: number }[] = [];
  let carriles: number[] = [];
  let finDelGrupo = -Infinity;

  const cerrar = (): void => {
    const total = Math.max(1, carriles.length);
    for (const g of grupo) g.lanes = total;
    result.push(...grupo);
    grupo = [];
    carriles = [];
    finDelGrupo = -Infinity;
  };

  for (const item of sorted) {
    const inicio = startOf(item);
    const fin = Math.max(endOf(item), inicio + 1);
    if (grupo.length > 0 && inicio >= finDelGrupo) cerrar();
    let lane = carriles.findIndex((finDelCarril) => finDelCarril <= inicio);
    if (lane === -1) {
      lane = carriles.length;
      carriles.push(fin);
    } else {
      carriles[lane] = fin;
    }
    grupo.push({ item, lane, lanes: 1 });
    finDelGrupo = Math.max(finDelGrupo, fin);
  }
  cerrar();
  return result;
}

/* ---- ocupación ----------------------------------------------------------------- */

export interface Occupancy {
  /** Minutos con una cita. */
  readonly bookedMin: number;
  /** Minutos que siguen libres. */
  readonly freeMin: number;
  readonly totalMin: number;
  /** Cuántos horarios tienen una cita y cuántos hay en total (los que se pueden ver). */
  readonly bookedCount: number;
  readonly totalCount: number;
  /** 0–100, redondeado. 0 si no hay nada que medir. */
  readonly percent: number;
}

const OCUPADOS = new Set<SupportAgendaItem['status']>(['BOOKED', 'CONFIRMED', 'CHECKED_IN']);

export function isBooked(item: SupportAgendaItem): boolean {
  return OCUPADOS.has(item.status);
}

/** La ocupación de un conjunto de horarios. Los que no se pueden ver no cuentan: no se sabe qué hay. */
export function occupancyOf(events: readonly SupportAgendaItem[]): Occupancy {
  let bookedMin = 0;
  let freeMin = 0;
  let bookedCount = 0;
  let totalCount = 0;
  for (const e of events) {
    if (!isVisible(e) || e.status === 'CANCELLED') continue;
    const minutos = Math.max(0, (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000);
    totalCount += 1;
    if (isBooked(e)) {
      bookedMin += minutos;
      bookedCount += 1;
    } else freeMin += minutos;
  }
  const totalMin = bookedMin + freeMin;
  return {
    bookedMin,
    freeMin,
    totalMin,
    bookedCount,
    totalCount,
    percent: totalMin === 0 ? 0 : Math.round((bookedMin / totalMin) * 100),
  };
}

/** La ocupación hora por hora, para la franja de calor de la línea de tiempo. */
export interface HourHeat {
  /** Posición de la hora en el eje: día y hora desde el inicio de la ventana. */
  readonly dayIndex: number;
  readonly hour: number;
  readonly percent: number;
  /** 0 = nada que medir; 1–4 = de poco a muy ocupado. */
  readonly level: 0 | 1 | 2 | 3 | 4;
}

export function hourlyHeat(
  events: readonly AgendaEvent[],
  days: readonly Date[],
  window: TimeWindow,
): readonly HourHeat[] {
  const celdas: HourHeat[] = [];
  const keys = days.map((d) => toDayKey(d));
  keys.forEach((key, dayIndex) => {
    const delDia = events.filter((e) => dayKeyOf(e.start) === key);
    for (let m = window.startMin; m < window.endMin; m += 60) {
      const enLaHora = delDia.filter((e) => {
        const inicio = minutesOfDay(e.start);
        return inicio >= m && inicio < m + 60;
      });
      const { percent, totalCount } = occupancyOf(enLaHora);
      const level =
        totalCount === 0 ? 0 : percent < 25 ? 1 : percent < 50 ? 2 : percent < 75 ? 3 : 4;
      celdas.push({ dayIndex, hour: m / 60, percent, level });
    }
  });
  return celdas;
}

/* ---- línea de tiempo ------------------------------------------------------------ */

export interface TimelineBar {
  readonly event: AgendaEvent;
  readonly left: number;
  readonly width: number;
  readonly lane: number;
}

export interface TimelineRow {
  readonly key: string;
  readonly label: string;
  readonly sub?: string;
  readonly lanes: number;
  readonly bars: readonly TimelineBar[];
  readonly occupancy: Occupancy;
}

/**
 * Las barras de una fila de la línea de tiempo. El eje es horizontal: cada día
 * ocupa `dayWidth` píxeles y dentro de él, la ventana de horas.
 */
export function layoutRow(
  events: readonly AgendaEvent[],
  days: readonly Date[],
  window: TimeWindow,
  pxPerMinute: number,
): { readonly bars: readonly TimelineBar[]; readonly lanes: number } {
  const dayWidth = (window.endMin - window.startMin) * pxPerMinute;
  const keys = days.map((d) => toDayKey(d));
  const bars: TimelineBar[] = [];
  let lanes = 1;
  keys.forEach((key, dayIndex) => {
    const delDia = events
      .filter((e) => dayKeyOf(e.start) === key)
      .sort((a, b) => a.start.localeCompare(b.start));
    const asignados = assignLanes(
      delDia,
      (e) => new Date(e.start).getTime(),
      (e) => new Date(e.end).getTime(),
    );
    for (const { item, lane } of asignados) {
      lanes = Math.max(lanes, lane + 1);
      const inicio = minutesOfDay(item.start);
      const fin = minutesOfDay(item.end);
      const duracion = fin > inicio ? fin - inicio : 30;
      bars.push({
        event: item,
        left: dayIndex * dayWidth + (inicio - window.startMin) * pxPerMinute,
        width: Math.max(duracion * pxPerMinute - 1, 6),
        lane,
      });
    }
  });
  return { bars, lanes };
}

/* ---- «ahora» ------------------------------------------------------------------- */

/** Dónde cae el indicador de «ahora» en una columna del día, o `null` si está fuera de la ventana. */
export function nowOffset(
  now: Date,
  day: Date,
  window: TimeWindow,
  pxPerMinute: number,
): number | null {
  if (!sameDay(now, day)) return null;
  const minutos = now.getHours() * 60 + now.getMinutes();
  if (minutos < window.startMin || minutos > window.endMin) return null;
  return (minutos - window.startMin) * pxPerMinute;
}

/* ---- etiquetas ----------------------------------------------------------------- */

export const STATUS_TEXT: Readonly<Record<SupportAgendaItem['status'], string>> = {
  FREE: 'Libre',
  BOOKED: 'Reservada, por confirmar',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'Ya llegó',
  CANCELLED: 'Cancelada',
};

/** El globo de un evento: el motivo de la API si no hay permiso; si lo hay, nada (la etiqueta accesible ya lo dice todo). */
export function eventTooltip(event: SupportAgendaItem): string {
  if (isReservedBlock(event))
    return `${RESERVED_BLOCK_LABEL}: no puede ver el detalle de esta cita. Pulse el bloque para preguntar por qué.`;
  return isVisible(event) ? '' : (event.denialReason ?? 'Sin permiso sobre este horario.');
}

/**
 * Lo que un evento dice en voz alta: hora, quién, dónde, estado y organización.
 * El estado nunca va solo en color.
 */
export function eventLabel(event: AgendaEvent, multiOrg: boolean): string {
  const lugar = [
    `${clock(event.start)} a ${clock(event.end)}`,
    event.doctorName,
    event.careSpaceName,
    event.serviceName,
  ]
    .filter((parte) => parte !== '')
    .join(', ');
  const org = multiOrg ? `, ${event.orgName}` : '';
  if (isReservedBlock(event))
    return `${lugar}${org}. ${RESERVED_BLOCK_LABEL}: no puede ver el detalle de esta cita. Pulse para preguntar por qué`;
  if (!isVisible(event))
    return `${lugar}${org}. Sin permiso: ${event.denialReason ?? 'su permiso no cubre este horario'}`;
  if (event.status === 'FREE') {
    const espera = event.waitlistCount === undefined ? '' : `, ${event.waitlistCount} en espera`;
    return `${lugar}${org}. Horario libre${espera}`;
  }
  return `${lugar}${org}. ${STATUS_TEXT[event.status]}, ${event.patientLabel ?? 'cita'}`;
}
