import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { iconoDeEspecialidad, type SpecialtyIconName } from './specialty-icon.types';

/**
 * El ícono de una especialidad médica.
 *
 * ## Cómo se usa
 *
 * Se le pasa el **nombre** de la especialidad y él resuelve el dibujo; quien lo
 * monta no elige el glifo:
 *
 * ```html
 * <app-specialty-icon [especialidad]="tarjeta.nombre" />
 * ```
 *
 * Resolver adentro y no en cada plantilla es lo que hace que la portada del
 * directorio y el encabezado de grupo del listado público muestren el **mismo**
 * dibujo para «Cardiología», que es lo único que un ícono aporta. Si cada
 * pantalla eligiera el suyo, se separarían en el primer retoque.
 *
 * ## Un solo `<svg>` y el `@switch` sólo sobre los trazos
 *
 * Igual que `nav-icon` y por el mismo motivo: repetir el elemento con sus ocho
 * atributos en veintiún casos son doscientas líneas de atributo copiado donde
 * un `stroke-width` distinto pasa desapercibido.
 *
 * Glyphs come from Tabler Icons (MIT, v3.24) on its 24 px grid; organs Tabler
 * lacks (uterus, thyroid, stomach, kidneys, scalpel, mind) are drawn on the same
 * grid and stroke rules. The same glyphs are the art in `public/especialidades/`.
 *
 * ## Siempre `aria-hidden`
 *
 * El ícono nunca es el nombre accesible: la tarjeta ya escribe la especialidad
 * al lado. Anunciarlo diría «imagen» dieciocho veces en la misma pantalla.
 */
