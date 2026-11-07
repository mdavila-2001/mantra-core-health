import { describe, expect, it } from 'vitest';

import {
  esCritico,
  estaFueraDeRango,
  leerValor,
  textoDelRango,
  textoDelValor,
} from './red-clinica-valores';

describe('leerValor', () => {
  it('compara el número con los dos límites', () => {
    expect(leerValor({ nombre: 'Glucemia', valor: 90, rango: { bajo: 70, alto: 110 } })).toBe('normal');
    expect(leerValor({ nombre: 'Glucemia', valor: 65, rango: { bajo: 70, alto: 110 } })).toBe('bajo');
    expect(leerValor({ nombre: 'Glucemia', valor: 126, rango: { bajo: 70, alto: 110 } })).toBe('alto');
  });

  it('los límites son inclusivos', () => {
    expect(leerValor({ nombre: 'x', valor: 70, rango: { bajo: 70, alto: 110 } })).toBe('normal');
    expect(leerValor({ nombre: 'x', valor: 110, rango: { bajo: 70, alto: 110 } })).toBe('normal');
  });

  it('acepta un solo límite', () => {
    expect(leerValor({ nombre: 'HDL', valor: 38, rango: { bajo: 40 } })).toBe('bajo');
    expect(leerValor({ nombre: 'LDL', valor: 131, rango: { alto: 130 } })).toBe('alto');
  });

  it('lee números escritos como texto, con coma o punto', () => {
    expect(leerValor({ nombre: 'x', valor: '12,5', rango: { alto: 12 } })).toBe('alto');
    expect(leerValor({ nombre: 'x', valor: ' 11.9 ', rango: { alto: 12 } })).toBe('normal');
  });

  it('no compara textos que no son un número', () => {
    expect(leerValor({ nombre: 'x', valor: '<5', rango: { alto: 4 } })).toBe('sin-referencia');
    expect(leerValor({ nombre: 'x', valor: 'Positivo', rango: { texto: 'Negativo' } })).toBe('sin-referencia');
  });

  it('sin rango o con rango sólo textual no hay referencia', () => {
    expect(leerValor({ nombre: 'x', valor: 3 })).toBe('sin-referencia');
    expect(leerValor({ nombre: 'x', valor: 3, rango: { texto: 'ver informe' } })).toBe('sin-referencia');
    expect(leerValor({ nombre: 'x', valor: Number.NaN, rango: { alto: 1 } })).toBe('sin-referencia');
  });

  it('la interpretación del laboratorio manda sobre el rango impreso', () => {
    expect(
      leerValor({ nombre: 'x', valor: 150, rango: { alto: 100 }, interpretacion: 'normal' }),
    ).toBe('normal');
    expect(leerValor({ nombre: 'x', valor: 'Positivo', interpretacion: 'anormal' })).toBe('anormal');
  });
});

describe('fuera de rango y críticos', () => {
  it('fuera de rango incluye anormal y críticos, no normal ni sin referencia', () => {
    expect(estaFueraDeRango({ nombre: 'x', valor: 1, rango: { bajo: 2 } })).toBe(true);
    expect(estaFueraDeRango({ nombre: 'x', valor: 'Positivo', interpretacion: 'anormal' })).toBe(true);
    expect(estaFueraDeRango({ nombre: 'x', valor: 2, rango: { bajo: 2 } })).toBe(false);
    expect(estaFueraDeRango({ nombre: 'x', valor: 'trazas' })).toBe(false);
  });

  it('crítico sólo por interpretación: un número muy alto no se declara crítico acá', () => {
    expect(esCritico({ nombre: 'K', valor: 6.8, interpretacion: 'critico-alto' })).toBe(true);
    expect(esCritico({ nombre: 'K', valor: 9, rango: { alto: 5 } })).toBe(false);
  });
});

describe('textos', () => {
  it('imprime el rango con unidad', () => {
    expect(textoDelRango({ bajo: 70, alto: 110 }, 'mg/dL')).toBe('70 – 110 mg/dL');
    expect(textoDelRango({ bajo: 40 }, 'mg/dL')).toBe('≥ 40 mg/dL');
    expect(textoDelRango({ alto: 135 })).toBe('≤ 135');
    expect(textoDelRango({ texto: 'Negativo' })).toBe('Negativo');
    expect(textoDelRango(undefined)).toBe('—');
  });

  it('imprime el valor con coma decimal local', () => {
    expect(textoDelValor({ nombre: 'x', valor: 12.5, unidad: 'g/dL' })).toBe('12,5 g/dL');
    expect(textoDelValor({ nombre: 'x', valor: 'Negativo' })).toBe('Negativo');
  });
});
