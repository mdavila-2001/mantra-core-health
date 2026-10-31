import {
  CONDITION_SCHEMA_VERSION,
  emptyCondition,
  type ConditionLimit,
  type ConditionLimitMetric,
  type ConditionTimeWindow,
  type FieldMask,
  type SupportCondition,
} from '../../../../core/data-access/access-governance/conditions.types';

/* ============================================================================
    Edición pura de una condición v1 (`condition_json`) sin que nadie escriba JSON.

    El editor arma la condición con frases completables; acá están las funciones que la cambian (siempre devuelven
    una nueva) y las que la leen. **No decide nada**: la autoridad es el servidor (`simulate` devuelve los 422 y el
    editor los marca junto al campo). Una clave vacía se quita: «null» lo rechaza el servidor.
   ========================================================================== */

/** Las secciones del editor, en el orden en que se muestran. */
export const CONDITION_SECTIONS = [
  'when',
  'limits',
  'patients',
  'appointment',
  'channel',
  'fields',
  'amount',
  'where',
  'presence',
  'controls',
  'ceiling',
  'deny',
] as const;
export type ConditionSection = (typeof CONDITION_SECTIONS)[number];

/** Qué claves de la condición pertenecen a cada sección. */
const SECTION_KEYS: Readonly<Record<ConditionSection, readonly (keyof SupportCondition)[]>> = {
  when: ['time'],
  limits: ['limits'],
  patients: ['patients'],
  appointment: ['appointment'],
  channel: ['channels'],
  fields: ['fields'],
  amount: ['amount'],
  where: ['network', 'device', 'session'],
  presence: ['presence'],
  controls: ['obligations'],
  ceiling: ['delegationCeiling'],
  deny: ['patients'],
};

/** La sección donde se muestra el error de una clave de condición (`time`, `appointment`, …). */
export function sectionOfKey(key: string, isDeny = false): ConditionSection | undefined {
  if (isDeny && key === 'patients') return 'deny';
  return CONDITION_SECTIONS.find(
    (section) => section !== 'deny' && (SECTION_KEYS[section] as readonly string[]).includes(key),
  );
}

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0);

/** Quita lo vacío de un valor, hacia adentro: un objeto sin claves o un arreglo sin elementos no restringe nada. */
function prune(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(prune).filter((item) => !isEmpty(item));
    return items;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => [key, prune(child)] as const)
      .filter(
        ([, child]) =>
          child !== undefined && !(typeof child === 'object' && child !== null && isEmpty(child)),
      );
    return Object.fromEntries(entries);
  }
  return value;
}

/** Pone (o quita, con `undefined`) un valor en `path` y limpia lo que quede vacío. */
export function setPath(
  condition: SupportCondition | undefined,
  path: readonly string[],
  value: unknown,
): SupportCondition {
  const base = condition ?? emptyCondition();
  const write = (node: Record<string, unknown>, index: number): Record<string, unknown> => {
    const key = path[index]!;
    if (index === path.length - 1) {
      const { [key]: _old, ...rest } = node;
      return value === undefined ? rest : { ...rest, [key]: value };
    }
    const child = (node[key] ?? {}) as Record<string, unknown>;
    return { ...node, [key]: write(child, index + 1) };
  };
  const written = write(base as unknown as Record<string, unknown>, 0);
  const pruned = prune(written) as Record<string, unknown>;
  return { ...pruned, schemaVersion: CONDITION_SCHEMA_VERSION } as unknown as SupportCondition;
}

/** Lee el valor en `path`. */
export function getPath<T = unknown>(
  condition: SupportCondition | undefined,
  path: readonly string[],
): T | undefined {
  let node: unknown = condition;
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node as T | undefined;
}

/** `undefined` si la condición no restringe nada (solo trae la versión). */
export function orNothing(condition: SupportCondition): SupportCondition | undefined {
  return Object.keys(condition).some((key) => key !== 'schemaVersion') ? condition : undefined;
}

/** Cuántas condiciones tiene una sección (el botón de la sección lo dice). */
export function sectionCount(
  condition: SupportCondition | undefined,
  section: ConditionSection,
): number {
  if (condition === undefined) return 0;
  if (section === 'limits') return condition.limits?.length ?? 0;
  return SECTION_KEYS[section].filter((key) => condition[key] !== undefined).length;
}

/* ---- horarios ------------------------------------------------------------------------- */

export const WEEKDAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

