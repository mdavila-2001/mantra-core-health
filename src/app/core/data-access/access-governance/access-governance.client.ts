import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { withAccessChallenge } from '../../access-challenge/access-challenge';
import { API_BASE_URL, apiUrl } from '../api';
import type {
  AccessMatrix,
  AnomalyList,
  AnomalyQuery,
  AnomalyResolution,
  AnomalyResolutionResult,
  ExceptionsReport,
  GovernancePanel,
  GovernanceReportExport,
  GovernanceReportKind,
  GovernanceSummary,
  MatrixQuery,
  OwnerlessReport,
  PrivilegeCreepReport,
  UnusedAccessReport,
} from './governance-reports.types';
import type {
  FourEyesRequested,
  GovernanceRule,
  GovernanceRuleChange,
  GovernanceRuleList,
  GovernanceRuleQuery,
  GovernanceSettingsChange,
  GovernanceSettingsResponse,
  NewGovernanceRule,
  NewSodException,
  NewSodRule,
  NormalizeLegacyRequest,
  NormalizeLegacyResponse,
  PatientRestrictionFlags,
  RestrictionFlagInput,
  RevertNormalizeResponse,
  SodException,
  SodExceptionList,
  SodFindingList,
  SodRule,
  SodRuleChange,
  SodRuleList,
} from './governance-rules.types';
import type { ExportedFile } from './access-reviews.types';

/**
 * Cliente de **reglas, SoD, ajustes, banderas de pacientes e informes** de gobierno (CONTRATO-GOBIERNO §8.3 bloques A, B y G).
 *
 * Solo transporte: quién puede qué lo decide la API. Las escrituras de reglas, SoD y ajustes piden **paso extra**
 * (`403 STEP_UP_REQUIRED`): el reintento lo resuelve `AccessChallengeService` (`core/access-challenge`), no este cliente.
 */
