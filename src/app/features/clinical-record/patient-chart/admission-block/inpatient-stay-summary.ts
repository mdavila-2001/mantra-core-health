import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, map, of, startWith, switchMap, throwError } from 'rxjs';

import { AdtClient } from '../../../../core/data-access/adt/adt.client';
import type { InpatientStay } from '../../../../core/data-access/adt/adt.types';
import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import type { CareSpaceDetail } from '../../../../core/data-access/infrastructure/infrastructure.types';
import { opsLabel } from '../../../../core/data-access/infrastructure-ops/ops-labels';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { InpatientAccessStore } from '../../../inpatient/inpatient-access.store';
import { ADMISSION_NEW_ROUTE, DEFAULT_TIME_ZONE, shortDateTime, stayRoute } from '../../../inpatient/inpatient-presentation';

/** La estancia vigente tal como la arma el resumen: la de la API + su cama (estructura de F1). */
export interface CurrentStay {
  readonly encounterId: string;
  readonly since: string | null;
  readonly levelOfCare: string | null;
  readonly bed: CareSpaceDetail | null;
}

/**
 * La internación **con cama** del paciente, dentro del bloque de internación
 * del expediente (F3.4): cama actual, unidad, desde cuándo y enlace a la ficha;
 * sin internación en curso, «Internar» lleva al ingreso con el paciente ya
 * elegido. El alta de episodio de abajo sigue igual (comportamiento preservado).
 *
 * Sólo en un hospital y sólo para quien la API le da lectura de internación
 * (`f3.adt.read`); «Internar», sólo con `f3.adt.place`. Al cambiar de paciente,
 * el pedido anterior se cancela (`switchMap`).
 */
@Component({
  selector: 'app-inpatient-stay-summary',
  imports: [AppButtonLink, RouterLink, ViewStateHost],
  template: `
    @if (visible()) {
      <app-view-state-host [state]="state()" (retry)="reload()">
        <div class="stay-summary" data-testid="inpatient-stay-summary">
          @if (stay(); as s) {
            <p class="stay-summary__line">
              <strong>{{ s.bed ? 'Cama ' + s.bed.code : 'Pendiente de cama' }}</strong>
              @if (siteName(); as n) { · {{ n }} }
              · desde {{ when(s.since) }}@if (s.levelOfCare) { · {{ label(s.levelOfCare) }} }
            </p>
            <a app-button size="sm" variant="outline" [routerLink]="stayLink(s.encounterId)" data-testid="inpatient-stay-link">Ver la internación</a>
          } @else {
            <p class="stay-summary__line" data-testid="inpatient-stay-none">Sin internación visible: no hay una en curso, o su rol no la ve.</p>
            @if (canAdmit()) {
              <a app-button size="sm" variant="secondary" [routerLink]="admissionRoute" [queryParams]="{ patient: patientProfileId() }" data-testid="inpatient-admit">Internar</a>
            }
          }
        </div>
      </app-view-state-host>
    }
  `,
  styles: `
    .stay-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-2) var(--sp-4); padding: var(--sp-3); border: 1px solid var(--border-default); border-radius: var(--r-md); background: var(--bg-surface-alt); }
    .stay-summary__line { margin: 0; color: var(--text-secondary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InpatientStaySummary {
  private readonly adt = inject(AdtClient);
  private readonly access = inject(InpatientAccessStore);
  private readonly infra = inject(InfrastructureClient);

  readonly patientProfileId = input.required<string>();

  private readonly reloads = signal(0);
  protected readonly state = signal<ViewState<CurrentStay | null>>(loading());
  protected readonly stay = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });
  protected readonly visible = computed(() => this.access.isHospital() && this.access.canAnywhere('f3.adt.read'));
  protected readonly canAdmit = computed(() => this.access.canAnywhere('f3.adt.place'));
  protected readonly admissionRoute = ADMISSION_NEW_ROUTE;
  protected readonly stayLink = stayRoute;
  protected readonly label = opsLabel;
  protected readonly siteName = computed(() => this.access.site(this.stay()?.bed?.siteId ?? null)?.name ?? null);
  protected readonly when = (iso: string | null) => shortDateTime(iso, this.access.site(this.stay()?.bed?.siteId ?? null)?.timeZone ?? DEFAULT_TIME_ZONE) ?? '—';

  constructor() {
    // Fuera de un hospital no se pregunta nada: la sección no existe ahí.
    effect(() => {
      if (this.access.isHospital()) this.access.ensure();
    });
    toObservable(computed(() => ({ id: this.patientProfileId(), on: this.visible(), n: this.reloads() })))
      .pipe(
        switchMap(({ id, on }) =>
          !on || id === ''
            ? of(loading() as ViewState<CurrentStay | null>)
            : this.adt.getPatientCurrentStay(id).pipe(
                // 404 uniforme («Estancia no encontrada»): sin internación, sin permiso o no autorizada.
                // Es «sin estancia visible», no un error.
                catchError((e: unknown) => (e instanceof HttpErrorResponse && e.status === 404 ? of(null) : throwError(() => e))),
                switchMap((s) => (s === null ? of(null) : this.withBed(s))),
                map((s) => ready(s) as ViewState<CurrentStay | null>),
                catchError((e: unknown) => of(errorToViewState<CurrentStay | null>(e))),
                startWith(loading() as ViewState<CurrentStay | null>),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.state.set(s));
  }

  private withBed(s: InpatientStay) {
    const actual = s.movements.find((m) => m.periodEnd === null && (m.status === 'LOCATION_ACTIVE' || m.status === 'LOCATION_RESERVED'));
    const base = { encounterId: s.encounter.id, since: actual?.periodStart ?? s.encounter.startAt, levelOfCare: s.encounter.levelOfCare };
    return actual?.careSpaceId
      ? this.infra.getCareSpace(actual.careSpaceId).pipe(
          map((bed): CurrentStay => ({ ...base, bed })),
          catchError(() => of<CurrentStay>({ ...base, bed: null })),
        )
      : of<CurrentStay>({ ...base, bed: null });
  }

  protected reload(): void {
    this.reloads.update((n) => n + 1);
  }
}
