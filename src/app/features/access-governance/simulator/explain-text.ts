import { accessErrorText } from '../../../core/data-access/access-governance/access-errors';
import type {
  ExplainAssume,
  ExplainMissing,
  PermissionCatalog,
  PolicyTraceLayer,
  PolicyTraceStep,
  ScenarioChange,
} from '../../../core/data-access/access-governance/access-explain.types';
import type {
  ApproverKind,
  FieldMask,
} from '../../../core/data-access/access-governance/conditions.types';
import {
  ATOM_CATEGORY_LABELS,
  ATOM_SENSITIVITY_LABELS,
  SUPPORT_ATOMS,
  type AtomSensitivity,
} from '../../../core/data-access/support-access/support-atoms';
import type {
  DecisionObligations,
  SupportAccessDecisionView,
} from '../../../core/data-access/support-access/support-decision.types';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';

/* ============================================================================
    Texto de **explicar y simular** (CONTRATO-GOBIERNO §5 y Anexo C).

    Puro y sin DOM: lo comparten el simulador, «Mis accesos» (autoservicio) y «Mi equipo» (doctor). La semántica
    de la decisión es de la API; acá solo se dice, en lenguaje simple y de usted, lo que la API ya resolvió.
   ========================================================================== */

/* ---- el veredicto -------------------------------------------------------------- */

export type VerdictTone = 'success' | 'error' | 'warning';

export interface Verdict {
  /** El glifo se acompaña SIEMPRE del texto: el estado nunca depende solo del color ni del símbolo. */
  readonly icon: '✔' | '✖' | '⚠';
  readonly label: string;
  readonly tone: VerdictTone;
}

/** ✔ puede · ✖ no puede · ⚠ puede, pero falta un requisito (motivo, segundo paso o aprobación). */
export function verdictOf(decision: Pick<SupportAccessDecisionView, 'effect'>): Verdict {
  switch (decision.effect) {
    case 'PERMIT':
      return { icon: '✔', label: 'Sí puede', tone: 'success' };
    case 'CHALLENGE':
      return { icon: '⚠', label: 'Puede, pero falta un requisito', tone: 'warning' };
    case 'DENY':
      return { icon: '✖', label: 'No puede', tone: 'error' };
  }
}

/** Un motivo de decisión en palabras: la tabla de errores primero y, si no está, el código tal cual. */
export function reasonText(reason: string): string {
  return accessErrorText(reason) ?? REASON_FALLBACK[reason] ?? reason;
}

