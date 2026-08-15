import type { GlossaryTerm } from '../../core/data-access/terminology/terminology.types';
import { agruparPorLetra, inicialDe, LETRA_OTRAS } from './glossary-index';

/**
 * El índice alfabético, probado sin montar nada: es lógica sobre datos y no
 * necesita un router ni una pantalla para decir la verdad.
 */
function termino(display: string): GlossaryTerm {
  return { conceptId: display, code: display, display };
}

describe('inicialDe', () => {
  it('archiva por la letra inicial, en mayúscula', () => {
    expect(inicialDe(termino('asma'))).toBe('A');
  });

  it('pliega las tildes sobre su letra base', () => {
    // Quien busca en un glosario en castellano no piensa en «Á» como una letra
    // distinta: «Ámbito» tiene que estar en la A o no lo encuentra nadie.
    expect(inicialDe(termino('Ámbito'))).toBe('A');
    expect(inicialDe(termino('Índice'))).toBe('I');
  });

  it('conserva la eñe: en castellano es una letra propia', () => {
    expect(inicialDe(termino('Ñandú'))).toBe('Ñ');
  });

  it('lo que no empieza por letra cae en «otras», no desaparece', () => {
    // Códigos de laboratorio y algunas unidades empiezan por número o símbolo.
    expect(inicialDe(termino('25-hidroxivitamina D'))).toBe(LETRA_OTRAS);
    expect(inicialDe(termino(''))).toBe(LETRA_OTRAS);
  });

  it('ignora los espacios de más al principio', () => {
    expect(inicialDe(termino('  Asma'))).toBe('A');
  });
});

describe('agruparPorLetra', () => {
  it('junta las entradas de la misma inicial', () => {
    const grupos = agruparPorLetra([termino('Asma'), termino('Anemia'), termino('Gastritis')]);

    expect(grupos.map((g) => g.letra)).toEqual(['A', 'G']);
    expect(grupos[0].terminos.map((t) => t.display)).toEqual(['Asma', 'Anemia']);
  });

  it('conserva el orden de llegada: reordenar dos veces es cómo se rompe el orden', () => {
    // El backend ya devuelve el glosario alfabético y con las tildes en su
    // sitio. Acá sólo se agrupa.
    const grupos = agruparPorLetra([termino('Zebra'), termino('Alfa')]);

    expect(grupos.map((g) => g.letra)).toEqual(['Z', 'A']);
  });

  it('sin entradas no inventa grupos vacíos', () => {
    expect(agruparPorLetra([])).toEqual([]);
  });
});
