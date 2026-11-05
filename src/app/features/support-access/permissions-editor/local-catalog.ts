import type { PermissionCatalog } from '../../../core/data-access/access-governance/access-explain.types';
import {
  LEGACY_ALIAS_ATOMS,
  LEGACY_ALIAS_PRIMARY,
  ATOM_CATEGORY_LABELS,
  SUPPORT_ATOMS,
} from '../../../core/data-access/support-access/support-atoms';

/**
 * El catálogo de permisos que trae el front, para rotular el editor si `GET /org/permission-catalog` no responde.
 * La API es la fuente de verdad: esto solo evita dejar la pantalla sin nombres; lo que se puede dar lo sigue
 * decidiendo el servidor al simular y al guardar.
 */
export function localPermissionCatalog(): PermissionCatalog {
  return {
    atoms: SUPPORT_ATOMS.map((atom) => ({ ...atom })),
    categories: Object.entries(ATOM_CATEGORY_LABELS).map(([code, name]) => ({ code, name })),
    aliases: Object.entries(LEGACY_ALIAS_ATOMS).map(([code, atoms]) => ({
      code,
      atoms: [...atoms],
      primary: LEGACY_ALIAS_PRIMARY[code]!,
    })),
  };
}
