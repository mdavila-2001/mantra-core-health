/* ============================================================================
    Contratos del formulario por partes.

    Un formulario de este sistema **no se sirve entero**: se sirve por páginas,
    con un tope de cuatro campos en cada una. El tope no es una guía de estilo
    —es la razón de que el motor exista— y por eso vive acá, en el contrato, y
    no en una hoja de estilos ni en la cabeza de quien arma la pantalla.
    ========================================================================== */

import type { NavIconName } from '../../components/atoms/nav-icon/nav-icon.types';
import type { SelectOption } from '../../components/atoms/select/select.types';

/**
 * Cuántos campos caben en una página. **Cuatro.**
 *
 * El número sale de lo que se puede leer sin desplazar en un teléfono y de lo
 * que se puede contestar sin perder el hilo. El alta de paciente pedía trece de
 * golpe: quien la abría veía una pared, y la pared es lo que hace abandonar un
 * registro a mitad.
 *
 * Se comprueba en tres sitios, a propósito: {@link paginarCampos} nunca produce
 * una página que lo exceda, el motor lo verifica en desarrollo por si alguien
 * arma las páginas a mano, y hay una prueba que lo fija. Una sola de las tres
 * se salta con un descuido.
 */
export const MAX_CAMPOS_POR_PAGINA = 4;

/**
 * Cómo se dibuja un campo.
 *
 * `date` y `datetime` son el mismo control con distinto alcance —una fecha, o
 * una fecha con su hora—: son dos tipos y no una opción del campo porque la
 * diferencia se ve en lo que se pide contestar, y un formulario que pide la
 * hora cuando sólo importa el día hace escribir un dato que nadie va a mirar.
 *
 * `custom` es la vía de escape para lo que no es un control de texto —el
 * odontograma de la ficha clínica es el caso real—: el motor le reserva su
 * sitio y quien lo usa proyecta el widget. Sin ella, dibujar un mapa dental
 * obligaría a meter dominio clínico dentro de un componente compartido.
 */
export type TipoDeControl =
  | 'text'
  | 'email'
  | 'password'
  | 'tel'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'radio'
  | 'switch'
  | 'checkbox'
  | 'textarea'
  | 'custom';

/** Un campo del formulario, tal como el motor necesita conocerlo para pintarlo. */
export interface CampoDeFormulario {
  /**
   * El nombre del control dentro del `FormGroup`.
   *
   * Es la única atadura entre el campo declarado y el dato: el motor no guarda
   * valores propios, escribe siempre en el formulario que recibe. Un campo con
   * una `key` que no existe en el grupo es un error de programación y se avisa
   * en desarrollo, porque en producción se vería como un campo que no guarda
   * nada — el peor fallo posible en un formulario.
   */
  readonly key: string;

  readonly label: string;

  /** La ayuda bajo el campo. Sale como `aria-describedby` por el contrato del ADR-0008. */
  readonly hint?: string;

  readonly control: TipoDeControl;

  /**
   * Sólo para `select` y `radio`.
   *
   * Son el mismo dato con dos formas de mostrarlo: la lista desplegable ahorra
   * espacio y el grupo de opciones las deja todas a la vista. La regla que
   * siguen las pantallas migradas es la de siempre — hasta cuatro opciones se
   * ven, más de cuatro se despliegan— y por eso ambos leen de acá.
   */
  readonly options?: readonly SelectOption<string>[];

  /** Sólo para `text` y familia: el `autocomplete` del navegador. */
  readonly autocomplete?: string;

