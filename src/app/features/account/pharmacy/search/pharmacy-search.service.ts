import { inject, Injectable } from '@angular/core';
import { map, of, switchMap, type Observable } from 'rxjs';

import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type {
  AvailabilityProduct,
  AvailabilityResult,
  AvailabilitySite,
  PharmacyProduct,
  PharmacySite,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import { aCentavos } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import type { SearchOrigin } from '../../../nearby-places/search-origin-picker/search-origin-picker.types';
import type { ProductHit, SearchResult, SearchSort, StoreHit } from './pharmacy-search.types';

/** Letras mínimas para buscar: con una sola, cualquier catálogo coincide entero. */
export const LETRAS_MINIMAS = 2;

/** Tope de productos que se cruzan contra la disponibilidad, como Cotizaciones. */
const TOPE_DE_PRODUCTOS = 20;

/** Tope de sedes que devuelve cada lectura. */
const TOPE_DE_SEDES = 20;

/** Una búsqueda que no llegó a consultar nada. */
const VACIO = { items: [], sinOrigen: false } as const;

/**
 * El buscador de la tienda de farmacia (carril 43).
 *
 * ## Por qué compone dos lecturas y no una
 *
 * `GET /pharmacy/products` dice **qué** se publica —marca, genérico,
 * presentación, si exige receta— y **no** dice a cuánto: `PharmacyProduct` no
 * tiene precio. El precio existe sólo evaluado contra una sede, y lo trae
 * `GET /pharmacy-inventory/availability`, junto con la distancia que la API
 * calcula desde el origen. Por eso toda fila con precio pasó por
 * `availability()`, y una fila sin precio dice «Precio no publicado» en vez
 * de inventarlo.
 *
 * Es la misma composición que hace `CotizacionesFuentes.medicamentos()`. No se
 * importa ni se toca: esa pantalla compara cuatro verticales y devuelve su
 * propia fila; acá hacen falta el `siteId`, si exige receta y la sede entera
 * para armar un carrito. Se lee de ahí la forma, se escribe acá el contenido.
 *
 * ## Ordenar es de la pantalla, no del backend
 *
 * La disponibilidad ya llega ordenada por el backend (completas, distancia,
 * total, nombre). {@link sortByPrice} y {@link sortByDistance} reacomodan lo
 * que llegó, sin volver a consultar — y **sin origen, `distance` no reordena
 * nada**: se devuelve el orden de la API con `sinOrigen: true` y quien mira
 * elige desde dónde medir.
 */
@Injectable({ providedIn: 'root' })
export class PharmacySearchService {
  private readonly pharmacy = inject(PharmacyClient);

  /**
   * Productos que coinciden con el término, una fila por sede que los tiene.
   *
   * @param term - Lo escrito. Con menos de {@link LETRAS_MINIMAS} letras no se
   *   consulta nada: el catálogo entero no es una respuesta a media palabra.
   * @param origin - Desde dónde medir. `null` deja las distancias en `null`.
   * @param sort - Cómo acomodar lo que volvió.
   */
  searchProducts(
    term: string,
    origin: SearchOrigin | null,
    sort: SearchSort,
  ): Observable<SearchResult<ProductHit>> {
    if (!esBuscable(term)) {
      return of(VACIO);
    }
    return this.pharmacy.searchProducts({ search: term, limit: TOPE_DE_PRODUCTOS }).pipe(
      switchMap((pagina) => {
        const productIds = [...new Set(pagina.items.map((producto) => producto.id))];
        if (productIds.length === 0) {
          return of<SearchResult<ProductHit>>(VACIO);
        }
        return this.disponibilidadDe(productIds, origin).pipe(
          map((respuesta) => {
            const catalogo = new Map(pagina.items.map((producto) => [producto.id, producto]));
            const filas = respuesta.items.flatMap((sede) => filasDeSede(sede, catalogo));
            return acomodarProductos(filas, origin, sort);
          }),
        );
      }),
    );
  }

  /**
   * Sedes del directorio; con término, además, desde cuánto sale ahí.
   *
   * El término filtra por **nombre de farmacia o de sede** —es lo que hace
   * `GET /pharmacy/sites`—, y el «desde» sale de cruzar los productos que
   * coinciden con ese mismo término contra la disponibilidad. Una sede que
   * salió por nombre y no publica ninguno de esos productos se lista igual,
   * sin «desde»: no tener el producto buscado no la borra del directorio.
   *
   * Las sedes sin nada publicado (`productCount === 0`) sí se filtran: entrar
   * a un catálogo vacío no es una opción de compra (Q-J2).
   */
  searchStores(
    term: string,
    origin: SearchOrigin | null,
    sort: SearchSort,
  ): Observable<SearchResult<StoreHit>> {
    const buscable = esBuscable(term);
    return this.pharmacy
      .nearbySites({
        ...(buscable ? { search: term } : {}),
        ...(origin === null ? {} : { origin: { lat: origin.lat, lng: origin.lng } }),
        limit: TOPE_DE_SEDES,
      })
      .pipe(
        switchMap((pagina) => {
          const sedes = pagina.items.filter((sede) => sede.productCount > 0);
          if (!buscable || sedes.length === 0) {
            return of(
              acomodarSedes(
                sedes.map((sede) => tarjetaDeSede(sede, null)),
                origin,
                sort,
              ),
            );
          }
          return this.desdeCuantoPorSede(term, origin).pipe(
            map((desde) =>
              acomodarSedes(
                sedes.map((sede) => tarjetaDeSede(sede, desde.get(sede.siteId) ?? null)),
                origin,
                sort,
              ),
            ),
          );
        }),
      );
  }

  /** El más barato del término en cada sede, para el «desde X Bs». */
  private desdeCuantoPorSede(
    term: string,
    origin: SearchOrigin | null,
  ): Observable<ReadonlyMap<string, Desde>> {
    return this.pharmacy.searchProducts({ search: term, limit: TOPE_DE_PRODUCTOS }).pipe(
      switchMap((pagina) => {
        const productIds = [...new Set(pagina.items.map((producto) => producto.id))];
        if (productIds.length === 0) {
          return of<ReadonlyMap<string, Desde>>(new Map());
        }
        return this.disponibilidadDe(productIds, origin).pipe(map(masBaratoPorSede));
      }),
    );
  }

  private disponibilidadDe(
    productIds: readonly string[],
    origin: SearchOrigin | null,
  ): Observable<AvailabilityResult> {
    return this.pharmacy.availability({
      productIds,
      ...(origin === null ? {} : { origin: { lat: origin.lat, lng: origin.lng } }),
      limit: TOPE_DE_SEDES,
    });
  }
}

/** El «desde» de una sede: importe y moneda del más barato que coincidió. */
interface Desde {
  readonly amount: string;
  readonly currency: string | null;
}

/**
 * El término, sin acentos, en minúsculas y sin espacios de sobra.
 *
 * Exportada porque la pantalla decide con ella si ya hay algo que buscar, y
 * porque su comportamiento es parte del contrato del buscador: «PARACETAMOL »
 * y «paracetamol» son la misma búsqueda.
 */
export function normalizeTerm(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLocaleLowerCase('es')
    .trim();
}

/** Hay suficiente escrito como para consultar. */
function esBuscable(term: string): boolean {
  return normalizeTerm(term).length >= LETRAS_MINIMAS;
}

/**
 * Más barato primero; los sin precio, al final.
 *
 * «Sin precio» no es «precio cero»: una sede que no publica lo que cobra no
 * puede quedar arriba de una que sí lo hace. El orden entre las que sí tienen
 * precio se decide en centavos, nunca comparando el texto.
 */
export function sortByPrice<T extends { readonly unitAmount: string | null }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => porImporte(a.unitAmount, b.unitAmount));
}

