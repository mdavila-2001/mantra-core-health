import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { NavIconName } from './nav-icon.types';

/**
 * El ícono de una sección, del set cerrado de la navegación.
 *
 * ## Por qué existe
 *
 * El marcado de estos `<svg>` estaba escrito dentro de `side-nav.html`. Cuando
 * el carril 02 convirtió «Tus accesos» en una rejilla de íconos —la corrección
 * #1— había dos salidas: copiar el `@switch` al panel, o extraerlo.
 *
 * Copiarlo habría producido justo lo que la corrección #8 prohíbe: dos
 * implementaciones de la misma UI que se separan en cuanto alguien retoque una.
 * Y el menú y el panel **tienen** que mostrar el mismo dibujo para la misma
 * sección: son la misma puerta vista desde dos lugares, y un ícono distinto en
 * cada lado rompe el reconocimiento, que es lo único que un ícono aporta.
 *
 * ## Un solo `<svg>`, y el `@switch` sólo sobre los trazos
 *
 * Antes cada caso repetía el elemento entero con sus ocho atributos. Con siete
 * íconos se toleraba; con cuarenta y cuatro son trescientas líneas de atributo
 * copiado donde un `stroke-width` distinto pasa desapercibido. El envoltorio
 * sale del `@switch` y adentro quedan sólo las formas — que es como ya lo hacía
 * `glossary-category-icon`, el otro juego de íconos dibujados a mano de este
 * repositorio.
 *
 * ## Siempre `aria-hidden`
 *
 * El ícono nunca es el nombre accesible: es una ayuda visual. Quien lo usa pone
 * el nombre en el host (`aria-label`) o al lado; anunciarlo acá diría «imagen»
 * cuarenta veces por pantalla.
 */
