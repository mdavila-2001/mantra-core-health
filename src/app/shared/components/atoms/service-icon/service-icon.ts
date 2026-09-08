import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { iconoDeServicio, type ServiceIconName } from './service-icon.types';

/**
 * El ícono de un servicio del catálogo.
 *
 * ## Cómo se usa
 *
 * Se le pasa el **nombre** del servicio y él resuelve el dibujo; quien lo
 * monta no elige el glifo:
 *
 * ```html
 * <app-service-icon [servicio]="servicio.name" />
 * ```
 *
 * Resolver adentro y no en cada plantilla es lo que hace que «Mis servicios» y
 * el catálogo de administración muestren el **mismo** dibujo para «Ecografía
 * abdominal», que es lo único que un ícono aporta. Si cada pantalla eligiera
 * el suyo, se separarían en el primer retoque.
 *
 * ## Un solo `<svg>` y el `@switch` sólo sobre los trazos
 *
 * Igual que `nav-icon` y `specialty-icon`, y por el mismo motivo: repetir el
 * elemento con sus ocho atributos en catorce casos son cien líneas de atributo
 * copiado donde un `stroke-width` distinto pasa desapercibido.
 *
 * El trazo es 1,5 y el encuadre centrado en 12 con unos 2 px de aire, que es
 * la misma regla de los otros dos sets: estos íconos se ven juntos —una
 * rejilla de servicios— y un dibujo descentrado se lee como un renglón torcido
 * sin que se sepa por qué.
 *
 * ## Siempre `aria-hidden`
 *
 * El ícono nunca es el nombre accesible: la tarjeta ya escribe el servicio al
 * lado. Anunciarlo diría «imagen» una vez por tarjeta en la misma pantalla.
 */
