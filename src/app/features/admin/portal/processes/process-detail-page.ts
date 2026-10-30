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
import type { ProcesoDetalle } from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { BackLink } from '../../../../shared/components/atoms/back-link/back-link';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { agrupacion, processKind, revisionInventario } from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { paramValue, patchQuery, pathParamsSignal, queryParamsSignal } from '../support/route-query';
import { ProcessStages } from './process-stages';

const LIST_ROUTE = portalUrl('processes');
const VIEWS = ['resumen', 'etapas', 'estados'] as const;

function facts(p: ProcesoDetalle): readonly Hecho[] {
  return [
    { etiqueta: 'Tipo', valor: processKind(p.tipo).label },
    { etiqueta: 'Módulo', valor: p.modulo },
    { etiqueta: 'Bloque', valor: p.bloque },
    { etiqueta: 'Cómo se agrupó', valor: agrupacion(p.agrupacion).label },
    { etiqueta: 'Operaciones', valor: String(p.operaciones) },
    { etiqueta: 'Etapas', valor: String(p.etapas) },
    { etiqueta: 'Revisión', valor: revisionInventario(p.revision).label },
  ];
}

/**
 * La ficha de un proceso: para qué sirve, sus etapas con las operaciones de
 * cada una y las máquinas de estado que gobierna. Desde acá se salta al
 * diagrama y a la lista de sus operaciones, ya filtrada.
 */
@Component({
  selector: 'app-portal-process-detail-page',
  imports: [
    RouterLink,
    Badge,
    BackLink,
    Link,
    Card,
    FactList,
    Tab,
    Tabs,
    PageHeader,
    ViewStateHost,
    ProcessStages,
  ],
  templateUrl: './process-detail-page.html',
  styleUrl: './process-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessDetailPage {
  private readonly client = inject(PortalClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly listUrl = LIST_ROUTE;
  protected readonly diagramUrl = portalUrl('systems/flows/diagram');
  protected readonly operationsUrl = portalUrl('systems/operations');
  protected readonly code = paramValue(pathParamsSignal(this.route), 'code');
  private readonly view = paramValue(queryParamsSignal(this.route), 'vista');
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view() as (typeof VIEWS)[number])),
  );

  protected readonly detail = signal<ViewState<ProcesoDetalle>>(loading());
  protected readonly facts = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? facts(s.data) : [];
  });
  protected readonly title = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? s.data.nombre : 'Proceso';
  });
  protected readonly operationUrl = (id: string): string =>
    `${this.operationsUrl}/${encodeURIComponent(id)}`;
  protected readonly tableUrl = (qualified: string): string | null => {
    const dot = qualified.indexOf('.');
    return dot > 0
      ? `${portalUrl('catalog/tables')}/${encodeURIComponent(qualified.slice(0, dot))}/${encodeURIComponent(qualified.slice(dot + 1))}`
      : null;
  };

  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      const code = this.code();
      untracked(() => this.load(code));
    });
  }

  protected reload(): void {
    this.load(this.code());
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { vista: index === 0 ? null : VIEWS[index]! });
  }

  private load(code: string): void {
    this.pending?.unsubscribe();
    this.detail.set(loading());
    this.pending = this.client.getProcess(code).subscribe({
      next: (p) => this.detail.set(ready(p)),
      error: (e: unknown) => this.detail.set(errorToViewState<ProcesoDetalle>(e)),
    });
  }
}
