import type { Observable } from 'rxjs';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { BedCompatibility, PlacementOverride } from '../../../core/data-access/adt/adt.types';
import { RULE_LABEL } from '../../../core/data-access/adt/bed-compatibility';
import type { BedBoardCell } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { apiReason } from '../api-reason';
import { askOverride, violationsOf } from './placement-override';

const TRANSFER_REASONS: SelectOption<string>[] = [
  { value: 'TRF_CLINICAL', label: 'Indicación clínica' },
  { value: 'TRF_ISOLATION', label: 'Aislamiento' },
  { value: 'TRF_LEVEL_OF_CARE', label: 'Cambio de nivel de cuidado' },
  { value: 'TRF_PATIENT_REQUEST', label: 'Pedido del paciente' },
  { value: 'TRF_BED_MANAGEMENT', label: 'Gestión de camas' },
];

/**
 * Traslado (A02) o intercambio (A17), los dos atómicos en la API.
 *
 * El traslado sólo ofrece camas **asignables** y consulta la compatibilidad al
 * elegir; el intercambio sólo camas **ocupadas**. Si la API pide forzar
 * (422 `BED_COMPATIBILITY_OVERRIDE_REQUIRED`), se ofrece la justificación; si
 * la regla es bloqueante (409), no hay salida.
 */
