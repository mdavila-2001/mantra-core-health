import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import type { ChallengeRequestOptions } from '../../access-challenge/access-challenge';
import { API_BASE_URL, apiUrl } from '../api';
import type {
  ExactPatientQuery,
  SupportPatientMatch,
  NewSupportPatient,
  SupportPatientRegistration,
  SupportPatientSearchResult,
} from './support-patients.types';

/**
 * La API manda el perfil como `patientProfileId` y como `profileId` (el mismo valor, por
 * el contrato compartido); las pantallas leen `profileId`. En un duplicado de otra
 * organización no hay ninguno y no se inventa uno.
 */
function conPerfil<T extends { readonly profileId?: string; readonly patientProfileId?: string }>(fila: T): Omit<T, 'patientProfileId'> {
  const { patientProfileId, ...resto } = fila;
  const perfil = fila.profileId ?? patientProfileId;
  return { ...resto, ...(perfil === undefined ? {} : { profileId: perfil }) };
}

/**
 * Pacientes de la **agenda combinada**: búsqueda exacta y alta rápida.
 *
 * Las dos rutas están en `support-patients.types.ts`. Van aparte
 * de `SupportAccessClient` porque son de otro dominio —el padrón de pacientes— y
 * porque la búsqueda de quien trabaja con un vínculo de apoyo **no es** la
 * búsqueda libre del médico: es exacta y queda en la bitácora de la organización.
 */
@Injectable({ providedIn: 'root' })
export class SupportPatientsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }

  /**
   * `POST /me/support-patient-search`. Documento completo, teléfono
   * completo, o nombre completo + fecha de nacimiento. La API **rechaza** lo
   * parcial con 422 `SUPPORT_PATIENT_SEARCH_INEXACT`; la pantalla ni siquiera lo envía,
   * pero no depende de eso. Tope por persona: 20 por minuto y 200 por día (429).
   *
   * La organización va en el cuerpo como `tenantId` (así lo declara
   * `SupportPatientSearchDto` de la API) y el documento como `nationalId`: la búsqueda se audita en la organización donde la
   * persona está actuando, que no siempre es la de la sesión.
   */
  searchExact(org: string, query: ExactPatientQuery, options?: ChallengeRequestOptions): Observable<SupportPatientSearchResult> {
    const filtros =
      query.kind === 'DOCUMENT'
        ? { nationalId: query.document }
        : query.kind === 'PHONE'
          ? { phone: query.phone }
          : { fullName: query.fullName, birthDate: query.birthDate };
    return this.http
      .post<{ readonly items: readonly SupportPatientMatch[]; readonly count?: number }>(this.url('/me/support-patient-search'), { tenantId: org, ...filtros }, options)
      .pipe(map((cuerpo) => ({ items: cuerpo.items.map((p) => conPerfil(p) as SupportPatientMatch), ...(cuerpo.count === undefined ? {} : { count: cuerpo.count }) })));
  }

  /**
   * `POST /me/support-patients`. Registra a un paciente nuevo: 201 `CREATED` o, si hay
   * posibles duplicados y no se pidió seguir (`acknowledgeDuplicates`), 200
   * `POSSIBLE_DUPLICATES` y **no crea**, para que quien registra decida. Con
   * `acknowledgeDuplicates` crea igual, salvo un documento ya registrado (409
   * `SUPPORT_PATIENT_DOCUMENT_REGISTERED`); un menor sin representante es 422
   * `SUPPORT_PATIENT_GUARDIAN_REQUIRED`.
   */
  register(org: string, patient: NewSupportPatient): Observable<SupportPatientRegistration> {
    return this.http
      .post<SupportPatientRegistration>(this.url('/me/support-patients'), {
      tenantId: org,
      name: patient.name,
      lastName: patient.lastName,
      ...(patient.motherLastName === undefined || patient.motherLastName === '' ? {} : { motherLastName: patient.motherLastName }),
      document: patient.document,
      birthDate: patient.birthDate,
      phone: patient.phone,
      ...(patient.guardian === undefined ? {} : { guardian: patient.guardian }),
      inviteToPortal: patient.inviteToPortal,
      ...(patient.acknowledgeDuplicates === true ? { acknowledgeDuplicates: true } : {}),
    })
      .pipe(
        map((cuerpo) =>
          cuerpo.outcome === 'CREATED'
            ? ({ ...cuerpo, patient: conPerfil(cuerpo.patient) as SupportPatientMatch } as SupportPatientRegistration)
            : ({ ...cuerpo, duplicates: cuerpo.duplicates.map((d) => conPerfil(d)) } as SupportPatientRegistration),
        ),
      );
  }
}
