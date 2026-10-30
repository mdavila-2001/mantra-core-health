import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { AccountIconName } from './account-icon.types';

/**
 * El ícono de un tipo de cuenta, para la rejilla de «crear cuenta», la entrada y
 * la cabecera de cada alta.
 *
 * Mismo trazo que `app-nav-icon` —`viewBox` de 24, `currentColor`, 1.6 de
 * grosor, extremos redondeados— y por la misma razón: son el mismo lenguaje
 * visual y un set con dos grosores distintos se nota aunque nadie sepa decir por
 * qué. No se reutiliza `nav-icon` porque su set es **cerrado y de navegación**:
 * meterle un estetoscopio obligaría a que el menú lateral lo acepte como
 * sección.
 *
 * ## Duotono, con una sola tinta
 *
 * Cada dibujo lleva el contorno a plena tinta y, debajo, la masa de la figura a
 * 14 % de la misma `currentColor`. No hay un segundo color que elegir ni que
 * revisar en oscuro: el relleno es la misma tinta aclarada por transparencia, y
 * por eso el ícono lee igual sobre cualquier superficie del tema.
 *
 * ## Se dibuja al nacer y juega cuando se lo toca
 *
 * El contorno se traza una vez al aparecer (`pathLength` normalizado, así que el
 * mismo `dasharray` sirve para un círculo y para una curva). Y cada tipo tiene
 * una animación propia que dice qué es: el corazón del seguro late, el tubo del
 * laboratorio sube su nivel, el barrido de imagenología recorre el cuadro.
 *
 * Quien quiera que el ícono juegue marca su contenedor interactivo con
 * `data-icon-play`: el ícono responde al `:hover` y al `:focus-visible` de ese
 * ancestro. Se resolvió con un atributo y no con un `@Input` porque el estado
 * de apuntar ya lo lleva el navegador, y reflejarlo en una señal por tarjeta
 * sería código para repetir lo que CSS ya sabe.
 *
 * Todo se apaga con `prefers-reduced-motion`: queda el dibujo terminado.
 *
 * ## Siempre `aria-hidden`
 *
 * El ícono no es el nombre de la tarjeta: al lado va el rótulo («Paciente») y su
 * explicación. Anunciarlo diría «imagen» tres veces en una pantalla de tres
 * opciones, que es ruido justo donde hay que decidir.
 */
