import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import type {
  PublicPage,
  PublicSearchQuery,
  PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { DepartmentMap } from '@shared/components/organisms/department-map/department-map';
import { DirectoryPage } from '@shared/components/organisms/directory-page/directory-page';
import type { SustantivoDelDirectorio } from '@shared/components/organisms/directory-page/directory-page.types';

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
 * El plan proponía un chip de «de turno». **No está**, y no por olvido: el
 * contrato público sirve nombre, titular, ciudad, foto, verificación y
 * puntuación, y nada sobre el turno de guardia. Un chip de «de turno» que
 * devolviera la lista entera mandaría a alguien a las tres de la mañana a una
 * farmacia cerrada. Cuando el dato exista, el chip es una línea.
 *
 * Lo mismo con «obra social/convenio»: no hay campo, no hay chip.
 */
@Component({
  selector: 'app-pharmacies-directory',
  imports: [AppButton, DepartmentMap, DirectoryPage],
  templateUrl: './pharmacies-directory.html',
  styleUrl: './mapa-directorio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmaciesDirectory extends PublicDirectoryListing {
  private readonly directorio = inject(PublicDirectoryClient);

  protected readonly sustantivo = SUSTANTIVO;
  protected readonly queSonEnSingular = 'una farmacia';

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