@Injectable({ providedIn: 'root' })
export class AccessGovernanceClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* ---- reglas de la organización (L1) ----------------------------------------------------- */

  /** `GET /org/governance/rules?kind&status` — activas y retiradas. */
  listRules(query: GovernanceRuleQuery = {}): Observable<GovernanceRuleList> {
    return this.http.get<GovernanceRuleList>(this.url('/org/governance/rules'), {
      params: params({ kind: query.kind, status: query.status }),
    });
  }

  /** `POST /org/governance/rules` — solo restringe (422 `GUARDRAIL_RULE_LOOSENS_PLATFORM`). */
  createRule(rule: NewGovernanceRule): Observable<GovernanceRule> {
    return this.http.post<GovernanceRule>(this.url('/org/governance/rules'), rule);
  }

  /** `PATCH /org/governance/rules/:id` — con la `rowVersion` que se vio (409 `ROW_VERSION_CONFLICT`). */
  updateRule(ruleId: string, change: GovernanceRuleChange): Observable<GovernanceRule> {
    return this.http.patch<GovernanceRule>(
      this.url(`/org/governance/rules/${encodeURIComponent(ruleId)}`),
      change,
    );
  }

  /** `POST /org/governance/rules/:id/retire` — nunca se borra. */
  retireRule(ruleId: string, reason?: string): Observable<GovernanceRule> {
    return this.http.post<GovernanceRule>(
      this.url(`/org/governance/rules/${encodeURIComponent(ruleId)}/retire`),
      reason === undefined ? {} : { reason },
    );
  }

  /* ---- ajustes de gobierno ------------------------------------------------------------------ */

  /** `GET /org/governance/settings` — `practice_settings['support.governance']` con los valores por omisión. */
  getSettings(): Observable<GovernanceSettingsResponse> {
    return this.http.get<GovernanceSettingsResponse>(this.url('/org/governance/settings'));
  }

  /** `PUT /org/governance/settings` — 422 `GOVERNANCE_SETTINGS_INVALID` si algún valor no es válido. */
  putSettings(change: GovernanceSettingsChange): Observable<GovernanceSettingsResponse> {
    return this.http.put<GovernanceSettingsResponse>(this.url('/org/governance/settings'), change);
  }

  /* ---- normalizar permisos antiguos ---------------------------------------------------------- */

  /** `POST /org/governance/normalize-legacy` — `dryRun` por omisión `true`: informa qué pasaría. */
  normalizeLegacy(request: NormalizeLegacyRequest = {}): Observable<NormalizeLegacyResponse> {
    return this.http.post<NormalizeLegacyResponse>(
      this.url('/org/governance/normalize-legacy'),
      request,
    );
  }

  /** `POST /org/governance/normalize-legacy/revert` — revierte un lote por `batchId`. */
  revertNormalize(batchId: string): Observable<RevertNormalizeResponse> {
    return this.http.post<RevertNormalizeResponse>(
      this.url('/org/governance/normalize-legacy/revert'),
      { batchId },
    );
  }

  /* ---- separación de funciones (SoD) ---------------------------------------------------------- */

  /** `GET /org/governance/sod-rules` — las de plataforma (solo lectura) y las de la organización. */
  listSodRules(): Observable<SodRuleList> {
    return this.http.get<SodRuleList>(this.url('/org/governance/sod-rules'));
  }

  /** `POST /org/governance/sod-rules` — crea o endurece (422 `SOD_RULE_LOOSENS_BASE`). */
  createSodRule(rule: NewSodRule): Observable<SodRule> {
    return this.http.post<SodRule>(this.url('/org/governance/sod-rules'), rule);
  }

  /** `PATCH /org/governance/sod-rules/:id` — las de plataforma no se editan (422 `SOD_RULE_PLATFORM_READ_ONLY`). */
  updateSodRule(ruleId: string, change: SodRuleChange): Observable<SodRule> {
    return this.http.patch<SodRule>(
      this.url(`/org/governance/sod-rules/${encodeURIComponent(ruleId)}`),
      change,
    );
  }

  /** `GET /org/governance/sod-findings` — conflictos de hoy, con o sin excepción. */
  listSodFindings(): Observable<SodFindingList> {
    return this.http.get<SodFindingList>(this.url('/org/governance/sod-findings'));
  }

  /** `GET /org/governance/sod-exceptions`. */
  listSodExceptions(): Observable<SodExceptionList> {
    return this.http.get<SodExceptionList>(this.url('/org/governance/sod-exceptions'));
  }

  /** `POST /org/governance/sod-exceptions` — responde `202` y crea el cuatro ojos (422 `SOD_RULE_HARD` si la regla no admite excepción). */
  requestSodException(request: NewSodException): Observable<FourEyesRequested> {
    return this.http.post<FourEyesRequested>(this.url('/org/governance/sod-exceptions'), request);
  }

  /** `POST /org/governance/sod-exceptions/:id/revoke`. */
  revokeSodException(exceptionId: string, reason: string): Observable<SodException> {
    return this.http.post<SodException>(
      this.url(`/org/governance/sod-exceptions/${encodeURIComponent(exceptionId)}/revoke`),
      { reason },
    );
  }

  /* ---- banderas de pacientes restringidos ------------------------------------------------------ */

  /** `GET /org/patients/:patientProfileId/restriction-flags` — el doctor, solo de sus pacientes. */
  getRestrictionFlags(patientProfileId: string): Observable<PatientRestrictionFlags> {
    return this.http.get<PatientRestrictionFlags>(
      this.url(`/org/patients/${encodeURIComponent(patientProfileId)}/restriction-flags`),
    );
  }

  /**
   * `PUT /org/patients/:patientProfileId/restriction-flags` — **reemplaza** el conjunto entero de banderas. Quitar una bandera o acortar su
   * fin pide `removalReason` (10 a 500 caracteres, sin datos clínicos; solo se asienta su largo y su huella), el paso extra y ser el doctor
   * titular o administración de seguridad (403 `RESTRICTION_FLAG_REMOVAL_FORBIDDEN` / `STEP_UP_REQUIRED`).
   */
  putRestrictionFlags(
    patientProfileId: string,
    flags: readonly RestrictionFlagInput[],
    removalReason?: string,
  ): Observable<PatientRestrictionFlags> {
    return this.http.put<PatientRestrictionFlags>(
      this.url(`/org/patients/${encodeURIComponent(patientProfileId)}/restriction-flags`),
      {
        flags,
        ...(removalReason === undefined || removalReason.trim() === ''
          ? {}
          : { removalReason: removalReason.trim() }),
      },
      { context: withAccessChallenge({ actionLabel: 'Cambiar las banderas del paciente' }) },
    );
  }

  /* ---- reportes y tableros ------------------------------------------------------------------------ */

  /** `GET /org/governance/summary` — los diez mosaicos. */
  getSummary(): Observable<GovernanceSummary> {
    return this.http.get<GovernanceSummary>(this.url('/org/governance/summary'));
  }

  /** `GET /org/governance/access-matrix?by&group&id` — `person` (personas × categorías) o quién puede actuar sobre un doctor, servicio o ubicación. */
  getAccessMatrix(query: MatrixQuery): Observable<AccessMatrix> {
    return this.http.get<AccessMatrix>(this.url('/org/governance/access-matrix'), {
      params: params({ by: query.by, group: query.group, id: query.id }),
    });
  }

  /** `GET /org/governance/privilege-creep`. */
  getPrivilegeCreep(): Observable<PrivilegeCreepReport> {
    return this.http.get<PrivilegeCreepReport>(this.url('/org/governance/privilege-creep'));
  }

  /** `GET /org/governance/unused-access?days`. */
  getUnusedAccess(days?: number): Observable<UnusedAccessReport> {
    return this.http.get<UnusedAccessReport>(this.url('/org/governance/unused-access'), {
      params: params({ days: days === undefined ? undefined : String(days) }),
    });
  }

  /** `GET /org/governance/ownerless`. */
  getOwnerless(): Observable<OwnerlessReport> {
    return this.http.get<OwnerlessReport>(this.url('/org/governance/ownerless'));
  }

  /** `GET /org/governance/exceptions`. */
  getExceptions(): Observable<ExceptionsReport> {
    return this.http.get<ExceptionsReport>(this.url('/org/governance/exceptions'));
  }

  /** `GET /org/governance/anomalies?status&kind`. */
  listAnomalies(query: AnomalyQuery = {}): Observable<AnomalyList> {
    return this.http.get<AnomalyList>(this.url('/org/governance/anomalies'), {
      params: params({ status: query.status, kind: query.kind }),
    });
  }

  /** `POST /org/governance/anomalies/:id/ack` — reconocer, descartar o escalar. */
  resolveAnomaly(
    anomalyId: string,
    resolution: AnomalyResolution,
  ): Observable<AnomalyResolutionResult> {
    return this.http.post<AnomalyResolutionResult>(
      this.url(`/org/governance/anomalies/${encodeURIComponent(anomalyId)}/ack`),
      resolution,
    );
  }

  /** `POST /org/governance/reports/:kind/export` — motivo (≥ 10) y paso extra; el archivo viaja como texto con su `sha256`. */
  exportReport(
    kind: GovernanceReportKind,
    request: GovernanceReportExport,
  ): Observable<ExportedFile> {
    return this.http.post<ExportedFile>(
      this.url(`/org/governance/reports/${encodeURIComponent(kind)}/export`),
      request,
    );
  }

  /** `GET /me/practitioner/governance-panel` — panel «Mi equipo» del doctor. */
  getPractitionerPanel(): Observable<GovernancePanel> {
    return this.http.get<GovernancePanel>(this.url('/me/practitioner/governance-panel'));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** Arma los parámetros de consulta omitiendo lo que no vino. */
function params(values: Readonly<Record<string, string | undefined>>): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') result = result.set(key, value);
  }
  return result;
}