@Component({
  selector: 'app-specialty-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'specialty-icon',
    'aria-hidden': 'true',
  },
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @switch (icono()) {
        @case ('cardiologia') {
          <path d="M19.5 13.572l-7.5 7.428l-2.896 -2.868m-6.117 -8.104a5 5 0 0 1 9.013 -3.022a5 5 0 1 1 7.5 6.572" />
          <path d="M3 13h2l2 3l2 -6l1 3h3" />
        }
        @case ('pediatria') {
          <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
          <path d="M9 10l.01 0" />
          <path d="M15 10l.01 0" />
          <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
          <path d="M12 3a2 2 0 0 0 0 4" />
        }
        @case ('ginecologia') {
          <path d="M7 5c2 0 3 1 3 3v1c0 1 .5 2 2 2s2 -1 2 -2v-1c0 -2 1 -3 3 -3" />
          <path d="M10 9c-2 1 -3 3 -3 5.5c0 2.5 2 4.5 5 4.5s5 -2 5 -4.5c0 -2.5 -1 -4.5 -3 -5.5" />
          <path d="M12 19v2.5" />
          <circle cx="5" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
        }
        @case ('dermatologia') {
          <circle cx="10" cy="10" r="6" />
          <path d="M14.5 14.5l6 6" />
          <path d="M8 8.5v.01M11.5 11v.01M8.5 12.5v.01" />
        }
        @case ('traumatologia') {
          <path d="M15 3a3 3 0 0 1 3 3a3 3 0 1 1 -2.12 5.122l-4.758 4.758a3 3 0 1 1 -5.117 2.297l0 -.177l-.176 0a3 3 0 1 1 2.298 -5.115l4.758 -4.758a3 3 0 0 1 2.12 -5.122z" />
        }
        @case ('neurologia') {
          <path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" />
          <path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" />
          <path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" />
          <path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" />
          <path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5" />
          <path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" />
        }
        @case ('psiquiatria') {
          <path d="M15 21v-3.5h1.5a2 2 0 0 0 2 -2v-2.5l1.5 -.5l-1.5 -3a7 7 0 1 0 -11.5 5.5v6" />
          <path d="M11.5 10.5a.8 .8 0 1 1 .8 .8a1.8 1.8 0 0 1 -1.8 -1.8a2.6 2.6 0 0 1 2.6 -2.6a3.4 3.4 0 0 1 3.4 3.4" />
        }
        @case ('oftalmologia') {
          <path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
          <path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
        }
        @case ('odontologia') {
          <path d="M12 5.5c-1.074 -.586 -2.583 -1.5 -4 -1.5c-2.1 0 -4 1.247 -4 5c0 4.899 1.056 8.41 2.671 10.537c.573 .756 1.97 .521 2.567 -.236c.398 -.505 .819 -1.439 1.262 -2.801c.292 -.771 .892 -1.504 1.5 -1.5c.602 0 1.21 .737 1.5 1.5c.443 1.362 .864 2.295 1.262 2.8c.597 .759 2 .993 2.567 .237c1.615 -2.127 2.671 -5.637 2.671 -10.537c0 -3.74 -1.908 -5 -4 -5c-1.423 0 -2.92 .911 -4 1.5z" />
          <path d="M12 5.5l3 1.5" />
        }
        @case ('endocrinologia') {
          <path d="M12 3v18" />
          <path d="M12 9c-1 -3 -3 -4.5 -5 -4c-2.5 .7 -3 4 -2 7c.8 2.5 2.5 4 4.5 4c1.5 0 2.5 -1.5 2.5 -3.5" />
          <path d="M12 9c1 -3 3 -4.5 5 -4c2.5 .7 3 4 2 7c-.8 2.5 -2.5 4 -4.5 4c-1.5 0 -2.5 -1.5 -2.5 -3.5" />
        }
        @case ('gastroenterologia') {
          <path d="M9 3v4.5c-2.8 1 -5 3.8 -5 7c0 3.6 3 6.5 7.5 6.5c3.6 0 6.5 -2.2 6.5 -5v-1.5h3" />
          <path d="M12 3v5c0 2.5 1.5 4 4 4h2v1.5" />
        }
        @case ('neumologia') {
          <path d="M6.081 20c1.612 0 2.919 -1.335 2.919 -2.98v-9.763c0 -.694 -.552 -1.257 -1.232 -1.257c-.205 0 -.405 .052 -.584 .15l-.13 .083c-1.46 1.059 -2.432 2.647 -3.404 5.824c-.42 1.37 -.636 2.962 -.648 4.775c-.012 1.675 1.261 3.054 2.877 3.161l.203 .007z" />
          <path d="M17.92 20c-1.613 0 -2.92 -1.335 -2.92 -2.98v-9.763c0 -.694 .552 -1.257 1.233 -1.257c.204 0 .405 .052 .584 .15l.13 .083c1.46 1.059 2.432 2.647 3.405 5.824c.42 1.37 .636 2.962 .648 4.775c.012 1.675 -1.261 3.054 -2.878 3.161l-.202 .007z" />
          <path d="M9 12a3 3 0 0 0 3 -3a3 3 0 0 0 3 3" />
          <path d="M12 4v5" />
        }
        @case ('urologia') {
          <path d="M7.5 3c-2.5 0 -4.5 2.2 -4.5 5s2 5 4.5 5c1.2 0 2 -.8 2 -1.7c0 -1.1 -1.4 -1.7 -1.4 -3.3s1.4 -2.2 1.4 -3.3c0 -.9 -.8 -1.7 -2 -1.7z" />
          <path d="M16.5 3c2.5 0 4.5 2.2 4.5 5s-2 5 -4.5 5c-1.2 0 -2 -.8 -2 -1.7c0 -1.1 1.4 -1.7 1.4 -3.3s-1.4 -2.2 -1.4 -3.3c0 -.9 .8 -1.7 2 -1.7z" />
          <path d="M8.5 8.5c1.5 0 2.5 2 2.5 8" />
          <path d="M15.5 8.5c-1.5 0 -2.5 2 -2.5 8" />
          <path d="M9 17.5a3 3 0 0 0 6 0v-1h-6z" />
          <path d="M12 20.5v1" />
        }
        @case ('nutricion') {
          <path d="M4 11.319c0 3.102 .444 5.319 2.222 7.978c1.351 1.797 3.156 2.247 5.08 .988c.426 -.268 .97 -.268 1.397 0c1.923 1.26 3.728 .809 5.079 -.988c1.778 -2.66 2.222 -4.876 2.222 -7.977c0 -2.661 -1.99 -5.32 -4.444 -5.32c-1.267 0 -2.41 .693 -3.22 1.44a.5 .5 0 0 1 -.672 0c-.809 -.746 -1.953 -1.44 -3.22 -1.44c-2.454 0 -4.444 2.66 -4.444 5.319" />
          <path d="M7 12c0 -1.47 .454 -2.34 1.5 -3" />
          <path d="M12 7c0 -1.2 .867 -4 3 -4" />
        }
        @case ('fisioterapia') {
          <path d="M9 15l-1 -3l4 -2l4 1h3.5" />
          <path d="M4 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
          <path d="M12 6m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
          <path d="M12 17v-7" />
          <path d="M8 20h7l1 -4l4 -2" />
          <path d="M18 20h3" />
        }
        @case ('anestesiologia') {
          <path d="M17 3l4 4" />
          <path d="M19 5l-4.5 4.5" />
          <path d="M11.5 6.5l6 6" />
          <path d="M16.5 11.5l-6.5 6.5h-4v-4l6.5 -6.5" />
          <path d="M7.5 12.5l1.5 1.5" />
          <path d="M10.5 9.5l1.5 1.5" />
          <path d="M3 21l3 -3" />
        }
        @case ('oncologia') {
          <path d="M7 21s9.286 -9.841 9.286 -13.841a3.864 3.864 0 0 0 -1.182 -3.008a4.13 4.13 0 0 0 -3.104 -1.144a4.13 4.13 0 0 0 -3.104 1.143a3.864 3.864 0 0 0 -1.182 3.01c0 4 9.286 13.84 9.286 13.84" />
        }
        @case ('otorrinolaringologia') {
          <path d="M6 10a7 7 0 1 1 13 3.6a10 10 0 0 1 -2 2a8 8 0 0 0 -2 3a4.5 4.5 0 0 1 -6.8 1.4" />
          <path d="M10 10a3 3 0 1 1 5 2.2" />
        }
        @case ('hematologia') {
          <path d="M18.602 12.004a6.66 6.66 0 0 0 -.538 -1.127l-4.89 -7.26c-.42 -.625 -1.287 -.803 -1.936 -.397a1.376 1.376 0 0 0 -.41 .397l-4.893 7.26c-1.695 2.838 -1.035 6.441 1.567 8.546a7.16 7.16 0 0 0 5.033 1.56" />
          <path d="M16 19h6" />
          <path d="M19 16v6" />
        }
        @case ('medicina-interna') {
          <path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2" />
          <path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z" />
          <path d="M10 14l4 0" />
          <path d="M12 12l0 4" />
        }
        @case ('cirugia') {
          <path d="M3 21l7 -7" />
          <path d="M10 14l2.5 -2.5" />
          <path d="M12.5 11.5l7 -7c.8 -.8 2 0 1.5 1l-1.5 2.5c-1.5 2.5 -3.5 4 -7 3.5z" />
          <path d="M7.5 16.5l-1 -1" />
        }
        @default {
          <!-- Stethoscope: general medicine and any specialty without its own glyph. -->
          <path d="M6 4h-1a2 2 0 0 0 -2 2v3.5h0a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1" />
          <path d="M8 15a6 6 0 1 0 12 0v-3" />
          <path d="M11 3v2" />
          <path d="M6 3v2" />
          <path d="M20 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
        }
      }
    </svg>
  `,
})
export class SpecialtyIcon {
  /**
   * El nombre de la especialidad. El dibujo se resuelve de acá.
   *
   * Se acepta `null` porque las dos pantallas que lo montan lo tienen: el
   * agrupador del listado público arma un grupo «Especialidad no informada», y
   * la portada del directorio, uno para quienes no la declararon. Los dos
   * reciben el ícono genérico, que es lo correcto: existen, sólo que sin dato.
   */
  readonly especialidad = input.required<string | null>();

  protected readonly icono = computed<SpecialtyIconName>(() =>
    iconoDeEspecialidad(this.especialidad()),
  );
}