  /**
   * El glifo que va **dentro** del campo, del set cerrado del nav.
   *
   * Opcional y sin defecto: un ícono por campo, puesto por costumbre, es ruido
   * — la regla del set (`nav-icon.types.ts`) vale igual acá: se declara cuando
   * **dice algo que el rótulo no dice ya**, y sobre todo cuando ayuda a
   * encontrar un campo entre varios de un vistazo. En una página de un solo
   * campo no aporta nada; en una de cuatro, es lo que la vuelve escaneable.
   *
   * Va dentro del control y no al lado del rótulo a propósito: así comparte el
   * marco, el foco y el estado de error del campo, y se enciende cuando el
   * campo está activo en vez de quedar como una calcomanía junto al texto.
   *
   * ## «Un ícono en CADA campo» (TAREA 04, AC-04-1)
   *
   * El propietario pidió un ícono en cada campo de texto y en cada select del
   * alta, y eso choca de frente con el párrafo de arriba. El choque se resolvió
   * así, y no ignorándolo:
   *
   * - **Lo que cambió es lo que se puede hacer, no lo que hay que hacer.** El
   *   mecanismo dejó de servir sólo a los campos de texto: ahora el `select`
   *   también dibuja su glifo dentro del marco. Antes, «un ícono en cada
   *   campo» era literalmente imposible para media página; hoy es una decisión.
   * - **Sigue siendo por campo y declarado, nunca global.** No hay —ni va a
   *   haber— un interruptor que le ponga un glifo a los campos de las 53
   *   pantallas que montan este motor: eso convertiría «un ícono dice algo» en
   *   «todos los campos tienen una calcomanía», que es el ruido que la regla
   *   evita. Una pantalla que quiera el ícono en sus cuatro campos lo declara
   *   cuatro veces, y al escribirlo se topa con la pregunta de qué dibujo va
   *   ahí —que es exactamente la pregunta que la regla quiere que se haga—.
   * - **La regla se afina, no se rompe:** en una página de un solo campo el
   *   ícono sigue sin aportar nada. Donde sí aporta, y por eso el alta es el
   *   caso de libro, es en páginas de tres o cuatro campos que preguntan cosas
   *   de distinta naturaleza —documento, correo, teléfono, contraseña—: ahí el
   *   glifo es lo que deja recorrer la página sin leerla entera.
   *
   * Queda abierto quién decide caso por caso (P-04-2 de la ficha, sin resolver
   * con el propietario): este contrato sólo garantiza que se **pueda** y que
   * cueste declararlo, no que esté puesto.
   *
   * El glifo es siempre `aria-hidden` —lo pone `app-nav-icon`—, así que quitarlo
   * no cambia una palabra de lo que anuncia un lector de pantalla.
   */
  readonly icono?: NavIconName;

  /**
   * La explicación del campo, la que aparece al apuntarlo o al enfocarlo.
   *
   * Es la respuesta a «¿qué me están preguntando acá?» cuando el rótulo no
   * alcanza y la ayuda no cabe debajo del campo. Aparece con el puntero y
   * también con el foco del teclado, y viaja siempre en el `aria-describedby`
   * del control —ver `app-form-field`—.
   *
   * **No reemplaza al `hint`.** Son dos cosas distintas y las dos siguen: el
   * `hint` se lee sin hacer nada y existe en el teléfono, donde no hay puntero;
   * la `description` es la explicación larga que estorbaría si estuviera
   * siempre a la vista. Mudar el `hint` a un globo dejaría al campo sin su
   * `aria-describedby` —contrato del ADR-0008— y sin ayuda alguna en un
   * teléfono.
   *
   * Cuando el campo no declara `placeholder`, esta descripción también se usa
   * de placeholder: el pedido era que el mismo texto estuviera en los dos
   * sitios. Si el campo **sí** declara `placeholder`, gana el declarado: un
   * ejemplo concreto («1234567») enseña más sobre qué escribir que una
   * explicación, y además desaparece al primer tecleo. Ver P-04-3 de la ficha:
   * sigue sin confirmarse con el propietario.
   */
  readonly description?: string;

  /**
   * El `data-testid` del control, cuando la pantalla ya tenía uno.
   *
   * Por defecto el motor pone `campo-<key>` en los campos de texto, que alcanza
   * para lo que nace con él. Se declara cuando hay un recorrido de navegador que
   * ya apuntaba a otro nombre: migrar una pantalla al motor no tiene por qué
   * romper la prueba que la recorría.
   *
   * En `select`, `radio`, `switch`, `textarea` y `checkbox` sale como
   * `data-testid` sobre el control —esos átomos no tienen entrada `testId`— y
   * sólo si se declara: no se inventa uno por defecto.
   */
  readonly testId?: string;

  readonly placeholder?: string;

  /**
   * El error de este campo, cuando el genérico no alcanza.
   *
   * El motor traduce solo los errores de Angular —obligatorio, correo, largo
   * mínimo— y eso cubre la mayoría. Un validador propio sabe cosas que el motor
   * no puede adivinar («letras, números, punto y guion»), y ese mensaje viene
   * acá. Ver `mensajeDeError`.
   */
  readonly mensajeDeError?: string;

