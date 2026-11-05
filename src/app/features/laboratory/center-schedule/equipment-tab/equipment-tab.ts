import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';
import type { Observable } from 'rxjs';

import { CenterScheduleClient } from '../../../../core/data-access/diagnostic-units/center-schedule.client';
import type {
  CenterEquipment,
  CenterScheduleView,
  EquipmentStatus,
  EquipmentType,
  NewEquipment,
  ScheduleBlock,
} from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { STATUS_LABEL, modalitiesOf, serverMessage, type CenterModality } from '../center-schedule.logic';
import { EquipmentAddForm } from './equipment-add-form';
import { EquipmentCard } from './equipment-card';

/**
 * «Equipos»: the center's own inventory. It registers devices from the type
 * catalog, marks them down or back in service, gives each one its own hours
 * (its production line) and retires the ones it no longer has. Every write
 * answers with the whole view, which goes up to the page.
 */
@Component({
  selector: 'app-equipment-tab',
  imports: [AppButton, Alert, EquipmentAddForm, EquipmentCard],
  templateUrl: './equipment-tab.html',
  styleUrl: './equipment-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentTab implements OnInit {
  private readonly client = inject(CenterScheduleClient);

  readonly center = input.required<CenterScheduleView>();
  readonly linkGlossary = input(false);
  readonly viewChange = output<CenterScheduleView>();

  protected readonly types = signal<readonly EquipmentType[]>([]);
  protected readonly typesFailed = signal(false);
  /** The add form is open, with this type preselected (or none). */
  protected readonly adding = signal<{ readonly presetType: string | null } | null>(null);
  protected readonly addError = signal<string | null>(null);
  /** The device a write is travelling for; `''` for the add form. */
  protected readonly busy = signal<string | null>(null);
  protected readonly errors = signal<Readonly<Record<string, string>>>({});

  protected readonly modalities = computed(() => modalitiesOf(this.center()));
  /** Devices that never limit appointments (analyzers, centrifuges…). */
  protected readonly others = computed(() => this.center().equipment.filter((e) => e.modalityCode === null));

  ngOnInit(): void {
    this.client.getEquipmentTypes().subscribe({
      next: (page) => this.types.set(page.items),
      error: () => this.typesFailed.set(true),
    });
  }

  protected statusLabel(status: EquipmentStatus): string {
    return STATUS_LABEL[status];
  }

  /** The catalog type that serves a modality, to preselect it from its empty state. */
  protected typeFor(m: CenterModality): string | null {
    return this.types().find((t) => t.modalityCode === m.code)?.code ?? null;
  }

  protected openAdd(presetType: string | null): void {
    this.addError.set(null);
    this.adding.set({ presetType });
  }

  protected add(body: NewEquipment): void {
    this.run('', this.client.addEquipment(this.center().unitId, body), () => this.adding.set(null));
  }

  protected setStatus(device: CenterEquipment, status: EquipmentStatus): void {
    this.run(device.id, this.client.updateEquipment(this.center().unitId, device.id, { status }));
  }

  protected saveSchedule(device: CenterEquipment, schedule: ScheduleBlock | null): void {
    this.run(device.id, this.client.saveEquipmentSchedule(this.center().unitId, device.id, schedule));
  }

  protected remove(device: CenterEquipment): void {
    this.run(device.id, this.client.removeEquipment(this.center().unitId, device.id));
  }

  protected errorOf(id: string): string | null {
    return this.errors()[id] ?? null;
  }

  /** One write at a time: the controls wait instead of ignoring the choice. */
  private run(id: string, request: Observable<CenterScheduleView>, done?: () => void): void {
    if (this.busy() !== null) return;
    this.busy.set(id);
    this.setError(id, null);
    request.subscribe({
      next: (view) => {
        this.busy.set(null);
        done?.();
        this.viewChange.emit(view);
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.setError(id, serverMessage(error, 'No pudimos guardar el cambio del equipo. Pruebe de nuevo en un momento.'));
      },
    });
  }

  private setError(id: string, message: string | null): void {
    if (id === '') {
      this.addError.set(message);
      return;
    }
    const { [id]: _previous, ...rest } = this.errors();
    this.errors.set(message === null ? rest : { ...rest, [id]: message });
  }
}
