import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, map, of, switchMap, type Observable } from 'rxjs';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { AdtResult, BedCompatibility, PlacementOverride } from '../../../core/data-access/adt/adt.types';
import { ruleLabel } from '../../../core/data-access/adt/bed-compatibility';
import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { BedBoardCell } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
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

/** Compatibilidad: nada pedido, consultando, respuesta o error (S9 con `requestId`). */
type Compat = { readonly bed: string; readonly state: ViewState<BedCompatibility> } | null;

/**
 * Traslado (A02) o intercambio (A17), los dos atómicos en la API.
 *
 * ## Destinos pedidos aparte (M9)
 *
 * Los destinos no salen del tablero que se estaba mirando (que puede tener
 * filtros o estar atrasado): el diálogo pide el tablero **completo** de la
 * sede al abrirse. El traslado ofrece sólo camas **asignables**; el
 * intercambio, sólo camas **ocupadas** con un encuentro visible.
 *
 * ## Compatibilidad en vivo
 *
 * Al elegir destino se consulta con `debounceTime` y la consulta anterior se
 * cancela (`switchMap`). Un error se muestra como S9 con su `requestId`; el
 * forzado se descarta al cambiar de cama. Si la API pide forzar (422
 * `BED_COMPATIBILITY_OVERRIDE_REQUIRED`), se ofrece la justificación; si la
 * regla es bloqueante (409), no hay salida.
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
        <app-view-state-host [state]="f" data-testid="move-failure" />
      }
      <app-view-state-host [state]="targets()" (retry)="reloadTargets()">
        @if (options().length === 0) {
          <app-alert tone="info" title="No hay camas para elegir" data-testid="move-no-beds">
            {{ mode() === 'transfer' ? 'No hay camas asignables en este establecimiento. Revise la cola de limpieza: una cama inspeccionada vuelve a estar disponible.' : 'No hay otra cama ocupada con la que intercambiar.' }}
          </app-alert>
        } @else {
          <form class="move-dialog" id="move-dialog-form" (submit)="$event.preventDefault(); submit()">
            <app-form-field [label]="mode() === 'transfer' ? 'Cama de destino' : 'Cama con la que intercambia'" [required]="true">
              <app-select [value]="target()" (valueChange)="pick($event)" [options]="options()" placeholder="Elija una cama" data-testid="move-target" />
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
            @if (compatState(); as k) {
              <app-view-state-host [state]="k" data-testid="move-compat-state">
                @if (compatData(); as c) {
                  @if (c.violations.length === 0) {
                    <app-alert tone="success" title="Cama compatible" data-testid="move-compatible">Cumple todas las reglas de ubicación.</app-alert>
                  } @else {
                    @for (v of c.violations; track v.rule) {
                      <app-alert [tone]="v.severity === 'BLOCKING' ? 'error' : 'warning'" [title]="label(v.rule)" data-testid="move-violation">{{ v.detail }}</app-alert>
                    }
                  }
                }
              </app-view-state-host>
            }
            @if (override(); as o) {
              <app-alert tone="warning" title="Se va a forzar con justificación" data-testid="move-override">«{{ o.justification }}»</app-alert>
            }
          </form>
        }
      </app-view-state-host>
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="sending()" (clicked)="closed.emit()">Cancelar</button>
        @if (options().length > 0) {
          <button app-button type="submit" form="move-dialog-form" [disabled]="sending() || !target() || blocking() || checking()" data-testid="move-submit">
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
  private readonly ops = inject(InfrastructureOpsClient);
  private readonly dialogs = inject(DialogService);

  readonly mode = input.required<'transfer' | 'swap'>();
  readonly cell = input.required<BedBoardCell>();
  readonly siteId = input.required<string>();
  readonly encounterId = input.required<string>();
  readonly rowVersion = input.required<number>();
  readonly canOverride = input(false);
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected readonly reasons = TRANSFER_REASONS;
  protected readonly label = ruleLabel;
  protected readonly target = signal<string | null>(null);
  protected readonly reasonCode = signal<string | null>('TRF_CLINICAL');
  protected readonly reasonText = signal('');
  protected readonly tried = signal(false);
  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);
  private readonly compat = signal<Compat>(null);
  protected readonly override = signal<PlacementOverride | null>(null);
  private readonly targetReloads = signal(0);
  protected readonly targets = signal<ViewState<readonly BedBoardCell[]>>(loading());

  protected readonly options = computed<SelectOption<string>[]>(() => {
    const t = this.targets();
    const beds = t.status === 'ready' ? t.data : [];
    return beds
      .filter((b) => b.id !== this.cell().id && (this.mode() === 'transfer' ? b.assignable : b.occupancy.code === 'OCC_OCCUPIED' && !!b.occupancy.encounterId))
      .map((b) => ({ value: b.id, label: `${b.code} · ${b.path.at(-1)?.name ?? b.name}`, ...(b.occupancy.patient ? { description: b.occupancy.patient.initials } : {}) }));
  });

  /** Sólo la compatibilidad de la cama elegida ahora. */
  protected readonly compatState = computed(() => {
    const c = this.compat();
    return c !== null && c.bed === this.target() ? c.state : null;
  });
  protected readonly compatData = computed(() => {
    const s = this.compatState();
    return s?.status === 'ready' ? s.data : null;
  });
  protected readonly checking = computed(() => this.mode() === 'transfer' && this.target() !== null && this.compatState()?.status !== 'ready');
  protected readonly blocking = computed(() => this.compatData()?.violations.some((v) => v.severity === 'BLOCKING') ?? false);

  constructor() {
    toObservable(computed(() => ({ site: this.siteId(), n: this.targetReloads() })))
      .pipe(
        switchMap(({ site }) =>
          this.ops.getBedBoard(site).pipe(
            map((b) => ready(b.units.flatMap((u) => u.cells)) as ViewState<readonly BedBoardCell[]>),
            catchError((e: unknown) => of(errorToViewState<readonly BedBoardCell[]>(e))),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.targets.set(s));

    toObservable(this.target)
      .pipe(
        debounceTime(250),
        switchMap((bed) =>
          bed === null || this.mode() !== 'transfer'
            ? of(null)
            : this.adt.checkCompatibility(this.encounterId(), bed).pipe(
                map((c) => ({ bed, state: ready(c) as ViewState<BedCompatibility> })),
                catchError((e: unknown) => of({ bed, state: errorToViewState<BedCompatibility>(e) })),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((c) => this.compat.set(c));
  }

  protected reloadTargets(): void {
    this.targetReloads.update((n) => n + 1);
  }

  /** Otra cama: lo consultado y lo forzado eran de la anterior. */
  protected pick(id: string | null): void {
    this.override.set(null);
    this.failure.set(null);
    if (id !== null && this.mode() === 'transfer') this.compat.set({ bed: id, state: loading() });
    this.target.set(id);
  }

  protected async submit(): Promise<void> {
    this.tried.set(true);
    const destino = this.target();
    if (destino === null) return;
    if (this.mode() === 'swap' && !this.reasonText().trim()) return;
    const c = this.compatData();
    if (this.mode() === 'transfer' && c !== null && c.violations.length > 0 && this.override() === null) {
      const o = this.canOverride() ? await askOverride(this.dialogs, c.violations) : null;
      if (o === null) {
        if (!this.canOverride()) this.failure.set({ status: 'forbidden', message: 'Forzar la compatibilidad exige el rol de supervisión de enfermería.' });
        return;
      }
      if (this.target() !== destino) return;
      this.override.set(o);
    }
    this.send(destino);
  }

  private send(destino: string): void {
    const override = this.override() ?? undefined;
    this.sending.set(true);
    this.failure.set(null);
    const otro = this.targets().status === 'ready' ? (this.targets() as { data: readonly BedBoardCell[] }).data.find((b) => b.id === destino) : undefined;
    const call: Observable<AdtResult> =
      this.mode() === 'transfer'
        ? this.adt.transfer(this.encounterId(), this.rowVersion(), { toCareSpaceId: destino, reasonCode: this.reasonCode() ?? 'TRF_CLINICAL', ...(override ? { override } : {}) })
        : this.adt.swap({ encounterAId: this.encounterId(), encounterBId: otro?.occupancy.encounterId ?? '', reasonText: this.reasonText().trim(), ...(override ? { override } : {}) });
    call.subscribe({
      next: (r) => {
        this.sending.set(false);
        this.saved.emit(r.requestId ?? '');
      },
      error: async (e: unknown) => {
        this.sending.set(false);
        const r = apiReason(e);
        if (r?.reason === 'BED_COMPATIBILITY_OVERRIDE_REQUIRED' && this.override() === null) {
          const v = violationsOf(r.details);
          this.compat.set({ bed: destino, state: ready({ assignable: false, rules: [], violations: v }) });
          if (this.canOverride()) {
            const o = await askOverride(this.dialogs, v);
            if (o !== null && this.target() === destino) {
              this.override.set(o);
              this.send(destino);
            }
            return;
          }
        }
        if (r?.reason === 'BED_NOT_ASSIGNABLE') this.compat.set({ bed: destino, state: ready({ assignable: false, rules: [], violations: violationsOf(r.details) }) });
        this.failure.set(errorToViewState<never>(e));
      },
    });
  }
}
