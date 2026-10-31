import {
  boxContains,
  focusBox,
  intersectionOf,
  MIN_INTERSECTION_M,
  MIN_UNION_M,
  unionOf,
  withMinSize,
  type FocusBox,
} from './anatomy-focus.logic';

const lado = (b: FocusBox, k: number) => b[k + 3] - b[k];

describe('anatomy-focus.logic', () => {
  const femur: FocusBox = [0, 0, 0, 0.1, 0.4, 0.1];
  const tibia: FocusBox = [0, -0.4, 0, 0.1, 0, 0.1];

  it('la unión es la caja que contiene a todas; sin cajas no hay nada', () => {
    expect(unionOf([femur, tibia])).toEqual([0, -0.4, 0, 0.1, 0.4, 0.1]);
    expect(unionOf([])).toBeNull();
  });

  it('la intersección es donde se cruzan; si no se tocan es null', () => {
    expect(intersectionOf(femur, tibia)).toBeNull(); // sólo comparten una arista: volumen cero
    expect(intersectionOf([0, 0, 0, 2, 2, 2], [1, 1, 1, 3, 3, 3])).toEqual([1, 1, 1, 2, 2, 2]);
    expect(intersectionOf([0, 0, 0, 1, 1, 1], [2, 2, 2, 3, 3, 3])).toBeNull();
  });

  it('el mínimo agranda alrededor del centro y no achica lo que ya es grande', () => {
    const lamina: FocusBox = [0, 0, 0, 0.076, 0.004, 0.062];
    const grande = withMinSize(lamina, MIN_INTERSECTION_M);
    expect(lado(grande, 0)).toBeCloseTo(MIN_INTERSECTION_M);
    expect(lado(grande, 1)).toBeCloseTo(MIN_INTERSECTION_M);
    expect((grande[1] + grande[4]) / 2).toBeCloseTo(0.002);
    expect(withMinSize([0, 0, 0, 1, 1, 1], 0.1)).toEqual([0, 0, 0, 1, 1, 1]);
  });

  it('una articulación (rodilla) se encuadra por la intersección, con tamaño mínimo', () => {
    const solapadas: FocusBox = [0, -0.002, 0, 0.1, 0.002, 0.1];
    const caja = focusBox({ mode: 'intersection', groups: [['f'], ['t']] }, [[femur, solapadas], [solapadas]])!;
    expect(lado(caja, 1)).toBeCloseTo(MIN_INTERSECTION_M);
  });

  it('una intersección vacía o un grupo sin malla cargada cae a la unión', () => {
    const vacia = focusBox({ mode: 'intersection', groups: [['f'], ['t']] }, [[femur], [tibia]])!;
    expect(vacia[1]).toBeCloseTo(-0.4);
    expect(vacia[4]).toBeCloseTo(0.4);
    const faltante = focusBox({ mode: 'intersection', groups: [['f'], ['t']] }, [[femur], []])!;
    expect(faltante[4]).toBeCloseTo(0.4);
  });

  it('una unión diminuta no llena la pantalla: mínimo por omisión; se puede fijar otro', () => {
    const ojo: FocusBox = [0, 0, 0, 0.024, 0.024, 0.024];
    expect(lado(focusBox({ mode: 'union', groups: [['o']] }, [[ojo]])!, 0)).toBeCloseTo(MIN_UNION_M);
    expect(lado(focusBox({ mode: 'union', groups: [['o']], minSize: 0.2 }, [[ojo]])!, 0)).toBeCloseTo(0.2);
  });

  it('sin mallas cargadas no hay caja', () => {
    expect(focusBox({ mode: 'union', groups: [['x']] }, [[]])).toBeNull();
  });

  it('boxContains incluye los bordes', () => {
    expect(boxContains([0, 0, 0, 1, 1, 1], [1, 0, 0.5])).toBe(true);
    expect(boxContains([0, 0, 0, 1, 1, 1], [1.01, 0, 0.5])).toBe(false);
  });
});
