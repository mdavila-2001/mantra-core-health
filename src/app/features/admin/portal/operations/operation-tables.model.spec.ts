import { operationDetail } from '../portal.fixture';
import {
  affectedTablesHeadline,
  operationKind,
  summarizeAffectedTables,
} from './operation-tables.model';

describe('operation-tables.model', () => {
  it('agrupa las filas por efecto y tabla, juntando caminos, fuentes y confianzas sin repetir', () => {
    const s = summarizeAffectedTables(operationDetail().datos);
    expect(s.groups.map((g) => g.effect)).toEqual(['LEE', 'ESCRIBE']);
    const slots = s.groups[0]!.tables[0]!;
    expect(slots.qualified).toBe('scheduling.slots');
    expect(slots.paths.length).toBe(2);
    expect(slots.sources).toEqual(['slots.repository.ts:12', 'slots.repository.ts:40']);
    // De la más firme a la más débil, no en el orden de llegada.
    expect(slots.confidences).toEqual(['DIRECTA', 'POR_SQL']);
    expect(slots.details).toEqual(['LEE']);
  });

  it('cuenta tablas distintas: una tabla leída y escrita cuenta una vez en el total', () => {
    const op = operationDetail();
    const bills = { ...op.datos[0]!, schema: 'billing', tabla: 'bills' };
    const s = summarizeAffectedTables([
      { ...bills, operacion: 'ESCRIBE', detalle: 'CREA' },
      { ...bills, operacion: 'LEE', detalle: 'LEE', fuente: 'bills.repository.ts:155' },
      { ...bills, tabla: 'vendors', operacion: 'LEE', detalle: 'LEE' },
      { ...bills, tabla: 'old_bills', operacion: 'BORRA', detalle: 'BORRA' },
    ]);
    expect(s.counts).toEqual({ distinct: 3, byEffect: { LEE: 2, ESCRIBE: 1, BORRA: 1 }, other: 0 });
    expect(affectedTablesHeadline(s.counts)).toBe('3 tablas: 2 leídas · 1 escrita · 1 borrada');
    expect(s.groups.map((g) => g.effect)).toEqual(['LEE', 'ESCRIBE', 'BORRA']);
  });

  it('un efecto desconocido no se pierde: va en su propio grupo y se cuenta aparte', () => {
    const row = { ...operationDetail().datos[0]!, operacion: 'TRUNCA' };
    const s = summarizeAffectedTables([row]);
    expect(s.groups.map((g) => g.effect)).toEqual(['TRUNCA']);
    expect(affectedTablesHeadline(s.counts)).toBe('1 tabla: 0 leídas · 0 escritas · 0 borradas · 1 con otro efecto');
  });

  it('sin filas no inventa nada', () => {
    const s = summarizeAffectedTables([]);
    expect(s.groups).toEqual([]);
    expect(affectedTablesHeadline(s.counts)).toBe('0 tablas: 0 leídas · 0 escritas · 0 borradas');
  });

  it('deriva el tipo de operación de lo que toca, no del método', () => {
    const op = operationDetail();
    expect(operationKind(op)).toBe('ESCRITURA');
    expect(operationKind({ datos: op.datos.filter((d) => d.operacion === 'LEE') })).toBe('SOLO_LECTURA');
    expect(operationKind({ datos: [{ ...op.datos[0]!, operacion: 'BORRA' }] })).toBe('DESTRUCTIVA');
    expect(operationKind({ datos: [] })).toBe('SIN_DATO');
  });
});
