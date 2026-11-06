import { computed, inject, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { ProfilesClient } from '../data-access/profiles/profiles.client';
import { PatientContextService } from './patient-context.service';

/**
 * Sex at birth of the patient a screen is about, for the body-map silhouette.
 *
 * The figure must follow the patient of the visit, never the practitioner and
 * never blindly the logged-in account: a parent booking for their son must
 * see a boy's silhouette. Sources, in order:
 * - a dependent of the session → `sexAtBirth` from the dependents list;
 * - the session's own patient profile → `GET /profiles/patients/me`;
 * - anyone else (staff booking for a searched patient) → unknown.
 *
 * Unknown, `INTERSEX` and `UNKNOWN` yield `undefined`: the body map then draws
 * its neutral figure. A failed read never breaks the screen.
 *
 * Must be called in an injection context (field initializer).
 *
 * @param profileId - Patient profile the screen is about; `null` if none.
 */
export function patientSilhouetteSex(
  profileId: () => string | null,
): Signal<'MALE' | 'FEMALE' | undefined> {
  const auth = inject(AuthService);
  const context = inject(PatientContextService);
  const profiles = inject(ProfilesClient);

  // Only the own profile is fetched; `null` means "not the own profile".
  const ownId = computed(() => {
    const id = profileId();
    return id !== null && id === auth.patientProfileId() ? id : null;
  });
  const ownSex = toSignal(
    toObservable(ownId).pipe(
      distinctUntilChanged(),
      switchMap((id) =>
        id === null
          ? of(undefined)
          : profiles.getOwnPatientProfile().pipe(
              map((profile) => profile.sexAtBirth),
              catchError(() => of(undefined)),
            ),
      ),
    ),
    { initialValue: undefined },
  );

  return computed(() => {
    const id = profileId();
    if (id === null) return undefined;
    const dependent = context.dependents().find((d) => d.patientProfileId === id);
    const sex = dependent === undefined ? ownSex() : dependent.sexAtBirth;
    return sex === 'MALE' || sex === 'FEMALE' ? sex : undefined;
  });
}
