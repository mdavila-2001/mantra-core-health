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
  singular: 'aseguradora encontrada',
  plural: 'aseguradoras encontradas',
};

/**
 * **Directorio de aseguradoras** — el mercado de seguros del paciente
 * (28/09/2026), sobre `GET /public/search/insurers`.
 *
 * Mismo molde que clínicas y farmacias, a pedido del cliente («copiemos la
 * disciplina que seguimos en directorio»): la misma página, el mismo mapa como
 * filtro, las mismas tarjetas y la ficha dentro del panel. Lo propio de este
 * directorio está en la ficha —productos, planes, cláusulas y el botón para
 * hablar con el broker—, no en el listado.
 */
@Component({
  selector: 'app-insurers-directory',
  imports: [AppButton, DepartmentMap, DirectoryPage],
  templateUrl: './insurers-directory.html',
  styleUrl: './directory-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsurersDirectory extends PublicDirectoryListing {
  private readonly directorio = inject(PublicDirectoryClient);

  protected readonly sustantivo = SUSTANTIVO;
  protected readonly queSonEnSingular = 'una aseguradora';

  /** La ficha de un resultado, dentro del panel. Ver `rutaDeLaFicha`. */
  protected readonly rutaDeLaFicha = '/insurers-directory';

  protected buscar(filtros: PublicSearchQuery): Observable<PublicPage<PublicSearchResult>> {
    return this.directorio.searchInsurers(filtros);
  }

  constructor() {
    super();
    this.cargar();
  }
}
