import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AdtClient } from '../../../../core/data-access/adt/adt.client';
import type { PatientCurrentStay } from '../../../../core/data-access/adt/adt.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { ADMISSION_NEW_ROUTE, shortDateTime, stayRoute } from '../../../inpatient/inpatient-presentation';

/**
 * La internación **con cama** del paciente, dentro del bloque de internación
 * del expediente (F3.4): cama actual, unidad, desde cuándo y enlace a la ficha;
 * sin internación en curso, «Internar» lleva al ingreso con el paciente ya
 * elegido. El alta de episodio de abajo sigue igual (comportamiento preservado).
 */
@Component({
  selector: 'app-inpatient-stay-summary',
  imports: [AppButtonLink, RouterLink, ViewStateHost],
  template: `
    <app-view-state-host [state]="state()" (retry)="load()">
      <div class="stay-summary" data-testid="inpatient-stay-summary">
        @if (stay(); as s) {
          <p class="stay-summary__line">
            <strong>{{ s.bed ? 'Cama ' + s.bed.code : 'Pendiente de cama' }}</strong>
            @if (s.bed?.unitName) { · {{ s.bed?.unitName }} }
            · {{ s.siteName }} · desde {{ when(s.since) }} · {{ s.levelOfCare.display }}
          </p>
          <a app-button size="sm" variant="outline" [routerLink]="stayLink(s.encounterId)" data-testid="inpatient-stay-link">Ver la internación</a>
        } @else {
          <p class="stay-summary__line">Sin internación con cama en curso en esta organización.</p>
          <a app-button size="sm" variant="secondary" [routerLink]="admissionRoute" [queryParams]="{ patient: patientProfileId() }" data-testid="inpatient-admit">Internar</a>
        }
      </div>
    </app-view-state-host>
  `,
  styles: `
    .stay-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-2) var(--sp-4); padding: var(--sp-3); border: 1px solid var(--border-default); border-radius: var(--r-md); background: var(--bg-surface-alt); }
    .stay-summary__line { margin: 0; color: var(--text-secondary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InpatientStaySummary {
  private readonly adt = inject(AdtClient);

  readonly patientProfileId = input.required<string>();

  protected readonly state = signal<ViewState<PatientCurrentStay | null>>(loading());
  protected readonly stay = computed(() => (this.state().status === 'ready' ? (this.state() as { data: PatientCurrentStay | null }).data : null));
  protected readonly admissionRoute = ADMISSION_NEW_ROUTE;
  protected readonly stayLink = stayRoute;
  protected readonly when = (iso: string) => shortDateTime(iso) ?? '—';

  constructor() {
    effect(() => {
      this.patientProfileId();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    const id = this.patientProfileId();
    if (id === '') return;
    this.state.set(loading());
    this.adt
      .getPatientCurrentStay(id)
      .pipe(
        map((s) => ready(s) as ViewState<PatientCurrentStay | null>),
        catchError((e: unknown) => of(errorToViewState<PatientCurrentStay | null>(e))),
      )
      .subscribe((s) => this.state.set(s));
  }
}
