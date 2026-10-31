import {
  SUPPORT_ACTION_CODES,
  SUPPORT_ACTION_LABELS,
  type SupportActionCode,
  type SupportCatalog,
  type SupportScopeTarget,
  type ExpansionMode,
} from './support-access.types';

/**
 * El **resumen en lenguaje simple** de un conjunto de permisos.
 *
 * Es lo que lee quien configura (panel derecho del editor), la persona de
 * apoyo («Mis accesos») y el doctor. Nada de códigos ni de tipos de objetivo:
 * «Puede crear citas de Andrés Pérez», no `PRACTITIONER / schedule.create`.
 *
 * Es texto derivado de los permisos y del catálogo; no autoriza nada.
 */

/** Cada acción en infinitivo, para completar «Puede …». */
const VERBS: Readonly<Record<SupportActionCode, string>> = {
  'schedule.view': 'ver la agenda',
  'schedule.create': 'crear citas',
  'schedule.reschedule': 'reprogramar citas',
  'schedule.cancel': 'cancelar citas',
  'schedule.confirm': 'confirmar citas',
  'schedule.check_in': 'registrar la llegada del paciente',
  'schedule.walk_in': 'atender pacientes sin cita',
  'schedule.waitlist': 'manejar la lista de espera',
  'schedule.send_reminders': 'enviar recordatorios',
  'schedule.block_time': 'bloquear horarios',
  'schedule.edit_hours': 'cambiar el horario de atención',
  'billing.collect': 'cobrar',
  'billing.issue_receipt': 'emitir recibos',
  'patient.register': 'registrar pacientes nuevos',
  'messages.reply_on_behalf': 'responder mensajes administrativos en nombre del doctor',
};

/** Acciones que, si faltan, vale la pena decir que **no** puede. Las demás se omiten por ruido. */
const NOTABLE_DENIALS: readonly SupportActionCode[] = [
  'schedule.create',
  'schedule.cancel',
  'schedule.block_time',
  'schedule.edit_hours',
  'billing.collect',
  'messages.reply_on_behalf',
];

/** Un permiso para resumir: objetivo, modo y acciones. */
export interface SummarizableGrant extends SupportScopeTarget {
  readonly actions: readonly SupportActionCode[];
  readonly expansionMode: ExpansionMode;
}

