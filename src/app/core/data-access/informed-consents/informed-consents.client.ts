import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  CreateInformedConsentInput,
  InformedConsent,
  InformedConsentFilter,
} from './informed-consents.types';

/** Lo que viaja por el cable: los instantes llegan como texto ISO. */
/**
 * Lo que viaja por el cable (`TreatmentInformedConsentResponseDto`).
 *
 * La API **omite** las claves sin valor en vez de mandarlas en `null`, y los
 * instantes llegan como texto ISO. Por eso todo lo opcional es opcional acá y
 * {@link desdeElCable} lo normaliza a `null`.
 */
export type WireInformedConsent = {
  readonly [K in keyof SinEvidencia as K extends ClavesObligatorias ? K : never]: SinEvidencia[K] extends Date
    ? string
    : SinEvidencia[K];
} & {
  readonly [K in keyof SinEvidencia as K extends ClavesObligatorias ? never : K]?:
    | (NonNullable<SinEvidencia[K]> extends Date ? string : SinEvidencia[K])
    | null;
} & {
  readonly statusConceptId?: string;
  readonly decisionConceptId?: string;
  readonly evidence?: readonly WireEvidence[];
};

type SinEvidencia = Omit<InformedConsent, 'evidence'>;

type ClavesObligatorias = 'id' | 'patientProfileId' | 'decision' | 'status' | 'createdAt';

interface WireEvidence {
  readonly id: string;
  readonly evidenceTypeConceptId?: string | null;
  readonly capturedChannelConceptId?: string | null;
  readonly recordedAt: string;
}

/** `GET /consent/treatment-informed-consents` responde envuelto. */
interface WireList {
  readonly items: readonly WireInformedConsent[];
}

/**
 * Cliente del **consentimiento informado dirigido** (`src/modules/consent`).
 *
 * Cuatro operaciones y ninguna más: registrar (aceptación o rechazo), listar
 * por paciente y objeto, leer uno y revocar. No hay «editar»: un
 * consentimiento firmado no se corrige, se revoca y se registra otro, y eso es
 * lo que deja la trazabilidad que la norma exige del expediente.
 *
 * La autoridad es la API: estas llamadas no deciden quién puede consentir ni
 * qué objeto existe; si el servidor dice 403 o 404, la pantalla lo muestra.
 */
