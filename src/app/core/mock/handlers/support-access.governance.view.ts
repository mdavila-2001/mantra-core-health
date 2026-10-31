import type { SupportCondition } from '../../data-access/access-governance/conditions.types';
import type {
  GrantChangeAtomView,
  GrantChangeDetails,
} from '../../data-access/access-governance/access-reviews.types';
import { atomMeta, expandSupportAction, type SupportAtom } from '../../data-access/support-access/support-atoms';
import { CATALOGOS } from '../fixtures/support-hospital';
import type { FilaPermiso } from '../fixtures/support-hospital.types';

/* ============================================================================
    Cómo se **ven** los permisos con átomos y condiciones en las respuestas del mock
    (`atoms`, `effect`, `origin`, `condition`, `actionConditions`, `conditionsSummary`).

    El mock **no reimplementa la política** (CONTRATO-GOBIERNO §9.6): acá solo se arma la forma de la
    respuesta. El resumen en lenguaje simple es de mentira pero determinista; el real lo arma el servidor.
   ========================================================================== */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Los átomos que el permiso da: los escritos como átomos o, si es un alias antiguo, su expansión. */
export function atomosDe(p: FilaPermiso): readonly SupportAtom[] {
  if (p.atoms !== undefined) return p.atoms as readonly SupportAtom[];
  return [...new Set(p.actions.flatMap((a) => expandSupportAction(a)))];
}

function franja(w: { readonly days: readonly number[]; readonly from: string; readonly to: string }): string {
  const dias = w.days.map((d) => DIAS[d] ?? '?');
  const rango = dias.length > 2 ? `de ${dias[0]} a ${dias[dias.length - 1]}` : dias.join(' y ');
  return `${rango} de ${w.from} a ${w.to}`;
}

/** Una oración con las condiciones; `undefined` si no hay ninguna. */
export function resumenDeCondiciones(condition: SupportCondition | undefined, porAtomo?: Readonly<Record<string, SupportCondition>>): string | undefined {
  const partes: string[] = [];
  const c = condition;
  if (c?.time !== undefined && c.time.windows.length > 0) partes.push(`solo ${c.time.windows.map(franja).join(' y ')}`);
  if (c?.network?.require === 'ORG_RULES') partes.push('solo desde la red del hospital');
  if (c?.device?.knownOnly === true) partes.push('solo desde un equipo de confianza');
  if (c?.patients?.exclude?.flags !== undefined && c.patients.exclude.flags.length > 0) partes.push('sin pacientes reservados');
  if (c?.patients?.scope === 'WITH_APPOINTMENT_WINDOW') partes.push('solo pacientes con cita en la ventana indicada');
  if (c?.amount?.perTransactionMax !== undefined) partes.push(`cobros de hasta Bs ${c.amount.perTransactionMax} por operación`);
  for (const [atomo, ac] of Object.entries(porAtomo ?? {})) {
    const k = ac;
    if (k.appointment?.leadTime !== undefined) partes.push(`${atomo.endsWith('cancel') ? 'cancelar' : 'cambiar'} con al menos ${k.appointment.leadTime.minHours} horas de anticipación${k.appointment.leadTime.onViolation === 'REQUIRE_APPROVAL' ? ' o con aprobación del doctor' : ''}`);
    for (const l of k.limits ?? []) partes.push(`hasta ${l.max} ${l.metric === 'ACTIONS' ? 'acciones' : 'pacientes'} por ${l.per === 'DAY' ? 'día' : l.per === 'HOUR' ? 'hora' : 'semana'}`);
  }
  if (partes.length === 0) return undefined;
  const texto = partes.join('; ');
  return texto.charAt(0).toUpperCase() + texto.slice(1) + '.';
}

/** Lo que el permiso suma a su vista en la respuesta (campos opcionales; un alias antiguo solo trae `origin: 'LEGACY'`). */
export function camposDeGobierno(p: FilaPermiso): Readonly<Record<string, unknown>> {
  const g = p;
  const resumen = resumenDeCondiciones(g.condition, g.actionConditions);
  return {
    effect: g.effect ?? 'ALLOW',
    atoms: atomosDe(p),
    origin: g.atoms === undefined ? 'LEGACY' : 'ATOM',
    ...(g.condition === undefined ? {} : { condition: g.condition }),
    ...(g.actionConditions === undefined ? {} : { actionConditions: g.actionConditions }),
    ...(resumen === undefined ? {} : { conditionsSummary: resumen }),
    ...(g.reasonText === undefined ? {} : { reasonText: g.reasonText }),
  };
}

/** Un átomo con su nombre y si es crítico (`GrantChangeAtomViewDto`). */
function vistaDeAtomo(code: string): GrantChangeAtomView {
  const meta = atomMeta(code);
  return { code, name: meta?.name ?? code, critical: meta?.sensitivity === 'CRITICAL' };
}

/**
 * El detalle que la API adjunta a una aprobación `GRANT_CHANGE` en `GET /approvals/pending`
 * (`GrantChangeDetailsDto`): todos los átomos con los críticos marcados, el objetivo por nombre, la vigencia y las
 * condiciones en lenguaje simple.
 */
export function detallesDelCambio(
  op: 'ADD' | 'UPDATE',
  tenantId: string,
  permiso: Pick<
    FilaPermiso,
    'targetKind' | 'expansionMode' | 'practitionerRoleAssignmentId' | 'healthcareServiceId' | 'careSpaceId' | 'validTo' | 'condition' | 'actionConditions'
  > & { readonly validFrom?: string },
  atomos: readonly string[],
  motivos: readonly string[],
  cambios: readonly string[] = [],
): GrantChangeDetails {
  const catalogo = CATALOGOS[tenantId];
  const doctor = catalogo?.doctors.find((d) => d.id === permiso.practitionerRoleAssignmentId)?.name;
  const servicio = catalogo?.services.find((s) => s.id === permiso.healthcareServiceId)?.name;
  const lugar = catalogo?.locations.find((l) => l.id === permiso.careSpaceId)?.name;
  const vistas = atomos.map(vistaDeAtomo);
  const resumen = resumenDeCondiciones(permiso.condition, permiso.actionConditions);
  return {
    op,
    reasons: motivos,
    atoms: vistas,
    criticalAtoms: vistas.filter((a) => a.critical),
    target: {
      kind: permiso.targetKind,
      expansionMode: permiso.expansionMode,
      ...(doctor === undefined ? {} : { practitionerName: doctor }),
      ...(servicio === undefined ? {} : { serviceName: servicio }),
      ...(lugar === undefined ? {} : { locationName: lugar }),
    },
    ...(permiso.validFrom === undefined ? {} : { validFrom: permiso.validFrom }),
    ...(permiso.validTo === undefined ? {} : { validTo: permiso.validTo }),
    conditions: resumen === undefined ? [] : [resumen],
    ...(op === 'UPDATE' ? { changes: cambios } : {}),
  };
}