/** Los motivos del Anexo C sin los datos de cada caso (el texto con los datos viene del servidor, en `summary` y en cada paso). */
const REASON_FALLBACK: Readonly<Record<string, string>> = {
  ALLOWED: 'Está permitido por uno de sus permisos.',
  NO_ENGAGEMENT: 'No tiene un vínculo de apoyo con esta organización.',
  ENGAGEMENT_INACTIVE: 'El vínculo no está activo: está suspendido, vencido o terminado.',
  DOCTOR_NOT_ACCEPTED: 'El doctor todavía no aceptó a esta persona.',
  REPLY_NOT_ALLOWED_BY_DOCTOR: 'El doctor no permitió responder mensajes en su nombre.',
  NO_COVERING_GRANT: 'Ningún permiso cubre ese doctor, servicio o espacio.',
  ACTION_NOT_GRANTED: 'Ningún permiso incluye esta acción.',
  TARGET_OUTSIDE_TENANT: 'Ese doctor, servicio o espacio no pertenece a esta organización.',
  NOT_DELEGABLE: 'Esto solo lo puede hacer el administrador de seguridad; no se puede delegar.',
  ORG_RULE_DENY: 'Una regla de la organización lo prohíbe.',
  EXPLICIT_DENY: 'Hay una prohibición expresa para este caso.',
  ONBOARDING_INCOMPLETE: 'Falta completar el ingreso.',
  CONDITION_UNREADABLE:
    'El permiso tiene una condición que el sistema no puede leer. Avise al administrador.',
  TIME_WINDOW: 'Está fuera del horario permitido.',
  LIMIT_EXCEEDED: 'Llegó al límite que el permiso fija.',
  PATIENT_SCOPE: 'Este paciente no está entre los que puede atender.',
  PATIENT_AGE: 'La edad del paciente está fuera de lo permitido.',
  PATIENT_AGE_UNKNOWN: 'No se conoce la edad del paciente y este permiso la exige.',
  PATIENT_COVERAGE: 'El permiso solo alcanza a cierto tipo de pacientes según su seguro.',
  PATIENT_EXCLUDED: 'Este paciente está reservado o excluido de este permiso.',
  APPOINTMENT_WINDOW: 'La cita está fuera de las fechas permitidas.',
  LEAD_TIME: 'Falta anticipación para esa cita.',
  HORIZON: 'La fecha pedida pasa de los días que este permiso permite.',
  CHANNEL_NOT_ALLOWED: 'Este permiso no permite responder por ese canal.',
  CHANNEL_UNKNOWN: 'No se pudo saber por qué canal se envía el mensaje.',
  NETWORK_NOT_ALLOWED: 'Debe conectarse desde la red de la organización.',
  NETWORK_RULES_NOT_CONFIGURED:
    'El permiso pide la red de la organización, pero la organización no definió redes permitidas. Avise al administrador.',
  DEVICE_NOT_TRUSTED: 'Debe usar un equipo de confianza.',
  SESSION_TOO_LONG: 'La sesión pasó del tiempo permitido. Vuelva a iniciar sesión.',
  DOCTOR_OFFLINE: 'El doctor debe estar conectado para esto.',
  AMOUNT_LIMIT: 'El monto supera el límite del permiso.',
  AMOUNT_UNKNOWN: 'No se informó el monto y este permiso lo limita.',
};

/* ---- la traza ------------------------------------------------------------------ */

export const LAYER_LABELS: Readonly<Record<PolicyTraceLayer, string>> = {
  ENGAGEMENT: 'Vínculo',
  GUARDRAIL: 'Barandilla de la plataforma',
  ORG_RULE: 'Regla de la organización',
  EXPLICIT_DENY: 'Prohibición expresa',
  GRANT_COVERAGE: 'Cobertura del permiso',
  CONDITION: 'Condición del permiso',
  OBLIGATION: 'Requisito de la acción',
};

export function layerLabel(layer: string): string {
  return LAYER_LABELS[layer as PolicyTraceLayer] ?? layer;
}

export interface StepView {
  readonly order: number;
  readonly layer: string;
  readonly layerLabel: string;
  readonly passed: boolean;
  /** «Pasó» / «No pasó»: el estado dicho con palabras además del ícono. */
  readonly outcome: string;
  readonly icon: '✔' | '✖';
  readonly message: string;
  readonly decisive: boolean;
  /** El detalle técnico (detrás de «Ver el detalle»): código, ruta de la condición y números reales. */
  readonly technical: readonly { readonly label: string; readonly value: string }[];
}

/** Lo que dice un valor de `details` (números, textos o fechas) sin mostrar `[object Object]`. */
export function detailValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export function stepViews(
  steps: readonly PolicyTraceStep[],
  decidedAtStep: number | undefined,
): readonly StepView[] {
  return [...steps]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      order: s.order,
      layer: s.layer,
      layerLabel: layerLabel(s.layer),
      passed: s.passed,
      outcome: s.passed ? 'Pasó' : 'No pasó',
      icon: s.passed ? '✔' : '✖',
      message: s.message,
      decisive: decidedAtStep !== undefined && s.order === decidedAtStep && !s.passed,
      technical: [
        { label: 'Código', value: s.code },
        ...(s.atom === undefined ? [] : [{ label: 'Permiso', value: s.atom }]),
        ...(s.conditionPath === undefined ? [] : [{ label: 'Condición', value: s.conditionPath }]),
        ...Object.entries(s.details ?? {}).map(([label, value]) => ({
          label,
          value: detailValue(value),
        })),
      ],
    }));
}

/* ---- lo que falta y lo que se pide ---------------------------------------------- */

