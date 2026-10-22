import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { FilesClient } from '../../../core/data-access/files/files.client';
import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type { VerificationCaseDetail, VerificationCaseEvidence } from '../../../core/data-access/identity/identity-admin.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

interface EvidencePreview extends VerificationCaseEvidence {
  readonly label: string;
  readonly contentUrl: string | null;
}

const LABELS = ['Frente del documento', 'Reverso del documento', 'Prueba de vida · frente', 'Prueba de vida · giro a la izquierda', 'Prueba de vida · giro a la derecha'];
const ESCALATE_ROUTE = '/administration/identity-assurance/review/escalate';

/** Expediente de revisión: evidencia PHI solo se solicita al abrir el caso. */
@Component({
  selector: 'app-identity-case-detail',
  imports: [Alert, Card, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './case-detail.html',
  styleUrl: './case-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseDetail {
  private readonly client = inject(IdentityAdminClient);
  private readonly files = inject(FilesClient);
  private readonly navigation = inject(NavigationService);
  private readonly caseId = inject(ActivatedRoute).snapshot.paramMap.get('caseId') ?? '';

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly state = signal<ViewState<VerificationCaseDetail>>(loading());
  protected readonly previews = signal<readonly EvidencePreview[]>([]);
  protected readonly detail = computed(() => {
    const current = this.state();
    return current.status === 'ready' ? current.data : null;
  });
  protected readonly errorMessage = computed(() => {
    const current = this.state();
    return current.status === 'error' ? current.message : null;
  });
  protected readonly escalationRoute = ESCALATE_ROUTE;

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.client.getCaseDetail(this.caseId).subscribe({
      next: (detail) => {
        this.state.set(ready(detail));
        if (detail.evidence.length === 0) {
          this.previews.set([]);
          return;
        }
        forkJoin(detail.evidence.map((evidence) => {
          const content$ = evidence.evidenceFileId
            ? this.files.contentDataUrl(evidence.evidenceFileId).pipe(catchError(() => of(null)))
            : of(null);
          return content$.pipe(map((contentUrl) => ({
            ...evidence,
            label:
              (detail.evidence.length === LABELS.length ? LABELS[evidence.sequence - 1] : undefined) ??
              `Evidencia ${evidence.sequence}`,
            contentUrl,
          })));
        })).subscribe((rows) => this.previews.set(rows));
      },
      error: (error: unknown) => this.state.set(errorToViewState<VerificationCaseDetail>(error)),
    });
  }

  protected esImagen(url: string | null): boolean {
    return url?.startsWith('data:image/') ?? false;
  }
}
