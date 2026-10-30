import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { BillingSimulatedClient } from '../../../core/data-access/billing-simulated/billing-simulated.client';
import type { SimulatedIssuer } from '../../../core/data-access/billing-simulated/billing-simulated.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * «Emisor de facturas»: solo lectura de `GET /billing/simulated/status`, tal
 * como responde. Es el emisor **de prueba**: el emisor SIAT real por práctica
 * no existe todavía en el modelo, así que no hay nada que configurar acá.
 */
@Component({
  selector: 'app-invoice-issuer-block',
  imports: [Badge, ViewStateHost],
  templateUrl: './invoice-issuer-block.html',
  styleUrl: '../billing-setup-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceIssuerBlock {
  private readonly billing = inject(BillingSimulatedClient);

  /** Los emisores de práctica que devuelve la API; vacío si la práctica todavía no tiene. */
  protected readonly issuers = signal<ViewState<readonly SimulatedIssuer[]>>(loading());

  constructor() {
    this.reload();
  }

  protected reload(): void {
    this.issuers.set(loading());
    this.billing.status().subscribe({
      next: (status) => this.issuers.set(ready(status.issuers.filter((issuer) => issuer.kind === 'PRACTICE'))),
      error: (error: unknown) => this.issuers.set(errorToViewState(error)),
    });
  }
}
