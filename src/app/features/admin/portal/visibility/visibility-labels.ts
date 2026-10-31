import { HttpErrorResponse } from '@angular/common/http';

import type {
  UiElement,
  UiElementKind,
  UiElementSource,
  UiElementStatus,
  UiPreviewEntry,
  UiRuleEffect,
  UiRuleSubjectType,
  UiVisibilityRule,
} from '../../../../core/data-access/ui-visibility/ui-visibility.types';
import { describeApiFailure, fieldErrorsOf, supportCodeOf } from '../../../../core/http/api-failure';
import { readApiError } from '../../../../core/http/api-error';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { Rotulo } from '../../platform/platform-labels';

/* ============================================================================
    Rótulos y mensajes de las pantallas de visibilidad. No deciden nada: un
    código que no está acá se muestra tal cual con tono neutro, y el color nunca
    va solo (siempre hay una palabra al lado).
    ========================================================================== */

const table =
  <K extends string>(entries: Readonly<Record<K, Rotulo>>) =>
  (code: string | null | undefined): Rotulo =>
    code ? ((entries as Readonly<Record<string, Rotulo>>)[code] ?? { label: code, tone: 'secondary' }) : { label: 'Sin dato', tone: 'secondary' };

export const KINDS: readonly UiElementKind[] = ['MODULE', 'MENU_SECTION', 'SCREEN', 'SECTION', 'WIDGET', 'FIELD', 'ACTION'];

export const kindLabel = table<UiElementKind>({
  MODULE: { label: 'Módulo', tone: 'primary' },
  MENU_SECTION: { label: 'Sección del menú', tone: 'secondary' },
  SCREEN: { label: 'Pantalla', tone: 'info' },
  SECTION: { label: 'Sección', tone: 'secondary' },
  WIDGET: { label: 'Panel', tone: 'secondary' },
  FIELD: { label: 'Campo', tone: 'secondary' },
  ACTION: { label: 'Acción', tone: 'warning' },
});

export const sourceLabel = table<UiElementSource>({
  CODE: { label: 'Del código', tone: 'info' },
  ADMIN: { label: 'Alta manual', tone: 'secondary' },
});

export const elementStatusLabel = table<UiElementStatus>({
  ACTIVE: { label: 'Activo', tone: 'success' },
  RETIRED: { label: 'Retirado del código', tone: 'warning' },
});

export const effectLabel = table<UiRuleEffect>({
  HIDE: { label: 'Oculta', tone: 'warning' },
  SHOW: { label: 'Muestra', tone: 'success' },
});

export const SUBJECT_TYPES: readonly UiRuleSubjectType[] = ['ALL', 'ROLE', 'ORG_TYPE', 'TENANT', 'USER'];

export const subjectTypeLabel = table<UiRuleSubjectType>({
  USER: { label: 'Persona', tone: 'secondary' },
  TENANT: { label: 'Organización', tone: 'secondary' },
  ROLE: { label: 'Rol', tone: 'secondary' },
  ORG_TYPE: { label: 'Tipo de organización', tone: 'secondary' },
  ALL: { label: 'Todos', tone: 'secondary' },
});

/** Cuánto pesa cada tipo de sujeto, dicho para la persona (el contrato lo fija: no se elige). */
export const SPECIFICITY_HINT =
  'Si varias reglas coinciden, gana la más específica: persona, organización, rol, tipo de organización, todos. En un empate gana «Oculta».';

export function optionsOf<T extends string>(codes: readonly T[], label: (c: T) => string): readonly SelectOption<string>[] {
  return codes.map((value) => ({ value, label: label(value) }));
}

/* -- Estado de una regla ----------------------------------------------------- */

export type RuleStateCode = 'active' | 'scheduled' | 'ended';

/** Vigente, programada o terminada, según sus fechas. Una terminada se conserva para la auditoría. */
export function ruleState(rule: Pick<UiVisibilityRule, 'validFrom' | 'validTo'>, now: Date = new Date()): Rotulo & { readonly code: RuleStateCode } {
  const to = rule.validTo === null ? null : new Date(rule.validTo).getTime();
  const from = rule.validFrom === null ? null : new Date(rule.validFrom).getTime();
  if (to !== null && to <= now.getTime()) return { code: 'ended', label: 'Terminada', tone: 'secondary' };
  if (from !== null && from > now.getTime()) return { code: 'scheduled', label: 'Programada', tone: 'info' };
  return { code: 'active', label: 'Vigente', tone: 'success' };
}

/** La vigencia en una línea: «Desde … hasta …», o que no tiene fecha de fin. */
export function validityText(rule: Pick<UiVisibilityRule, 'validFrom' | 'validTo'>): string {
  const day = (iso: string): string => new Date(iso).toLocaleDateString('es-BO', { dateStyle: 'medium' });
  if (rule.validFrom === null && rule.validTo === null) return 'Sin fecha de fin';
  if (rule.validFrom !== null && rule.validTo !== null) return `Del ${day(rule.validFrom)} al ${day(rule.validTo)}`;
  return rule.validFrom !== null ? `Desde el ${day(rule.validFrom)}, sin fecha de fin` : `Hasta el ${day(rule.validTo!)}`;
}

/* -- Fechas de los formularios (el campo es de día; el contrato, un instante) ---------- */

