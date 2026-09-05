/* V65-06·L · Aseguradoras y convenios
   Portada de V65-buscador/publico/ en la bóveda. El marcado lo generó
   scripts/port-vistas-alovida.mjs; la grilla de tarjetas y la lógica van acá. */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { BusquedaPublica } from '@core/data-access/public-directory/public-search.store';
import { CardDetailPanel } from '@shared/components/molecules/card-detail-panel/card-detail-panel';

import { CentroCard } from '../centro-card/centro-card';
import { toInsurerCard, type InsurerCard } from './insurer-card.mapper';

/**
 * Aseguradoras y convenios, desde `GET /public/search/insurers`.
 *
 * ## Por qué dejó de ser una lista de renglones (AC-06-2)
 *
 * Mismo motivo que en laboratorios: las cuatro pantallas del directorio
 * público mostraban la misma búsqueda con tres anatomías distintas y cambiar
 * de pestaña se leía como cambiar de producto. Ahora las cuatro usan
 * `CentroCard`; lo que cambia son los datos de abajo —acá, el ramo y la
 * calificación, **nunca el turno**: una aseguradora no da citas— y los botones
 * del pie.
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
  selector: 'app-alovida-buscar-aseguradoras-listado',
  imports: [CardDetailPanel, CentroCard, RouterLink],
  templateUrl: './aseguradoras-listado.html',
  styleUrls: ['../centro-card/centro-grid.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarAseguradorasListado {
  private readonly directorio = inject(PublicDirectoryClient);

  /** Cuántos esqueletos dibujar mientras carga: los que llenan una pantalla. */
  protected readonly huecos = [0, 1, 2, 3, 4, 5];

  protected readonly busqueda = new BusquedaPublica((filtros) =>
    this.directorio.searchInsurers(filtros),
  );

  protected readonly tarjetas = computed<readonly InsurerCard[]>(() =>
    this.busqueda.resultados().map(toInsurerCard),
  );

  /** Escribir lleva el texto a `?q=`; el cambio de la URL dispara la lectura. */
  protected alEscribir(valor: string): void {
    this.busqueda.escribir(valor);
  }
}
