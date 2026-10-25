import { of } from 'rxjs';

import type {
  MedicalGroup,
  MedicalGroupListItem,
  MedicalGroupMember,
} from '../../core/data-access/medical-groups/medical-groups.types';

/** Un token «de utilería» con los claims que lee `SessionStore`, para las pruebas. */
export function tokenFor(claims: Record<string, unknown>): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.firma`;
}

export const ME = 'pr-me';
export const COLLEAGUE = 'pr-colega';

export function member(overrides: Partial<MedicalGroupMember> = {}): MedicalGroupMember {
  return {
    id: 'm-1',
    practitionerProfileId: COLLEAGUE,
    roleTitle: 'Anestesiólogo',
    agreedPaymentAmount: '500.00',
    isCreator: false,
    invitationStatus: 'PENDING',
    ...overrides,
  };
}

export function group(overrides: Partial<MedicalGroup> = {}): MedicalGroup {
  return {
    id: 'g-1',
    serviceCatalogId: 'svc-1',
    requestingPractitionerId: ME,
    scheduledAt: '2099-11-05T14:00:00.000Z',
    locationText: 'Quirófano 2',
    termsText: 'Términos del servicio.',
    status: 'PENDING_TEAM',
    isRealized: false,
    canEditExerciseNotes: false,
    isClosed: false,
    createdAt: '2026-10-24T10:00:00.000Z',
    members: [
      member({
        id: 'm-0',
        practitionerProfileId: ME,
        roleTitle: 'Responsable del grupo',
        agreedPaymentAmount: '0.00',
        isCreator: true,
        invitationStatus: 'ACCEPTED',
      }),
      member(),
    ],
    ...overrides,
  };
}

export function listItem(overrides: Partial<MedicalGroupListItem> = {}): MedicalGroupListItem {
  return {
    id: 'g-1',
    serviceCatalogId: 'svc-1',
    scheduledAt: '2099-11-05T14:00:00.000Z',
    locationText: 'Quirófano 2',
    status: 'PENDING_TEAM',
    isCreator: true,
    pendingMembersCount: 1,
    ...overrides,
  };
}

/** El cliente de perfiles, sin red: lo que las pantallas le piden para nombrar a la gente. */
export const PROFILES_STUB = {
  getPatient: () => of({ profileId: 'pat-1', displayName: 'Ana Paz', patientCode: 'P-1' }),
  getPractitionerProfile: (id: string) =>
    of({ profileId: id, displayName: id === ME ? 'Dra. Yo' : 'Dr. Colega', practitionerCode: 'D-1' }),
  searchPatients: () =>
    of({
      items: [{ profileId: 'pat-1', personId: 'per-1', patientCode: 'P-1', displayName: 'Ana Paz' }],
      count: 1,
      limit: 10,
      nextCursor: null,
    }),
  listPractitioners: () =>
    of({
      items: [
        { profileId: ME, practitionerCode: 'D-0', displayName: 'Dra. Yo' },
        { profileId: COLLEAGUE, practitionerCode: 'D-1', displayName: 'Dr. Colega', professionalTitle: 'Anestesiólogo' },
      ],
      nextCursor: null,
    }),
};

/** El catálogo de servicios, sin red. */
export const CATALOG_STUB = {
  listPractices: () => of([{ id: 'prac-1', code: 'P1', name: 'Clínica' }, { id: 'prac-2', code: 'P2', name: 'Consultorio' }]),
  search: () =>
    of({
      items: [{ id: 'svc-1', practiceId: 'prac-1', code: 'ART', name: 'Artroscopia', defaultPrice: '1.00', isActive: true }],
      count: 1,
      limit: 100,
      nextCursor: null,
    }),
};
