import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
 * La pestaña «Importación» del catálogo: el selector «Qué va a importar» y,
 * debajo, la pantalla de lo elegido. Productos abre el asistente de siempre
 * ({@link PharmacyImport}); categorías, precios y sucursales, la importación
 * genérica ({@link EntityImport}). Cambiar de opción monta la otra pantalla
 * desde cero: un archivo de precios no tiene nada que hacer en categorías.
 *
 * La subida de inventario por CSV no está acá: sigue en la pestaña Inventario.
 *
 * Lo elegido va en la URL (`?target=`), así que se puede enlazar directo a la
 * importación de precios; sin valor, o con uno desconocido, abre productos.
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

  protected readonly targets = IMPORT_TARGETS;
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
