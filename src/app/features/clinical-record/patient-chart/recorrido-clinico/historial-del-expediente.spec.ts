import { describe, expect, it } from 'vitest';

import {
  aristasDelHistorial,
  atencionDeCadaRegistro,
  compararFilas,
  type FilaOrdenable,
  type FuenteDelHistorial,
} from './historial-del-expediente';

/**
 * Lo que más importa del recorrido no es cómo se ve sino que no mienta: cada
 * línea tiene que estar respaldada por un campo del contrato, y un vínculo que
 * no se puede comprobar no se dibuja.
 */
const vacia: FuenteDelHistorial = {
  encounters: [],
  conditions: [],
  medicationRequests: [],
  observations: [],
  notes: [],
};

describe('atencionDeCadaRegistro', () => {
  it('toma la atención de diagnósticos, recetas, observaciones y notas', () => {
    const mapa = atencionDeCadaRegistro({
      ...vacia,
      conditions: [{ id: 'dx', encounterId: 'c1' }],
      medicationRequests: [{ id: 'rx', encounterId: 'c1' }],
      observations: [{ id: 'ob', encounterId: 'c2' }],
      notes: [{ noteId: 'no', encounterId: 'c2' }],
    });
    expect(Object.fromEntries(mapa)).toEqual({ dx: 'c1', rx: 'c1', ob: 'c2', no: 'c2' });
  });

  it('conserva la atención aunque no haya llegado en la lectura: el registro sí fue en una consulta', () => {
    const mapa = atencionDeCadaRegistro({ ...vacia, conditions: [{ id: 'dx', encounterId: 'fuera-del-tope' }] });
    expect(mapa.get('dx')).toBe('fuera-del-tope');
  });

  it('no inventa atención donde el contrato no la trae', () => {
    const mapa = atencionDeCadaRegistro({
      ...vacia,
      conditions: [{ id: 'dx' }, { id: 'dx2', encounterId: '' }],
    });
    expect(mapa.size).toBe(0);
  });
});

describe('aristasDelHistorial', () => {
  const fuente: FuenteDelHistorial = {
    encounters: [{ id: 'c1' }],
    conditions: [{ id: 'dx', encounterId: 'c1' }],
    medicationRequests: [
      { id: 'rx', encounterId: 'c1', indicationConditionId: 'dx' },
      // Indicada para un diagnóstico que quedó fuera del tope de la lectura.
      { id: 'rx-recortada', indicationConditionId: 'dx-fuera' },
      // Motivo escrito a mano: no apunta a ningún diagnóstico registrado.
      { id: 'rx-texto' },
    ],
    observations: [{ id: 'ob', encounterId: 'c-fuera' }],
    notes: [],
  };
  const aristas = aristasDelHistorial(fuente);

  it('conecta atención → registro y diagnóstico → receta cuando los dos extremos están', () => {
    expect(aristas).toEqual([
      { desde: 'c1', hasta: 'dx', motivo: 'atencion' },
      { desde: 'c1', hasta: 'rx', motivo: 'atencion' },
      { desde: 'dx', hasta: 'rx', motivo: 'indicacion' },
    ]);
  });

  it('no traza hacia una atención que no llegó en la lectura', () => {
    expect(aristas.some((a) => a.hasta === 'ob')).toBe(false);
  });

  it('no traza hacia un diagnóstico recortado ni desde un motivo escrito a mano', () => {
    expect(aristas.some((a) => a.hasta === 'rx-recortada')).toBe(false);
    expect(aristas.some((a) => a.hasta === 'rx-texto')).toBe(false);
  });

  it('un expediente vacío no tiene conexiones', () => {
    expect(aristasDelHistorial(vacia)).toEqual([]);
  });
});

describe('compararFilas', () => {
  const fila = (principal: string, tipo: FilaOrdenable['tipo'], cuando: Date | null): FilaOrdenable => ({
    principal,
    tipo,
    cuando,
  });
  const filas = [
    fila('Atorvastatina', 'medicacion', new Date(2026, 1, 1)),
    fila('Sin fecha', 'documentos', null),
    fila('Hipertensión', 'diagnosticos', new Date(2025, 8, 23)),
    fila('Consulta', 'encuentros', new Date(2026, 9, 26)),
  ];
  const ordenar = (key: string, direction: 'asc' | 'desc') =>
    [...filas].sort(compararFilas({ key, direction })).map((f) => f.principal);

  it('por fecha: lo más reciente primero y lo que no tiene fecha al final', () => {
    expect(ordenar('cuando', 'desc')).toEqual(['Consulta', 'Atorvastatina', 'Hipertensión', 'Sin fecha']);
  });

  it('por fecha ascendente: lo que no tiene fecha sigue al final', () => {
    expect(ordenar('cuando', 'asc')).toEqual(['Hipertensión', 'Atorvastatina', 'Consulta', 'Sin fecha']);
  });

  it('por tipo: en el orden del recorrido', () => {
    expect(ordenar('tipo', 'asc')).toEqual(['Consulta', 'Hipertensión', 'Atorvastatina', 'Sin fecha']);
  });

  it('por registro: alfabético en castellano', () => {
    expect(ordenar('principal', 'asc')).toEqual(['Atorvastatina', 'Consulta', 'Hipertensión', 'Sin fecha']);
  });
});
