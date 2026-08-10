import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AssertionRevocation,
  CheckPlan,
  CreatedVerificationPolicy,
  DecidedManualReview,
  ExpireSweepResult,
  IssuedAssertion,
  ManualReviewDecision,
  NewAuthorityEndpoint,
  NewCaseEvidence,
  NewCheckAttempt,
  NewCheckResult,
  NewFraudSignal,
  NewIdentityAssertion,
  NewIdentityAuthority,
  NewManualReview,
  NewVerificationCase,
  NewVerificationPolicy,
  OpenedCase,
  OpenedManualReview,
  PlannedChecksResult,
  PublishedAuthorityEndpoint,
  RaisedFraudSignal,
  RecordedAttempt,
  RecordedCheckResult,
  RegisteredAuthority,
  RevokedAssertion,
  SubmittedEvidence,
} from './identity-admin.types';

interface ConAltaBody {
  readonly createdAt: string;
}

/** El cuerpo tal como viaja: igual al tipo de la vista, con la fecha en ISO. */
type EnCable<T extends { createdAt: Date }> = Omit<T, 'createdAt'> & ConAltaBody;

interface OpenedCaseBody {
  readonly id: string;
  readonly status: string;
  readonly openedAt?: string;
  readonly expiresAt?: string;
}

interface IssuedAssertionBody {
  readonly id: string;
  readonly assertionIdentifier?: string;
  readonly assuranceLevel: string;
  readonly issuedAt?: string;
  readonly caseStatus: string;
}

interface RevokedAssertionBody {
  readonly id: string;
  readonly revokedAt: string;
  readonly caseStatus: string;
}

function conAlta<T extends ConAltaBody>(body: T): Omit<T, 'createdAt'> & { createdAt: Date } {
  return { ...body, createdAt: new Date(body.createdAt) };
}

function toOpenedCase(body: OpenedCaseBody): OpenedCase {
  return {
    id: body.id,
    status: body.status,
    ...(body.openedAt === undefined ? {} : { openedAt: new Date(body.openedAt) }),
    ...(body.expiresAt === undefined ? {} : { expiresAt: new Date(body.expiresAt) }),
  };
}

function toIssuedAssertion(body: IssuedAssertionBody): IssuedAssertion {
  return {
    id: body.id,
    ...(body.assertionIdentifier === undefined
      ? {}
      : { assertionIdentifier: body.assertionIdentifier }),
    assuranceLevel: body.assuranceLevel,
    ...(body.issuedAt === undefined ? {} : { issuedAt: new Date(body.issuedAt) }),
    caseStatus: body.caseStatus,
  };
}

function toRevokedAssertion(body: RevokedAssertionBody): RevokedAssertion {
  return {
    id: body.id,
    revokedAt: new Date(body.revokedAt),
    caseStatus: body.caseStatus,
  };
}

/**
 * Cliente del lado administrativo de `identity_assurance` (M27): autoridades,
 * políticas y el ciclo del caso de verificación.
 *
 * Es **solo de comando** —14 POST, ningún GET de colección hasta que llegue
 * X1—, todos bajo `SECURITY_ADMIN`. El autoservicio del titular vive aparte,
 * en `IdentityClient`, igual que en el backend viven en controllers distintos.
 *
 * Los cuerpos viajan tal como los declaran los tipos: el backend valida con
 * `forbidNonWhitelisted`, así que una propiedad de más es un 400. Los campos
 * opcionales ausentes se omiten (la serialización descarta `undefined`).
 */
