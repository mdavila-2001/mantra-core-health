import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  type ConditionLimit,
  type ConditionLimitMetric,
  type ConditionOnExceed,
  type ConditionTimeWindow,
  type FieldMask,
  type PatientRestrictionFlag,
  type SupportCondition,
} from '../../../../core/data-access/access-governance/conditions.types';
import type { PermissionAtomView } from '../../../../core/data-access/access-governance/access-explain.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import type { PlacedIssue } from '../issue-placement';
import { ConditionExtras } from './condition-extras';
import {
  DAY_PRESETS,
  FIELD_MASK_LABELS,
  WEEKDAY_NAMES,
  fieldExample,
  fieldMaskOf,
  getLimit,
  getPath,
  newWindow,
  orNothing,
  presetOfDays,
  sectionCount,
  setFieldMask,
  setLimit,
  setPath,
  type ConditionSection,
} from './condition-form';

const TITLES: Readonly<Record<ConditionSection, string>> = {
  when: 'Cuándo',
  limits: 'Cuánto',
  patients: 'A quién',
  appointment: 'Sobre qué citas',
  channel: 'Por qué canal',
  fields: 'Qué ve',
  amount: 'Montos',
  where: 'Desde dónde',
  presence: 'Con el doctor',
  controls: 'Controles',
  ceiling: 'Techo de delegación',
  deny: 'Cuándo se niega',
};

const PER: readonly SelectOption<string>[] = [
  { value: 'HOUR', label: 'hora' },
  { value: 'DAY', label: 'día' },
  { value: 'WEEK', label: 'semana' },
];
const ON_EXCEED: readonly SelectOption<string>[] = [
  { value: 'DENY', label: 'no dejar' },
  { value: 'REQUIRE_APPROVAL', label: 'pedir aprobación' },
];
const PATIENT_SCOPES: readonly SelectOption<string>[] = [
  { value: 'ANY', label: 'cualquier paciente' },
  { value: 'WITH_APPOINTMENT_WINDOW', label: 'con cita en estas fechas' },
  { value: 'CARE_TEAM_OF_COVERED_DOCTOR', label: 'del equipo asistencial del doctor' },
];
const COVERAGE: readonly SelectOption<string>[] = [
  { value: 'ANY', label: 'con o sin seguro' },
  { value: 'INSURED_ONLY', label: 'asegurados' },
  { value: 'SELF_PAY_ONLY', label: 'sin seguro' },
];
const MASKS: readonly SelectOption<string>[] = (Object.keys(FIELD_MASK_LABELS) as FieldMask[]).map(
  (value) => ({ value, label: FIELD_MASK_LABELS[value] }),
);
const SESSION_HOURS: readonly SelectOption<string>[] = [1, 2, 4, 6, 8, 12].map((h) => ({
  value: String(h * 60),
  label: `${h} ${h === 1 ? 'hora' : 'horas'}`,
}));
const DENY_PATIENTS: readonly SelectOption<string>[] = [
  { value: 'always', label: 'sea cual sea el paciente' },
  { value: 'minor', label: 'es menor de edad' },
  { value: 'adult', label: 'es mayor de edad' },
  { value: 'flagged', label: 'está marcado como reservado' },
  { value: 'insured', label: 'tiene seguro' },
  { value: 'self-pay', label: 'no tiene seguro' },
];

export const RESTRICTION_FLAGS: readonly {
  readonly value: PatientRestrictionFlag;
  readonly label: string;
}[] = [
  { value: 'VIP', label: 'VIP' },
  { value: 'CONFIDENTIAL', label: 'Confidenciales' },
  { value: 'STAFF_RELATIVE', label: 'Familiares del personal' },
  { value: 'PROTECTED', label: 'Protegidos' },
];

const CHANNELS = [
  { value: 'CHAT', label: 'Chat' },
  { value: 'EMAIL', label: 'Correo' },
] as const;

const BILLING_PREFIX = 'billing.';
const DELEGATION_ATOMS = ['team.grants.assign', 'team.requests.decide', 'team.invitations.create'];

