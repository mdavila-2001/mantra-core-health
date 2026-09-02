/* V65-04·L · Hospitales y clínicas
   El listado de centros de salud de la superficie pública. */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { BusquedaPublica } from '@core/data-access/public-directory/public-search.store';
import { CardDetailPanel } from '@shared/components/molecules/card-detail-panel/card-detail-panel';

import { CentroCard } from '../centro-card/centro-card';
import { toFacilityCard, type FacilityCard } from './facility-card.mapper';
import { FacilityDirectionsDialog } from './facility-directions-dialog/facility-directions-dialog';

/**
 * Las ciudades que se ofrecen como chip.
 *
 * Fijas y no derivadas de la página en pantalla: derivarlas daría una lista de
 * ciudades que cambia al pasar de página —y que en la página 2 esconde la
 * ciudad que la persona estaba mirando en la 1—. La API pública no expone
 * facetas, así que la alternativa honesta es ofrecer las ciudades donde la
 * plataforma opera y dejar que el estado vacío diga la verdad cuando en una de
 * ellas todavía no hay ningún centro publicado.
 */
const CIUDADES = [
  'La Paz',
  'El Alto',
  'Santa Cruz de la Sierra',
  'Cochabamba',
  'Sucre',
  'Oruro',
  'Potosí',
  'Tarija',
] as const;

/**
 * El directorio de hospitales, clínicas y centros, desde
 * `GET /public/search/organizations`.
 *
 * Una organización aparece cuando publicó su ficha pública; las que no la
 * publicaron existen en la plataforma y **no** son visibles sin sesión, que es
 * lo que dice el estado vacío.
 *
 * ## Por qué esta pantalla se dibuja en grilla con foto y no en lista
 *
 * Porque un centro de salud se elige como se elige un lugar al que hay que ir.
 * La lista de filas que tenía antes esta pantalla mostraba, por resultado, una
 * inicial gris y dos renglones: cuarenta clínicas indistinguibles, con el
 * nombre repetido como único dato, y la ciudad como único criterio. La forma
 * que sirve para eso es la de los directorios de lugares —foto primero,
 * atributos en una fila que se barre, la acción a mano—, que es lo que pidió
 * el cliente por su nombre: «como InfoCasas».
 *
 * Ver `CentroCard` para lo que la tarjeta pinta y para lo que deliberadamente
 * **no** pinta.
 *
 * ## Por qué el filtro de ciudad sí está y los otros no
 *
 * La maqueta dibuja además especialidad, aseguradora, disponibilidad y precio.
 * `city` se implementó en la API para esta pantalla —en los dos caminos, el
 * del índice y el de SQL, para que siga acotando si OpenSearch se cae— porque
 * es el filtro sin el cual un directorio de lugares no sirve: a nadie le
 * importa una clínica excelente en otra ciudad.
 *
 * Los otros cuatro **no existen en la API**, y dibujarlos habría sido peor que
 * omitirlos: alguien filtra «atiende hoy», la lista no cambia, y la pantalla le
 * dice —sin decirlo— que todos atienden hoy. Un filtro que no filtra no es un
 * pendiente visual: es una respuesta equivocada a una pregunta que la persona
 * sí hizo.
 */
@Component({
  selector: 'app-redsat-buscar-hospitales-listado',
  imports: [CardDetailPanel, CentroCard, FacilityDirectionsDialog, RouterLink],
  templateUrl: './hospitales-listado.html',
  styleUrls: ['./hospitales-listado.css', '../centro-card/centro-grid.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarHospitalesListado {
  private readonly directorio = inject(PublicDirectoryClient);

  /** Las ciudades de los chips, para la plantilla. */
  protected readonly CIUDADES = CIUDADES;

  /**
   * Cuántos esqueletos dibujar mientras carga.
   *
   * Seis y no veinticinco: llenan la primera pantalla en cualquier ancho sin
   * pedirle al navegador que dibuje una página entera de cajas grises que
   * nadie va a ver.
   */
  protected readonly huecos = [0, 1, 2, 3, 4, 5];

  /** La ciudad elegida, o `null` por «todas». */
  protected readonly ciudad = signal<string | null>(null);

  protected readonly busqueda = new BusquedaPublica((filtros) =>
    this.directorio.searchOrganizations(filtros),
  );

  protected readonly centros = computed<readonly FacilityCard[]>(() =>
    this.busqueda.resultados().map(toFacilityCard),
  );

  /**
   * El establecimiento cuyo «Cómo llegar» está abierto; `null` si ninguno.
   *
   * Uno solo a la vez y colgado de la pantalla, no de la tarjeta: el diálogo es
   * modal, y montar veinticinco mapas de Leaflet —uno por tarjeta, apagados—
   * descarga el chunk veinticinco veces para no mostrar nada.
   */
  protected readonly comoLlegar = signal<FacilityCard | null>(null);

  /**
   * El recuento de arriba de la grilla.
   *
   * Dice «aproximadamente» cuando hay pista de total porque `totalHint` es
   * exactamente eso —una pista, no un `COUNT`—, y cuando no la hay cuenta lo
   * que se está viendo, que es cierto. Afirmar «54 centros» sobre una
   * estimación sería inventar precisión que la API no calculó.
   */
  protected readonly recuento = computed(() => {
    const total = this.busqueda.totalHint();
    const vistos = this.busqueda.resultados().length;
    const donde = this.ciudad() === null ? '' : ` en ${this.ciudad()}`;
    if (total !== null) {
      return `Aproximadamente ${total} ${total === 1 ? 'centro' : 'centros'}${donde}`;
    }
    return `${vistos} ${vistos === 1 ? 'centro' : 'centros'}${donde} en esta página`;
  });

  /** Escribir lleva el texto a `?q=`; el cambio de la URL dispara la lectura. */
  protected alEscribir(valor: string): void {
    this.busqueda.escribir(valor);
  }

  /** Abre «Cómo llegar» del establecimiento elegido. */
  protected abrirComoLlegar(centro: FacilityCard): void {
    this.comoLlegar.set(centro);
  }

  protected cerrarComoLlegar(): void {
    this.comoLlegar.set(null);
  }

  /**
   * Cambiar de ciudad vuelve a la primera página.
   *
   * Conservar la posición sería peor: el cursor pertenece a la lista anterior,
   * y la página 3 de La Paz no es la página 3 de Cochabamba.
   */
  protected alElegirCiudad(nombre: string | null): void {
    this.ciudad.set(nombre);
    this.busqueda.ciudad.set(nombre ?? '');
    this.busqueda.buscar();
  }
}