const MISSING_KIND_LABELS: Readonly<Record<string, string>> = {
  APPROVAL: 'Aprobación',
  REASON: 'Motivo',
  STEP_UP: 'Segundo paso',
  WAIT: 'Esperar',
  NETWORK: 'Red de la organización',
  DEVICE: 'Equipo de confianza',
};

export function missingKindLabel(missing: Pick<ExplainMissing, 'kind'>): string {
  return MISSING_KIND_LABELS[missing.kind] ?? 'Pendiente';
}

export function approverText(by: ApproverKind | string): string {
  switch (by) {
    case 'DOCTOR':
      return 'del doctor';
    case 'SERVICE_HEAD':
      return 'de la jefatura del servicio';
    default:
      return 'de una segunda persona';
  }
}

/** Las obligaciones de la acción, una frase cada una: «Escribir el motivo (al menos 10 caracteres)». */
export function obligationLines(obligations: DecisionObligations): readonly string[] {
  return [
    ...(obligations.reason == null
      ? []
      : [`Escribir el motivo (al menos ${obligations.reason.minLength} caracteres).`]),
    ...(obligations.stepUp == null
      ? []
      : [
          `Confirmar con el código de su aplicación${obligations.stepUp.maxAgeMinutes > 0 ? ` (vale ${obligations.stepUp.maxAgeMinutes} minutos)` : ''}.`,
        ]),
    ...(obligations.approval == null
      ? []
      : [
          `Pedir la aprobación ${approverText(obligations.approval.by)}${obligations.approval.ttlMinutes === undefined ? '' : ` (queda vigente ${obligations.approval.ttlMinutes} minutos)`}.`,
        ]),
  ];
}

const MASK_LABELS: Readonly<Record<FieldMask, string>> = {
  FULL: 'Completo',
  PARTIAL: 'Parcial',
  REDACT: 'Oculto',
  NULLIFY: 'No se muestra',
};
export const maskLabel = (mask: FieldMask | string): string =>
  MASK_LABELS[mask as FieldMask] ?? mask;

/** El nombre simple de un dato visible (`agenda.appointment.view.patient_name`): el del catálogo, o el último tramo. */
export function fieldLabel(code: string): string {
  return SUPPORT_ATOMS.find((a) => a.code === code)?.name ?? code.split('.').pop() ?? code;
}

/* ---- «¿y si…?» (`assume`) -------------------------------------------------------- */

export type AssumeKey = 'stepUpFresh' | 'reasonProvided' | 'approvalGranted' | 'doctorOnline';
export type AssumeChoice = 'REAL' | 'YES' | 'NO';

export interface AssumeFlagDef {
  readonly key: AssumeKey;
  readonly legend: string;
}

export const ASSUME_FLAGS: readonly AssumeFlagDef[] = [
  { key: 'reasonProvided', legend: 'Si escribiera el motivo' },
  { key: 'stepUpFresh', legend: 'Si confirmara con el segundo paso' },
  { key: 'approvalGranted', legend: 'Si tuviera la aprobación' },
  { key: 'doctorOnline', legend: 'Si el doctor estuviera conectado' },
];

export type AssumeChoices = Readonly<Record<AssumeKey, AssumeChoice>>;
export const NO_ASSUMPTIONS: AssumeChoices = {
  reasonProvided: 'REAL',
  stepUpFresh: 'REAL',
  approvalGranted: 'REAL',
  doctorOnline: 'REAL',
};

/** Lo que viaja en `assume`: solo lo que se pisó; `undefined` si no se pisó nada (la API usa lo real). */
export function assumeOf(choices: AssumeChoices, forceFull = false): ExplainAssume | undefined {
  const out: Record<string, boolean> = {};
  for (const flag of ASSUME_FLAGS) {
    if (choices[flag.key] !== 'REAL') out[flag.key] = choices[flag.key] === 'YES';
  }
  if (forceFull) out['forceFull'] = true;
  return Object.keys(out).length === 0 ? undefined : (out as ExplainAssume);
}

