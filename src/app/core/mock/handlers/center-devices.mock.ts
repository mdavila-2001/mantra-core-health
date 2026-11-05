import { resolveDeviceBlock, resolverHorario, turnosDelDia } from '../../data-access/diagnostic-units/center-schedule.rules';
import type {
  CenterEquipment,
  CenterSchedule,
  EquipmentStatus,
  EquipmentType,
  ScheduleBlock,
  ScheduleOrigin,
  StudyStart,
} from '../../data-access/diagnostic-units/center-schedule.types';
import { modalidadDeEquipo, modalidadDeEstudio } from '../../data-access/diagnostic-units/modalidades';
import { deviceDetails, estadosDeEquipos, PUESTOS_DE_EXTRACCION, registeredDevices, turnosDeOrdenes, type TurnoDeOrdenSimulado } from '../fixtures/centros';
import { uuid } from '../mock-store';
import { equipoDe, type UnidadSimulada } from './diagnostics.handlers';

/* ============================================================================
    The devices of a simulated center as production lines, mirroring the API's
    `center-schedule/` (mantra-core-health-api#1342): every device that gives
    appointments has its own hours (or follows the general schedule), the free
    starts of a study are the union of its modality's operational devices, and
    a booking lands on the first free one.

    Slots booked before devices had lines carry no `equipmentId`: they are
    adopted on the fly by the first operational device that opens then and is
    free. The ones no device can take count as «without equipment».
    ========================================================================== */

/** The catalog a center picks its devices from: the same codes as the API. */
export const EQUIPMENT_TYPES: readonly EquipmentType[] = [
  { code: 'US', label: 'Ecógrafo', modalityCode: 'ECO' },
  { code: 'XR', label: 'Equipo de rayos X', modalityCode: 'RX' },
  { code: 'MR', label: 'Resonador', modalityCode: 'RM' },
  { code: 'CT', label: 'Tomógrafo', modalityCode: 'TC' },
  { code: 'MG', label: 'Mamógrafo', modalityCode: 'MG' },
  { code: 'DX', label: 'Densitómetro', modalityCode: 'DXA' },
  { code: 'SAMPLING', label: 'Puesto de extracción', modalityCode: 'LAB' },
  { code: 'ANALYZER', label: 'Analizador', modalityCode: null },
];

/** A start is no longer offered this close to now. */
const BOOKING_MARGIN_MINUTES = 30;
/** Patients per slot of a modality without devices: the API's declared capacity. */
const DECLARED_CAPACITY = 1;

/** How the API names a device: its type, then make and model. */
const nameOf = (label: string, manufacturer: string | null, model: string | null): string =>
  [label, manufacturer, model].filter(Boolean).join(' ');

/** The glossary term of each device type. */
const GLOSSARY_TERM: Readonly<Record<string, string>> = {
  US: 'equipo-ecografo',
  XR: 'equipo-rayos-x',
  MR: 'equipo-resonador-magnetico',
  CT: 'equipo-tomografo',
  MG: 'equipo-mamografo',
  DX: 'equipo-densitometro-oseo',
  ANALYZER: 'equipo-analizador-de-laboratorio',
  SAMPLING_STATION: 'equipo-puesto-de-extraccion',
  SAMPLING: 'equipo-puesto-de-extraccion',
};

/** The id the glossary serves a term with: the same one `glossary-shards.ts` derives. */
const glossaryConceptOf = (code: string): string | null => {
  const slug = GLOSSARY_TERM[code];
  return slug === undefined ? null : uuid(`concept-glossary-${slug}`);
};

function withDetails(device: CenterEquipment): CenterEquipment | null {
  const detail = deviceDetails.get(device.id);
  if (detail?.removed === true) return null;
  return {
    ...device,
    manufacturer: detail?.manufacturer !== undefined ? detail.manufacturer : device.manufacturer,
    model: detail?.model !== undefined ? detail.model : device.model,
    serialNumber: detail?.serialNumber !== undefined ? detail.serialNumber : (device.serialNumber ?? null),
    status: estadosDeEquipos.get(device.id)?.status ?? device.status,
    schedule: detail?.schedule ?? null,
  };
}

