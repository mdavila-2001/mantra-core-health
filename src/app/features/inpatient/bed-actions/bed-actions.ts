import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { BedBoardCell } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ADMISSION_NEW_ROUTE, stayRoute } from '../inpatient-presentation';
import { DischargeDialog } from './discharge-dialog';
import { MoveDialog } from './move-dialog';

type Open = { kind: 'transfer' | 'swap' | 'discharge'; encounterId: string; rowVersion: number } | null;

/**
 * **Acciones de internación de una cama** (F3, slot `adtActions` del panel de F2).
 *
 * Se ofrece una acción cuando la API le da a la persona `f3.adt.place` sobre
 * esta cama (`cell.actions`) **y** el estado de la cama la admite: asignable →
 * ingresar o reservar; ocupada → trasladar, intercambiar o dar de alta;
 * reservada → confirmar o cancelar la reserva. Antes de mover a alguien se
 * relee la internación para mandar su `If-Match`.
 */
@Component({
  selector: 'app-bed-actions',
  imports: [AppButton, AppButtonLink, DischargeDialog, MoveDialog, RouterLink, ViewStateHost],
  template: `
    @if (offers()) {
      <section class="bed-actions" aria-labelledby="bed-actions-title" data-testid="bed-actions">
        <h3 id="bed-actions-title" class="bed-actions__title">Internación</h3>
        @if (failure(); as f) {
          <app-view-state-host [state]="f" data-testid="bed-actions-failure" />
        }
        <div class="bed-actions__row">
          @if (place() && cell().assignable) {
            <a app-button size="sm" [routerLink]="admissionRoute" [queryParams]="{ site: siteId(), bed: cell().id }" data-testid="bed-admit">Ingresar aquí</a>
            <a app-button size="sm" variant="outline" [routerLink]="admissionRoute" [queryParams]="{ site: siteId(), bed: cell().id, mode: 'RESERVE' }">Reservar</a>
          }
          @if (place() && occupied() && encounterId()) {
            <button app-button size="sm" variant="secondary" [disabled]="working()" data-testid="bed-transfer" (clicked)="open('transfer')">Trasladar</button>
            <button app-button size="sm" variant="outline" [disabled]="working()" data-testid="bed-swap" (clicked)="open('swap')">Intercambiar</button>
            <button app-button size="sm" variant="outline" [disabled]="working()" data-testid="bed-discharge" (clicked)="open('discharge')">Dar de alta</button>
          }
          @if (place() && reserved() && cell().occupancy.encounterLocationId) {
            <button app-button size="sm" variant="secondary" [disabled]="working()" data-testid="bed-confirm-reservation" (clicked)="confirmReservation()">Confirmar ocupación</button>
            <button app-button size="sm" variant="danger" [disabled]="working()" data-testid="bed-cancel-reservation" (clicked)="cancelReservation()">Cancelar reserva</button>
          }
          @if (encounterId(); as id) {
            <a app-button size="sm" variant="ghost" [routerLink]="stay(id)" data-testid="bed-stay-link">Ver internación</a>
          }
        </div>
      </section>
    }
    @if (dialog(); as d) {
      @if (d.kind === 'discharge') {
        <app-discharge-dialog [encounterId]="d.encounterId" [rowVersion]="d.rowVersion" [bedCode]="cell().code" [isolated]="cell().isolation.code !== 'ISO_NONE'" (saved)="done()" (closed)="dialog.set(null)" />
      } @else {
        <app-move-dialog
          [mode]="d.kind"
          [cell]="cell()"
          [siteId]="siteId()"
          [encounterId]="d.encounterId"
          [rowVersion]="d.rowVersion"
          [canOverride]="has('f3.adt.override')"
          (saved)="done()"
          (closed)="dialog.set(null)"
        />
      }
    }
  `,
  styles: `
    .bed-actions { display: grid; gap: var(--sp-2); padding: var(--sp-3); border: 1px solid var(--st-primary-bd); border-radius: var(--r-md); background: var(--st-primary-bg); }
    .bed-actions__title { margin: 0; font-size: var(--fs-body); font-weight: 700; color: var(--st-primary-fg); }
    .bed-actions__row { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedActions {
  private readonly adt = inject(AdtClient);
  private readonly dialogs = inject(DialogService);

  readonly cell = input.required<BedBoardCell>();
  readonly siteId = input.required<string>();
  readonly changed = output<void>();

  protected readonly admissionRoute = ADMISSION_NEW_ROUTE;
  protected readonly stay = stayRoute;
  protected readonly dialog = signal<Open>(null);
  protected readonly working = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);

  protected readonly encounterId = computed(() => this.cell().occupancy.encounterId ?? null);
  protected readonly has = (a: string): boolean => (this.cell().actions as readonly string[]).includes(a);
  protected readonly place = computed(() => this.has('f3.adt.place'));
  protected readonly occupied = computed(() => this.cell().occupancy.code === 'OCC_OCCUPIED');
  protected readonly reserved = computed(() => this.cell().occupancy.code === 'OCC_RESERVED');
  protected readonly offers = computed(() => this.place() || this.encounterId() !== null);

  /** Relee la internación para tener su `rowVersion` vigente y abre el diálogo. */
  protected open(kind: 'transfer' | 'swap' | 'discharge'): void {
    const id = this.encounterId();
    if (id === null) return;
    this.working.set(true);
    this.failure.set(null);
    this.adt.getStay(id).subscribe({
      next: (s) => {
        this.working.set(false);
        this.dialog.set({ kind, encounterId: id, rowVersion: s.encounter.rowVersion });
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  protected done(): void {
    this.dialog.set(null);
    this.changed.emit();
  }

  /** Reserva → ocupación: `bed-assignment` con la versión vigente, en una sola cadena (sin suscripciones anidadas). */
  protected async confirmReservation(): Promise<void> {
    const id = this.encounterId();
    if (id === null || !this.place()) return;
    const ok = await this.dialogs.confirm({ title: 'Confirmar la ocupación', message: `El paciente ocupa la cama ${this.cell().code} desde ahora.`, confirmLabel: 'Confirmar' });
    if (!ok) return;
    const cama = this.cell().id;
    this.working.set(true);
    this.failure.set(null);
    this.adt
      .getStay(id)
      .pipe(switchMap((s) => this.adt.assignBed(id, s.encounter.rowVersion, { careSpaceId: cama, mode: 'ASSIGN' })))
      .subscribe({ next: () => this.finish(), error: (e: unknown) => this.fail(e) });
  }

  protected async cancelReservation(): Promise<void> {
    const loc = this.cell().occupancy.encounterLocationId;
    if (loc === undefined || loc === null) return;
    const reason = await this.dialogs.confirmWithReason(
      { title: 'Cancelar la reserva', message: `La cama ${this.cell().code} vuelve a quedar libre.`, confirmLabel: 'Cancelar la reserva', destructive: true },
      { label: 'Motivo', minLength: 3, maxLength: 300 },
    );
    if (reason === null) return;
    this.working.set(true);
    this.failure.set(null);
    this.adt.cancelLocation(loc, reason).subscribe({ next: () => this.finish(), error: (e: unknown) => this.fail(e) });
  }

  private finish(): void {
    this.working.set(false);
    this.changed.emit();
  }

  private fail(e: unknown): void {
    this.working.set(false);
    this.failure.set(errorToViewState<never>(e));
  }
}
