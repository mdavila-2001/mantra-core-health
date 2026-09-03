/* V65-05·L · Laboratorios e imagen
   Portada de V65-buscador/publico/ en la bóveda. El marcado lo generó
   scripts/port-vistas-redsat.mjs; la grilla de tarjetas y la lógica van acá. */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { BusquedaPublica } from '@core/data-access/public-directory/public-search.store';
import { CardDetailPanel } from '@shared/components/molecules/card-detail-panel/card-detail-panel';

import { CentroCard } from '../centro-card/centro-card';
import { toDiagnosticCard, type DiagnosticCard } from './diagnostic-card.mapper';

/**
 * Laboratorios e imagenología, desde `GET /public/search/diagnostic-units`.
 *
 * ## Por qué dejó de ser una lista de renglones (AC-06-2)
 *
 * Porque las cuatro pantallas del directorio público mostraban la misma
 * búsqueda de tres formas distintas: hospitales en grilla con portada,
 * medicamentos con una tarjeta propia sin imagen, y ésta y aseguradoras como
 * `app-search-result` —una figura de 56 px y dos renglones—. Cambiar de
 * pestaña se leía como cambiar de producto. Ahora las cuatro usan `CentroCard`
 * y lo que cambia son los datos de abajo y los botones del pie, que es
 * exactamente lo que el pedido decía: «mantener el diseño en grid, cada
 * observación con su card».
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
  selector: 'app-redsat-buscar-laboratorios-listado',
  imports: [CardDetailPanel, CentroCard, RouterLink],
  templateUrl: './laboratorios-listado.html',
  styleUrls: ['../centro-card/centro-grid.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarLaboratoriosListado {
  private readonly directorio = inject(PublicDirectoryClient);

  /**
   * Cuántos esqueletos dibujar mientras carga.
   *
   * Seis y no veinticinco: llenan la primera pantalla en cualquier ancho sin
   * pedirle al navegador que dibuje una página entera de cajas grises.
   */
  protected readonly huecos = [0, 1, 2, 3, 4, 5];

  protected readonly busqueda = new BusquedaPublica((filtros) =>
    this.directorio.searchDiagnosticUnits(filtros),
  );

  protected readonly tarjetas = computed<readonly DiagnosticCard[]>(() =>
    this.busqueda.resultados().map(toDiagnosticCard),
  );

  /** Escribir lleva el texto a `?q=`; el cambio de la URL dispara la lectura. */
  protected alEscribir(valor: string): void {
    this.busqueda.escribir(valor);
  }
}
