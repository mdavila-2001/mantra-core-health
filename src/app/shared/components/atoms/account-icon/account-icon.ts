import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { AccountIconName } from './account-icon.types';

/**
 * El ícono de un tipo de cuenta, para la rejilla de «crear cuenta».
 *
 * Mismo trazo que `app-nav-icon` —`viewBox` de 24, `currentColor`, 1.6 de
 * grosor, extremos redondeados— y por la misma razón: son el mismo lenguaje
 * visual y un set con dos grosores distintos se nota aunque nadie sepa decir por
 * qué. No se reutiliza `nav-icon` porque su set es **cerrado y de navegación**:
 * meterle un estetoscopio obligaría a que el menú lateral lo acepte como
 * sección.
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
    @switch (name()) {
      @case ('patient') {
        <!-- Una persona. Lo que se registra es alguien, no un expediente. -->
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
          <circle cx="12" cy="7.5" r="3.75" />
          <path d="M4.75 20.5v-1a5.25 5.25 0 0 1 5.25-5.25h4a5.25 5.25 0 0 1 5.25 5.25v1" />
        </svg>
      }
      @case ('practitioner') {
        <!-- Un estetoscopio: la herramienta, no el título. Se reconoce sin leer. -->
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
          <path d="M5 3.5v5.5a5 5 0 0 0 10 0V3.5" />
          <path d="M3.5 3.5h3" />
          <path d="M13.5 3.5h3" />
          <path d="M10 14v1.75a4.25 4.25 0 0 0 8.5 0v-1.5" />
          <circle cx="18.5" cy="11.5" r="2.25" />
        </svg>
      }
      @case ('insurer') {
        <!-- Un escudo con un corazón: cobertura de salud, no una sucursal. -->
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
          <path d="M12 3.25 4.75 6.1v5.15c0 4.3 3.05 7.4 7.25 8.65 4.2-1.25 7.25-4.35 7.25-8.65V6.1L12 3.25Z" />
          <path
            d="M12 15.1c-1.6-1-3-2.2-3-3.6a1.75 1.75 0 0 1 3-1.15 1.75 1.75 0 0 1 3 1.15c0 1.4-1.4 2.6-3 3.6Z"
          />
        </svg>
      }
      @case ('laboratory') {
        <!-- Un tubo de ensayo con su muestra: es la sangre lo que se analiza,
             y se reconoce sin leer. No un microscopio —eso es investigación—
             ni un edificio, que sería cualquier empresa. -->
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
          <path d="M9 3.25h6" />
          <path d="M10.25 3.25v13.5a1.75 1.75 0 0 0 3.5 0V3.25" />
          <path d="M10.25 12.5h3.5" />
          <path d="M6.5 20.75h11" />
        </svg>
      }
      @case ('imaging') {
        <!-- Cuatro esquinas y la línea del barrido: el mismo dibujo con el que
             app-nav-icon dice «imagenología» en el menú, porque decir lo mismo
             de dos maneras obliga a aprender dos. No es un tubo de ensayo —eso
             es el laboratorio de al lado— ni una placa con un hueso, que a 24
             píxeles es una mancha. -->
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
          <path d="M3 8.6V5.8A2.4 2.4 0 0 1 5.4 3.4h2.8M15.8 3.4h2.8A2.4 2.4 0 0 1 21 5.8v2.8" />
          <path d="M21 15.4v2.8a2.4 2.4 0 0 1-2.4 2.4h-2.8M8.2 20.6H5.4A2.4 2.4 0 0 1 3 18.2v-2.8" />
          <path d="M6.4 12h11.2" />
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountIcon {
  readonly name = input.required<AccountIconName>();
}
