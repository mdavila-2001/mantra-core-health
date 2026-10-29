import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { DISCHARGE_DISPOSITIONS, TRANSFER_REASONS } from '../../../core/data-access/adt/adt.catalog';
import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { adtErrorToViewState, readAdtError } from '../../../core/data-access/adt/adt.errors';
import { buildOverride, bedPathText, cellsOfBoard, justificationMissing } from '../../../core/data-access/adt/adt.logic';
import type {
  AdtViewer,
  BedBoardCell,
  BedCompatibility,
  CompatibilityViolation,
  InpatientRow,
  StayView,
} from '../../../core/data-access/adt/adt.types';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { AdtIssue } from '../shared/adt-issue';
import { BedPicker } from '../shared/bed-picker/bed-picker';
import { CompatPanel } from '../shared/compat-panel/compat-panel';
import { fechaYHora, textoDeCama } from '../shared/adt.view';

export type BedActionKind = 'assign' | 'reserve' | 'transfer' | 'swap' | 'discharge' | 'cancel';

/** Lo que el diálogo avisa al terminar bien: la frase con el resultado, para decir qué pasó de verdad. */
export interface BedActionDone {
  readonly kind: BedActionKind;
  readonly message: string;
  readonly encounterId: string | null;
}

const TITULOS: Readonly<Record<BedActionKind, string>> = {
  assign: 'Asignar cama',
  reserve: 'Reservar cama',
  transfer: 'Trasladar a otra cama',
  swap: 'Intercambiar camas',
  discharge: 'Dar de alta (egreso)',
  cancel: 'Cancelar movimiento',
};

/**
 * El diálogo de cada acción de cama: **asignar, reservar, trasladar,
 * intercambiar, egresar y cancelar**.
 *
 * ## Qué hace cada una y qué garantiza la API (no esta pantalla)
 *
 * - **Trasladar**: una transacción — cierra la cama de origen, abre la de destino,
 *   deja el origen sucio y crea la orden de limpieza. Todo o nada.
 * - **Intercambiar** (A17): dos pacientes, dos camas, una transacción. Las camas
 *   no quedan sucias porque no quedan libres.
 * - **Egreso**: cierra la ubicación y el encuentro y deja la cama sucia con su
 *   orden de limpieza (terminal si hubo aislamiento).
 * - **Forzar**: solo supervisión; exige justificación de 20 caracteres y deja un
 *   incidente. Las reglas bloqueantes nunca se fuerzan.
 *
 * El diálogo solo junta datos y los manda; si el servidor rechaza —cama tomada
 * por otra persona, permiso, versión vieja— lo dice acá sin perder lo escrito.
 */
