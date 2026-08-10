import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type { ExpireSweepResult } from '../../../core/data-access/identity/identity-admin.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf } from '../../../shared/forms/form-support';

/**
 * Barrido de casos vencidos (V27-02·A,
 * `POST /identity/verification-cases/expire-sweep`).
 *
 * Expira los casos de verificación cuyo plazo ya pasó sin resolverse. Solo
 * toca lo ya vencido, así que repetirlo es inofensivo; la confirmación previa
 * existe porque igual muta estado en masa. Mismo trato que el barrido del M29.
 */
@Component({
  selector: 'app-case-expire-sweep',
  imports: [Alert, AnnounceOnAppear, AppButton, PageHeader],
  templateUrl: './case-expire-sweep.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseExpireSweep {
  private readonly client = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);
  private readonly dialogs = inject(DialogService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isRunning = computed(() => this.state().status === 'loading');

  protected readonly resultado = signal<ExpireSweepResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  protected async ejecutar(): Promise<void> {
    if (this.isRunning()) {
      return;
    }

    // Confirmación sin tono destructivo: el barrido es mantenimiento — expira
    // lo ya vencido —, pero muta estado en masa y merece un alto antes.
    const confirmado = await this.dialogs.confirm({
      title: '¿Barrer los casos vencidos?',
      message:
        'Los casos de verificación cuyo plazo ya pasó sin resolverse quedan expirados. Solo toca lo ya vencido.',
      confirmLabel: 'Barrer casos',
    });
    if (!confirmado) {
      return;
    }

    this.state.set(loading());

    this.client.sweepExpiredCases().subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.resultado.set(resultado);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroBarrido(): void {
    this.resultado.set(null);
    this.state.set(ready(null));
  }
}
