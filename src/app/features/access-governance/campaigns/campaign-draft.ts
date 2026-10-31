import type {
  CampaignDraft,
  CampaignFilters,
  CampaignScope,
  CampaignScopeKind,
  ReviewKind,
  UncertifiedAction,
} from '../../../core/data-access/access-governance/access-reviews.types';
import {
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type SupportRoleTemplateCode,
} from '../../../core/data-access/support-access/support-access.types';
import type { AtomSensitivity } from '../../../core/data-access/support-access/support-atoms';

/* ============================================================================
    El borrador de una campaña tal como lo arma el asistente (CONTRATO-GOBIERNO §6.2 y §9.3).

    Puro y sin Angular: el formulario guarda lo que la persona eligió; acá se convierte en el cuerpo que pide la API
    (`CampaignDraftDto`) y se dicen los problemas de cada paso antes de pedir. La API repite cada validación.
   ========================================================================== */

export interface DraftForm {
  readonly name: string;
  readonly kind: ReviewKind;
  readonly scopeKind: CampaignScopeKind;
  readonly doctorIds: readonly string[];
  readonly serviceIds: readonly string[];
  readonly locationIds: readonly string[];
  readonly templateCodes: readonly string[];
  /** `''` = sin piso de sensibilidad. */
  readonly minSensitivity: AtomSensitivity | '';
  readonly unusedDays: number | null;
  readonly onlyAboveCeiling: boolean;
  readonly onlySodFindings: boolean;
  readonly includeSuspended: boolean;
  /** `AAAA-MM-DD` (hora local). */
  readonly dueDate: string;
  readonly graceDays: number;
  readonly reminderDays: readonly number[];
  readonly escalateAfterDays: number;
  readonly uncertifiedAction: UncertifiedAction;
}

export interface DraftProblem {
  readonly field: string;
  readonly message: string;
}

/** Cuántos días de plazo se proponen. */
export const DEFAULT_DUE_DAYS = 30;
/** Los avisos que se ofrecen, en días antes del vencimiento. */
export const REMINDER_CHOICES: readonly number[] = [14, 7, 3, 1];

const pad = (n: number): string => String(n).padStart(2, '0');
const localDay = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function emptyDraft(now: Date = new Date()): DraftForm {
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DEFAULT_DUE_DAYS);
  return {
    name: '',
    kind: 'PERIODIC',
    scopeKind: 'ORGANIZATION',
    doctorIds: [],
    serviceIds: [],
    locationIds: [],
    templateCodes: [],
    minSensitivity: '',
    unusedDays: null,
    onlyAboveCeiling: false,
    onlySodFindings: false,
    includeSuspended: false,
    dueDate: localDay(due),
    graceDays: 7,
    reminderDays: [7, 3, 1],
    escalateAfterDays: 3,
    uncertifiedAction: 'UNCERTIFIED_REVOKE',
  };
}

/** Las campañas de cambio de rol solo escalan: quitar lo no certificado sin que nadie lo vea sería injusto con quien cambió de cargo. */
export function kindAllowsRevoke(kind: ReviewKind): boolean {
  return kind !== 'MOVER';
}

export function buildScope(form: DraftForm): CampaignScope {
  switch (form.scopeKind) {
    case 'ORGANIZATION':
      return { kind: 'ORGANIZATION' };
    case 'PRACTITIONER':
      return { kind: 'PRACTITIONER', practitionerRoleAssignmentIds: form.doctorIds };
    case 'SERVICE':
      return { kind: 'SERVICE', healthcareServiceIds: form.serviceIds };
    case 'LOCATION':
      return { kind: 'LOCATION', careSpaceIds: form.locationIds, practiceSiteIds: [] };
    case 'TEMPLATE':
      return { kind: 'TEMPLATE', templateCodes: form.templateCodes };
  }
}

export function buildFilters(form: DraftForm): CampaignFilters | undefined {
  const filtros: CampaignFilters = {
    ...(form.minSensitivity === '' ? {} : { minSensitivity: form.minSensitivity }),
    ...(form.unusedDays === null ? {} : { unusedDays: form.unusedDays }),
    ...(form.onlyAboveCeiling ? { onlyAboveCeiling: true } : {}),
    ...(form.onlySodFindings ? { onlySodFindings: true } : {}),
    ...(form.includeSuspended ? { includeSuspended: true } : {}),
  };
  return Object.keys(filtros).length === 0 ? undefined : filtros;
}