@Component({
  selector: 'app-nav-icon',
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
        <!-- ---- Los siete originales ------------------------------------ -->
        @case ('patients') {
          <!-- Una persona: el paciente, y también «Mi perfil». -->
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
        }
        @case ('calendar') {
          <!-- Almanaque: la agenda, de los dos lados del mostrador. -->
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        }
        @case ('orders') {
          <!-- Hoja con esquina doblada: una orden, y nada más. -->
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        }
        @case ('results') {
          <!-- Trazo de electrocardiograma: un resultado. -->
          <path d="M3 12h4l3 8 4-16 3 8h4" />
        }
        @case ('billing') {
          <!-- Tarjeta: lo que se cobra. -->
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        }
        @case ('settings') {
          <!-- Engranaje: configurar. -->
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        }

        <!-- ---- Gente y conversación ------------------------------------ -->
        @case ('people') {
          <!-- Dos personas: un grupo, no una. -->
          <path d="M16 20.5v-1.6a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1.6" />
          <circle cx="9.5" cy="7" r="3.4" />
          <path d="M17 3.9a3.4 3.4 0 0 1 0 6.6" />
          <path d="M21 20.5v-1.6a4 4 0 0 0-3-3.9" />
        }
        @case ('chat') {
          <!-- Globo de diálogo con cola: una conversación. -->
          <path d="M20.5 11.4c0 4.4-3.8 8-8.5 8a9.7 9.7 0 0 1-2.6-.4L4.5 20.5l1.4-3.9a7.7 7.7 0 0 1-2.4-5.2c0-4.4 3.8-8 8.5-8s8.5 3.6 8.5 8Z" />
        }
        @case ('directory') {
          <!-- Ficha con lomo: la guía donde se busca a alguien. -->
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7.5 4v16" />
          <circle cx="14.5" cy="10" r="2.2" />
          <path d="M11.2 16.2a3.5 3.5 0 0 1 6.6 0" />
        }

        <!-- ---- Atención clínica ---------------------------------------- -->
        @case ('stethoscope') {
          <!-- Estetoscopio: atender a alguien. Las dos olivas arriba y la
               campana abajo son lo que lo distingue de un diapasón. -->
          <circle cx="6" cy="3" r="1.2" />
          <circle cx="14" cy="3" r="1.2" />
          <path d="M6 4.2v3.8a4 4 0 0 0 8 0V4.2" />
          <path d="M10 12v2.6a4.6 4.6 0 0 0 9.2 0v-1.4" />
          <circle cx="19.2" cy="11" r="2" />
        }
        @case ('hospital') {
          <!-- Edificio con cruz: una clínica. -->
          <path d="M4.5 21V6.5A1.5 1.5 0 0 1 6 5h12a1.5 1.5 0 0 1 1.5 1.5V21" />
          <path d="M2.5 21h19" />
          <path d="M12 8.5v5M9.5 11h5" />
          <path d="M9.5 21v-4.5h5V21" />
        }
        @case ('flask') {
          <!-- Matraz: el laboratorio. -->
          <path d="M9.5 3v6.4L5 17.5A2 2 0 0 0 6.7 20.5h10.6a2 2 0 0 0 1.7-3l-4.5-8.1V3" />
          <path d="M8 3h8" />
          <path d="M7.3 14.5h9.4" />
        }
        @case ('scan') {
          <!-- Placa entre cuatro esquinas: la imagenología. -->
          <path d="M3 8.5V5.5A1.5 1.5 0 0 1 4.5 4h3M16.5 4h3A1.5 1.5 0 0 1 21 5.5v3" />
          <path d="M21 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M7.5 20h-3A1.5 1.5 0 0 1 3 18.5v-3" />
          <path d="M6.8 12h1.9l1.5-3.2 2.3 6.4 1.5-3.2h2.2" />
        }
        @case ('scalpel') {
          <!-- Bisturí: una intervención. Dos trazos, hoja y mango en línea: el
               tercero de antes colgaba de un costado y parecía otra cosa. -->
          <path d="m3.5 20.5 7-7" />
          <path d="M10.5 13.5 18.6 5.4a1.5 1.5 0 0 0-2.1-2.1L8.4 11.4z" />
        }
        @case ('pill') {
          <!-- Cápsula: la farmacia. El cuerpo y su juntura giran **juntos**, en
               un grupo: girar sólo el rectángulo dejaba la línea cruzada y el
               dibujo se leía como el eslabón de «link». -->
          <g transform="rotate(-40 12 12)">
            <rect x="4" y="8.5" width="16" height="7" rx="3.5" />
            <path d="M12 8.5v7" />
          </g>
        }
        @case ('heart') {
          <!-- Corazón con su latido: la historia clínica de una persona. -->
          <path d="M12 20.4 4.7 13a4.7 4.7 0 0 1 6.6-6.7l.7.7.7-.7A4.7 4.7 0 0 1 19.3 13z" />
          <path d="M5.2 12.6h2.6l1.4-2.6 2 5 1.6-3.4h3.9" />
        }
        @case ('folder') {
          <!-- Carpeta: el archivo. -->
          <path
            d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2.5h8.5A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"
          />
        }
        @case ('note') {
          <!-- Hoja escrita con lápiz: una evolución se redacta. -->
          <path d="M15.5 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8" />
          <path d="M8.5 9.5h5M8.5 13h6M8.5 16.5h3" />
          <path d="m17.4 2.6 3 3-3.9 3.9h-3v-3z" />
        }

        <!-- ---- Papeles: los tres que la hoja de «orders» hacía a la vez ------------ -->
        @case ('clipboard') {
          <!-- Tablilla: un formulario que alguien completa. -->
          <path d="M9 4.5H7A1.5 1.5 0 0 0 5.5 6v13.5A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 17 4.5h-2" />
          <rect x="9" y="2.5" width="6" height="3.6" rx="1.2" />
          <path d="M8.8 11h6.4M8.8 15h4.2" />
        }
        @case ('survey') {
          <!-- Preguntas ya marcadas: una encuesta. -->
          <path d="m3.5 6.6 1.4 1.4 2.6-2.6M3.5 12.6l1.4 1.4 2.6-2.6M3.5 18.6l1.4 1.4 2.6-2.6" />
          <path d="M11 6.6h9.5M11 12.6h9.5M11 18.6h6" />
        }
        @case ('book') {
          <!-- Libro abierto contra su lomo: el glosario. -->
          <path d="M4.5 19.5V5A2 2 0 0 1 6.5 3H19.5v16H6.5a2 2 0 0 0-2 2z" />
          <path d="M6.5 17h13" />
        }
        @case ('labels') {
          <!-- Dos etiquetas: la terminología es el catálogo de nombres. -->
          <path d="M10.6 3.5H5.5A1.5 1.5 0 0 0 4 5v5.1l7.6 7.6a1.5 1.5 0 0 0 2.1 0l4.5-4.5a1.5 1.5 0 0 0 0-2.1z" />
          <circle cx="8" cy="7.4" r="1.2" />
          <path d="m15.8 3.9 4 4a1.5 1.5 0 0 1 0 2.1l-2.3 2.3" />
        }

        <!-- ---- Cosas y lugares ----------------------------------------- -->
        @case ('building') {
          <!-- Oficina con anexo: una organización. -->
          <path d="M4 21V4.5A1.5 1.5 0 0 1 5.5 3h8A1.5 1.5 0 0 1 15 4.5V21" />
          <path d="M15 9.5h3.5A1.5 1.5 0 0 1 20 11v10" />
          <path d="M2.5 21h19" />
          <path d="M7.5 7h4M7.5 11h4M7.5 15h4" />
        }
        @case ('factory') {
          <!-- Nave con chimeneas: el laboratorio farmacéutico produce. -->
          <path d="M3.5 21V10.5l5.5 3.2v-3.2l5.5 3.2V6l6 3.5V21z" />
          <path d="M2.5 21h19" />
          <path d="M7 17.5h1.5M12 17.5h1.5M17 17.5h1.5" />
        }
        @case ('package') {
          <!-- Caja cerrada: un paquete de contenido. -->
          <path d="m12 3 8.5 4.2v9.6L12 21l-8.5-4.2V7.2z" />
          <path d="m3.5 7.2 8.5 4.2 8.5-4.2M12 11.4V21" />
        }
        @case ('bag') {
          <!-- Bolsa con asa: un pedido de farmacia se retira. -->
          <path d="M5.5 8h13l-1 11.6a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4z" />
          <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
        }
        @case ('tag') {
          <!-- Etiqueta con precio: el catálogo de servicios. -->
          <path d="M11.6 3.5H5.5A2 2 0 0 0 3.5 5.5v6.1l8.8 8.8a2 2 0 0 0 2.8 0l5.3-5.3a2 2 0 0 0 0-2.8z" />
          <circle cx="8" cy="8" r="1.3" />
        }
        @case ('megaphone') {
          <!-- Altavoz: una promoción se anuncia. -->
          <path d="M3.5 10.2v3.6A1.5 1.5 0 0 0 5 15.3h2.4l7.1 4.4V4.3L7.4 8.7H5a1.5 1.5 0 0 0-1.5 1.5z" />
          <path d="M18 9.2a4 4 0 0 1 0 5.6" />
        }
        @case ('pin') {
          <!-- Chincheta en el mapa: la geolocalización. -->
          <path d="M12 21.2s7-6 7-11.2a7 7 0 1 0-14 0c0 5.2 7 11.2 7 11.2z" />
          <circle cx="12" cy="9.8" r="2.6" />
        }
        @case ('route') {
          <!-- Dos puntos y el camino entre ellos: una visita. -->
          <circle cx="6.5" cy="6.5" r="2.8" />
          <circle cx="17.5" cy="17.5" r="2.8" />
          <path d="M6.5 9.3v3.7a3.5 3.5 0 0 0 3.5 3.5h4.4" />
        }
        @case ('globe') {
          <!-- Mundo: el contexto sanitario es de todos. -->
          <circle cx="12" cy="12" r="9" />
          <path d="M3.4 9.2h17.2M3.4 14.8h17.2" />
          <path d="M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z" />
        }

        <!-- ---- Dinero -------------------------------------------------- -->
        @case ('chart') {
          <!-- Barras: la contabilidad se lee comparando. -->
          <path d="M3.5 20.5h17" />
          <path d="M7 20.5v-6M12 20.5V5.5M17 20.5v-9.5" />
        }
        @case ('star') {
          <!-- Estrella: los puntos que se acumulan. -->
          <path d="m12 3.4 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
        }

        <!-- ---- Confianza y llaves -------------------------------------- -->
        @case ('shield') {
          <!-- Escudo con visto: la identidad verificada. -->
          <path d="M12 3 5 5.8v5.4c0 4.3 2.9 7.8 7 9.6 4.1-1.8 7-5.3 7-9.6V5.8z" />
          <path d="m9.2 11.8 2.2 2.2 4.1-4.2" />
        }
        @case ('key') {
          <!-- Llave: se presta, no se regala. Es el acceso delegado. -->
          <circle cx="8" cy="15" r="3.6" />
          <path d="M10.6 12.4 20.2 2.8" />
          <path d="m17.6 5.4 2.2 2.2M15.2 7.8l2.2 2.2" />
        }
        @case ('link') {
          <!-- Dos eslabones: un proveedor de identidad es de afuera. -->
          <path d="M10.4 13.6a4.2 4.2 0 0 0 6 0l2.6-2.7a4.2 4.2 0 0 0-6-6l-1.5 1.6" />
          <path d="M13.6 10.4a4.2 4.2 0 0 0-6 0L5 13.1a4.2 4.2 0 0 0 6 6l1.5-1.6" />
        }
        @case ('flag') {
          <!-- Bandera izada: algo se marcó para moderar. -->
          <path d="M5.5 21.5V3" />
          <path d="M5.5 4.2h11l-1.7 3.7 1.7 3.8h-11z" />
        }
        @case ('umbrella') {
          <!-- Paraguas: lo que cubre. La aseguradora. -->
          <path d="M12 3v1.2" />
          <path d="M3.4 12.4a8.6 8.6 0 0 1 17.2 0z" />
          <path d="M12 12.4v6.2a2.6 2.6 0 0 0 5.2 0" />
        }
        @case ('briefcase') {
          <!-- Maletín: el broker viene a hacer negocio. -->
          <rect x="3" y="7.5" width="18" height="12.5" rx="2" />
          <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
          <path d="M3 12.5h18" />
        }

        <!-- ---- Avisos, ajustes y aprendizaje --------------------------- -->
        @case ('bell') {
          <!-- Campana: el aviso que llega. -->
          <path d="M18 8.8a6 6 0 1 0-12 0c0 4.8-2 6.4-2 6.4h16s-2-1.6-2-6.4" />
          <path d="M10.2 18.6a2.1 2.1 0 0 0 3.6 0" />
        }
        @case ('sliders') {
          <!-- Controles: elegir cuáles de esos avisos querés. -->
          <path d="M3.5 7.5h9.5M17.5 7.5h3M3.5 16.5h3M11.5 16.5h9" />
          <circle cx="15.2" cy="7.5" r="2.3" />
          <circle cx="8.8" cy="16.5" r="2.3" />
        }
        @case ('history') {
          <!-- Reloj que retrocede: el seguimiento de un trámite. -->
          <path d="M3.4 12a8.6 8.6 0 1 0 2.7-6.2" />
          <path d="M3.4 4.4V10h5.6" />
          <path d="M12 8v4.4l3 1.8" />
        }
        @case ('teach') {
          <!-- Birrete: los tutoriales enseñan. -->
          <path d="m12 3.6 9.2 4.4-9.2 4.4-9.2-4.4z" />
          <path d="M6.8 10v4.9c0 1.6 2.3 2.9 5.2 2.9s5.2-1.3 5.2-2.9V10" />
          <path d="M21.2 8v5.2" />
        }

        @default {
          <!-- Casita: el punto de partida, y el que se dibuja cuando el
               nombre no está en el set. Nunca se deja un hueco donde iba un
               ícono: la rejilla se desalinea y no se entiende por qué. -->
          <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavIcon {
  /**
   * Cuál del set. Sin nombre —o con uno que el set no tiene— cae en el ícono de
   * inicio, que es el neutro.
   */
  readonly name = input<NavIconName | undefined>(undefined);
}
