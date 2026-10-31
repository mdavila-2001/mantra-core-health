import type { CatalogService, LocationNode, SupportActionCode } from './support-access-base.types';

/* ---- agenda combinada -------------------------------------------------------- */

export interface SupportAgendaQuery {
  /** Organización (tenant) de la que se pide la agenda. */
  readonly org: string;
  readonly from: string;
  readonly to: string;
  readonly doctors?: readonly string[];
  readonly services?: readonly string[];
  readonly locations?: readonly string[];
}

export interface SupportAgendaDoctor {
  readonly id: string;
  readonly name: string;
  readonly specialty: string;
  /**
   * La asignación de rol del doctor (`practitioner_role_assignment_id`), que es lo que piden las aprobaciones de cuatro ojos y el
   * «¿por qué no puedo?». La agenda real identifica al doctor por su **perfil profesional** (`id`); la asignación se saca del catálogo
   * de apoyo por el nombre. Ausente si no se pudo resolver.
   */
  readonly roleAssignmentId?: string;
}

/** Un horario libre o una cita de la agenda combinada, con lo que la API resolvió sobre el permiso. */
export interface SupportAgendaItem {
  /**
   * La clave de la fila. Para una cita que la persona **puede ver** es la reserva (`bookingId`); para un
   * horario libre, el cupo. Un **bloque sin `schedule.view`** no trae `bookingId` (la API no nombra la cita
   * a quien no puede verla): su clave es local y estable, y **no sirve para actuar** sobre nada.
   */
  readonly id: string;
  /**
   * `bookingId` de la API: **solo con `schedule.view`**. Ausente en un bloque que la persona no puede ver:
   * sin él no hay a qué cita dirigir una acción, y la pantalla no ofrece ninguna.
   */
  readonly bookingId?: string;
  readonly kind: 'SLOT' | 'BOOKING';
  readonly start: string;
  readonly end: string;
  readonly practitionerRoleAssignmentId: string;
  readonly careSpaceId: string;
  readonly careSpaceName: string;
  /** **Solo con `schedule.view`**: un bloque sin ver sale sin servicio (la API no lo manda). No se asume presente. */
  readonly healthcareServiceId?: string;
  /** Vacío cuando no hay `healthcareServiceId`. */
  readonly serviceName: string;
  /**
   * La agenda (recurso) del doctor en ese espacio. **Propuesta**: la necesitan
   * «Atender sin cita» (`POST /scheduling/appointments/direct`) y la lista de
   * espera, que hoy piden el recurso y la agenda combinada no lo traía.
   */
  readonly resourceId?: string;
  /**
   * El paciente de la cita (`patientProfileId` de la API, solo con `schedule.view`). La aprobación de cuatro ojos de una acción
   * sobre la cita lo lleva: sin él, la huella de lo que se pidió no coincide con la de lo que se reintenta
   * (409 `FOUR_EYES_PAYLOAD_CHANGED`, comprobado en B7c).
   */
  readonly patientProfileId?: string;
  readonly status: 'FREE' | 'BOOKED' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED';
  /** Solo en citas. Para quien solo ve horarios, ausente. */
  readonly patientLabel?: string;
  readonly reasonLabel?: string;
  /** Acciones que **esta persona** puede hacer sobre este horario o cita. */
  readonly allowedActions: readonly SupportActionCode[];
  /** Cuántas personas esperan este horario (lista de espera). **Propuesta**; ausente = ninguna. */
  readonly waitlistCount?: number;
  /** Por qué no hay permiso, en palabras de la persona. Presente si `allowedActions` no incluye `schedule.view`. */
  readonly denialReason?: string;
}

export interface SupportAgenda {
  readonly doctors: readonly SupportAgendaDoctor[];
  readonly services: readonly CatalogService[];
  readonly locations: readonly LocationNode[];
  readonly items: readonly SupportAgendaItem[];
}
