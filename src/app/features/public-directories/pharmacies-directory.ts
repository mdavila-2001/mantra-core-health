import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type {
  PublicPage,
  PublicSearchQuery,
  PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';
import { DirectoryPage } from '@shared/components/organisms/directory-page/directory-page';
import type { SustantivoDelDirectorio } from '@shared/components/organisms/directory-page/directory-page.types';

import { OpenNowPharmacies } from './open-now-pharmacies/open-now-pharmacies';
import type { AccionDeLaFicha } from './public-directory-filters';
import { PublicDirectoryListing } from './public-directory-listing';

const SUSTANTIVO: SustantivoDelDirectorio = {
  singular: 'farmacia encontrada',
  plural: 'farmacias encontradas',
};

/**
 * **Directorio de farmacias** — el cuarto hermano (A6 del plan de UX del
 * 22/08/2026), sobre `GET /public/search/pharmacies`.
 *
 * ## Lo que este directorio NO promete
 *
 * El buscador público (`/public/search/pharmacies`) sigue sin saber del turno
 * de guardia: su índice son perfiles. Por eso «24 h» y «de turno» **no son un
 * chip de este buscador** —filtraría por un dato que no tiene y mandaría a
 * alguien a las tres de la mañana a una farmacia cerrada—, sino la sección
 * «Abiertas ahora» de arriba (P34), que lee `GET /public/pharmacies/open-now`
 * y decide con el reloj del servidor.
 *
 * Lo mismo con «obra social/convenio»: no hay campo, no hay chip.
 */
@Component({
  selector: 'app-pharmacies-directory',
  imports: [DirectoryPage, OpenNowPharmacies],
  templateUrl: './pharmacies-directory.html',
  styleUrl: './pharmacies-directory.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmaciesDirectory extends PublicDirectoryListing {
  private readonly directorio = inject(PublicDirectoryClient);

  protected readonly sustantivo = SUSTANTIVO;
  protected readonly queSonEnSingular = 'una farmacia';

  /** La ficha de un resultado, dentro del panel. Ver `rutaDeLaFicha`. */
  protected readonly rutaDeLaFicha = '/pharmacies-directory';

  /** Directo a la sección donde se elige, sin pasar por la cabecera. */
  protected override readonly accionDeLaFicha: AccionDeLaFicha = {
    label: 'Ver medicamentos y precios',
    fragment: 'medicamentos',
    icon: 'pill',
  };

  protected buscar(
    filtros: PublicSearchQuery,
  ): Observable<PublicPage<PublicSearchResult>> {
    return this.directorio.searchPharmacies(filtros);
  }

  constructor() {
    super();
    this.cargar();
  }
}