export interface DayPreset {
  readonly value: string;
  readonly label: string;
  readonly days: readonly number[];
}

export const DAY_PRESETS: readonly DayPreset[] = [
  { value: 'weekdays', label: 'lunes a viernes', days: [1, 2, 3, 4, 5] },
  { value: 'mon-sat', label: 'lunes a sábado', days: [1, 2, 3, 4, 5, 6] },
  { value: 'every-day', label: 'todos los días', days: [0, 1, 2, 3, 4, 5, 6] },
  { value: 'saturday', label: 'sábados', days: [6] },
  { value: 'weekend', label: 'sábados y domingos', days: [0, 6] },
];

/** El preajuste que coincide con esos días, o `custom`. */
export function presetOfDays(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  return (
    DAY_PRESETS.find(
      (p) => p.days.length === sorted.length && p.days.every((d, i) => d === sorted[i]),
    )?.value ?? 'custom'
  );
}

export function newWindow(): ConditionTimeWindow {
  return { days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' };
}

/** Los días en una frase: «lunes a viernes», «martes y jueves». */
export function describeDays(days: readonly number[]): string {
  const preset = DAY_PRESETS.find((p) => p.value === presetOfDays(days));
  if (preset !== undefined) return preset.label;
  const names = [...days].sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d] ?? '?');
  return names.length <= 1
    ? (names[0] ?? 'ningún día')
    : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/* ---- límites -------------------------------------------------------------------------- */

export function getLimit(
  condition: SupportCondition | undefined,
  metric: ConditionLimitMetric,
): ConditionLimit | undefined {
  return condition?.limits?.find((limit) => limit.metric === metric);
}

/** Pone (o quita) el límite de una métrica; se mantienen los de las otras. */
export function setLimit(
  condition: SupportCondition | undefined,
  metric: ConditionLimitMetric,
  limit: ConditionLimit | undefined,
): SupportCondition {
  const others = (condition?.limits ?? []).filter((l) => l.metric !== metric);
  return setPath(condition, ['limits'], limit === undefined ? others : [...others, limit]);
}

/* ---- campos --------------------------------------------------------------------------- */

export const FIELD_MASK_LABELS: Readonly<Record<FieldMask, string>> = {
  FULL: 'completo',
  PARTIAL: 'parcial',
  REDACT: 'tachado',
  NULLIFY: 'oculto',
};

/** Cuánto se ve de un campo; sin entrada es «completo». */
export function fieldMaskOf(condition: SupportCondition | undefined, atom: string): FieldMask {
  return condition?.fields?.[atom]?.mask ?? 'FULL';
}

export function setFieldMask(
  condition: SupportCondition | undefined,
  atom: string,
  mask: FieldMask,
): SupportCondition {
  return setPath(condition, ['fields', atom], mask === 'FULL' ? undefined : { mask });
}

interface FieldSample {
  readonly full: string;
  readonly partial: string;
}

const FIELD_SAMPLES: Readonly<Record<string, FieldSample>> = {
  'agenda.appointment.view.patient_name': { full: 'Carmen Ortiz Vaca', partial: 'Carmen O.' },
  'agenda.appointment.view.patient_phone': { full: '71234567', partial: '7******7' },
  'patients.profile.view.phone_full': { full: '71234567', partial: '7******7' },
  'agenda.appointment.view.patient_document': { full: '4567890 LP', partial: '*****90' },
  'patients.profile.view.document_full': { full: '4567890 LP', partial: '*****90' },
  'agenda.appointment.view.reason': {
    full: 'Dolor de cabeza desde hace tres días',
    partial: 'Dolor de cabeza desde hace tres d…',
  },
  'agenda.appointment.view.insurance': {
    full: 'Seguro Universal · afiliada 8841',
    partial: 'Seguro Universal',
  },
  'agenda.appointment.view.price': { full: 'Bs 250', partial: 'Bs 2**' },
};

/** Un ejemplo de cómo se vería el campo, solo para entender la opción: lo que se muestra de verdad lo decide el servidor. */
export function fieldExample(atom: string, mask: FieldMask): string {
  const sample = FIELD_SAMPLES[atom] ?? { full: 'Dato de ejemplo', partial: 'Da** de ej…' };
  switch (mask) {
    case 'FULL':
      return sample.full;
    case 'PARTIAL':
      return sample.partial;
    case 'REDACT':
      return '██████';
    case 'NULLIFY':
      return '(no se muestra)';
  }
}
