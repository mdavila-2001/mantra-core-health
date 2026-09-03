import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  CarrierSummary,
  ClaimListItem,
  ClaimPage,
} from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
} from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { formatMoney } from '../money-format';

/** Filas por página. El servidor admite hasta 100 y aplica 25 por omisión. */
const PAGE_SIZE = 25;

/** Centinela con el que la tabla pide la página anterior. */
const BACK = 'anterior';

/**
 * Solicitudes de seguro presentadas — `administration/insurance-claims`.
 *
 * ## Dos columnas del pedido no están, y no es un olvido
 *
 * La bitácora pide «broker responsable» y «medio (automático/manual)».
 * Ninguno de los dos tiene columna en `insurance_claims`: el primero existe
 * como corredor **de la póliza** (`patient_coverages.insurance_broker_id`), que
 * responde «quién atiende hoy a este paciente» y no «quién presentó esta
 * solicitud»; el segundo no existe en ninguna capa. La regla de la ficha es
 * explícita: la columna sin dato de origen **no se dibuja**, en vez de
 * rellenarse con un guion permanente que se lee como un dato faltante y no
 * como un dato que no existe.
 *
 * Lo que sí se dibuja es el corredor de la póliza, **con ese nombre**, para no
 * hacerlo pasar por lo que no es.
 *
 * ## Los importes no se suman acá
 *
 * Llegan como cadena decimal y se muestran tal cual, con su moneda. La suma de
 * los ítems la hace el servidor con aritmética exacta: sumar decimales en el
 * navegador produce descuadres de un céntimo indistinguibles de un error real,
 * y el criterio AC-16-6 compara el total **como cadena**.
 *
 * ## El filtro viaja en la URL
 *
 * Por lo mismo que en el buscador público: una lista filtrada tiene que poder
 * pegarse en un mensaje y reproducir lo mismo. Un filtro guardado sólo en una
 * señal se pierde al recargar.
 */
