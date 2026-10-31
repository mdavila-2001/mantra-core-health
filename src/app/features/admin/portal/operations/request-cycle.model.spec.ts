import { operationDetail, tree } from '../portal.fixture';
import {
  CYCLE_PHASES,
  CYCLE_STAGES,
  assessCycle,
  countApplicability,
  type AssessedStage,
} from './request-cycle.model';

function stage(phases: ReturnType<typeof assessCycle>, number: number): AssessedStage {
  return phases.flatMap((p) => p.stages).find((s) => s.number === number)!;
}

describe('request-cycle.model', () => {
  it('tiene las 21 etapas verificadas, cada una con archivo:línea y en una fase que existe', () => {
    expect(CYCLE_STAGES.length).toBe(21);
    expect(CYCLE_STAGES.map((s) => s.number)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    const phases = new Set(CYCLE_PHASES.map((p) => p.id));
    for (const s of CYCLE_STAGES) {
      expect(phases.has(s.phase)).toBe(true);
      expect(s.source.length).toBeGreaterThan(0);
    }
  });

  it('para una operación con sesión y roles: aplican JWT, tenant, roles y tasa con el texto del requerimiento', () => {
    const phases = assessCycle(operationDetail(), tree());
    expect(stage(phases, 7)).toMatchObject({ applicability: 'APLICA', reason: 'JWT Bearer' });
    expect(stage(phases, 8).applicability).toBe('APLICA');
    expect(stage(phases, 9)).toMatchObject({ applicability: 'APLICA', reason: 'Alguno de: SCHEDULING_ADMIN, PRACTITIONER.' });
    expect(stage(phases, 6).reason).toContain('300 solicitudes');
    expect(stage(phases, 10).applicability).toBe('NO_APLICA');
    expect(stage(phases, 11).applicability).toBe('NO_APLICA');
    // Sin cuerpo pero con un parámetro: el pipe sí valida.
    expect(stage(phases, 3).applicability).toBe('NO_APLICA');
    expect(stage(phases, 15)).toMatchObject({ applicability: 'APLICA', reason: 'Valida 1 parámetro.' });
  });

  it('lo que el inventario no registra se dice no determinable, nunca se supone', () => {
    const phases = assessCycle(operationDetail(), tree());
    for (const n of [2, 12, 13]) {
      expect(stage(phases, n).applicability).toBe('NO_DETERMINABLE');
      expect(stage(phases, n).reason).toContain('No determinable desde el inventario');
    }
    // El árbol de la fixture no trae TRANSACCION: tampoco se afirma que no haya.
    expect(stage(phases, 17).applicability).toBe('NO_DETERMINABLE');
    expect(assessCycle(operationDetail(), null).flatMap((p) => p.stages).find((s) => s.number === 17)?.reason).toContain(
      'no está disponible',
    );
  });

  it('con un nodo TRANSACCION en el árbol la etapa de transacción aplica', () => {
    const conTx = { ...tree(), nodos: [{ tipo: 'TRANSACCION', txt: 'Todo o nada', hijos: [{ tipo: 'EFECTO', tabla: 'scheduling.slots' }] }] };
    expect(stage(assessCycle(operationDetail(), conTx), 17)).toMatchObject({
      applicability: 'APLICA',
      reason: 'El árbol trae 1 nodo TRANSACCION.',
    });
  });

  it('una ruta pública no pasa por JWT, tenant, roles ni bitácora, y sí por la caché pública', () => {
    const publica = operationDetail({
      publica: true,
      roles: [],
      requerimientos: [{ tipo: 'AUTENTICACION', detalle: 'Ruta pública: no exige token', fuente: 'c.ts:1' }],
    });
    const phases = assessCycle(publica, null);
    expect(stage(phases, 7)).toMatchObject({ applicability: 'NO_APLICA', reason: 'Ruta pública: no exige token' });
    expect(stage(phases, 8).applicability).toBe('NO_APLICA');
    expect(stage(phases, 9).applicability).toBe('NO_APLICA');
    expect(stage(phases, 11).applicability).toBe('APLICA');
    expect(stage(phases, 13).applicability).toBe('NO_APLICA');
    expect(stage(phases, 6).applicability).toBe('NO_DETERMINABLE');
  });

  it('persistencia, outbox y relay salen de datos, eventos y trabajos; sin tablas con motivo es «no aplica»', () => {
    const op = operationDetail();
    const phases = assessCycle(op, null);
    expect(stage(phases, 18).reason).toBe('2 tablas (1 acceso de escritura o borrado).');
    expect(stage(phases, 19)).toMatchObject({ applicability: 'APLICA', reason: 'Emite: scheduling.slots.viewed.' });
    expect(stage(phases, 20).reason).toBe('1 evento.');

    const redis = assessCycle(operationDetail({ datos: [], eventos: [], trabajos: ['cola.x'], sinTablas: 'Usa Redis' }), null);
    expect(stage(redis, 18)).toMatchObject({ applicability: 'NO_APLICA', reason: 'No toca tablas: Usa Redis' });
    expect(stage(redis, 19).applicability).toBe('NO_APLICA');
    expect(stage(redis, 20).reason).toBe('1 trabajo: cola.x.');

    const nada = assessCycle(operationDetail({ datos: [], sinTablas: null }), null);
    expect(stage(nada, 18).applicability).toBe('NO_DETERMINABLE');
  });

  it('cuenta los veredictos para la cabecera', () => {
    const counts = countApplicability(assessCycle(operationDetail(), tree()));
    expect(counts.APLICA + counts.NO_APLICA + counts.NO_DETERMINABLE).toBe(21);
    expect(counts.NO_DETERMINABLE).toBe(4);
  });
});
