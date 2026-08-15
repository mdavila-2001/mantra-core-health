import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { DiagnosticUnitsClient } from '../../../core/data-access/diagnostic-units/diagnostic-units.client';
import type { DiagnosticUnitDetail } from '../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { categoryName } from '../laboratory-directory';

/** Perfil navegable de una unidad diagnóstica publicada. */
@Component({
  selector: 'app-laboratory-detail',
  imports: [Card, DatePipe, PageHeader, ViewStateHost],
  templateUrl: './laboratory-detail.html',
  styleUrl: './laboratory-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly units = inject(DiagnosticUnitsClient);

  protected readonly state = signal<ViewState<DiagnosticUnitDetail>>(loading());
  protected readonly detail = computed(() => dataOf(this.state()));
  protected readonly title = computed(() => this.detail()?.name ?? 'Unidad diagnóstica');
  protected readonly category = computed(() => {
    const type = this.detail()?.type;
    return type ? categoryName(type.code, type.display) : '';
  });

  private unitId: string | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.unitId = params.get('unitId');
      this.load();
    });
  }

  protected retry(): void {
    this.load();
  }

  protected siteName(siteId: string | null): string | null {
    if (siteId === null) return null;
    return this.detail()?.sites.find((site) => site.id === siteId)?.name ?? null;
  }

  protected priceLabel(amount: string, currencyDisplay: string): string {
    return `${amount} ${currencyDisplay}`;
  }

  private load(): void {
    if (!this.unitId) {
      this.state.set(notFound({ label: 'Volver al directorio', route: '/laboratory-directory' }));
      return;
    }
    this.state.set(loading());
    this.units.getById(this.unitId).subscribe({
      next: (detail) => this.state.set(ready(detail)),
      error: (error: unknown) => this.state.set(errorToViewState<DiagnosticUnitDetail>(error)),
    });
  }
}
