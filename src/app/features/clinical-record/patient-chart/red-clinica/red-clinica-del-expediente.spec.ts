import { describe, expect, it } from 'vitest';

import { construirRed } from '../recorrido-clinico/red-clinica.adaptador';
import { type FilaPresentada, type Rotulador } from '../recorrido-clinico/red-clinica.fuente';
import type { MotivoDelVinculo, RegistroDeLaRed, VinculoDeLaRed } from '../recorrido-clinico/red-clinica.model';
import { aplicarFiltro, FILTRO_VACIO, hiloDeDiagnostico } from './red-clinica-filtro';
import { aristasDeLaRed, nodosDeLaRed, VINCULO_DEL_MOTIVO, visiblesCombinados } from './red-clinica-del-expediente';
import { LECTURA_DE_VINCULO, TIPOS_DE_VINCULO, type DetalleDeNodo, type NodoDeRed } from './red-clinica.types';

/**
 * El puente entre la red por episodios y el panel: ids reales, el sentido de
 * cada flecha según la tabla de la Franja 3, el análisis de cada tipo sacado
 * de la lectura que lo trajo y nada que la lectura no traiga.
 */

const dia = (d: number) => new Date(2026, 0, d, 9);
const rotular: Rotulador = (id) =>
  id === 'pri-rutina'
    ? { display: 'Rutina', code: 'PRI-ROUTINE' }
    : id === undefined
      ? {}
      : { display: id };

const FILAS: readonly FilaPresentada[] = [
  { id: 'enc-1', tipo: 'encuentros', titulo: 'Ambulatorio', detalle: 'Cansancio', estado: 'Cerrado', cuando: dia(1) },
  { id: 'dx-anemia', tipo: 'diagnosticos', titulo: 'Anemia ferropénica', detalle: '', estado: 'Rechazado', cuando: dia(1), certeza: 'descartado', concepto: 'D50' },
  { id: 'dx-hipo', tipo: 'diagnosticos', titulo: 'Hipotiroidismo', detalle: '', estado: 'Confirmado', cuando: dia(1), certeza: 'confirmado', concepto: 'E03' },
  { id: 'rx-25', tipo: 'medicacion', titulo: 'Levotiroxina 25 mcg', detalle: '', estado: 'Completada', cuando: dia(5) },
  { id: 'rx-50', tipo: 'medicacion', titulo: 'Levotiroxina 50 mcg', detalle: '', estado: 'Emitida', cuando: dia(20) },
  { id: 'obs-1', tipo: 'observaciones', titulo: 'Frecuencia cardíaca', detalle: '', estado: 'Final', cuando: dia(1) },
];

