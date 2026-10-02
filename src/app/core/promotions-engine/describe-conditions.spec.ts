import { describeConditions } from './describe-conditions';
import { NO_CONDITIONS } from './promotion-mechanics.types';
import type { CampaignConditions } from './promotion-mechanics.types';

function lines(changes: Partial<CampaignConditions>): readonly string[] {
  return describeConditions({ ...NO_CONDITIONS, ...changes }, { currency: 'Bs' });
}

describe('describeConditions', () => {
  it('sin condiciones no dice nada', () => {
    expect(lines({})).toEqual([]);
  });

  it('dice los días de la semana, lunes primero', () => {
    expect(lines({ weekdays: [0, 6] })).toEqual(['Vale los sábados y domingos.']);
    expect(lines({ weekdays: [5, 1, 3] })).toEqual(['Vale los lunes, miércoles y viernes.']);
    expect(lines({ weekdays: [2] })).toEqual(['Vale los martes.']);
  });

  it('con los siete días dice «todos los días»', () => {
    expect(lines({ weekdays: [0, 1, 2, 3, 4, 5, 6] })).toEqual(['Vale todos los días.']);
  });

  it('dice la franja horaria', () => {
    expect(lines({ fromTime: '09:00', toTime: '18:00' })).toEqual(['En el horario de 09:00 a 18:00.']);
  });

  it('una franja a medias no se dice: el validador ya la rechaza', () => {
    expect(lines({ fromTime: '09:00' })).toEqual([]);
  });

  it('dice que hace falta un cupón pero NUNCA el código: la ficha es pública', () => {
    const text = lines({ couponCode: 'AHORRO50' }).join(' ');

    expect(text).toBe('Se necesita un cupón para usarla.');
    expect(text).not.toContain('AHORRO50');
  });

  it('dice el tope con su moneda', () => {
    expect(lines({ maxDiscount: '50.00' })).toEqual(['Descuento máximo de Bs 50 por pedido.']);
    expect(lines({ maxDiscount: '12.50' })).toEqual(['Descuento máximo de Bs 12.50 por pedido.']);
  });

  it('dice el límite por persona, en singular y en plural', () => {
    expect(lines({ perPersonLimit: 1 })).toEqual(['Se puede usar una vez por persona.']);
    expect(lines({ perPersonLimit: 3 })).toEqual(['Se puede usar hasta 3 veces por persona.']);
  });

  it('dice «hasta agotar stock»', () => {
    expect(lines({ availableUnits: 100 })).toEqual(['Hasta agotar stock: 100 unidades disponibles.']);
  });

  it('avisa cuando no se suma con otras campañas', () => {
    expect(lines({ stackable: false })).toEqual(['No se suma con otras campañas.']);
  });

  it('NO dice el presupuesto: es un dato interno', () => {
    expect(lines({ budget: '5000' })).toEqual([]);
  });

  it('junta todo en el orden en que se lee', () => {
    expect(
      lines({
        weekdays: [6],
        fromTime: '09:00',
        toTime: '12:00',
        maxDiscount: '20.00',
        stackable: false,
      }),
    ).toEqual([
      'Vale los sábados.',
      'En el horario de 09:00 a 12:00.',
      'Descuento máximo de Bs 20 por pedido.',
      'No se suma con otras campañas.',
    ]);
  });
});
