import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import type { SupportApproval } from '../../../core/data-access/access-governance/access-reviews.types';
import { atomMeta } from '../../../core/data-access/support-access/support-atoms';

/* ============================================================================
    Palabras de las aprobaciones de cuatro ojos: lógica pura, sin Angular.
    Cada tarjeta dice qué se pide, quién decide, hasta cuándo y qué pasa si se aprueba (CONTRATO-GOBIERNO §9.3 fila 8).
   ========================================================================== */

const TIPOS: Readonly<Record<string, string>> = {
  ACTION: 'Una acción',
  GRANT_CHANGE: 'Un cambio de permisos',
  SOD_EXCEPTION: 'Una excepción de separación de funciones',
  ENGAGEMENT_MOVE: 'Un cambio de rol o alcance',
  REACTIVATION: 'Una reactivación',
};

export function kindText(kind: string): string {
  return TIPOS[kind] ?? 'Una solicitud';
}

const APROBADORES: Readonly<Record<string, string>> = {
  DOCTOR: 'el doctor',
  SECOND_APPROVER: 'un segundo administrador',
  SERVICE_HEAD: 'la jefatura del servicio',
};

export function approverText(approverKind: string): string {
  return APROBADORES[approverKind] ?? 'otra persona autorizada';
}

/** Qué pasa si se aprueba, según el tipo. */
export function consequenceText(approval: Pick<SupportApproval, 'kind'>, ttlMinutes = 60): string {
  switch (approval.kind) {
    case 'ACTION':
      return `Si la aprueba, la acción se puede hacer una sola vez durante los próximos ${ttlMinutes} minutos.`;
    case 'SOD_EXCEPTION':
      return 'Si la aprueba, la excepción rige desde ahora hasta la fecha pedida.';
    case 'GRANT_CHANGE':
      return 'Si la aprueba, el cambio de permisos se aplica de inmediato.';
    case 'ENGAGEMENT_MOVE':
      return 'Si la aprueba, el cambio de rol o alcance se aplica de inmediato.';
    case 'REACTIVATION':
      return 'Si la aprueba, la persona vuelve a tener acceso de inmediato.';
    default:
      return 'Si la aprueba, la solicitud se ejecuta.';
  }
}

/**
 * Una aprobación sobre un permiso crítico pide además el segundo paso de quien aprueba: la acción con un `atom` crítico o un
 * cambio de permisos que suma átomos críticos (`details.criticalAtoms`).
 */
export function needsStepUpToApprove(approval: Pick<SupportApproval, 'atom' | 'details'>): boolean {
  if (approval.details !== undefined && approval.details.criticalAtoms.length > 0) return true;
  return approval.atom !== undefined && atomMeta(approval.atom)?.sensitivity === 'CRITICAL';
}

export function statusText(
  approval: Pick<SupportApproval, 'status' | 'approvedUntil' | 'decisionComment'>,
  now: Date,
): string {
  switch (approval.status) {
    case 'PENDING':
      return 'Pendiente';
    case 'APPROVED':
      return approval.approvedUntil !== undefined &&
        new Date(approval.approvedUntil).getTime() < now.getTime()
        ? 'Aprobada, ya venció'
        : 'Aprobada';
    case 'REJECTED':
      return 'Rechazada';
    case 'EXPIRED':
      return 'Caducó';
    case 'CANCELLED':
      return 'Cancelada';
    case 'CONSUMED':
    case 'EXECUTED':
      return 'Aprobada y usada';
    default:
      return String(approval.status);
  }
}

export function statusTone(approval: Pick<SupportApproval, 'status'>): BadgeVariant {
  switch (approval.status) {
    case 'PENDING':
      return 'info';
    case 'APPROVED':
    case 'CONSUMED':
    case 'EXECUTED':
      return 'success';
    case 'REJECTED':
      return 'error';
    default:
      return 'secondary';
  }
}

/** «Vence en 3 h 20 min», «Vence en 12 min», «Venció». */
export function expiryText(expiresAt: string, now: Date): string {
  const minutos = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 60_000);
  if (minutos < 0) return 'Venció';
  if (minutos < 1) return 'Vence en menos de un minuto';
  if (minutos < 60) return `Vence en ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Vence en ${horas} h${minutos % 60 === 0 ? '' : ` ${minutos % 60} min`}`;
  const dias = Math.floor(horas / 24);
  return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** Hasta cuándo vale una aprobación ya dada: «Vale hasta las 15:40» (hoy) o con fecha. */
export function validUntilText(approvedUntil: string | undefined, now: Date): string | null {
  if (approvedUntil === undefined) return null;
  const hasta = new Date(approvedUntil);
  const hora = `${String(hasta.getHours()).padStart(2, '0')}:${String(hasta.getMinutes()).padStart(2, '0')}`;
  if (hasta.getTime() < now.getTime()) return 'La aprobación ya venció.';
  return hasta.toDateString() === now.toDateString()
    ? `Vale hasta las ${hora}.`
    : `Vale hasta el ${hasta.toLocaleDateString('es-BO')} a las ${hora}.`;
}

export function isPending(approval: Pick<SupportApproval, 'status'>): boolean {
  return approval.status === 'PENDING';
}

/** Una pendiente que ya pasó su plazo no se puede decidir aunque la API todavía no la haya marcado. */
export function isExpired(
  approval: Pick<SupportApproval, 'status' | 'expiresAt'>,
  now: Date,
): boolean {
  return (
    approval.status === 'EXPIRED' ||
    (approval.status === 'PENDING' && new Date(approval.expiresAt).getTime() < now.getTime())
  );
}
