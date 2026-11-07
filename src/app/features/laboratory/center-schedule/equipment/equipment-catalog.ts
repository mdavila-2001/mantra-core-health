import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';

import {
  searchCatalog,
  EQUIPMENT_CATALOG,
  inputFromCatalog,
} from '../../../../core/data-access/diagnostic-units/equipment-catalog';
import type { CenterEquipmentInput } from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { modalidad, type ModalityCode } from '../../../../core/data-access/diagnostic-units/modalidades';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';

type CatalogFilter = ModalityCode | 'ALL' | 'ANALYZER';

const FILTERS: readonly CatalogFilter[] = ['ALL', 'ECO', 'RX', 'RM', 'TC', 'MG', 'DXA', 'ANALYZER'];

const modalityName = (code: ModalityCode | null): string => (code === null ? 'Analizador' : modalidad(code).label);

/**
 * International device catalog: search and filter by modality, pick one to
 * prefill the form, or skip to typing it by hand. Presentational: it emits the
 * form's starting input.
 */
@Component({
  selector: 'app-equipment-catalog',
  imports: [AppButton, SearchField, SegmentedControl],
  templateUrl: './equipment-catalog.html',
  styleUrl: './equipment-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentCatalog {
  /** A catalog pick, or a blank device for «Cargar a mano». */
  readonly picked = output<CenterEquipmentInput>();

  protected readonly filter = signal<CatalogFilter>('ALL');
  protected readonly query = signal('');

  protected readonly filters: readonly SegmentedOption<CatalogFilter>[] = FILTERS.map((f) => ({
    value: f,
    label: f === 'ALL' ? 'Todos' : f === 'ANALYZER' ? 'Analizadores' : modalidad(f).label,
  }));

  protected readonly items = computed(() => searchCatalog(EQUIPMENT_CATALOG, this.filter(), this.query(), modalityName));

  protected readonly modalityOf = modalityName;
  protected readonly toInput = inputFromCatalog;
  protected readonly blank: CenterEquipmentInput = { name: '', manufacturer: null, serialNumber: null, modalityCode: 'ECO' };
}
