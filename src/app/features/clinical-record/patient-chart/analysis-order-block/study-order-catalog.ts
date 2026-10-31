import { computed, inject, Injectable, signal } from '@angular/core';
import { EMPTY, forkJoin, of, type Observable } from 'rxjs';
import { catchError, expand, map, reduce, take } from 'rxjs/operators';

import { StudyCatalogClient } from '../../../../core/data-access/study-catalog/study-catalog.client';
import type {
  StudyCatalogDetail,
  StudyCatalogItem,
  StudyFamily,
} from '../../../../core/data-access/study-catalog/study-catalog.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { buildImagingCatalog, specimenOptions, toLabAnalysis } from './study-order-adapter';

/** Estudios por página y tope de páginas: 2000 estudios alcanzan para el catálogo entero. */
const PAGE = 100;
const MAX_PAGES = 20;
const OTHER_FAMILIES: readonly StudyFamily[] = ['CARDIO', 'PATHOLOGY', 'PROCEDURE'];

export type DetailStatus = 'loading' | 'error';

/**
 * El catálogo de estudios pedibles que el bloque de órdenes consulta: el listado
 * por familia (todas las páginas, con cursor) y el detalle de cada estudio que
 * se elige (componentes, muestra, regiones), con caché. Lo provee el propio
 * bloque, así cada pantalla tiene el suyo.
 */
@Injectable()
export class StudyOrderCatalog {
  private readonly client = inject(StudyCatalogClient);
  private readonly terminology = inject(TerminologyClient);

  readonly labItems = signal<readonly StudyCatalogItem[]>([]);
  readonly labState = signal<ViewState<null>>(loading());
  readonly imagingItems = signal<readonly StudyCatalogItem[]>([]);
  readonly imagingState = signal<ViewState<null>>(loading());
  /** Cardiología, patología y procedimientos: el flujo de un solo estudio. */
  readonly otherItems = signal<readonly StudyCatalogItem[]>([]);
  readonly otherState = signal<ViewState<null>>(loading());
  private readonly imagingLabels = signal<ConceptLabels>(new Map());

  /** Detalle ya leído, por estudio. */
  readonly details = signal<ReadonlyMap<string, StudyCatalogDetail>>(new Map());
  /** Detalle en vuelo o fallido, por estudio. */
  readonly detailStatus = signal<ReadonlyMap<string, DetailStatus>>(new Map());

  private readonly started = new Set<string>();

  readonly labAnalyses = computed(() =>
    this.labItems().map((item) => toLabAnalysis(item, this.details().get(item.conceptId))),
  );
  readonly specimens = computed(() => specimenOptions(this.details().values()));
  readonly imaging = computed(() => buildImagingCatalog(this.imagingItems(), this.imagingLabels(), this.details()));

  /** Carga (una sola vez) el listado de la familia; `force` lo vuelve a pedir. */
  ensure(type: 'LAB' | 'IMAGING' | 'OTHER', force = false): void {
    if (this.started.has(type) && !force) return;
    this.started.add(type);
    const state = type === 'LAB' ? this.labState : type === 'IMAGING' ? this.imagingState : this.otherState;
    state.set(loading());
    const read: Observable<readonly StudyCatalogItem[]> =
      type === 'OTHER'
        ? forkJoin(OTHER_FAMILIES.map((f) => this.loadAll(f))).pipe(map((groups) => groups.flat()))
        : this.loadAll(type);
    read.subscribe({
      next: (items) => {
        if (type === 'OTHER') {
          this.otherItems.set(items);
          state.set(ready(null));
          return;
        }
        if (type === 'LAB') {
          this.labItems.set(items);
          state.set(ready(null));
          return;
        }
        this.imagingItems.set(items);
        const ids = [
          ...new Set(items.flatMap((i) => [i.modalityConceptId, i.bodySiteConceptId]).filter((x): x is string => x !== null)),
        ];
        this.terminology
          .readConceptLabels(ids)
          .pipe(catchError(() => of(new Map() as ConceptLabels)))
          .subscribe((labels) => {
            this.imagingLabels.set(labels);
            state.set(ready(null));
          });
      },
      error: (error: unknown) => {
        this.started.delete(type);
        state.set(errorToViewState<null>(error));
      },
    });
  }

  /** Lee el detalle de un estudio si no está y avisa cuando ya se puede usar. */
  fetchDetail(conceptId: string, done?: (detail: StudyCatalogDetail) => void): void {
    const cached = this.details().get(conceptId);
    if (cached !== undefined) {
      done?.(cached);
      return;
    }
    if (this.detailStatus().get(conceptId) === 'loading') return;
    this.setStatus(conceptId, 'loading');
    this.client.detail(conceptId).subscribe({
      next: (detail) => {
        this.details.update((m) => new Map(m).set(conceptId, detail));
        this.setStatus(conceptId, null);
        done?.(detail);
      },
      error: () => this.setStatus(conceptId, 'error'),
    });
  }

  private setStatus(conceptId: string, status: DetailStatus | null): void {
    this.detailStatus.update((m) => {
      const next = new Map(m);
      if (status === null) next.delete(conceptId);
      else next.set(conceptId, status);
      return next;
    });
  }

  private loadAll(family: StudyFamily): Observable<readonly StudyCatalogItem[]> {
    const page = (cursor?: string) =>
      this.client.list({ family, limit: PAGE, ...(cursor === undefined ? {} : { cursor }) });
    return page().pipe(
      expand((p) => (p.nextCursor === null ? EMPTY : page(p.nextCursor))),
      take(MAX_PAGES),
      reduce((all, p) => [...all, ...p.items], [] as readonly StudyCatalogItem[]),
      map((all) => all),
    );
  }
}