/** Une una lista con comas y una «y» final: «a, b y c». */
export function joinNatural(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]!}`;
}

/** Las acciones en su orden canónico, nombradas como verbos. */
export function describeActions(actions: readonly SupportActionCode[]): string {
  const ordenadas = SUPPORT_ACTION_CODES.filter((code) => actions.includes(code));
  return joinNatural(ordenadas.map((code) => VERBS[code]));
}

function nameOfDoctor(target: SupportScopeTarget, catalog: SupportCatalog): string {
  const doctor = catalog.doctors.find((item) => item.id === target.practitionerRoleAssignmentId);
  return doctor?.name ?? 'un doctor';
}

function nameOfService(target: SupportScopeTarget, catalog: SupportCatalog): string {
  const service = catalog.services.find((item) => item.id === target.healthcareServiceId);
  return service?.name ?? 'un servicio';
}

function nameOfLocation(target: SupportScopeTarget, catalog: SupportCatalog): string {
  const id = target.practiceSiteId ?? target.careSpaceId;
  const node = catalog.locations.find((item) => item.id === id);
  return node?.name ?? 'una ubicación';
}

/** Si la ubicación del permiso tiene lugares adentro (para decir «incluye lo nuevo»). */
function hasChildren(target: SupportScopeTarget, catalog: SupportCatalog): boolean {
  const id = target.practiceSiteId ?? target.careSpaceId;
  return id !== undefined && catalog.locations.some((node) => node.parentId === id);
}

/** Cómo se dice a qué alcanza el permiso, sin la acción. */
export function describeTarget(target: SupportScopeTarget, catalog: SupportCatalog): string {
  switch (target.targetKind) {
    case 'PRACTITIONER':
      return `de ${nameOfDoctor(target, catalog)}, en todos los lugares donde atiende`;
    case 'SERVICE':
      return `del servicio ${nameOfService(target, catalog)}, en toda la organización`;
    case 'LOCATION':
      return `en ${nameOfLocation(target, catalog)}`;
    case 'PRACTITIONER_SERVICE':
      return `de ${nameOfDoctor(target, catalog)}, solo para ${nameOfService(target, catalog)}`;
    case 'PRACTITIONER_LOCATION':
      return `de ${nameOfDoctor(target, catalog)}, solo en ${nameOfLocation(target, catalog)}`;
    case 'SERVICE_LOCATION':
      return `del servicio ${nameOfService(target, catalog)}, solo en ${nameOfLocation(target, catalog)}`;
    case 'ALL_PRACTITIONERS':
      return 'de todos los doctores';
    case 'ALL_SERVICES':
      return 'de todos los servicios';
    case 'ALL_LOCATIONS':
      return 'en todas las ubicaciones';
    case 'ALL':
      return 'de toda la organización';
  }
}

/** Frase de un permiso: «Puede ver la agenda y crear citas de Andrés Pérez…». */
export function describeGrant(grant: SummarizableGrant, catalog: SupportCatalog): string {
  if (grant.actions.length === 0) {
    return `Sin acciones elegidas ${describeTarget(grant, catalog)}.`;
  }
  const incluyeNuevo =
    grant.expansionMode === 'DYNAMIC' &&
    (grant.targetKind === 'LOCATION' || grant.targetKind.startsWith('ALL') || grant.targetKind === 'SERVICE_LOCATION') &&
    (grant.targetKind.startsWith('ALL') || hasChildren(grant, catalog))
      ? ' Incluye automáticamente lo que se agregue después.'
      : '';
  return `Puede ${describeActions(grant.actions)} ${describeTarget(grant, catalog)}.${incluyeNuevo}`;
}

/**
 * El resumen completo: una línea por permiso, lo que **no** puede (solo lo que
 * importa) y la regla de la historia clínica, que no depende de los permisos.
 */
export function summarizeGrants(
  grants: readonly SummarizableGrant[],
  catalog: SupportCatalog,
): readonly string[] {
  if (grants.length === 0) {
    return ['Todavía no tiene ningún permiso: no puede ver ninguna agenda.'];
  }
  const lineas = grants.map((grant) => describeGrant(grant, catalog));
  const concedidas = new Set(grants.flatMap((grant) => grant.actions));
  const faltantes = NOTABLE_DENIALS.filter((code) => !concedidas.has(code));
  if (faltantes.length > 0) {
    lineas.push(`No puede ${joinNatural(faltantes.map((code) => VERBS[code]))}.`);
  }
  lineas.push(CLINICAL_RULE_SENTENCE);
  return lineas;
}

/** La regla clínica: vale para toda persona de apoyo, sin importar sus permisos. */
export const CLINICAL_RULE_SENTENCE =
  'De la historia clínica solo ve el motivo de consulta. Para ver más, el doctor tiene que aprobar un acceso temporal por paciente.';

/** El nombre de una acción para listas y encabezados de matriz. */
export function actionLabel(code: SupportActionCode): string {
  return SUPPORT_ACTION_LABELS[code];
}

/**
 * Un catálogo mínimo armado con los nombres que ya traen los permisos.
 *
 * La persona de apoyo no puede leer el catálogo de la organización (es de quien
 * administra), pero sus permisos ya llegan con el nombre del doctor, del servicio
 * y de la ubicación: alcanza para escribir el resumen sin otra consulta.
 */
export function catalogFromGrants(
  organizationName: string,
  grants: readonly (SupportScopeTarget & {
    readonly practitionerName?: string;
    readonly serviceName?: string;
    readonly locationName?: string;
  })[],
): SupportCatalog {
  const doctors = new Map<string, string>();
  const services = new Map<string, string>();
  const locations = new Map<string, string>();
  for (const grant of grants) {
    if (grant.practitionerRoleAssignmentId !== undefined && grant.practitionerName !== undefined) {
      doctors.set(grant.practitionerRoleAssignmentId, grant.practitionerName);
    }
    if (grant.healthcareServiceId !== undefined && grant.serviceName !== undefined) {
      services.set(grant.healthcareServiceId, grant.serviceName);
    }
    const locationId = grant.practiceSiteId ?? grant.careSpaceId;
    if (locationId !== undefined && grant.locationName !== undefined) {
      locations.set(locationId, grant.locationName);
    }
  }
  return {
    organizationName,
    doctors: [...doctors].map(([id, name]) => ({ id, name, specialty: '', placements: [] })),
    services: [...services].map(([id, name]) => ({ id, name })),
    locations: [...locations].map(([id, name]) => ({ id, name, kind: 'LEVEL' as const, parentId: null, path: `/${id}/` })),
  };
}
