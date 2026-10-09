import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { CartStore } from '../../../core/data-access/pharmacy-cart/cart.store';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import {
  NO_SAVED_PLACES,
  savedPlacesOf,
  type SavedPlaces,
} from '../../../core/data-access/profiles/saved-places';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Link } from '../../../shared/components/atoms/link/link';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Pagination } from '../../../shared/components/molecules/pagination/pagination';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PractitionerAvailability } from '../../directory/practitioner-availability/practitioner-availability';
import { SearchOriginPicker } from '../../nearby-places/search-origin-picker/search-origin-picker';
import { PHARMACY_CART_ROUTE } from '../pharmacy/pharmacy.routes';
import type { SearchOrigin } from '../../nearby-places/search-origin-picker/search-origin-picker.types';
import { QuotationSources, type QuotationsSearch } from './quotations.sources';
import {
  filterResults,
  normalizeQuotation,
  sortResults,
  type ResultQuotation,
  type QuotationOrder,
  type QuotationBooking,
  type VerticalQuotation,
} from './quotations.logic';

/**
 * La tabla del recurso agendable que apunta a un centro de diagnóstico. La
 * agenda de un laboratorio es un recurso más, como la de un profesional.
 */
const DIAGNOSIS_CENTER_TABLE = 'diagnostic_units';

/** Letras mínimas para buscar: con una sola, cualquier catálogo coincide entero. */
const MIN_LETTERS = 2;

const VERTICAL_LABEL: Readonly<Record<Exclude<VerticalQuotation, 'TODAS'>, string>> = {
  MEDICAMENTOS: 'Medicamentos',
  ANALISIS: 'Análisis',
  IMAGENOLOGIA: 'Imagenología',
  SERVICIOS_MEDICOS: 'Servicios médicos',
};

/** Lo que la búsqueda en curso le pide a las fuentes. */
interface Consultation {
  readonly termino: string;
  readonly vertical: VerticalQuotation;
  readonly origen: SearchOrigin | null;
  readonly intento: number;
}

/**
 * «Cotizaciones» del paciente (N-02): dónde conseguir algo y cuánto cuesta,
 * ordenado por precio o por cercanía.
 *
 * ## De dónde sale cada fila
 *
 * De {@link QuotationSources}, que compone lo que ya existe —farmacias,
 * catálogo diagnóstico y arancel de referencia— sin un número escrito en el
 * código. Lo que la fuente no publica se dice («Precio no publicado», «No
 * aplica: es un arancel de referencia»), nunca se completa.
 *
 * ## Los estados (H3.S2.M4)
 *
 * - **Sin término**: se pide qué cotizar; no se lista el catálogo entero.
 * - **Cargando / con datos / vacío / error**: los de la tabla, con reintento.
 * - **Sin ubicación**: ordenar por cercanía sin origen no ordena nada; se dice
 *   y se ofrece ordenar por precio, con el selector de origen ahí mismo.
 * - **Precio no publicado**: por fila, con la procedencia en el `title`.
 * - **Fuente caída** (con «Todas»): el resto se muestra y se avisa cuál falta.
 */
