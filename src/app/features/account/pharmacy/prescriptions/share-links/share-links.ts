import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

import { PrescriptionSharesClient } from '../../../../../core/data-access/prescription-shares/prescription-shares.client';
import type {
  PrescriptionShareStatus,
  PrescriptionShareSummary,
} from '../../../../../core/data-access/prescription-shares/prescription-shares.types';
import { describeApiFailure } from '../../../../../core/http/api-failure';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../../shared/components/atoms/badge/badge.types';
import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { PRESCRIPTION_SHARE_TESTIDS } from '../../../../prescription-share/prescription-share.testids';

/** Cómo se nombra y se pinta cada estado del enlace. */
const STATUS_LABEL: Readonly<Record<PrescriptionShareStatus, { label: string; variant: BadgeVariant }>> = {
  VALID: { label: 'Vigente', variant: 'success' },
  EXPIRED: { label: 'Vencido', variant: 'warning' },
  REVOKED: { label: 'Revocado', variant: 'secondary' },
};

/**
 * «Enlaces compartidos» de «Mis recetas» (FAR-01, REQ-FAR-01-018): los
 * enlaces del paciente con su estado, vencimiento y aperturas, y «Revocar».
 *
 * La lista sale de `GET /clinical/prescription-shares?patientProfileId=`, que
 * nunca trae el token: desde acá no se puede volver a copiar un enlace, solo
 * revocarlo. Revocar pide confirmación y, con el 204, el estado pasa a
 * «Revocado» en el acto; la próxima lectura lo trae así de la API, que es la
 * que manda.
 */
@Component({
  selector: 'app-share-links',
  imports: [AppButton, Badge, DatePipe, ViewStateHost],
  templateUrl: './share-links.html',
  styleUrl: './share-links.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareLinks implements OnInit {
  private readonly shares = inject(PrescriptionSharesClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly patientProfileId = input.required<string>();

  /** El enlace que se marca: el que abrió el dueño desde `/rx/:token`. */
  readonly highlightShareId = input<string | null>(null);

  /** La fecha de cada receta por su `resourceId` (consulta o fármaco), para nombrarla. */
  readonly prescriptionDates = input<ReadonlyMap<string, Date>>(new Map());

  protected readonly testids = PRESCRIPTION_SHARE_TESTIDS;

  protected readonly state = signal<ViewState<readonly PrescriptionShareSummary[]>>(loading());
  protected readonly rows = computed(() => dataOf(this.state()) ?? []);

  /** El enlace que se está revocando, para no aceptar un segundo toque. */
  protected readonly revoking = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    this.shares
      .listForPatient(this.patientProfileId())
      .pipe(
        map((rows) =>
          rows.length === 0
            ? empty(
                { label: 'Use «Compartir» en una receta emitida' },
                'Todavía no compartió ninguna receta.',
              )
            : ready([...rows].sort(newestFirst)),
        ),
        catchError((error: unknown) =>
          of(errorToViewState<readonly PrescriptionShareSummary[]>(error)),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.state.set(state));
  }

  protected statusOf(row: PrescriptionShareSummary): { label: string; variant: BadgeVariant } {
    // «Vencido» junto a «vence el 30/11» confundía: si la receta dejó de valer
    // antes, se dice eso (H12-09).
    return row.endedReason === 'PRESCRIPTION_NOT_ACTIVE'
      ? { label: 'Receta sin vigencia', variant: 'warning' }
      : STATUS_LABEL[row.status];
  }

  protected dateOf(row: PrescriptionShareSummary): Date | null {
    return this.prescriptionDates().get(row.resourceId) ?? null;
  }

  protected async revoke(row: PrescriptionShareSummary): Promise<void> {
    if (this.revoking() !== null) {
      return;
    }
    const confirmed = await this.dialogs.confirm({
      title: 'Dejar de compartir esta receta',
      message:
        'El enlace deja de funcionar para todos, también para la farmacia que ya lo tenga. No se puede deshacer: para volver a compartirla, cree un enlace nuevo.',
      confirmLabel: 'Revocar',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    this.revoking.set(row.shareId);
    this.shares
      .revoke(row.shareId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.revoking.set(null);
          this.markRevoked(row.shareId);
          this.toasts.success('El enlace quedó revocado.');
        },
        error: (error: unknown) => {
          this.revoking.set(null);
          this.toasts.error(describeApiFailure(error, 'No se pudo revocar el enlace.'));
        },
      });
  }

  protected readonly byId = (row: PrescriptionShareSummary): string => row.shareId;

  private markRevoked(shareId: string): void {
    const rows = this.rows().map((row) =>
      row.shareId === shareId ? { ...row, status: 'REVOKED' as const } : row,
    );
    this.state.set(ready(rows));
  }
}

function newestFirst(a: PrescriptionShareSummary, b: PrescriptionShareSummary): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}
