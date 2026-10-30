import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import { rowsOfPrescription } from './pharmacy-branches';

/** Una fila del resumen clínico, con lo mínimo que `rowsOfPrescription` mira. */
function row(id: string, encounterId?: string): MedicationRequest {
  return {
    id,
    medicationConceptId: `concepto-${id}`,
    statusConceptId: 'st-activa',
    createdAt: new Date('2026-03-01T10:30:00.000Z'),
    ...(encounterId === undefined ? {} : { encounterId }),
  };
}

/**
 * La receta elegida (FAR-03 · D-3): «Dónde comprar» toma sólo las filas del
 * mismo encuentro, porque el pedido viaja bajo un único `medicationRequestId`.
 */
describe('rowsOfPrescription (FAR-03 · D-3)', () => {
  it('de dos encuentros, devuelve sólo las filas del encuentro de la elegida', () => {
    const rows = [row('rx-a1', 'enc-a'), row('rx-b1', 'enc-b'), row('rx-a2', 'enc-a')];

    expect(rowsOfPrescription(rows, 'rx-a2').map((r) => r.id)).toEqual(['rx-a1', 'rx-a2']);
    expect(rowsOfPrescription(rows, 'rx-b1').map((r) => r.id)).toEqual(['rx-b1']);
  });

  it('una fila sin encuentro es una receta sola: no arrastra a las otras sin encuentro', () => {
    const rows = [row('rx-suelta'), row('rx-otra-suelta'), row('rx-a1', 'enc-a')];

    expect(rowsOfPrescription(rows, 'rx-suelta').map((r) => r.id)).toEqual(['rx-suelta']);
  });

  it('el encuentro en null (como lo serializa la API) tampoco junta fármacos sueltos', () => {
    // La API manda la clave con `null` cuando la columna está vacía; el tipo
    // del front la declara opcional, así que el doble la fuerza.
    const suelta = (id: string): MedicationRequest =>
      ({ ...row(id), encounterId: null }) as unknown as MedicationRequest;
    const rows = [suelta('rx-suelta'), suelta('rx-otra-suelta'), row('rx-a1', 'enc-a')];

    expect(rowsOfPrescription(rows, 'rx-suelta').map((r) => r.id)).toEqual(['rx-suelta']);
  });

  it('un id que no está en la lista no trae nada', () => {
    const rows = [row('rx-a1', 'enc-a'), row('rx-suelta')];

    expect(rowsOfPrescription(rows, 'rx-inexistente')).toEqual([]);
    expect(rowsOfPrescription([], 'rx-a1')).toEqual([]);
  });
});
