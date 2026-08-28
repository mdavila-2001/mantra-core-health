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
   */
  readonly icono?: NavIconName;

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
}

/** Una página: el rótulo de su sección y hasta cuatro campos. */
export interface PaginaDeFormulario {
  readonly titulo: string;

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
  readonly hint?: string;
  readonly disposicion?: PaginaDeFormulario['disposicion'];
  readonly campos: readonly CampoDeFormulario[];
}
