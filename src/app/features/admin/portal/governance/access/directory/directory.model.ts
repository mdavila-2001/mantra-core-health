import type {
  DirectoryPermissionSummary,
  DirectoryUserStatus,
  DirectoryUserType,
} from '../../../../../../core/data-access/authz-admin/authz-admin-directory.types';
import type { Tone } from '../../../../../../shared/components/tone/tone.types';

/* Labels and small view rules of the users directory. They explain codes; they
   decide nothing: the API is the authority. A code not listed here is shown
   as received, in a neutral tone. Colour never travels alone: every badge has text. */

export interface Label {
  readonly label: string;
  readonly tone: Tone;
}

const TYPE_LABELS: Readonly<Record<DirectoryUserType, string>> = {
  PATIENT: 'Pacientes',
  DOCTOR: 'Médicos',
  PHARMACY: 'Farmacias',
  LABORATORY: 'Laboratorios',
  INTERNAL: 'Internos',
};

const TYPE_SINGULAR: Readonly<Record<DirectoryUserType, string>> = {
  PATIENT: 'Paciente',
  DOCTOR: 'Médico',
  PHARMACY: 'Farmacia',
  LABORATORY: 'Laboratorio',
  INTERNAL: 'Interno',
};

const STATUS_LABELS: Readonly<Record<string, Label>> = {
  ACTIVE: { label: 'Activo', tone: 'success' },
  PENDING: { label: 'Pendiente', tone: 'warning' },
  SUSPENDED: { label: 'Suspendido', tone: 'warning' },
  BLOCKED: { label: 'Bloqueado', tone: 'error' },
};

export const typePlural = (type: DirectoryUserType): string => TYPE_LABELS[type];
export const typeSingular = (type: DirectoryUserType): string => TYPE_SINGULAR[type];

export function statusLabel(status: DirectoryUserStatus): Label {
  return STATUS_LABELS[status] ?? { label: 'Estado sin clasificar', tone: 'secondary' };
}

/**
 * Defence in depth: the API must send the e-mail masked. If what arrives has no
 * mask character it is NOT shown (it could be a raw address), so a server
 * mistake does not become a leak on screen.
 */
export function visibleEmail(masked: string | null): string {
  if (masked === null) return 'Sin correo registrado';
  return masked.includes('*') ? masked : 'Correo no disponible';
}

/** One line for the permissions column; the detail stays in the person's drawer. */
export function permissionsLine(p: DirectoryPermissionSummary): string {
  if (p.allowed === 0 && p.denied === 0) return 'Sin permisos';
  const parts = [`${p.allowed} permitidos`];
  if (p.denied > 0) parts.push(`${p.denied} denegados`);
  if (p.dangerous > 0) parts.push(`${p.dangerous} sensibles`);
  return parts.join(' · ');
}
