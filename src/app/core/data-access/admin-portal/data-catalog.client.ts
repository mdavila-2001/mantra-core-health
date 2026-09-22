import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams, withDates, type Wire } from './admin-portal.wire';
import type {
  Annotation,
  AnnotationHistory,
  AnnotationPatch,
  CatalogColumn,
  CatalogObjectDetail,
  CatalogObjectSummary,
  CatalogObjectsQuery,
  CatalogPage,
  ChangeEvent,
  Coverage,
  Evidence,
  EvidenceInput,
  Impact,
  ReviewDecision,
  ReviewInput,
  Revision,
  Scan,
  ScanAccepted,
  SchemaSummary,
  Statistics,
} from './data-catalog.types';

type AnnotationBody = Wire<Annotation, 'approvedAt' | 'updatedAt'>;

export function toAnnotation(body: AnnotationBody): Annotation {
  return withDates<Annotation, 'approvedAt' | 'updatedAt'>(body, ['approvedAt', 'updatedAt']);
}

function toStatistics(body: Wire<Statistics, 'observedAt'>): Statistics {
  return withDates<Statistics, 'observedAt'>(body, ['observedAt']);
}

type SummaryBody = Omit<Wire<CatalogObjectSummary, 'lastSeenAt'>, 'statistics'> & {
  readonly statistics: Wire<Statistics, 'observedAt'>;
};

function toSummary(body: SummaryBody): CatalogObjectSummary {
  return {
    ...withDates<Omit<CatalogObjectSummary, 'statistics'>, 'lastSeenAt'>(
      body as Wire<Omit<CatalogObjectSummary, 'statistics'>, 'lastSeenAt'>,
      ['lastSeenAt'],
    ),
    statistics: toStatistics(body.statistics),
  };
}

interface DetailBody {
  readonly id: string;
  readonly technical: Omit<CatalogObjectDetail['technical'], 'statistics'> & {
    readonly statistics: Wire<Statistics, 'observedAt'> & { readonly method: string };
  };
  readonly observation: Wire<CatalogObjectDetail['observation'], 'lastSeenAt' | 'notObservedSince'>;
  readonly annotation: AnnotationBody | null;
  readonly coverage: CatalogObjectDetail['coverage'];
  readonly governance: CatalogObjectDetail['governance'];
  readonly evidenceCount: number;
}

export function toObjectDetail(body: DetailBody): CatalogObjectDetail {
  return {
    id: body.id,
    technical: {
      ...body.technical,
      statistics: { ...toStatistics(body.technical.statistics), method: body.technical.statistics.method },
    },
    observation: withDates<CatalogObjectDetail['observation'], 'lastSeenAt' | 'notObservedSince'>(
      body.observation,
      ['lastSeenAt', 'notObservedSince'],
    ),
    annotation: body.annotation ? toAnnotation(body.annotation) : null,
    coverage: body.coverage,
    governance: body.governance,
    evidenceCount: body.evidenceCount,
  };
}

type ColumnBody = Omit<CatalogColumn, 'annotation'> & { readonly annotation: AnnotationBody | null };
type ScanBody = Wire<Scan, 'requestedAt' | 'startedAt' | 'finishedAt'>;
const SCAN_DATES = ['requestedAt', 'startedAt', 'finishedAt'] as const;

/**
 * Cliente del catálogo de datos. Todo lo que decide —cobertura, estados,
 * segregación de la revisión, versiones— lo decide el servidor.
 */
