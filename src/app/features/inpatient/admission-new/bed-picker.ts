import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { RULE_LABEL } from '../../../core/data-access/adt/bed-compatibility';
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
import { BED_BOARD_ROUTE, CLEANING_ROUTE, cellToTile } from '../inpatient-presentation';

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
        @if (compat(); as k) {
          @if (k.violations.length === 0) {
            <app-alert tone="success" title="Cama compatible" data-testid="bed-compatible">Cumple sexo, edad, aislamiento y nivel de cuidado.</app-alert>
          }
          @for (v of k.violations; track v.rule) {
            <app-alert [tone]="v.severity === 'BLOCKING' ? 'error' : 'warning'" [title]="ruleLabel[v.rule] + (v.severity === 'BLOCKING' ? ' · no se puede forzar' : ' · se puede forzar con justificación')" data-testid="bed-violation">{{ v.detail }}</app-alert>
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
  readonly mode = model<BedMode>('ASSIGN');
  readonly bedId = model<string | null>(null);
  readonly override = model<PlacementOverride | null>(null);
  /** El código de la cama elegida, para el resumen. */
  readonly bedCode = model<string | null>(null);
  /** `true` cuando la elección permite confirmar (o no se eligió cama). */
  readonly validity = output<boolean>();

  protected readonly modes = MODES;
  protected readonly ruleLabel = RULE_LABEL;
  protected readonly compat = signal<BedCompatibility | null>(null);
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

  protected readonly tile = (c: BedBoardCell) => cellToTile(c);
  protected readonly boardRoute = BED_BOARD_ROUTE;

  constructor() {
    effect(() => {
      this.siteId();
      untracked(() => this.load());
    });
    // Con otro paciente, nivel o aislamiento la compatibilidad cambia: se vuelve a preguntar.
    effect(() => {
      const bed = this.bedId();
      const pac = this.patientProfileId();
      const nivel = this.levelOfCareCode();
      const iso = this.isolationCode();
      const org = this.organism();
      untracked(() => this.check(bed, pac, nivel, iso, org));
    });
    effect(() => {
      const modo = this.mode();
      const ok = modo === 'NONE' || (this.bedId() !== null && this.compat() !== null && (this.compat()!.violations.length === 0 || (this.overridable() && this.override() !== null)));
      untracked(() => this.validity.emit(ok));
    });
  }

  protected load(): void {
    this.cells.set(loading());
    this.ops.getBedBoard(this.siteId()).subscribe({
      next: (b) => {
        const todas = b.units.flatMap((u) => u.cells);
        this.cells.set(ready(todas));
        this.bedCode.set(todas.find((c) => c.id === this.bedId())?.code ?? null);
      },
      error: (e: unknown) => this.cells.set(errorToViewState<readonly BedBoardCell[]>(e)),
    });
  }

  protected choose(id: string): void {
    this.override.set(null);
    this.bedId.set(id);
    this.bedCode.set(this.assignable().find((c) => c.id === id)?.code ?? null);
  }

  protected async force(): Promise<void> {
    const v = this.compat()?.violations ?? [];
    const o = await askOverride(this.dialogs, v);
    if (o !== null) this.override.set(o);
  }

  private check(bed: string | null, patient: string | null, level: LevelOfCareCode | null, iso: string | null, organism: string | null): void {
    this.compat.set(null);
    if (bed === null || patient === null) return;
    this.adt
      .checkProspectiveCompatibility({
        careSpaceId: bed,
        patientProfileId: patient,
        levelOfCareCode: level ?? 'LOC_CARE_GENERAL',
        ...(iso ? { isolationPrecautionCode: iso } : {}),
        ...(organism ? { isolationOrganismText: organism } : {}),
      })
      .subscribe({ next: (c) => this.compat.set(c), error: () => this.compat.set(null) });
  }
}
