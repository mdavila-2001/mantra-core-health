import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';

import type { CenterEquipment, EquipmentStatus, ScheduleBlock } from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { GlossaryDataFlow } from '../../../glossary/glossary-data-flow';
import { ScheduleBlockEditor } from '../schedule-block-editor';

/**
 * One device as a production line: its status, its own hours (or the general
 * schedule it inherits) and its removal. Presentational: every change goes
 * out as an event and the tab talks to the server.
 */
@Component({
  selector: 'app-equipment-card',
  imports: [AppButton, Select, SegmentedControl, ScheduleBlockEditor, GlossaryDataFlow],
  templateUrl: './equipment-card.html',
  styleUrl: './equipment-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentCard {
  readonly device = input.required<CenterEquipment>();
  /** The center's general schedule: what the device inherits without its own. */
  readonly general = input.required<ScheduleBlock>();
  /** A write is travelling: the controls wait instead of ignoring the choice. */
  readonly busy = input(false);
  /** Whether this device's last write failed, with the server's message. */
  readonly error = input<string | null>(null);
  readonly linkGlossary = input(false);

  readonly statusChange = output<EquipmentStatus>();
  readonly scheduleSave = output<ScheduleBlock | null>();
  readonly remove = output<void>();

  /**
   * A select and not a segmented control: «Fuera de servicio» and
   * «Mantenimiento» do not fit in three pills at 390 px.
   */
  protected readonly statuses: readonly SelectOption<EquipmentStatus>[] = [
    { value: 'OPERATIONAL', label: 'Operativo' },
    { value: 'MAINTENANCE', label: 'Mantenimiento' },
    { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
  ];

  protected readonly yesNo: readonly SegmentedOption<'si' | 'no'>[] = [
    { value: 'si', label: 'Sí' },
    { value: 'no', label: 'No' },
  ];

  /** Its own hours as being edited; `null` while it follows the general schedule. */
  protected readonly ownDraft = linkedSignal<ScheduleBlock | null>(() => this.device().schedule ?? null);
  protected readonly mapOpen = signal(false);
  protected readonly confirmRemove = signal(false);

  protected readonly makeAndModel = computed(() => [this.device().manufacturer, this.device().model].filter(Boolean).join(' '));
  protected readonly dirty = computed(() => JSON.stringify(this.ownDraft()) !== JSON.stringify(this.device().schedule ?? null));
  protected readonly givesAppointments = computed(() => this.device().modalityCode !== null);

  protected toggleOwn(value: 'si' | 'no'): void {
    this.ownDraft.set(value === 'si' ? (this.device().schedule ?? this.general()) : null);
  }

  protected onStatus(value: EquipmentStatus | null): void {
    if (value !== null && value !== this.device().status) this.statusChange.emit(value);
  }

  protected onMapToggle(event: Event): void {
    this.mapOpen.set((event.target as HTMLDetailsElement).open);
  }
}
