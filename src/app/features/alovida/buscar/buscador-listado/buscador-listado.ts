/* V65-01·L · Buscador
   Portada de V65-buscador/publico/ en la bóveda. El marcado lo genera
   scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { aTarjeta } from '../public-result.mapper';
import { BusquedaPublica } from '@core/data-access/public-directory/public-search.store';

import { SearchResult } from '../../../../shared/components/molecules';

/**
 * La portada del buscador: una sola caja para los seis verticales.
 *
 * Lee `GET /public/search`, la búsqueda unificada, **sin sesión**. Los
 * resultados llegan mezclados y cada tarjeta declara su tipo en la insignia
 * junto al nombre, que es lo que la ficha V65-01 pide: quien busca todavía no
 * sabe en qué categoría cae su problema.
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
  selector: 'app-alovida-buscar-buscador-listado',
  imports: [RouterLink, SearchResult],
  templateUrl: './buscador-listado.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarBuscadorListado {
  private readonly directorio = inject(PublicDirectoryClient);

  protected readonly busqueda = new BusquedaPublica((filtros) =>
    this.directorio.search(filtros),
  );

  protected readonly tarjetas = computed(() => this.busqueda.resultados().map(aTarjeta));

  /** Escribir lleva el texto a `?q=`; el cambio de la URL dispara la lectura. */
  protected alEscribir(valor: string): void {
    this.busqueda.escribir(valor);
  }
}