@Component({
  selector: 'app-quotations',
  imports: [
    Alert,
    AppButton,
    ContentDialog,
    DataTable,
    EmptyState,
    FormField,
    Link,
    NgTemplateOutlet,
    PageHeader,
    Pagination,
    PractitionerAvailability,
    RouterLink,
    SearchField,
    SearchOriginPicker,
    Select,
  ],
  templateUrl: './quotations.html',
  styleUrl: './quotations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Quotations {
  private readonly sources = inject(QuotationSources);
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfilesClient);
  private readonly cart = inject(CartStore);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly cartPath = PHARMACY_CART_ROUTE;
  protected readonly centerTables: readonly string[] = [DIAGNOSIS_CENTER_TABLE];
  protected readonly activeTenant = this.auth.activeTenantId;

  /** El estudio cuya agenda está abierta en el diálogo, o `null`. */
  protected readonly openBooking = signal<QuotationBooking | null>(null);

  /** Los productos del carrito vigente, por sede: la fila dice «En tu carrito». */
  private readonly inCart = computed<ReadonlySet<string>>(() => {
    const carrito = this.cart.cart();
    return new Set(
      carrito === null
        ? []
        : carrito.lines.map((linea) => `${carrito.site.siteId}:${linea.productId}`),
    );
  });

  /**
   * Con el backend simulado los precios de farmacia y de estudios son de
   * ejemplo: se dice arriba de todo, no sólo fila por fila (R2-02).
   */
  protected readonly isMockup = environment.mockBackend;

  /**
   * `true` cuando esta pantalla vive **dentro** de «Farmacia», como una de
   * sus pestañas (`PharmacyHub`). Igual que en `PharmacyOrders`: sólo cambia
   * el membrete.
   */
  readonly embedded = input(false, { transform: booleanAttribute });

  /**
   * Con vertical fija, la pantalla arranca ahí y no ofrece el selector: quien
   * la embebe decide qué compara, no quien mira. Hoy sólo «Farmacia» la usa,
   * fija en `MEDICAMENTOS` — el comparador de las cuatro verticales sigue
   * siendo su propio destino, sin tocar.
   */
  readonly fixedVertical = input<Exclude<VerticalQuotation, 'TODAS'> | null>(null);

  protected readonly term = signal('');
  protected readonly vertical = signal<VerticalQuotation>(this.fixedVertical() ?? 'TODAS');
  protected readonly order = signal<QuotationOrder>('PRECIO');
  protected readonly origin = signal<SearchOrigin | null>(null);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(10);
  private readonly attempt = signal(0);

  protected readonly verticalOptions: readonly SelectOption<VerticalQuotation>[] = [
    { value: 'TODAS', label: 'Todas' },
    { value: 'MEDICAMENTOS', label: 'Medicamentos' },
    { value: 'ANALISIS', label: 'Análisis' },
    { value: 'IMAGENOLOGIA', label: 'Imagenología' },
    { value: 'SERVICIOS_MEDICOS', label: 'Servicios médicos' },
  ];

  protected readonly orderOptions: readonly SelectOption<QuotationOrder>[] = [
    { value: 'PRECIO', label: 'Precio' },
    { value: 'CERCANIA', label: 'Cercanía' },
  ];

  /** Los lugares que el paciente ya declaró; mismo criterio que «Lugares cercanos». */
  protected readonly savedPlaces = toSignal(
    toObservable(this.auth.patientProfileId).pipe(
      switchMap((perfil): Observable<SavedPlaces | null> =>
        perfil === null
          ? of(NO_SAVED_PLACES)
          : this.profiles.getOwnPatientProfile().pipe(
              map(savedPlacesOf),
              catchError(() => of(NO_SAVED_PLACES)),
            ),
      ),
    ),
    { initialValue: null },
  );

  protected readonly validTerm = computed(
    () => normalizeQuotation(this.term()).length >= MIN_LETTERS,
  );

  /** Ordenar por cercanía sin origen no ordena nada: es su propio estado. */
  protected readonly originMissing = computed(
    () => this.order() === 'CERCANIA' && this.origin() === null,
  );

  /**
   * La lectura. El origen entra en la consulta porque la distancia de las
   * farmacias la calcula la API desde ahí: cambiarlo recalcula (H3.S2.M2).
   */
  private readonly search = toSignal(
    toObservable(
      computed<Consultation>(() => ({
        termino: this.term(),
        vertical: this.vertical(),
        origen: this.origin(),
        intento: this.attempt(),
      })),
    ).pipe(
      switchMap((consulta): Observable<ViewState<QuotationsSearch>> => {
        if (normalizeQuotation(consulta.termino).length < MIN_LETTERS) {
          return of(ready<QuotationsSearch>({ resultados: [], fuentesCaidas: [] }));
        }
        return this.sources.search(consulta.termino, consulta.vertical, consulta.origen).pipe(
          map((resultado) => ready(resultado)),
          catchError((error: unknown) => of(errorToViewState<QuotationsSearch>(error))),
          startWith(loading()),
        );
      }),
    ),
    { initialValue: loading() as ViewState<QuotationsSearch> },
  );

  /** Hay una lectura en vuelo: se anuncia con `role="status"` además del esqueleto. */
  protected readonly searching = computed(() => this.search().status === 'loading');

  /** Las filas, filtradas por vertical (la fuente ya filtró por término) y ordenadas. */
  protected readonly results = computed<readonly ResultQuotation[]>(() => {
    const actual = this.search();
    if (actual.status !== 'ready') {
      return [];
    }
    return sortResults(
      filterResults(actual.data.resultados, '', this.vertical()),
      this.order(),
      this.origin() !== null,
    );
  });

  /** Hay filas para mostrar: en angosto se pintan como tarjetas. */
  protected readonly hasRows = computed(
    () => this.search().status === 'ready' && this.results().length > 0,
  );

  /** La búsqueda volvió bien y no encontró nada: S2, con su propio vacío. */
  protected readonly withoutResults = computed(
    () => this.search().status === 'ready' && this.results().length === 0,
  );

  protected readonly downSources = computed<string>(() => {
    const actual = this.search();
    return actual.status === 'ready'
      ? actual.data.fuentesCaidas.map((una) => VERTICAL_LABEL[una]).join(', ')
      : '';
  });

  protected readonly paginatedResults = computed(() => {
    const inicio = (this.page() - 1) * this.pageSize();
    return this.results().slice(inicio, inicio + this.pageSize());
  });

  /** El estado que pinta la tabla: el de la lectura, con «vacío» propio. */
  protected readonly tableStatus = computed<ViewState<readonly ResultQuotation[]>>(() => {
    const actual = this.search();
    if (actual.status !== 'ready') {
      return actual as ViewState<readonly ResultQuotation[]>;
    }
    // Sin resultados no es «colección vacía» (S1) sino «la búsqueda no
    // encontró» (S2, ADR-0005): lo pinta la pantalla con su propio vacío, no
    // el genérico del host («Todavía no hay nada acá»).
    return this.results().length === 0
      ? empty({ label: 'Pruebe con otra palabra' }, 'No encontramos cotizaciones.')
      : ready(this.paginatedResults());
  });

  private readonly celdaQue =
    viewChild.required<TemplateRef<{ $implicit: ResultQuotation }>>('celdaQue');
  private readonly celdaPrecio =
    viewChild.required<TemplateRef<{ $implicit: ResultQuotation }>>('celdaPrecio');
  private readonly celdaDistancia =
    viewChild.required<TemplateRef<{ $implicit: ResultQuotation }>>('celdaDistancia');
  private readonly celdaAccion =
    viewChild.required<TemplateRef<{ $implicit: ResultQuotation }>>('celdaAccion');

  /**
   * Qué (y dónde), precio, distancia y acción (H3.S2.M3).
   *
   * Todas con prioridad 1: el dónde y la distancia son la mitad de la
   * decisión, y con prioridad 2 la tabla los escondía en móvil detrás de un
   * «▼» sin rótulo. El dónde va dentro de la celda del qué para que en 390 px
   * entren las cuatro columnas.
   */
  protected readonly columns = computed<readonly ColumnDef<ResultQuotation>[]>(() => [
    { key: 'que', header: 'Qué y dónde', priority: 1, cell: this.celdaQue() },
    { key: 'price', header: 'Precio', priority: 1, align: 'end', cell: this.celdaPrecio() },
    {
      key: 'distanceKm',
      header: 'Distancia (línea recta)',
      priority: 1,
      align: 'end',
      cell: this.celdaDistancia(),
    },
    { key: 'accion', header: 'Acción', priority: 1, cell: this.celdaAccion() },
  ]);

  protected readonly byId = (fila: ResultQuotation): string => fila.id;
  protected readonly accessibleName = (fila: ResultQuotation): string =>
    `${fila.que}, ${fila.donde}`;

  protected verticalLabel(fila: ResultQuotation): string {
    return VERTICAL_LABEL[fila.vertical];
  }

  protected priceOf(fila: ResultQuotation): string {
    if (fila.price === null) {
      return 'Precio no publicado';
    }
    // Dinero con dos decimales fijos («35,00 BOB», «30,50 BOB»); la UMA es una
    // unidad de arancel, no dinero, y va como la publica el Colegio («4 UMA»).
    const decimales = fila.price.currency === 'UMA' ? 0 : 2;
    const importe = fila.price.amount.toLocaleString('es-BO', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: 2,
    });
    // Espacio duro: el importe no se separa de su unidad al partir el renglón.
    return `${importe}\u00A0${fila.price.currency}`;
  }

  protected provenanceOf(fila: ResultQuotation): string {
    return fila.price === null
      ? (fila.sinPrecio ?? 'Precio no publicado por la fuente')
      : fila.price.source;
  }

  protected distanceOf(fila: ResultQuotation): string {
    // Sin origen la API de farmacias no calcula distancia: la falta es del
    // origen, no de la sede, y decirlo así es lo que deja saber qué hacer.
    if (fila.distanceKm === null && fila.vertical === 'MEDICAMENTOS' && this.origin() === null) {
      return 'Elija desde dónde medir';
    }
    return fila.distanceKm === null
      ? (fila.sinDistancia ?? 'Sin distancia publicada')
      : `${fila.distanceKm.toLocaleString('es-BO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
  }

  protected isInCart(fila: ResultQuotation): boolean {
    const carrito = fila.carrito;
    return (
      carrito !== undefined &&
      this.inCart().has(`${carrito.sede.siteId}:${carrito.linea.productId}`)
    );
  }

  /**
   * Agrega el medicamento al carrito, como «Agregar» en la tienda de Farmacia.
   *
   * Un carrito es de una sola sede: si ya hay uno de otra, el store devuelve
   * `conflict` **sin cambiar nada** y decide la persona.
   */
  protected async addToCart(fila: ResultQuotation): Promise<void> {
    const carrito = fila.carrito;
    if (carrito === undefined) {
      return;
    }
    let resultado = this.cart.add(carrito.sede, carrito.linea);
    if (resultado === 'conflict') {
      const confirmado = await this.dialogs.confirm({
        title: 'Vaciar y cambiar de farmacia',
        message: `Su carrito es de otra farmacia. Si sigue, se vacía y queda sólo ${carrito.linea.name} de ${carrito.sede.pharmacyName}.`,
        confirmLabel: 'Vaciar y cambiar',
        cancelLabel: 'Dejarlo como está',
        destructive: true,
      });
      if (!confirmado) {
        return;
      }
      this.cart.replaceWith(carrito.sede, [{ ...carrito.linea, quantity: 1 }], null);
      resultado = 'added';
    }
    if (resultado === 'added') {
      this.toast.success(
        `${carrito.linea.name} quedó en su carrito de ${carrito.sede.pharmacyName}.`,
        'Agregado al carrito',
      );
    }
  }

  /** Abre la agenda del centro para elegir el horario del estudio. */
  protected abrirReserva(fila: ResultQuotation): void {
    if (fila.reserva !== undefined) {
      this.openBooking.set(fila.reserva);
    }
  }

  protected closeBooking(): void {
    this.openBooking.set(null);
  }

  protected buscar(termino: string): void {
    this.term.set(termino);
    this.page.set(1);
  }

  protected changeVertical(vertical: VerticalQuotation | null): void {
    this.vertical.set(vertical ?? 'TODAS');
    this.page.set(1);
  }

  protected changeOrder(orden: QuotationOrder | null): void {
    this.order.set(orden ?? 'PRECIO');
    this.page.set(1);
  }

  protected sortByPrice(): void {
    this.changeOrder('PRECIO');
  }

  protected clearSearch(): void {
    this.buscar('');
  }

  protected retry(): void {
    this.attempt.update((n) => n + 1);
  }
}
