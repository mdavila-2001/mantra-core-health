import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { DiagnosticsClient } from '../../../../../core/data-access/diagnostics/diagnostics.client';
import { MedicalCentersClient } from '../../../../../core/data-access/medical-centers/medical-centers.client';
import { TerminologyClient } from '../../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  medicalCenterCard,
  SUGGESTED_BADGE,
  visibleMedicalCenters,
  WORKS_HERE_BADGE,
  type MedicalCenterCard,
} from './medical-center-card.view';
import { isProcedureCategory } from './procedure-category';

/** Las órdenes del paciente, donde se piden y se siguen los procedimientos. */
const MY_ORDERS_ROUTE = '/my-account/diagnostic-orders';

/** Tope de centros por consulta: el mismo que el de la búsqueda de imagenología. */
const CENTER_LIMIT = 20;

/**
 * Desde dónde se miden las distancias. Es un tipo propio y no el
 * `ReferencePoint` de `where-to-buy.route.ts`: la pestaña sólo necesita
 * esto. Ese tipo es asignable a éste.
 */
export interface MedicalCentersOrigin {
  readonly lat: number;
  readonly lng: number;
  /** Cómo se llama el punto («su casa», una ciudad), si lo tiene. */
  readonly label?: string;
}

/** Una orden de procedimiento sin resultado: de acá salen los procedimientos buscados. */
interface PendingProcedure {
  readonly orderId: string;
  readonly conceptId: string;
  readonly name: string;
}

/** Lo que pinta la pestaña: los procedimientos pedidos y los centros, en el orden de la API. */
interface MedicalCentersResult {
  readonly procedures: readonly PendingProcedure[];
  readonly centers: readonly MedicalCenterCard[];
}

/**
 * **Pestaña «Centros médicos»** de «Dónde conseguir» (CM-09).
 *
 * Qué centros pueden hacer los procedimientos que le pidieron al paciente, con
 * el precio de cada uno, la referencia del nomenclador y la distancia en línea
 * recta. Los procedimientos salen de las órdenes propias sin resultado y la
 * búsqueda es `GET /medical-centers/search/for-my-orders`: la URL lleva solo
 * los ids de las órdenes.
 *
 * ## El orden no es de la pantalla
 *
 * La API devuelve los centros en un orden que es igual para todos (completos,
 * cercanía, precio, nombre) y esta pestaña lo pinta tal cual: no hay control
 * de orden ni `sort`. «Sugerido por su médico» y «Su médico trabaja en este
 * centro» son avisos dentro de la tarjeta; no cambian su lugar, su tamaño ni
 * su clase, y elegir cualquier centro cuesta lo mismo: un clic en «Cómo
 * llegar».
 *
 * ## Carga solo al abrirse
 *
 * Mientras `active` es falso no sale ninguna petición. El origen lo elige la
 * persona en Farmacias y llega por `origin`; si cambia, se vuelve a buscar.
 */
