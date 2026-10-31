import { isReservedBlock, RESERVED_BLOCK_LABEL } from '../../../core/access-challenge/access-challenge';
import type {
  LocationNode,
  SupportAgendaDoctor,
  SupportAgendaItem,
  CatalogService,
} from '../../../core/data-access/support-access/support-access.types';

/**
 * Cómo se reparte la agenda combinada en columnas. Lógica pura.
 *
 * Las tres vistas son la misma información cortada distinto: **por doctor**
 * (una columna por doctor), **por consultorio** (una por espacio) y **por
 * servicio** (una por servicio). Las filas son las horas de inicio que existen
 * ese día.
 */
export type AgendaView = 'DOCTOR' | 'SPACE' | 'SERVICE';

export interface AgendaColumn<T extends SupportAgendaItem = SupportAgendaItem> {
  readonly key: string;
  readonly label: string;
  /** Una línea más bajo el nombre: la especialidad del doctor, o dónde queda el consultorio. */
  readonly sub?: string;
  readonly items: readonly T[];
}

/** Los colores de «Mis doctores», rampas del sistema de diseño (la tinta es oscura sobre todas). */
export const DOCTOR_COLOR_FAMILIES: readonly string[] = ['petrol', 'aqua', 'mint', 'amber', 'sage', 'info', 'success', 'neutral'];

/** El color de un doctor: estable según su posición en la lista de «Mis doctores». */
export function doctorColor(doctors: readonly SupportAgendaDoctor[], doctorId: string): { readonly fondo: string; readonly borde: string } {
  const indice = Math.max(0, doctors.findIndex((d) => d.id === doctorId));
  const familia = DOCTOR_COLOR_FAMILIES[indice % DOCTOR_COLOR_FAMILIES.length]!;
  return { fondo: `var(--c-${familia}-100)`, borde: `var(--c-${familia}-600)` };
}

/** La columna de los bloques que la persona no puede ver: no traen el servicio. */
const SIN_SERVICIO = 'sin-servicio';

export function groupAgenda<T extends SupportAgendaItem>(
  items: readonly T[],
  view: AgendaView,
  doctors: readonly SupportAgendaDoctor[],
  services: readonly CatalogService[],
  locations: readonly LocationNode[],
): readonly AgendaColumn<T>[] {
  const keyOf = (item: T): string => {
    switch (view) {
      case 'DOCTOR':
        return item.practitionerRoleAssignmentId;
      case 'SPACE':
        return item.careSpaceId;
      case 'SERVICE':
        // Un bloque sin `schedule.view` no trae servicio: se agrupa aparte, sin inventarle uno.
        return item.healthcareServiceId ?? SIN_SERVICIO;
    }
  };
  const labelOf = (key: string, fallback: T): string => {
    switch (view) {
      case 'DOCTOR':
        return doctors.find((d) => d.id === key)?.name ?? 'Doctor';
      case 'SPACE':
        return locations.find((n) => n.id === key)?.name ?? fallback.careSpaceName;
      case 'SERVICE':
        return key === SIN_SERVICIO ? 'Servicio no visible' : (services.find((s) => s.id === key)?.name ?? fallback.serviceName);
    }
  };

  const subOf = (key: string): string | undefined => {
    switch (view) {
      case 'DOCTOR':
        return doctors.find((d) => d.id === key)?.specialty;
      case 'SPACE': {
        const nodo = locations.find((n) => n.id === key);
        if (nodo === undefined) return undefined;
        const padre = locations.find((n) => n.id === nodo.parentId);
        return padre === undefined ? undefined : padre.name;
      }
      case 'SERVICE':
        return undefined;
    }
  };

  const porClave = new Map<string, T[]>();
  for (const item of items) {
    const clave = keyOf(item);
    porClave.set(clave, [...(porClave.get(clave) ?? []), item]);
  }
  return [...porClave]
    .map(([key, delGrupo]) => {
      const sub = subOf(key);
      return {
        key,
        label: labelOf(key, delGrupo[0]!),
        ...(sub === undefined ? {} : { sub }),
        items: [...delGrupo].sort((a, b) => a.start.localeCompare(b.start)),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/** Las horas de inicio distintas, en orden: son las filas de la grilla. */
export function timeRows(items: readonly SupportAgendaItem[]): readonly string[] {
  return [...new Set(items.map((item) => item.start))].sort();
}

/** `HH:mm` en hora local de un instante ISO. */
export function clock(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Si la persona puede ver ese horario (no está atenuado). */
export function isVisible(item: SupportAgendaItem): boolean {
  return item.allowedActions.includes('schedule.view');
}

/** Lo que un renglón de la grilla dice en voz alta, con el motivo si está atenuado. */
export function itemAriaLabel(item: SupportAgendaItem, doctorName: string): string {
  const base = [clock(item.start), doctorName, item.careSpaceName, item.serviceName].filter((parte) => parte !== '').join(', ');
  if (isReservedBlock(item)) return `${base}. ${RESERVED_BLOCK_LABEL}: no puede ver el detalle de esta cita`;
  if (!isVisible(item)) return `${base}. Sin permiso: ${item.denialReason ?? 'su permiso no cubre este horario'}`;
  if (item.status === 'FREE') return `${base}. Horario libre`;
  return `${base}. ${item.patientLabel ?? 'Cita'}${item.status === 'CHECKED_IN' ? ', ya llegó' : ''}`;
}

/** Inicio y fin del día local, como ISO, para pedir la agenda de ese día. */
export function dayRange(day: Date): { readonly from: string; readonly to: string } {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(day);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}
