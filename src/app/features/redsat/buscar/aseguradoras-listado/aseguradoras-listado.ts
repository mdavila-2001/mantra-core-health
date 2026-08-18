/* V65-06·L · Aseguradoras y convenios
   Portada de V65-buscador/publico/ en la bóveda. El marcado lo genera
   scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { aTarjeta } from '../public-result.mapper';
import { BusquedaPublica } from '@core/data-access/public-directory/public-search.store';

import { SearchResult } from '../../../../shared/components/molecules';

/**
 * Aseguradoras y convenios, desde `GET /public/search/insurers`.
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
  selector: 'app-redsat-buscar-aseguradoras-listado',
  imports: [RouterLink, SearchResult],
  templateUrl: './aseguradoras-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarAseguradorasListado {
  private readonly directorio = inject(PublicDirectoryClient);

  protected readonly busqueda = new BusquedaPublica((filtros) =>
    this.directorio.searchInsurers(filtros),
  );

  protected readonly tarjetas = computed(() => this.busqueda.resultados().map(aTarjeta));

  /** Escribir lleva el texto a `?q=`; el cambio de la URL dispara la lectura. */
  protected alEscribir(valor: string): void {
    this.busqueda.escribir(valor);
  }
}
