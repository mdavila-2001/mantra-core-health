import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { ProfilesClient } from '../data-access/profiles/profiles.client';
import type { Dependent } from '../data-access/profiles/profiles.types';
import { PatientContextService } from './patient-context.service';
import { patientSilhouetteSex } from './patient-silhouette-sex';

/**
 * The silhouette follows the patient of the screen (bug 2026-11-05: a male
 * patient booking with a female practitioner saw a female-looking figure).
 */
describe('patientSilhouetteSex', () => {
  const ownProfile = vi.fn();
  const ownId = signal<string | null>('pp-own');
  const dependents = signal<readonly Dependent[]>([]);

  function build(profileId: () => string | null) {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { patientProfileId: ownId } },
        { provide: PatientContextService, useValue: { dependents } },
        { provide: ProfilesClient, useValue: { getOwnPatientProfile: ownProfile } },
      ],
    });
    const sex = TestBed.runInInjectionContext(() => patientSilhouetteSex(profileId));
    TestBed.tick();
    return sex;
  }

  function child(sexAtBirth?: Dependent['sexAtBirth']): Dependent {
    return {
      id: 'proxy-1',
      patientProfileId: 'pp-child',
      personId: 'per-child',
      fullName: 'Mateo Quispe',
      relationshipCode: 'CHILD',
      relationshipDisplay: 'Hijo/a',
      isLegalGuardian: true,
      ...(sexAtBirth === undefined ? {} : { sexAtBirth }),
    };
  }

  beforeEach(() => {
    ownProfile.mockReset();
    ownId.set('pp-own');
    dependents.set([]);
  });

  it('uses the own profile sex when the screen is about the session patient', () => {
    ownProfile.mockReturnValue(of({ sexAtBirth: 'MALE' }));
    expect(build(() => 'pp-own')()).toBe('MALE');
  });

  it('uses the dependent sex and never asks for the own profile', () => {
    dependents.set([child('FEMALE')]);
    expect(build(() => 'pp-child')()).toBe('FEMALE');
    expect(ownProfile).not.toHaveBeenCalled();
  });

  it('a dependent without declared sex gets the neutral figure, not the parent one', () => {
    ownProfile.mockReturnValue(of({ sexAtBirth: 'MALE' }));
    dependents.set([child()]);
    expect(build(() => 'pp-child')()).toBeUndefined();
  });

  it('a patient that is neither own nor dependent is unknown', () => {
    expect(build(() => 'pp-someone-else')()).toBeUndefined();
    expect(ownProfile).not.toHaveBeenCalled();
  });

  it('INTERSEX, UNKNOWN, no profile and a failed read all yield the neutral figure', () => {
    ownProfile.mockReturnValue(of({ sexAtBirth: 'INTERSEX' }));
    expect(build(() => 'pp-own')()).toBeUndefined();
    TestBed.resetTestingModule();
    ownProfile.mockReturnValue(throwError(() => new Error('500')));
    expect(build(() => 'pp-own')()).toBeUndefined();
    TestBed.resetTestingModule();
    expect(build(() => null)()).toBeUndefined();
  });
});
