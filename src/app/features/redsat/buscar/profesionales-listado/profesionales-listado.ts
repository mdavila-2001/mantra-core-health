/* V65-02·L · Profesionales
   Portada de V65-buscador/publico/V65-02-profesionales-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-redsat.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { aTarjeta } from '../public-result.mapper';
import { BusquedaPublica } from '@core/data-access/public-directory/public-search.store';

import { ResultCard } from '../../../../shared/components/molecules/result-card/result-card';

/**
 * El listado de profesionales de la superficie pública.
 *
 * ## De dónde salen los datos
 *
 * De `GET /public/search/practitioners`, **sin sesión**. Hasta el commit que
 * escribió esta clase la pantalla pintaba `PROFESIONALES_DE_MUESTRA`, un
 * archivo de datos inventados, porque `community` no tenía un solo `@Public()`.
 * Ya tiene trece, así que la lista es real.
 *
 * ## Por qué la barra de filtros perdió seis controles
 *
 * La maqueta dibuja ocho: especialidad, ciudad, modalidad, organización,
 * disponibilidad, precio, calificación mínima e idioma. **La API implementa
 * dos**: el texto libre y `verified`. `city` y `specialty` figuran en
 * `CONTRATO-PUBLICO.md` §2 pero el controlador no los lee, y los otros cuatro
 * no existen en ninguna parte.
 *
 * Dejarlos dibujados habría sido peor que quitarlos: alguien filtra «Atiende
 * hoy», la lista no cambia y la pantalla le dice —sin decirlo— que todos
 * atienden hoy. Un filtro que no filtra no es un pendiente visual, es una
 * respuesta equivocada a una pregunta que la persona sí hizo. Los seis están
 * registrados en el reporte del carril con el dato que les falta a cada uno.
 */
@Component({
  selector: 'app-redsat-buscar-profesionales-listado',
  imports: [RouterLink, ResultCard],
  templateUrl: './profesionales-listado.html',
  styleUrl: './profesionales-listado.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarProfesionalesListado {
  private readonly directorio = inject(PublicDirectoryClient);

  /** Sólo verificados. Omitido trae todos, con los verificados primero (D7). */
  protected readonly soloVerificados = signal(false);

  protected readonly busqueda = new BusquedaPublica((filtros) =>
    this.directorio.searchPractitioners({
      ...filtros,
      ...(this.soloVerificados() ? { verified: true } : {}),
    }),
  );

  protected readonly tarjetas = computed(() => this.busqueda.resultados().map(aTarjeta));

  /** Escribir lleva el texto a `?q=`; el cambio de la URL dispara la lectura. */
  protected alEscribir(valor: string): void {
    this.busqueda.escribir(valor);
  }

  /** Conmutar «sólo verificados» también vuelve a la primera página. */
  protected alConmutarVerificados(valor: boolean): void {
    this.soloVerificados.set(valor);
    this.busqueda.buscar();
  }
}