@Component({
  selector: 'app-insurance-claims',
  imports: [
    Badge,
    ContentDialog,
    DataTable,
    FormField,
    PageHeader,
    RouterLink,
    Select,
  ],
  templateUrl: './insurance-claims.html',
  styleUrl: './insurance-claims.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceClaims {
  private readonly insurance = inject(InsuranceClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly patientCell =
    viewChild.required<TemplateRef<{ $implicit: ClaimListItem }>>('patientCell');
  private readonly claimCell =
    viewChild.required<TemplateRef<{ $implicit: ClaimListItem }>>('claimCell');
  private readonly billedCell =
    viewChild.required<TemplateRef<{ $implicit: ClaimListItem }>>('billedCell');
  private readonly approvedCell =
    viewChild.required<TemplateRef<{ $implicit: ClaimListItem }>>('approvedCell');
  private readonly submittedCell =
    viewChild.required<TemplateRef<{ $implicit: ClaimListItem }>>('submittedCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: ClaimListItem }>>('statusCell');

  /* ---- filtros ------------------------------------------------------------ */

  /**
   * Aseguradoras del tenant, para el filtro.
   *
   * Un fallo acá **no rompe la pantalla**: el listado se puede recorrer sin
   * filtrar, así que el error se traga y el selector queda con la única opción
   * que siempre es correcta («Todas»).
   */
  private readonly carriers = toSignal(
    this.insurance
      .listCarriers()
      .pipe(
        map((directory) => directory.items),
        catchError(() => of<readonly CarrierSummary[]>([])),
      ),
    { initialValue: [] as readonly CarrierSummary[] },
  );

  protected readonly carrierOptions = computed<readonly SelectOption<string>[]>(
    () => [
      { value: '', label: 'Todas las aseguradoras' },
      ...this.carriers().map((carrier) => ({
        value: carrier.id,
        label: carrier.legalName,
      })),
    ],
  );

  /** El filtro vigente sale de la URL, no de una señal propia. */
  protected readonly carrierFilter = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => params.get('carrier') ?? ''),
    ),
    { initialValue: '' },
  );

  /* ---- listado ------------------------------------------------------------ */

  protected readonly results = signal<ViewState<readonly ClaimListItem[]>>(
    loading(),
  );

  private readonly history = signal<readonly (string | undefined)[]>([
    undefined,
  ]);
  private readonly nextCursor = signal<string | null>(null);

  protected readonly cursor = computed<CursorState>(() => ({
    prevCursor: this.history().length > 1 ? BACK : null,
    nextCursor: this.nextCursor(),
  }));

  /**
   * Las columnas, en el orden del pedido.
   *
   * `priority` 1 son las que se ven en cualquier ancho; de 2 en adelante se
   * pliegan a la fila de detalle en móvil —no se ocultan: quedan a un toque—.
   *
   * Sólo dos quedan siempre: **qué solicitud es y de quién**. El corte lo
   * decidió la medida, no el gusto: con cinco columnas la tabla mide 708 px en
   * un viewport de 390 y con tres, 432 — y en los dos casos el botón que
   * despliega la fila de detalle queda **fuera de la vista**, así que las
   * columnas plegadas dejan de ser alcanzables sin descubrir primero que hay
   * scroll horizontal. Con dos entra el botón, y el resto —seguro, monto,
   * total aprobado, fecha y estado— está a un toque.
   *
   * **El corredor de la póliza no está en el listado, y es deliberado.** Con
   * siete columnas la tabla no entra ni a 1440 px: la última quedaba cortada a
   * media palabra, que se lee como una pantalla rota. Y es justo la columna
   * que más explicación necesita —no es el «broker responsable de la
   * solicitud» que pide la bitácora—, así que va en el detalle, donde hay
   * lugar para decir qué es.
   */
  protected readonly columns = computed<readonly ColumnDef<ClaimListItem>[]>(
    () => [
      {
        key: 'claimIdentifier',
        header: 'Solicitud',
        priority: 1,
        cell: this.claimCell(),
      },
      {
        key: 'patient',
        header: 'Paciente',
        priority: 1,
        cell: this.patientCell(),
      },
      { key: 'carrierName', header: 'Seguro', priority: 2 },
      {
        key: 'billedTotal',
        header: 'Monto solicitado',
        priority: 2,
        align: 'end',
        cell: this.billedCell(),
      },
      {
        key: 'approvedTotal',
        header: 'Total aprobado',
        priority: 2,
        align: 'end',
        cell: this.approvedCell(),
      },
      {
        key: 'submittedAt',
        header: 'Fecha de envío',
        priority: 2,
        cell: this.submittedCell(),
      },
      {
        key: 'status',
        header: 'Estado',
        priority: 2,
        cell: this.statusCell(),
      },
    ],
  );

  protected readonly byId = (row: ClaimListItem): string => row.id;

  /* ---- ficha del paciente ------------------------------------------------- */

  /**
   * El paciente cuya ficha está abierta.
   *
   * Se guarda la fila y no un `boolean`: el diálogo se declara con `@if`, así
   * que se construye recién al abrirse y desaparece al cerrarse — el foco lo
   * devuelve el `<dialog>` nativo al elemento que lo abrió.
   */
  protected readonly patientOnView = signal<ClaimListItem | null>(null);

  constructor() {
    // Un cambio de filtro es una lista nueva: el cursor que había era de la
    // anterior y seguirlo devolvería una página del listado viejo.
    effect(() => {
      this.carrierFilter();
      untracked(() => {
        this.history.set([undefined]);
        this.load();
      });
    });
  }

  /**
   * Cambia el filtro por aseguradora, reflejándolo en la URL.
   *
   * @param carrierId - Aseguradora elegida, o cadena vacía para todas.
   */
  protected filterByCarrier(carrierId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: carrierId ? { carrier: carrierId } : {},
      replaceUrl: true,
    });
  }

  /**
   * Avanza o retrocede una página.
   *
   * @param cursor - Cursor opaco, o el centinela de «anterior».
   */
  protected move(cursor: string): void {
    if (cursor === BACK) {
      this.history.update((visited) => visited.slice(0, -1));
    } else {
      this.history.update((visited) => [...visited, cursor]);
    }
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  /**
   * Abre el detalle de una solicitud.
   *
   * Es la comodidad de puntero de `rowNavigable`. El camino accesible es el
   * `<a>` de la columna «Solicitud», que sí está en el orden de tabulación y
   * anuncia adónde lleva.
   *
   * @param row - La solicitud activada.
   */
  protected openClaim(row: ClaimListItem): void {
    void this.router.navigate(['/administration/insurance-claims', row.id]);
  }

  /** Muestra un importe con su moneda, o el texto de la ausencia. */
  protected money = formatMoney;

  private load(): void {
    this.results.set(loading());
    const carrier = this.carrierFilter();
    const current = this.history().at(-1);

    this.insurance
      .listClaims({
        limit: PAGE_SIZE,
        ...(carrier === '' ? {} : { insuranceCarrierId: carrier }),
        ...(current === undefined ? {} : { cursor: current }),
      })
      .subscribe({
        next: (page) => {
          this.nextCursor.set(page.nextCursor);
          this.results.set(this.stateOf(page));
        },
        error: (error: unknown) => {
          this.nextCursor.set(null);
          this.results.set(errorToViewState<readonly ClaimListItem[]>(error));
        },
      });
  }

  /**
   * Traduce la página a estado de vista.
   *
   * El vacío dice **por qué** puede estar vacío y qué quitar: con un filtro
   * puesto, «no hay solicitudes» sin más se lee como «el módulo no funciona».
   *
   * @param page - La página recibida.
   * @returns El estado a pintar.
   */
  private stateOf(page: ClaimPage): ViewState<readonly ClaimListItem[]> {
    if (page.items.length > 0) return ready(page.items);
    return this.carrierFilter() === ''
      ? empty(
          { label: 'Volver al panel', route: '/dashboard' },
          'Todavía no se presentó ninguna solicitud de seguro en esta organización.',
        )
      : empty(
          { label: 'Ver todas las aseguradoras' },
          'Ninguna solicitud de esa aseguradora. Quitá el filtro para ver el resto.',
        );
  }
}