@Component({
  selector: 'app-service-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'service-icon',
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
        @case ('consulta') {
          <!-- Dos globos de diálogo: la consulta es una conversación, y eso es
               lo que la separa de todo lo demás del catálogo —que son cosas
               que se hacen sobre el cuerpo—. -->
          <path
            d="M3.4 9.4a3 3 0 0 1 3-3h6.4a3 3 0 0 1 3 3v2.4a3 3 0 0 1-3 3H9.2L5.8 17.4V14.6a3 3 0 0 1-2.4-2.8Z"
          />
          <path d="M18 9.6a2.6 2.6 0 0 1 2.6 2.6v2.2a2.6 2.6 0 0 1-1.8 2.5v2.5L15.8 17" />
        }
        @case ('teleconsulta') {
          <!-- La misma conversación, pero a través de un aparato. Sin la
               burbuja adentro sería «un monitor», que en un catálogo clínico se
               leería como un estudio por imágenes. -->
          <rect x="2.8" y="4" width="18.4" height="12.4" rx="2.2" />
          <path d="M8.4 20.4h7.2M12 16.4v4" />
          <path
            d="M8.4 8h6.4a1.6 1.6 0 0 1 1.6 1.6v1.6a1.6 1.6 0 0 1-1.6 1.6h-2.6l-2.8 1.8v-1.8a1.6 1.6 0 0 1-1-1.6V9.6A1.6 1.6 0 0 1 8.4 8Z"
          />
        }
        @case ('control') {
          <!-- Calendario con el tilde: el control es una consulta que ya estaba
               prevista, y la fecha es justamente lo que la define. -->
          <rect x="3.4" y="5.4" width="17.2" height="15.2" rx="2.2" />
          <path d="M3.4 10h17.2M8 3.4v4M16 3.4v4" />
          <path d="m8.8 15 2.2 2.2 4.2-4.2" />
        }
        @case ('laboratorio') {
          <!-- Tubo de ensayo con el nivel de la muestra. No un matraz de
               química: lo que se pide acá es un análisis sobre una muestra que
               alguien extrajo. -->
          <path d="M9 3.4v12.2a3.2 3.2 0 0 0 6.4 0V3.4" />
          <path d="M7.4 3.4h9.6" />
          <path d="M9 11.6h6.4" />
          <circle cx="11.4" cy="14.2" r=".7" />
          <circle cx="13.6" cy="16.8" r=".7" />
        }
        @case ('imagen') {
          <!-- El encuadre del estudio con la caja torácica adentro: los
               corchetes son el gesto de «esto se captura», y la curva de
               adentro dice que lo capturado es un cuerpo. -->
          <path d="M3.4 8.6V6.2A2.2 2.2 0 0 1 5.6 4h2.4" />
          <path d="M20.6 8.6V6.2A2.2 2.2 0 0 0 18.4 4H16" />
          <path d="M3.4 15.4v2.4A2.2 2.2 0 0 0 5.6 20h2.4" />
          <path d="M20.6 15.4v2.4A2.2 2.2 0 0 1 18.4 20H16" />
          <path d="M12 7.4v9.2" />
          <path d="M12 9.6c1.9 0 3.1.8 3.5 1.8M12 9.6c-1.9 0-3.1.8-3.5 1.8" />
          <path d="M12 13.2c1.7 0 2.7.7 3.1 1.6M12 13.2c-1.7 0-2.7.7-3.1 1.6" />
        }
        @case ('ecografia') {
          <!-- El transductor apoyado y las ondas que salen de él: la ecografía
               es la única imagen que se hace con un aparato en la mano, y eso
               es lo que la distingue de la radiografía. -->
          <path d="M6.6 19.4 4.4 17.2a1.8 1.8 0 0 1 0-2.6l6-6 4.8 4.8-6 6a1.8 1.8 0 0 1-2.6 0Z" />
          <path d="m13.4 6.4 4.2 4.2" />
          <path d="M16.6 3.4a9 9 0 0 1 4 4" />
          <path d="M14.8 6.8a5.4 5.4 0 0 1 2.4 2.4" />
        }
        @case ('procedimiento') {
          <!-- Bisturí: la hoja con su mango. Dice «acá se corta» sin una
               palabra, y ninguna otra clase del catálogo lo dice. -->
          <path d="M13.6 3.4 20 9.8l-10.4.8-2-2Z" />
          <path d="m7.6 12.6-3.8 3.8a2.2 2.2 0 0 0 0 3.2 2.2 2.2 0 0 0 3.2 0l3.8-3.8" />
          <path d="m7.6 12.6 3.2 3.2" />
        }
        @case ('vacuna') {
          <!-- Jeringa con su émbolo y su aguja: lo que se aplica. -->
          <path d="m3.6 20.4 3.2-3.2" />
          <path d="m9 9.8 5.2 5.2-4.4 4.4a1.6 1.6 0 0 1-2.2 0l-3-3a1.6 1.6 0 0 1 0-2.2Z" />
          <path d="m12.8 6 5.2 5.2" />
          <path d="m11.4 7.4 5.2 5.2 2.8-2.8-5.2-5.2Z" />
          <path d="m17.4 3.6 3 3" />
          <path d="m10.4 12.4 2 2" />
        }
        @case ('odontologia') {
          <!-- Muela con sus dos raíces. -->
          <path
            d="M6 8.6C6 5.9 8 4.2 10.3 5a4.6 4.6 0 0 0 3.4 0C16 4.2 18 5.9 18 8.6c0 2.2-.7 3.3-1.1 5.3l-.7 4.2a1.5 1.5 0 0 1-2.9.1L12 13.6l-1.3 4.6a1.5 1.5 0 0 1-2.9-.1l-.7-4.2C6.7 11.9 6 10.8 6 8.6Z"
          />
        }
        @case ('terapia') {
          <!-- Persona en movimiento: una sesión —de kinesiología, de
               fonoaudiología, de psicología— es trabajo de la persona, y eso no
               lo dice ni una camilla ni un consultorio. -->
          <circle cx="13.4" cy="4.6" r="2" />
          <path d="M8 20.4l2.6-4.8 1-4.4-2.8 1.6-1.2 2.8" />
          <path d="M11.6 11.2 15 9.2l2.4 2.6 2.6 1" />
          <path d="m13.6 15.6 2.2 1.6.8 3.2" />
        }
        @case ('internacion') {
          <!-- Cama de hospital con su cabecera: lo que se cobra acá es la
               noche, no el acto médico. -->
          <path d="M3.4 6.4v11.2" />
          <path d="M3.4 16.2h17.2v1.4" />
          <path d="M20.6 16.2v-3.4a2.4 2.4 0 0 0-2.4-2.4H10.2v6" />
          <circle cx="6.8" cy="11.8" r="1.8" />
        }
        @case ('enfermeria') {
          <!-- El apósito con su cruz: la curación, el vendaje, el suero. Es el
               cuidado que no es un acto médico ni una cirugía, y no hay otro
               dibujo que lo separe de los dos. -->
          <rect x="4.6" y="4.6" width="14.8" height="14.8" rx="4" transform="rotate(45 12 12)" />
          <path d="M12 9.4v5.2M9.4 12h5.2" />
        }
        @case ('certificado') {
          <!-- Hoja con su sello: lo que se entrega vale por la firma que lleva,
               no por lo que dice el texto. -->
          <path d="M6.2 3.4h7.2l4.8 4.8v7" />
          <path d="M13.2 3.4v4.8h4.8" />
          <path d="M18.2 15.2v3.4a2 2 0 0 1-2 2H8.2a2 2 0 0 1-2-2V3.4" />
          <circle cx="9.8" cy="13.2" r="2.4" />
          <path d="m8.2 15.2-.6 3.4 2.2-1.2 2.2 1.2-.6-3.4" />
        }
        @default {
          <!-- Etiqueta con su precio: es el genérico honesto de un catálogo
               —«esto es algo que se ofrece y se cobra»— y no un signo de
               pregunta, que se leería como un error. -->
          <path
            d="M3.8 11.4V5.6a1.8 1.8 0 0 1 1.8-1.8h5.8a1.8 1.8 0 0 1 1.3.5l7.4 7.4a1.8 1.8 0 0 1 0 2.6l-5.8 5.8a1.8 1.8 0 0 1-2.6 0l-7.4-7.4a1.8 1.8 0 0 1-.5-1.3Z"
          />
          <circle cx="8.2" cy="8.2" r="1.4" />
        }
      }
    </svg>
  `,
})
export class ServiceIcon {
  /**
   * El nombre del servicio. El dibujo se resuelve de acá.
   *
   * Se acepta `null` porque el catálogo puede llegar de una importación del
   * arancel a medio mapear. Recibe el ícono genérico, que es lo correcto:
   * existe, sólo que sin nombre del que deducir qué es.
   */
  readonly servicio = input.required<string | null>();

  protected readonly icono = computed<ServiceIconName>(() => iconoDeServicio(this.servicio()));
}
