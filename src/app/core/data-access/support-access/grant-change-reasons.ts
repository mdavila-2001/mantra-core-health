import type { GrantChangeTargetView } from '../access-governance/access-reviews.types';

/* ============================================================================
    Por qué un cambio de permisos espera a otra persona (cuatro ojos), en lenguaje simple.

    La API contesta 202 `GrantChangePendingDto` (`reasons`, `criticalAtoms`) y lista la solicitud con un
    `GrantChangeDetailsDto` en `GET /approvals/pending`. Los códigos (`NEW_CRITICAL_ATOMS`, `SCOPE_WIDENED`,
    `VALIDITY_EXTENDED`) son estables pero no son para leerse: acá se traducen. El front ramifica por código, nunca por texto.
   ========================================================================== */

const MOTIVOS: Readonly<Record<string, string>> = {
  NEW_CRITICAL_ATOMS: 'Suma permisos críticos que la persona aún no tenía.',
  SCOPE_WIDENED: 'Amplía a quién, a qué servicio o a qué lugar alcanza el permiso.',
  VALIDITY_EXTENDED: 'Alarga cuánto dura el permiso.',
};

/** El nombre que el simulador usaba antes de que la API fijara el contrato. */
const ALIAS: Readonly<Record<string, string>> = { CRITICAL_ATOM_ADDED: 'NEW_CRITICAL_ATOMS' };

const DESCONOCIDO = 'Es un cambio que otra persona debe revisar.';

/** El motivo en lenguaje simple; uno desconocido no se muestra como código. */
export function grantChangeReasonText(code: string): string {
  return MOTIVOS[ALIAS[code] ?? code] ?? DESCONOCIDO;
}

/** Los motivos en lenguaje simple, sin repetir. */
export function grantChangeReasonsText(codes: readonly string[]): readonly string[] {
  return [...new Set(codes.map(grantChangeReasonText))];
}

/** Lo que traen los 202 (`GrantChangePendingDto`) que interesa para explicar. */
export interface PendingChangeLike {
  readonly reasons: readonly string[];
  readonly criticalAtoms: readonly string[];
}

/**
 * La explicación de lo que quedó pendiente de aprobación: por qué y qué pasa mientras tanto. Une los motivos de todos los
 * cambios (el editor puede mandar varios permisos).
 */
export function pendingApprovalExplanation(pendientes: readonly PendingChangeLike[]): string {
  const motivos = grantChangeReasonsText(pendientes.flatMap((p) => p.reasons));
  const porque =
    motivos.length === 0
      ? 'Necesita la aprobación de otra persona.'
      : `Necesita la aprobación de otra persona. ${motivos.join(' ')}`;
  return `${porque} El cambio no rige hasta que otra persona lo apruebe.`;
}

/** A quién o a qué alcanza el permiso, por nombre; «y lo que se sume después» si se actualiza solo. */
export function grantChangeTargetText(target: GrantChangeTargetView): string {
  const doctor = target.practitionerName ?? 'un doctor';
  const servicio = target.serviceName ?? 'un servicio';
  const lugar = target.locationName ?? 'un lugar';
  let base: string;
  let porSi = true;
  switch (target.kind) {
    case 'PRACTITIONER':
      base = doctor;
      break;
    case 'SERVICE':
      base = servicio;
      break;
    case 'LOCATION':
      base = lugar;
      break;
    case 'PRACTITIONER_SERVICE':
      base = `${doctor}, solo en ${servicio}`;
      porSi = false;
      break;
    case 'PRACTITIONER_LOCATION':
      base = `${doctor}, solo en ${lugar}`;
      porSi = false;
      break;
    case 'SERVICE_LOCATION':
      base = `${servicio}, solo en ${lugar}`;
      porSi = false;
      break;
    case 'ALL_PRACTITIONERS':
      base = 'Todos los doctores';
      break;
    case 'ALL_SERVICES':
      base = 'Todos los servicios';
      break;
    case 'ALL_LOCATIONS':
      base = 'Todos los lugares';
      break;
    case 'ALL':
      base = 'Todo lo de la organización';
      break;
    default:
      base = 'Lo que indica la solicitud';
      porSi = false;
  }
  return porSi && target.expansionMode === 'DYNAMIC' ? `${base}, y lo que se sume después` : base;
}

const DIA = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });

/** Cuánto dura el permiso: desde y hasta, solo hasta, o sin fin. */
export function grantChangeValidityText(v: {
  readonly validFrom?: string;
  readonly validTo?: string;
}): string {
  const hasta = v.validTo === undefined ? null : DIA.format(new Date(v.validTo));
  const desde = v.validFrom === undefined ? null : DIA.format(new Date(v.validFrom));
  if (hasta === null) return 'Sin fecha de fin.';
  return desde === null ? `Hasta el ${hasta}.` : `Desde el ${desde} hasta el ${hasta}.`;
}

const CAMBIOS: Readonly<Record<string, string>> = {
  actions: 'los permisos',
  validTo: 'la vigencia',
  expansionMode: 'si se actualiza solo con lo nuevo',
  condition: 'las condiciones',
  actionConditions: 'las condiciones de cada permiso',
};

/** Qué campos cambia un ajuste (`GrantChangeDetailsDto.changes`), en palabras. */
export function grantChangeChangeText(changes: readonly string[]): readonly string[] {
  return [...new Set(changes.map((c) => CAMBIOS[c] ?? 'otros datos'))];
}
