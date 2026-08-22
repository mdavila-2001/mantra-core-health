/* V65-03·L · Medicamentos y farmacias
   Portada de V65-buscador/publico/ en la bóveda. El marcado lo genera
   scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { aTarjeta } from '../public-result.mapper';
import { BusquedaPublica } from '@core/data-access/public-directory/public-search.store';

import { SearchResult } from '../../../../shared/components/molecules';

/**
 * Medicamentos y las farmacias que los ofertan.
 *
 * ## Esta pantalla sale vacía hoy, y es correcto que salga vacía
 *
 * `GET /public/search/medications` acota por `kind: 'MEDICATION'`, y un
 * medicamento **no es un perfil**: vive en el catálogo de farmacia, no en
 * `community.public_profiles`, que es la única tabla que el buscador público
 * consulta. Hasta este carril el filtro se perdía en silencio y el endpoint
 * devolvía **el directorio entero de profesionales** a quien buscaba un
 * remedio; ahora devuelve vacío, que es lo que hay.
 *
 * El estado vacío de la maqueta explica exactamente eso y ofrece las dos
 * salidas útiles —ampliar la distancia, buscar por principio activo—, así que
 * la pantalla sigue diciendo algo cierto mientras el catálogo no tenga
 * superficie pública.
 *
 * ## Por qué la barra de filtros conserva sólo la caja de texto
 *
 * La maqueta dibuja varios selectores más. La API pública implementa **`q`**
 * —y `verified` sólo en profesionales—: `city` y los filtros propios de cada
 * vertical figuran en `CONTRATO-PUBLICO.md` §2 pero el controlador no los lee.
 * Un selector que no filtra devuelve la lista sin acotar y le dice a quien lo
 * usó, sin decírselo, que todos los resultados cumplen su criterio. Los que
 * faltan están registrados en el reporte del carril.
 */
@Component({
  selector: 'app-redsat-buscar-medicamentos-listado',
  imports: [RouterLink, SearchResult],
  templateUrl: './medicamentos-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarMedicamentosListado {
  private readonly directorio = inject(PublicDirectoryClient);

  protected readonly busqueda = new BusquedaPublica((filtros) =>
    this.directorio.searchMedications(filtros),
  );

  protected readonly tarjetas = computed(() => this.busqueda.resultados().map(aTarjeta));

  /** Escribir lleva el texto a `?q=`; el cambio de la URL dispara la lectura. */
  protected alEscribir(valor: string): void {
    this.busqueda.escribir(valor);
  }
}
