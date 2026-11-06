import { MEDICAL_ORGANIZATION_TYPES } from '../data-access/directory/directory.types';
import { ANY_ROLE } from './navigation.types';
import type { AppSection } from './navigation.types';

/**
 * "Sucursales" for the medical organization (2026-11-06). Lives outside
 * `navigation.map.ts` because that registry is frozen by
 * `scripts/check-max-lines.mjs`; the map spreads it right before
 * "Configurar práctica", so the menu order is unchanged.
 */
export const MEDICAL_ORGANIZATION_BRANCH_SECTIONS: readonly AppSection[] = [
  {
    // Medical organization branches (2026-11-06): the same screen as pharmacy,
    // laboratory and imaging (map with each site's point and its category).
    // Registration copies the declared sites there (API v4.2.91).
    path: 'administration/medical-branches',
    onlyForTenantTypes: MEDICAL_ORGANIZATION_TYPES,
    roles: [ANY_ROLE],
    fueraDelMenuPara: ['PRACTITIONER'],
    hiddenFor: ['PATIENT'],
    label: 'Sucursales',
    group: 'Atención',
    icon: 'pin',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Sus sedes en el mapa, con su categoría: casa matriz, sucursal o por defecto.',
    module: 'M04 directory',
  },
];