@Component({
  selector: 'app-medical-centers-tab',
  imports: [AppButton, AppButtonLink, Badge, Link, RouterLink, ViewStateHost],
  templateUrl: './medical-centers-tab.html',
  styleUrl: './medical-centers-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalCentersTab {
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly centers = inject(MedicalCentersClient);
  private readonly destroyRef = inject(DestroyRef);

  /** Desde dónde medir; `null` = sin origen, y entonces no viaja ni `lat` ni `lng`. */
  readonly origin = input<MedicalCentersOrigin | null>(null);
  /** Si la pestaña está abierta. Hasta que lo esté, no se pide nada. */
  readonly active = input(false);

  protected readonly myOrdersRoute = MY_ORDERS_ROUTE;
  protected readonly worksHereText = WORKS_HERE_BADGE;
  protected readonly suggestedText = SUGGESTED_BADGE;

  protected readonly state = signal<ViewState<MedicalCentersResult>>(loading());
  protected readonly data = computed(() => dataOf(this.state()));

  /** Por defecto solo los completos (P-19-4), como en imagenología. */
  protected readonly showPartial = signal(false);

  protected readonly partialCount = computed(
    () => this.data()?.centers.filter((center) => !center.complete).length ?? 0,
  );

  protected readonly visibleCenters = computed(() =>
    visibleMedicalCenters(this.data()?.centers ?? [], this.showPartial()),
  );

  protected readonly partialLabel = computed(() =>
    this.showPartial()
      ? 'Mostrar solo los que tienen todo'
      : this.partialCount() === 1
        ? 'Ver el que tiene una parte'
        : `Ver los ${this.partialCount()} que tienen una parte`,
  );

  protected procedureNames(procedures: readonly PendingProcedure[]): string {
    return [...new Set(procedures.map((procedure) => procedure.name))].join(', ');
  }

  /** Las órdenes ya leídas; `null` mientras no se pidieron. */
  private procedures: readonly PendingProcedure[] | null = null;
  private requested = false;
  /** El origen de la última búsqueda, para no repetirla si solo cambió `active`. */
  private searchedFrom: string | null = null;

  constructor() {
    effect(() => {
      const active = this.active();
      const origin = this.origin();
      if (!active) {
        return;
      }
      untracked(() => this.onOpenedOrMoved(origin));
    });
  }

  /** Reintento: vuelve a leer las órdenes y a buscar. */
  protected load(): void {
    this.requested = true;
    this.procedures = null;
    this.searchedFrom = null;
    this.state.set(loading());
    this.diagnostics
      .getOwnOrders()
      .pipe(
        switchMap((page) => {
          const pending = page.items.filter(
            (order) => !order.hasReleasedResult && order.categoryConceptId !== undefined,
          );
          if (pending.length === 0) {
            return of<readonly PendingProcedure[]>([]);
          }
          const ids = pending.flatMap((order) => [order.codeConceptId, order.categoryConceptId!]);
          // Sin etiquetas no hay cómo saber qué orden es de procedimiento: un
          // fallo del catálogo es un error con reintento, no un «no tiene».
          return this.terminology
            .readConceptLabels([...new Set(ids)])
            .pipe(map((labels) => pendingProcedures(pending, labels)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (procedures) => {
          this.procedures = procedures;
          this.search();
        },
        error: (error: unknown) => this.state.set(errorToViewState<MedicalCentersResult>(error)),
      });
  }

  private onOpenedOrMoved(origin: MedicalCentersOrigin | null): void {
    if (!this.requested) {
      this.load();
      return;
    }
    // Las órdenes todavía no llegaron: `search()` leerá el origen vigente.
    if (this.procedures !== null && this.searchedFrom !== originKey(origin)) {
      this.search();
    }
  }

  private search(): void {
    const procedures = this.procedures;
    if (procedures === null) {
      return;
    }
    if (procedures.length === 0) {
      this.state.set(
        empty(
          { label: 'Ver mis órdenes', route: MY_ORDERS_ROUTE },
          'No tiene procedimientos pendientes. Cuando su médico le pida uno, acá va a ver dónde hacérselo.',
        ),
      );
      return;
    }
    const origin = this.origin();
    this.searchedFrom = originKey(origin);
    this.state.set(loading());
    this.centers
      .searchForMyOrders({
        serviceRequestIds: procedures.map((procedure) => procedure.orderId),
        ...(origin === null ? {} : { lat: origin.lat, lng: origin.lng }),
        // Se pide todo y se filtra al mostrar: así el orden recibido se conserva.
        includePartial: true,
        limit: CENTER_LIMIT,
      })
      .pipe(
        switchMap((page) => {
          if (page.items.length === 0) {
            return of(null);
          }
          const currencyIds = [
            ...new Set(page.items.flatMap((item) => item.offers.map((o) => o.currencyConceptId))),
          ];
          // Sin etiqueta de moneda se muestra el número solo: no se inventa una.
          return this.terminology.readConceptLabels(currencyIds).pipe(
            catchError(() => of<ConceptLabels>(new Map())),
            map((currencies) => ({ page, currencies })),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (found) => {
          if (found === null) {
            this.state.set(
              empty(
                { label: 'Ver mis órdenes', route: MY_ORDERS_ROUTE },
                'Ningún centro publicado ofrece hoy los procedimientos que le pidieron.',
              ),
            );
            return;
          }
          const labels = {
            procedures: new Map([
              ...found.page.items.flatMap((item) =>
                item.offers.map((offer) => [offer.procedureConceptId, offer.procedureDisplay] as const),
              ),
              ...procedures.map((procedure) => [procedure.conceptId, procedure.name] as const),
            ]),
            currencies: new Map(
              [...found.currencies].flatMap(([id, label]) => (label.code ? [[id, label.code] as const] : [])),
            ),
          };
          this.state.set(
            ready({
              procedures,
              centers: found.page.items.map((item) => medicalCenterCard(item, labels)),
            }),
          );
        },
        error: (error: unknown) => this.state.set(errorToViewState<MedicalCentersResult>(error)),
      });
  }
}

function originKey(origin: MedicalCentersOrigin | null): string {
  return origin === null ? 'none' : `${origin.lat},${origin.lng}`;
}

/**
 * Las órdenes de procedimiento, con el nombre de su procedimiento. Laboratorio e
 * imagen no entran. Van todas las órdenes y no una por concepto: la sugerencia
 * del médico vive en cada orden, y la búsqueda deduplica los conceptos sola.
 */
function pendingProcedures(
  orders: readonly {
    readonly id: string;
    readonly codeConceptId: string;
    readonly categoryConceptId?: string;
  }[],
  labels: ConceptLabels,
): readonly PendingProcedure[] {
  const found: PendingProcedure[] = [];
  for (const order of orders) {
    const category =
      order.categoryConceptId === undefined ? undefined : labels.get(order.categoryConceptId)?.code;
    const procedure = labels.get(order.codeConceptId);
    if (procedure === undefined || !isProcedureCategory(category)) {
      continue;
    }
    found.push({ orderId: order.id, conceptId: order.codeConceptId, name: procedure.display });
  }
  return found;
}
