import { etiquetaDeRol } from '../../auth/role-labels';
import type { AllowedHours, SessionPolicy, SessionPolicyScope } from './support-access.types';

/**
 * Lógica pura de los **controles de sesión** de la organización: cómo se arma una
 * política, cómo se lee el horario laboral, cuáles reglas rigen para una persona
 * y cómo se dice, en lenguaje simple, lo que cada control hace.
 *
 * Replica la lectura de la API (`domain/session-policy.ts`): rigen **todas** las
 * reglas que alcanzan a la persona y se queda con la más estricta —el menor plazo
 * de inactividad, el segundo factor si alguna lo exige, y cada franja horaria
 * tiene que cumplirse—. No autoriza nada: quien corta o deja pasar es la API al
 * emitir el token. Esto solo prepara lo que se guarda y lo que se muestra.
 */

export const IDLE_MINUTES_MIN = 5;
export const IDLE_MINUTES_MAX = 120;
/** Los plazos que se ofrecen: alcanzan para casi todo y evitan escribir un número suelto. */
export const IDLE_MINUTES_CHOICES: readonly number[] = [5, 10, 15, 20, 30, 45, 60, 90, 120];

export const DEFAULT_TIME_ZONE = 'America/La_Paz';

/** Los roles a los que una regla puede apuntar. Los demás códigos del token no se ofrecen: nadie los reconocería. */
export const POLICY_ROLE_CODES: readonly string[] = ['PRACTITIONER', 'CLINICIAN', 'SECURITY_ADMIN', 'SCHEDULING_ADMIN', 'SCHEDULING_AGENT', 'BILLING_OPERATOR', 'CASHIER'];

/** Lunes primero, que es como se lee una semana de trabajo. Los números son los de la API (0 = domingo). */
export const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];

const DAY_NAMES: Readonly<Record<number, string>> = { 0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves', 5: 'viernes', 6: 'sábado' };
const DAY_SHORT: Readonly<Record<number, string>> = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };

export function dayName(day: number): string {
  return DAY_NAMES[day] ?? '';
}
export function dayShort(day: number): string {
  return DAY_SHORT[day] ?? '';
}

/** La política con la que arranca una regla nueva: la más cómoda, sin restricciones. */
export function newPolicy(scope: SessionPolicyScope, roleCode?: string): SessionPolicy {
  return {
    scope,
    ...(roleCode === undefined ? {} : { roleCode }),
    idleTimeoutMinutes: 15,
    newDeviceAlert: true,
    enforceIpRules: false,
    requireMfa: false,
  };
}

export function policyKey(policy: Pick<SessionPolicy, 'scope' | 'roleCode'>): string {
  return policy.scope === 'ROLE' ? `ROLE:${policy.roleCode ?? ''}` : policy.scope;
}

export function findPolicy(policies: readonly SessionPolicy[], scope: SessionPolicyScope, roleCode?: string): SessionPolicy | undefined {
  const key = policyKey({ scope, ...(roleCode === undefined ? {} : { roleCode }) });
  return policies.find((p) => policyKey(p) === key);
}

/** Cambia (o agrega) una política sin tocar las demás. Devuelve una lista nueva. */
export function upsertPolicy(policies: readonly SessionPolicy[], next: SessionPolicy): readonly SessionPolicy[] {
  const key = policyKey(next);
  return policies.some((p) => policyKey(p) === key) ? policies.map((p) => (policyKey(p) === key ? next : p)) : [...policies, next];
}

export function removePolicy(policies: readonly SessionPolicy[], scope: SessionPolicyScope, roleCode?: string): readonly SessionPolicy[] {
  const key = policyKey({ scope, ...(roleCode === undefined ? {} : { roleCode }) });
  return policies.filter((p) => policyKey(p) !== key);
}

/* ---- el horario laboral ------------------------------------------------------- */