/** Every device of the center with its current status, details and own hours. */
export function devicesOf(u: UnidadSimulada): CenterEquipment[] {
  const seeded = equipoDe(u).map(
    (e): CenterEquipment => ({
      id: e.id,
      name: nameOf(e.type.display, e.manufacturer, e.model),
      typeCode: e.type.code,
      manufacturer: e.manufacturer,
      model: e.model,
      serialNumber: e.serialNumber,
      modalityCode: modalidadDeEquipo(e.type.code),
      status: e.operationalStatus.code as EquipmentStatus,
      glossaryConceptId: glossaryConceptOf(e.type.code),
    }),
  );
  // In a laboratory the slot is limited by the collection stations, not by
  // the analyzers: samples are processed later, in batches.
  const stations =
    u.kind !== 'LABORATORY'
      ? []
      : Array.from({ length: PUESTOS_DE_EXTRACCION }, (_, i): CenterEquipment => ({
          id: uuid(`equipment-${u.id}-puesto-${i}`),
          name: `Puesto de extracción ${i + 1}`,
          typeCode: 'SAMPLING_STATION',
          manufacturer: null,
          model: null,
          modalityCode: 'LAB',
          status: 'OPERATIONAL',
          glossaryConceptId: glossaryConceptOf('SAMPLING_STATION'),
        }));
  const registered = registeredDevices
    .filtrar((d) => d.unitId === u.id)
    .map((d): CenterEquipment => {
      const type = EQUIPMENT_TYPES.find((t) => t.code === d.typeCode);
      return {
        id: d.id,
        name: nameOf(type?.label ?? 'Equipo', d.manufacturer, d.model),
        typeCode: d.typeCode,
        manufacturer: d.manufacturer,
        model: d.model,
        serialNumber: d.serialNumber,
        modalityCode: type?.modalityCode ?? null,
        status: 'OPERATIONAL',
        glossaryConceptId: glossaryConceptOf(d.typeCode),
      };
    });
  return [...stations, ...seeded, ...registered].flatMap((d) => withDetails(d) ?? []);
}

const overlaps = (a: { startAt: string; endAt: string }, start: number, end: number): boolean =>
  new Date(a.startAt).getTime() < end && new Date(a.endAt).getTime() > start;

/** Whether `start` is exactly the start of a slot of the block. */
export function isSlotStart(block: ScheduleBlock, start: Date): boolean {
  return turnosDelDia(block, start).some((t) => t.inicio.getTime() === start.getTime());
}

/**
 * Which device attends each slot of the center: its own when it carries one,
 * otherwise the first operational device of the modality that opens then and
 * is free. `null`: no device can attend it.
 */
export function assignmentsOf(u: UnidadSimulada, schedule: CenterSchedule, devices: readonly CenterEquipment[] = devicesOf(u)): Map<string, string | null> {
  const slots = turnosDeOrdenes.filtrar((t) => t.unitId === u.id);
  const assigned = new Map<string, string | null>(slots.filter((t) => t.equipmentId !== undefined).map((t) => [t.id, t.equipmentId!]));
  const busy = (deviceId: string, t: TurnoDeOrdenSimulado): boolean =>
    slots.some((x) => x.id !== t.id && assigned.get(x.id) === deviceId && overlaps(x, new Date(t.startAt).getTime(), new Date(t.endAt).getTime()));
  const legacy = slots.filter((t) => t.equipmentId === undefined).sort((a, b) => a.startAt.localeCompare(b.startAt));
  for (const t of legacy) {
    const device = devices.find(
      (d) =>
        d.modalityCode === t.modalityCode &&
        d.status === 'OPERATIONAL' &&
        isSlotStart(resolveDeviceBlock(schedule, d, t.studyCode, t.modalityCode).block, new Date(t.startAt)) &&
        !busy(d.id, t),
    );
    assigned.set(t.id, device?.id ?? null);
  }
  return assigned;
}

export interface DeviceAvailability {
  readonly origin: ScheduleOrigin;
  readonly items: readonly StudyStart[];
  /** The free devices at each start, the first one to book. */
  readonly devicesAt: ReadonlyMap<string, readonly string[]>;
}

/** The free starts of a study: the union of the free starts of its modality's operational devices. */
export function freeStarts(u: UnidadSimulada, schedule: CenterSchedule, studyCode: string, from: Date, to: Date): DeviceAvailability {
  const modalityCode = modalidadDeEstudio(studyCode);
  const empty: DeviceAvailability = { origin: 'GENERAL', items: [], devicesAt: new Map() };
  if (modalityCode === null) return empty;
  const devices = devicesOf(u);
  const earliest = Math.max(from.getTime(), Date.now() + BOOKING_MARGIN_MINUTES * 60_000);
  const slots = turnosDeOrdenes.filtrar((t) => t.unitId === u.id);
  if (!devices.some((d) => d.modalityCode === modalityCode)) {
    return declaredStarts(schedule, studyCode, modalityCode, slots, earliest, from, to);
  }
  const operational = devices.filter((d) => d.modalityCode === modalityCode && d.status === 'OPERATIONAL');
  if (operational.length === 0) return empty;
  const assigned = assignmentsOf(u, schedule, devices);
  const open = new Map<string, { endAt: string; open: number; free: string[] }>();
  let origin: ScheduleOrigin = 'GENERAL';
  for (const device of operational) {
    const resolved = resolveDeviceBlock(schedule, device, studyCode, modalityCode);
    origin = resolved.origin;
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    for (; day.getTime() <= to.getTime(); day.setDate(day.getDate() + 1)) {
      for (const { inicio, fin } of turnosDelDia(resolved.block, day)) {
        if (inicio.getTime() < earliest || inicio.getTime() > to.getTime()) continue;
        const key = inicio.toISOString();
        const entry = open.get(key) ?? { endAt: fin.toISOString(), open: 0, free: [] };
        entry.open++;
        const taken = slots.some((t) => assigned.get(t.id) === device.id && overlaps(t, inicio.getTime(), fin.getTime()));
        if (!taken) entry.free.push(device.id);
        open.set(key, entry);
      }
    }
  }
  const starts = [...open.entries()].filter(([, e]) => e.free.length > 0).sort(([a], [b]) => a.localeCompare(b));
  return {
    origin,
    items: starts.map(([startAt, e]) => ({ startAt, endAt: e.endAt, remaining: e.free.length, capacity: e.open })),
    devicesAt: new Map(starts.map(([startAt, e]) => [startAt, e.free])),
  };
}

