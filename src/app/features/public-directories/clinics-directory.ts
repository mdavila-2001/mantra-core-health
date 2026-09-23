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
  singular: 'clínica encontrada',
  plural: 'clínicas encontradas',
};

/**
 * **Directorio de clínicas** — el tercero de los cuatro hermanos (A5 del plan
 * de UX del 22/08/2026).
 *
 * Absorbe además el «Grilla de ORGANIZACIÓN + tipos de organización» que el
 * plan anotaba como frente E aparte: es el mismo pedido dicho dos veces, y
 * construirlo dos veces habría dado dos directorios de lo mismo.
 *
 * ## Por qué se llama «clínicas» si el vertical se llama «organizaciones»
 *
 * Porque el cliente lo pidió así —«Directorio de clínica»— y porque
 * «organización» es palabra del modelo, no de quien busca dónde atenderse.
 * Debajo son hospitales, clínicas y centros de salud, y la insignia de cada
 * tarjeta dice cuál es cada uno.
 *
 * El resto —el recorrido del cursor, los chips, el agrupado por ciudad— vive en
 * {@link PublicDirectoryListing}, compartido con el directorio de farmacias.
 */
@Component({
  selector: 'app-clinics-directory',
  imports: [AppButton, DepartmentMap, DirectoryPage],
  templateUrl: './clinics-directory.html',
  styleUrl: './mapa-directorio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicsDirectory extends PublicDirectoryListing {
  private readonly directorio = inject(PublicDirectoryClient);

  protected readonly sustantivo = SUSTANTIVO;
  protected readonly queSonEnSingular = 'una clínica';

  /** La ficha de un resultado, dentro del panel. Ver `rutaDeLaFicha`. */
  protected readonly rutaDeLaFicha = '/clinics-directory';

  protected buscar(
    filtros: PublicSearchQuery,
  ): Observable<PublicPage<PublicSearchResult>> {
    return this.directorio.searchOrganizations(filtros);
  }

  constructor() {
    super();
    this.cargar();
  }
}
