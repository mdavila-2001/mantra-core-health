import type { SupportAgenda, SupportAgendaItem } from './support-agenda.types';
import type { SupportCatalog } from './support-access.types';
import type { SupportActionCode } from './support-access.types';

/**
 * La **forma de cable** de `GET /me/support-agenda` (`SupportAgendaResponseDto` de la API) contra la que usa la pantalla.
 *
 * Lo que la API dice y la pantalla no tenía:
 *
 * - Solo trae **citas** (`bookingId`), nunca horarios libres: la persona de apoyo no puede listar cupos (`GET
 *   /scheduling/slots` no admite `SUPPORT_STAFF`). Los horarios libres, si una pantalla los quiere, vienen aparte (ver
 *   {@link WireSupportFreeSlots}).
 * - El estado es un **concepto** (`statusConceptId`), no un código: se resuelve con la terminología y de ahí sale el estado de la
 *   pantalla ({@link bookingStatusOf}).
 * - Los doctores se identifican por su **perfil profesional** (`practitionerProfileId`), también en el filtro `doctors`.
 * - Sin `schedule.view` la cita sale como bloque: sin `bookingId`, servicio, paciente ni motivo.
 * - Los espacios y servicios son listas planas (`id`, `name`, `code`): no traen la jerarquía de ubicaciones.
 */

/** Un doctor de las opciones de filtro. */
export interface WireSupportAgendaDoctor {
  readonly practitionerProfileId: string;
  readonly displayName: string;
}

/** Una cita (o un bloque) de la agenda combinada. */
export interface WireSupportAgendaItem {
  readonly bookingId?: string;
  readonly resourceId?: string;
  readonly practitionerProfileId?: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly statusConceptId: string;
  readonly careSpaceId?: string;
  readonly healthcareServiceId?: string;
  readonly patientProfileId?: string;
  readonly patientName?: string;
  readonly waitlistCount?: number;
  readonly allowedActions: readonly string[];
  readonly denialReason?: string;
}

/** `SupportAgendaResponseDto`. */
export interface WireSupportAgenda {
  readonly doctors: readonly WireSupportAgendaDoctor[];
  readonly services: readonly { readonly id: string; readonly name: string }[];
  readonly locations: readonly {
    readonly id: string;
    readonly name: string;
    readonly code: string;
  }[];
  readonly items: readonly WireSupportAgendaItem[];
}

/**
 * Un horario libre de la agenda combinada. **No es de la API**: la API no le da cupos al personal de apoyo. Lo sirve el
 * simulador (`GET /me/support-agenda/free-slots`) para que las pantallas de crear cita se puedan probar; la forma imita a la de la
 * agenda, con `slotId` en lugar de `bookingId`.
 */
export interface WireSupportFreeSlot {
  readonly slotId: string;
  readonly resourceId?: string;
  readonly practitionerProfileId: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly careSpaceId: string;
  readonly healthcareServiceId?: string;
  readonly allowedActions: readonly string[];
  readonly denialReason?: string;
}

export interface WireSupportFreeSlots {
  readonly doctors: WireSupportAgenda['doctors'];
  readonly services: WireSupportAgenda['services'];
  readonly locations: WireSupportAgenda['locations'];
  readonly items: readonly WireSupportFreeSlot[];
}

type BookingStatus = Exclude<SupportAgendaItem['status'], 'FREE'>;

/**
 * El estado de la pantalla a partir del **código** del concepto de estado de la cita.
 *
 * El prefijo de módulo se recorta (el catálogo publica `BOOKING_CONFIRMED` y algunos fixtures `BK-CONFIRMED`). La pantalla
 * conoce cuatro estados de una cita: lo pedido o por confirmar es «pedida»; en consulta o atendida es «llegó» (la persona ya
 * está o estuvo ahí y la API no ofrece acciones de llegada: eso lo dice `allowedActions`). Sin código, «pedida».
 */
export function bookingStatusOf(code: string | undefined): BookingStatus {
  if (code === undefined) return 'BOOKED';
  const sufijo = (code.includes(':') ? code.slice(code.lastIndexOf(':') + 1) : code)
    .replace(/^BK-/, 'BOOKING_')
    .replace(/-/g, '_');
  switch (sufijo) {
    case 'BOOKING_CONFIRMED':
      return 'CONFIRMED';
    case 'BOOKING_CHECKED_IN':
    case 'BOOKING_IN_PROGRESS':
    case 'BOOKING_COMPLETED':
      return 'CHECKED_IN';
    case 'BOOKING_CANCELLED':
    case 'BOOKING_REJECTED':
      return 'CANCELLED';
    default:
      return 'BOOKED';
  }
}

/** La clave de un bloque sin reserva: local, estable y sin parecerse a un id de cita. */
function blockKey(item: WireSupportAgendaItem): string {
  return `bloque:${item.resourceId ?? item.practitionerProfileId ?? 'sin-agenda'}:${item.startAt}`;
}

function nameIndex(
  list: readonly { readonly id: string; readonly name: string }[],
): ReadonlyMap<string, string> {
  return new Map(list.map((entry) => [entry.id, entry.name]));
}

