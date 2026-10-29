import type { OpsAction, OpsRole, OpsViewer } from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import type { MockRequest } from '../mock-router';
import { uuid } from '../mock-store';

/* ============================================================================
    Quién mira, para el simulador de operación (franja F2).

    En la API real el rol operativo (enfermería, limpieza, mantenimiento…) sale
    de una asignación delegada, que el token no trae. La maqueta no tiene ese
    dato, así que elige una **persona** de dos maneras: por la clave de sesión
    `mock:infra-ops-persona` (así se recorre cada vista por rol en el navegador)
    o, si no hay clave, por los roles del token. Las acciones de cada persona
    siguen la tabla de permisos de F2.3 de `CONTRATO-F2-F5.md`; donde la matriz
    general y el contrato discrepan (Limpieza marca «contaminada»), manda el
    contrato.
    ========================================================================== */

export interface Persona {
  readonly key: string;
  readonly role: OpsRole;
  readonly userId: string;
  readonly displayName: string;
  readonly actions: readonly OpsAction[];
  /** Enfermería y Admisión ven al paciente; nadie más. */
  readonly seesPatient: boolean;
}

const persona = (
  key: string,
  role: OpsRole,
  displayName: string,
  actions: readonly OpsAction[],
  seesPatient = false,
): Persona => ({ key, role, userId: uuid(`persona-${key}`), displayName, actions, seesPatient });

const NURSE_ACTIONS: readonly OpsAction[] = [
  'block-clinical',
  'mark-dirty',
  'mark-contaminated',
  'isolate',
  'clean',
  'assign',
  'create-cleaning',
  'see-history',
];

export const PERSONAS: Readonly<Record<string, Persona>> = {
  nurse: persona('nurse', 'NURSING', 'Enf. Carmen Ríos', NURSE_ACTIONS, true),
  'nurse-supervisor': persona(
    'nurse-supervisor',
    'NURSE_SUPERVISOR',
    'Enf. Patricia Lara (supervisión)',
    [...NURSE_ACTIONS, 'inspect', 'inspect-terminal'],
    true,
  ),
  admission: persona('admission', 'ADMISSION', 'Admisión · Julia Paz', ['see-history'], true),
  housekeeping: persona('housekeeping', 'HOUSEKEEPING', 'Rosa Condori', [
    'mark-dirty',
    'clean',
    'assign',
    'create-cleaning',
    'see-history',
  ]),
  'housekeeping-supervisor': persona('housekeeping-supervisor', 'HOUSEKEEPING_SUPERVISOR', 'Elena Suárez (supervisión)', [
    'mark-dirty',
    'clean',
    'assign',
    'create-cleaning',
    'inspect',
    'inspect-terminal',
    'see-history',
  ]),
  maintenance: persona('maintenance', 'MAINTENANCE', 'Téc. Mario Vega', ['maintenance', 'see-history']),
  'or-manager': persona('or-manager', 'OR_MANAGER', 'Jefatura de quirófano', [
    'block-clinical',
    'block-administrative',
    'mark-dirty',
    'assign',
    'create-cleaning',
    'see-history',
  ]),
  admin: persona('admin', 'ADMIN', 'Marcelo Dávila Arce', ['block-administrative', 'maintenance', 'close', 'see-history']),
  support: persona('support', 'SUPPORT', 'Soporte AloVida', ['block-administrative', 'close', 'see-history']),
  'read-only': persona('read-only', 'READ_ONLY', 'Consulta', []),
};

const KEY = 'mock:infra-ops-persona';

function storedKey(): string | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** La persona de esta petición. */
export function personaOf(request: MockRequest): Persona {
  const key = storedKey();
  const chosen = key === null ? undefined : PERSONAS[key];
  if (chosen !== undefined) return chosen;
  const roles = request.user?.roles ?? [];
  if (roles.includes('SUPERADMIN')) return PERSONAS['support']!;
  if (roles.includes('SECURITY_ADMIN')) return PERSONAS['admin']!;
  if (roles.includes('PERIOP_ADMIN')) return PERSONAS['or-manager']!;
  return PERSONAS['nurse']!;
}

export const viewerOf = (p: Persona): OpsViewer => ({ role: p.role, actions: p.actions });

export const can = (p: Persona, action: OpsAction): boolean => p.actions.includes(action);

/** El jefe de quirófano solo opera quirófanos. */
export function inScope(p: Persona, functionCode: string): boolean {
  return p.role !== 'OR_MANAGER' || functionCode === 'SPACE_FN_OPERATING_ROOM';
}
