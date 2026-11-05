import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams, withDates, type Wire } from './admin-portal.wire';
import type {
  QualityIssue,
  QualityIssuesQuery,
  QualityPage,
  QualityRule,
  QualityRuleDetail,
  QualityRulesQuery,
  QualityRun,
  ResolveIssueInput,
  ResolveIssueResult,
} from './data-quality.types';

type IssueBody = Wire<QualityIssue, 'createdAt' | 'resolvedAt'>;
type RuleBody = Wire<QualityRule, 'updatedAt'>;
type RunBody = Wire<QualityRun, 'startedAt' | 'completedAt'>;
type RuleDetailBody = Omit<Wire<QualityRuleDetail, 'updatedAt'>, 'recentRuns'> & {
  readonly recentRuns: readonly RunBody[];
};

export function toIssue(body: IssueBody): QualityIssue {
  return withDates<QualityIssue, 'createdAt' | 'resolvedAt'>(body, ['createdAt', 'resolvedAt']);
}

function toRule(body: RuleBody): QualityRule {
  return withDates<QualityRule, 'updatedAt'>(body, ['updatedAt']);
}

function toRun(body: RunBody): QualityRun {
  return withDates<QualityRun, 'startedAt' | 'completedAt'>(body, ['startedAt', 'completedAt']);
}

function toRuleDetail(body: RuleDetailBody): QualityRuleDetail {
  const { recentRuns, ...rest } = body;
  return {
    ...withDates<Omit<QualityRuleDetail, 'recentRuns'>, 'updatedAt'>(
      rest as Wire<Omit<QualityRuleDetail, 'recentRuns'>, 'updatedAt'>,
      ['updatedAt'],
    ),
    recentRuns: recentRuns.map(toRun),
  };
}

const BASE = '/admin/governance/data-quality';

/**
 * Cliente de la calidad de datos del portal de gobierno. Qué se puede cerrar,
 * por quién y con qué desenlace lo decide el servidor; cerrar es idempotente.
 */
@Injectable({ providedIn: 'root' })
export class DataQualityClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listIssues(query: QualityIssuesQuery = {}): Observable<QualityPage<QualityIssue>> {
    return this.http
      .get<QualityPage<IssueBody>>(this.url(`${BASE}/issues`), { params: queryParams({ ...query }) })
      .pipe(map((page) => ({ ...page, items: page.items.map(toIssue) })));
  }

  getIssue(id: string): Observable<QualityIssue> {
    return this.http.get<IssueBody>(this.url(`${BASE}/issues/${encodeURIComponent(id)}`)).pipe(map(toIssue));
  }

  /** Resolver o descartar. 409 si otra persona la cerró con el desenlace contrario. */
  resolveIssue(id: string, input: ResolveIssueInput): Observable<ResolveIssueResult> {
    return this.http
      .post<{ readonly issue: IssueBody; readonly alreadyApplied: boolean }>(
        this.url(`${BASE}/issues/${encodeURIComponent(id)}/resolution`),
        input,
      )
      .pipe(map((r) => ({ issue: toIssue(r.issue), alreadyApplied: r.alreadyApplied })));
  }

  listRules(query: QualityRulesQuery = {}): Observable<QualityPage<QualityRule>> {
    return this.http
      .get<QualityPage<RuleBody>>(this.url(`${BASE}/rules`), { params: queryParams({ ...query }) })
      .pipe(map((page) => ({ ...page, items: page.items.map(toRule) })));
  }

  getRule(id: string): Observable<QualityRuleDetail> {
    return this.http
      .get<RuleDetailBody>(this.url(`${BASE}/rules/${encodeURIComponent(id)}`))
      .pipe(map(toRuleDetail));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
