import type { GlossaryTerm } from '../../core/data-access/terminology/terminology.types';

/** Un tramo del índice alfabético: la inicial y los términos que empiezan con ella. */
export interface GrupoAlfabetico {
  readonly letra: string;
  readonly terminos: readonly GlossaryTerm[];
}

/**
 * La inicial con la que un término entra al índice.
 *
 * Se quitan los diacríticos antes de mirar la letra —«Órgano» va bajo la O,
 * no bajo una entrada propia— y todo lo que no sea una letra cae en `#`, que
 * es como resuelve un índice impreso los términos que empiezan con cifra o
 * símbolo.
 *
 * La **Ñ se exceptúa** y conserva su tramo. `NFD` la descompone en `N` + tilde
 * y quitar el diacrítico la convertiría en `N`, que es lo mismo que hacer con
 * la O y la Ó — sólo que la Ñ no es una O con acento: es una letra del
 * alfabeto castellano, con su propia entrada en cualquier diccionario.
 * `localeCompare(…, 'es')` ya la ordena entre la N y la O, así que alcanza con
 * no perderla acá.
 */
export function inicialDe(display: string): string {
  const primera = display.trim().normalize('NFC').charAt(0).toLocaleUpperCase('es');
  if (primera === 'Ñ') return 'Ñ';

  const sinDiacritico = primera.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return /^[A-Z]$/.test(sinDiacritico) ? sinDiacritico : '#';
}

/**
 * Agrupa términos por inicial, en orden alfabético castellano.
 *
 * Es lo que convierte una lista en un índice hojeable: sin los tramos, ochenta
 * definiciones seguidas no tienen dónde saltar. `#` va al final, donde no
 * estorba la lectura de la A.
 *
 * @param terminos - Los términos a agrupar, en cualquier orden.
 * @returns Los tramos con al menos un término, ordenados.
 */
export function porInicial(terminos: readonly GlossaryTerm[]): readonly GrupoAlfabetico[] {
  const porLetra = new Map<string, GlossaryTerm[]>();

  for (const termino of terminos) {
    const letra = inicialDe(termino.display);
    const acumulado = porLetra.get(letra);
    if (acumulado === undefined) {
      porLetra.set(letra, [termino]);
    } else {
      acumulado.push(termino);
    }
  }

  return [...porLetra.entries()]
    .sort(([a], [b]) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b, 'es');
    })
    .map(([letra, agrupados]) => ({
      letra,
      terminos: [...agrupados].sort((x, y) => x.display.localeCompare(y.display, 'es')),
    }));
}