@Component({
  selector: 'app-account-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (name()) {
        @case ('patient') {
          <!-- Una persona, con la cruz de salud al hombro. Lo que se registra es
               alguien, no un expediente. -->
          <circle class="mass" cx="12" cy="8" r="3.6" stroke="none" />
          <path
            class="mass"
            stroke="none"
            d="M4.75 20.5v-1A5.25 5.25 0 0 1 10 14.25h4a5.25 5.25 0 0 1 5.25 5.25v1Z"
          />
          <circle class="draw" pathLength="1" cx="12" cy="8" r="3.6" />
          <path
            class="draw"
            pathLength="1"
            d="M4.75 20.5v-1A5.25 5.25 0 0 1 10 14.25h4a5.25 5.25 0 0 1 5.25 5.25v1"
          />
          <g class="cross">
            <path d="M19 2.25v4.5M16.75 4.5h4.5" />
          </g>
        }
        @case ('practitioner') {
          <!-- Un estetoscopio: la herramienta, no el título. Se reconoce sin
               leer. La campana oscila y emite un anillo, como al auscultar. -->
          <path class="draw" pathLength="1" d="M5 3.5v5.5a5 5 0 0 0 10 0V3.5" />
          <path class="draw" pathLength="1" d="M3.5 3.5h3M13.5 3.5h3" />
          <path class="draw" pathLength="1" d="M10 14v1.75a4.25 4.25 0 0 0 8.5 0v-1.5" />
          <g class="bell">
            <circle class="mass" stroke="none" cx="18.5" cy="11.5" r="2.25" />
            <circle cx="18.5" cy="11.5" r="2.25" />
          </g>
          <circle class="echo" cx="18.5" cy="11.5" r="2.25" />
        }
        @case ('insurer') {
          <!-- Un escudo con un corazón: cobertura de salud, no una sucursal. El
               corazón late. -->
          <path
            class="mass"
            stroke="none"
            d="M12 3.25 4.75 6.1v5.15c0 4.3 3.05 7.4 7.25 8.65 4.2-1.25 7.25-4.35 7.25-8.65V6.1L12 3.25Z"
          />
          <path
            class="draw"
            pathLength="1"
            d="M12 3.25 4.75 6.1v5.15c0 4.3 3.05 7.4 7.25 8.65 4.2-1.25 7.25-4.35 7.25-8.65V6.1L12 3.25Z"
          />
          <path
            class="heart"
            d="M12 15.1c-1.6-1-3-2.2-3-3.6a1.75 1.75 0 0 1 3-1.15 1.75 1.75 0 0 1 3 1.15c0 1.4-1.4 2.6-3 3.6Z"
          />
        }
        @case ('laboratory') {
          <!-- Un tubo de ensayo con su muestra: es la sangre lo que se analiza,
               y se reconoce sin leer. No un microscopio —eso es investigación—
               ni un edificio, que sería cualquier empresa. La muestra sube. -->
          <path class="draw" pathLength="1" d="M9 3.25h6" />
          <path class="draw" pathLength="1" d="M10.25 3.25v13.5a1.75 1.75 0 0 0 3.5 0V3.25" />
          <g class="sample">
            <path class="mass" stroke="none" d="M10.25 12.5h3.5v4.25a1.75 1.75 0 0 1-3.5 0Z" />
            <path d="M10.25 12.5h3.5" />
          </g>
          <circle class="bubble bubble--a" cx="12" cy="15.5" r="0.7" stroke="none" />
          <circle class="bubble bubble--b" cx="12.4" cy="16.2" r="0.5" stroke="none" />
          <path class="draw" pathLength="1" d="M6.5 20.75h11" />
        }
        @case ('imaging') {
          <!-- Cuatro esquinas y la línea del barrido: el mismo dibujo con el que
               app-nav-icon dice «imagenología» en el menú, porque decir lo mismo
               de dos maneras obliga a aprender dos. No es un tubo de ensayo
               —eso es el laboratorio de al lado— ni una placa con un hueso, que
               a 24 píxeles es una mancha. El barrido recorre el cuadro. -->
          <rect class="mass" stroke="none" x="4" y="4.4" width="16" height="15.2" rx="2" />
          <path
            class="draw"
            pathLength="1"
            d="M3 8.6V5.8A2.4 2.4 0 0 1 5.4 3.4h2.8M15.8 3.4h2.8A2.4 2.4 0 0 1 21 5.8v2.8"
          />
          <path
            class="draw"
            pathLength="1"
            d="M21 15.4v2.8a2.4 2.4 0 0 1-2.4 2.4h-2.8M8.2 20.6H5.4A2.4 2.4 0 0 1 3 18.2v-2.8"
          />
          <path class="sweep" d="M6.4 12h11.2" />
        }
        @case ('pharmacy') {
          <!-- La cruz de farmacia enmarcada: es el signo con el que se
               reconoce una farmacia en la calle, no un frasco de pastillas
               —que a 24 píxeles se confunde con cualquier envase— ni un
               edificio, que sería cualquier empresa. La cruz gira un cuarto. -->
          <rect class="mass" stroke="none" x="3.25" y="3.25" width="17.5" height="17.5" rx="4" />
          <rect class="draw" pathLength="1" x="3.25" y="3.25" width="17.5" height="17.5" rx="4" />
          <g class="pharmacy-cross">
            <path d="M12 8v8M8 12h8" />
          </g>
        }
        @case ('clinic') {
          <!-- Un edificio con la cruz de salud en la fachada: un centro médico
               es un lugar al que se va, no una persona ni un frasco. No lleva
               el marco de la farmacia ni el barrido de imagenología, para que
               las tres altas de organización se distingan sin leer el rótulo.
               La cruz late como la del paciente. -->
          <rect class="mass" stroke="none" x="5" y="7.5" width="14" height="13" rx="1.5" />
          <path
            class="draw"
            pathLength="1"
            d="M3 20.75h18M5.5 20.75V9.4a2 2 0 0 1 1-1.73l4.5-2.6a2 2 0 0 1 2 0l4.5 2.6a2 2 0 0 1 1 1.73v11.35"
          />
          <g class="cross">
            <path d="M12 9.5v5M9.5 12h5" />
          </g>
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }

    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    /* La masa de la figura: la misma tinta, a 14 %. */
    .mass {
      fill: currentColor;
      fill-opacity: 0.14;
    }

    /* Todo lo que se anima gira o escala sobre su propio centro, no sobre el
       del lienzo. */
    .cross,
    .bell,
    .heart,
    .sample,
    .sweep,
    .pharmacy-cross,
    .echo,
    .bubble {
      transform-box: fill-box;
      transform-origin: center;
    }

    /* ---- Entrada: el contorno se traza una vez. ----------------------------- */
    .draw {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: icon-draw 780ms var(--ease-out, ease-out) var(--icon-delay, 0ms) forwards;
    }

    @keyframes icon-draw {
      to {
        stroke-dashoffset: 0;
      }
    }

    /* Nace el lienzo entero, no cada accesorio: si cada pieza llevara su propia
       entrada, el \`animation\` del juego la reemplazaría y, al dejar de apuntar,
       la entrada volvería a correr. Así el juego tiene el \`animation\` para él. */
    svg {
      animation: icon-appear 420ms var(--ease-out, ease-out) var(--icon-delay, 0ms) both;
    }

    @keyframes icon-appear {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
    }

    .heart {
      fill: currentColor;
      fill-opacity: 0.18;
    }

    .bubble {
      fill: currentColor;
    }

    .echo,
    .bubble {
      opacity: 0;
    }

    /* ---- Juego: sólo al apuntar o enfocar el contenedor marcado. ------------ */

    /* Paciente: la cruz de salud gira y se asienta. */
    :host-context([data-icon-play]:hover) .cross,
    :host-context([data-icon-play]:focus-visible) .cross {
      animation: icon-cross 620ms var(--ease-spring, ease-out) both;
    }

    /* Médico: la campana oscila y deja un anillo, como al auscultar. */
    :host-context([data-icon-play]:hover) .bell,
    :host-context([data-icon-play]:focus-visible) .bell {
      animation: icon-bell 900ms var(--ease-out, ease-out) both;
    }

    :host-context([data-icon-play]:hover) .echo,
    :host-context([data-icon-play]:focus-visible) .echo {
      animation: icon-echo 1100ms var(--ease-out, ease-out) infinite;
    }

    /* Seguro: el corazón late, lub-dub. */
    :host-context([data-icon-play]:hover) .heart,
    :host-context([data-icon-play]:focus-visible) .heart {
      animation: icon-beat 900ms var(--ease-out, ease-out) infinite;
    }

    /* Laboratorio: la muestra sube y sueltan burbujas. */
    :host-context([data-icon-play]:hover) .sample,
    :host-context([data-icon-play]:focus-visible) .sample {
      animation: icon-level 700ms var(--ease-spring, ease-out) both;
    }

    :host-context([data-icon-play]:hover) .bubble--a,
    :host-context([data-icon-play]:focus-visible) .bubble--a {
      animation: icon-bubble 1300ms var(--ease-out, ease-out) infinite;
    }

    :host-context([data-icon-play]:hover) .bubble--b,
    :host-context([data-icon-play]:focus-visible) .bubble--b {
      animation: icon-bubble 1300ms var(--ease-out, ease-out) 420ms infinite;
    }

    /* Imagenología: el barrido recorre el cuadro de arriba abajo. */
    :host-context([data-icon-play]:hover) .sweep,
    :host-context([data-icon-play]:focus-visible) .sweep {
      animation: icon-sweep 1400ms var(--ease-standard, ease-in-out) infinite alternate;
    }

    /* Farmacia: la cruz gira un cuarto de vuelta. */
    :host-context([data-icon-play]:hover) .pharmacy-cross,
    :host-context([data-icon-play]:focus-visible) .pharmacy-cross {
      animation: icon-spin 560ms var(--ease-spring, ease-out) both;
    }

    @keyframes icon-cross {
      0% {
        transform: rotate(0) scale(1);
      }
      45% {
        transform: rotate(90deg) scale(1.35);
      }
      100% {
        transform: rotate(90deg) scale(1);
      }
    }

    @keyframes icon-bell {
      0%,
      100% {
        transform: rotate(0);
      }
      30% {
        transform: rotate(-16deg) translateY(1px);
      }
      65% {
        transform: rotate(8deg);
      }
    }

    @keyframes icon-echo {
      0% {
        opacity: 0.7;
        transform: scale(1);
      }
      100% {
        opacity: 0;
        transform: scale(2.4);
      }
    }

    @keyframes icon-beat {
      0%,
      60%,
      100% {
        transform: scale(1);
      }
      14% {
        transform: scale(1.28);
      }
      28% {
        transform: scale(1);
      }
      42% {
        transform: scale(1.16);
      }
    }

    @keyframes icon-level {
      from {
        transform: translateY(0);
      }
      to {
        transform: translateY(-2.2px);
      }
    }

    @keyframes icon-bubble {
      0% {
        opacity: 0;
        transform: translateY(0) scale(0.6);
      }
      25% {
        opacity: 0.9;
      }
      100% {
        opacity: 0;
        transform: translateY(-8px) scale(1);
      }
    }

    @keyframes icon-sweep {
      from {
        transform: translateY(-5px);
      }
      to {
        transform: translateY(5px);
      }
    }

    @keyframes icon-spin {
      from {
        transform: rotate(0) scale(0.85);
      }
      to {
        transform: rotate(90deg) scale(1);
      }
    }

    /* Menos movimiento: el dibujo terminado, quieto. */
    @media (prefers-reduced-motion: reduce) {
      svg,
      .draw {
        animation: none !important;
        stroke-dashoffset: 0;
      }

      .cross,
      .heart,
      .bell,
      .sample,
      .sweep,
      .pharmacy-cross,
      .echo,
      .bubble {
        animation: none !important;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountIcon {
  readonly name = input.required<AccountIconName>();
}
