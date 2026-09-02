import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { CentroTarjeta } from './centro-card.types';

/**
 * Un centro de salud **en tarjeta con portada**.
 *
 * ## Por qué el directorio de centros no usa `result-card`
 *
 * `result-card` describe un resultado de directorio genérico: figura de 56 px,
 * título, dos líneas de contexto. Sirve para comparar profesionales, donde lo
 * que decide es el nombre, la especialidad y el sello.
 *
 * Un centro de salud no se elige así. Se elige como se elige un lugar al que
 * hay que ir: mirando qué es, dónde queda y qué cara tiene. Con la tarjeta
 * genérica, cuarenta clínicas se ven exactamente iguales —una inicial gris y
 * dos renglones— y la única forma de distinguirlas es abrirlas de a una. Por
 * eso acá la foto ocupa el primer tercio de la tarjeta y los atributos van en
 * una fila que se barre de un vistazo, que es la forma que tienen los
 * directorios de lugares (el cliente la pidió por su nombre: «como InfoCasas»).
 *
 * ## Lo que no inventa
 *
 * Todo lo que pinta sale de `PublicSearchResult`, campo por campo. La maqueta
 * de un portal inmobiliario muestra además precio, superficie y antigüedad; el
 * equivalente en salud —precio de consulta, tiempo de espera, camas libres— la
 * API **no lo sirve**, así que la tarjeta lo omite en vez de rellenarlo. Un
 * precio inventado en un directorio de salud no es un pendiente de diseño: es
 * alguien que llega con Bs 200 a una consulta de Bs 350.
 *
 * ## Lo que proyecta
 *
 * El pie (`<ng-content>`): ahí van los botones que cada listado necesite —«Ver
 * ficha», «Cómo llegar»—. Sin contenido proyectado, el pie no se dibuja.
 */
@Component({
  selector: 'li[app-centro-card]',
  imports: [RouterLink],
  templateUrl: './centro-card.html',
  styleUrl: './centro-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CentroCard {
  /** El centro a pintar. */
  readonly centro = input.required<CentroTarjeta>();
}