@Injectable({ providedIn: 'root' })
export class DataCatalogClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listSchemas(): Observable<readonly SchemaSummary[]> {
    return this.http.get<readonly SchemaSummary[]>(this.url('/admin/catalog/schemas'));
  }

  listObjects(query: CatalogObjectsQuery = {}): Observable<CatalogPage<CatalogObjectSummary>> {
    return this.http
      .get<CatalogPage<SummaryBody>>(this.url('/admin/catalog/objects'), {
        params: queryParams({ ...query }),
      })
      .pipe(map((page) => ({ ...page, items: page.items.map(toSummary) })));
  }

  getObject(id: string): Observable<CatalogObjectDetail> {
    return this.http
      .get<DetailBody>(this.url(`/admin/catalog/objects/${id}`))
      .pipe(map(toObjectDetail));
  }

  listColumns(objectId: string): Observable<readonly CatalogColumn[]> {
    return this.http
      .get<{ readonly items: readonly ColumnBody[] }>(this.url(`/admin/catalog/objects/${objectId}/columns`))
      .pipe(
        map((body) =>
          body.items.map((column) => ({
            ...column,
            annotation: column.annotation ? toAnnotation(column.annotation) : null,
          })),
        ),
      );
  }

  listEvidence(objectId: string): Observable<readonly Evidence[]> {
    return this.http
      .get<readonly Wire<Evidence, 'createdAt'>[]>(this.url(`/admin/catalog/objects/${objectId}/evidence`))
      .pipe(map((items) => items.map((item) => withDates<Evidence, 'createdAt'>(item, ['createdAt']))));
  }

  addEvidence(objectId: string, input: EvidenceInput): Observable<Evidence> {
    return this.http
      .post<Wire<Evidence, 'createdAt'>>(this.url(`/admin/catalog/objects/${objectId}/evidence`), input)
      .pipe(map((item) => withDates<Evidence, 'createdAt'>(item, ['createdAt'])));
  }

  history(objectId: string): Observable<AnnotationHistory> {
    return this.http
      .get<{
        readonly revisions: readonly Wire<Revision, 'createdAt'>[];
        readonly decisions: readonly Wire<ReviewDecision, 'decidedAt'>[];
      }>(this.url(`/admin/catalog/objects/${objectId}/history`))
      .pipe(
        map((body) => ({
          revisions: body.revisions.map((r) => withDates<Revision, 'createdAt'>(r, ['createdAt'])),
          decisions: body.decisions.map((d) => withDates<ReviewDecision, 'decidedAt'>(d, ['decidedAt'])),
        })),
      );
  }

  changes(objectId: string, cursor?: string): Observable<CatalogPage<ChangeEvent>> {
    return this.http
      .get<CatalogPage<Wire<ChangeEvent, 'detectedAt'>>>(this.url(`/admin/catalog/objects/${objectId}/changes`), {
        params: queryParams({ cursor }),
      })
      .pipe(
        map((page) => ({
          ...page,
          items: page.items.map((e) => withDates<ChangeEvent, 'detectedAt'>(e, ['detectedAt'])),
        })),
      );
  }

  impact(objectId: string, direction: Impact['direction'] = 'both', depth = 2): Observable<Impact> {
    return this.http.get<Impact>(this.url(`/admin/catalog/objects/${objectId}/impact`), {
      params: queryParams({ direction, depth }),
    });
  }

  saveObjectAnnotation(objectId: string, patch: AnnotationPatch): Observable<Annotation> {
    return this.http
      .put<AnnotationBody>(this.url(`/admin/catalog/objects/${objectId}/annotation`), patch)
      .pipe(map(toAnnotation));
  }

  review(annotationId: string, input: ReviewInput): Observable<Annotation> {
    return this.http
      .post<AnnotationBody>(this.url(`/admin/catalog/annotations/${annotationId}/review`), input)
      .pipe(map(toAnnotation));
  }

  coverage(schema?: string): Observable<Coverage> {
    return this.http
      .get<Omit<Coverage, 'lastScan'> & { readonly lastScan: { readonly scanId: string; readonly finishedAt: string | null } | null }>(
        this.url('/admin/catalog/coverage'),
        { params: queryParams({ schema }) },
      )
      .pipe(
        map((body) => ({
          ...body,
          lastScan: body.lastScan
            ? withDates<{ scanId: string; finishedAt?: Date }, 'finishedAt'>(body.lastScan, ['finishedAt'])
            : null,
        })),
      );
  }

  listScans(): Observable<readonly Scan[]> {
    return this.http
      .get<CatalogPage<ScanBody>>(this.url('/admin/catalog/scans'))
      .pipe(map((page) => page.items.map((scan) => withDates<Scan, (typeof SCAN_DATES)[number]>(scan, SCAN_DATES))));
  }

  /** 202 tras aceptación durable. La clave de idempotencia evita duplicar por doble clic. */
  requestScan(idempotencyKey: string): Observable<ScanAccepted> {
    return this.http.post<ScanAccepted>(this.url('/admin/catalog/scans'), null, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