/** `YYYY-MM-DD` → instante ISO al comienzo (`start`) o al final (`end`) de ese día en la zona del navegador. */
export function dayToIso(day: string, edge: 'start' | 'end'): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = edge === 'start' ? new Date(y, m - 1, d, 0, 0, 0, 0) : new Date(y, m - 1, d, 23, 59, 59, 0);
  // `new Date(2026, 1, 31)` es el 3 de marzo: un día inexistente no es una fecha.
  return Number.isNaN(date.getTime()) || date.getMonth() !== m - 1 || date.getDate() !== d ? null : date.toISOString();
}

/** El día (`YYYY-MM-DD`) de un instante ISO, en la zona del navegador; `''` si no hay. */
export function isoToDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/* -- Jerarquía ----------------------------------------------------------------------- */

/** La ruta «Farmacia › Pedidos › Exportar» de un elemento, de la raíz hacia él; sin ciclos. */
export function pathOf(key: string, byKey: ReadonlyMap<string, UiElement>): readonly UiElement[] {
  const out: UiElement[] = [];
  const seen = new Set<string>();
  let current = byKey.get(key);
  while (current !== undefined && !seen.has(current.key)) {
    seen.add(current.key);
    out.unshift(current);
    current = current.parentKey === null ? undefined : byKey.get(current.parentKey);
  }
  return out;
}

/** El nombre sin el rótulo «(SIMULADO)» de la maqueta no se toca: se muestra tal cual lo manda la API. */
export function pathText(key: string, byKey: ReadonlyMap<string, UiElement>): string {
  const chain = pathOf(key, byKey);
  return chain.length === 0 ? key : chain.map((e) => e.label).join(' › ');
}

/* -- Qué pasó con un oculto en «ver como» ---------------------------------------------- */

export function previewReason(entry: UiPreviewEntry, labelOf: (key: string) => string): string {
  switch (entry.reason) {
    case 'RULE':
      return entry.hidden ? 'Lo oculta una regla' : 'Una regla lo muestra';
    case 'ANCESTOR_HIDDEN':
      return entry.ancestorKey === null
        ? 'Oculto por cascada: un elemento superior está oculto'
        : `Oculto por cascada: «${labelOf(entry.ancestorKey)}» está oculto y arrastra a todo lo que contiene`;
    case 'DEFAULT':
      return entry.hidden ? 'Ninguna regla lo toca y está oculto por omisión' : 'Visible por omisión';
  }
}

/* -- Errores del servidor ------------------------------------------------------------- */

/** Mensajes para las personas de los códigos estables del contrato. */
const FAILURE_TEXT: Readonly<Record<string, string>> = {
  UI_ELEMENT_NOT_FOUND: 'Ese elemento ya no está en el catálogo. Recargue el catálogo y elija otro.',
  UI_ELEMENT_RETIRED: 'Ese elemento está retirado del código: no admite reglas nuevas.',
  UI_RULE_VERSION_MISMATCH: 'Otra persona cambió esta regla mientras usted la editaba.',
  UI_RULE_DUPLICATE: 'Ya hay una regla vigente para ese elemento y ese sujeto. Edítela o termínela primero.',
  UI_RULE_INVALID_SUBJECT: 'El sujeto de la regla no es válido para el tipo elegido.',
  UI_RULE_ENDED: 'Esa regla ya terminó: cree una nueva en lugar de editarla.',
};

/** El campo del formulario al que pertenece cada código, cuando la API no marcó ninguno. */
const FIELD_OF_CODE: Readonly<Record<string, string>> = {
  UI_ELEMENT_NOT_FOUND: 'elementKey',
  UI_ELEMENT_RETIRED: 'elementKey',
  UI_RULE_INVALID_SUBJECT: 'subjectId',
  UI_RULE_DUPLICATE: 'subjectId',
};

/**
 * El código estable de un fallo: la API lo manda en `reason`, en `details.reason` o, si lo
 * declara como `code`, directo. Se ramifica por él, nunca por el texto.
 */
export function visibilityCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const known = readApiError(error);
  if (known?.reason !== undefined) return known.reason;
  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    for (const value of [record['reason'], (record['details'] as Record<string, unknown> | undefined)?.['reason'], record['code']]) {
      if (typeof value === 'string' && value in FAILURE_TEXT) return value;
    }
  }
  return null;
}

/** El mensaje de un fallo: el del código estable si lo hay, si no el de la pantalla (con el código de soporte). */
export function visibilityFailure(error: unknown, fallback: string): string {
  const code = visibilityCode(error);
  if (code !== null && FAILURE_TEXT[code] !== undefined) {
    const support = error instanceof HttpErrorResponse ? supportCodeOf(error, readApiError(error)) : null;
    return support === null ? FAILURE_TEXT[code] : `${FAILURE_TEXT[code]} (Código de soporte: ${support})`;
  }
  return describeApiFailure(error, fallback);
}

/** Los errores por campo: los que marcó la API y, si no marcó ninguno, el campo que el código señala. */
export function visibilityFieldErrors(error: unknown): Readonly<Record<string, string>> {
  const marked = fieldErrorsOf(error);
  if (Object.keys(marked).length > 0) return marked;
  const code = visibilityCode(error);
  const field = code === null ? undefined : FIELD_OF_CODE[code];
  return field === undefined || code === null ? {} : { [field]: FAILURE_TEXT[code] ?? '' };
}

export const isVersionMismatch = (error: unknown): boolean => visibilityCode(error) === 'UI_RULE_VERSION_MISMATCH';
