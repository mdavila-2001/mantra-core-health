import { camposOcultos, cumpleCondicion } from './visibilidad-condicional';

describe('visibilidad condicional (enableWhen =)', () => {
  const ficha = [
    { key: 'alergias' },
    { key: 'alergias_cual', showWhen: { key: 'alergias', equals: true } },
    { key: 'tabaco' },
    { key: 'cigarrillos', showWhen: { key: 'tabaco', equals: ['Fumador actual'] } },
    { key: 'sintomas' },
    { key: 'fiebre_dias', showWhen: { key: 'sintomas', equals: 'Fiebre' } },
    { key: 'fiebre_patron', showWhen: { key: 'fiebre_dias', equals: '7' } },
  ] as const;

  const ocultosCon = (valores: Record<string, unknown>) =>
    [...camposOcultos(ficha, (key) => valores[key])].sort();

  it('un «sí» muestra el «¿cuál?», y un «no» o la falta de respuesta lo esconden', () => {
    expect(ocultosCon({ alergias: true })).not.toContain('alergias_cual');
    expect(ocultosCon({ alergias: false })).toContain('alergias_cual');
    expect(ocultosCon({})).toContain('alergias_cual');
  });

  it('con un padre de varias respuestas basta con que incluya el valor', () => {
    expect(ocultosCon({ sintomas: ['Tos', 'Fiebre'] })).not.toContain('fiebre_dias');
    expect(ocultosCon({ sintomas: ['Tos'] })).toContain('fiebre_dias');
  });

  it('un nieto se esconde si se esconde su padre, aunque su condición se cumpla', () => {
    expect(ocultosCon({ sintomas: ['Fiebre'], fiebre_dias: '7' })).not.toContain('fiebre_patron');
    expect(ocultosCon({ sintomas: ['Tos'], fiebre_dias: '7' })).toContain('fiebre_patron');
  });

  it('una condición a un campo que no está se ignora: el campo se ve', () => {
    expect([...camposOcultos([{ key: 'x', showWhen: { key: 'nadie', equals: true } }], () => undefined)]).toEqual([]);
  });

  it('compara por igualdad estricta, sin confundir «true» con true', () => {
    expect(cumpleCondicion('true', true)).toBe(false);
    expect(cumpleCondicion(true, [false, true])).toBe(true);
  });
});
