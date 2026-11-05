import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';

import { validarHorario } from '../../../../core/data-access/diagnostic-units/center-schedule.rules';
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
  /** What the device follows without its own hours: its modality's or the general schedule. */
  readonly inherited = input.required<{ readonly block: ScheduleBlock; readonly label: string }>();
  /** A write is travelling somewhere: the controls wait instead of ignoring the choice. */
  readonly busy = input(false);
  /** The travelling write is this device's. */
  readonly saving = input(false);
  /** Whether this device's last write failed, with the server's message. */
  readonly error = input<string | null>(null);
  readonly linkGlossary = input(false);
  /** `false` for a device of a modality the center offers no study of: it has no line here. */
  readonly schedulable = input(true);

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

  /**
   * Its own hours as being edited; `null` while it follows the inherited
   * ones. An edit in progress survives a write of another device: it only
   * resets from the server while untouched.
   */
  protected readonly ownDraft = linkedSignal<ScheduleBlock | null, ScheduleBlock | null>({
    source: () => this.device().schedule ?? null,
    computation: (schedule, previous) =>
      previous !== undefined && JSON.stringify(previous.value) !== JSON.stringify(previous.source) ? previous.value : schedule,
  });
  protected readonly mapOpen = signal(false);
  protected readonly confirmRemove = signal(false);
  protected readonly problems = signal<readonly string[]>([]);

  /** Make and model, unless the name already carries them (the API names a device «type make model»). */
  protected readonly makeAndModel = computed(() => {
    const text = [this.device().manufacturer, this.device().model].filter(Boolean).join(' ');
    return text !== '' && !this.device().name.includes(text) ? text : '';
  });
  protected readonly dirty = computed(() => JSON.stringify(this.ownDraft()) !== JSON.stringify(this.device().schedule ?? null));
  protected readonly givesAppointments = computed(() => this.schedulable() && this.device().modalityCode !== null);

  protected toggleOwn(value: 'si' | 'no'): void {
    this.problems.set([]);
    this.ownDraft.set(value === 'si' ? (this.device().schedule ?? this.inherited().block) : null);
  }

  protected edit(block: ScheduleBlock): void {
    this.problems.set([]);
    this.ownDraft.set(block);
  }

  /** Checks the hours here, like the «Horarios» tab, before the server sees them. */
  protected save(): void {
    const block = this.ownDraft();
    const problems =
      block === null ? [] : validarHorario({ general: block, modalities: [], studies: [] }, () => this.device().name).map((p) => p.mensaje);
    this.problems.set(problems);
    if (problems.length === 0) this.scheduleSave.emit(block);
  }

  protected onStatus(value: EquipmentStatus | null): void {
    if (value !== null && value !== this.device().status) this.statusChange.emit(value);
  }

  protected onMapToggle(event: Event): void {
    this.mapOpen.set((event.target as HTMLDetailsElement).open);
  }
}
