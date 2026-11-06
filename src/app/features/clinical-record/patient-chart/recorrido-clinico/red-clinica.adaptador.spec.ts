import { describe, expect, it } from 'vitest';

import {
  construirRed,
  estadoDeLaDerivacion,
  type FilaPresentada,
  type FuenteDeLaRed,
  type Rotulador,
} from './red-clinica.adaptador';

/**
 * Lo que más importa de la red no es cómo se ve sino que no mienta: cada
 * línea tiene que estar respaldada por un campo del contrato (o marcada como
 * inferida), y un vínculo que no se puede comprobar no se dibuja.
 */
const vacia: FuenteDeLaRed = {
  encounters: [],
  conditions: [],
  medicationRequests: [],
  observations: [],
  notes: [],
  carePlans: [],
};
const fila = (id: string, tipo: FilaPresentada['tipo'], extra: Partial<FilaPresentada> = {}): FilaPresentada => ({
  id,
  tipo,
  titulo: id,
  detalle: '',
  estado: '',
  cuando: new Date(2026, 0, 10),
  ...extra,
});
const ETIQUETAS: Readonly<Record<string, { display?: string; code?: string }>> = {
  'st-cancelada': { display: 'Cancelada', code: 'BK-CANCELLED' },
  'st-atendida': { display: 'Atendida', code: 'BK-COMPLETED' },
  'cod-mapa': { display: 'MAPA 24 h' },
  'st-orden': { display: 'Activa' },
};
const rotular: Rotulador = (id) => (id === undefined ? {} : (ETIQUETAS[id] ?? {}));

describe('construirRed · lo que ya conectaba el recorrido', () => {
  const filas = [
    fila('c1', 'encuentros'),
    fila('dx', 'diagnosticos'),
    fila('rx', 'medicacion'),
    fila('rx-recortada', 'medicacion'),
    fila('rx-texto', 'medicacion'),
    fila('ob', 'observaciones'),
  ];
  const { vinculos, registros } = construirRed(
    filas,
    {
      ...vacia,
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
    },
    rotular,
  );

  it('conecta atención → registro y diagnóstico → receta cuando los dos extremos están', () => {
    expect(vinculos).toEqual([
      { desde: 'c1', hasta: 'dx', motivo: 'registrado-en' },
      { desde: 'c1', hasta: 'rx', motivo: 'registrado-en' },
      { desde: 'dx', hasta: 'rx', motivo: 'indicado-para' },
    ]);
  });

  it('no traza hacia una atención que no llegó, pero conserva en qué atención se registró', () => {
    expect(vinculos.some((v) => v.hasta === 'ob')).toBe(false);
    expect(registros.find((r) => r.id === 'ob')?.encuentroId).toBe('c-fuera');
  });

  it('no traza hacia un diagnóstico recortado ni desde un motivo escrito a mano', () => {
    expect(vinculos.some((v) => v.hasta === 'rx-recortada')).toBe(false);
    expect(vinculos.some((v) => v.hasta === 'rx-texto')).toBe(false);
  });

  it('un expediente vacío no tiene registros ni vínculos', () => {
    expect(construirRed([], vacia, rotular)).toEqual({ registros: [], vinculos: [] });
  });
});

