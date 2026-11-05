import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';

import type { EquipmentType, NewEquipment } from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';

/**
 * Registers one device from the type catalog: the type decides the modality
 * it serves; make, model and serial are the center's own words. Four fields,
 * the house limit for one screen of a form.
 */
@Component({
  selector: 'app-equipment-add-form',
  imports: [AppButton, FormField, Input, Select],
  templateUrl: './equipment-add-form.html',
  styleUrl: './equipment-add-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentAddForm {
  readonly types = input.required<readonly EquipmentType[]>();
  /** The type preselected by the «Agregar …» of an empty modality. */
  readonly presetType = input<string | null>(null);
  readonly saving = input(false);
  readonly error = input<string | null>(null);

  readonly add = output<NewEquipment>();
  readonly dismiss = output<void>();

  protected readonly typeCode = linkedSignal<string | null>(() => this.presetType());
  protected readonly manufacturer = signal('');
  protected readonly model = signal('');
  protected readonly serialNumber = signal('');
  protected readonly tried = signal(false);

  protected readonly typeOptions = computed<readonly SelectOption<string>[]>(() =>
    this.types().map((t) => ({ value: t.code, label: t.modalityCode === null ? `${t.label} (no da turnos)` : t.label })),
  );

  protected submit(): void {
    this.tried.set(true);
    const typeCode = this.typeCode();
    if (typeCode === null) return;
    const text = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim());
    this.add.emit({
      typeCode,
      manufacturer: text(this.manufacturer()),
      model: text(this.model()),
      serialNumber: text(this.serialNumber()),
    });
  }
}
