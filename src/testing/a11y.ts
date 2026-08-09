import axe, { type AxeResults, type Result, type RunOptions } from 'axe-core';

/**
 * Auditoría de accesibilidad sobre el DOM que renderiza una prueba de
 * componente.
 *
 * ## Qué cubre esto que no cubran las otras comprobaciones
 *
 * Ya existen dos verificadores de accesibilidad en el repositorio, y ninguno de
 * los dos ve lo mismo que éste:
 *
 * · `scripts/check-contrast.mjs` mide **contraste** sobre los tokens
 *   declarados. Trabaja con colores, no con marcado.
 * · Las pruebas de componente afirman contratos concretos y escritos a mano
 *   —que el `aria-describedby` apunte al mensaje de error, que el `role` sea
 *   `alert`—, es decir, **lo que alguien se acordó de comprobar**.
 *
 * axe cubre el hueco: las ~90 reglas que nadie escribió a mano. Un `<label>`
 * huérfano, un `aria-*` con valor inválido, un `role` que exige un hijo que no
 * está, un `id` duplicado tras hidratar. Ninguna de esas rompe una prueba
 * existente y todas rompen a quien usa lector de pantalla.
 *
 * ## Y qué NO cubre — importa tanto como lo anterior
 *
 * Las pruebas corren en jsdom, que **no calcula estilos ni geometría**. Todo lo
 * que dependa de píxeles es invisible acá:
 *
 * · contraste de color (`color-contrast`) — lo cubre `check-contrast.mjs`;
 * · tamaño del área táctil (`target-size`);
 * · lo que queda tapado, fuera de pantalla o con `display:none` calculado.
 *
 * axe marca esas reglas como *incomplete*, no como *pass*. Este ayudante las
 * ignora **a propósito**: convertirlas en fallo daría ruido constante, y
 * convertirlas en éxito diría una mentira. Lo que sí es honesto es no
 * contarlas, y decirlo acá.
 *
 * Un componente sin violaciones de axe **no es un componente accesible**; es un
 * componente sin los errores mecánicos que una máquina puede ver sin renderizar.
 * El resto sigue siendo trabajo humano.
 */

/** Las etiquetas que interesan: WCAG 2.0 y 2.1, niveles A y AA. */
const NIVELES: readonly string[] = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Reglas que se apagan porque **el entorno no puede evaluarlas**, no porque no
 * importen. Cada una tiene dónde se comprueba de verdad.
 */
const SIN_LAYOUT: readonly string[] = [
  // Necesita colores calculados. Lo mide `scripts/check-contrast.mjs` sobre los
  // 202 tokens y las tres combinaciones de tema.
  'color-contrast',
  // Necesita geometría. Se revisa en la auditoría manual de accesibilidad.
  'target-size',
];

/**
 * Reglas que exigen un **documento entero** y que un fragmento de componente no
 * puede satisfacer: no hay `<html lang>`, ni `<title>`, ni landmarks alrededor.
 * Se comprueban en `index.html` y en el layout, no en cada botón.
 */
const SOLO_DOCUMENTO: readonly string[] = [
  'html-has-lang',
  'html-lang-valid',
  'document-title',
  'landmark-one-main',
  'page-has-heading-one',
  'region',
  'bypass',
];

const OPCIONES: RunOptions = {
  runOnly: { type: 'tag', values: [...NIVELES] },
  rules: Object.fromEntries(
    [...SIN_LAYOUT, ...SOLO_DOCUMENTO].map((id) => [id, { enabled: false }]),
  ),
  // Sin esto axe devuelve el árbol completo de cada nodo revisado, y un fallo se
  // vuelve ilegible.
  resultTypes: ['violations'],
  // axe precarga el CSSOM para poder razonar sobre estilos. En jsdom eso es
  // caro y **no sirve de nada**: las reglas que necesitan estilos calculados ya
  // están apagadas arriba. Sin este `false`, cada auditoría tardaba segundos y
  // el coste desestabilizaba pruebas de otros archivos que corren en paralelo.
  preload: false,
  // No hay marcos anidados en ningún componente del sistema de diseño.
  iframes: false,
};

/** Una violación, ya reducida a lo que sirve para arreglarla. */
export interface ViolacionA11y {
  /** Identificador de la regla, p. ej. `label` o `aria-valid-attr-value`. */
  readonly regla: string;
  /** `minor` | `moderate` | `serious` | `critical`. */
  readonly impacto: string;
  /** Qué está mal, en una línea. */
  readonly descripcion: string;
  /** Los selectores de los elementos que la incumplen. */
  readonly elementos: readonly string[];
  /** La página de axe que explica cómo arreglarla. */
  readonly ayuda: string;
}

function reducir(resultado: Result): ViolacionA11y {
  return {
    regla: resultado.id,
    impacto: resultado.impact ?? 'desconocido',
    descripcion: resultado.help,
    elementos: resultado.nodes.map((nodo) => nodo.target.join(' ')),
    ayuda: resultado.helpUrl,
  };
}

/**
 * Audita un elemento y devuelve las violaciones encontradas.
 *
 * Devuelve datos en vez de afirmar por su cuenta para que el ayudante no
 * dependa del framework de pruebas, y para que una prueba pueda **admitir** una
 * violación conocida dejando escrito el motivo.
 */
export async function auditarA11y(elemento: Element): Promise<readonly ViolacionA11y[]> {
  // El cast es inevitable: los tipos de axe declaran `run` con sobrecargas que
  // TypeScript no resuelve bien cuando el contexto es un `Element` suelto.
  const resultados = (await axe.run(elemento, OPCIONES)) as AxeResults;
  return resultados.violations.map(reducir);
}

/**
 * Formatea las violaciones para que el fallo de la prueba se lea sin abrir el
 * inspector.
 */
export function describirViolaciones(violaciones: readonly ViolacionA11y[]): string {
  if (violaciones.length === 0) {
    return 'sin violaciones';
  }

  return violaciones
    .map(
      (v) =>
        `· [${v.impacto}] ${v.regla}: ${v.descripcion}\n` +
        `    en: ${v.elementos.join(', ')}\n` +
        `    ver: ${v.ayuda}`,
    )
    .join('\n');
}

/**
 * Audita y falla si hay violaciones, con el detalle en el mensaje.
 *
 * Lanza en vez de usar `expect` para no atar este archivo a un framework de
 * pruebas; el `throw` hace fallar la prueba igual y el mensaje ya trae todo.
 */
export async function esperarSinViolaciones(elemento: Element): Promise<void> {
  const violaciones = await auditarA11y(elemento);
  if (violaciones.length > 0) {
    throw new Error(
      `axe encontró ${violaciones.length} violación(es) de accesibilidad:\n${describirViolaciones(violaciones)}`,
    );
  }
}