@Component({
  selector: 'app-move-dialog',
  imports: [Alert, AppButton, ContentDialog, FormField, Select, Textarea, ViewStateHost],
  template: `
    <app-content-dialog
      [heading]="mode() === 'transfer' ? 'Trasladar al paciente' : 'Intercambiar camas'"
      [description]="mode() === 'transfer' ? 'Desde la cama ' + cell().code + '. La cama de origen queda sucia con su orden de limpieza.' : 'La cama ' + cell().code + ' y la elegida intercambian pacientes en una sola operación.'"
      [dismissible]="!sending()"
      (closed)="closed.emit()"
    >
      @if (failure(); as f) {
        <app-view-state-host [state]="f" />
      }
      @if (options().length === 0) {
        <app-alert tone="info" title="No hay camas para elegir" data-testid="move-no-beds">
          {{ mode() === 'transfer' ? 'No hay camas asignables en este establecimiento. Revise la cola de limpieza: una cama inspeccionada vuelve a estar disponible.' : 'No hay otra cama ocupada con la que intercambiar.' }}
        </app-alert>
      } @else {
        <form class="move-dialog" id="move-dialog-form" (submit)="$event.preventDefault(); submit()">
          <app-form-field [label]="mode() === 'transfer' ? 'Cama de destino' : 'Cama con la que intercambia'" [required]="true">
            <app-select [(value)]="target" [options]="options()" placeholder="Elija una cama" data-testid="move-target" />
          </app-form-field>
          @if (mode() === 'transfer') {
            <app-form-field label="Motivo del traslado" [required]="true">
              <app-select [(value)]="reasonCode" [options]="reasons" data-testid="move-reason" />
            </app-form-field>
          } @else {
            <app-form-field label="Motivo del intercambio" [required]="true" [errorMessage]="tried() && !reasonText().trim() ? 'Indique el motivo.' : ''">
              <app-textarea [(value)]="reasonText" [rows]="2" data-testid="move-reason-text" />
            </app-form-field>
          }
          @if (compat(); as c) {
            @if (c.violations.length === 0) {
              <app-alert tone="success" title="Cama compatible" data-testid="move-compatible">Cumple todas las reglas de ubicación.</app-alert>
            } @else {
              @for (v of c.violations; track v.rule) {
                <app-alert [tone]="v.severity === 'BLOCKING' ? 'error' : 'warning'" [title]="ruleLabel[v.rule]" data-testid="move-violation">{{ v.detail }}</app-alert>
              }
            }
          }
          @if (override(); as o) {
            <app-alert tone="warning" title="Se va a forzar con justificación" data-testid="move-override">«{{ o.justification }}»</app-alert>
          }
        </form>
      }
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="sending()" (clicked)="closed.emit()">Cancelar</button>
        @if (options().length > 0) {
          <button app-button type="submit" form="move-dialog-form" [disabled]="sending() || !target() || blocking()" data-testid="move-submit">
            {{ mode() === 'transfer' ? 'Trasladar' : 'Intercambiar' }}
          </button>
        }
      </div>
    </app-content-dialog>
  `,
  styles: `.move-dialog { display: grid; gap: var(--sp-4); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoveDialog {
  private readonly adt = inject(AdtClient);
  private readonly dialogs = inject(DialogService);

  readonly mode = input.required<'transfer' | 'swap'>();
  readonly cell = input.required<BedBoardCell>();
  readonly beds = input.required<readonly BedBoardCell[]>();
  readonly encounterId = input.required<string>();
  readonly rowVersion = input.required<number>();
  readonly canOverride = input(false);
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected readonly reasons = TRANSFER_REASONS;
  protected readonly ruleLabel = RULE_LABEL;
  protected readonly target = signal<string | null>(null);
  protected readonly reasonCode = signal<string | null>('TRF_CLINICAL');
  protected readonly reasonText = signal('');
  protected readonly tried = signal(false);
  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly compat = signal<BedCompatibility | null>(null);
  protected readonly override = signal<PlacementOverride | null>(null);

  protected readonly options = computed<SelectOption<string>[]>(() =>
    this.beds()
      .filter((b) => b.id !== this.cell().id && (this.mode() === 'transfer' ? b.assignable : b.occupancy.code === 'OCC_OCCUPIED' && b.occupancy.encounterId !== undefined))
      .map((b) => ({ value: b.id, label: `${b.code} · ${b.path.at(-2)?.name ?? b.name}`, ...(b.occupancy.patient ? { description: b.occupancy.patient.initials } : {}) })),
  );

  protected readonly blocking = computed(() => this.compat()?.violations.some((v) => v.severity === 'BLOCKING') ?? false);

  constructor() {
    effect(() => {
      const id = this.target();
      untracked(() => this.check(id));
    });
  }

  private check(id: string | null): void {
    this.compat.set(null);
    this.override.set(null);
    if (id === null || this.mode() !== 'transfer') return;
    this.adt.checkCompatibility(this.encounterId(), id).subscribe({
      next: (c) => this.compat.set(c),
      error: (e: unknown) => this.failure.set(errorToViewState<never>(e)),
    });
  }

  protected async submit(): Promise<void> {
    this.tried.set(true);
    const destino = this.target();
    if (destino === null) return;
    if (this.mode() === 'swap' && !this.reasonText().trim()) return;
    const c = this.compat();
    if (this.mode() === 'transfer' && c !== null && c.violations.length > 0 && this.override() === null) {
      const o = this.canOverride() ? await askOverride(this.dialogs, c.violations) : null;
      if (o === null) {
        if (!this.canOverride()) this.failure.set({ status: 'forbidden', message: 'Forzar la compatibilidad exige el rol de supervisión de enfermería.' });
        return;
      }
      this.override.set(o);
    }
    this.send(destino);
  }

  private send(destino: string): void {
    const override = this.override() ?? undefined;
    this.sending.set(true);
    this.failure.set(null);
    const call: Observable<{ readonly requestId: string }> =
      this.mode() === 'transfer'
        ? this.adt.transfer(this.encounterId(), this.rowVersion(), { toCareSpaceId: destino, reasonCode: this.reasonCode() ?? 'TRF_CLINICAL', ...(override ? { override } : {}) })
        : this.adt.swap({
            encounterAId: this.encounterId(),
            encounterBId: this.beds().find((b) => b.id === destino)!.occupancy.encounterId!,
            reasonText: this.reasonText().trim(),
            ...(override ? { override } : {}),
          });
    call.subscribe({
      next: (r) => {
        this.sending.set(false);
        this.saved.emit(r.requestId);
      },
      error: async (e: unknown) => {
        this.sending.set(false);
        const r = apiReason(e);
        if (r?.reason === 'BED_COMPATIBILITY_OVERRIDE_REQUIRED' && this.override() === null) {
          const v = violationsOf(r.details);
          this.compat.set({ assignable: false, violations: v });
          if (this.canOverride()) {
            const o = await askOverride(this.dialogs, v);
            if (o !== null) {
              this.override.set(o);
              this.send(destino);
            }
            return;
          }
        }
        if (r?.reason === 'BED_NOT_ASSIGNABLE') this.compat.set({ assignable: false, violations: violationsOf(r.details) });
        this.failure.set(errorToViewState<never>(e));
      },
    });
  }
}
