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
import type {
  LinajeTabla,
  LineageOperation,
} from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { DrawerPanel } from '../../../../shared/components/organisms/drawer-panel/drawer-panel';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { operacionSobreTabla, partirTabla } from '../portal-labels';
import { portalUrl } from '../portal-nav';

/** Primero lo que cambia datos: es lo que se busca cuando se rastrea un efecto. */
const EFFECT_ORDER = ['ESCRIBE', 'BORRA', 'LEE'];

export interface EffectGroup {
  readonly effect: string;
  readonly operations: readonly LineageOperation[];
}

export function groupByEffect(operations: readonly LineageOperation[]): readonly EffectGroup[] {
  const effects = [...new Set(operations.map((o) => o.efecto))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  );
  return effects.map((effect) => ({
    effect,
    operations: operations.filter((o) => o.efecto === effect),
  }));
}

function rank(effect: string): number {
  const i = EFFECT_ORDER.indexOf(effect);
  return i < 0 ? EFFECT_ORDER.length : i;
}

/**
 * El linaje de una tabla en un cajón: qué operaciones la escriben, borran o
 * leen, a qué tablas apunta y cuáles la apuntan. Una tabla relacionada abre su
 * propio linaje en el mismo cajón.
 */
@Component({
  selector: 'app-portal-table-lineage-drawer',
  imports: [RouterLink, Badge, Link, DrawerPanel, ViewStateHost],
  templateUrl: './table-lineage-drawer.html',
  styleUrl: './table-lineage-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableLineageDrawer {
  private readonly client = inject(PortalClient);

  /** `schema.tabla`; `''` es «cerrado». */
  readonly qualified = input.required<string>();
  readonly closed = output<void>();

  protected readonly effect = operacionSobreTabla;
  protected readonly lineage = signal<ViewState<LinajeTabla>>(loading());
  protected readonly groups = computed(() => {
    const s = this.lineage();
    return s.status === 'ready' ? groupByEffect(s.data.operaciones) : [];
  });
  protected readonly sheetUrl = computed(() => {
    const parts = partirTabla(this.qualified());
    return parts
      ? `${portalUrl('catalog/tables')}/${encodeURIComponent(parts.schema)}/${encodeURIComponent(parts.tabla)}`
      : null;
  });
  protected readonly operationUrl = (id: string): string =>
    `${portalUrl('systems/operations')}/${encodeURIComponent(id)}`;

  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      const qualified = this.qualified();
      untracked(() => this.load(qualified));
    });
  }

  protected reload(): void {
    this.load(this.qualified());
  }

  private load(qualified: string): void {
    this.pending?.unsubscribe();
    if (qualified === '') return;
    const parts = partirTabla(qualified);
    if (!parts) {
      // Una dirección escrita a mano sin `schema.tabla`: no hay tabla que buscar.
      this.lineage.set(notFound({ label: 'Buscar la tabla', route: portalUrl('lineage') }));
      return;
    }
    this.lineage.set(loading());
    this.pending = this.client.tableLineage(parts.schema, parts.tabla).subscribe({
      next: (l) => this.lineage.set(ready(l)),
      error: (e: unknown) => this.lineage.set(errorToViewState<LinajeTabla>(e)),
    });
  }
}
