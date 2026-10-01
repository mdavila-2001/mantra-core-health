import { MAX_VISIBLE_NUDGES, nearestNudges } from './nearest-nudges';
import type { Mechanic, Nudge } from './promotion-mechanics.types';

const REWARD: Mechanic = { kind: 'BUY_X_PAY_Y', take: 2, pay: 1 };

const units = (campaignId: string, missingUnits: number): Nudge => ({ kind: 'ADD_UNITS', campaignId, missingUnits, reward: REWARD });
const spend = (campaignId: string, missingAmount: string): Nudge => ({ kind: 'SPEND_MORE', campaignId, missingAmount, reward: REWARD });

describe('nearestNudges', () => {
  it('sin avisos no devuelve nada', () => {
    expect(nearestNudges([])).toEqual([]);
  });

  it('muestra pocos: el tope por omisión', () => {
    const many = [units('a', 1), units('b', 2), units('c', 3), spend('d', '5.00')];

    expect(nearestNudges(many)).toHaveLength(MAX_VISIBLE_NUDGES);
  });

  it('primero las unidades, y dentro de cada tipo el que menos falta', () => {
    const result = nearestNudges([spend('s2', '40.00'), units('u3', 3), spend('s1', '5.00'), units('u1', 1)], 4);

    expect(result.map((nudge) => nudge.campaignId)).toEqual(['u1', 'u3', 's1', 's2']);
  });

  it('compara los importes como números, no como texto', () => {
    const result = nearestNudges([spend('grande', '100.00'), spend('chico', '9.50')], 2);

    expect(result.map((nudge) => nudge.campaignId)).toEqual(['chico', 'grande']);
  });

  it('respeta el límite pedido', () => {
    expect(nearestNudges([units('a', 1), units('b', 2)], 1)).toHaveLength(1);
  });

  it('no modifica la lista que recibe', () => {
    const original = [units('b', 2), units('a', 1)];
    nearestNudges(original);

    expect(original.map((nudge) => nudge.campaignId)).toEqual(['b', 'a']);
  });
});
