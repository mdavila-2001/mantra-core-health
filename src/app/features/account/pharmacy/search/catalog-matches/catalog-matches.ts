import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, of, switchMap } from 'rxjs';

import { PublicMarketplaceClient } from '../../../../../core/data-access/public-marketplace/public-marketplace.client';
import type { PaginaDeVitrina } from '../../../../../core/data-access/public-marketplace/public-marketplace.types';
import { OfficialMedicines } from '../../../../alovida/buscar/medicamentos-listado/official-medicines/official-medicines';

/**
 * What the patient's search matches when no pharmacy of the network sells
 * it: medications of the vademécum and the official registry, each with what
 * it is for. Without this, «dolor abdominal» on an environment with no
 * published catalog showed nothing at all.
 *
 * Reads `GET /public/medications` (the same search as the public showcase:
 * accents, uses, typo correction). It lists; it does not sell.
 */
@Component({
  selector: 'app-catalog-matches',
  imports: [OfficialMedicines],
  templateUrl: './catalog-matches.html',
  styleUrl: './catalog-matches.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogMatches {
  private readonly vitrina = inject(PublicMarketplaceClient);

  /** What the patient typed. */
  readonly term = input.required<string>();
  /** `true` after «Buscar tal cual». */
  readonly exact = input(false);

  private readonly consulta = computed(() => ({ q: this.term().trim(), exact: this.exact() }));

  private readonly pagina = toSignal(
    toObservable(this.consulta).pipe(
      debounceTime(150),
      switchMap(({ q, exact }) =>
        q.length < 2
          ? of(null)
          : this.vitrina
              .listMedications({ q, exact, limit: 12 })
              .pipe(catchError(() => of<PaginaDeVitrina | null>(null))),
      ),
    ),
    { initialValue: null },
  );

  protected readonly medicamentos = computed(() => this.pagina()?.items ?? []);
  protected readonly oficiales = computed(() => this.pagina()?.officialProducts ?? []);
  protected readonly corregido = computed(() => this.pagina()?.correctedQuery ?? null);
  /** The search came back and found nothing anywhere. */
  protected readonly sinNada = computed(
    () =>
      this.pagina() !== null && this.medicamentos().length === 0 && this.oficiales().length === 0,
  );
}
