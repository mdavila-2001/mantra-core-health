import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, of, switchMap } from 'rxjs';

import { InsightsClient } from '../../core/data-access/insights/insights.client';
import type { InsightsMeta } from '../../core/data-access/insights/insights.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { loading, ready, stale } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { installCatalog } from './domain/campaigns.data';
import { installFacts } from './domain/facts-source';

/** Los datos de un día de antigüedad ya son «atrasados»: el cutoff del dataset es el de ayer. */
const STALE_AFTER_DAYS = 1;

/**
 * Carga el catálogo y los hechos de campañas desde la API, los instala en el dominio y
 * dice en qué estado quedaron (`ViewState`, ADR-0005).
 *
 * Lo provee el marco (`InsightsShell`): las pantallas no se crean hasta que esto está
 * `ready` o `stale`, así que el dominio nunca se lee vacío por accidente.
 *
 * ## Lo que NO hace
 *
 * Calcula nada: los KPI, benchmarks y estados salen de `features/insights/domain` a partir
 * de los hechos. Y no autoriza: la API valida el rol en cada petición.
 */
@Injectable()
export class InsightsData {
  private readonly client = inject(InsightsClient);

  readonly state = signal<ViewState<InsightsMeta>>(loading());

  /** `true` cuando el dominio ya tiene catálogo y hechos instalados. */
  readonly ready = computed(() => {
    const status = this.state().status;
    return status === 'ready' || status === 'stale';
  });

  /** La procedencia del dato (demo / en vivo, día de corte, aviso). `null` mientras carga. */
  readonly meta = computed<InsightsMeta | null>(() => {
    const current = this.state();
    return current.status === 'ready' || current.status === 'stale' ? current.data : null;
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set(loading());
    this.client
      .getCatalog()
      .pipe(
        switchMap((catalog) => {
          const starts = catalog.data.campaigns.map((c) => c.startDate).sort();
          const from = starts[0] ?? catalog.meta.cutoff;
          return this.client
            .getCampaignFacts({ from, to: catalog.meta.cutoff })
            .pipe(map((facts) => ({ catalog, facts })));
        }),
        map(({ catalog, facts }): ViewState<InsightsMeta> => {
          installCatalog(catalog.data);
          installFacts(facts.data);
          const meta = facts.meta;
          const ageDays = (Date.now() - Date.parse(`${meta.asOf}T00:00:00Z`)) / 86_400_000;
          // Un conjunto de demostración tiene corte fijo: declararlo «atrasado» sería ruido.
          return meta.dataset === 'live' && ageDays > STALE_AFTER_DAYS
            ? stale(meta, new Date(`${meta.asOf}T00:00:00Z`))
            : ready(meta);
        }),
        catchError((error: unknown) => of(errorToViewState<InsightsMeta>(error))),
      )
      .subscribe((next) => this.state.set(next));
  }
}