@Injectable({ providedIn: 'root' })
export class InformedConsentsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /consent/treatment-informed-consents` — más reciente primero. */
  list(filtro: InformedConsentFilter): Observable<InformedConsent[]> {
    let params = new HttpParams().set('patientProfileId', filtro.patientProfileId);
    if (filtro.targetType !== undefined) params = params.set('targetType', filtro.targetType);
    if (filtro.targetId !== undefined) params = params.set('targetId', filtro.targetId);
    return this.http
      .get<WireList>(this.url('/consent/treatment-informed-consents'), { params })
      .pipe(map((cuerpo) => cuerpo.items.map(desdeElCable)));
  }

  /** `GET /consent/treatment-informed-consents/:id`. */
  get(id: string): Observable<InformedConsent> {
    return this.http
      .get<WireInformedConsent>(
        this.url(`/consent/treatment-informed-consents/${encodeURIComponent(id)}`),
      )
      .pipe(map(desdeElCable));
  }

  /** `POST /consent/treatment-informed-consents` — aceptación o rechazo. */
  create(input: CreateInformedConsentInput): Observable<InformedConsent> {
    return this.http
      .post<WireInformedConsent>(
        this.url('/consent/treatment-informed-consents'),
        sinVacios(input),
      )
      .pipe(map(desdeElCable));
  }

  /**
   * `PATCH /consent/treatment-informed-consents/:id/withdraw` — revocación con
   * motivo. Revocar uno ya revocado devuelve 409.
   */
  withdraw(id: string, reason: string): Observable<InformedConsent> {
    return this.http
      .patch<WireInformedConsent>(
        this.url(`/consent/treatment-informed-consents/${encodeURIComponent(id)}/withdraw`),
        { reason },
      )
      .pipe(map(desdeElCable));
  }

  /**
   * Adjunta la firma como evidencia (`POST …/:id/evidence`).
   *
   * La API reutiliza `ConsentEvidenceService` (enmienda 1 §4.2): el sujeto lo
   * pone la ruta, así que el cuerpo es la evidencia sin `subjectType` ni
   * `subjectId`. Sin `evidenceTypeConceptId`, el servidor la registra como firma.
   */
  addEvidence(consentId: string, documentFileId: string): Observable<unknown> {
    return this.http.post(
      this.url(`/consent/treatment-informed-consents/${encodeURIComponent(consentId)}/evidence`),
      { documentFileId },
    );
  }

  /** `PATCH …/:id/post-emergency-information` — cierra el caso de urgencia informando después. */
  informPostEmergency(id: string, informedAt: Date): Observable<InformedConsent> {
    return this.http
      .patch<WireInformedConsent>(
        this.url(
          `/consent/treatment-informed-consents/${encodeURIComponent(id)}/post-emergency-information`,
        ),
        { informedAt: informedAt.toISOString() },
      )
      .pipe(map(desdeElCable));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** Del cable al dominio: los instantes como `Date`, lo omitido como `null`. */
export function desdeElCable(c: WireInformedConsent): InformedConsent {
  const fecha = (v: string | null | undefined): Date | null =>
    v === null || v === undefined ? null : new Date(v);
  const evidence = (c.evidence ?? []).map((e) => ({
    id: e.id,
    evidenceTypeConceptId: e.evidenceTypeConceptId ?? null,
    capturedChannelConceptId: e.capturedChannelConceptId ?? null,
    recordedAt: new Date(e.recordedAt),
  }));
  return {
    id: c.id,
    patientProfileId: c.patientProfileId,
    decision: c.decision,
    status: c.status,
    encounterId: c.encounterId ?? null,
    targetType: c.targetType ?? null,
    targetId: c.targetId ?? null,
    targetLabel: c.targetLabel ?? null,
    diagnosisText: c.diagnosisText ?? null,
    purposeText: c.purposeText ?? null,
    benefitsText: c.benefitsText ?? null,
    risksText: c.risksText ?? null,
    personalizedRisksText: c.personalizedRisksText ?? null,
    alternativesText: c.alternativesText ?? null,
    refusalConsequencesText: c.refusalConsequencesText ?? null,
    patientQuestionsText: c.patientQuestionsText ?? null,
    grantedBy: c.grantedBy ?? null,
    representativeName: c.representativeName ?? null,
    representativeDocument: c.representativeDocument ?? null,
    representativeRelationship: c.representativeRelationship ?? null,
    incapacityReason: c.incapacityReason ?? null,
    informedByProfileId: c.informedByProfileId ?? null,
    channel: c.channel ?? null,
    exceptionType: c.exceptionType ?? null,
    exceptionJustification: c.exceptionJustification ?? null,
    withdrawalReason: c.withdrawalReason ?? null,
    witnessName: c.witnessName ?? null,
    witnessDocument: c.witnessDocument ?? null,
    informationLanguage: c.informationLanguage ?? null,
    assentObtained: c.assentObtained ?? null,
    assentNotes: c.assentNotes ?? null,
    revocationRightInformed: c.revocationRightInformed ?? null,
    postEmergencyInformedAt: fecha(c.postEmergencyInformedAt),
    evidence,
    // La API lo deriva; si una versión vieja no lo manda, se deriva igual.
    signatureStatus: c.signatureStatus ?? (evidence.length > 0 ? 'SIGNED' : 'PENDING'),
    signedAt: fecha(c.signedAt),
    withdrawnAt: fecha(c.withdrawnAt),
    createdAt: new Date(c.createdAt),
  };
}

/**
 * El backend valida con `forbidNonWhitelisted` y con `@IsNotEmpty` en los
 * textos: una clave en `undefined` o un texto en blanco se omite en vez de
 * viajar como «dato» vacío.
 */
function sinVacios<T extends object>(valor: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(valor)
      .filter(([, v]) => v !== undefined && v !== null)
      .filter(([, v]) => typeof v !== 'string' || v.trim() !== '')
      .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
  ) as Partial<T>;
}
