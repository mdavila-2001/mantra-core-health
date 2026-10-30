import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';

import { DataCatalogClient } from '../../../../core/data-access/admin-portal/data-catalog.client';
import type { CatalogObjectDetail } from '../../../../core/data-access/admin-portal/data-catalog.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import { DrawerPanel } from '../../../../shared/components/organisms/drawer-panel/drawer-panel';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { EvidenceDialog } from '../../data-catalog/object-detail/evidence-dialog';
import {
  MIN_REJECTION_LENGTH,
  annotationAnswers,
  annotationFacts,
  missingLabels,
  reviewFailure,
} from './review.model';

/**
 * El cajón para decidir una ficha en revisión: qué dice, con cuánta evidencia,
 * y los dos botones. Aprobar sin evidencia no se ofrece (la API lo rechazaría);
 * desde acá mismo se puede enlazar una. Rechazar pide el motivo antes de enviar.
 */
@Component({
  selector: 'app-portal-review-drawer',
  imports: [RouterLink, AppButton, Link, Alert, FactList, DrawerPanel, ViewStateHost, EvidenceDialog],
  templateUrl: './review-drawer.html',
  styleUrl: './review-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewDrawer {
  private readonly catalog = inject(DataCatalogClient);
  private readonly dialogs = inject(DialogService);

  /** La tabla o vista abierta; `''` es «cerrado». */
  readonly objectId = input.required<string>();
  readonly closed = output<void>();
  /** La decisión quedó registrada; lleva el aviso para la lista. */
  readonly decided = output<string>();

  protected readonly detail = signal<ViewState<CatalogObjectDetail>>(loading());
  protected readonly missing = missingLabels;
  protected readonly deciding = signal(false);
  protected readonly addingEvidence = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly object = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? s.data : null;
  });
  protected readonly name = computed(() => {
    const o = this.object();
    return o ? `${o.technical.schemaName}.${o.technical.objectName}` : '';
  });
  protected readonly inReview = computed(() => this.object()?.annotation?.reviewStatus === 'NEEDS_REVIEW');
  protected readonly hasEvidence = computed(() => (this.object()?.evidenceCount ?? 0) > 0);
  protected readonly facts = computed(() => {
    const o = this.object();
    return o ? annotationFacts(o) : [];
  });
  protected readonly answers = computed(() => {
    const a = this.object()?.annotation;
    return a ? annotationAnswers(a.content) : [];
  });
  protected readonly fullRecordUrl = computed(
    () => `/superadmin/data-catalog/${encodeURIComponent(this.objectId())}`,
  );

  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      const id = this.objectId();
      untracked(() => this.load(id));
    });
  }

  protected reload(): void {
    this.load(this.objectId());
  }

  protected evidenceAdded(): void {
    this.addingEvidence.set(false);
    this.reload();
  }

  protected async decide(decision: 'APPROVED' | 'REJECTED'): Promise<void> {
    const annotation = this.object()?.annotation;
    if (!annotation) return;
    const comment = await this.ask(decision, annotation.currentRevisionNo);
    if (comment === null) return;
    this.deciding.set(true);
    this.error.set(null);
    const name = this.name();
    this.pending = this.catalog
      .review(annotation.id, {
        decision,
        expectedRevisionNo: annotation.currentRevisionNo,
        ...(comment ? { comment } : {}),
      })
      .subscribe({
        next: () => {
          this.deciding.set(false);
          this.decided.emit(
            decision === 'APPROVED'
              ? `La ficha de ${name} quedó aprobada.`
              : `La ficha de ${name} quedó rechazada; quien la escribió verá el motivo.`,
          );
        },
        error: (e: unknown) => {
          this.deciding.set(false);
          const failure = reviewFailure(e);
          this.error.set(failure.message);
          if (failure.reload) this.reload();
        },
      });
  }

  /** `null` si la persona se arrepintió; `''` para aprobar; el motivo para rechazar. */
  private async ask(decision: 'APPROVED' | 'REJECTED', revision: number): Promise<string | null> {
    if (decision === 'REJECTED') {
      return this.dialogs.confirmWithReason(
        {
          title: 'Rechazar la ficha',
          message: `Va a rechazar la revisión ${revision}. Quien la escribió verá su motivo.`,
          confirmLabel: 'Rechazar',
          cancelLabel: 'Volver',
          destructive: true,
        },
        { label: 'Qué falta o qué está mal', minLength: MIN_REJECTION_LENGTH, maxLength: 2000 },
      );
    }
    const ok = await this.dialogs.confirm({
      title: 'Aprobar la ficha',
      message: `Va a aprobar la revisión ${revision}. Si alguien la edita después, vuelve a necesitar revisión.`,
      confirmLabel: 'Aprobar',
      cancelLabel: 'Volver',
    });
    return ok ? '' : null;
  }

  private load(id: string): void {
    this.pending?.unsubscribe();
    this.error.set(null);
    this.addingEvidence.set(false);
    if (id === '') return;
    this.detail.set(loading());
    this.pending = this.catalog.getObject(id).subscribe({
      next: (d) => this.detail.set(ready(d)),
      error: (e: unknown) => this.detail.set(errorToViewState<CatalogObjectDetail>(e)),
    });
  }
}
