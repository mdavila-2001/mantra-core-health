import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { EntityImport } from '../entity-import/entity-import';
import { PharmacyImport } from '../pharmacy-import';

/** Qué se importa: los productos tienen su asistente; lo demás, la importación genérica. */
export type ImportTarget = 'products' | 'categories' | 'prices' | 'sites';

/** La clave de «Qué va a importar» en la URL: `?tab=import&target=prices`. */
export const IMPORT_TARGET_PARAM = 'target';

export const IMPORT_TARGETS: readonly SegmentedOption<ImportTarget>[] = [
  { value: 'products', label: 'Productos' },
  { value: 'categories', label: 'Categorías' },
  { value: 'prices', label: 'Precios' },
  { value: 'sites', label: 'Sucursales' },
];

/**
 * Content of the catalog «Importar CSV» modal: the «Qué va a importar» picker
 * and, below, the chosen screen. Products open the product wizard
 * ({@link PharmacyImport}); categories, prices and sites the generic import
 * ({@link EntityImport}). Switching option mounts the other screen from
 * scratch: a prices file has nothing to do in categories.
 *
 * All of them are upserts: what exists is updated and what is new is created.
 * The inventory CSV upload is not here: it stays in the Inventory tab.
 *
 * The choice lives in the URL (`?target=`), so the prices import can be linked
 * directly; without a value, or with an unknown one, it opens products.
 */
@Component({
  selector: 'app-import-target',
  imports: [EntityImport, PharmacyImport, SegmentedControl],
  templateUrl: './import-target.html',
  styleUrl: './import-target.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportTargetPicker {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly productImport = viewChild(PharmacyImport);
  private readonly entityImport = viewChild(EntityImport);


  /** A write is in flight in the open screen: the modal must not close. */
  readonly busy = computed(
    () => (this.productImport()?.busy() ?? false) || (this.entityImport()?.busy() ?? false),
  );

  /** While a load is being written, the other options are disabled: switching would unmount it. */
  protected readonly targets = computed<readonly SegmentedOption<ImportTarget>[]>(() =>
    IMPORT_TARGETS.map((option) =>
      this.busy() && option.value !== this.target() ? { ...option, disabled: true } : option,
    ),
  );
  protected readonly target = signal<ImportTarget>(
    targetOf(this.route.snapshot.queryParamMap.get(IMPORT_TARGET_PARAM)),
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.target.set(targetOf(params.get(IMPORT_TARGET_PARAM)));
    });
  }

  /** Lo deja escrito en la URL, junto a la pestaña y sin entrada en el historial. */
  protected choose(target: ImportTarget): void {
    this.target.set(target);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [IMPORT_TARGET_PARAM]: target },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function targetOf(raw: string | null): ImportTarget {
  return IMPORT_TARGETS.find((option) => option.value === raw)?.value ?? 'products';
}
