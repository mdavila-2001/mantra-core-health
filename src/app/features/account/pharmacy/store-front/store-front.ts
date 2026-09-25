import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap, type Observable } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import {
  NO_SAVED_PLACES,
  savedPlacesOf,
  type SavedPlaces,
} from '../../../../core/data-access/profiles/saved-places';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { SearchOriginPicker } from '../../../nearby-places/search-origin-picker/search-origin-picker';
import type { SearchOrigin } from '../../../nearby-places/search-origin-picker/search-origin-picker.types';
import { MIS_PEDIDOS_ROUTE } from '../../pharmacy-orders/pharmacy-orders.routes';
import { PHARMACY_PRESCRIPTIONS_ROUTE, PHARMACY_ROUTE } from '../pharmacy.routes';
import { PHARMACY_TESTIDS } from '../pharmacy.testids';
import { ProductResults } from '../search/product-results';
import {
  LETRAS_MINIMAS,
  normalizeTerm,
  PharmacySearchService,
} from '../search/pharmacy-search.service';
import type {
  ProductHit,
  SearchMode,
  SearchResult,
  SearchSort,
  StoreHit,
} from '../search/pharmacy-search.types';
import { StoreResults } from '../search/store-results';
import { RecentOrders } from './recent-orders';

/** La pestaña de Cotizaciones del hub viejo, que ahora es su propia pantalla. */
const COTIZACIONES_ROUTE = '/my-account/cotizaciones';

/** Lo que la búsqueda en curso le pide al servicio. */
interface Consulta {
  readonly termino: string;
  readonly modo: SearchMode;
  readonly orden: SearchSort;
  readonly origen: SearchOrigin | null;
  readonly intento: number;
}

/** Una búsqueda que no llegó a consultar nada. */
const NADA = { items: [], sinOrigen: false } as const;

/**
 * **Farmacia** — la tienda del paciente (carril 43).
 *
 * Reemplaza al hub de pestañas: una sola tarjeta a lo ancho con el buscador y
 * sus controles, los resultados del modo elegido, y el bloque de últimos
 * pedidos. Sin pestañas — la regla §6 del `CLAUDE.md` del front pide una
 * tarjeta centrada y a lo ancho, y acá no hay dos contenidos que alternar:
 * hay uno, con dos maneras de mirarlo.
 *
 * ## Dos modos, dos órdenes, un término
 *
 * **Productos** busca medicamentos y devuelve una fila por sede que los tiene,
 * con el precio que esa sede publica. **Farmacias** busca sedes por nombre y,
 * si hay término, dice desde cuánto sale ahí. Ordenar por **Más barato** o
 * **Más cerca** reacomoda lo que llegó; ver {@link PharmacySearchService}.
 *
 * ## Sin origen, «Más cerca» no ordena y se dice
 *
 * La distancia la calcula la API desde el origen elegido. Sin origen no hay
 * distancias, así que el orden que llegó se deja tal cual y la pantalla lo
 * avisa con el selector de origen al lado — nunca se inventa un kilometraje
 * para poder ordenar.
 *
 * ## Los `?tab=` heredados siguen funcionando
 *
 * El hub leía `?tab=cotizaciones|comprar`. Un enlace guardado con
 * `?tab=cotizaciones` termina en «Cotizaciones», que es su propia pantalla; con
 * `?tab=comprar` termina acá, sin la query. Las dos con `replaceUrl`: la URL
 * vieja no tiene por qué quedar en el historial.
 */