function armar() {
  const fuente = {
    encounters: [{ id: 'enc-1' }],
    conditions: [
      { id: 'dx-anemia', encounterId: 'enc-1', replacedByConditionId: 'dx-hipo' },
      {
        id: 'dx-hipo',
        encounterId: 'enc-1',
        verification: { basedOn: { kind: 'ANALYSIS' as const, diagnosticReportId: 'inf-tsh' } },
      },
    ],
    medicationRequests: [
      { id: 'rx-25', encounterId: 'enc-1', indicationConditionId: 'dx-hipo', replacedByRequestId: 'rx-50' },
      { id: 'rx-50', indicationConditionId: 'dx-hipo' },
    ],
    observations: [{ id: 'obs-1', encounterId: 'enc-1' }],
    notes: [],
    carePlans: [],
    citas: [
      { id: 'bk-1', startAt: dia(1), createdAt: dia(1), statusConceptId: 'BK', reasonText: 'Cansancio' },
      { id: 'bk-2', startAt: dia(20), createdAt: dia(15), statusConceptId: 'BK', reasonText: 'Control', followUpOf: { bookingId: 'bk-1', encounterId: 'enc-1' } },
    ],
    derivaciones: [
      {
        id: 'ref-1',
        createdAt: dia(2),
        status: 'COMPLETED' as const,
        sourceEncounterId: 'enc-1',
        targetEncounterId: 'enc-1',
        targetDisplayName: 'Endocrinología',
        reasonText: 'Ajuste de dosis',
        counterReferralAt: dia(30),
        transfer: { arrivedAt: dia(10) },
      },
    ],
    estudios: {
      orders: [
        { id: 'ord-tsh', encounterId: 'enc-1', codeConceptId: 'TSH', statusConceptId: 'Completada', createdAt: dia(1), reasonConditionId: 'dx-hipo' },
        { id: 'ord-hemo', encounterId: 'enc-1', codeConceptId: 'Hemograma', statusConceptId: 'Pedida', createdAt: dia(1), reasonConditionId: 'dx-anemia' },
      ],
      reports: [
        { id: 'inf-tsh', serviceRequestId: 'ord-tsh', encounterId: 'enc-1', codeConceptId: 'TSH', lifecycleStatusConceptId: 'Final', createdAt: dia(3) },
      ],
    },
  };
  const red = construirRed(FILAS, fuente, rotular);
  const detalle = {
    diagnosticos: [
      { id: 'dx-anemia', noteText: 'Palidez leve', replacedByConditionId: 'dx-hipo' },
      {
        id: 'dx-hipo',
        onsetAt: dia(1),
        verification: {
          outcome: 'CONFIRMED' as const,
          decidedAt: dia(4).toISOString(),
          decidedByProfileId: 'pro-1',
          reasonText: 'TSH elevada',
          basedOn: { kind: 'ANALYSIS' as const, diagnosticReportId: 'inf-tsh' },
        },
      },
    ],
    citas: fuente.citas,
    derivaciones: [
      {
        ...fuente.derivaciones[0],
        referralType: 'CONSULTATION' as const,
        respondedAt: dia(3),
        counterReferralText: 'Seguir con 50 mcg',
        transfer: { arrivedAt: dia(10), arrivalNotes: 'Llegó acompañada' },
      },
    ],
    estudios: {
      orders: [
        { id: 'ord-tsh', category: 'LAB' as const, priorityConceptId: 'pri-rutina' },
        { id: 'ord-hemo', category: 'LAB' as const },
      ],
      reports: [{ id: 'inf-tsh', serviceRequestId: 'ord-tsh', currentReleasedVersionId: 'v-1' }],
    },
    bloques: new Map([['obs-1', { resumen: '104 latidos por minuto', datos: [{ rotulo: 'Encuentro', valor: 'Ambulatorio' }] }]]),
  };
  return { red, ...nodosDeLaRed(red.registros, red.vinculos, detalle, rotular) };
}

const de = (nodos: readonly NodoDeRed[], id: string): NodoDeRed => nodos.find((n) => n.id === id)!;
const detalle = <T extends DetalleDeNodo['tipo']>(n: NodoDeRed, tipo: T) => {
  expect(n.detalle?.tipo).toBe(tipo);
  return n.detalle as Extract<DetalleDeNodo, { tipo: T }>;
};

