import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { ruleLabel } from '../../../core/data-access/adt/bed-compatibility';
import type { BedCompatibility, LevelOfCareCode, PlacementOverride } from '../../../core/data-access/adt/adt.types';
import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { BedBoardCell } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { BedTile } from '../../../shared/components/molecules/bed-tile/bed-tile';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { askOverride } from '../bed-actions/placement-override';
import { BED_BOARD_ROUTE, CLEANING_ROUTE, DEFAULT_TIME_ZONE, cellToTile } from '../inpatient-presentation';

export type BedMode = 'ASSIGN' | 'RESERVE' | 'NONE';

const MODES: readonly SegmentedOption<BedMode>[] = [
  { value: 'ASSIGN', label: 'Asignar ahora' },
  { value: 'RESERVE', label: 'Reservar' },
  { value: 'NONE', label: 'Sin cama por ahora' },
];

/**
 * El paso **Cama** del ingreso (F3.4): un mini tablero con las camas
 * asignables y, al elegir, la compatibilidad en vivo. Bloqueantes en rojo y sin
 * salida; forzables en ámbar con «Forzar con justificación» (sólo si la API le
 * da a la persona `adt.override`). La API vuelve a validar al confirmar.
 */
@Component({
  selector: 'app-bed-picker',
  imports: [Alert, AppButton, BedTile, SegmentedControl, ViewStateHost],
  template: `
    <div class="bed-picker" data-testid="bed-picker">
      <app-segmented-control [options]="modes" [value]="mode()" ariaLabel="Cama del ingreso" (valueChange)="mode.set($event)" />
      @if (mode() !== 'NONE') {
        <app-view-state-host [state]="beds()" (retry)="load()">
          <ul class="bed-picker__grid">
            @for (c of assignable(); track c.id) {
              <li><app-bed-tile [bed]="tile(c)" [selected]="bedId() === c.id" (activated)="choose(c.id)" /></li>
            }
          </ul>
        </app-view-state-host>
        @if (compatState(); as st) {
          <app-view-state-host [state]="st" data-testid="bed-compat-state" (retry)="recheck()" />
        }
        @if (compat(); as k) {
          @if (k.violations.length === 0) {
            <app-alert tone="success" title="Cama compatible" data-testid="bed-compatible">Cumple sexo, edad, aislamiento y nivel de cuidado.</app-alert>
          }
          @for (v of k.violations; track v.rule) {
            <app-alert [tone]="v.severity === 'BLOCKING' ? 'error' : 'warning'" [title]="ruleLabel(v.rule) + (v.severity === 'BLOCKING' ? ' · no se puede forzar' : ' · se puede forzar con justificación')" data-testid="bed-violation">{{ v.detail }}</app-alert>
          }
          @if (overridable() && override() === null) {
            @if (canOverride()) {
              <button app-button class="bed-picker__force" variant="danger" size="sm" type="button" data-testid="bed-force" (clicked)="force()">Forzar con justificación</button>
            } @else {
              <p class="bed-picker__note" data-testid="bed-force-unavailable">Forzar la compatibilidad lo puede hacer supervisión de enfermería. Elija otra cama o pídaselo.</p>
            }
          }
          @if (override(); as o) {
            <app-alert tone="warning" title="Se fuerza con justificación (queda un incidente)" data-testid="bed-override">«{{ o.justification }}»</app-alert>
          }
        }
      } @else {
        <p class="bed-picker__note">La internación queda «pendiente de cama»: se asigna después desde el tablero.</p>
      }
    </div>
  `,
  styles: `
    .bed-picker { display: grid; gap: var(--sp-3); }
    .bed-picker__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--sp-3); margin: 0; padding: 0; list-style: none; }
    .bed-picker__force { justify-self: start; }
    .bed-picker__note { margin: 0; color: var(--text-secondary); font-size: var(--fs-caption); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedPicker {
  private readonly ops = inject(InfrastructureOpsClient);
  private readonly adt = inject(AdtClient);
  private readonly dialogs = inject(DialogService);

  readonly siteId = input.required<string>();
  readonly patientProfileId = input<string | null>(null);
  readonly levelOfCareCode = input<LevelOfCareCode | null>(null);
  readonly isolationCode = input<string | null>(null);
  readonly organism = input<string | null>(null);
  readonly canOverride = input(false);
  readonly timeZone = input(DEFAULT_TIME_ZONE);
  readonly mode = model<BedMode>('ASSIGN');
  readonly bedId = model<string | null>(null);
  readonly override = model<PlacementOverride | null>(null);
  /** El código de la cama elegida, para el resumen. */
  readonly bedCode = model<string | null>(null);
  /** `true` cuando la elección permite confirmar (o no se eligió cama). */
  readonly validity = output<boolean>();

  protected readonly modes = MODES;
  protected readonly ruleLabel = ruleLabel;
  private readonly checks = signal(0);
  private readonly boardReloads = signal(0);
  /** La consulta vigente: la clave de las entradas y su estado (H3). */
  private readonly lastCheck = signal<{ readonly key: string; readonly state: ViewState<BedCompatibility> } | null>(null);
  /** Las entradas de la compatibilidad, en una clave: cambiar cualquiera invalida la anterior. */
  private readonly inputsKey = computed(() =>
    JSON.stringify([this.bedId(), this.patientProfileId(), this.levelOfCareCode(), this.isolationCode(), this.organism()]),
  );
  private readonly current = computed(() => {
    const c = this.lastCheck();
    return c !== null && c.key === this.inputsKey() ? c.state : null;
  });
  protected readonly compat = computed<BedCompatibility | null>(() => {
    const s = this.current();
    return s?.status === 'ready' ? s.data : null;
  });
  /** Consultando (S2) o el error de la consulta (S9 con `requestId`); con respuesta, `null`. */
  protected readonly compatState = computed<ViewState<BedCompatibility> | null>(() => {
    const s = this.current();
    if (this.bedId() === null || this.patientProfileId() === null) return null;
    if (s === null) return loading();
    return s.status === 'ready' ? null : s;
  });
  private readonly cells = signal<ViewState<readonly BedBoardCell[]>>(loading());

  protected readonly assignable = computed(() => {
    const s = this.cells();
    return s.status === 'ready' ? s.data.filter((c) => c.assignable) : [];
  });

  protected readonly beds = computed<ViewState<readonly BedBoardCell[]>>(() => {
    const s = this.cells();
    if (s.status === 'ready' && this.assignable().length === 0) {
      return empty({ label: 'Ver camas en limpieza', route: CLEANING_ROUTE, queryParams: { site: this.siteId() } }, 'No hay camas asignables ahora. Puede ingresar sin cama y asignarla desde el tablero, o mirar las que están en limpieza.');
    }
    return s;
  });

  protected readonly overridable = computed(() => {
    const v = this.compat()?.violations ?? [];
    return v.length > 0 && v.every((x) => x.severity === 'OVERRIDABLE');
  });

  protected readonly tile = (c: BedBoardCell) => cellToTile(c, Date.now(), this.timeZone());
  protected readonly boardRoute = BED_BOARD_ROUTE;

  constructor() {
    toObservable(computed(() => ({ site: this.siteId(), n: this.boardReloads() })))
      .pipe(
        switchMap(({ site }) =>
          this.ops.getBedBoard(site).pipe(
            map((b) => ready(b.units.flatMap((u) => u.cells)) as ViewState<readonly BedBoardCell[]>),
            catchError((e: unknown) => of(errorToViewState<readonly BedBoardCell[]>(e))),
            startWith(loading() as ViewState<readonly BedBoardCell[]>),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => {
        this.cells.set(s);
        if (s.status === 'ready') this.bedCode.set(s.data.find((c) => c.id === this.bedId())?.code ?? null);
      });
    // H3: cualquier entrada que cambia descarta el forzado (era para otra combinación)…
    effect(() => {
      this.inputsKey();
      untracked(() => this.override.set(null));
    });
    // …y vuelve a preguntar, con espera y cancelando la consulta anterior.
    toObservable(computed(() => ({ key: this.inputsKey(), n: this.checks() })))
      .pipe(
        debounceTime(300),
        distinctUntilChanged((a, b) => a.key === b.key && a.n === b.n),
        switchMap(({ key }) => {
          const [bed, patient, level, iso, organism] = JSON.parse(key) as (string | null)[];
          if (bed === null || bed === undefined || patient === null || patient === undefined) return of(null);
          return this.adt
            .checkProspectiveCompatibility({
              careSpaceId: bed,
              patientProfileId: patient,
              levelOfCareCode: (level ?? 'LOC_CARE_GENERAL') as LevelOfCareCode,
              ...(iso ? { isolationPrecautionCode: iso } : {}),
              ...(organism ? { isolationOrganismText: organism } : {}),
            })
            .pipe(
              map((c) => ({ key, state: ready(c) as ViewState<BedCompatibility> })),
              catchError((e: unknown) => of({ key, state: errorToViewState<BedCompatibility>(e) })),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((r) => this.lastCheck.set(r));
    effect(() => {
      const modo = this.mode();
      const ok = modo === 'NONE' || (this.bedId() !== null && this.compat() !== null && (this.compat()!.violations.length === 0 || (this.overridable() && this.override() !== null)));
      untracked(() => this.validity.emit(ok));
    });
  }

  protected load(): void {
    this.boardReloads.update((n) => n + 1);
  }

  protected choose(id: string): void {
    this.bedId.set(id);
    this.bedCode.set(this.assignable().find((c) => c.id === id)?.code ?? null);
  }

  protected async force(): Promise<void> {
    const key = this.inputsKey();
    const v = this.compat()?.violations ?? [];
    const o = await askOverride(this.dialogs, v);
    // Si mientras justificaba cambió la cama o el paciente, el forzado ya no corresponde.
    if (o !== null && key === this.inputsKey()) this.override.set(o);
  }

  protected recheck(): void {
    this.checks.update((n) => n + 1);
  }
}
