import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';

import type { CenterEquipment, CenterEquipmentInput } from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { MODALIDADES, type ModalityCode } from '../../../../core/data-access/diagnostic-units/modalidades';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';

/**
 * Modalities the catalog has a device type for (same list as the API,
 * mantra-core-health-api#1359). ECG has no modality in the API yet.
 */
const CON_TIPO: readonly ModalityCode[] = ['ECO', 'RX', 'RM', 'TC', 'MG', 'DXA', 'LAB'];
const SIN_MODALIDAD = 'NONE';

/**
 * Register or edit a device: what the center calls it, its maker and serial,
 * and the modality it attends. Without modality it is an analyzer, which never
 * limits a slot. Presentational: it emits the input, the parent saves it.
 */
@Component({
  selector: 'app-equipment-form',
  imports: [AppButton, AppInput, Select, FormField],
  templateUrl: './equipment-form.html',
  styleUrl: './equipment-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentForm {
  /** The device being edited, or `null` to register a new one. */
  readonly equipo = input<CenterEquipment | null>(null);
  readonly guardando = input(false);
  /** Values to start a new device with (a pick from the catalog). Ignored when editing. */
  readonly initial = input<CenterEquipmentInput | null>(null);

  readonly guardar = output<CenterEquipmentInput>();
  readonly cancelar = output<void>();

  protected readonly modalidades: readonly SelectOption<string>[] = [
    ...MODALIDADES.filter((m) => CON_TIPO.includes(m.code)).map((m) => ({ value: m.code, label: m.label })),
    { value: SIN_MODALIDAD, label: 'Ninguna: analizador (no limita turnos)' },
  ];

  protected readonly nombre = linkedSignal(() => this.equipo()?.model ?? this.equipo()?.name ?? this.initial()?.name ?? '');
  protected readonly fabricante = linkedSignal(() => this.equipo()?.manufacturer ?? this.initial()?.manufacturer ?? '');
  protected readonly serie = linkedSignal(() => this.equipo()?.serialNumber ?? this.initial()?.serialNumber ?? '');
  protected readonly modalidad = linkedSignal<string>(() => {
    const e = this.equipo();
    if (e !== null) return e.modalityCode ?? SIN_MODALIDAD;
    const i = this.initial();
    return i === null ? 'ECO' : (i.modalityCode ?? SIN_MODALIDAD);
  });

  protected readonly aTexto = (v: string | number | null): string => String(v ?? '');

  protected readonly falta = computed(() => this.nombre().trim() === '');

  protected enviar(evento: Event): void {
    evento.preventDefault();
    if (this.falta() || this.guardando()) return;
    const texto = (v: string): string | null => (v.trim() === '' ? null : v.trim());
    this.guardar.emit({
      name: this.nombre().trim(),
      manufacturer: texto(this.fabricante()),
      serialNumber: texto(this.serie()),
      modalityCode: this.modalidad() === SIN_MODALIDAD ? null : (this.modalidad() as ModalityCode),
    });
  }
}
