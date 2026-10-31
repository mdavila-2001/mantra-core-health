import {
  atomMeta,
  expandSupportAction,
} from '../../../core/data-access/support-access/support-atoms';
import type { SupportGrant } from '../../../core/data-access/support-access/support-access.types';
import { joinNatural } from '../../../core/data-access/support-access/support-summary';

/* ============================================================================
    Lo que una persona de apoyo lee de **sus propios permisos** además de «Lo que puede hacer»: las condiciones y
    prohibiciones, y lo que se le pedirá al actuar (motivo, segundo paso, aprobación).

    Es texto derivado de lo que la API devolvió (`effect`, `atoms`, `conditionsSummary`) y del catálogo de permisos; no
    decide nada. Quien decide si puede o no, y por qué, es `explain` («¿Por qué no puedo?»).
   ========================================================================== */

const MAX_NAMES = 4;

/** Los átomos que da un permiso: los escritos como tales o la expansión de sus códigos antiguos. */
function atomsOf(grant: SupportGrant): readonly string[] {
  return grant.atoms ?? grant.actions.flatMap((a) => expandSupportAction(a));
}

const nameOf = (atom: string): string => atomMeta(atom)?.name ?? atom;

/** «Cancelar citas, Crear citas y 2 más». */
function names(atoms: readonly string[]): string {
  const unique = [...new Set(atoms)].map(nameOf);
  const shown = unique.slice(0, MAX_NAMES);
  const rest = unique.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} y ${rest} más` : joinNatural(shown);
}

/** Una frase por prohibición y por permiso con condiciones, solo de los permisos vigentes. */
export function conditionNotes(grants: readonly SupportGrant[]): readonly string[] {
  const live = grants.filter((g) => g.status === 'ACTIVE');
  const denials = live
    .filter((g) => g.effect === 'DENY')
    .map((g) => `No puede, en ningún caso: ${names(atomsOf(g))}.`);
  const conditions = [
    ...new Set(
      live
        .filter((g) => g.effect !== 'DENY')
        .flatMap((g) => (g.conditionsSummary === undefined ? [] : [g.conditionsSummary])),
    ),
  ];
  return [...conditions, ...denials];
}

/** Lo que se le pedirá al actuar, por tipo de requisito (de los permisos que sí tiene). */
export function obligationNotes(grants: readonly SupportGrant[]): readonly string[] {
  const atoms = [
    ...new Set(
      grants.filter((g) => g.status === 'ACTIVE' && g.effect !== 'DENY').flatMap((g) => atomsOf(g)),
    ),
  ];
  const withMeta = atoms.flatMap((a) => {
    const meta = atomMeta(a);
    return meta === undefined ? [] : [meta];
  });
  const reason = withMeta.filter((m) => m.requiresReason).map((m) => m.code);
  const stepUp = withMeta.filter((m) => m.requiresStepUp).map((m) => m.code);
  const doctor = withMeta.filter((m) => m.approvalMode === 'DOCTOR').map((m) => m.code);
  const second = withMeta.filter((m) => m.approvalMode === 'SECOND_APPROVER').map((m) => m.code);
  return [
    ...(reason.length === 0 ? [] : [`Pide el motivo por escrito: ${names(reason)}.`]),
    ...(stepUp.length === 0 ? [] : [`Pide confirmar con el segundo paso: ${names(stepUp)}.`]),
    ...(doctor.length === 0 ? [] : [`Pide la aprobación del doctor: ${names(doctor)}.`]),
    ...(second.length === 0
      ? []
      : [`Pide la aprobación de una segunda persona: ${names(second)}.`]),
  ];
}
