import { MEDICAL_ORGANIZATION_TYPES } from '../data-access/directory/directory.types';
import { ANY_ROLE } from './navigation.types';
import type { AppSection } from './navigation.types';

/**
 * The doctors of a medical organization, in two doors (2026-11-07): who asks to join («Médicos del
 * centro»: invite, approve, reject) and the access of those who already work there («Accesos de
 * médicos»: suspend, end). Both screens existed or lived behind «Mi organización»; the API
 * decides who may act (OWNER/ADMIN of the organization).
 */
export const MEDICAL_ORGANIZATION_DOCTOR_SECTIONS: readonly AppSection[] = [
  {
    path: 'administration/my-organization/affiliations',
    onlyForTenantTypes: MEDICAL_ORGANIZATION_TYPES,
    roles: [ANY_ROLE],
    fueraDelMenuPara: ['PRACTITIONER'],
    hiddenFor: ['PATIENT'],
    label: 'Médicos del centro',
    group: 'Atención',
    icon: 'people',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Invite médicos a su sede y apruebe o rechace a quienes piden sumarse.',
    module: 'M14 practice',
  },
  {
    path: 'administration/doctor-access',
    onlyForTenantTypes: MEDICAL_ORGANIZATION_TYPES,
    roles: [ANY_ROLE],
    fueraDelMenuPara: ['PRACTITIONER'],
    hiddenFor: ['PATIENT'],
    label: 'Accesos de médicos',
    group: 'Atención',
    icon: 'shield',
    requiresTenant: true,
    availability: 'disponible',
    summary: 'Revise quién trabaja en su organización y suspenda o termine su acceso.',
    module: 'M14 practice',
  },
];