/** Más cerca primero; las sin distancia, al final. */
export function sortByDistance<T extends { readonly distanceKm: number | null }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => porDistancia(a.distanceKm, b.distanceKm));
}

/** Compara dos importes en texto. Lo ausente o ilegible va al final. */
function porImporte(a: string | null, b: string | null): number {
  const uno = a === null ? null : aCentavos(a);
  const otro = b === null ? null : aCentavos(b);
  if (uno === null && otro === null) {
    return 0;
  }
  if (uno === null) {
    return 1;
  }
  if (otro === null) {
    return -1;
  }
  return uno - otro;
}

/** Compara dos distancias. Lo ausente va al final. */
function porDistancia(a: number | null, b: number | null): number {
  const uno = claveValida(a);
  const otro = claveValida(b);
  if (uno === null && otro === null) {
    return 0;
  }
  if (uno === null) {
    return 1;
  }
  if (otro === null) {
    return -1;
  }
  return uno - otro;
}

/** Un número utilizable para ordenar. `0` vale; `NaN` e infinitos no. */
function claveValida(valor: number | null): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : null;
}

/**
 * Aplica el orden pedido a las filas de producto, o las deja como llegaron.
 *
 * Ordenar por distancia sin origen **no reordena**: las distancias son todas
 * `null` y cualquier acomodo sería inventado. Se devuelve el orden del backend
 * con `sinOrigen: true`, que es lo que la pantalla convierte en un aviso con
 * el selector de origen al lado.
 */
