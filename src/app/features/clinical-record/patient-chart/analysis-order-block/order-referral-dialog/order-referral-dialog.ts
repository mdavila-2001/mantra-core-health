import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { DiagnosticUnitsClient } from '../../../../../core/data-access/diagnostic-units/diagnostic-units.client';
import type { DiagnosticUnitSearchItem } from '../../../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { OrderReferralClient } from '../../../../../core/data-access/diagnostics/order-referral.client';
import { readApiError } from '../../../../../core/http/api-error';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { SearchField } from '../../../../../shared/components/molecules/search-field/search-field';
import { NavIcon } from '../../../../../shared/components/atoms/nav-icon/nav-icon';
import { OrganizationIdentity } from '../../../../../shared/components/molecules/organization-identity/organization-identity';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';

const LIMITE = 20;

/**
 * **Derivar a un centro** (06/11/2026): el médico dirige una orden de
 * laboratorio o imagen a un centro. No es un permiso: la orden queda
 * «pendiente de aceptación» y sólo aparece en el centro si el paciente la acepta
 * desde «Mis órdenes». Derivar de nuevo está permitido sólo tras un rechazo.
 */
@Component({
  selector: 'app-order-referral-dialog',
  imports: [Alert, AppButton, ContentDialog, NavIcon, OrganizationIdentity, SearchField],
  templateUrl: './order-referral-dialog.html',
  styleUrl: './order-referral-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderReferralDialog {
  private readonly units = inject(DiagnosticUnitsClient);
  private readonly referrals = inject(OrderReferralClient);
  private readonly toasts = inject(ToastService);

  readonly orderId = input.required<string>();
  readonly studyLabel = input.required<string>();
  readonly referred = output<void>();
  readonly closed = output<void>();

  protected readonly centers = signal<ViewState<readonly DiagnosticUnitSearchItem[]>>(loading());
  protected readonly chosen = signal<string | null>(null);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.loadCenters();
  }

  private query = '';

  /** Una búsqueda nueva: lo elegido antes puede no estar más en la lista, así que se suelta. */
  protected searchCenters(q: string): void {
    this.query = q.trim();
    this.chosen.set(null);
    this.loadCenters();
  }

  protected loadCenters(): void {
    this.centers.set(loading());
    this.units.search({ limit: LIMITE, ...(this.query === '' ? {} : { q: this.query }) }).subscribe({
      next: (page) => this.centers.set(ready(page.items)),
      error: (error: unknown) =>
        this.centers.set(errorToViewState<readonly DiagnosticUnitSearchItem[]>(error)),
    });
  }

  /** La segunda línea de la tarjeta: el tipo de centro y dónde está. */
  protected detail(center: DiagnosticUnitSearchItem): string {
    return [center.type.display, center.cities.join(', ')].filter((t) => t !== '').join(' · ');
  }

  protected send(): void {
    const tenantId = this.chosen();
    if (tenantId === null || this.sending()) return;
    this.sending.set(true);
    this.error.set(null);
    this.referrals.referOrder(this.orderId(), tenantId).subscribe({
      next: (result) => {
        this.sending.set(false);
        this.toasts.success(
          `Derivada a ${result.performerName}. Queda pendiente de que el paciente la acepte.`,
        );
        this.referred.emit();
      },
      error: (error: unknown) => {
        // Lo elegido se conserva: sólo se dice por qué no se pudo.
        this.sending.set(false);
        const message = error instanceof HttpErrorResponse ? readApiError(error)?.message : undefined;
        this.error.set(message ?? 'No pudimos derivar la orden. Intente de nuevo.');
      },
    });
  }
}
