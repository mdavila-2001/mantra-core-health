import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type { HallazgoDetalle } from '../../../../core/data-access/admin-portal/portal.types';
import { describeApiFailure } from '../../../../core/http/api-failure';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DrawerPanel } from '../../../../shared/components/organisms/drawer-panel/drawer-panel';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { portalUrl } from '../portal-nav';
import { describeFindingItem } from './drift.model';

const PAGE_SIZE = 50;

/**
 * Los casos de un hallazgo, en un cajón. Abre con `findingId` y pide la
 * primera página; «Ver más casos» trae las siguientes y las suma a la lista.
 */
@Component({
  selector: 'app-portal-finding-drawer',
  imports: [RouterLink, AppButton, Link, Alert, DrawerPanel, ViewStateHost],
  templateUrl: './finding-drawer.html',
  styleUrl: './finding-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FindingDrawer {
  private readonly client = inject(PortalClient);

  /** El hallazgo abierto; `''` es «cerrado». */
  readonly findingId = input.required<string>();
  readonly heading = input('Hallazgo');
  readonly closed = output<void>();

  protected readonly detail = signal<ViewState<HallazgoDetalle>>(loading());
  protected readonly loadingMore = signal(false);
  protected readonly moreError = signal<string | null>(null);
  protected readonly items = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? s.data.items.map(describeFindingItem) : [];
  });
  protected readonly operationUrl = (id: string): string =>
    `${portalUrl('systems/operations')}/${encodeURIComponent(id)}`;

  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      const id = this.findingId();
      untracked(() => this.load(id));
    });
  }

  protected reload(): void {
    this.load(this.findingId());
  }

  protected loadMore(): void {
    const s = this.detail();
    if (s.status !== 'ready' || !s.data.nextCursor) return;
    this.loadingMore.set(true);
    this.moreError.set(null);
    this.pending = this.client
      .getFinding(s.data.id, { cursor: s.data.nextCursor, limit: PAGE_SIZE })
      .subscribe({
        next: (page) => {
          this.loadingMore.set(false);
          this.detail.set(ready({ ...page, items: [...s.data.items, ...page.items] }));
        },
        error: (e: unknown) => {
          this.loadingMore.set(false);
          this.moreError.set(describeApiFailure(e, 'No se pudieron traer más casos.'));
        },
      });
  }

  private load(id: string): void {
    this.pending?.unsubscribe();
    this.moreError.set(null);
    if (id === '') return;
    this.detail.set(loading());
    this.pending = this.client.getFinding(id, { limit: PAGE_SIZE }).subscribe({
      next: (d) => this.detail.set(ready(d)),
      error: (e: unknown) => this.detail.set(errorToViewState<HallazgoDetalle>(e)),
    });
  }
}
