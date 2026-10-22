import { computed, Injectable, signal } from '@angular/core';

import { dataOf } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import type { PersonLossReport } from './person-loss-report.model';

/**
 * El informe generado y lo que lo rodea, con la vida de la **pantalla** del
 * tablero y no de la pestaña.
 *
 * `app-tab` no dibuja el panel cerrado: si el informe viviera en el componente
 * de la pestaña, pasar a «Gasto» y volver lo borraría y obligaría a generarlo
 * otra vez. Se provee en `InsuranceAnalytics`, así que muere con ella.
 */
@Injectable()
export class PersonLossReportStore {
  /** `null` = todavía no se generó. */
  readonly state = signal<ViewState<PersonLossReport> | null>(null);
  /** El servidor recortó el listado de solicitudes: el informe es parcial. */
  readonly truncated = signal(false);
  /** Los filtros con los que se generó el informe mostrado. */
  readonly generatedFor = signal<string | null>(null);
  readonly search = signal('');

  readonly report = computed(() => {
    const current = this.state();
    return current === null ? null : dataOf(current);
  });
}
