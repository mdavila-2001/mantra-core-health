import type {
  CatalogDoctor,
  CatalogService,
  LocationNode,
  SupportActionCode,
  SupportCatalog,
  SupportScopeTarget,
} from './support-access.types';

/**
 * Qué cubre un permiso. Lógica **pura**, sin Angular ni red.
 *
 * Existe en dos sitios con el mismo objetivo y por eso vive acá: la **vista
 * previa** del editor de permisos (para que quien configura vea, antes de
 * guardar, qué doctores y servicios quedan cubiertos) y el **backend
 * simulado**, que reproduce lo que haría `SupportAccessPolicy` en la API.
 *
 * Nada de esto autoriza en producción: la API decide en cada petición. La
 * vista previa es información para quien configura, y puede quedar atrasada
 * respecto de lo que la API calcule.
 *
 * Reglas del contrato:
 * - varias filas **se suman**;
 * - una fila con dos objetivos (doctor×servicio, doctor×ubicación,
 *   servicio×ubicación) **se cruza**;
 * - un permiso por ubicación cubre una cita solo si el **espacio** de la cita
 *   está dentro de esa ubicación (ruta materializada);
 * - un permiso por doctor cubre todos sus lugares.
 */

/** El triple que identifica una cita o un horario: de quién, dónde y qué servicio. */
export interface AppointmentContext {
  readonly practitionerRoleAssignmentId: string;
  readonly careSpaceId: string;
  readonly healthcareServiceId: string;
}

/** Un permiso tal como lo necesita el cálculo: objetivo y acciones. */
export interface CoverageGrant extends SupportScopeTarget {
  readonly actions: readonly SupportActionCode[];
}

/** Índice de ubicaciones por id, para no recorrer la lista en cada pregunta. */
export function indexLocations(locations: readonly LocationNode[]): ReadonlyMap<string, LocationNode> {
  return new Map(locations.map((node) => [node.id, node]));
}

/** `true` si el nodo `inner` está dentro de `outer` (o es el mismo). Compara rutas materializadas. */
export function isWithin(inner: LocationNode | undefined, outer: LocationNode | undefined): boolean {
  if (inner === undefined || outer === undefined) return false;
  return inner.id === outer.id || inner.path.startsWith(outer.path);
}

/** El identificador de ubicación de un permiso: la sede o el espacio, el que traiga. */
function locationIdOf(target: SupportScopeTarget): string | undefined {
  return target.practiceSiteId ?? target.careSpaceId;
}

/** Si un permiso cubre ese triple. No mira las acciones. */
export function targetCovers(
  target: SupportScopeTarget,
  context: AppointmentContext,
  locations: ReadonlyMap<string, LocationNode>,
): boolean {
  const byDoctor = target.practitionerRoleAssignmentId === context.practitionerRoleAssignmentId;
  const byService = target.healthcareServiceId === context.healthcareServiceId;
  const locationId = locationIdOf(target);
  const byLocation =
    locationId !== undefined && isWithin(locations.get(context.careSpaceId), locations.get(locationId));

  switch (target.targetKind) {
    case 'PRACTITIONER':
      return byDoctor;
    case 'SERVICE':
      return byService;
    case 'LOCATION':
      return byLocation;
    case 'PRACTITIONER_SERVICE':
      return byDoctor && byService;
    case 'PRACTITIONER_LOCATION':
      return byDoctor && byLocation;
    case 'SERVICE_LOCATION':
      return byService && byLocation;
    case 'ALL_PRACTITIONERS':
    case 'ALL_SERVICES':
    case 'ALL_LOCATIONS':
    case 'ALL':
      return true;
  }
}

export interface AccessVerdict {
  readonly allowed: boolean;
  /** Las acciones que sí tiene sobre ese triple, de la suma de todas las filas que lo cubren. */
  readonly actions: readonly SupportActionCode[];
  /** Si no hay permiso, por qué, en palabras de la persona. */
  readonly reason: string;
}

/** Suma de las acciones de todas las filas que cubren el triple. */
export function actionsFor(
  grants: readonly CoverageGrant[],
  context: AppointmentContext,
  locations: ReadonlyMap<string, LocationNode>,
): readonly SupportActionCode[] {
  const sumadas = new Set<SupportActionCode>();
  for (const grant of grants) {
    if (targetCovers(grant, context, locations)) {
      for (const action of grant.actions) sumadas.add(action);
    }
  }
  return [...sumadas];
}