describe('aristasDeLaRed', () => {
  it('cada motivo de la red tiene su vínculo del panel, y todos existen en la tabla', () => {
    for (const t of Object.values(VINCULO_DEL_MOTIVO)) {
      expect(TIPOS_DE_VINCULO).toContain(t.tipo);
      expect(LECTURA_DE_VINCULO[t.tipo]).toBeDefined();
    }
  });

  it('da vuelta la flecha donde la red guarda el otro sentido', () => {
    const v = (motivo: MotivoDelVinculo): VinculoDeLaRed => ({ desde: 'A', hasta: 'B', motivo });
    expect(aristasDeLaRed([v('registrado-en')])).toEqual([{ desde: 'B', hasta: 'A', tipo: 'registrado-en' }]);
    expect(aristasDeLaRed([v('indicado-para')])).toEqual([{ desde: 'B', hasta: 'A', tipo: 'indicado-para' }]);
    expect(aristasDeLaRed([v('pedido-para')])).toEqual([{ desde: 'B', hasta: 'A', tipo: 'pedido-para' }]);
    expect(aristasDeLaRed([v('resultado-de')])).toEqual([{ desde: 'B', hasta: 'A', tipo: 'resultado-de' }]);
    expect(aristasDeLaRed([v('reconsulta-de')])).toEqual([{ desde: 'B', hasta: 'A', tipo: 'reconsulta-de' }]);
    expect(aristasDeLaRed([v('derivado-desde')])).toEqual([{ desde: 'B', hasta: 'A', tipo: 'derivada-desde' }]);
    // Las que ya van en el sentido de la tabla.
    expect(aristasDeLaRed([v('reemplazado-por')])).toEqual([{ desde: 'A', hasta: 'B', tipo: 'reemplazado-por' }]);
    expect(aristasDeLaRed([v('receta-reemplazada')])).toEqual([{ desde: 'A', hasta: 'B', tipo: 'reemplaza-receta' }]);
    expect(aristasDeLaRed([v('evidencia')])).toEqual([{ desde: 'A', hasta: 'B', tipo: 'evidencia-de' }]);
    expect(aristasDeLaRed([v('recibido-en')])).toEqual([{ desde: 'A', hasta: 'B', tipo: 'recibida-en' }]);
  });

  it('un vínculo deducido sigue siendo inferido', () => {
    expect(aristasDeLaRed([{ desde: 'dx', hasta: 'est', motivo: 'inferido-misma-atencion' }])).toEqual([
      { desde: 'est', hasta: 'dx', tipo: 'pedido-para', inferido: true },
    ]);
    expect(aristasDeLaRed([{ desde: 'cita', hasta: 'enc', motivo: 'inferido-mismo-dia' }])).toEqual([
      { desde: 'cita', hasta: 'enc', tipo: 'atendida-en', inferido: true },
    ]);
  });

  it('no repite un vínculo que la red trae dos veces', () => {
    const v: VinculoDeLaRed = { desde: 'A', hasta: 'B', motivo: 'registrado-en' };
    expect(aristasDeLaRed([v, v])).toHaveLength(1);
  });
});