describe('construirRed · los vínculos nuevos del contrato', () => {
  const filas = [
    fila('e1', 'encuentros'),
    fila('e2', 'encuentros', { cuando: new Date(2026, 2, 1) }),
    fila('dx-p', 'diagnosticos', { certeza: 'presuntivo' }),
    fila('dx-x', 'diagnosticos', { certeza: 'descartado' }),
    fila('dx-ok', 'diagnosticos', { certeza: 'confirmado' }),
    fila('n1', 'notas'),
    fila('plan', 'planes'),
    fila('rx-a', 'medicacion'),
    fila('rx-b', 'medicacion'),
    fila('i1', 'internaciones'),
  ];
  const fuente: FuenteDeLaRed = {
    ...vacia,
    encounters: [{ id: 'e1' }, { id: 'e2', episodeId: 'i1' }],
    conditions: [
      { id: 'dx-p', encounterId: 'e1' },
      { id: 'dx-x', encounterId: 'e1', replacedByConditionId: 'dx-ok' },
      { id: 'dx-ok', encounterId: 'e2', verification: { basedOn: { kind: 'NOTE', noteId: 'n1' } } },
    ],
    medicationRequests: [{ id: 'rx-a', replacedByRequestId: 'rx-b' }, { id: 'rx-b' }],
    notes: [{ noteId: 'n1', encounterId: 'e1' }],
    carePlans: [{ id: 'plan', conditionId: 'dx-ok' }],
    citas: [
      { id: 'b0', createdAt: new Date(2025, 11, 1), startAt: new Date(2026, 0, 10, 9), statusConceptId: 'st-atendida' },
      { id: 'b1', createdAt: new Date(2026, 0, 10), startAt: new Date(2026, 1, 10), statusConceptId: 'st-atendida', followUpOf: { bookingId: 'b0', encounterId: 'e1' } },
      { id: 'b2', createdAt: new Date(2026, 0, 10), startAt: new Date(2026, 2, 1), statusConceptId: 'st-cancelada' },
      { id: 'b3', createdAt: new Date(2026, 0, 10), startAt: new Date(2026, 3, 1), statusConceptId: 'st-atendida', followUpOf: { bookingId: 'fuera', encounterId: 'e2' } },
    ],
    derivaciones: [
      { id: 'ref', createdAt: new Date(2026, 0, 10), status: 'ACCEPTED', sourceEncounterId: 'e1', targetEncounterId: 'e2', targetDisplayName: 'Cardiología' },
    ],
    estudios: {
      orders: [
        { id: 'o-con', encounterId: 'e1', codeConceptId: 'cod-mapa', statusConceptId: 'st-orden', createdAt: new Date(2026, 0, 10), reasonConditionId: 'dx-p' },
        { id: 'o-sin', encounterId: 'e1', codeConceptId: 'cod-mapa', statusConceptId: 'st-orden', createdAt: new Date(2026, 0, 10) },
      ],
      reports: [{ id: 'inf', serviceRequestId: 'o-con', codeConceptId: 'cod-mapa', lifecycleStatusConceptId: 'st-orden', createdAt: new Date(2026, 0, 20) }],
    },
    procedimientos: [
      { id: 'proc', encounterId: 'e2', procedureCodeConceptId: 'x', statusConceptId: 'y', createdAt: new Date(2026, 2, 1) },
    ],
  };
  const { registros, vinculos } = construirRed(filas, fuente, rotular);
  const tiene = (desde: string, hasta: string, motivo: string): boolean =>
    vinculos.some((v) => v.desde === desde && v.hasta === hasta && v.motivo === motivo);

  it('lee los tres campos nuevos: motivo del estudio, reemplazo del descartado y atención de destino', () => {
    expect(tiene('dx-p', 'o-con', 'pedido-para')).toBe(true);
    expect(tiene('dx-x', 'dx-ok', 'reemplazado-por')).toBe(true);
    expect(tiene('ref', 'e2', 'recibido-en')).toBe(true);
  });

  it('une el resultado a su estudio, la receta a la que la reemplazó, el plan y la evidencia a su diagnóstico', () => {
    expect(tiene('o-con', 'inf', 'resultado-de')).toBe(true);
    expect(tiene('rx-a', 'rx-b', 'receta-reemplazada')).toBe(true);
    expect(tiene('dx-ok', 'plan', 'plan-para')).toBe(true);
    expect(tiene('n1', 'dx-ok', 'evidencia')).toBe(true);
  });

  it('la derivación sale de su atención de origen y la internación contiene su atención', () => {
    expect(tiene('e1', 'ref', 'derivado-desde')).toBe(true);
    expect(tiene('i1', 'e2', 'durante-internacion')).toBe(true);
    expect(registros.find((r) => r.id === 'ref')?.titulo).toBe('Derivación a Cardiología');
  });

  it('encadena la reconsulta a su cita de origen; si la cita no llegó, a la atención de origen', () => {
    expect(tiene('b0', 'b1', 'reconsulta-de')).toBe(true);
    expect(tiene('e2', 'b3', 'reconsulta-de')).toBe(true);
    expect(registros.find((r) => r.id === 'b1')?.titulo).toBe('Reconsulta');
  });

  it('marca como inferido el estudio sin motivo pedido junto al presuntivo, y nada más', () => {
    expect(tiene('dx-p', 'o-sin', 'inferido-misma-atencion')).toBe(true);
    expect(tiene('dx-p', 'o-con', 'inferido-misma-atencion')).toBe(false);
  });

  it('infiere la atención de la cita atendida del mismo día y la ubica en su columna; a la cancelada, no', () => {
    expect(tiene('b0', 'e1', 'inferido-mismo-dia')).toBe(true);
    expect(registros.find((r) => r.id === 'b0')?.encuentroId).toBe('e1');
    expect(vinculos.some((v) => v.desde === 'b2')).toBe(false);
    expect(registros.find((r) => r.id === 'b2')?.estado).toBe('Cancelada');
    expect(registros.find((r) => r.id === 'b2')?.tonoDelEstado).toBe('error');
  });

  it('nombra estudios y resultados con la terminología, y lo que no tiene nombre dice qué es', () => {
    expect(registros.find((r) => r.id === 'o-con')?.titulo).toBe('MAPA 24 h');
    expect(registros.find((r) => r.id === 'proc')?.titulo).toBe('Procedimiento');
  });

  it('sin los campos nuevos (contrato anterior) no dibuja esos vínculos ni se rompe', () => {
    const sinCampo = fuente.conditions.map((c) => ({ id: c.id, encounterId: c.encounterId, verification: c.verification }));
    const viejo = construirRed(filas, { ...fuente, conditions: sinCampo }, rotular);
    expect(viejo.vinculos.some((v) => v.motivo === 'reemplazado-por')).toBe(false);
  });

  it('sin las lecturas propias de la red (todavía no llegaron) dibuja sólo los bloques', () => {
    const sin = construirRed(filas, { ...fuente, citas: null, derivaciones: null, estudios: null, procedimientos: null }, rotular);
    expect(sin.registros.map((r) => r.id).sort()).toEqual(filas.map((f) => f.id).sort());
  });
});

describe('estadoDeLaDerivacion', () => {
  const base = { id: 'r', createdAt: new Date(2026, 0, 1) };
  it.each([
    [{ status: 'PENDING' }, 'Enviada'],
    [{ status: 'ACCEPTED' }, 'Aceptada'],
    [{ status: 'REJECTED' }, 'Rechazada'],
    [{ status: 'ACCEPTED', transfer: { arrivedAt: new Date() } }, 'Llegó al destino'],
    [{ status: 'COMPLETED', counterReferralAt: new Date() }, 'Contrarreferencia'],
    [{ status: 'CANCELLED' }, 'Cancelada'],
  ] as const)('%o → %s', (extra, esperado) => {
    expect(estadoDeLaDerivacion({ ...base, ...extra }).estado).toBe(esperado);
  });
});
