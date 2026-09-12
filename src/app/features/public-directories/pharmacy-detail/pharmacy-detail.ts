import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { PublicCatalogClient } from '@core/data-access/public-catalog/public-catalog.client';
import type { PublicPharmacyProduct } from '@core/data-access/public-catalog/public-catalog.types';
import type { PublicPage } from '@core/data-access/public-directory/public-directory.types';
import { Badge } from '@shared/components/atoms/badge/badge';
import { ServiceIcon } from '@shared/components/atoms/service-icon/service-icon';
import { Skeleton } from '@shared/components/atoms/skeleton/skeleton';
import { Card } from '@shared/components/molecules/card/card';
import { FactList } from '@shared/components/molecules/fact-list/fact-list';
import { SectionHeading } from '@shared/components/molecules/section-heading/section-heading';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { PublicCatalogDetail } from '../public-catalog-detail';

/** Un tramo del catálogo: los medicamentos de un grupo terapéutico. */
interface GrupoDeMedicamentos {
  readonly id: string;
  readonly nombre: string;
  readonly productos: readonly PublicPharmacyProduct[];
}

/** El rótulo del tramo de los que no declararon grupo. */
const SIN_GRUPO = 'Sin grupo declarado';

/**
 * **La ficha de una farmacia**, dentro del panel.
 *
 * El hermano de {@link ClinicDetail}, por el mismo motivo: el clic en
 * «Directorio de farmacias» abría `/f/:slug` —la ficha anónima bajo el marco de
 * la red social— y se llevaba afuera de la aplicación a quien había entrado por
 * su menú.
 *
 * Muestra **qué medicamentos tiene y a cuánto**, que es lo que hace falta antes
 * de mandar a alguien con una receta. Sin edición de precio: el catálogo es de
 * la farmacia.
 *
 * ## Por qué agrupa por grupo terapéutico y la ficha de clínica no
 *
 * Porque una farmacia publica decenas de productos y «Losartán» al lado de
 * «Amoxicilina» no es una lista, es un montón. El grupo terapéutico es el corte
 * con el que ya se piensan —es el que usa la vitrina pública de medicamentos— y
 * es el que deja encontrar sin buscar. Un catálogo de servicios de una clínica
 * es más corto y su propio nombre ya lo ordena.
 */
@Component({
  selector: 'app-pharmacy-detail',
  imports: [
    Badge,
    Card,
    FactList,
    PageHeader,
    SectionHeading,
    ServiceIcon,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './pharmacy-detail.html',
  styleUrls: ['../../../shared/styles/rejilla-de-tarjetas.css', '../catalogo-publico.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyDetail extends PublicCatalogDetail<PublicPharmacyProduct> {
  private readonly catalogo = inject(PublicCatalogClient);

  protected readonly kind = 'PHARMACY' as const;
  protected readonly rutaDelDirectorio = '/pharmacies-directory';
  protected readonly rotuloDelDirectorio = 'Directorio de farmacias';

  /**
   * Los tramos del catálogo: uno por grupo terapéutico, y uno final para los
   * productos que no lo declararon.
   *
   * Sin grupo **no se esconde a nadie**: un medicamento que la farmacia cargó
   * sin clasificar existe igual y tiene que poder encontrarse. Va al final
   * porque es lo menos útil para hojear, no porque valga menos. Es la misma
   * regla que el tramo «Sin ciudad declarada» del directorio.
   */
  protected readonly tramos = computed<readonly GrupoDeMedicamentos[]>(() => {
    const porGrupo = new Map<string, PublicPharmacyProduct[]>();
    const sinGrupo: PublicPharmacyProduct[] = [];

    for (const producto of this.items()) {
      if (producto.therapeuticGroup === null || producto.therapeuticGroup === '') {
        sinGrupo.push(producto);
        continue;
      }
      porGrupo.set(producto.therapeuticGroup, [
        ...(porGrupo.get(producto.therapeuticGroup) ?? []),
        producto,
      ]);
    }

    const tramos = [...porGrupo.entries()]
      .map(([nombre, productos]) => ({
        id: nombre,
        nombre,
        productos: [...productos].sort((a, b) =>
          a.genericName.localeCompare(b.genericName, 'es'),
        ),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    if (sinGrupo.length > 0) {
      tramos.push({
        id: 'sin-grupo',
        nombre: SIN_GRUPO,
        productos: [...sinGrupo].sort((a, b) =>
          a.genericName.localeCompare(b.genericName, 'es'),
        ),
      });
    }
    return tramos;
  });

  /**
   * El segundo renglón de la tarjeta: la marca y la presentación.
   *
   * Devuelve `''` cuando no hay ninguna de las dos —y no «Sin presentación»—:
   * una línea que dice que falta un dato ocupa el mismo lugar que la que lo
   * trae, y en una rejilla de veinte tarjetas eso es veinte veces el mismo
   * aviso inútil.
   */
  protected marcaYPresentacion(producto: PublicPharmacyProduct): string {
    return [producto.brandName, producto.presentation]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(' · ');
  }

  protected leerCatalogo(slug: string): Observable<PublicPage<PublicPharmacyProduct>> {
    return this.catalogo.pharmacyProducts(slug);
  }
}