describe('nodosDeLaRed', () => {
  it('un nodo por registro de la red, con su id real y en el mismo orden', () => {
    const { red, nodos } = armar();
    expect(nodos.map((n) => n.id)).toEqual(red.registros.map((r: RegistroDeLaRed) => r.id));
  });

  it('el reemplazo de una receta llega como «reemplaza-receta», de la vieja a la nueva', () => {
    const { aristas } = armar();
    expect(aristas).toContainEqual({ desde: 'rx-25', hasta: 'rx-50', tipo: 'reemplaza-receta' });
  });

  it('el diagnóstico descartado lleva su nota y el enlace al que lo reemplazó', () => {
    const { nodos } = armar();
    const d = detalle(de(nodos, 'dx-anemia'), 'diagnostico');
    expect(d.certeza).toBe('descartado');
    expect(d.nota).toBe('Palidez leve');
    expect(d.reemplazadoPor).toEqual({ nodoId: 'dx-hipo', etiqueta: 'Hipotiroidismo' });
  });

  it('el confirmado lleva la decisión con su evidencia navegable, sin inventar quién decidió', () => {
    const { nodos } = armar();
    const d = detalle(de(nodos, 'dx-hipo'), 'diagnostico');
    expect(d.decision?.resultado).toBe('confirmado');
    expect(d.decision?.motivo).toBe('TSH elevada');
    expect(d.decision?.decididoPor).toBeNull();
    expect(d.decision?.evidencia).toEqual({ tipo: 'analisis', etiqueta: 'TSH', nodoId: 'inf-tsh' });
  });

  it('el estudio dice categoría, prioridad y que hay resultado liberado, sin fecha ni valores inventados', () => {
    const { nodos } = armar();
    const d = detalle(de(nodos, 'ord-tsh'), 'estudio');
    expect(d.categoria).toBe('Laboratorio');
    expect(d.prioridad).toBe('Rutina');
    // Sin valores ni fecha: los lee el panel al abrirlo, con el id del informe liberado.
    expect(d.resultado).toEqual({ liberadoEn: null, valores: [], archivos: [], informeId: 'inf-tsh' });
    // El informe es un estudio para el panel, con el mismo análisis.
    expect(de(nodos, 'inf-tsh').tipo).toBe('estudio');
    expect(detalle(de(nodos, 'inf-tsh'), 'estudio').resultado?.informeId).toBe('inf-tsh');
  });

  it('un estudio sin informe liberado queda pendiente', () => {
    const { nodos } = armar();
    expect(detalle(de(nodos, 'ord-hemo'), 'estudio').resultado).toBeNull();
  });

  it('la reconsulta es reconsulta, con su motivo', () => {
    const { nodos, aristas } = armar();
    expect(de(nodos, 'bk-2').tipo).toBe('reconsulta');
    expect(de(nodos, 'bk-2').detalle).toEqual({ tipo: 'reconsulta', motivo: 'Control' });
    expect(de(nodos, 'bk-1').tipo).toBe('cita');
    expect(aristas).toContainEqual({ desde: 'bk-2', hasta: 'bk-1', tipo: 'reconsulta-de' });
  });

  it('la derivación cuenta respuesta, llegada con su atención y contrarreferencia', () => {
    const { nodos } = armar();
    const d = detalle(de(nodos, 'ref-1'), 'derivacion');
    expect(d.tipoDeDerivacion).toBe('Interconsulta');
    expect(d.destino).toBe('Endocrinología');
    expect(d.respuesta).toEqual({ decision: 'aceptada', en: dia(3), motivoDeRechazo: null });
    expect(d.llegada).toEqual({ en: dia(10), atencionNodoId: 'enc-1', notas: 'Llegó acompañada' });
    expect(d.contrarreferencia).toEqual({ texto: 'Seguir con 50 mcg', en: dia(30) });
  });

  it('el resto toma el resumen y los pares que ya muestra el expediente', () => {
    const { nodos } = armar();
    expect(de(nodos, 'obs-1').detalle).toEqual({
      tipo: 'general',
      resumen: '104 latidos por minuto',
      datos: [{ rotulo: 'Encuentro', valor: 'Ambulatorio' }],
    });
  });

  it('no afirma un profesional que la lectura no trae', () => {
    const { nodos } = armar();
    expect(nodos.every((n) => n.profesional === undefined && n.especialidad === undefined)).toBe(true);
  });

  it('sin las lecturas aparte, los nodos quedan con cabecera y vínculos', () => {
    const { red } = armar();
    const { nodos } = nodosDeLaRed(red.registros, red.vinculos, {}, rotular);
    expect(de(nodos, 'ref-1').detalle).toBeUndefined();
    expect(detalle(de(nodos, 'ord-tsh'), 'estudio').resultado).toBeNull();
  });

  it('el hilo de Hipotiroidismo trae su descartado, sus estudios y sus recetas, y no la observación suelta', () => {
    const { nodos, aristas } = armar();
    const hilo = hiloDeDiagnostico('dx-hipo', nodos, aristas);
    expect([...hilo]).toEqual(expect.arrayContaining(['dx-hipo', 'dx-anemia', 'ord-tsh', 'inf-tsh', 'rx-25', 'rx-50', 'enc-1']));
    expect(hilo.has('obs-1')).toBe(false);
    const visibles = aplicarFiltro(nodos, { ...FILTRO_VACIO, hiloDeDiagnosticoId: 'dx-hipo' }, aristas);
    expect(visibles.map((n) => n.id)).not.toContain('obs-1');
  });
});

describe('visiblesCombinados', () => {
  it('sin filtros, null: la red dibuja todo', () => {
    expect(visiblesCombinados([], null)).toBeNull();
  });

  it('con uno solo, ése', () => {
    expect(visiblesCombinados(['a', 'b'], null)).toEqual(['a', 'b']);
    expect(visiblesCombinados([], ['b'])).toEqual(['b']);
  });

  it('con los dos, la intersección, y vacía si no queda nada', () => {
    expect(visiblesCombinados(['a', 'b'], ['b', 'c'])).toEqual(['b']);
    expect(visiblesCombinados(['a'], ['c'])).toEqual([]);
    expect(visiblesCombinados([], [])).toEqual([]);
  });
});
