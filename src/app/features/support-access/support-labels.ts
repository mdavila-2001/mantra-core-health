import {
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type SupportEngagementOrigin,
  type SupportEngagementStatus,
  type SupportItemDecision,
  type SupportRequestStatus,
  type SupportRoleTemplateCode,
} from '../../core/data-access/support-access/support-access.types';
import type { BadgeVariant } from '../../shared/components/atoms/badge/badge.types';

/**
 * Palabras de las pantallas del personal de apoyo. Texto de la interfaz: la API
 * habla con códigos, la persona con frases.
 */

export function templateLabel(code: SupportRoleTemplateCode): string {
  return SUPPORT_ROLE_TEMPLATE_LABELS[code];
}

export function engagementStatusText(status: SupportEngagementStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Activo';
    case 'PENDING':
      return 'Pendiente';
    case 'SUSPENDED':
      return 'Suspendido';
    case 'ENDED':
      return 'Terminado';
  }
}

export function engagementStatusTone(status: SupportEngagementStatus): BadgeVariant {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING':
      return 'info';
    case 'SUSPENDED':
      return 'warning';
    case 'ENDED':
      return 'secondary';
  }
}

export function requestStatusText(status: SupportRequestStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Esperando decisión';
    case 'APPROVED':
      return 'Aprobada';
    case 'PARTIAL':
      return 'Aprobada en parte';
    case 'REJECTED':
      return 'Rechazada';
    case 'EXPIRED':
      return 'Vencida';
    case 'CANCELLED':
      return 'Cancelada';
  }
}

export function requestStatusTone(status: SupportRequestStatus): BadgeVariant {
  switch (status) {
    case 'PENDING':
      return 'info';
    case 'APPROVED':
      return 'success';
    case 'PARTIAL':
      return 'warning';
    case 'REJECTED':
      return 'error';
    case 'EXPIRED':
    case 'CANCELLED':
      return 'secondary';
  }
}

export function itemDecisionText(decision: SupportItemDecision): string {
  switch (decision) {
    case 'PENDING':
      return 'Sin decidir';
    case 'APPROVED':
      return 'Aprobado';
    case 'ADJUSTED':
      return 'Aprobado con ajustes';
    case 'REJECTED':
      return 'Rechazado';
  }
}

export function itemDecisionTone(decision: SupportItemDecision): BadgeVariant {
  switch (decision) {
    case 'PENDING':
      return 'info';
    case 'APPROVED':
      return 'success';
    case 'ADJUSTED':
      return 'warning';
    case 'REJECTED':
      return 'error';
  }
}

export function originText(origin: SupportEngagementOrigin): string {
  switch (origin) {
    case 'REQUEST':
      return 'Pidió acceso';
    case 'INVITATION':
      return 'Invitación';
    case 'QR':
      return 'Código QR';
  }
}

/** Fecha corta en español: «5 nov 2026». Sin fecha o inválida, un guion largo. */
export function formatDay(value: string | undefined): string {
  if (value === undefined) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Fecha y hora cortas: «5 nov, 08:42». */
export function formatDateTime(value: string | undefined): string {
  if (value === undefined) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Días que faltan (redondeado hacia arriba) hasta una fecha; negativo si ya pasó. */
export function daysUntil(value: string, now: Date = new Date()): number {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
}

/** «vence en 13 días», «vence hoy», «venció». */
export function expiryText(value: string, now: Date = new Date()): string {
  const days = daysUntil(value, now);
  if (days < 0) return 'venció';
  if (days === 0) return 'vence hoy';
  return days === 1 ? 'vence mañana' : `vence en ${days} días`;
}

/** Nombre corto de lo que cubre un permiso, con los nombres que ya trae la API. */
export function grantLabel(grant: {
  readonly targetKind: string;
  readonly practitionerName?: string;
  readonly serviceName?: string;
  readonly locationName?: string;
}): string {
  const doctor = grant.practitionerName ?? 'Doctor';
  const service = grant.serviceName ?? 'Servicio';
  const place = grant.locationName ?? 'Ubicación';
  switch (grant.targetKind) {
    case 'PRACTITIONER':
      return doctor;
    case 'SERVICE':
      return `Servicio · ${service}`;
    case 'LOCATION':
      return place;
    case 'PRACTITIONER_SERVICE':
      return `${doctor} × ${service}`;
    case 'PRACTITIONER_LOCATION':
      return `${doctor} × ${place}`;
    case 'SERVICE_LOCATION':
      return `${service} × ${place}`;
    case 'ALL_PRACTITIONERS':
      return 'Todos los doctores';
    case 'ALL_SERVICES':
      return 'Todos los servicios';
    case 'ALL_LOCATIONS':
      return 'Todas las ubicaciones';
    default:
      return 'Toda la organización';
  }
}

/** Resumen de alcance para una lista: los dos primeros permisos y «y N más». */
export function scopeSummary(grants: readonly Parameters<typeof grantLabel>[0][]): string {
  if (grants.length === 0) return 'Sin permisos todavía';
  const nombres = grants.slice(0, 2).map(grantLabel);
  const resto = grants.length - nombres.length;
  return resto > 0 ? `${nombres.join(' · ')} y ${resto} más` : nombres.join(' · ');
}