export function assumeSummary(assume: ExplainAssume | undefined): string {
  if (assume === undefined) return '';
  const partes = ASSUME_FLAGS.filter((f) => assume[f.key] !== undefined).map(
    (f) =>
      `${f.legend.charAt(0).toLowerCase()}${f.legend.slice(1)}${assume[f.key] === true ? '' : ' (no)'}`,
  );
  return partes.join(', ');
}

/* ---- comparar antes y después (simular) ------------------------------------------ */

export interface ChangeInfo {
  readonly label: string;
  readonly icon: string;
  readonly tone: 'success' | 'error' | 'warning' | 'info' | 'secondary';
  /** Para filtrar «solo lo que cambia». */
  readonly changes: boolean;
}

/**
 * La API manda `SAME`, `NEWLY_ALLOWED`, `NEWLY_DENIED`, `NEWLY_CHALLENGED` o `CHANGED`; el contrato antiguo decía
 * `NEWLY_PERMITTED` para el primero: se acepta como sinónimo.
 */
export function changeInfo(change: ScenarioChange | string): ChangeInfo {
  switch (change) {
    case 'SAME':
      return { label: 'Sin cambio', icon: '=', tone: 'secondary', changes: false };
    case 'NEWLY_ALLOWED':
    case 'NEWLY_PERMITTED':
      return { label: 'Ahora sí puede', icon: '＋', tone: 'success', changes: true };
    case 'NEWLY_DENIED':
      return { label: 'Ya no puede', icon: '－', tone: 'error', changes: true };
    case 'NEWLY_CHALLENGED':
      return { label: 'Ahora pide un requisito', icon: '⚠', tone: 'warning', changes: true };
    default:
      return { label: 'Cambia el motivo', icon: '≠', tone: 'info', changes: true };
  }
}

/** «Puede» / «No puede» / «Puede con un requisito» para las columnas Antes y Después. */
export function decisionWords(decision: SupportAccessDecisionView): string {
  const base = verdictOf(decision).label;
  return decision.effect === 'PERMIT' ? base : `${base} · ${reasonText(decision.reason)}`;
}

export const SOD_ACTION_LABELS: Readonly<Record<string, string>> = {
  BLOCK: 'No se permite',
  REQUIRE_APPROVAL: 'Pide aprobación',
  WARN: 'Aviso',
};

/* ---- opciones de acción (en lenguaje simple) --------------------------------------- */

const SENSITIVITY_ORDER: readonly AtomSensitivity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const sensitivityLabel = (s: AtomSensitivity | string): string =>
  ATOM_SENSITIVITY_LABELS[s as AtomSensitivity] ?? s;
export const sensitivityRank = (s: AtomSensitivity | string): number =>
  SENSITIVITY_ORDER.indexOf(s as AtomSensitivity);

/**
 * Las acciones para elegir: «Agenda · Cancelar citas». Con el catálogo de la API si llegó; si no, el espejo local
 * (`SUPPORT_ATOMS`), que existe justo para eso. `supportOnly` deja fuera lo que el personal de apoyo no puede tener.
 */
export function actionOptions(
  catalog: PermissionCatalog | null,
  supportOnly = false,
): readonly SelectOption<string>[] {
  const categoryName = (code: string): string =>
    catalog?.categories.find((c) => c.code === code)?.name ??
    ATOM_CATEGORY_LABELS[code as keyof typeof ATOM_CATEGORY_LABELS] ??
    code;
  const atoms = catalog?.atoms ?? SUPPORT_ATOMS;
  return atoms
    .filter((a) => !supportOnly || a.supportAssignable)
    .map((a) => ({
      value: a.code,
      label: `${categoryName(a.category)} · ${a.name}`,
      description: `Sensibilidad ${sensitivityLabel(a.sensitivity).toLowerCase()}`,
    }));
}

/** El nombre simple de una acción o permiso, para listas y chips. */
export function actionName(code: string, catalog: PermissionCatalog | null): string {
  return (
    catalog?.atoms.find((a) => a.code === code)?.name ??
    SUPPORT_ATOMS.find((a) => a.code === code)?.name ??
    code
  );
}
