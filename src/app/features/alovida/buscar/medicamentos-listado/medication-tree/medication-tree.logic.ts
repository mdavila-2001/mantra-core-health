/* ============================================================================
    El árbol de la vitrina: compuesto → para qué se usa → nombre comercial →
    quién lo ofrece. Funciones puras, sin Angular, para poder probarlas solas.
    ========================================================================== */

import type {
  DisponibilidadDeMedicamento,
  OfertaDeFarmacia,
} from '@core/data-access/public-marketplace/public-marketplace.types';

/** Rótulo de las ofertas que la farmacia publicó sin marca. */
export const SIN_MARCA = 'Sin nombre comercial declarado';

/** Una farmacia que publica una marca, sin repetirse. */
export interface ProveedorDeMarca {
  readonly slug: string;
  readonly nombre: string;
  readonly ciudad: string | null;
  readonly enStock: boolean;
}

/** Un nombre comercial con las farmacias que lo publican. */
export interface RamaDeMarca {
  readonly marca: string;
  readonly proveedores: readonly ProveedorDeMarca[];
}

/** Cómo está la rama de proveedores de un compuesto. */
export type EstadoDeRama =
  | { readonly estado: 'carga' }
  | { readonly estado: 'error' }
  | {
      readonly estado: 'datos';
      readonly marcas: readonly RamaDeMarca[];
      /** Si alguna farmacia del país lo publica bajo receta. */
      readonly conReceta: boolean;
    };

/**
 * La rama de un compuesto a partir de su disponibilidad.
 *
 * Usa las marcas y la receta **de la disponibilidad**, no las de la tarjeta:
 * la tarjeta sale de ofertas recortadas por la búsqueda y el radio, así que
 * buscando «Cozaar» trae una sola marca, y podía decir «sin receta» aunque una
 * farmacia fuera del radio lo publicara bajo receta.
 */
export function ramaDesde(disponibilidad: DisponibilidadDeMedicamento): EstadoDeRama {
  const { medication, offers } = disponibilidad;
  return {
    estado: 'datos',
    marcas: ramasPorMarca(medication.brands, offers),
    conReceta: medication.requiresPrescription || offers.some((o) => o.requiresPrescription),
  };
}

/**
 * Agrupa las ofertas por nombre comercial.
 *
 * Las marcas de la tarjeta van primero y en su orden, **aunque ninguna
 * farmacia las ofrezca hoy**: quien busca «Cozaar» tiene que verla en el árbol
 * con «ninguna farmacia la publica hoy», no que desaparezca. Las marcas que
 * sólo aparecen en las ofertas se suman después, y las ofertas sin marca van
 * al final con su propio rótulo.
 *
 * Una farmacia con dos presentaciones de la misma marca es **un** proveedor:
 * el árbol responde «¿quién la tiene?», no «¿cuántas filas hay?». Si alguna
 * de sus ofertas tiene stock, cuenta como en stock.
 */
export function ramasPorMarca(
  marcasDeTarjeta: readonly string[],
  ofertas: readonly OfertaDeFarmacia[],
): readonly RamaDeMarca[] {
  const porMarca = new Map<string, Map<string, ProveedorDeMarca>>();
  for (const marca of marcasDeTarjeta) {
    const limpia = marca.trim();
    if (limpia !== '') porMarca.set(limpia, new Map());
  }
  const sinMarca: OfertaDeFarmacia[] = [];
  for (const oferta of ofertas) {
    const marca = oferta.brandName?.trim() ?? '';
    if (marca === '') {
      sinMarca.push(oferta);
    } else {
      agregar(porMarca, marca, oferta);
    }
  }
  for (const oferta of sinMarca) {
    agregar(porMarca, SIN_MARCA, oferta);
  }
  return [...porMarca].map(([marca, proveedores]) => ({
    marca,
    proveedores: [...proveedores.values()],
  }));
}

function agregar(
  porMarca: Map<string, Map<string, ProveedorDeMarca>>,
  marca: string,
  oferta: OfertaDeFarmacia,
): void {
  const proveedores = porMarca.get(marca) ?? new Map<string, ProveedorDeMarca>();
  const previo = proveedores.get(oferta.pharmacySlug);
  proveedores.set(oferta.pharmacySlug, {
    slug: oferta.pharmacySlug,
    nombre: oferta.pharmacyName,
    ciudad: oferta.city,
    enStock: (previo?.enStock ?? false) || oferta.inStock,
  });
  porMarca.set(marca, proveedores);
}

/** «1 farmacia» / «24 farmacias»: cuántas ofrecen esta marca. */
export function cuantosProveedores(rama: RamaDeMarca): string {
  const n = rama.proveedores.length;
  return n === 1 ? '1 farmacia' : `${n} farmacias`;
}
