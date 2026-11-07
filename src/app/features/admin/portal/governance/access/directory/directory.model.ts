import type {
  DirectoryPermissionSummary,
  DirectoryUserType,
} from '../../../../../../core/data-access/authz-admin/authz-admin-directory.types';

/* Labels and small view rules of the users directory. They explain codes; they
   decide nothing: the API is the authority. A code not listed here is shown
   as received, in a neutral tone. Colour never travels alone: every badge has text. */

const TYPE_LABELS: Readonly<Record<DirectoryUserType, string>> = {
  PATIENT: 'Pacientes',
  PRACTITIONER: 'Profesionales',
  PHARMACY: 'Farmacias',
  LABORATORY: 'Laboratorios',
  INTERNAL: 'Internos',
  OTHER: 'Otros',
};

const TYPE_SINGULAR: Readonly<Record<DirectoryUserType, string>> = {
  PATIENT: 'Paciente',
  PRACTITIONER: 'Profesional',
  PHARMACY: 'Farmacia',
  LABORATORY: 'Laboratorio',
  INTERNAL: 'Interno',
  OTHER: 'Otro',
};

export const typePlural = (type: DirectoryUserType): string => TYPE_LABELS[type];
export const typeSingular = (type: DirectoryUserType): string => TYPE_SINGULAR[type];

/**
 * The API sends the account state as a concept id and the front has no value set
 * to translate it, so it is NOT guessed: the cell says so and keeps the tail of
 * the id for support.
 */
export const statusText = (conceptId: string): string =>
  conceptId === '' ? 'Sin dato' : `Concepto …${conceptId.slice(-4)}`;

/**
 * Defence in depth: the API must send the e-mail masked. If what arrives has no
 * mask character it is NOT shown (it could be a raw address), so a server
 * mistake does not become a leak on screen.
 */
export function visibleEmail(masked: string | null): string {
  if (masked === null) return 'Sin correo (el acceso no es un correo)';
  return masked.includes('*') ? masked : 'Correo no disponible';
}

/** One line for the permissions column (deny wins on the API side). */
export function permissionsLine(p: DirectoryPermissionSummary): string {
  if (p.allowed === 0 && p.denied === 0 && p.directGrants === 0) return 'Sin permisos';
  const parts = [`${p.allowed} permitidos`];
  if (p.denied > 0) parts.push(`${p.denied} denegados`);
  if (p.dangerous > 0) parts.push(`${p.dangerous} sensibles`);
  if (p.directGrants > 0) parts.push(`${p.directGrants} directos`);
  return parts.join(' · ');
}
