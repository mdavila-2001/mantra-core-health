/* V65-06·L · Aseguradoras y convenios
   Portada de V65-buscador/publico/ en la bóveda. El marcado lo generó
   scripts/port-vistas-alovida.mjs; la grilla de tarjetas y la lógica van acá. */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { BusquedaPublica } from '@core/data-access/public-directory/public-search.store';
import { CardDetailPanel } from '@shared/components/molecules/card-detail-panel/card-detail-panel';
import { DepartmentMap } from '@shared/components/organisms/department-map/department-map';
import { FiltroTerritorial } from '@shared/geo/filtro-territorial';

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
 * ## Por qué la barra de filtros no tiene más selectores que el texto y el lugar
 *
 * La maqueta dibuja varios selectores más. La API pública implementa **`q`**
 * —y `verified` sólo en profesionales—: `city` y los filtros propios de cada
 * vertical figuran en `CONTRATO-PUBLICO.md` §2 pero el controlador no los lee.
 * Un selector que no filtra devuelve la lista sin acotar y le dice a quien lo
 * usó, sin decírselo, que todos los resultados cumplen su criterio. Los que
 * faltan están registrados en el reporte del carril.
 *
 * ## El lugar, en dos pasos: departamento y después municipio (subtarea 2.3)
 *
 * Una aseguradora tiene domicilio, y la ficha pública lo sirve: el mismo corte
 * que clínicas, farmacias y hospitales, con el mapa arriba y los municipios del
 * departamento elegido como chips. El controlador no acota por lugar, así que el
 * store recorre el cursor una vez y corta en memoria. Ver `FiltroTerritorial`.
 */
@Component({
  selector: 'app-alovida-buscar-aseguradoras-listado',
  imports: [CardDetailPanel, CentroCard, DepartmentMap, RouterLink],
  templateUrl: './aseguradoras-listado.html',
  styleUrls: ['../centro-card/centro-grid.css', '../../../public-directories/mapa-directorio.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarAseguradorasListado {
  private readonly directorio = inject(PublicDirectoryClient);

  /** Cuántos esqueletos dibujar mientras carga: los que llenan una pantalla. */
  protected readonly huecos = [0, 1, 2, 3, 4, 5];

  /** El lugar en dos pasos. Va antes que el store: el store lo usa en su primera lectura. */
  protected readonly lugar = new FiltroTerritorial();

  protected readonly busqueda = new BusquedaPublica(
    (filtros) => this.directorio.searchInsurers(filtros),
    [],
    // Con categorías: el ramo separa a las que **cubren salud** de las de
    // generales y fianzas, que estaban en la misma lista sin nada que las
    // distinguiera salvo leer el titular una por una. Es la primera pregunta
    // de quien busca un seguro médico, y la respondía la lista entera.
    { territorio: this.lugar, categorias: true },
  );

  protected readonly tarjetas = computed<readonly InsurerCard[]>(() =>
    this.busqueda.resultados().map(toInsurerCard),
  );

  /** Escribir lleva el texto a `?q=`; el cambio de la URL dispara la lectura. */
  protected alEscribir(valor: string): void {
    this.busqueda.escribir(valor);
  }
}