/** El vencimiento es el final del día elegido, en la hora de quien lo elige. Una fecha ilegible da una fecha inválida. */
export function dueDateToIso(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined || !Number.isFinite(y + m + d))
    return 'Invalid Date';
  return new Date(y, m - 1, d, 23, 59, 0).toISOString();
}

export function buildDraft(form: DraftForm): CampaignDraft {
  const filters = buildFilters(form);
  return {
    name: form.name.trim(),
    kind: form.kind,
    scope: buildScope(form),
    ...(filters === undefined ? {} : { filters }),
    dueAt: dueDateToIso(form.dueDate),
    graceDays: form.graceDays,
    reminderDaysBefore: form.reminderDays,
    escalateAfterDays: form.escalateAfterDays,
    uncertifiedAction: form.uncertifiedAction,
  };
}

const isInt = (n: number | null, min: number, max: number): boolean =>
  n !== null && Number.isInteger(n) && n >= min && n <= max;

/** Lo que falta o está mal en un paso (1 alcance, 2 filtros, 3 plazos). El 4 solo resume. */
export function stepProblems(
  step: 1 | 2 | 3,
  form: DraftForm,
  now: Date = new Date(),
): readonly DraftProblem[] {
  const problemas: DraftProblem[] = [];
  if (step === 1) {
    const nombre = form.name.trim();
    if (nombre.length < 3)
      problemas.push({ field: 'name', message: 'Escriba un nombre de al menos 3 caracteres.' });
    else if (nombre.length > 120)
      problemas.push({ field: 'name', message: 'El nombre no puede pasar de 120 caracteres.' });
    const falta: Record<CampaignScopeKind, [boolean, string] | null> = {
      ORGANIZATION: null,
      PRACTITIONER: [form.doctorIds.length === 0, 'Elija al menos un doctor.'],
      SERVICE: [form.serviceIds.length === 0, 'Elija al menos un servicio.'],
      LOCATION: [form.locationIds.length === 0, 'Elija al menos una ubicación.'],
      TEMPLATE: [form.templateCodes.length === 0, 'Elija al menos un rol.'],
    };
    const regla = falta[form.scopeKind];
    if (regla !== null && regla[0]) problemas.push({ field: 'scope', message: regla[1] });
  }
  if (step === 2 && form.unusedDays !== null && !isInt(form.unusedDays, 1, 365)) {
    problemas.push({ field: 'unusedDays', message: 'Escriba un número de días entre 1 y 365.' });
  }
  if (step === 3) {
    if (form.dueDate === '')
      problemas.push({ field: 'dueDate', message: 'Elija la fecha límite.' });
    else if (form.dueDate < localDay(now))
      problemas.push({ field: 'dueDate', message: 'La fecha límite debe ser de hoy en adelante.' });
    if (!isInt(form.graceDays, 0, 30))
      problemas.push({ field: 'graceDays', message: 'Los días de gracia van de 0 a 30.' });
    if (!isInt(form.escalateAfterDays, 1, 30))
      problemas.push({
        field: 'escalateAfterDays',
        message: 'Los días para escalar van de 1 a 30.',
      });
  }
  return problemas;
}

interface Named {
  readonly id: string;
  readonly name: string;
}

export interface ScopeCatalog {
  readonly doctors: readonly Named[];
  readonly services: readonly Named[];
  readonly locations: readonly Named[];
}

const namesOf = (ids: readonly string[], list: readonly Named[]): string =>
  ids.map((id) => list.find((n) => n.id === id)?.name ?? 'Sin nombre').join(', ');

/** El alcance con nombres, no con códigos. */
export function scopeSummaryText(form: DraftForm, catalog: ScopeCatalog): string {
  switch (form.scopeKind) {
    case 'ORGANIZATION':
      return 'Toda la organización';
    case 'PRACTITIONER':
      return `Doctores: ${namesOf(form.doctorIds, catalog.doctors)}`;
    case 'SERVICE':
      return `Servicios: ${namesOf(form.serviceIds, catalog.services)}`;
    case 'LOCATION':
      return `Ubicaciones: ${namesOf(form.locationIds, catalog.locations)}`;
    case 'TEMPLATE':
      return `Roles: ${form.templateCodes.map((c) => SUPPORT_ROLE_TEMPLATE_LABELS[c as SupportRoleTemplateCode] ?? 'Rol').join(', ')}`;
  }
}
