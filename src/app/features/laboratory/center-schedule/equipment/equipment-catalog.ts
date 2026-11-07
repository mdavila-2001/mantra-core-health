import { ChangeDetectionStrategy, Component, computed, output, signal, TemplateRef, viewChild } from '@angular/core';

import {
  searchCatalog,
  EQUIPMENT_CATALOG,
  type CatalogEquipment,
  inputFromCatalog,
} from '../../../../core/data-access/diagnostic-units/equipment-catalog';
import type { CenterEquipmentInput } from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { modalidad, type ModalityCode } from '../../../../core/data-access/diagnostic-units/modalidades';
import { ready } from '../../../../core/view-state/view-state';
import { Chip } from '../../../../shared/components/atoms/chip/chip';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef, SortState } from '../../../../shared/components/organisms/data-table/data-table.types';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { EquipmentThumb } from './equipment-thumb';

type SortKey = 'manufacturer' | 'model' | 'modality' | 'country';
type CatalogRow = CatalogEquipment & { readonly modality: string };
type CatalogFilter = ModalityCode | 'ALL' | 'ANALYZER';

const FILTERS: readonly CatalogFilter[] = ['ALL', 'ECO', 'RX', 'RM', 'TC', 'MG', 'DXA', 'ANALYZER'];

const SHORT_LABEL: Record<CatalogFilter, string> = {
  ALL: 'Todos',
  ECO: 'Ecografía',
  RX: 'Rayos X',
  RM: 'Resonancia',
  TC: 'Tomografía',
  MG: 'Mamografía',
  DXA: 'Densitometría',
  ECG: 'Electrocardiografía',
  LAB: 'Laboratorio',
  ANALYZER: 'Analizadores',
};

const modalityName = (code: ModalityCode | null): string => (code === null ? 'Analizador' : modalidad(code).label);

/**
 * International device catalog: search and filter by modality, pick one to
 * prefill the form, or skip to typing it by hand. Presentational: it emits the
 * form's starting input.
 */
@Component({
  selector: 'app-equipment-catalog',
  imports: [AppButton, Badge, Chip, DataTable, EquipmentThumb, SearchField],
  templateUrl: './equipment-catalog.html',
  styleUrl: './equipment-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentCatalog {
  /** A catalog pick, or a blank device for «Cargar a mano». */
  readonly picked = output<CenterEquipmentInput>();

  protected readonly filter = signal<CatalogFilter>('ALL');
  protected readonly query = signal('');

  /** Short chip labels with how many catalog devices each one holds. */
  protected readonly filters = FILTERS.map((value) => ({
    value,
    label: SHORT_LABEL[value],
    count: EQUIPMENT_CATALOG.filter((e) => value === 'ALL' || (value === 'ANALYZER' ? e.modalityCode === null : e.modalityCode === value)).length,
  }));

  protected readonly sort = signal<SortState>({ key: 'manufacturer', direction: 'asc' });
  protected readonly total = EQUIPMENT_CATALOG.length;

  /** Filtered and sorted rows; the modality is already its display name. */
  protected readonly rows = computed<readonly CatalogRow[]>(() => {
    const { key, direction } = this.sort();
    const sign = direction === 'asc' ? 1 : -1;
    return searchCatalog(EQUIPMENT_CATALOG, this.filter(), this.query(), modalityName)
      .map((item) => ({ ...item, modality: modalityName(item.modalityCode) }))
      .sort((a, b) => sign * a[key as SortKey].localeCompare(b[key as SortKey], 'es'));
  });
  protected readonly state = computed(() => ready(this.rows()));

  private readonly modalityCell = viewChild.required<TemplateRef<{ $implicit: CatalogRow }>>('modalityCell');
  private readonly modelCell = viewChild.required<TemplateRef<{ $implicit: CatalogRow }>>('modelCell');
  private readonly actionCell = viewChild.required<TemplateRef<{ $implicit: CatalogRow }>>('actionCell');

  protected get columns(): readonly ColumnDef<CatalogRow>[] {
    return [
      { key: 'manufacturer', header: 'Equipo', priority: 1, sortable: true, cell: this.modelCell() },
      { key: 'modality', header: 'Modalidad', priority: 1, sortable: true, cell: this.modalityCell() },
      { key: 'country', header: 'Origen', priority: 1, sortable: true },
      { key: 'action', header: 'Acción', priority: 1, align: 'end', accion: true, cell: this.actionCell() },
    ];
  }

  protected readonly trackById = (row: CatalogRow): string => row.id;
  protected readonly rowLabel = (row: CatalogRow): string => `${row.manufacturer} ${row.model}`;

  protected pick(id: string): void {
    const item = EQUIPMENT_CATALOG.find((e) => e.id === id);
    if (item) this.picked.emit(inputFromCatalog(item));
  }

  protected readonly blank: CenterEquipmentInput = { name: '', manufacturer: null, serialNumber: null, modalityCode: 'ECO' };
}