/**
 * El veredicto sobre una acción puntual, con el motivo cuando es negativo.
 *
 * El motivo distingue «no tiene ningún permiso aquí» de «lo tiene, pero esa
 * acción no está incluida», porque a quien lo lee le sirve distinto: el primero
 * es pedir acceso; el segundo, pedir un permiso más.
 */
export function evaluateAction(
  grants: readonly CoverageGrant[],
  context: AppointmentContext,
  action: SupportActionCode,
  locations: ReadonlyMap<string, LocationNode>,
  actionLabel: string,
): AccessVerdict {
  const actions = actionsFor(grants, context, locations);
  if (actions.length === 0) {
    return { allowed: false, actions, reason: 'No tiene permiso sobre esta agenda.' };
  }
  if (!actions.includes(action)) {
    return {
      allowed: false,
      actions,
      reason: `Tiene acceso a esta agenda, pero su permiso no incluye «${actionLabel.toLocaleLowerCase('es')}».`,
    };
  }
  return { allowed: true, actions, reason: '' };
}

/** Todos los triples de un doctor: cada lugar donde atiende con el servicio que presta ahí. */
export function contextsOf(doctor: CatalogDoctor): readonly AppointmentContext[] {
  return doctor.placements.map((placement) => ({
    practitionerRoleAssignmentId: doctor.id,
    careSpaceId: placement.careSpaceId,
    healthcareServiceId: placement.healthcareServiceId,
  }));
}

export interface DoctorCoverage {
  readonly doctor: CatalogDoctor;
  /** `all`: todos sus lugares y servicios; `partial`: solo algunos. */
  readonly extent: 'all' | 'partial';
  /** Espacios cubiertos, por nombre. */
  readonly coveredSpaceNames: readonly string[];
  readonly coveredServiceNames: readonly string[];
}

export interface ServiceCoverage {
  readonly service: CatalogService;
  readonly extent: 'all' | 'partial';
}

export interface CoveragePreview {
  readonly doctors: readonly DoctorCoverage[];
  readonly services: readonly ServiceCoverage[];
}

/**
 * La vista previa del editor: qué doctores y servicios quedan cubiertos por un
 * conjunto de permisos.
 *
 * Un doctor cuenta como cubierto si **alguno** de sus triples lo está; es
 * `all` cuando lo están todos. Un servicio, igual, mirando los triples de
 * todos los doctores que lo prestan.
 */
export function previewCoverage(
  grants: readonly CoverageGrant[],
  catalog: SupportCatalog,
): CoveragePreview {
  const locations = indexLocations(catalog.locations);
  const serviceName = new Map(catalog.services.map((service) => [service.id, service.name]));
  const doctors: DoctorCoverage[] = [];
  const perService = new Map<string, { covered: number; total: number }>();

  for (const doctor of catalog.doctors) {
    const contexts = contextsOf(doctor);
    const covered = contexts.filter((context) => actionsFor(grants, context, locations).length > 0);
    for (const context of contexts) {
      if (context.healthcareServiceId === '') continue;
      const tally = perService.get(context.healthcareServiceId) ?? { covered: 0, total: 0 };
      tally.total += 1;
      if (covered.includes(context)) tally.covered += 1;
      perService.set(context.healthcareServiceId, tally);
    }
    if (covered.length === 0) continue;
    doctors.push({
      doctor,
      extent: covered.length === contexts.length ? 'all' : 'partial',
      coveredSpaceNames: unique(covered.map((context) => locations.get(context.careSpaceId)?.name ?? context.careSpaceId)),
      coveredServiceNames: unique(
        covered.flatMap((context) => {
          const name = serviceName.get(context.healthcareServiceId);
          return name === undefined ? [] : [name];
        }),
      ),
    });
  }

  const services: ServiceCoverage[] = [];
  for (const service of catalog.services) {
    const tally = perService.get(service.id);
    if (tally === undefined || tally.covered === 0) continue;
    services.push({ service, extent: tally.covered === tally.total ? 'all' : 'partial' });
  }

  return { doctors, services };
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
