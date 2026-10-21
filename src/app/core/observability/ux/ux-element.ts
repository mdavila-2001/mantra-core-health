/**
 * Del elemento tocado a un descriptor estable y sin datos.
 *
 * ```
 * <button data-testid="guardar-receta">Guardar receta de Ana Pérez</button>
 *   →  app-prescription-form > form > button[data-testid="guardar-receta"][type="submit"]
 * ```
 *
 * El mapa de calor necesita agrupar los clics **del mismo control** entre
 * sesiones y pantallas de tamaños distintos. Las coordenadas solas no alcanzan:
 * el mismo botón cae en otro píxel en un teléfono. El descriptor es la clave de
 * agrupación.
 *
 * ## Lista blanca, no lista negra
 *
 * Solo salen el nombre de la etiqueta y un puñado de atributos que escribe el
 * equipo, no la persona: `data-testid`, `role`, `type`, `formcontrolname` y
 * `name`. Nunca:
 *
 * - **El texto.** «Ver receta de Ana Pérez» es un nombre y una prescripción.
 * - **`aria-label`/`title`.** Mismo problema: se arman con datos de la fila.
 * - **`id`.** Muchos se generan con el identificador del registro.
 * - **Clases.** Cambian con cada refactor visual y algunas llevan estado.
 * - **`href`.** Es una URL, con sus identificadores.
 *
 * Y lo que sí sale pasa por {@link limpiarValor}: un `data-testid="fila-8437"`
 * viaja como `fila-:id`.
 */

/** Hasta dónde se sube buscando contexto. Más profundo no agrupa mejor. */
const PROFUNDIDAD_MAXIMA = 5;

/** Lo que admite la API en `valueString` es más; esto basta para agrupar. */
const LARGO_MAXIMO = 300;

/** Elementos que una persona activa a propósito. */
const INTERACTIVOS =
  'a,button,input,select,textarea,summary,label,' +
  '[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="option"],' +
  '[role="checkbox"],[role="radio"],[role="switch"],[role="combobox"]';

/** Roles ARIA que describen el control. Cualquier otro valor se ignora. */
const ROLES = new Set([
  'button',
  'link',
  'tab',
  'tabpanel',
  'menuitem',
  'option',
  'checkbox',
  'radio',
  'switch',
  'combobox',
  'listbox',
  'dialog',
  'navigation',
  'row',
  'gridcell',
]);

/** Tipos de `input`/`button` que se publican tal cual. */
const TIPOS = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'text',
  'search',
  'email',
  'tel',
  'number',
  'password',
  'date',
  'time',
  'datetime-local',
  'file',
  'range',
  'input',
  'select',
  'textarea',
]);

/** Elementos cuyo contenido nunca se describe más allá de esto. */
export const ATRIBUTO_IGNORAR = 'data-ux-ignore';

export interface DescriptorDeElemento {
  /** Ruta de etiquetas y atributos de la lista blanca, de afuera hacia adentro. */
  readonly selector: string;
  /** Si lo tocado es (o está dentro de) un control. */
  readonly interactivo: boolean;
  /** El elemento contra el que se miden las coordenadas relativas. */
  readonly ancla: Element;
}

/**
 * Describe el elemento tocado.
 *
 * @param objetivo - `event.target` del clic o del foco.
 * @returns `null` si el elemento está dentro de una zona marcada con
 *   `data-ux-ignore`, o si no es un elemento.
 */
export function describirElemento(objetivo: EventTarget | null): DescriptorDeElemento | null {
  if (!esElemento(objetivo) || objetivo.closest(`[${ATRIBUTO_IGNORAR}]`) !== null) {
    return null;
  }

  // El clic suele caer en un `<span>` o un `<svg>` dentro del botón. El control
  // es el botón: es lo que agrupa y lo que se mide.
  const control = objetivo.closest(INTERACTIVOS);
  const ancla = control ?? objetivo;

  const pasos: string[] = [];
  let actual: Element | null = ancla;
  while (actual !== null && pasos.length < PROFUNDIDAD_MAXIMA) {
    const etiqueta = actual.tagName.toLowerCase();
    if (etiqueta === 'body' || etiqueta === 'html') {
      break;
    }
    pasos.unshift(paso(actual));
    // Un `data-testid` ya identifica el lugar: subir más solo alarga la clave.
    if (actual.hasAttribute('data-testid')) {
      break;
    }
    actual = actual.parentElement;
  }

  return { selector: recortar(pasos.join(' > ')), interactivo: control !== null, ancla };
}

/** Tipo del campo enfocado, de la lista blanca, o `otro`. */
export function tipoDeCampo(elemento: Element): string {
  const tipo =
    elemento.tagName.toLowerCase() === 'textarea'
      ? 'textarea'
      : (elemento.getAttribute('type') ?? elemento.tagName.toLowerCase()).toLowerCase();
  return TIPOS.has(tipo) ? tipo : 'otro';
}

/** Si el elemento es un campo de formulario que se puede enfocar. */
export function esCampo(objetivo: EventTarget | null): objetivo is Element {
  return esElemento(objetivo) && /^(input|select|textarea)$/i.test(objetivo.tagName);
}

function paso(elemento: Element): string {
  let texto = elemento.tagName.toLowerCase();

  const testId = elemento.getAttribute('data-testid');
  if (testId) {
    texto += `[data-testid="${limpiarValor(testId)}"]`;
  }

  const rol = elemento.getAttribute('role');
  if (rol && ROLES.has(rol)) {
    texto += `[role="${rol}"]`;
  }

  const tipo = elemento.getAttribute('type')?.toLowerCase();
  if (tipo && TIPOS.has(tipo)) {
    texto += `[type="${tipo}"]`;
  }

  const control = elemento.getAttribute('formcontrolname') ?? elemento.getAttribute('name');
  if (control) {
    texto += `[name="${limpiarValor(control)}"]`;
  }

  return texto;
}

/**
 * Deja un valor de atributo listo para viajar.
 *
 * Los uuid y las corridas de cuatro dígitos o más pasan a `:id`: son los dos
 * formatos de identificador del proyecto. Lo que no sea letra, dígito, guion,
 * guion bajo, punto o dos puntos se elimina, para que el valor no pueda romper
 * el selector ni colar otra cosa.
 */
export function limpiarValor(valor: string): string {
  return valor
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\d{4,}/g, ':id')
    .replace(/[^\w.:-]/g, '')
    .slice(0, 60);
}

/** Recorta por la izquierda: lo más útil es el final, el control mismo. */
function recortar(selector: string): string {
  return selector.length <= LARGO_MAXIMO ? selector : selector.slice(selector.length - LARGO_MAXIMO);
}

function esElemento(objetivo: EventTarget | null): objetivo is Element {
  return objetivo !== null && typeof (objetivo as Element).closest === 'function';
}
