import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate as fecha, sinNulos, type ConNulos } from '../wire';
import type {
  InformedConsentRegistration,
  MyConsent,
  MyHipaaAuthorization,
  MyObjection,
  MyTreatmentConsent,
  NewEncounterInformedConsent,
} from './consent.types';

/** Lo que viaja por el cable: las fechas llegan como texto ISO y los vacíos como `null`. */
type WireMyConsent = Omit<MyConsent, 'validFrom' | 'validTo' | 'withdrawnAt' | 'createdAt'> & {
  readonly validFrom?: string | null;
  readonly validTo?: string | null;
  readonly withdrawnAt?: string | null;
  readonly createdAt: string;
};

type WireMyHipaa = Omit<MyHipaaAuthorization, 'expiresAt' | 'signedAt' | 'revokedAt'> & {
  readonly expiresAt?: string | null;
  readonly signedAt?: string | null;
  readonly revokedAt?: string | null;
};

type WireMyObjection = Omit<MyObjection, 'raisedAt' | 'resolvedAt'> & {
  readonly raisedAt?: string | null;
  readonly resolvedAt?: string | null;
};

type WireMyTreatment = Omit<MyTreatmentConsent, 'signedAt' | 'withdrawnAt'> & {
  readonly signedAt?: string | null;
  readonly withdrawnAt?: string | null;
};

interface Items<T> {
  readonly items: readonly T[];
}

/**
 * Cliente de `consent` (M07) — «Mi privacidad» y el consentimiento informado.
 *
 * Todo lo del titular cuelga de `/consent/me/...`: la persona sale de la cuenta y
 * ninguna ruta lleva un identificador de paciente. Lo ajeno responde 404.
 */
@Injectable({ providedIn: 'root' })
export class ConsentClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /consent/me/consents` — vigentes y retirados. */
  listMyConsents(): Observable<readonly MyConsent[]> {
    return this.http
      .get<Items<ConNulos<WireMyConsent>>>(this.url('/consent/me/consents'))
      .pipe(map(({ items }) => items.map((item) => toConsent(sinNulos(item) as WireMyConsent))));
  }

  /** `GET /consent/me/hipaa-authorizations` — las autorizaciones de divulgación. */
  listMyHipaaAuthorizations(): Observable<readonly MyHipaaAuthorization[]> {
    return this.http
      .get<Items<ConNulos<WireMyHipaa>>>(this.url('/consent/me/hipaa-authorizations'))
      .pipe(map(({ items }) => items.map((item) => toHipaa(sinNulos(item) as WireMyHipaa))));
  }

  /** `GET /consent/me/objections` — abiertas y resueltas. */
  listMyObjections(): Observable<readonly MyObjection[]> {
    return this.http
      .get<Items<ConNulos<WireMyObjection>>>(this.url('/consent/me/objections'))
      .pipe(map(({ items }) => items.map((item) => toObjection(sinNulos(item) as WireMyObjection))));
  }

  /** `GET /consent/me/treatment-informed-consents` — los que firmó en sus consultas. */
  listMyTreatmentConsents(): Observable<readonly MyTreatmentConsent[]> {
    return this.http
      .get<Items<ConNulos<WireMyTreatment>>>(this.url('/consent/me/treatment-informed-consents'))
      .pipe(map(({ items }) => items.map((item) => toTreatment(sinNulos(item) as WireMyTreatment))));
  }

  /**
   * `POST /consent/me/consents/:id/withdraw` — retira un consentimiento propio.
   *
   * La fila no se borra: cambia de estado y se cierra su vigencia. Lo ajeno o
   * inexistente responde 404.
   */
  withdrawMyConsent(consentId: string): Observable<{ readonly ok: boolean }> {
    return this.http.post<{ readonly ok: boolean }>(
      this.url(`/consent/me/consents/${encodeURIComponent(consentId)}/withdraw`),
      {},
    );
  }

  /**
   * `POST /consent/encounters/:encounterId/informed-consent` — el médico registra
   * el consentimiento informado del encuentro (CL-77). Queda en
   * `consent.treatment_informed_consents`, ligado al paciente y al encuentro.
   */
  registerEncounterInformedConsent(
    encounterId: string,
    consentimiento: NewEncounterInformedConsent,
  ): Observable<InformedConsentRegistration> {
    return this.http
      .post<Omit<InformedConsentRegistration, 'createdAt'> & { readonly createdAt: string }>(
        this.url(`/consent/encounters/${encodeURIComponent(encounterId)}/informed-consent`),
        Object.fromEntries(Object.entries(consentimiento).filter(([, valor]) => valor !== undefined)),
      )
      .pipe(map((body) => ({ ...body, createdAt: new Date(body.createdAt) })));
  }

  /** `GET /consent/encounters/:encounterId/informed-consent` — los registrados en el encuentro. */
  listEncounterInformedConsents(encounterId: string): Observable<readonly MyTreatmentConsent[]> {
    return this.http
      .get<Items<ConNulos<WireMyTreatment>>>(
        this.url(`/consent/encounters/${encodeURIComponent(encounterId)}/informed-consent`),
      )
      .pipe(map(({ items }) => items.map((item) => toTreatment(sinNulos(item) as WireMyTreatment))));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* ---- del cable a la vista ------------------------------------------------- */

function toConsent({ validFrom, validTo, withdrawnAt, createdAt, ...resto }: WireMyConsent): MyConsent {
  return {
    ...resto,
    ...(fecha(validFrom) === undefined ? {} : { validFrom: fecha(validFrom) }),
    ...(fecha(validTo) === undefined ? {} : { validTo: fecha(validTo) }),
    ...(fecha(withdrawnAt) === undefined ? {} : { withdrawnAt: fecha(withdrawnAt) }),
    createdAt: new Date(createdAt),
  } as MyConsent;
}

function toHipaa({ expiresAt, signedAt, revokedAt, ...resto }: WireMyHipaa): MyHipaaAuthorization {
  return {
    ...resto,
    ...(fecha(expiresAt) === undefined ? {} : { expiresAt: fecha(expiresAt) }),
    ...(fecha(signedAt) === undefined ? {} : { signedAt: fecha(signedAt) }),
    ...(fecha(revokedAt) === undefined ? {} : { revokedAt: fecha(revokedAt) }),
  } as MyHipaaAuthorization;
}

function toObjection({ raisedAt, resolvedAt, ...resto }: WireMyObjection): MyObjection {
  return {
    ...resto,
    ...(fecha(raisedAt) === undefined ? {} : { raisedAt: fecha(raisedAt) }),
    ...(fecha(resolvedAt) === undefined ? {} : { resolvedAt: fecha(resolvedAt) }),
  } as MyObjection;
}

function toTreatment({ signedAt, withdrawnAt, ...resto }: WireMyTreatment): MyTreatmentConsent {
  return {
    ...resto,
    ...(fecha(signedAt) === undefined ? {} : { signedAt: fecha(signedAt) }),
    ...(fecha(withdrawnAt) === undefined ? {} : { withdrawnAt: fecha(withdrawnAt) }),
  } as MyTreatmentConsent;
}
