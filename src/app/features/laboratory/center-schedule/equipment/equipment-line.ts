import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import type {
  CenterBooking,
  CenterEquipment,
  EquipmentStatus,
  ScheduleBlock,
} from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { GlossaryDataFlow } from '../../../glossary/glossary-data-flow';
import { ScheduleBlockEditor } from '../schedule-block-editor';

const ESTADOS: readonly SelectOption<EquipmentStatus>[] = [
  { value: 'OPERATIONAL', label: 'Operativo' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'OUT_OF_SERVICE', label: 'Fuera de servicio' },
];

const ESTADO_DEL_TURNO: Readonly<Record<string, string>> = {
  REQUESTED: 'Solicitado',
  PENDING_CONFIRMATION: 'Por confirmar',
  CONFIRMED: 'Confirmado',
  CHECKED_IN: 'En sala',
  IN_PROGRESS: 'Atendiéndose',
  COMPLETED: 'Atendido',
};

/**
 * One device of the center as a production line: its data and status, its
 * own shift (or «follows its service's schedule») and today's queue, in the
 * order the line attends it. Presentational: every change goes up.
 */
@Component({
  selector: 'app-equipment-line',
  imports: [AppButton, Select, SegmentedControl, ScheduleBlockEditor, GlossaryDataFlow],
  templateUrl: './equipment-line.html',
  styleUrl: './equipment-line.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentLine {
  readonly equipo = input.required<CenterEquipment>();
  /** Its own shift, or `null` when it follows its service's schedule. */
  readonly turno = input<ScheduleBlock | null>(null);
  /** The schedule a new own shift starts from. */
  readonly turnoBase = input.required<ScheduleBlock>();
  readonly cola = input<readonly CenterBooking[]>([]);
  /** Analyzers never limit a slot: no shift, no queue. */
  readonly limitaTurnos = input(true);
  readonly ocupado = input(false);
  readonly veGlosario = input(false);

  readonly estadoChange = output<EquipmentStatus>();
  readonly turnoChange = output<ScheduleBlock | null>();
  readonly editar = output<void>();
  readonly quitar = output<void>();

  protected readonly estados = ESTADOS;
  protected readonly siNo: readonly SegmentedOption<'si' | 'no'>[] = [
    { value: 'si', label: 'Sí' },
    { value: 'no', label: 'No' },
  ];
  /** The data map is read when opened, not before. */
  protected readonly mapaAbierto = signal(false);

  protected alternarTurno(valor: 'si' | 'no'): void {
    this.turnoChange.emit(valor === 'si' ? this.turnoBase() : null);
  }

  protected hora(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  protected estadoDelTurno(status: string): string {
    return ESTADO_DEL_TURNO[status.replace(/^BOOKING_/, '')] ?? status;
  }

  protected alternarMapa(evento: Event): void {
    this.mapaAbierto.set((evento.target as HTMLDetailsElement).open);
  }
}
