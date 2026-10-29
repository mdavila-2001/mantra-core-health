import type {
  BranchListItem,
  MembershipListItem,
  TenantListItem,
} from '../../../../core/data-access/directory/directory.types';
import { empty, ready } from '../../../../core/view-state/view-state';
import type {
  ViewState,
  ViewStateNextAction,
} from '../../../../core/view-state/view-state.types';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';

/**
 * Variante del badge por **código** de concepto. Mismo criterio que el
 * listado: el código es lo estable, la etiqueta es presentación. Lo que no
 * figura se pinta `info` — estado desconocido no es estado roto.
 */
export const VARIANTE_POR_CODIGO: Readonly<Record<string, BadgeVariant>> = {
  TENANT_ACTIVE: 'success',
  DIR_TENANT_PENDING: 'warning',
  DIR_TENANT_SUSPENDED: 'error',
  TENANT_VERIFIED: 'success',
  DIR_TENANT_UNVERIFIED: 'warning',
  DIR_BRANCH_ACTIVE: 'success',
  DIR_BRANCH_CLOSED: 'secondary',
  DIR_MEMBERSHIP_ACTIVE: 'success',
  DIR_MEMBERSHIP_ENDED: 'secondary',
  DIR_MEMBERSHIP_SUSPENDED: 'error',
};

/** Una lectura que se resolvió con fallo en vez de con datos. */
export interface Fallo {
  readonly error: unknown;
}

export function esFallo(valor: object): valor is Fallo {
  return 'error' in valor;
}

/**
 * De la lista al estado. El vacío lleva su propio texto y su propia salida:
 * «no hay sucursales» y «no hay sub-organizaciones» son situaciones distintas,
 * y la tercera —una organización sin sub-organizaciones— es lo normal, no una
 * carencia. Decirlo evita que alguien crea que le falta cargar algo.
 */
export function estadoDeLista<T>(
  items: readonly T[],
  accion: ViewStateNextAction,
  mensaje: string,
): ViewState<readonly T[]> {
  return items.length === 0 ? empty(accion, mensaje) : ready(items);
}

/**
 * Los concept ids únicos de toda la ficha, para resolverlos en una sola
 * llamada. `Set` porque el mismo estado se repite en casi todas las filas.
 */
export function conceptosDe(fuentes: {
  readonly ficha?: TenantListItem;
  readonly sucursales?: readonly BranchListItem[];
  readonly membresias?: readonly MembershipListItem[];
  readonly hijas?: readonly TenantListItem[];
}): readonly string[] {
  const ids = new Set<string>();
  const agregar = (id: string | undefined): void => {
    if (id !== undefined) {
      ids.add(id);
    }
  };

  if (fuentes.ficha !== undefined) {
    agregar(fuentes.ficha.tenantTypeConceptId);
    agregar(fuentes.ficha.statusConceptId);
    agregar(fuentes.ficha.verificationStatusConceptId);
  }
  for (const sucursal of fuentes.sucursales ?? []) {
    agregar(sucursal.branchTypeConceptId);
    agregar(sucursal.statusConceptId);
  }
  for (const membresia of fuentes.membresias ?? []) {
    agregar(membresia.tenantRoleConceptId);
    agregar(membresia.statusConceptId);
    agregar(membresia.accessScopeConceptId);
  }
  for (const hija of fuentes.hijas ?? []) {
    agregar(hija.statusConceptId);
  }

  return [...ids];
}
