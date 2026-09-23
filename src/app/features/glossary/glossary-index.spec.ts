import { inicialDe, porInicial } from './glossary-index';
import type { GlossaryTerm } from '../../core/data-access/terminology/terminology.types';

/**
 * El índice alfabético de la enciclopedia.
 *
 * Es lo único del glosario que decide **orden**, y el orden castellano no es
 * el de `Array.prototype.sort()`: sin `localeCompare(…, 'es')` la Ñ cae
 * después de la Z y «Ácido» no se ordena junto a «Anemia». Por eso se prueba
 * acá aparte y no sólo a través del componente: un cambio de criterio se
 * nota en estas cuatro aserciones antes que en una pantalla.
 */
function termino(display: string): GlossaryTerm {
  return {
    conceptId: display,
    code: display,
    display,
    slug: display,
    translated: true,
    valueSets: [],
    category: null,
    shortDefinition: '',
    tags: [],
    relationsCount: 0,
    status: 'active',
  } as GlossaryTerm;
}

describe('inicialDe', () => {
  it('devuelve la letra en mayúscula', () => {
    expect(inicialDe('anemia')).toBe('A');
  });

  it('quita los diacríticos: «Órgano» entra por la O, no por una entrada propia', () => {
    expect(inicialDe('Órgano')).toBe('O');
    expect(inicialDe('Ácido úrico')).toBe('A');
  });

  it('la Ñ conserva su tramo y no se pisa con la N', () => {
    // `NFD` + quitar diacríticos convierte «Ñ» en «N», y así se comportaba
    // hasta el 2026-09-12: «Ñandú» entraba bajo la N. La Ñ no es una N con
    // acento —es una letra del alfabeto, con entrada propia en el diccionario—
    // y por eso se exceptúa. Ni mayúscula ni minúscula deben colapsar.
    expect(inicialDe('Ñandú')).toBe('Ñ');
    expect(inicialDe('ñandú')).toBe('Ñ');
    expect(inicialDe('Nefritis')).toBe('N');
  });

  it('lo que no empieza con letra cae en «#», como en un índice impreso', () => {
    expect(inicialDe('5-hidroxitriptamina')).toBe('#');
    expect(inicialDe('β-bloqueante')).toBe('#');
  });

  it('ignora los espacios de más al principio', () => {
    expect(inicialDe('  disnea')).toBe('D');
  });
});

describe('porInicial', () => {
  it('sin términos no hay tramos: no se dibuja un índice vacío', () => {
    expect(porInicial([])).toEqual([]);
  });

  it('agrupa por inicial y ordena los tramos en castellano', () => {
    const grupos = porInicial([termino('Disnea'), termino('Anemia'), termino('Bradicardia')]);

    expect(grupos.map((g) => g.letra)).toEqual(['A', 'B', 'D']);
  });

  it('dentro del tramo ordena los términos alfabéticamente', () => {
    const grupos = porInicial([termino('Asma'), termino('Anemia'), termino('Aftas')]);

    expect(grupos[0].terminos.map((t) => t.display)).toEqual(['Aftas', 'Anemia', 'Asma']);
  });

  it('la Ñ se ordena entre la N y la O, no al final del abecedario', () => {
    const grupos = porInicial([termino('Ovario'), termino('Ñandú'), termino('Nefritis')]);

    expect(grupos.map((g) => g.letra)).toEqual(['N', 'Ñ', 'O']);
  });

  it('«#» va al final: no estorba la lectura de la A', () => {
    const grupos = porInicial([termino('5-HT'), termino('Anemia'), termino('Zoster')]);

    expect(grupos.map((g) => g.letra)).toEqual(['A', 'Z', '#']);
  });

  it('no pierde ni duplica términos', () => {
    const entrada = [termino('Anemia'), termino('Ácido'), termino('9-1-1'), termino('Zoster')];
    const salida = porInicial(entrada).flatMap((g) => g.terminos);

    expect(salida.length).toBe(entrada.length);
    expect(new Set(salida.map((t) => t.conceptId)).size).toBe(entrada.length);
  });

  it('no muta el arreglo que recibe', () => {
    const entrada = [termino('Zoster'), termino('Anemia')];
    porInicial(entrada);

    expect(entrada.map((t) => t.display)).toEqual(['Zoster', 'Anemia']);
  });
});
