import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type { Grafo } from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { portalUrl } from '../portal-nav';
import { processOptions } from '../support/process-options';
import { paramValue, patchQuery, queryParamsSignal } from '../support/route-query';
import { ProcessGraph } from './process-graph';

/**
 * El diagrama de un proceso o módulo. El proceso elegido viaja en `?flujo=`,
 * así que el mapa de rutas y la ficha del proceso pueden enlazar directo a él.
 */
@Component({
  selector: 'app-portal-process-diagram-page',
  imports: [RouterLink, Link, Select, Card, FormField, PageHeader, ViewStateHost, ProcessGraph],
  templateUrl: './process-diagram-page.html',
  styleUrl: './process-diagram-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessDiagramPage {
  private readonly client = inject(PortalClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly options = processOptions();
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly flow = paramValue(queryParamsSignal(this.route), 'flujo');
  protected readonly graph = signal<ViewState<Grafo>>(loading());
  protected readonly processUrl = computed(
    () => `${portalUrl('processes')}/${encodeURIComponent(this.flow())}`,
  );
  protected readonly operationUrl = (id: string): string =>
    `${portalUrl('systems/operations')}/${encodeURIComponent(id)}`;
  protected readonly tableUrl = (schema: string, table: string): string =>
    `${portalUrl('catalog/tables')}/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`;

  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      const code = this.flow();
      untracked(() => this.load(code));
    });
  }

  protected choose(code: string | null): void {
    void patchQuery(this.router, this.route, { flujo: code });
  }

  protected reload(): void {
    this.load(this.flow());
  }

  private load(code: string): void {
    this.pending?.unsubscribe();
    if (code === '') {
      this.graph.set(
        empty(
          { label: 'Ver la lista de procesos', route: portalUrl('processes') },
          'Elija un proceso arriba para ver su diagrama.',
        ),
      );
      return;
    }
    this.graph.set(loading());
    this.pending = this.client.getProcessGraph(code).subscribe({
      next: (g) => this.graph.set(ready(g)),
      error: (e: unknown) => this.graph.set(errorToViewState<Grafo>(e)),
    });
  }
}
