import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type { PortalVersion } from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { MetricCard } from '../../../../shared/components/molecules/metric-card/metric-card';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { portalUrl } from '../portal-nav';

/** Centro interno del portal: las cifras del inventario y los accesos a cada área. */
@Component({
  selector: 'app-portal-hub',
  imports: [DatePipe, RouterLink, MetricCard, PageHeader, ViewStateHost],
  templateUrl: './portal-hub.html',
  styleUrl: './portal-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalHub {
  private readonly client = inject(PortalClient);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  protected readonly portalUrl = portalUrl;
  protected readonly estado = signal<ViewState<PortalVersion>>(loading());

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.estado.set(loading());
    this.client.version().subscribe({
      next: (v) => this.estado.set(ready(v)),
      error: (e: unknown) => this.estado.set(errorToViewState<PortalVersion>(e)),
    });
  }
}
