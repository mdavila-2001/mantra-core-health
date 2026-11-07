import { MEDICAL_ORGANIZATION_TYPES } from '../data-access/directory/directory.types';
import { ANY_ROLE } from './navigation.types';
import { MEDICAL_ORGANIZATION_DOCTOR_SECTIONS } from './navigation.medical-doctors';
import type { AppSection } from './navigation.types';

/** The «Configurar práctica» route: the menu hides it once the organization has its practice. */
export const MEDICAL_SETUP_PATH = 'administration/medical-center-setup';

/**
 * "Sucursales" and «Configurar práctica» for the medical organization. They live outside
 * `navigation.map.ts` because that registry is frozen by `scripts/check-max-lines.mjs`
 * (Sucursales since 2026-11-06, «Configurar práctica» moved here on 2026-11-07); the
 * map spreads them in the same place, so the menu order is unchanged.
 */
export const MEDICAL_ORGANIZATION_BRANCH_SECTIONS: readonly AppSection[] = [
  ...MEDICAL_ORGANIZATION_DOCTOR_SECTIONS,
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
  {
    // CM-11 · la organización médica (los cinco tipos del alta) abre su práctica
    // y su primera sede. Cuelga de `administration/`: una raíz propia se iría al
    // proxy. La API decide quién puede (membresía OWNER/ADMIN de esa organización
    // verificada); acá sólo se ofrece la puerta a quien tiene ese tipo de cuenta.
    // Once the practice exists the menu stops offering it (`NavigationService.menu`);
    // the route stays reachable for the links that point to it.
    path: MEDICAL_SETUP_PATH,
    onlyForTenantTypes: MEDICAL_ORGANIZATION_TYPES,
    roles: [ANY_ROLE],
    fueraDelMenuPara: ['PRACTITIONER'],
    hiddenFor: ['PATIENT'],
    label: 'Configurar práctica',
    // Moved out of «Administración» into «Atención» on 2026-11-05 (owner request).
    group: 'Atención',
    icon: 'hospital',
    requiresTenant: true,
    availability: 'disponible',
    summary:
      'Abra la práctica de su organización y su primera sede, con dirección y punto en el mapa.',
    module: 'M14 practice',
  },
];