/**
 * Convierte la respuesta de la API a la agenda de la pantalla.
 *
 * @param wire - Lo que contestó `GET /me/support-agenda`.
 * @param codeOf - El código del concepto de estado (de la terminología); `undefined` si no se pudo resolver.
 * @param free - Horarios libres, si quien llama los tiene (el simulador); se suman como cupos libres.
 * @param catalog - El catálogo de apoyo de la organización: de ahí sale la **asignación de rol** de cada doctor (la agenda solo
 *   trae su perfil profesional), que piden las aprobaciones y las explicaciones.
 */
export function fromWireSupportAgenda(
  wire: WireSupportAgenda,
  codeOf: (conceptId: string) => string | undefined,
  free?: WireSupportFreeSlots,
  catalog?: Pick<SupportCatalog, 'doctors'> | null,
): SupportAgenda {
  const rolDe = (nombre: string): { readonly roleAssignmentId?: string } => {
    const clave = nombre.trim().toLocaleLowerCase('es');
    const coincidencias = (catalog?.doctors ?? []).filter(
      (d) => d.name.trim().toLocaleLowerCase('es') === clave,
    );
    // Solo si el nombre identifica a UN doctor: con dos iguales no se adivina.
    return coincidencias.length === 1 ? { roleAssignmentId: coincidencias[0]!.id } : {};
  };
  const doctors = mergeById(
    wire.doctors.map((d) => ({
      id: d.practitionerProfileId,
      name: d.displayName,
      specialty: '',
      ...rolDe(d.displayName),
    })),
    (free?.doctors ?? []).map((d) => ({
      id: d.practitionerProfileId,
      name: d.displayName,
      specialty: '',
      ...rolDe(d.displayName),
    })),
  );
  const services = mergeById(wire.services, free?.services ?? []);
  const places = mergeById(wire.locations, free?.locations ?? []);
  const placeName = nameIndex(places);
  const serviceName = nameIndex(services);

  const bookings: SupportAgendaItem[] = wire.items.map((item) => {
    const visible = item.bookingId !== undefined;
    return {
      id: item.bookingId ?? blockKey(item),
      ...(item.bookingId === undefined ? {} : { bookingId: item.bookingId }),
      kind: 'BOOKING',
      start: item.startAt,
      end: item.endAt,
      practitionerRoleAssignmentId: item.practitionerProfileId ?? '',
      careSpaceId: item.careSpaceId ?? '',
      careSpaceName:
        (item.careSpaceId !== undefined ? placeName.get(item.careSpaceId) : undefined) ?? '',
      ...(item.healthcareServiceId === undefined
        ? {}
        : { healthcareServiceId: item.healthcareServiceId }),
      serviceName:
        (item.healthcareServiceId !== undefined
          ? serviceName.get(item.healthcareServiceId)
          : undefined) ?? '',
      ...(item.resourceId === undefined ? {} : { resourceId: item.resourceId }),
      ...(visible && item.patientProfileId !== undefined
        ? { patientProfileId: item.patientProfileId }
        : {}),
      status: bookingStatusOf(codeOf(item.statusConceptId)),
      ...(visible && item.patientName !== undefined ? { patientLabel: item.patientName } : {}),
      ...(item.waitlistCount === undefined ? {} : { waitlistCount: item.waitlistCount }),
      allowedActions: item.allowedActions as readonly SupportActionCode[],
      ...(item.denialReason === undefined ? {} : { denialReason: item.denialReason }),
    };
  });

  const slots: SupportAgendaItem[] = (free?.items ?? []).map((slot) => ({
    id: slot.slotId,
    kind: 'SLOT',
    start: slot.startAt,
    end: slot.endAt,
    practitionerRoleAssignmentId: slot.practitionerProfileId,
    careSpaceId: slot.careSpaceId,
    careSpaceName: placeName.get(slot.careSpaceId) ?? '',
    ...(slot.healthcareServiceId === undefined
      ? {}
      : { healthcareServiceId: slot.healthcareServiceId }),
    serviceName:
      (slot.healthcareServiceId !== undefined
        ? serviceName.get(slot.healthcareServiceId)
        : undefined) ?? '',
    ...(slot.resourceId === undefined ? {} : { resourceId: slot.resourceId }),
    status: 'FREE',
    allowedActions: slot.allowedActions as readonly SupportActionCode[],
    ...(slot.denialReason === undefined ? {} : { denialReason: slot.denialReason }),
  }));

  return {
    doctors,
    services,
    locations: places.map((p) => ({
      id: p.id,
      kind: 'CONSULTING_ROOM',
      name: p.name,
      parentId: null,
      path: `/${p.id}/`,
    })),
    items: [...bookings, ...slots].sort(
      (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
    ),
  };
}

function mergeById<T extends { readonly id: string }>(
  first: readonly T[],
  second: readonly T[],
): T[] {
  const seen = new Set(first.map((e) => e.id));
  return [...first, ...second.filter((e) => !seen.has(e.id))];
}
