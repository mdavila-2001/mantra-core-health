import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { RegisteredSupportStaff, SupportStaffRegistration } from './support-staff.types';

/**
 * El alta de la secretaria (personal de apoyo). Pedir y aceptar vínculos con
 * hospitales y doctores vive en `core/data-access/support-access`.
 */
@Injectable({ providedIn: 'root' })
export class SupportStaffClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /iam/auth/register-support-staff` — el alta. Pública, como la de
   * paciente. El cuerpo se arma campo por campo: la API valida con
   * `forbidNonWhitelisted` y una clave de más tumba el alta entera.
   */
  registerSupportStaff(registration: SupportStaffRegistration): Observable<RegisteredSupportStaff> {
    const middleName = registration.middleName?.trim() ?? '';
    const motherLastName = registration.motherLastName?.trim() ?? '';
    return this.http.post<RegisteredSupportStaff>(this.url('/iam/auth/register-support-staff'), {
      nationalId: registration.nationalId,
      issuerAdministrativeAreaConceptId: registration.issuerAdministrativeAreaConceptId,
      password: registration.password,
      name: registration.name,
      lastName: registration.lastName,
      ...(middleName === '' ? {} : { middleName }),
      ...(motherLastName === '' ? {} : { motherLastName }),
      email: registration.email,
      birthDate: registration.birthDate,
      phone: registration.phone,
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
