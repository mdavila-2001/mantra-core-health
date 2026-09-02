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
 * ## El trazo es 1,5 y la caja se usa entera
 *
 * Era 1,6, y a los tamaños en que estos íconos se ven de verdad —20 px en el
 * menú, 22 px en el árbol de accesos— ese décimo de más los empasta: dos trazos
 * paralelos a menos de 2 px se leen como uno solo grueso.
 *
 * La otra mitad del arreglo es el encuadre. Varios dibujos no estaban centrados
 * en las 24 unidades del `viewBox` —«patients» tenía la cabeza en x=9 y los
 * hombros llegando a x=1— y en una fila de íconos eso se nota como un renglón
 * torcido sin que se sepa por qué. Al redibujarlos, la regla es la misma para
 * todos: centro en 12, unos 2 px de aire a cada lado.
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
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @switch (name()) {
        <!-- ---- Los siete originales ------------------------------------ -->
        @case ('patients') {
          <!-- Una persona: el paciente, y también «Mi perfil».
               Redibujada al centro de la caja: la cabeza estaba en x=9 de 24 y
               los hombros llegaban hasta x=1, así que en una fila de íconos
               éste se veía corrido a la izquierda sin que se supiera por qué. -->
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.8 20.4a7.2 7.2 0 0 1 14.4 0" />
        }
        @case ('calendar') {
          <!-- Almanaque con los días marcados: la agenda, de los dos lados del
               mostrador. Los puntos son lo que lo separa de la caja vacía de
               «scan» a tamaño chico. -->
          <rect x="3.2" y="5" width="17.6" height="16" rx="2.4" />
          <path d="M3.2 9.8h17.6" />
          <path d="M8.2 3v4M15.8 3v4" />
          <path d="M7.8 13.8h.01M12 13.8h.01M16.2 13.8h.01M7.8 17.4h.01M12 17.4h.01" />
        }
        @case ('orders') {
          <!-- Hoja con esquina doblada y dos renglones escritos: una orden.
               Los renglones son lo que la distingue de la hoja en blanco, que
               a 20 px era una silueta cualquiera. -->
          <path d="M13.6 2.8H7.2a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V8.2z" />
          <path d="M13.6 2.8V8.2h5.2" />
          <path d="M8.8 13.2h6M8.8 16.8h4" />
        }
        @case ('results') {
          <!-- Informe con el trazo adentro: un resultado. El trazo suelto era
               el único ícono del set sin contorno, así que en la rejilla
               quedaba flotando; el marco lo vuelve un papel que se lee. -->
          <rect x="3" y="4.6" width="18" height="14.8" rx="2.4" />
          <path d="M6.6 12.2h2.3l1.7-3.9 2.4 7.1 1.6-3.2h2.8" />
        }
        @case ('billing') {
          <!-- Tarjeta con banda y número: lo que se cobra. -->
          <rect x="2.6" y="5.2" width="18.8" height="13.6" rx="2.4" />
          <path d="M2.6 10h18.8" />
          <path d="M6.4 14.8h3.6" />
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
          <circle cx="9.6" cy="8" r="3.2" />
          <path d="M3.4 20.2a6.2 6.2 0 0 1 12.4 0" />
          <path d="M16.4 5.2a3.2 3.2 0 0 1 0 5.6" />
          <path d="M17.8 14.4a5.4 5.4 0 0 1 2.8 4.4" />
        }
        @case ('chat') {
          <!-- Globo de diálogo con cola y tres puntos: una conversación en
               curso. El globo vacío se leía como una gota. -->
          <path d="M20.5 11.4c0 4.4-3.8 8-8.5 8a9.7 9.7 0 0 1-2.6-.4L4.5 20.5l1.4-3.9a7.7 7.7 0 0 1-2.4-5.2c0-4.4 3.8-8 8.5-8s8.5 3.6 8.5 8Z" />
          <path d="M8.6 11.4h.01M12 11.4h.01M15.4 11.4h.01" />
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
          <!-- Cuatro esquinas y la línea del barrido: la imagenología.
               Tenía adentro el mismo electrocardiograma que «results», así que
               a tamaño de menú los dos eran el mismo dibujo. -->
          <path d="M3 8.6V5.8A2.4 2.4 0 0 1 5.4 3.4h2.8M15.8 3.4h2.8A2.4 2.4 0 0 1 21 5.8v2.8" />
          <path d="M21 15.4v2.8a2.4 2.4 0 0 1-2.4 2.4h-2.8M8.2 20.6H5.4A2.4 2.4 0 0 1 3 18.2v-2.8" />
          <path d="M6.4 12h11.2" />
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
          <!-- Carpeta con la tapa marcada: el archivo. Sin esa línea era un
               rectángulo con una muesca. -->
          <path
            d="M3 7.2A1.8 1.8 0 0 1 4.8 5.4h4.4l2.1 2.6h7.9A1.8 1.8 0 0 1 21 9.8v8.4a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 18.2z"
          />
          <path d="M3 11.6h18" />
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
          <!-- Libro contra su lomo, con texto en la página: el glosario. -->
          <path d="M4.6 19.2V5.2A2.4 2.4 0 0 1 7 2.8h12.4v14.6H7a2.4 2.4 0 0 0 0 4.8h12.4" />
          <path d="M8.4 7.4h7.2M8.4 10.8h4.8" />
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
        @case ('lock') {
          <!-- Candado cerrado: la contraseña. No es la llave, que es lo que
               se presta: ver la nota del set. -->
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
          <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
        }
        @case ('mail') {
          <!-- Sobre: una dirección de correo, no una conversación. -->
          <rect x="2.8" y="5" width="18.4" height="14" rx="2.2" />
          <path d="m3.4 7.2 7.5 5.4a2 2 0 0 0 2.2 0l7.5-5.4" />
        }
        @case ('phone') {
          <!-- Auricular: el teléfono al que se llama. -->
          <path d="M7.6 3.5H5.2a1.8 1.8 0 0 0-1.8 2c.3 3 1.4 5.8 3.2 8.2a19 19 0 0 0 5.7 5.7c2.4 1.8 5.2 2.9 8.2 3.2a1.8 1.8 0 0 0 2-1.8v-2.4a1.8 1.8 0 0 0-1.5-1.8l-2.4-.4a1.8 1.8 0 0 0-1.8.8l-.8 1.2a14 14 0 0 1-5.4-5.4l1.2-.8a1.8 1.8 0 0 0 .8-1.8l-.4-2.4a1.8 1.8 0 0 0-1.8-1.5z" />
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

        @case ('arrow-left') {
          <!-- Flecha a la izquierda: «Atrás» del motor de formularios. Los dos
               únicos glifos del set que no nombran una sección; el porqué está
               en nav-icon.types.ts. Asta larga y punta corta, misma caja de
               24 y mismo aire a los lados que el resto. -->
          <path d="M19.6 12H4.4" />
          <path d="m10.6 5.8-6.2 6.2 6.2 6.2" />
        }
        @case ('remove') {
          <!-- Un menos dentro de un aro: «sacá esto de la lista». No es una
               papelera —no se borra nada— ni una cruz, que a este tamaño se
               confunde con «cerrar». El aro le da el mismo peso visual que el
               resto del set, que casi todo dibuja una figura cerrada. -->
          <circle cx="12" cy="12" r="8.2" />
          <path d="M8.4 12h7.2" />
        }
        @case ('arrow-right') {
          <!-- Flecha a la derecha: «Siguiente». Espejo exacto de arrow-left,
               para que los dos botones del mismo par pesen igual. -->
          <path d="M4.4 12h15.2" />
          <path d="m13.4 5.8 6.2 6.2-6.2 6.2" />
        }

        @default {
          <!-- Casita con puerta: el punto de partida, y el que se dibuja
               cuando el nombre no está en el set. Nunca se deja un hueco donde
               iba un ícono: la rejilla se desalinea y no se entiende por qué.
               El techo y el cuerpo van en trazos separados —antes era un solo
               contorno con la puerta recortada, y a 20 px la puerta se comía
               el borde inferior. -->
          <path d="M3.4 10.2 12 3.4l8.6 6.8v8.6a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2z" />
          <path d="M9.4 20.8v-6.2h5.2v6.2" />
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
