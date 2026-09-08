import { aMedianoche, conHora, type BloqueoPedido } from './block-form';
import { franjasPorDia } from '../my-agenda';

/**
 * El bloqueo por rango y por franja (D4 del plan de UX del 22/08/2026).
 *
 * Lo que se fija acá es la parte que **no se ve** y que decide si un bloqueo
 * hace lo que dice: cuántas excepciones se mandan y con qué instantes. La
 * pantalla puede verse bien y dejar la agenda abierta un día de más.
 */
describe('franjasPorDia', () => {
  function pedido(desde: Date, hasta: Date): BloqueoPedido {
    return { desde, hasta, clase: 'especialidad', motivo: 'Quirófano', dias: 0, franjaHoraria: true };
  }

  it('manda una excepción por cada día del rango, no una sola de punta a punta', () => {
    // Es la diferencia entre «las tardes del 10 al 12» y «del 10 a las 14:00
    // al 12 a las 18:00». Lo segundo se lleva puestas las noches y las mañanas
    // del medio, que es lo contrario de lo que alguien pide.
    const intervalos = franjasPorDia(
      pedido(conHora(new Date(2026, 8, 10), '14:00'), conHora(new Date(2026, 8, 12), '18:00')),
    );

    expect(intervalos).toHaveLength(3);
    for (const intervalo of intervalos) {
      expect(intervalo.startAt.getHours()).toBe(14);
      expect(intervalo.endAt.getHours()).toBe(18);
      // Cada franja empieza y termina el MISMO día: si cruzara, bloquearía la
      // noche entera.
      expect(intervalo.startAt.getDate()).toBe(intervalo.endAt.getDate());
    }
    expect(intervalos.map((i) => i.startAt.getDate())).toEqual([10, 11, 12]);
  });

  it('un solo día da una sola excepción', () => {
    const dia = new Date(2026, 8, 10);
    const intervalos = franjasPorDia(pedido(conHora(dia, '08:00'), conHora(dia, '12:30')));

    expect(intervalos).toHaveLength(1);
    expect(intervalos[0].endAt.getHours()).toBe(12);
    expect(intervalos[0].endAt.getMinutes()).toBe(30);
  });

  it('recorre por fecha y no sumando 24 horas: un día no siempre dura 24', () => {
    // En un cambio de horario de verano un día dura 23 o 25 horas. Sumando
    // 86 400 000 milisegundos, la franja se correría una hora a partir de ahí y
    // el bloqueo dejaría de coincidir con la agenda. Se comprueba sobre un mes
    // largo para que el recorrido no dependa del huso de quien corre la prueba.
    const intervalos = franjasPorDia(
      pedido(conHora(new Date(2026, 9, 25), '09:00'), conHora(new Date(2026, 10, 2), '13:00')),
    );

    expect(intervalos).toHaveLength(9);
    for (const intervalo of intervalos) {
      expect(intervalo.startAt.getHours()).toBe(9);
      expect(intervalo.endAt.getHours()).toBe(13);
    }
  });
});

describe('aMedianoche', () => {
  it('deja la fecha y borra la hora, en horario local', () => {
    const cuando = aMedianoche(new Date(2026, 1, 14, 17, 45, 30, 500));

    expect(cuando.getFullYear()).toBe(2026);
    expect(cuando.getMonth()).toBe(1);
    expect(cuando.getDate()).toBe(14);
    expect(cuando.getHours()).toBe(0);
    expect(cuando.getMinutes()).toBe(0);
    expect(cuando.getSeconds()).toBe(0);
  });
});
