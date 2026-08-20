import {
  claveDelDia,
  fechasDeLaGrilla,
  medianoche,
  primerDiaDeLaGrilla,
  primerDiaDelMes,
  sumarMeses,
} from './calendario-mes';

/**
 * La aritmética compartida de la grilla mensual.
 *
 * Salió del calendario del paciente para que la use también el mes del
 * profesional. Estas pruebas fijan los bordes que se rompen solos: el mes que
 * arranca domingo, el que arranca lunes, y el desborde de `setMonth`.
 */
describe('calendario-mes', () => {
  it('la grilla siempre tiene seis semanas de siete días', () => {
    // De alto fijo a propósito: si cambiara con el mes, el botón de «mes
    // siguiente» se movería de abajo del dedo.
    for (const mes of [new Date(2026, 1, 1), new Date(2026, 7, 1), new Date(2026, 10, 1)]) {
      const grilla = fechasDeLaGrilla(mes);
      expect(grilla).toHaveLength(6);
      expect(grilla.every((semana) => semana.length === 7)).toBe(true);
    }
  });

  it('arranca en lunes, aunque el mes empiece domingo', () => {
    // Noviembre de 2026 empieza domingo: la grilla tiene que retroceder seis
    // días, no cero. Es el caso que se rompe con `getDay()` a secas.
    const inicio = primerDiaDeLaGrilla(new Date(2026, 10, 1));
    expect(inicio.getDay()).toBe(1);
    expect(inicio.getDate()).toBe(26);
    expect(inicio.getMonth()).toBe(9);
  });

  it('no retrocede cuando el mes ya empieza lunes', () => {
    // Junio de 2026 empieza lunes.
    const inicio = primerDiaDeLaGrilla(new Date(2026, 5, 1));
    expect(inicio.getDate()).toBe(1);
    expect(inicio.getMonth()).toBe(5);
  });

  it('la grilla contiene todos los días del mes', () => {
    const grilla = fechasDeLaGrilla(new Date(2026, 7, 1)).flat();
    const delMes = grilla.filter((f) => f.getMonth() === 7);
    expect(delMes).toHaveLength(31);
  });

  it('sumar meses no desborda como setMonth', () => {
    // `new Date(2026, 0, 31).setMonth(1)` da el 3 de marzo.
    const enero = new Date(2026, 0, 31);
    const siguiente = sumarMeses(enero, 1);
    expect(siguiente.getMonth()).toBe(1);
    expect(siguiente.getDate()).toBe(1);
  });

  it('sumar meses cruza el año hacia atrás y hacia adelante', () => {
    expect(sumarMeses(new Date(2026, 0, 1), -1).getFullYear()).toBe(2025);
    expect(sumarMeses(new Date(2026, 11, 1), 1).getFullYear()).toBe(2027);
  });

  it('la clave del día agrupa el mismo día a cualquier hora', () => {
    expect(claveDelDia(new Date(2026, 7, 20, 9, 0))).toBe(
      claveDelDia(new Date(2026, 7, 20, 23, 59)),
    );
  });

  it('medianoche descarta la hora, no el día', () => {
    const m = medianoche(new Date(2026, 7, 20, 18, 30));
    expect(m.getDate()).toBe(20);
    expect(m.getHours()).toBe(0);
  });

  it('el primer día del mes es el 1, a medianoche', () => {
    const p = primerDiaDelMes(new Date(2026, 7, 20, 18, 30));
    expect(p.getDate()).toBe(1);
    expect(p.getHours()).toBe(0);
  });
});