@Injectable({
  providedIn: 'root',
})
export class IdentityAdminClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /identity/authorities` — registrar una autoridad de identidad. */
  registerAuthority(authority: NewIdentityAuthority): Observable<RegisteredAuthority> {
    return this.http
      .post<EnCable<RegisteredAuthority>>(this.url('/identity/authorities'), authority)
      .pipe(map(conAlta));
  }

  /** `POST /identity/authorities/:id/endpoints` — publicar un endpoint de verificación. */
  addAuthorityEndpoint(
    authorityId: string,
    endpoint: NewAuthorityEndpoint,
  ): Observable<PublishedAuthorityEndpoint> {
    return this.http
      .post<EnCable<PublishedAuthorityEndpoint>>(
        this.url(`/identity/authorities/${encodeURIComponent(authorityId)}/endpoints`),
        endpoint,
      )
      .pipe(map(conAlta));
  }

  /** `POST /identity/verification-policies` — precondición para abrir casos. */
  createVerificationPolicy(
    policy: NewVerificationPolicy,
  ): Observable<CreatedVerificationPolicy> {
    return this.http
      .post<EnCable<CreatedVerificationPolicy>>(
        this.url('/identity/verification-policies'),
        policy,
      )
      .pipe(map(conAlta));
  }

  /** `POST /identity/verification-cases` — iniciar un caso de verificación. */
  openCase(newCase: NewVerificationCase): Observable<OpenedCase> {
    return this.http
      .post<OpenedCaseBody>(this.url('/identity/verification-cases'), newCase)
      .pipe(map(toOpenedCase));
  }

  /** `POST …/:id/evidence` — aportar evidencia documental bajo consentimiento. */
  submitEvidence(caseId: string, evidence: NewCaseEvidence): Observable<SubmittedEvidence> {
    return this.http
      .post<EnCable<SubmittedEvidence>>(
        this.url(`/identity/verification-cases/${encodeURIComponent(caseId)}/evidence`),
        evidence,
      )
      .pipe(map(conAlta));
  }

  /**
   * `POST …/:id/checks:plan` — planificar los checks requeridos del caso. El
   * segmento lleva los dos puntos de verdad: el backend lo declara escapado
   * (`checks\\:plan`), al revés que el `rotate` del M40.
   */
  planChecks(caseId: string, plan: CheckPlan): Observable<PlannedChecksResult> {
    return this.http.post<PlannedChecksResult>(
      this.url(`/identity/verification-cases/${encodeURIComponent(caseId)}/checks:plan`),
      plan,
    );
  }

  /** `POST …/:id/fraud-signals` — registrar una señal de fraude sobre el caso. */
  raiseFraudSignal(caseId: string, signal: NewFraudSignal): Observable<RaisedFraudSignal> {
    return this.http.post<RaisedFraudSignal>(
      this.url(`/identity/verification-cases/${encodeURIComponent(caseId)}/fraud-signals`),
      signal,
    );
  }

  /** `POST …/:id/manual-review` — escalar el caso a revisión manual. */
  openManualReview(caseId: string, review: NewManualReview): Observable<OpenedManualReview> {
    return this.http.post<OpenedManualReview>(
      this.url(`/identity/verification-cases/${encodeURIComponent(caseId)}/manual-review`),
      review,
    );
  }

  /** `POST …/:id/assertions` — emitir la aserción con nivel de aseguramiento. */
  issueAssertion(
    caseId: string,
    assertion: NewIdentityAssertion,
  ): Observable<IssuedAssertion> {
    return this.http
      .post<IssuedAssertionBody>(
        this.url(`/identity/verification-cases/${encodeURIComponent(caseId)}/assertions`),
        assertion,
      )
      .pipe(map(toIssuedAssertion));
  }

  /** `POST /identity/verification-cases/expire-sweep` — expirar los vencidos. */
  sweepExpiredCases(): Observable<ExpireSweepResult> {
    return this.http.post<ExpireSweepResult>(
      this.url('/identity/verification-cases/expire-sweep'),
      {},
    );
  }

  /** `POST /identity/checks/:id/attempts` — el intento contra la autoridad. */
  recordCheckAttempt(checkId: string, attempt: NewCheckAttempt): Observable<RecordedAttempt> {
    return this.http.post<RecordedAttempt>(
      this.url(`/identity/checks/${encodeURIComponent(checkId)}/attempts`),
      attempt,
    );
  }

  /** `POST /identity/checks/:id/results` — el veredicto inmutable del check. */
  recordCheckResult(checkId: string, result: NewCheckResult): Observable<RecordedCheckResult> {
    return this.http.post<RecordedCheckResult>(
      this.url(`/identity/checks/${encodeURIComponent(checkId)}/results`),
      result,
    );
  }

  /** `POST /identity/manual-review/:id/decision` — resolver la revisión. */
  decideManualReview(
    reviewId: string,
    decision: ManualReviewDecision,
  ): Observable<DecidedManualReview> {
    return this.http.post<DecidedManualReview>(
      this.url(`/identity/manual-review/${encodeURIComponent(reviewId)}/decision`),
      decision,
    );
  }

  /** `POST /identity/assertions/:id/revoke` — se revoca, no se borra. */
  revokeAssertion(
    assertionId: string,
    revocation: AssertionRevocation,
  ): Observable<RevokedAssertion> {
    return this.http
      .post<RevokedAssertionBody>(
        this.url(`/identity/assertions/${encodeURIComponent(assertionId)}/revoke`),
        revocation,
      )
      .pipe(map(toRevokedAssertion));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
