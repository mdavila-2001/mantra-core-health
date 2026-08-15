import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type { BrokerSummary } from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * Corredores de la organización, con su situación de vinculación.
 *
 * «Independiente» y «representa a N aseguradoras» los calcula el servidor a
 * partir de los acuerdos vigentes hoy. La pantalla **no** los deriva de las
 * fechas por su cuenta: si lo hiciera, dos clientes con relojes distintos
 * podrían discrepar sobre si alguien puede presentarse como representante de
 * una aseguradora, que es justo lo que la especificación prohíbe dejar
 * ambiguo.
 */
@Component({
  selector: 'app-broker-directory',
  imports: [Card, Chip, PageHeader, RouterLink, StatusSeal, ViewStateHost],
  templateUrl: './broker-directory.html',
  styleUrl: './broker-directory.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrokerDirectory {
  private readonly insurance = inject(InsuranceClient);

  protected readonly state = signal<ViewState<readonly BrokerSummary[]>>(loading());
  protected readonly brokers = computed(() => dataOf(this.state()) ?? []);

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  /** Traduce el código del catálogo, no su redacción. */
  protected verificationVariant(code: string): StatusSealVariant {
    if (code === 'VERIFICATION_VERIFIED') return 'approved';
    if (code === 'VERIFICATION_PENDING') return 'pending';
    return 'unknown';
  }

  /** Cómo se nombra la situación de vinculación de un corredor. */
  protected linkLabel(broker: BrokerSummary): string {
    if (broker.independent) return 'Independiente';
    return broker.currentCarrierCount === 1
      ? 'Representa a 1 aseguradora'
      : `Representa a ${broker.currentCarrierCount} aseguradoras`;
  }

  private load(): void {
    this.state.set(loading());
    this.insurance.listBrokers().subscribe({
      next: (directory) => {
        this.state.set(
          directory.items.length === 0
            ? empty(
                { label: 'Volver al panel', route: '/dashboard' },
                'Todavía no hay corredores registrados en esta organización.',
              )
            : ready(directory.items),
        );
      },
      error: (error: unknown) =>
        this.state.set(errorToViewState<readonly BrokerSummary[]>(error)),
    });
  }
}
