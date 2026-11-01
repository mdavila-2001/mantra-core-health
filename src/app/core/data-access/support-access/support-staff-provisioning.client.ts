import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { API_BASE_URL, apiUrl } from '../api';
import type {
  CreateOrgSecretaryPayload,
  CreatePractitionerSecretaryPayload,
  CreatedSupportStaffResponse,
} from './support-provisioning.types';

/**
 * Cliente HTTP para la creación directa y vinculación automática
 * de cuentas de secretaria por doctores u organizaciones.
 */
@Injectable({ providedIn: 'root' })
export class SupportStaffProvisioningClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL, { optional: true }) ?? environment.apiBaseUrl;

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }

  /** El doctor crea una cuenta de secretaria y la vincula de inmediato a su práctica. */
  createPractitionerSecretary(
    payload: CreatePractitionerSecretaryPayload,
  ): Observable<CreatedSupportStaffResponse> {
    return this.http.post<CreatedSupportStaffResponse>(
      this.url('/me/practitioner/support-staff'),
      payload,
    );
  }

  /** La organización crea una cuenta de secretaria y la vincula de inmediato a la institución. */
  createOrganizationSecretary(
    payload: CreateOrgSecretaryPayload,
  ): Observable<CreatedSupportStaffResponse> {
    return this.http.post<CreatedSupportStaffResponse>(
      this.url('/org/support-staff'),
      payload,
    );
  }
}
