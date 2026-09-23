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
 * El trazo es 1,5 y el encuadre centrado en 12 con unos 2 px de aire, que es la
 * misma regla del set del nav: estos íconos se ven juntos —una rejilla de
 * dieciocho especialidades— y un dibujo descentrado se lee como un renglón
 * torcido sin que se sepa por qué.
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
          <!-- Corazón con el trazo del electrocardiograma cruzándolo: el
               corazón solo es el «me gusta» de media internet, y la onda es lo
               que lo vuelve clínico. -->
          <path d="M12 20.5 4.8 13a4.6 4.6 0 0 1 6.5-6.5l.7.7.7-.7A4.6 4.6 0 0 1 19.2 13Z" />
          <path d="M4.6 12.4h3.2l1.4-2.6 2 5 1.5-3.1 1 1.5h3.7" />
        }
        @case ('pediatria') {
          <!-- Osito: cabeza con dos orejas. Es el dibujo del consultorio de
               niños, y no una persona más chica —una silueta reducida no se
               distingue de la de adultos a 24 px—. -->
          <circle cx="12" cy="13" r="6" />
          <circle cx="6.4" cy="6.6" r="2.6" />
          <circle cx="17.6" cy="6.6" r="2.6" />
          <path d="M10 12.2h.01M14 12.2h.01" />
          <path d="M10.2 15.4a2.4 2.4 0 0 0 3.6 0" />
        }
        @case ('ginecologia') {
          <!-- Útero con sus trompas y ovarios. -->
          <path d="M8 4.5v3a4 4 0 0 0 1.9 3.4A3.4 3.4 0 0 1 11.6 14v5.5h.8V14a3.4 3.4 0 0 1 1.7-3.1A4 4 0 0 0 16 7.5v-3" />
          <circle cx="6.2" cy="5" r="1.8" />
          <circle cx="17.8" cy="5" r="1.8" />
          <path d="M9.6 19.5h4.8" />
        }
        @case ('dermatologia') {
          <!-- Un trozo de piel con su lupa: la dermatología se diagnostica
               mirando de cerca, y la lupa es lo que lo dice sin texto. -->
          <path d="M4 7.5a3 3 0 0 1 3-3h8.5a3 3 0 0 1 3 3v4" />
          <path d="M4 7.5V17a3 3 0 0 0 3 3h4.5" />
          <path d="M7.4 9.4h.01M10.6 12.2h.01M7.6 15.2h.01" />
          <circle cx="16.4" cy="15.4" r="3.2" />
          <path d="m18.8 17.8 2.2 2.2" />
        }
        @case ('traumatologia') {
          <!-- Un hueso largo con sus dos cabezas. -->
          <path d="M6.6 4.4a2.1 2.1 0 0 0-1.7 3.3 2.1 2.1 0 0 0 .6 3.1l6.4 6.4a2.1 2.1 0 0 0 3.1.6 2.1 2.1 0 1 0 2.5-3.4L11 8" />
          <path d="M6.6 4.4A2.1 2.1 0 1 1 9.9 6.9" />
          <path d="M17.5 17.8a2.1 2.1 0 1 1-3.3-2.5" />
        }
        @case ('neurologia') {
          <!-- Cerebro: el perfil con sus circunvoluciones. -->
          <path d="M12 5.2a3 3 0 0 0-5.4 1.4A2.8 2.8 0 0 0 4.4 10a2.9 2.9 0 0 0 .9 3.6A3 3 0 0 0 8.6 19a2.9 2.9 0 0 0 3.4-.9Z" />
          <path d="M12 5.2a3 3 0 0 1 5.4 1.4A2.8 2.8 0 0 1 19.6 10a2.9 2.9 0 0 1-.9 3.6 3 3 0 0 1-3.3 5.4 2.9 2.9 0 0 1-3.4-.9Z" />
          <path d="M12 5.2v13" />
        }
        @case ('psiquiatria') {
          <!-- Cabeza de perfil con una espiral adentro: la mente, no el
               órgano. Es lo que la separa de neurología, que dibuja el cerebro
               entero. -->
          <path d="M19 20v-2.6a7.4 7.4 0 1 0-4 1.2V20" />
          <path d="M12.8 12.4a1.5 1.5 0 1 0-1.5-1.5 2.4 2.4 0 0 0 2.4 2.4A3.4 3.4 0 0 0 17 9.9" />
        }
        @case ('oftalmologia') {
          <!-- Ojo con su iris. -->
          <path d="M2.6 12S6 6.4 12 6.4 21.4 12 21.4 12 18 17.6 12 17.6 2.6 12 2.6 12Z" />
          <circle cx="12" cy="12" r="2.9" />
        }
        @case ('odontologia') {
          <!-- Muela con sus dos raíces. -->
          <path d="M6 8.6C6 5.9 8 4.2 10.3 5a4.6 4.6 0 0 0 3.4 0C16 4.2 18 5.9 18 8.6c0 2.2-.7 3.3-1.1 5.3l-.7 4.2a1.5 1.5 0 0 1-2.9.1L12 13.6l-1.3 4.6a1.5 1.5 0 0 1-2.9-.1l-.7-4.2C6.7 11.9 6 10.8 6 8.6Z" />
        }
        @case ('endocrinologia') {
          <!-- Tiroides: la glándula con forma de mariposa sobre la tráquea. -->
          <path d="M12 7.6v8.2" />
          <path d="M12 8.4C10.8 6.6 8.6 6 7 6.8c-2 1-2.4 4-1.2 6.2 1 1.9 3.3 2.6 5 1.5 1-.6 1.2-1.6 1.2-2.6" />
          <path d="M12 8.4c1.2-1.8 3.4-2.4 5-1.6 2 1 2.4 4 1.2 6.2-1 1.9-3.3 2.6-5 1.5-1-.6-1.2-1.6-1.2-2.6" />
          <path d="M9.8 4.6h4.4" />
        }
        @case ('gastroenterologia') {
          <!-- Estómago con su entrada y su salida al duodeno. -->
          <path d="M9.4 4v3.3a5.6 5.6 0 0 0-3 5c0 3.4 2.6 6.1 5.9 6.1 3 0 5-1.9 5-4.2 0-1.8-1.2-3-2.8-3" />
          <path d="M7.6 4h3.6" />
          <path d="M14.5 11.2c1.2 0 2 .5 2.4 1.2" />
        }
        @case ('neumologia') {
          <!-- Pulmones con la tráquea. -->
          <path d="M12 3.6v7.6" />
          <path d="M9.6 7.4C8 7.4 7 8.6 6.6 10.4l-1.2 5c-.4 1.9.7 3.4 2.4 3.4h1.3c1.3 0 2.3-1 2.3-2.3v-6c0-1.7-.6-3.1-2-3.1Z" />
          <path d="M14.4 7.4c1.6 0 2.6 1.2 3 3l1.2 5c.4 1.9-.7 3.4-2.4 3.4h-1.3c-1.3 0-2.3-1-2.3-2.3v-6c0-1.7.6-3.1 2-3.1Z" />
        }
        @case ('urologia') {
          <!-- Un riñón con su uréter. -->
          <path d="M13.6 4.4C9.6 4.4 6.6 7.6 6.6 12s3 7.6 7 7.6c1.6 0 2.6-1 2.6-2.4 0-1.6-1.6-2.3-1.6-4.2 0-2 2.4-2.6 2.4-4.6 0-2.4-1.6-4-3.4-4Z" />
          <path d="M13.4 12.2c1.5 0 2.6.6 3.4 1.6" />
        }
        @case ('nutricion') {
          <!-- Manzana con su hoja: el alimento, no el plato —un plato con
               cubiertos es el ícono de un restaurante—. -->
          <path d="M12 7.6c-.9-.8-2-1.2-3.1-1.2C6.6 6.4 5 8.6 5 11.6c0 3.8 2.6 8 4.8 8 .9 0 1.5-.5 2.2-.5s1.3.5 2.2.5c2.2 0 4.8-4.2 4.8-8 0-3-1.6-5.2-3.9-5.2-1.1 0-2.2.4-3.1 1.2Z" />
          <path d="M12 7.6V5.2" />
          <path d="M12 5.2c1.6 0 2.9-1 3.2-2.2-1.7-.3-3 .6-3.2 2.2Z" />
        }
        @case ('fisioterapia') {
          <!-- Persona en movimiento: la rehabilitación es recuperar el
               movimiento, y eso no lo dice ni un hueso ni una camilla. -->
          <circle cx="13.4" cy="4.6" r="2" />
          <path d="M8 20.4l2.6-4.8 1-4.4-2.8 1.6-1.2 2.8" />
          <path d="M11.6 11.2 15 9.2l2.4 2.6 2.6 1" />
          <path d="m13.6 15.6 2.2 1.6.8 3.2" />
        }
        @case ('anestesiologia') {
          <!-- Jeringa con su émbolo y su aguja. -->
          <path d="m4 20 3.2-3.2" />
          <path d="m9.4 10.2 4.4 4.4-4 4a1.6 1.6 0 0 1-2.2 0l-2.2-2.2a1.6 1.6 0 0 1 0-2.2Z" />
          <path d="m13 6.6 4.4 4.4" />
          <path d="m11.8 7.8 4.4 4.4 2.6-2.6-4.4-4.4Z" />
          <path d="m17.4 4.4 2.2 2.2" />
          <path d="m10.6 13 1.8 1.8" />
        }
        @case ('oncologia') {
          <!-- El lazo de la lucha contra el cáncer. -->
          <path d="M9.6 20.4 12 12.6l2.4 7.8" />
          <path d="M12 12.6c-2.6-2-4-4-4-6.2A3.2 3.2 0 0 1 12 3.6a3.2 3.2 0 0 1 4 2.8c0 2.2-1.4 4.2-4 6.2Z" />
        }
        @case ('otorrinolaringologia') {
          <!-- Una oreja con las ondas del sonido. -->
          <path d="M8 9.4a4 4 0 0 1 8 0c0 2.4-1.8 3.2-2.8 4.4-.8 1-.6 2.4-.6 3.2a2.6 2.6 0 0 1-5.2 0" />
          <path d="M11 9.6a1.2 1.2 0 0 1 2.4 0c0 1-.8 1.4-1.2 2" />
          <path d="M18.6 5.6a7 7 0 0 1 0 12.8" />
        }
        @case ('hematologia') {
          <!-- Gota de sangre con su célula adentro. -->
          <path d="M12 3.6c3 4 5.4 6.8 5.4 9.6a5.4 5.4 0 0 1-10.8 0c0-2.8 2.4-5.6 5.4-9.6Z" />
          <circle cx="12" cy="13.6" r="2.2" />
        }
        @case ('medicina-interna') {
          <!-- Torso con la cruz: la atención integral del adulto. El
               estetoscopio es el de «general», y usarlo acá dejaría a las dos
               con el mismo dibujo. -->
          <path d="M12 3.6c-2.6 0-4.6 1-6 1.6v6.4c0 4.4 2.6 7 6 8.8 3.4-1.8 6-4.4 6-8.8V5.2c-1.4-.6-3.4-1.6-6-1.6Z" />
          <path d="M12 8.6v5.6M9.2 11.4h5.6" />
        }
        @default {
          <!-- Estetoscopio: la medicina general y todo lo que el set todavía
               no dibuja. Es el genérico honesto —dice «esto es medicina»— y no
               un signo de pregunta, que se leería como un error. -->
          <path d="M6.4 3.6v5.2a4 4 0 0 0 8 0V3.6" />
          <path d="M4.8 3.6h3.2M12.8 3.6H16" />
          <path d="M10.4 12.8v2.4a4.6 4.6 0 0 0 9.2 0v-1.4" />
          <circle cx="19.6" cy="11.6" r="2" />
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