/**
 * **Editor de condiciones** (v1) con frases completables. Nadie escribe JSON: cada sección dice una frase
 * («Solo de lunes a viernes de 07:30 a 18:30») y los controles son los huecos. El JSON es el detalle técnico.
 *
 * No valida nada por su cuenta: el servidor (`simulate`) devuelve los errores y esta pantalla los pone **junto al
 * campo** (`issues`). Las secciones que traen condiciones o errores empiezan abiertas.
 */
@Component({
  selector: 'app-condition-editor',
  imports: [AppButton, Checkbox, ConditionExtras, Input, Select, Switch],
  templateUrl: './condition-editor.html',
  styleUrl: './condition-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionEditor {
  /** La condición que se edita (de todo el permiso o de un átomo); `undefined` si no tiene ninguna. */
  readonly condition = input<SupportCondition | undefined>(undefined);
  /** Los permisos precisos que esta condición cubre: de ellos depende qué secciones tienen sentido. */
  readonly atoms = input<readonly PermissionAtomView[]>([]);
  /** Una fila «Denegar» solo admite horario, citas, canal, presencia y un alcance de paciente. */
  readonly deny = input(false);
  /** Los errores y avisos del servidor que corresponden a esta condición. */
  readonly issues = input<readonly PlacedIssue[]>([]);

  readonly conditionChange = output<SupportCondition | undefined>();

  protected readonly titles = TITLES;
  protected readonly per = PER;
  protected readonly onExceed = ON_EXCEED;
  protected readonly patientScopes = PATIENT_SCOPES;
  protected readonly coverage = COVERAGE;
  protected readonly masks = MASKS;
  protected readonly sessionHours = SESSION_HOURS;
  protected readonly denyPatients = DENY_PATIENTS;
  protected readonly flags = RESTRICTION_FLAGS;
  protected readonly channels = CHANNELS;
  protected readonly dayPresets: readonly SelectOption<string>[] = [
    ...DAY_PRESETS.map((p) => ({ value: p.value, label: p.label })),
    { value: 'custom', label: 'otros días…' },
  ];
  protected readonly weekdays = WEEKDAY_NAMES.map((name, day) => ({ day, name }));
  protected readonly metrics: readonly {
    readonly metric: ConditionLimitMetric;
    readonly noun: string;
    readonly lead: string;
  }[] = [
    { metric: 'ACTIONS', noun: 'veces', lead: 'Hasta' },
    { metric: 'DISTINCT_PATIENTS', noun: 'pacientes distintos', lead: 'Con no más de' },
  ];

  private readonly overrides = signal<ReadonlyMap<ConditionSection, boolean>>(new Map());
  private readonly customDays = signal<ReadonlySet<number>>(new Set());

  protected readonly sections = computed<readonly ConditionSection[]>(() => {
    const atoms = this.atoms();
    if (this.deny()) return ['when', 'appointment', 'channel', 'presence', 'deny'];
    const all: ConditionSection[] = ['when', 'limits', 'patients', 'appointment', 'channel'];
    if (atoms.some((a) => a.isFieldLevel)) all.push('fields');
    if (atoms.some((a) => a.code.startsWith(BILLING_PREFIX))) all.push('amount');
    all.push('where', 'presence', 'controls');
    if (atoms.some((a) => DELEGATION_ATOMS.includes(a.code))) all.push('ceiling');
    return all;
  });

  protected readonly fieldAtoms = computed(() => this.atoms().filter((a) => a.isFieldLevel));
  protected readonly total = computed(() =>
    this.sections().reduce((sum, s) => sum + sectionCount(this.condition(), s), 0),
  );
  protected readonly windows = computed<readonly ConditionTimeWindow[]>(
    () => this.condition()?.time?.windows ?? [],
  );

  /* ---- secciones: abrir, contar, errores ----------------------------------------------------- */

  protected title(section: ConditionSection): string {
    const n = sectionCount(this.condition(), section);
    return n === 0
      ? TITLES[section]
      : `${TITLES[section]} · ${n} ${n === 1 ? 'condición' : 'condiciones'}`;
  }
  protected issuesOf(section: ConditionSection): readonly PlacedIssue[] {
    return this.issues().filter((i) => i.section === section);
  }
  protected loose = computed(() =>
    this.issues().filter((i) => i.section === undefined || !this.sections().includes(i.section)),
  );
  protected isInvalid(section: ConditionSection): boolean {
    return this.issuesOf(section).some((i) => i.severity === 'error');
  }
  protected isOpen(section: ConditionSection): boolean {
    return (
      this.overrides().get(section) ??
      (sectionCount(this.condition(), section) > 0 || this.issuesOf(section).length > 0)
    );
  }
  protected toggle(section: ConditionSection): void {
    this.overrides.update((m) => new Map(m).set(section, !this.isOpen(section)));
  }

  /* ---- cambios ------------------------------------------------------------------------------- */

  private emit(next: SupportCondition): void {
    this.conditionChange.emit(orNothing(next));
  }
  /** Lo que cambia una sección hija: ya viene limpio. */
  protected forward(condition: SupportCondition | undefined): void {
    this.conditionChange.emit(condition);
  }
  protected set(path: readonly string[], value: unknown): void {
    this.emit(setPath(this.condition(), path, value));
  }
  protected get<T>(path: readonly string[]): T | undefined {
    return getPath<T>(this.condition(), path);
  }
  protected has(path: readonly string[]): boolean {
    return this.get(path) !== undefined;
  }
  protected str(path: readonly string[]): string | undefined {
    return this.get<string>(path);
  }
  protected isTrue(path: readonly string[]): boolean {
    return this.get<boolean>(path) === true;
  }
  /** Lo que escribe un campo numérico: un entero, o `undefined` si está vacío. */
  protected int(value: string | number | null): number | undefined {
    if (value === null || value === '') return undefined;
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? n : undefined;
  }
  protected numberAt(path: readonly string[]): number | string {
    return this.get<number>(path) ?? '';
  }
  protected setNumber(
    path: readonly string[],
    value: string | number | null,
    whenEmpty?: unknown,
  ): void {
    this.set(path, this.int(value) ?? whenEmpty);
  }

  /* horarios */
  protected addWindow(): void {
    this.set(['time', 'windows'], [...this.windows(), newWindow()]);
  }
  protected removeWindow(index: number): void {
    this.set(
      ['time', 'windows'],
      this.windows().filter((_, i) => i !== index),
    );
  }
  private changeWindow(index: number, patch: Partial<ConditionTimeWindow>): void {
    this.set(
      ['time', 'windows'],
      this.windows().map((w, i) => (i === index ? { ...w, ...patch } : w)),
    );
  }
  protected daysPreset(window: ConditionTimeWindow, index: number): string {
    return this.customDays().has(index) ? 'custom' : presetOfDays(window.days);
  }
  protected setDaysPreset(index: number, value: string | null): void {
    if (value === 'custom') {
      this.customDays.update((s) => new Set(s).add(index));
      return;
    }
    this.customDays.update((s) => {
      const next = new Set(s);
      next.delete(index);
      return next;
    });
    const preset = DAY_PRESETS.find((p) => p.value === value);
    if (preset !== undefined) this.changeWindow(index, { days: preset.days });
  }
  protected toggleDay(index: number, day: number, on: boolean): void {
    const current = this.windows()[index]?.days ?? [];
    const days = on
      ? [...new Set([...current, day])].sort((a, b) => a - b)
      : current.filter((d) => d !== day);
    // Una franja sin ningún día no cubre nada: la última casilla no se puede apagar.
    if (days.length > 0) this.changeWindow(index, { days });
  }
  protected setTime(index: number, key: 'from' | 'to', value: string | number | null): void {
    if (typeof value === 'string' && value !== '') this.changeWindow(index, { [key]: value });
  }

  /* límites */
  protected limit(metric: ConditionLimitMetric): ConditionLimit | undefined {
    return getLimit(this.condition(), metric);
  }
  protected toggleLimit(metric: ConditionLimitMetric, on: boolean): void {
    this.emit(
      setLimit(
        this.condition(),
        metric,
        on
          ? { metric, per: 'DAY', max: metric === 'ACTIONS' ? 20 : 15, onExceed: 'DENY' }
          : undefined,
      ),
    );
  }
  protected patchLimit(metric: ConditionLimitMetric, patch: Partial<ConditionLimit>): void {
    const current = this.limit(metric);
    if (current !== undefined)
      this.emit(setLimit(this.condition(), metric, { ...current, ...patch }));
  }
  protected setLimitMax(metric: ConditionLimitMetric, value: string | number | null): void {
    const max = this.int(value);
    if (max !== undefined) this.patchLimit(metric, { max });
  }

  /* pacientes */
  protected setPatientScope(value: string | null): void {
    const withWindow = value === 'WITH_APPOINTMENT_WINDOW';
    const scoped = setPath(
      this.condition(),
      ['patients', 'scope'],
      value === 'ANY' || value === null ? undefined : value,
    );
    this.emit(
      setPath(
        scoped,
        ['patients', 'appointmentWindow'],
        withWindow ? { daysBefore: 1, daysAfter: 14 } : undefined,
      ),
    );
  }
  protected hasFlag(flag: PatientRestrictionFlag): boolean {
    return this.get<readonly string[]>(['patients', 'exclude', 'flags'])?.includes(flag) ?? false;
  }
  protected toggleFlag(flag: PatientRestrictionFlag, on: boolean): void {
    const current = this.get<readonly string[]>(['patients', 'exclude', 'flags']) ?? [];
    this.set(
      ['patients', 'exclude', 'flags'],
      on ? [...new Set([...current, flag])] : current.filter((f) => f !== flag),
    );
  }
  protected denyPatient(): string {
    const p = this.condition()?.patients;
    if (p === undefined) return 'always';
    if (p.isMinor === true) return 'minor';
    if (p.isMinor === false) return 'adult';
    if (p.flags !== undefined) return 'flagged';
    if (p.coverage?.mode === 'INSURED_ONLY') return 'insured';
    if (p.coverage?.mode === 'SELF_PAY_ONLY') return 'self-pay';
    return 'always';
  }
  protected setDenyPatient(value: string | null): void {
    const patients: Record<string, unknown> | undefined =
      value === 'minor'
        ? { isMinor: true }
        : value === 'adult'
          ? { isMinor: false }
          : value === 'flagged'
            ? { flags: { anyOf: this.flags.map((f) => f.value) } }
            : value === 'insured'
              ? { coverage: { mode: 'INSURED_ONLY' } }
              : value === 'self-pay'
                ? { coverage: { mode: 'SELF_PAY_ONLY' } }
                : undefined;
    this.set(['patients'], patients);
  }

  /* canal */
  protected hasChannel(channel: string): boolean {
    return this.get<readonly string[]>(['channels', 'allow'])?.includes(channel) ?? false;
  }
  protected toggleChannel(channel: string, on: boolean): void {
    const current = this.get<readonly string[]>(['channels', 'allow']) ?? [];
    this.set(
      ['channels', 'allow'],
      on ? [...new Set([...current, channel])] : current.filter((c) => c !== channel),
    );
  }

  /* campos */
  protected mask(atom: string): FieldMask {
    return fieldMaskOf(this.condition(), atom);
  }
  protected setMask(atom: string, value: string | null): void {
    this.emit(setFieldMask(this.condition(), atom, (value ?? 'FULL') as FieldMask));
  }
  protected example(atom: string): string {
    return fieldExample(atom, this.mask(atom));
  }

  /* sesión */
  protected sessionValue(): string {
    const minutes = this.get<number>(['session', 'maxSessionMinutes']);
    return minutes === undefined ? '' : String(minutes);
  }
  protected setSession(value: string | null): void {
    this.set(['session', 'maxSessionMinutes'], value === null ? undefined : Number(value));
  }
  protected onOff(path: readonly string[], on: boolean, value: unknown): void {
    this.set(path, on ? value : undefined);
  }

  protected exceedOf(value: ConditionOnExceed | undefined): string {
    return value ?? 'DENY';
  }
}
