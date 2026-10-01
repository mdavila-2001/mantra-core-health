import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap, type Observable } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type {
  AvailabilitySite,
  PharmacyProduct,
  PharmacySite,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  BorradorDePedido,
  LineaDePedido,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import {
  NO_SAVED_PLACES,
  savedPlacesOf,
  type SavedPlaces,
} from '../../../../core/data-access/profiles/saved-places';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { displayCurrency } from '../../../../core/money/display-currency';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { SearchOriginPicker } from '../../../nearby-places/search-origin-picker/search-origin-picker';
import type { SearchOrigin } from '../../../nearby-places/search-origin-picker/search-origin-picker.types';
import { MI_HISTORIA_ROUTE } from '../../medical-record/medical-record.routes';

/** Letras mínimas para filtrar el catálogo; menos que esto no acota nada. */
const LETRAS_MINIMAS_PRODUCTO = 2;

/** Lo que la persona eligió de un producto, antes de confirmarse contra la sede. */
interface ItemDeCarrito {
  readonly producto: PharmacyProduct;
  readonly cantidad: number;
}

/**
 * **Comprar** — la pestaña de «Farmacia» que arma el carrito (pedido del
 * propietario, 24 y 25/09/2026): elegí una farmacia, mirá su catálogo, armá
 * el carrito y continuá.
 *
 * ## Lo que se fotocopia, literal
 *
 * A partir de «Continuar» esto **no es código nuevo**: arma el mismo
 * {@link BorradorDePedido} que arma «Dónde comprar mi receta»
 * (`where-to-buy.ts`, `borradorDePedido()`), se lo pasa a
 * `PharmacyOrdersClient.prepararBorrador()` y navega a
 * `/my-account/pharmacy-orders/new` — la misma pantalla de revisión, el
 * mismo checkout, el mismo `POST /pharmacy/orders`. La única diferencia es
 * `requestId: ''`: el adaptador (`createOrderRequest`) ya omite
 * `medicationRequestId` cuando viene vacío, así que un pedido sin receta de
 * por medio no es un caso especial en ningún punto de esa cadena.
 *
 * ## Por qué las que requieren receta no se agregan
 *
 * `PharmacyProduct.requiresPrescription` ya lo dice el directorio. Dejar que
 * un medicamento con receta obligatoria entre a un carrito de libre
 * elección sería saltarse la puerta que existe — la receta, y el flujo que
 * ya la exige (`where-to-buy.ts`). Acá se muestra con una insignia y sin
 * control de cantidad, con la salida hacia la historia clínica.
 *
 * ## Precio: recién al continuar
 *
 * El catálogo (`GET /pharmacy/products`) no publica precio — sólo lo hace
 * `GET /pharmacy-inventory/availability`, evaluado contra una sede. Mostrar
 * un total en el catálogo sería inventar una cifra que todavía no se
 * consultó; el total real aparece en la pantalla de revisión, después de
 * «Continuar».
 */
@Component({
  selector: 'app-pharmacy-shop',
  imports: [
    Alert,
    AppButton,
    Badge,
    FormField,
    RouterLink,
    SearchField,
    SearchOriginPicker,
    ViewStateHost,
  ],
  templateUrl: './pharmacy-shop.html',
  styleUrl: './pharmacy-shop.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyShop {
  private readonly pharmacy = inject(PharmacyClient);
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly auth = inject(AuthService);
  private readonly profiles = inject(ProfilesClient);
  private readonly router = inject(Router);

  protected readonly rutaHistoriaClinica = MI_HISTORIA_ROUTE;

  /** Sin perfil de paciente no hay a nombre de quién comprar. */
  protected readonly sinPerfilDePaciente = this.auth.patientProfileId() === null;

  /* ---- paso 1: elegir farmacia -------------------------------------------- */

  protected readonly terminoFarmacia = signal('');
  protected readonly origen = signal<SearchOrigin | null>(null);
  protected readonly farmaciaElegida = signal<PharmacySite | null>(null);
  private readonly intentoSitios = signal(0);

  /** Los lugares que el paciente ya declaró, para ofrecer casa/trabajo como origen. */
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

  protected readonly sitios = toSignal(
    toObservable(
      computed(() => ({
        termino: this.terminoFarmacia(),
        origen: this.origen(),
        intento: this.intentoSitios(),
        perfil: this.auth.patientProfileId(),
      })),
    ).pipe(
      switchMap(({ termino, origen, perfil }): Observable<ViewState<readonly PharmacySite[]>> => {
        // Sin perfil de paciente la pantalla entera muestra otra cosa (ver el
        // `@if` de la plantilla): no hay a nombre de quién listar farmacias.
        if (perfil === null) {
          return of(ready<readonly PharmacySite[]>([]));
        }
        return this.pharmacy
          .nearbySites({ search: termino === '' ? undefined : termino, origin: origen ?? undefined })
          .pipe(
            map((page) =>
              page.items.length === 0
                ? empty({ label: 'Probá con otro nombre' }, 'No encontramos farmacias con ese nombre.')
                : ready(page.items),
            ),
            catchError((error: unknown) => of(errorToViewState<readonly PharmacySite[]>(error))),
            startWith(loading()),
          );
      }),
    ),
    { initialValue: loading() as ViewState<readonly PharmacySite[]> },
  );

  protected reintentarSitios(): void {
    this.intentoSitios.update((n) => n + 1);
  }

  /** Las sedes listas, para que la plantilla no destipe el estado. */
  protected readonly listaDeSitios = computed(() => {
    const estado = this.sitios();
    return estado.status === 'ready' ? estado.data : [];
  });

  protected elegirFarmacia(sitio: PharmacySite): void {
    this.farmaciaElegida.set(sitio);
  }

  /** Sin carrito no hay nada que perder: cambiar de farmacia es directo. */
  protected cambiarDeFarmacia(): void {
    this.farmaciaElegida.set(null);
    this.terminoProducto.set('');
  }

  protected vaciarCarritoYCambiar(): void {
    this.carrito.set(new Map());
    this.cambiarDeFarmacia();
  }

  /* ---- paso 2: el catálogo y el carrito ------------------------------------ */

  protected readonly terminoProducto = signal('');
  protected readonly carrito = signal<ReadonlyMap<string, ItemDeCarrito>>(new Map());
  private readonly intentoProductos = signal(0);

  protected readonly productos = toSignal(
    toObservable(
      computed(() => ({
        termino: this.terminoProducto(),
        farmacia: this.farmaciaElegida(),
        intento: this.intentoProductos(),
      })),
    ).pipe(
      switchMap(({ termino, farmacia }): Observable<ViewState<readonly PharmacyProduct[]>> => {
        if (farmacia === null || (termino.length > 0 && termino.length < LETRAS_MINIMAS_PRODUCTO)) {
          return of(ready<readonly PharmacyProduct[]>([]));
        }
        return this.pharmacy
          .searchProducts({ pharmacyId: farmacia.pharmacyId, search: termino === '' ? undefined : termino })
          .pipe(
            map((page) =>
              page.items.length === 0
                ? empty({ label: 'Probá con otro nombre' }, 'No encontramos productos con ese nombre.')
                : ready(page.items),
            ),
            catchError((error: unknown) => of(errorToViewState<readonly PharmacyProduct[]>(error))),
            startWith(loading()),
          );
      }),
    ),
    { initialValue: ready<readonly PharmacyProduct[]>([]) as ViewState<readonly PharmacyProduct[]> },
  );

  protected reintentarProductos(): void {
    this.intentoProductos.update((n) => n + 1);
  }

  /** Los productos listos, para que la plantilla no destipe el estado. */
  protected readonly listaDeProductos = computed(() => {
    const estado = this.productos();
    return estado.status === 'ready' ? estado.data : [];
  });

  protected readonly hayCarrito = computed(() => this.carrito().size > 0);
  protected readonly unidadesEnCarrito = computed(() =>
    [...this.carrito().values()].reduce((suma, item) => suma + item.cantidad, 0),
  );

  protected nombreDe(producto: PharmacyProduct): string {
    return producto.brandName ?? producto.genericName ?? producto.productCode;
  }

  protected cantidadDe(producto: PharmacyProduct): number {
    return this.carrito().get(producto.id)?.cantidad ?? 0;
  }

  protected cambiarCantidad(producto: PharmacyProduct, paso: 1 | -1): void {
    if (paso === 1 && producto.requiresPrescription === true) {
      return;
    }
    const actual = new Map(this.carrito());
    const cantidadActual = actual.get(producto.id)?.cantidad ?? 0;
    const siguiente = cantidadActual + paso;
    if (siguiente <= 0) {
      actual.delete(producto.id);
    } else {
      actual.set(producto.id, { producto, cantidad: siguiente });
    }
    this.carrito.set(actual);
  }

  /* ---- continuar: fotocopiar «Dónde comprar mi receta» --------------------- */

  protected readonly enviando = signal(false);
  protected readonly errorAlContinuar = signal<string | null>(null);

  protected continuar(): void {
    const farmacia = this.farmaciaElegida();
    const items = [...this.carrito().values()];
    if (farmacia === null || items.length === 0) {
      return;
    }
    this.errorAlContinuar.set(null);
    this.enviando.set(true);
    this.pharmacy
      .availability({
        productIds: items.map((item) => item.producto.id),
        origin: this.origen() ?? undefined,
      })
      .subscribe({
        next: (resultado) => {
          this.enviando.set(false);
          const sitio = resultado.items.find((candidato) => candidato.siteId === farmacia.siteId);
          if (sitio === undefined) {
            this.errorAlContinuar.set(
              'Esa sede ya no está publicando disponibilidad. Elegí otra farmacia.',
            );
            return;
          }
          this.ordersClient.prepararBorrador(borradorDelCarrito(items, sitio));
          void this.router.navigate(['/my-account/pharmacy-orders/new']);
        },
        error: () => {
          this.enviando.set(false);
          this.errorAlContinuar.set('No pudimos confirmar la disponibilidad. Probá de nuevo.');
        },
      });
  }

  protected moneda(code?: string | null): string {
    return displayCurrency(code);
  }
}

/**
 * Arma el borrador con lo elegido en el catálogo, evaluado contra la sede.
 *
 * Exportada a propósito, igual que `borradorDePedido()` en `where-to-buy.ts`:
 * es pura y el spec la ejercita directo.
 */
export function borradorDelCarrito(
  items: readonly ItemDeCarrito[],
  sitio: AvailabilitySite,
): BorradorDePedido {
  const porProducto = new Map(sitio.products.map((producto) => [producto.productId, producto]));
  const lineas: readonly LineaDePedido[] = items.map((item): LineaDePedido => {
    const disponible = porProducto.get(item.producto.id);
    const enStock = disponible !== undefined && !sitio.missingProductIds.includes(item.producto.id);
    const precio = disponible?.price?.patientAmount ?? disponible?.price?.unitAmount ?? null;
    const presentacion = [
      disponible?.strengthText ?? item.producto.strengthText,
      disponible?.packageSizeText ?? item.producto.packageSizeText,
    ].filter((parte): parte is string => typeof parte === 'string' && parte !== '');
    return {
      productId: item.producto.id,
      medicamento:
        item.producto.brandName ?? item.producto.genericName ?? item.producto.productCode,
      presentacion: presentacion.length === 0 ? null : presentacion.join(' · '),
      cantidad: item.cantidad,
      precio: enStock ? precio : null,
      moneda:
        enStock && precio !== null
          ? (disponible?.price?.currency?.code ?? sitio.currency?.code ?? null)
          : null,
      disponible: enStock,
    };
  });
  return {
    requestId: '',
    siteId: sitio.siteId,
    pharmacyId: sitio.pharmacyId,
    farmacia: sitio.pharmacyName,
    sede: sitio.siteName,
    direccion: sitio.addressText,
    lineas,
    totalEstimado: sitio.totalAmount,
    moneda: sitio.currency?.code ?? null,
  };
}