export const DEFAULT_HOURS: AllowedHours = { days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00', timeZone: DEFAULT_TIME_ZONE };

/** Las opciones de hora del editor: cada media hora. */
export const HOUR_CHOICES: readonly string[] = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Los días en que rige; una lista vacía o ausente es «todos». */
export function activeDays(hours: AllowedHours): readonly number[] {
  return hours.days === undefined || hours.days.length === 0 ? WEEK_ORDER : hours.days;
}

/** La franja cruza la medianoche (empieza de noche y termina de madrugada). */
export function crossesMidnight(hours: Pick<AllowedHours, 'from' | 'to'>): boolean {
  return minutesOf(hours.to) < minutesOf(hours.from);
}

/**
 * Si el horario deja entrar a esa hora de ese día (`0` = domingo). Misma regla que
 * la API: pasada la medianoche, la franja pertenece al día en que empezó.
 */
export function isAllowedAt(hours: AllowedHours | undefined, day: number, minutes: number): boolean {
  if (hours === undefined) return true;
  const from = minutesOf(hours.from);
  const to = minutesOf(hours.to);
  const crosses = to < from;
  const inRange = crosses ? minutes >= from || minutes < to : minutes >= from && minutes < to;
  if (!inRange) return false;
  if (hours.days === undefined || hours.days.length === 0) return true;
  const startDay = crosses && minutes < to ? (day + 6) % 7 : day;
  return hours.days.includes(startDay);
}

/** Para cada día de la semana (lunes primero), los tramos de 0 a 24 h en que se puede entrar: lo que dibuja la barra del editor. */
export function dayBands(hours: AllowedHours): readonly { readonly day: number; readonly bands: readonly { readonly from: number; readonly to: number }[] }[] {
  const from = minutesOf(hours.from);
  const to = minutesOf(hours.to);
  const dias = activeDays(hours);
  return WEEK_ORDER.map((day) => {
    const bands: { from: number; to: number }[] = [];
    if (from === to) return { day, bands };
    if (to > from) {
      if (dias.includes(day)) bands.push({ from, to });
    } else {
      // Cruza la medianoche: de `from` al fin del día que empieza, y del inicio al `to` del día que sigue.
      if (dias.includes(day)) bands.push({ from, to: 1440 });
      if (dias.includes((day + 6) % 7)) bands.push({ from: 0, to });
    }
    return { day, bands };
  });
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** «Lunes a viernes, de 08:00 a 18:00», o «Todos los días, de 22:00 a 06:00 (cruza la medianoche)». */
export function describeHours(hours: AllowedHours | undefined): string {
  if (hours === undefined) return 'Sin restricción: se puede entrar a cualquier hora, todos los días.';
  const set = new Set(activeDays(hours));
  const grupos: string[] = [];
  let i = 0;
  while (i < WEEK_ORDER.length) {
    if (!set.has(WEEK_ORDER[i]!)) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < WEEK_ORDER.length && set.has(WEEK_ORDER[j + 1]!)) j += 1;
    const primero = dayName(WEEK_ORDER[i]!);
    const ultimo = dayName(WEEK_ORDER[j]!);
    grupos.push(i === j ? primero : j === i + 1 ? `${primero} y ${ultimo}` : `${primero} a ${ultimo}`);
    i = j + 1;
  }
  const dias = set.size === 7 ? 'todos los días' : grupos.join(', ');
  const cuando = `de ${hours.from} a ${hours.to}${crossesMidnight(hours) ? ' (cruza la medianoche)' : ''}`;
  const frase = `${dias}, ${cuando}`;
  return frase.charAt(0).toLocaleUpperCase('es') + frase.slice(1);
}

/** Día de la semana (`0` = domingo) y minutos del día en la zona horaria de la organización. */
export function weekdayAndMinutes(date: Date, timeZone: string = DEFAULT_TIME_ZONE): { day: number; minutes: number } {
  const formato = (zona: string): Intl.DateTimeFormatPart[] =>
    new Intl.DateTimeFormat('en-US', { timeZone: zona, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  let partes: Intl.DateTimeFormatPart[];
  try {
    partes = formato(timeZone);
  } catch {
    partes = formato(DEFAULT_TIME_ZONE);
  }
  const get = (type: string): string => partes.find((p) => p.type === type)?.value ?? '';
  return { day: Math.max(0, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))), minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
}

/* ---- qué reglas rigen ---------------------------------------------------------- */

/** A quién se le aplican las reglas que se quieren ver. */
export type Audience =
  /** Una cuenta cualquiera (sin rol más allá del básico). */
  | { readonly kind: 'ACCOUNT' }
  /** Alguien del personal: tiene algún rol más allá de paciente. */
  | { readonly kind: 'STAFF' }
  /** Alguien del personal con ese rol. */
  | { readonly kind: 'ROLE'; readonly roleCode: string };

/** Las reglas que alcanzan a esa persona: todas las de «todas las cuentas», las del personal si lo es y las de su rol. */
export function applicablePolicies(policies: readonly SessionPolicy[], audience: Audience): readonly SessionPolicy[] {
  return policies.filter((p) => {
    if (p.scope === 'ALL_ACCOUNTS') return true;
    if (p.scope === 'ORG_STAFF') return audience.kind !== 'ACCOUNT';
    return audience.kind === 'ROLE' && p.roleCode === audience.roleCode;
  });
}

/** Lo que rige al final, combinando las reglas que alcanzan a la persona. */
export interface EffectiveRules {
  readonly idleTimeoutMinutes?: number;
  readonly newDeviceAlert: boolean;
  readonly enforceIpRules: boolean;
  readonly requireMfa: boolean;
  /** Franjas que se tienen que cumplir **todas**. */
  readonly allowedHours: readonly AllowedHours[];
}

/** La combinación más estricta, como la hace la API. */
export function effectiveRules(policies: readonly SessionPolicy[], audience: Audience): EffectiveRules {
  const aplican = applicablePolicies(policies, audience);
  return {
    ...(aplican.length === 0 ? {} : { idleTimeoutMinutes: Math.min(...aplican.map((p) => p.idleTimeoutMinutes)) }),
    newDeviceAlert: aplican.some((p) => p.newDeviceAlert),
    enforceIpRules: aplican.some((p) => p.enforceIpRules),
    requireMfa: aplican.some((p) => p.requireMfa),
    allowedHours: aplican.flatMap((p) => (p.allowedHours === undefined ? [] : [p.allowedHours])),
  };
}

/* ---- comparar y validar --------------------------------------------------------- */

function sameHours(a: AllowedHours | undefined, b: AllowedHours | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  const dias = (h: AllowedHours): string => [...activeDays(h)].sort((x, y) => x - y).join(',');
  return a.from === b.from && a.to === b.to && dias(a) === dias(b) && (a.timeZone ?? DEFAULT_TIME_ZONE) === (b.timeZone ?? DEFAULT_TIME_ZONE);
}

export function samePolicy(a: SessionPolicy, b: SessionPolicy): boolean {
  return (
    policyKey(a) === policyKey(b) &&
    a.idleTimeoutMinutes === b.idleTimeoutMinutes &&
    a.newDeviceAlert === b.newDeviceAlert &&
    a.enforceIpRules === b.enforceIpRules &&
    a.requireMfa === b.requireMfa &&
    sameHours(a.allowedHours, b.allowedHours)
  );
}

export function samePolicies(a: readonly SessionPolicy[], b: readonly SessionPolicy[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p) => {
    const otra = b.find((q) => policyKey(q) === policyKey(p));
    return otra !== undefined && samePolicy(p, otra);
  });
}

export function roleLabel(code: string): string {
  return etiquetaDeRol(code) ?? code;
}

export function scopeLabel(policy: Pick<SessionPolicy, 'scope' | 'roleCode'>): string {
  switch (policy.scope) {
    case 'ALL_ACCOUNTS':
      return 'Todas las cuentas';
    case 'ORG_STAFF':
      return 'Personal de la organización';
    case 'ROLE':
      return policy.roleCode === undefined ? 'Un rol' : `Rol: ${roleLabel(policy.roleCode)}`;
  }
}

/** Lo mínimo que dura una franja de horario permitido: la API rechaza menos como un cierre de hecho (`SESSION_POLICY_HOURS_TOO_SHORT`). */
export const MIN_ALLOWED_HOURS_MINUTES = 240;

/**
 * Cuánto dura la franja, en minutos; la que cruza la medianoche suma los dos tramos. `desde == hasta` no es una franja de
 * 24 horas sino una **vacía**: nadie podría entrar (`0`).
 */
export function hoursDurationMinutes(hours: Pick<AllowedHours, 'from' | 'to'>): number {
  const from = minutesOf(hours.from);
  const to = minutesOf(hours.to);
  return to >= from ? to - from : 24 * 60 - from + to;
}

/**
 * Por qué la franja no se puede guardar, o `null` si sirve. Son las mismas dos reglas que la API hace cumplir al guardar
 * (`SESSION_POLICY_HOURS_EMPTY` y `SESSION_POLICY_HOURS_TOO_SHORT`): se dicen **antes** de ir a la red.
 */
export function hoursProblem(hours: AllowedHours | undefined): string | null {
  if (hours === undefined) return null;
  if (hours.from === hours.to) return 'el horario empieza y termina a la misma hora, así que no admite a nadie. Elija una hora de inicio distinta de la de fin.';
  if (hoursDurationMinutes(hours) < MIN_ALLOWED_HOURS_MINUTES) {
    return `el horario dura menos de ${MIN_ALLOWED_HOURS_MINUTES / 60} horas, y una franja tan corta equivale a cerrar el acceso. Amplíela a ${MIN_ALLOWED_HOURS_MINUTES / 60} horas o más.`;
  }
  return null;
}

/** Los problemas que impiden guardar, en palabras de quien edita. Vacío si se puede guardar. */
export function validatePolicies(policies: readonly SessionPolicy[]): readonly string[] {
  const problemas: string[] = [];
  const vistas = new Set<string>();
  for (const p of policies) {
    const donde = scopeLabel(p);
    if (vistas.has(policyKey(p))) problemas.push(`${donde}: hay dos reglas iguales.`);
    vistas.add(policyKey(p));
    if (p.scope === 'ROLE' && (p.roleCode === undefined || p.roleCode === '')) problemas.push('Una regla por rol necesita elegir el rol.');
    if (!Number.isInteger(p.idleTimeoutMinutes) || p.idleTimeoutMinutes < IDLE_MINUTES_MIN || p.idleTimeoutMinutes > IDLE_MINUTES_MAX) {
      problemas.push(`${donde}: el cierre por inactividad va de ${IDLE_MINUTES_MIN} a ${IDLE_MINUTES_MAX} minutos.`);
    }
    const franja = hoursProblem(p.allowedHours);
    if (franja !== null) problemas.push(`${donde}: ${franja}`);
  }
  return problemas;
}

/* ---- decirlo en lenguaje simple ---------------------------------------------- */

export interface ControlExplanation {
  readonly id: 'idle' | 'device' | 'hours' | 'network' | 'mfa';
  readonly title: string;
  /** Qué hace el control, dicho una sola vez y sin jerga. */
  readonly meaning: string;
  /** Qué pasa con la regla tal como está ahora. */
  readonly effect: string;
}

export function explainPolicy(policy: SessionPolicy): readonly ControlExplanation[] {
  return [
    {
      id: 'idle',
      title: 'Cierre por inactividad',
      meaning: 'Si la persona deja de usar el sistema un rato, la sesión se cierra sola. Protege una pantalla que quedó abierta en un mostrador.',
      effect: `La sesión se cierra tras ${policy.idleTimeoutMinutes} minutos sin actividad.`,
    },
    {
      id: 'device',
      title: 'Aviso de dispositivo nuevo',
      meaning: 'Cuando alguien entra desde un equipo que nunca usó, se lo avisamos al entrar para que confirme que fue él.',
      effect: policy.newDeviceAlert
        ? 'Se avisa al entrar desde un dispositivo nuevo, con la opción de cerrar las otras sesiones.'
        : 'No se avisa: un dispositivo nuevo entra sin ningún aviso.',
    },
    {
      id: 'hours',
      title: 'Horario laboral',
      meaning: 'Solo se puede iniciar sesión en los días y las horas que usted marque. Fuera de ese horario, el acceso se rechaza.',
      effect: policy.allowedHours === undefined ? describeHours(undefined) : `Solo se puede entrar así: ${describeHours(policy.allowedHours)}.`,
    },
    {
      id: 'network',
      title: 'Red de la organización',
      meaning: 'Solo se puede entrar desde las redes que la organización declaró (por ejemplo, la del hospital). Desde la casa o un café, no.',
      effect: policy.enforceIpRules ? 'Solo se entra desde la red de la organización.' : 'Se puede entrar desde cualquier red.',
    },
    {
      id: 'mfa',
      title: 'Verificación en dos pasos',
      meaning: 'Además de la contraseña, se pide un código que genera el teléfono de la persona. Aunque alguien robe la contraseña, no entra.',
      effect: policy.requireMfa ? 'Obligatoria: quien aún no la configuró entra, pero no puede usar la aplicación hasta activarla.' : 'Opcional: cada persona decide si la usa.',
    },
  ];
}

/** Lo que se ve con las reglas puestas a prueba en un día y hora concretos. */
export interface EffectProbe {
  readonly allowed: boolean;
  readonly lines: readonly string[];
}

export function previewEffect(rules: EffectiveRules, day: number, minutes: number): EffectProbe {
  const cuando = `${dayName(day)} a las ${hhmm(minutes)}`;
  if (!rules.allowedHours.every((h) => isAllowedAt(h, day, minutes))) {
    return { allowed: false, lines: [`Un ${cuando} no podría iniciar sesión: está fuera del horario laboral.`] };
  }
  const lines = [`Un ${cuando} podría iniciar sesión.`];
  if (rules.enforceIpRules) lines.push('Solo si entra desde la red de la organización.');
  if (rules.requireMfa) lines.push('Tendría que ingresar el código de verificación en dos pasos.');
  if (rules.newDeviceAlert) lines.push('Si usa un dispositivo nuevo, vería el aviso para confirmarlo.');
  if (rules.idleTimeoutMinutes !== undefined) lines.push(`Si deja el sistema quieto ${rules.idleTimeoutMinutes} minutos, la sesión se cierra.`);
  return { allowed: true, lines };
}
