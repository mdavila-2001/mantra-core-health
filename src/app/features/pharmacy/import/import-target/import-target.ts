import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { EntityImport } from '../entity-import/entity-import';
import { PharmacyImport } from '../pharmacy-import';

/** Qué se importa: los productos tienen su asistente; lo demás, la importación genérica. */
export type ImportTarget = 'products' | 'categories' | 'prices' | 'sites';

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
 */
@Component({
  selector: 'app-import-target',
  imports: [EntityImport, PharmacyImport, SegmentedControl],
  templateUrl: './import-target.html',
  styleUrl: './import-target.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportTargetPicker {
  protected readonly targets = IMPORT_TARGETS;
  protected readonly target = signal<ImportTarget>('products');

  protected choose(target: ImportTarget): void {
    this.target.set(target);
  }
}