/** Like the API without devices: the center's own block and its declared capacity, minus its slots. */
function declaredStarts(
  schedule: CenterSchedule,
  studyCode: string,
  modalityCode: NonNullable<ReturnType<typeof modalidadDeEstudio>>,
  slots: readonly TurnoDeOrdenSimulado[],
  earliest: number,
  from: Date,
  to: Date,
): DeviceAvailability {
  const { block, origin } = resolverHorario(schedule, studyCode, modalityCode);
  const items: StudyStart[] = [];
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (; day.getTime() <= to.getTime(); day.setDate(day.getDate() + 1)) {
    for (const { inicio, fin } of turnosDelDia(block, day)) {
      if (inicio.getTime() < earliest || inicio.getTime() > to.getTime()) continue;
      const taken = slots.filter((t) => t.modalityCode === modalityCode && overlaps(t, inicio.getTime(), fin.getTime())).length;
      const remaining = DECLARED_CAPACITY - taken;
      if (remaining > 0) items.push({ startAt: inicio.toISOString(), endAt: fin.toISOString(), remaining, capacity: DECLARED_CAPACITY });
    }
  }
  return { origin, items, devicesAt: new Map() };
}

/** Future slots left without an operational device: on a device that is down, or that none could adopt. */
export function bookingsWithoutDevice(u: UnidadSimulada, schedule: CenterSchedule): number {
  const devices = devicesOf(u);
  const assigned = assignmentsOf(u, schedule, devices);
  const now = Date.now();
  return turnosDeOrdenes
    .filtrar((t) => t.unitId === u.id && new Date(t.startAt).getTime() > now)
    .filter((t) => {
      const deviceId = assigned.get(t.id) ?? null;
      // A modality without devices books on the declared quota: nothing is missing.
      if (deviceId === null) return devices.some((d) => d.modalityCode === t.modalityCode);
      return devices.find((d) => d.id === deviceId)?.status !== 'OPERATIONAL';
    }).length;
}

/**
 * Future slots that would not start on a slot of their device (or of the new
 * schedule, without one). `assigned` fixes who attends each slot before the
 * change, like the API adopts legacy slots before checking.
 */
export function bookingsOutsideSchedule(
  u: UnidadSimulada,
  schedule: CenterSchedule,
  onlyDevice?: string,
  assigned: ReadonlyMap<string, string | null> = assignmentsOf(u, schedule),
): number {
  const devices = devicesOf(u);
  const now = Date.now();
  return turnosDeOrdenes
    .filtrar((t) => t.unitId === u.id && new Date(t.startAt).getTime() > now)
    .filter((t) => onlyDevice === undefined || assigned.get(t.id) === onlyDevice)
    .filter((t) => {
      const device = devices.find((d) => d.id === assigned.get(t.id)) ?? { schedule: null };
      return !isSlotStart(resolveDeviceBlock(schedule, device, t.studyCode, t.modalityCode).block, new Date(t.startAt));
    }).length;
}

/** A modality's old own hours become the own hours of its devices without one; returns the modalities left without devices. */
export function migrateModalities(u: UnidadSimulada, modalities: CenterSchedule['modalities'], at: string): CenterSchedule['modalities'] {
  const devices = devicesOf(u);
  return modalities.filter((m) => {
    const ofModality = devices.filter((d) => d.modalityCode === m.modalityCode);
    for (const d of ofModality.filter((x) => !x.schedule)) {
      deviceDetails.agregar({ ...deviceDetails.get(d.id), id: d.id, schedule: m.schedule, updatedAt: at });
    }
    return ofModality.length === 0;
  });
}

