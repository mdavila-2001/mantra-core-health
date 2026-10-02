import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Select } from '../../../shared/components/atoms/select/select';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type { PharmacySummary } from '../../../core/data-access/pharmacy/pharmacy.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import { PharmacyScope } from '../pharmacy-scope';

/** Un atajo del resumen: adónde lleva y con qué filtro. */
interface Shortcut {
  readonly label: string;
  readonly hint: string;
  readonly route: string;
  readonly queryParams?: Readonly<Record<string, string>>;
}

const SHORTCUTS: readonly Shortcut[] = [
  {
    label: 'Completar borradores',
    hint: 'Terminá los productos que dejaste sin publicar.',
    route: '/administration/pharmacy-catalog',
    queryParams: { status: 'DRAFT' },
  },
  {
    label: 'Revisar inventario',
    hint: 'Los productos sin stock o por debajo de su umbral.',
    route: '/administration/pharmacy-inventory',
    queryParams: { alerts: 'true' },
  },
  {
    label: 'Actualizar en lote',
    hint: 'Cargá o corregí cientos de productos con un CSV.',
    route: '/administration/pharmacy-import',
  },
];

/**
 * **Resumen** de la farmacia: cómo está el catálogo hoy y adónde ir a
 * arreglarlo.
 *
 * Todo sale de `GET /pharmacy/pharmacies/:id/summary` (P47, sólo simulador): la
 * pantalla no calcula nada, así que no puede contradecir a las otras. Sin
 * gráficos de terceros: «productos por categoría» son barras de CSS con el
 * número al lado, para que el dato no dependa del color.
 *
 * Los indicadores que el simulador no da —solicitudes de retiro— no se
 * dibujan: es preferible una tarjeta menos a una cifra inventada.
 */
@Component({
  selector: 'app-pharmacy-summary',
  imports: [Card, DatePipe, DecimalPipe, FormField, PageHeader, RouterLink, Select, ViewStateHost],
  providers: [PharmacyScope],
  templateUrl: './pharmacy-summary.html',
  styleUrl: './pharmacy-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacySummaryPage {
  protected readonly scope = inject(PharmacyScope);
  private readonly pharmacy = inject(PharmacyClient);

  protected readonly summary = signal<ViewState<PharmacySummary>>(loading());
  protected readonly shortcuts = SHORTCUTS;

  protected readonly data = computed(() => dataOf(this.summary()));

  /** La categoría con más productos: es el 100 % de las barras. */
  protected readonly maxByCategory = computed(() =>
    Math.max(1, ...(this.data()?.byCategory.map((row) => row.count) ?? [])),
  );

  constructor() {
    effect(() => {
      if (this.scope.pharmacyId() !== null) {
        untracked(() => this.reload());
      }
    });
  }

  protected reload(): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    this.summary.set(loading());
    this.pharmacy.getSummary(pharmacyId).subscribe({
      next: (data) => this.summary.set(ready(data)),
      error: (error: unknown) => this.summary.set(errorToViewState<PharmacySummary>(error)),
    });
  }

  protected barWidth(count: number): string {
    return `${Math.round((count / this.maxByCategory()) * 100)}%`;
  }
}
