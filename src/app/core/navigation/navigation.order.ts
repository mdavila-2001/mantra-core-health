import { NAV_SUBGROUPS, seAplanaElGrupo } from './navigation.subgroups';
import type { NavGroup, NavMenuBlock } from './navigation.types';

/**
 * Domains whose blocks are drawn in the order declared in {@link NAV_SUBGROUPS}
 * (people and access → organizations and network → insurance → catalogs) instead
 * of the registry order. The two admin domains overlap otherwise: their sections
 * are spread across the registry. Presentation only: no route is added or removed.
 */
const GRUPOS_ORDENADOS_POR_DOMINIO: ReadonlySet<NavGroup> = new Set<NavGroup>([
  'Administración',
  'Superadministración',
]);

/** Position of a block in the declared order; loose sections (no block) stay first, as the domain's cover. */
function rank(label: string): number {
  return NAV_SUBGROUPS.findIndex((s) => s.label === label);
}

/**
 * Blocks of a group in domain order. Flattened domains (e.g. the insurer's) and
 * every other group keep the registry order they always had.
 */
export function ordenarPorDominio(
  group: NavGroup,
  activeTenantType: string | null,
  bloques: readonly NavMenuBlock[],
): readonly NavMenuBlock[] {
  if (!GRUPOS_ORDENADOS_POR_DOMINIO.has(group) || seAplanaElGrupo(group, activeTenantType)) {
    return bloques;
  }
  return [...bloques].sort((a, b) => rank(a.label) - rank(b.label));
}