function acomodarProductos(
  filas: readonly ProductHit[],
  origin: SearchOrigin | null,
  sort: SearchSort,
): SearchResult<ProductHit> {
  if (sort === 'distance') {
    return origin === null
      ? { items: filas, sinOrigen: true }
      : { items: sortByDistance(filas), sinOrigen: false };
  }
  return { items: sortByPrice(filas), sinOrigen: false };
}

/**
 * Lo mismo para las tarjetas de sede.
 *
 * No comparte función con {@link acomodarProductos} porque el importe por el
 * que se ordena tiene otro nombre y otro significado: `unitAmount` es lo que
 * cuesta ese producto en esa sede, y `fromAmount` es desde cuánto sale ahí el
 * término buscado. Unificarlos haría que la tarjeta pareciera publicar el
 * precio de un producto que nadie eligió.
 */
function acomodarSedes(
  filas: readonly StoreHit[],
  origin: SearchOrigin | null,
  sort: SearchSort,
): SearchResult<StoreHit> {
  if (sort === 'distance') {
    return origin === null
      ? { items: filas, sinOrigen: true }
      : { items: sortByDistance(filas), sinOrigen: false };
  }
  return {
    items: [...filas].sort((a, b) => porImporte(a.fromAmount, b.fromAmount)),
    sinOrigen: false,
  };
}

/** Una fila por producto que esta sede puede servir y el catálogo conoce. */
function filasDeSede(
  sede: AvailabilitySite,
  catalogo: ReadonlyMap<string, PharmacyProduct>,
): ProductHit[] {
  return sede.products.flatMap((producto) => {
    const publicado = catalogo.get(producto.productId);
    if (publicado === undefined) {
      // El catálogo es el que dice si exige receta; sin él no se puede decidir
      // si la fila lleva «Agregar» o insignia de receta, y adivinarlo sería
      // ofrecer el botón sobre un medicamento que quizá no lo admite.
      return [];
    }
    return [filaDeProducto(sede, producto, publicado)];
  });
}

function filaDeProducto(
  sede: AvailabilitySite,
  producto: AvailabilityProduct,
  publicado: PharmacyProduct,
): ProductHit {
  const precio = producto.price;
  return {
    id: `${sede.siteId}:${producto.productId}`,
    productId: producto.productId,
    name: publicado.brandName ?? publicado.genericName ?? publicado.productCode,
    presentation: presentacionDe(publicado),
    pharmacyId: sede.pharmacyId,
    pharmacyName: sede.pharmacyName,
    siteId: sede.siteId,
    siteName: sede.siteName,
    addressText: sede.addressText,
    // Lo que paga el paciente cuando la lista lo distingue; si la sede no
    // publica precio, `null` — la fila lo dice, no lo completa.
    unitAmount: precio === null ? null : (precio.patientAmount ?? precio.unitAmount),
    currency: precio?.currency?.code ?? null,
    distanceKm: sede.distanceKm,
    requiresPrescription: publicado.requiresPrescription === true,
    medicationConceptId: null,
  };
}

function tarjetaDeSede(sede: PharmacySite, desde: Desde | null): StoreHit {
  return {
    id: sede.siteId,
    siteId: sede.siteId,
    siteName: sede.siteName,
    pharmacyId: sede.pharmacyId,
    pharmacyName: sede.pharmacyName,
    addressText: sede.addressText,
    distanceKm: sede.distanceKm,
    fromAmount: desde?.amount ?? null,
    currency: desde?.currency ?? null,
    productCount: sede.productCount,
  };
}

/** El precio más bajo de cada sede entre los productos que coincidieron. */
function masBaratoPorSede(respuesta: AvailabilityResult): ReadonlyMap<string, Desde> {
  const desde = new Map<string, Desde>();
  for (const sede of respuesta.items) {
    for (const producto of sede.products) {
      const precio = producto.price;
      if (precio === null) {
        continue;
      }
      const importe = precio.patientAmount ?? precio.unitAmount;
      const previo = desde.get(sede.siteId);
      if (previo === undefined || porImporte(importe, previo.amount) < 0) {
        desde.set(sede.siteId, { amount: importe, currency: precio.currency?.code ?? null });
      }
    }
  }
  return desde;
}

/** «500 mg · caja x 20», con lo que el directorio publique. */
function presentacionDe(producto: PharmacyProduct): string | null {
  const partes = [producto.strengthText, producto.packageSizeText].filter(
    (parte): parte is string => typeof parte === 'string' && parte !== '',
  );
  return partes.length === 0 ? null : partes.join(' · ');
}
