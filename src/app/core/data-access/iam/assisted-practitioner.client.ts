import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AssistedPractitionerRegistration,
  AssistedPractitionerResult,
} from './assisted-practitioner.types';

/** Lo que la API devuelve, con la caducidad todavía como texto. */
interface AssistedPractitionerBody {
  readonly userId: string;
  readonly personId: string;
  readonly practitionerProfileId: string;
  readonly practitionerCode: string;
  readonly licenseId: string;
  readonly verificationStatus: string;
  readonly activationToken: string;
  readonly activationExpiresAt: string;
  readonly clinicalRoles?: readonly string[];
}

/**
 * Alta administrativa de un médico (`POST /iam/users/assisted-practitioner-registration`).
 *
 * Vive aparte de `IamClient` porque ese archivo ya está en su techo de tamaño.
 * Una sola petición y una sola transacción del lado de la API: o quedó la
 * cuenta con su código de activación y su perfil, o no quedó nada.
 */
@Injectable({ providedIn: 'root' })
export class AssistedPractitionerClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  register(registration: AssistedPractitionerRegistration): Observable<AssistedPractitionerResult> {
    // Campo a campo: la API valida con `forbidNonWhitelisted`, y un opcional en
    // `undefined`, un texto vacío o una lista vacía no deben viajar.
    return this.http
      .post<AssistedPractitionerBody>(apiUrl(this.baseUrl, '/iam/users/assisted-practitioner-registration'), {
        email: registration.email,
        // El nombre viaja en partes y la API compone el que se muestra.
        name: registration.name,
        lastName: registration.lastName,
        ...(registration.middleName === undefined ? {} : { middleName: registration.middleName }),
        ...(registration.motherLastName === undefined ? {} : { motherLastName: registration.motherLastName }),
        licenseNumber: registration.licenseNumber,
        nationalId: registration.nationalId,
        issuerAdministrativeAreaConceptId: registration.issuerAdministrativeAreaConceptId,
        ...(registration.specialtyConceptIds === undefined || registration.specialtyConceptIds.length === 0
          ? {}
          : { specialtyConceptIds: [...registration.specialtyConceptIds] }),
        ...(registration.clinicalRoles === undefined || registration.clinicalRoles.length === 0
          ? {}
          : { clinicalRoles: [...registration.clinicalRoles] }),
        reason: registration.reason,
      })
      .pipe(
        map((body) => ({
          userId: body.userId,
          personId: body.personId,
          practitionerProfileId: body.practitionerProfileId,
          practitionerCode: body.practitionerCode,
          licenseId: body.licenseId,
          verificationStatus: body.verificationStatus,
          activationToken: body.activationToken,
          activationExpiresAt: new Date(body.activationExpiresAt),
          clinicalRoles: body.clinicalRoles ?? [],
        })),
      );
  }
}
