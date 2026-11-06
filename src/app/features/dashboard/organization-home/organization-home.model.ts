import type { MembershipListItem, MyOrganization } from '../../../core/data-access/directory/directory.types';

/** How a line of the organization's checklist stands. */
export type ChecklistState = 'ok' | 'pending' | 'attention';

/** One thing the organization has to have in order, in words. */
export interface ChecklistItem {
  readonly key: string;
  readonly label: string;
  readonly detail: string;
  readonly state: ChecklistState;
}

/** The people of the organization, counted by role. */
export interface TeamSummary {
  readonly total: number;
  /** The first page was full: there may be more people than `total`. */
  readonly partial: boolean;
  readonly byRole: readonly { readonly label: string; readonly count: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** A document that expires within this many days asks for attention. */
const EXPIRY_WARNING_DAYS = 30;
const ROLE_LABELS: Readonly<Record<string, string>> = { OWNER: 'Dueños', ADMIN: 'Administración', STAFF: 'Equipo' };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The legal folder in one line: what is verified, what waits, what was refused or expires. */
function documentsItem(org: MyOrganization, now: Date): ChecklistItem {
  const papers = org.legalDocuments ?? [];
  const base = { key: 'documents', label: 'Documentos legales' };
  if (papers.length === 0) {
    return { ...base, detail: 'Todavía no hay documentos en su carpeta.', state: 'pending' };
  }
  const refused = papers.filter((p) => p.verificationStatus === 'RECHAZADO').length;
  const expired = papers.filter((p) => p.verificationStatus === 'VENCIDO').length;
  const expiring = papers.filter(
    (p) =>
      p.verificationStatus !== 'VENCIDO' &&
      p.validTo !== undefined &&
      p.validTo.getTime() - now.getTime() <= EXPIRY_WARNING_DAYS * DAY_MS,
  ).length;
  const waiting = papers.filter((p) => p.verificationStatus === 'PENDIENTE').length;
  const verified = papers.filter((p) => p.verificationStatus === 'VERIFICADO').length;

  if (refused + expired + expiring > 0) {
    const parts = [
      refused > 0 ? plural(refused, 'rechazado', 'rechazados') : '',
      expired > 0 ? plural(expired, 'vencido', 'vencidos') : '',
      expiring > 0 ? `${plural(expiring, 'vence', 'vencen')} pronto` : '',
    ].filter(Boolean);
    return { ...base, detail: `${parts.join(', ')}.`, state: 'attention' };
  }
  if (waiting > 0) {
    return { ...base, detail: `${plural(waiting, 'en revisión', 'en revisión')} de ${papers.length}.`, state: 'pending' };
  }
  return { ...base, detail: `${plural(verified, 'verificado', 'verificados')}.`, state: 'ok' };
}

/**
 * The state of the organization as a checklist. `hasLogo` is `null` when it could not be read:
 * that is said, not shown as «no logo».
 */
export function organizationChecklist(
  org: MyOrganization,
  hasLogo: boolean | null,
  now: Date = new Date(),
): readonly ChecklistItem[] {
  return [
    org.taxIdentifier || org.payer?.regulatorIdentifier
      ? { key: 'data', label: 'Datos de la organización', detail: 'Razón social y NIT registrados.', state: 'ok' }
      : { key: 'data', label: 'Datos de la organización', detail: 'Falta el NIT.', state: 'pending' },
    org.legalRepresentative
      ? { key: 'representative', label: 'Representante legal', detail: org.legalRepresentative.fullName, state: 'ok' }
      : { key: 'representative', label: 'Representante legal', detail: 'Todavía no está registrado.', state: 'pending' },
    documentsItem(org, now),
    hasLogo === null
      ? { key: 'logo', label: 'Logo', detail: 'No se pudo comprobar.', state: 'pending' }
      : hasLogo
        ? { key: 'logo', label: 'Logo', detail: 'Cargado.', state: 'ok' }
        : { key: 'logo', label: 'Logo', detail: 'Todavía no lo cargó.', state: 'pending' },
  ];
}

/** Counts a page of memberships by role; a role the API does not label goes under «Otros». */
export function summarizeTeam(items: readonly MembershipListItem[], partial: boolean): TeamSummary {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = (item.tenantRoleCode && ROLE_LABELS[item.tenantRoleCode]) || 'Otros';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return { total: items.length, partial, byRole: [...counts].map(([label, count]) => ({ label, count })) };
}
