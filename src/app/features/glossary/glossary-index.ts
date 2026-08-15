import type { GlossaryTerm } from '../../core/data-access/terminology/terminology.types';

/**
 * El índice alfabético del glosario.
 *
 * Vive aparte del componente porque es lógica pura sobre datos —agrupar por
 * inicial— y así se prueba sin montar una pantalla ni un router. También lo usa
 * la ficha del término, que muestra a qué letra pertenece lo que se está
 * leyendo.
 */

/** Grupo bajo el que se lee una letra del índice. */
export interface GrupoAlfabetico {
  /** La inicial, ya normalizada: `A`, `Ñ`, o {@link LETRA_OTRAS}. */
  readonly letra: string;
  /** Las entradas de esa letra, en el orden en que llegaron. */
  readonly terminos: readonly GlossaryTerm[];
}

/**
 * Dónde caen los términos que no empiezan por letra.
 *
 * Los códigos de laboratorio y algunas unidades empiezan con número o con
 * símbolo. Sin un cajón para ellos, desaparecerían del índice y nadie sabría que
 * están.
 */
export const LETRA_OTRAS = '#';

/**
 * La inicial con la que un término se archiva.
 *
 * Las tildes se pliegan sobre su letra base —«Ámbito» va en la A, no en un cajón
 * aparte— porque quien busca en un glosario en castellano no piensa en «Á» como
 * una letra distinta. La **eñe sí** se conserva: en castellano es una letra
 * propia y su sitio en el abecedario está entre la N y la O.
 *
 * @param termino - El término a archivar.
 * @returns Su inicial normalizada, o {@link LETRA_OTRAS}.
 */
export function inicialDe(termino: GlossaryTerm): string {
  const primera = termino.display.trim().charAt(0).toUpperCase();
  if (primera === '') return LETRA_OTRAS;
  if (primera === 'Ñ') return 'Ñ';

  // `NFD` separa la letra de su tilde en dos caracteres, así que el primero ya
  // es la letra base: «Á» queda en «A». Se prefiere a una expresión regular
  // sobre el rango de combinantes porque ésos son invisibles en el editor y se
  // corrompen con el primer copiar y pegar.
  const sinTilde = primera.normalize('NFD').charAt(0);
  return /^[A-Z]$/.test(sinTilde) ? sinTilde : LETRA_OTRAS;
}

/**
 * Agrupa las entradas por inicial, conservando el orden de llegada.
 *
 * El orden lo decide el backend, que ya devuelve el glosario alfabético por
 * nombre y con las tildes en su sitio. Acá no se reordena nada: reordenar dos
 * veces con dos criterios es cómo aparecen las listas que se ven mal ordenadas
 * sin que nadie sepa por qué.
 *
 * @param terminos - Las entradas a agrupar.
 * @returns Un grupo por letra presente, en el orden en que aparecen.
 */
export function agruparPorLetra(terminos: readonly GlossaryTerm[]): readonly GrupoAlfabetico[] {
  const porLetra = new Map<string, GlossaryTerm[]>();

  for (const termino of terminos) {
    const letra = inicialDe(termino);
    const grupo = porLetra.get(letra);
    if (grupo === undefined) {
      porLetra.set(letra, [termino]);
    } else {
      grupo.push(termino);
    }
  }

  return [...porLetra.entries()].map(([letra, terminosDeLaLetra]) => ({
    letra,
    terminos: terminosDeLaLetra,
  }));
}
