import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { IsoPais } from './phone-input.paises';

/** Ver `PaisBandera.id`: un id de `clipPath` distinto por instancia. */
let siguienteId = 0;

/**
 * La bandera de un país, dibujada a mano.
 *
 * ## Por qué SVG y no el emoji
 *
 * `🇧🇴` es un par de indicadores regionales, y Windows —donde corre la mitad
 * de este equipo y buena parte de quien se registra— **no trae la fuente que
 * los une en una bandera**: Chrome pinta las dos letras sueltas, «BO». Un
 * selector de país donde las banderas son pares de letras es peor que uno sin
 * banderas, porque promete un reconocimiento visual que no da.
 *
 * ## Por qué sin escudos
 *
 * A veinte píxeles de ancho un escudo es una mancha. Se dibujan las franjas,
 * que es lo que de verdad se reconoce a ese tamaño, y nada más. La
 * consecuencia honesta: **Colombia y Ecuador comparten el mismo dibujo** —sus
 * banderas sólo se distinguen por el escudo—, igual que Venezuela sin sus
 * estrellas. En el desplegable eso no molesta porque al lado va el nombre del
 * país y su prefijo; el dibujo ayuda a encontrar la fila, no a identificarla
 * solo.
 *
 * ## Siempre `aria-hidden`
 *
 * Misma regla que `app-nav-icon`: la bandera es ayuda visual, nunca el nombre
 * accesible. Quien la usa pone el nombre del país al lado o en el `aria-label`
 * del control.
 */
@Component({
  selector: 'app-pais-bandera',
  template: `
    <svg viewBox="0 0 24 16" aria-hidden="true" class="bandera">
      <defs>
        <clipPath [attr.id]="clipId()">
          <rect x="0" y="0" width="24" height="16" rx="2.5" />
        </clipPath>
      </defs>
      <g [attr.clip-path]="'url(#' + clipId() + ')'">
        @switch (iso()) {
          @case ('BO') {
            <rect width="24" height="5.34" y="0" fill="#D52B1E" />
            <rect width="24" height="5.34" y="5.34" fill="#F9E300" />
            <rect width="24" height="5.34" y="10.66" fill="#007934" />
          }
          @case ('AR') {
            <rect width="24" height="5.34" y="0" fill="#74ACDF" />
            <rect width="24" height="5.34" y="5.34" fill="#FFFFFF" />
            <rect width="24" height="5.34" y="10.66" fill="#74ACDF" />
            <circle cx="12" cy="8" r="1.5" fill="#F6B40E" />
          }
          @case ('BR') {
            <rect width="24" height="16" fill="#009B3A" />
            <path d="M12 2.2 22 8l-10 5.8L2 8z" fill="#FEDF00" />
            <circle cx="12" cy="8" r="3.1" fill="#002776" />
          }
          @case ('CL') {
            <rect width="24" height="8" y="0" fill="#FFFFFF" />
            <rect width="24" height="8" y="8" fill="#D52B1E" />
            <rect width="8" height="8" fill="#0039A6" />
            <path d="m4 2.4.85 2.6h2.73l-2.21 1.6.85 2.6L4 7.6l-2.22 1.6.85-2.6L.42 5h2.73z" fill="#FFFFFF" />
          }
          @case ('PY') {
            <rect width="24" height="5.34" y="0" fill="#D52B1E" />
            <rect width="24" height="5.34" y="5.34" fill="#FFFFFF" />
            <rect width="24" height="5.34" y="10.66" fill="#0038A8" />
          }
          @case ('PE') {
            <rect width="8" height="16" x="0" fill="#D91023" />
            <rect width="8" height="16" x="8" fill="#FFFFFF" />
            <rect width="8" height="16" x="16" fill="#D91023" />
          }
          @case ('UY') {
            <rect width="24" height="16" fill="#FFFFFF" />
            <rect width="24" height="1.8" y="3.6" fill="#0038A8" />
            <rect width="24" height="1.8" y="7.2" fill="#0038A8" />
            <rect width="24" height="1.8" y="10.8" fill="#0038A8" />
            <rect width="10" height="7.2" fill="#FFFFFF" />
            <circle cx="5" cy="3.6" r="1.9" fill="#F6B40E" />
          }
          @case ('CO') {
            <rect width="24" height="8" y="0" fill="#FCD116" />
            <rect width="24" height="4" y="8" fill="#003893" />
            <rect width="24" height="4" y="12" fill="#CE1126" />
          }
          @case ('EC') {
            <rect width="24" height="8" y="0" fill="#FFDD00" />
            <rect width="24" height="4" y="8" fill="#0072CE" />
            <rect width="24" height="4" y="12" fill="#EF3340" />
          }
          @case ('VE') {
            <rect width="24" height="5.34" y="0" fill="#FFCC00" />
            <rect width="24" height="5.34" y="5.34" fill="#00247D" />
            <rect width="24" height="5.34" y="10.66" fill="#CF142B" />
          }
          @case ('ES') {
            <rect width="24" height="4" y="0" fill="#AA151B" />
            <rect width="24" height="8" y="4" fill="#F1BF00" />
            <rect width="24" height="4" y="12" fill="#AA151B" />
          }
          @case ('US') {
            <rect width="24" height="16" fill="#FFFFFF" />
            <rect width="24" height="1.23" y="0" fill="#B22234" />
            <rect width="24" height="1.23" y="2.46" fill="#B22234" />
            <rect width="24" height="1.23" y="4.92" fill="#B22234" />
            <rect width="24" height="1.23" y="7.38" fill="#B22234" />
            <rect width="24" height="1.23" y="9.84" fill="#B22234" />
            <rect width="24" height="1.23" y="12.3" fill="#B22234" />
            <rect width="24" height="1.23" y="14.76" fill="#B22234" />
            <rect width="10" height="8.61" fill="#3C3B6E" />
          }
          @case ('MX') {
            <rect width="8" height="16" x="0" fill="#006847" />
            <rect width="8" height="16" x="8" fill="#FFFFFF" />
            <rect width="8" height="16" x="16" fill="#CE1126" />
          }
        }
        <!-- Un borde interior tenue: sin él, la franja blanca de Perú o México
             se funde con el fondo del campo y la bandera pierde su marco. -->
        <rect x="0.25" y="0.25" width="23.5" height="15.5" rx="2.25" fill="none" stroke="rgb(0 0 0 / 18%)" stroke-width="0.5" />
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }

    .bandera {
      display: block;
      width: 1.25rem;
      height: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaisBandera {
  readonly iso = input.required<IsoPais>();

  /**
   * El `clipPath` necesita un id único por instancia.
   *
   * Con un id fijo, la segunda bandera de la página reusaría el recorte de la
   * primera —los ids de SVG son globales al documento— y basta con que Angular
   * destruya la primera para que las demás se queden sin recorte y aparezcan
   * con las esquinas cuadradas. Se ve en el desplegable, que pinta trece.
   *
   * Un contador de módulo y no `crypto.randomUUID()`: esto se pinta también en
   * el servidor, y un id distinto en cada render rompería la hidratación.
   */
  private readonly id = `bandera-${(siguienteId += 1)}`;

  protected readonly clipId = (): string => this.id;
}
