import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import type { CareSpaceDetail, CareSpaceNode } from '../../../../../core/data-access/infrastructure/infrastructure.types';
import { InventoryLocationsClient } from '../../../../../core/data-access/pharmacy/inventory-locations.client';
import type { InventoryLocation, SpaceStock } from '../../../../../core/data-access/pharmacy/inventory-locations.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, mapData, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * Pestaña **Stock** de la ficha de espacio (F5c): las ubicaciones de
 * inventario del espacio con sus existencias (lectura), dar de alta el
 * botiquín de la unidad y reubicar una ubicación —el stock la sigue, no se
 * mueven líneas—. Un espacio con stock no se puede retirar (F1 lo bloquea con
 * `INVENTORY_LOCATION`).
 */
@Component({
  selector: 'app-space-stock-tab',
  imports: [AppButton, Badge, FormField, Input, Select, ViewStateHost],
  templateUrl: './space-stock-tab.html',
  styleUrl: '../space-tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceStockTab {
  private readonly client = inject(InventoryLocationsClient);
  private readonly infrastructure = inject(InfrastructureClient);

  readonly space = input.required<CareSpaceDetail>();
  readonly canWrite = input(false);

  private readonly loaded = signal<ViewState<SpaceStock>>(loading());
  protected readonly stockPoints = signal<readonly CareSpaceNode[]>([]);
  protected readonly code = signal('');
  protected readonly name = signal('');
  protected readonly relocating = signal<InventoryLocation | null>(null);
  protected readonly target = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);

  protected readonly pharmacySite = computed(() => dataOf(this.loaded())?.pharmacySites[0] ?? null);

  protected readonly state = computed<ViewState<readonly InventoryLocation[]>>(() => {
    const s = mapData(this.loaded(), (d) => d.locations);
    return s.status === 'ready' && s.data.length === 0
      ? empty({ label: this.canWrite() && this.pharmacySite() !== null ? 'Dé de alta el botiquín con el formulario de arriba' : 'Volver a la ficha' }, 'Este espacio no tiene ubicaciones de inventario.')
      : s;
  });

  protected readonly targetOptions = computed<readonly SelectOption<string>[]>(() =>
    this.stockPoints()
      .filter((s) => s.id !== this.space().id)
      .map((s) => ({ value: s.id, label: `${s.code} · ${s.name}`, description: s.function.display })),
  );

  constructor() {
    effect(() => {
      const space = this.space();
      untracked(() => this.load(space));
    });
  }

  protected create(): void {
    const site = this.pharmacySite();
    if (site === null || this.code().trim() === '' || this.name().trim() === '' || this.saving()) return;
    const space = this.space();
    this.run(
      this.client.create(site.id, {
        code: this.code().trim(),
        name: this.name().trim(),
        locationTypeCode: space.clinicalUnitId === null ? 'SHELF' : 'WARD_STOCK',
        careSpaceId: space.id,
        ...(space.clinicalUnitId === null ? {} : { clinicalUnitId: space.clinicalUnitId }),
      }),
      () => {
        this.code.set('');
        this.name.set('');
      },
    );
  }

  protected confirmRelocate(): void {
    const loc = this.relocating();
    const target = this.target();
    if (loc === null || target === null || this.saving()) return;
    this.run(this.client.relocate(loc.id, target), () => {
      this.relocating.set(null);
      this.target.set(null);
    });
  }

  private run(call: ReturnType<InventoryLocationsClient['relocate']>, done: () => void): void {
    this.saving.set(true);
    this.failure.set(null);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        done();
        this.load(this.space());
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }

  private load(space: CareSpaceDetail): void {
    this.loaded.set(loading());
    this.client.listBySpace(space.id).subscribe({
      next: (stock) => this.loaded.set(ready(stock)),
      error: (error: unknown) => this.loaded.set(errorToViewState<SpaceStock>(error)),
    });
    forkJoin({ structure: this.infrastructure.getStructure(space.siteId), catalog: this.infrastructure.getCatalog() })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        if (r === null) return;
        const points = new Set(r.catalog.functions.filter((f) => f.stockPoint).map((f) => f.code));
        this.stockPoints.set(r.structure.spaces.filter((s) => s.status.code === 'SPACE_ACTIVE' && points.has(s.function.code)));
      });
  }
}