@Component({
  selector: 'app-store-front',
  imports: [
    AppButtonLink,
    Card,
    FormField,
    Link,
    PageHeader,
    ProductResults,
    RecentOrders,
    RouterLink,
    SearchField,
    SearchOriginPicker,
    SegmentedControl,
    StoreResults,
    ViewStateHost,
  ],
  templateUrl: './store-front.html',
  styleUrl: './store-front.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoreFront {
  private readonly busqueda = inject(PharmacySearchService);
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfilesClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly perfil = this.auth.patientProfileId();

  protected readonly sinPerfilDePaciente = this.perfil === null;
  protected readonly testids = PHARMACY_TESTIDS;
  protected readonly rutaDeRecetas = PHARMACY_PRESCRIPTIONS_ROUTE;
  protected readonly rutaDePedidos = MIS_PEDIDOS_ROUTE;

  protected readonly termino = signal('');
  protected readonly modo = signal<SearchMode>('products');
  protected readonly orden = signal<SearchSort>('price');
  protected readonly origen = signal<SearchOrigin | null>(null);
  private readonly intento = signal(0);

  protected readonly opcionesDeModo: readonly SegmentedOption<SearchMode>[] = [
    { value: 'products', label: 'Productos' },
    { value: 'stores', label: 'Farmacias' },
  ];

  protected readonly opcionesDeOrden: readonly SegmentedOption<SearchSort>[] = [
    { value: 'price', label: 'Más barato' },
    { value: 'distance', label: 'Más cerca' },
  ];

  /** Los lugares que el paciente ya declaró; mismo criterio que Cotizaciones. */
  protected readonly lugaresGuardados = toSignal(
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

  /** Hay suficiente escrito como para que buscar signifique algo. */
  protected readonly terminoValido = computed(
    () => normalizeTerm(this.termino()).length >= LETRAS_MINIMAS,
  );

  /**
   * En Productos, sin término no se lista nada: el catálogo entero de todas
   * las farmacias no es una respuesta. En Farmacias sí, porque «qué farmacias
   * hay cerca» es una pregunta completa sin término.
   */
  protected readonly esperandoTermino = computed(
    () => this.modo() === 'products' && !this.terminoValido(),
  );

  /** Ordenar por cercanía sin origen no ordena nada: es su propio estado. */
  protected readonly faltaOrigen = computed(
    () => this.orden() === 'distance' && this.origen() === null,
  );

  private readonly lectura = toSignal(
    toObservable(
      computed<Consulta>(() => ({
        termino: this.termino(),
        modo: this.modo(),
        orden: this.orden(),
        origen: this.origen(),
        intento: this.intento(),
      })),
    ).pipe(
      switchMap((consulta): Observable<ViewState<Resultado>> => {
        if (this.sinPerfilDePaciente) {
          return of(ready(NADA as Resultado));
        }
        if (consulta.modo === 'products' && normalizeTerm(consulta.termino).length < LETRAS_MINIMAS) {
          return of(ready(NADA as Resultado));
        }
        // Anotada: la unión de dos `Observable` distintos no deja inferir
        // `pipe`, y el modo ya decidió cuál de los dos es.
        const fuente: Observable<Resultado> =
          consulta.modo === 'products'
            ? this.busqueda.searchProducts(consulta.termino, consulta.origen, consulta.orden)
            : this.busqueda.searchStores(consulta.termino, consulta.origen, consulta.orden);
        return fuente.pipe(
          map((resultado) => ready(resultado)),
          catchError((error: unknown) => of(errorToViewState<Resultado>(error))),
          startWith(loading()),
        );
      }),
    ),
    { initialValue: ready(NADA as Resultado) as ViewState<Resultado> },
  );

  /** Hay una lectura en vuelo: se anuncia además del esqueleto. */
  protected readonly buscando = computed(() => this.lectura().status === 'loading');

  protected readonly filasDeProducto = computed<readonly ProductHit[]>(() => {
    const actual = this.lectura();
    return actual.status === 'ready' && this.modo() === 'products'
      ? (actual.data.items as readonly ProductHit[])
      : [];
  });

  protected readonly filasDeSede = computed<readonly StoreHit[]>(() => {
    const actual = this.lectura();
    return actual.status === 'ready' && this.modo() === 'stores'
      ? (actual.data.items as readonly StoreHit[])
      : [];
  });

  /** La búsqueda declaró que no pudo ordenar por cercanía. */
  protected readonly sinOrigenEnResultados = computed(() => {
    const actual = this.lectura();
    return actual.status === 'ready' && actual.data.sinOrigen;
  });

  /**
   * El estado que pinta el anfitrión.
   *
   * «No encontramos nada» no es una colección vacía (S1) sino una búsqueda que
   * no encontró (S3, ADR-0005): lleva su propio vacío con la próxima acción, no
   * el genérico del host.
   */
  protected readonly estado = computed<ViewState<Resultado>>(() => {
    const actual = this.lectura();
    if (actual.status !== 'ready') {
      return actual;
    }
    if (this.esperandoTermino() || actual.data.items.length > 0) {
      return actual;
    }
    return empty(
      { label: 'Probá con otra palabra' },
      this.modo() === 'products'
        ? 'Ninguna farmacia publica algo con ese nombre.'
        : 'Ninguna farmacia coincide con ese nombre.',
    );
  });

  constructor() {
    this.redirigirTabHeredado();
  }

  protected buscar(texto: string): void {
    this.termino.set(texto);
  }

  protected cambiarModo(modo: SearchMode): void {
    this.modo.set(modo);
  }

  protected cambiarOrden(orden: SearchSort): void {
    this.orden.set(orden);
  }

  protected ordenarPorPrecio(): void {
    this.orden.set('price');
  }

  protected reintentar(): void {
    this.intento.update((numero) => numero + 1);
  }

  /**
   * Las dos pestañas del hub viejo, resueltas por su URL.
   *
   * `?tab=cotizaciones` era otra pantalla y sigue siéndolo: se navega ahí.
   * `?tab=comprar` era esta, así que se limpia la query y se queda.
   */
  private redirigirTabHeredado(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'cotizaciones') {
      void this.router.navigateByUrl(COTIZACIONES_ROUTE, { replaceUrl: true });
      return;
    }
    if (tab === 'comprar') {
      void this.router.navigateByUrl(PHARMACY_ROUTE, { replaceUrl: true });
    }
  }
}

/**
 * Lo que la lectura devuelve, en los dos modos.
 *
 * Es una unión y no un genérico porque el estado del anfitrión es **uno** y
 * tiene que poder llevar cualquiera de los dos: la pantalla separa las filas
 * en {@link StoreFront.filasDeProducto} y {@link StoreFront.filasDeSede}, que
 * es donde el modo ya se conoce.
 */
type Resultado = SearchResult<ProductHit> | SearchResult<StoreHit>;
