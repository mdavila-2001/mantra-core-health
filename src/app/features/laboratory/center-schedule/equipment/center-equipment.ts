import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';

import { CenterScheduleClient } from '../../../../core/data-access/diagnostic-units/center-schedule.client';
import { resolverHorario } from '../../../../core/data-access/diagnostic-units/center-schedule.rules';
import type {
  CenterBooking,
  CenterEquipment,
  CenterEquipmentInput,
  CenterSchedule,
  CenterScheduleView,
  EquipmentStatus,
  ScheduleBlock,
} from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import { turnoPropio } from '../../../../core/data-access/diagnostic-units/equipment-lines.rules';
import { inputFromCatalog } from '../../../../core/data-access/diagnostic-units/equipment-catalog';
import { MODALIDADES } from '../../../../core/data-access/diagnostic-units/modalidades';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { EquipmentCatalog } from './equipment-catalog';
import { EquipmentForm } from './equipment-form';
import { EquipmentLine } from './equipment-line';

/**
 * «Equipos»: each device is a production line with its status, its own shift
 * (part of the schedule draft, published with «Publicar horarios») and today's
 * queue. Registering, editing, removing and the status are saved at once.
 */
@Component({
  selector: 'app-center-equipment',
  imports: [AppButton, Alert, ContentDialog, EquipmentCatalog, EquipmentForm, EquipmentLine],
  templateUrl: './center-equipment.html',
  styleUrl: './center-equipment.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenterEquipmentTab implements OnInit {
  private readonly cliente = inject(CenterScheduleClient);
  private readonly dialogs = inject(DialogService);
  private readonly navegacion = inject(NavigationService);

  readonly centro = input.required<CenterScheduleView>();
  readonly borrador = input.required<CenterSchedule>();
  /** The server answered with the center as it is now. */
  readonly vistaChange = output<CenterScheduleView>();
  readonly borradorChange = output<CenterSchedule>();

  /** `'nuevo'`, the id of the device being edited, or `null`. */
  protected readonly editando = signal<string | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Inside the «Agregar equipo» modal: `null` shows the catalog, otherwise the form prefilled with it. */
  protected readonly newDraft = signal<CenterEquipmentInput | null>(null);
  private readonly hoy = signal<readonly CenterBooking[]>([]);

  protected readonly veGlosario = computed(() => this.navegacion.visibleSections().some((s) => s.path === 'glossary'));

  /** Devices by modality, in catalog order; analyzers last. */
  protected readonly grupos = computed(() => {
    const equipos = this.centro().equipment;
    const grupos = MODALIDADES.map((m) => ({ code: m.code as string, label: m.label, equipos: equipos.filter((e) => e.modalityCode === m.code) }));
    const otros = { code: 'otros', label: 'Otros equipos · no limitan los turnos', equipos: equipos.filter((e) => e.modalityCode === null) };
    return [...grupos, otros].filter((g) => g.equipos.length > 0);
  });

  protected readonly equipoEditado = computed(() => this.centro().equipment.find((e) => e.id === this.editando()) ?? null);

  protected openNew(): void {
    this.error.set(null);
    this.newDraft.set(null);
    this.editando.set('nuevo');
  }

  protected closeNew(): void {
    if (this.ocupado()) return;
    this.editando.set(null);
  }

  protected readonly fromCatalog = inputFromCatalog;
  protected readonly blankDraft: CenterEquipmentInput = { name: '', manufacturer: null, serialNumber: null, modalityCode: 'ECO' };

  ngOnInit(): void {
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(desde.getTime() + 86_400_000);
    this.cliente.getMyBookings(desde, hasta).subscribe({ next: (page) => this.hoy.set(page.items), error: () => this.hoy.set([]) });
  }

  protected colaDe(e: CenterEquipment): readonly CenterBooking[] {
    return this.hoy().filter((b) => b.equipmentId === e.id);
  }

  protected turnoDe(e: CenterEquipment): ScheduleBlock | null {
    return turnoPropio(this.borrador(), e.id);
  }

  /** A new own shift starts from the block the device follows today. */
  protected turnoBase(e: CenterEquipment): ScheduleBlock {
    const estudio = this.centro().studies.find((s) => s.modalityCode === e.modalityCode);
    return resolverHorario(this.borrador(), estudio?.code ?? '', e.modalityCode ?? 'LAB').block;
  }

  protected fijarTurno(e: CenterEquipment, block: ScheduleBlock | null): void {
    const b = this.borrador();
    const resto = (b.equipment ?? []).filter((x) => x.equipmentId !== e.id);
    this.borradorChange.emit({ ...b, equipment: block === null ? resto : [...resto, { equipmentId: e.id, schedule: block }] });
  }

  protected guardar(datos: CenterEquipmentInput): void {
    const id = this.editando();
    const unitId = this.centro().unitId;
    this.enviar(id === 'nuevo' || id === null ? this.cliente.addEquipment(unitId, datos) : this.cliente.editEquipment(unitId, id, datos), 'No pudimos guardar el equipo.');
  }

  protected cambiarEstado(e: CenterEquipment, status: EquipmentStatus): void {
    this.enviar(this.cliente.setEquipmentStatus(this.centro().unitId, e.id, status), 'No pudimos cambiar el estado del equipo.');
  }

  protected async quitar(e: CenterEquipment): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: `Quitar ${e.name}`,
      message: 'Sólo para un equipo cargado por error. Uno que ya atendió pacientes se marca «Fuera de servicio».',
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!ok) return;
    if (this.turnoDe(e) !== null) this.fijarTurno(e, null);
    this.enviar(this.cliente.removeEquipment(this.centro().unitId, e.id), 'No pudimos quitar el equipo.');
  }

  private enviar(peticion: ReturnType<CenterScheduleClient['addEquipment']>, porDefecto: string): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.error.set(null);
    peticion.subscribe({
      next: (vista) => {
        this.ocupado.set(false);
        this.editando.set(null);
        this.vistaChange.emit(vista);
      },
      error: (error: unknown) => {
        this.ocupado.set(false);
        const cuerpo = error instanceof HttpErrorResponse ? (error.error as { message?: string } | null) : null;
        this.error.set(typeof cuerpo?.message === 'string' && cuerpo.message !== '' ? cuerpo.message : porDefecto);
      },
    });
  }
}
