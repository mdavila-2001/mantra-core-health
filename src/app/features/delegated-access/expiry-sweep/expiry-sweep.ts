import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type { ExpirySweepResult } from '../../../core/data-access/delegated-access/delegated-access.types';
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
 * Barrido de expiración (V29-07, `POST /delegated-access/expiry-sweep`).
 *
 * Expira delegaciones, concesiones y asignaciones cuyo `validTo` ya pasó. No
 * lleva cuerpo ni parámetros y solo toca lo ya vencido, así que repetirlo es
 * inofensivo; la confirmación previa existe porque igual muta estado en masa.
 * En producción lo corre también el worker (`SYSTEM`) — esta pantalla es el
 * disparo manual del administrador.
 */
@Component({
  selector: 'app-expiry-sweep',
  imports: [Alert, AnnounceOnAppear, AppButton, PageHeader],
  templateUrl: './expiry-sweep.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpirySweep {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);
  private readonly dialogs = inject(DialogService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isRunning = computed(() => this.state().status === 'loading');

  protected readonly resultado = signal<ExpirySweepResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para ejecutar el barrido de expiración.'),
  );

  protected async ejecutar(): Promise<void> {
    if (this.isRunning()) {
      return;
    }

    // Confirmación sin tono destructivo: el barrido es mantenimiento — expira
    // lo ya vencido —, pero muta estado en masa y merece un alto antes.
    const confirmado = await this.dialogs.confirm({
      title: '¿Ejecutar el barrido de expiración?',
      message:
        'Las delegaciones, concesiones y asignaciones con vigencia vencida pasan a expiradas. Solo toca lo ya vencido.',
      confirmLabel: 'Ejecutar barrido',
    });
    if (!confirmado) {
      return;
    }

    this.state.set(loading());

    this.client.runExpirySweep().subscribe({
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