@Component({
  selector: 'app-bed-action-dialog',
  imports: [Alert, AdtIssue, AppButton, BedPicker, CompatPanel, ContentDialog, DatePicker, FormField, NgTemplateOutlet, Select, Switch, Textarea],
  templateUrl: './bed-action-dialog.html',
  styleUrl: './bed-action-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedActionDialog {
  private readonly client = inject(AdtClient);
  private readonly dialogs = inject(DialogService);

  readonly kind = input.required<BedActionKind>();
  readonly siteId = input.required<string>();
  /** La internación en juego. `null` = se parte de una cama libre del tablero y se elige la persona. */
  readonly stay = input<StayView | null>(null);
  /** La cama de partida: la libre (asignar/reservar) o la ocupada (intercambiar). */
  readonly cell = input<BedBoardCell | null>(null);
  readonly viewer = input<AdtViewer | null>(null);
  /** El movimiento a cancelar. */
  readonly locationId = input<string | null>(null);
  readonly locationLabel = input('');

  readonly done = output<BedActionDone>();
  readonly closed = output<void>();

  protected readonly titulo = computed(() => TITULOS[this.kind()]);

  // ─ datos de apoyo
  protected readonly tablero = signal<ViewState<readonly BedBoardCell[]>>({ status: 'loading' });
  protected readonly pendientes = signal<readonly InpatientRow[]>([]);
  protected readonly stayElegido = signal<StayView | null>(null);
  protected readonly personaElegida = signal<string | null>(null);

  // ─ lo elegido
  protected readonly camaElegida = signal<BedBoardCell | null>(null);
  protected readonly compat = signal<BedCompatibility | null>(null);
  protected readonly comprobando = signal(false);
  protected readonly justificacion = signal<string | null>(null);
  protected readonly motivo = signal<string | null>('ADT_RSN_CLINICAL');
  protected readonly razon = signal('');
  protected readonly cuando = signal<Date | null>(new Date());
  protected readonly disposicion = signal<string | null>(null);
  protected readonly cerrarEpisodio = signal(true);

  protected readonly problema = signal<ViewState<unknown> | null>(null);
  protected readonly sinPermiso = signal<string | null>(null);
  protected readonly versionVieja = signal(false);
  protected readonly enviando = signal(false);

  protected readonly motivos = TRANSFER_REASONS.map((c) => ({ value: c.code, label: c.display }));
  protected readonly disposiciones = DISCHARGE_DISPOSITIONS.map((c) => ({ value: c.code, label: c.display }));
  protected readonly textoDeCama = textoDeCama;
  protected readonly fechaYHora = fechaYHora;
  protected readonly ahora = new Date();
  private consulta = 0;

  protected readonly estancia = computed(() => this.stay() ?? this.stayElegido());
  protected readonly encuentro = computed(() => this.estancia()?.encounter ?? null);
  protected readonly eligePersona = computed(() => (this.kind() === 'assign' || this.kind() === 'reserve') && this.stay() === null);
  /** La cama destino de asignar/reservar/trasladar. */
  protected readonly destino = computed(() => (this.kind() === 'assign' || this.kind() === 'reserve') && this.cell() !== null ? this.cell() : this.camaElegida());
  protected readonly puedeForzar = computed(() => this.viewer()?.canOverride === true);
  protected readonly falta = computed(() => justificationMissing(this.justificacion() ?? ''));

  protected readonly camas = computed(() => {
    const t = this.tablero();
    return t.status === 'ready' ? t.data : [];
  });

  protected readonly bloqueada = computed(() => (this.compat()?.violations ?? []).some((v) => v.severity === 'BLOCKING'));
  protected readonly hayForzables = computed(() => (this.compat()?.violations ?? []).some((v) => v.severity === 'OVERRIDABLE'));

  /** ¿Se puede confirmar? Solo una guía: el servidor vuelve a decidir. */
  protected readonly listo = computed(() => {
    if (this.enviando()) return false;
    switch (this.kind()) {
      case 'assign':
      case 'reserve':
        return this.encuentro() !== null && this.destino() !== null && !this.bloqueada() && (!this.hayForzables() || this.justificacion() !== null);
      case 'transfer':
        return this.destino() !== null && this.motivo() !== null && !this.bloqueada() && (!this.hayForzables() || this.justificacion() !== null);
      case 'swap':
        return this.camaElegida() !== null && this.razon().trim() !== '' && (this.compat() === null || !this.bloqueada()) && (!this.hayForzables() || this.justificacion() !== null);
      case 'discharge':
        return this.disposicion() !== null && this.cuando() !== null;
      case 'cancel':
        return this.razon().trim() !== '';
    }
  });

  constructor() {
    effect(() => {
      const kind = this.kind();
      const siteId = this.siteId();
      untracked(() => {
        if (kind === 'transfer' || kind === 'swap' || ((kind === 'assign' || kind === 'reserve') && this.cell() === null)) this.cargarTablero(siteId);
        if (this.eligePersona()) this.cargarPendientes(siteId);
      });
    });
  }

  private cargarTablero(siteId: string): void {
    this.client.getBedBoard(siteId).subscribe({
      next: (b) => this.tablero.set({ status: 'ready', data: cellsOfBoard(b) }),
      error: (e: unknown) => this.tablero.set(adtErrorToViewState(e)),
    });
  }

  private cargarPendientes(siteId: string): void {
    this.client.listInpatients(siteId).subscribe({
      next: (p) => this.pendientes.set(p.items.filter((f) => f.bed === null)),
      error: (e: unknown) => this.problema.set(adtErrorToViewState(e)),
    });
  }

  // ─ elecciones

  protected elegirPersona(encounterId: string): void {
    this.personaElegida.set(encounterId);
    this.stayElegido.set(null);
    this.reiniciarCompat();
    this.client.getStay(encounterId).subscribe({
      next: (s) => {
        this.stayElegido.set(s);
        this.comprobar();
      },
      error: (e: unknown) => this.problema.set(adtErrorToViewState(e)),
    });
  }

  protected elegirCama(c: BedBoardCell): void {
    this.camaElegida.set(c);
    this.reiniciarCompat();
    this.comprobar();
  }

  private reiniciarCompat(): void {
    this.compat.set(null);
    this.justificacion.set(null);
    this.comprobando.set(false);
    this.problema.set(null);
    this.consulta += 1;
  }

  /** Vista previa con el endpoint contratado: necesita encuentro y cama (no aplica al intercambio). */
  private comprobar(): void {
    const e = this.encuentro();
    const d = this.destino();
    if (e === null || d === null || this.kind() === 'swap' || this.kind() === 'discharge' || this.kind() === 'cancel') return;
    const mia = ++this.consulta;
    this.comprobando.set(true);
    this.client.checkCompatibility(e.id, d.id).subscribe({
      next: (r) => {
        if (mia !== this.consulta) return;
        this.comprobando.set(false);
        this.compat.set(r);
      },
      error: (err: unknown) => {
        if (mia !== this.consulta) return;
        this.comprobando.set(false);
        this.problema.set(adtErrorToViewState(err));
      },
    });
  }

  protected async forzar(): Promise<void> {
    const texto = await this.dialogs.confirmWithReason(
      {
        title: 'Forzar la compatibilidad',
        message: 'Si la fuerza, queda un incidente de ubicación abierto que supervisión debe revisar.',
        confirmLabel: 'Forzar y registrar incidente',
      },
      { label: 'Justificación clínica', hint: 'Al menos 20 caracteres, sin contar los espacios de los bordes.', minLength: 20, maxLength: 500 },
    );
    if (texto !== null) this.justificacion.set(texto);
  }

  // ─ envío

  protected confirmar(): void {
    if (!this.listo()) return;
    this.enviando.set(true);
    this.problema.set(null);
    this.sinPermiso.set(null);
    this.versionVieja.set(false);
    const violaciones: readonly CompatibilityViolation[] = this.compat()?.violations ?? [];
    const justif = this.justificacion();
    const override = justif === null ? {} : { override: buildOverride(violaciones, justif) };
    const e = this.encuentro();
    const fin = (r: { encounterId: string | null; message: string }): void => {
      this.enviando.set(false);
      this.done.emit({ kind: this.kind(), message: r.message, encounterId: r.encounterId });
    };
    const falla = (err: unknown): void => {
      this.enviando.set(false);
      const estado = adtErrorToViewState<unknown>(err);
      const d = readAdtError(err);
      if (estado.status === 'forbidden') {
        this.sinPermiso.set(`Su asignación no permite esta acción sobre la cama. ${d?.requiredRoles.length ? `Roles que la permiten: ${d.requiredRoles.join(', ')}. ` : ''}La decisión es del servidor.${d?.requestId ? ` Código de soporte ${d.requestId}.` : ''}`);
        return;
      }
      if (d?.status === 412) this.versionVieja.set(true);
      // Una incompatibilidad que la vista previa no vio (intercambio, o una vista previa que no existe).
      if (d !== null && d.violations.length > 0) {
        this.compat.set({ assignable: false, violations: d.violations });
        this.justificacion.set(null);
      }
      this.problema.set(estado);
    };

    switch (this.kind()) {
      case 'assign':
      case 'reserve': {
        const dest = this.destino();
        if (e === null || dest === null) return;
        this.client.assignBed(e.id, e.rowVersion, { careSpaceId: dest.id, mode: this.kind() === 'assign' ? 'ASSIGN' : 'RESERVE', ...override }).subscribe({
          next: (r) => fin({ encounterId: e.id, message: `${this.kind() === 'assign' ? 'Cama asignada' : 'Cama reservada'}: ${r.cell.code} para ${e.patient.name}.${r.incidentId ? ' Quedó un incidente de ubicación abierto.' : ''}` }),
          error: falla,
        });
        break;
      }
      case 'transfer': {
        const dest = this.destino();
        const motivo = this.motivo();
        if (e === null || dest === null || motivo === null) return;
        const origen = this.estancia()?.currentBed;
        const cuando = this.cuando();
        this.client
          .transfer(e.id, e.rowVersion, {
            toCareSpaceId: dest.id,
            reasonCode: motivo,
            ...(cuando === null || Math.abs(Date.now() - cuando.getTime()) < 120_000 ? {} : { occurredAt: cuando.toISOString() }),
            ...override,
          })
          .subscribe({
            next: (r) => fin({ encounterId: e.id, message: `Trasladado a la cama ${dest.code}. La cama ${origen?.code ?? 'de origen'} quedó sucia y se generó la orden de limpieza ${r.cleaningOrderId.slice(0, 8)}.` }),
            error: falla,
          });
        break;
      }
      case 'swap': {
        const otra = this.camaElegida();
        const propio = e?.id ?? this.cell()?.occupancy.encounterId ?? null;
        const ajeno = otra?.occupancy.encounterId ?? null;
        if (propio === null || ajeno === null || otra === null) return;
        this.client.swap({ encounterAId: propio, encounterBId: ajeno, reasonText: this.razon().trim(), ...override }).subscribe({
          next: () => fin({ encounterId: propio, message: `Camas intercambiadas con ${otra.code}. Ninguna quedó libre, así que no se generó orden de limpieza.` }),
          error: falla,
        });
        break;
      }
      case 'discharge': {
        const disp = this.disposicion();
        const cuando = this.cuando();
        if (e === null || disp === null || cuando === null) return;
        const bed = this.estancia()?.currentBed;
        this.client
          .discharge(e.id, e.rowVersion, { dischargeDispositionCode: disp, occurredAt: cuando.toISOString(), closeEpisode: this.cerrarEpisodio(), ...(this.razon().trim() === '' ? {} : { reasonText: this.razon().trim() }) })
          .subscribe({
            next: (r) =>
              fin({
                encounterId: e.id,
                message:
                  r.cleaningOrderId === null
                    ? `Egreso registrado. Como no tenía cama, no hay nada que limpiar.`
                    : `Egreso registrado. La cama ${bed?.code ?? ''} quedó sucia y se generó la orden de limpieza ${r.cleaningOrderId.slice(0, 8)}.`,
              }),
            error: falla,
          });
        break;
      }
      case 'cancel': {
        const id = this.locationId();
        if (id === null) return;
        this.client.cancelLocation(id, { reasonText: this.razon().trim() }).subscribe({
          next: () => fin({ encounterId: e?.id ?? null, message: `${this.locationLabel() || 'El movimiento'} se canceló.` }),
          error: falla,
        });
        break;
      }
    }
  }

  protected readonly bedPathText = bedPathText;
}