  /**
   * Si el campo se marca como obligatorio a la vista.
   *
   * **No valida nada**: la validación vive en el `FormControl`, que es quien la
   * hace cumplir. Esto sólo pinta el asterisco y el `aria-required`. Declararlo
   * acá sin el validador correspondiente sería una pantalla que promete un
   * control que no existe.
   */
  readonly required?: boolean;

  /** Límites de fecha para campos 'date' y 'datetime'. */
  readonly minDate?: Date | 'today' | string | null;
  readonly maxDate?: Date | 'today' | string | null;

  /**
   * Cuánto ocupa el campo cuando la fila entra en dos columnas.
   *
   * Por omisión un campo ocupa la fila entera: es lo correcto para casi todo
   * —una dirección, un municipio, una contraseña— y es lo que hace que un
   * formulario se lea como una columna y no como un tablero.
   *
   * `mitad` es para el dato que **no se entiende solo**: el número de cédula y
   * su departamento de emisión son un único documento escrito en dos casillas,
   * y separarlos en dos renglones los convierte en dos preguntas distintas. Dos
   * campos `mitad` seguidos comparten renglón; uno suelto ocupa media fila y
   * deja el resto en blanco, que es la señal de que falta su par.
   *
   * En pantalla angosta no hace nada: todo vuelve a una columna antes que
   * estrechar dos controles a menos de lo que se escribe adentro.
   */
  readonly ancho?: 'completo' | 'mitad';
}

/** Una página: el rótulo de su sección y hasta cuatro campos. */
export interface PaginaDeFormulario {
  readonly titulo: string;

  /**
   * El glifo de la página en el indicador de pasos, del set cerrado del nav.
   *
   * Misma regla que el ícono de un campo: se declara cuando **dice algo que el
   * rótulo no dice ya**. Un recorrido de dos pasos no lo necesita; uno de cinco
   * —identidad, contacto, domicilio, trabajo, seguro— se reconoce de un
   * vistazo y sin leer.
   *
   * No es la seña de estado del paso: el completado sigue mostrando su ✓ y el
   * pendiente su marcador punteado, porque el estado no puede depender del
   * dibujo ni del color (ver `stepper.css`).
   */
  readonly icon?: NavIconName;

  /**
   * Nombre estable de la página, para quien necesite reconocerla desde fuera.
   *
   * El título no sirve para eso: es texto de cara a la persona —se reescribe
   * cuando se lee mal, y `paginarCampos` le agrega «(1 de 2)» al partir una
   * sección larga—, así que colgar comportamiento de él es colgarlo de una
   * cadena que cambia sin avisar. La clave la declara quien arma el formulario
   * y no se muestra en ningún lado.
   *
   * Es opcional: un formulario que no necesita distinguir sus páginas no
   * inventa nombres para ellas.
   */
  readonly clave?: string;

  /** Una línea que explica de qué va la sección, si hace falta. */
  readonly hint?: string;

  /**
   * Presentación de los campos cuando el ancho disponible lo permite.
   *
   * `dos-columnas` se reserva para pares cortos y relacionados. En pantallas
   * angostas el motor vuelve a una sola columna para no estrechar controles.
   */
  readonly disposicion?: 'una-columna' | 'dos-columnas';

  /** Invariante: nunca más de {@link MAX_CAMPOS_POR_PAGINA}. */
  readonly campos: readonly CampoDeFormulario[];
}

/**
 * Un grupo de campos con nombre, antes de partirse en páginas.
 *
 * Es lo que se le da a {@link paginarCampos} cuando el formulario tiene
 * secciones propias —las del módulo `forms` de la API, o las que declara una
 * pantalla— y quiere conservar sus rótulos. Un grupo más largo que el tope se
 * parte en varias páginas conservando el nombre.
 */
export interface SeccionDeFormulario {
  readonly titulo: string;

  /** Ver {@link PaginaDeFormulario.clave}: la heredan todas sus páginas. */
  readonly clave?: string;

  /**
   * Ver {@link PaginaDeFormulario.icon}: lo heredan todas sus páginas.
   *
   * Una sección partida en dos lleva el mismo glifo en sus dos mitades, por lo
   * mismo que lleva el mismo rótulo: siguen siendo la misma pregunta.
   */
  readonly icon?: NavIconName;

  readonly hint?: string;
  readonly disposicion?: PaginaDeFormulario['disposicion'];
  readonly campos: readonly CampoDeFormulario[];
}
