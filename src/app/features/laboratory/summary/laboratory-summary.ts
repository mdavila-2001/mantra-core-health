import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type { LabSummary } from '../../../core/data-access/lab-portal/lab-portal.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import { formatBytes } from '../file-size';

/** Un atajo del resumen: adónde lleva y con qué filtro. */
interface Shortcut {
  readonly label: string;
  readonly hint: string;
  readonly route: string;
  readonly queryParams?: Readonly<Record<string, string>>;
}

const SHORTCUTS: readonly Shortcut[] = [
  {
    label: 'Subir resultados',
    hint: 'Cualquier formato y sin límite de tamaño, atados a su orden.',
    route: '/administration/laboratory-results',
  },
  {
    label: 'Recibir muestras',
    hint: 'Las órdenes que le derivaron y todavía esperan su muestra.',
    route: '/laboratorio/recepcion',
  },
  {
    label: 'Seguir la cola de trabajo',
    hint: 'Las muestras acesionadas y en qué paso está cada una.',
    route: '/laboratorio/cola',
  },
];

/**
 * **Resumen** del laboratorio: cómo está el catálogo, qué órdenes esperan su
 * resultado y lo último que pasó.
 *
 * El espejo del resumen de la farmacia. Todo sale de `GET
 * /diagnostics/lab/summary` (P52, sólo simulador): la pantalla no calcula nada,
 * así que no puede contradecir a las otras.
 */
@Component({
  selector: 'app-laboratory-summary',
  imports: [Card, DatePipe, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './laboratory-summary.html',
  styleUrl: './laboratory-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratorySummaryPage {
  private readonly lab = inject(LabPortalClient);

  protected readonly summary = signal<ViewState<LabSummary>>(loading());
  protected readonly shortcuts = SHORTCUTS;
  protected readonly formatBytes = formatBytes;

  protected readonly data = computed(() => dataOf(this.summary()));

  /** La categoría con más servicios: es el 100 % de las barras. */
  protected readonly maxByCategory = computed(() =>
    Math.max(1, ...(this.data()?.byCategory.map((row) => row.count) ?? [])),
  );

  constructor() {
    this.reload();
  }

  protected reload(): void {
    this.summary.set(loading());
    this.lab.getSummary().subscribe({
      next: (data) => this.summary.set(ready(data)),
      error: (error: unknown) => this.summary.set(errorToViewState<LabSummary>(error)),
    });
  }

  protected barWidth(count: number): string {
    return `${Math.round((count / this.maxByCategory()) * 100)}%`;
  }
}
