/* ============================================================================
    ESPEJO DE LA API (copia, no se edita a mano).

    Este archivo es la copia de `mantra-core-health-api/src/modules/clinical_import/clinical-import.validator.spec.ts`.
    La maqueta valida y genera plantillas con el MISMO código que la API, para
    que lo que se ve en pantalla (vista previa, errores por fila, plantillas
    CSV y JSON) sea lo que dirá la API. Si cambia el esquema en la API, se
    vuelve a copiar; no se corrige acá.
    ========================================================================== */

import { kindSpec } from './clinical-imports.schema';
import { buildTemplate } from './clinical-imports.template';
import { parseFile } from './clinical-imports.parser';
import {
  invalidDeclarationField,
  validateRows,
} from './clinical-imports.validator';
import type { ParsedRow } from './clinical-imports.model';

const NOW = new Date('2026-10-30T12:00:00Z');

function rowOf(
  kind: string,
  changes: Record<string, string> = {},
  row = 1,
): ParsedRow {
  const spec = kindSpec(kind)!;
  const base = parseFile(spec, 'csv', buildTemplate(kind, 'csv')!.content)
    .rows[0]!;
  return { row, values: { ...base.values, ...changes }, malformed: [] };
}

const issuesOf = (kind: string, changes: Record<string, string>) =>
  validateRows(kindSpec(kind)!, [rowOf(kind, changes)], NOW).issues;

describe('validación por fila: válido, límite e inválido', () => {
  it('válido: la fila de la plantilla no trae hallazgos', () => {
    for (const kind of [
      'hc-encuentro',
      'hc-diagnostico',
      'hc-medicacion',
      'hc-alergia',
      'hc-signo-vital',
      'hc-resultado',
      'hc-nota',
    ]) {
      expect(issuesOf(kind, {})).toEqual([]);
    }
  });

  it.each([
    ['documento de 4 caracteres (mínimo)', 'ABCD', null],
    ['documento de 3 caracteres', 'ABC', 'INVALID_FORMAT'],
    ['documento de 40 caracteres (máximo)', 'A'.repeat(40), null],
    ['documento de 41 caracteres', 'A'.repeat(41), 'TOO_LONG'],
    ['documento con espacios', 'AB CD', 'INVALID_FORMAT'],
    ['documento vacío', '', 'REQUIRED'],
  ])('documentNumber · %s', (_caso, valor, esperado) => {
    const found = issuesOf('hc-alergia', { documentNumber: valor }).find(
      (i) => i.field === 'documentNumber',
    );
    expect(found?.code ?? null).toBe(esperado);
  });

  it.each([
    ['fecha real', '2000-02-29', null],
    ['29 de febrero inexistente', '2001-02-29', 'INVALID_FORMAT'],
    ['formato distinto', '15/01/1990', 'INVALID_FORMAT'],
    ['hoy', '2026-10-30', null],
    ['mañana (dentro de la tolerancia de un día)', '2026-10-31', null],
    ['futuro', '2026-12-01', 'OUT_OF_RANGE'],
  ])('birthDate · %s', (_caso, valor, esperado) => {
    const found = issuesOf('hc-alergia', { birthDate: valor }).find(
      (i) => i.field === 'birthDate',
    );
    expect(found?.code ?? null).toBe(esperado);
  });

  it.each([
    ['120 caracteres', 'R'.repeat(120), null],
    ['121 caracteres', 'R'.repeat(121), 'TOO_LONG'],
  ])('sourceRecordId · %s', (_caso, valor, esperado) => {
    const found = issuesOf('hc-alergia', { sourceRecordId: valor }).find(
      (i) => i.field === 'sourceRecordId',
    );
    expect(found?.code ?? null).toBe(esperado);
  });

  it.each([
    ['texto de 2.000', 'x'.repeat(2000), null],
    ['texto de 2.001', 'x'.repeat(2001), 'TOO_LONG'],
  ])('reasonText · %s', (_caso, valor, esperado) => {
    const found = issuesOf('hc-encuentro', { reasonText: valor }).find(
      (i) => i.field === 'reasonText',
    );
    expect(found?.code ?? null).toBe(esperado);
  });

  it.each([
    ['con punto', '36.5', null],
    ['entero negativo', '-4', null],
    ['con coma', '36,5', 'INVALID_FORMAT'],
    ['notación científica', '1e3', 'INVALID_FORMAT'],
    ['siete decimales', '1.1234567', 'INVALID_FORMAT'],
    ['vacío (obligatorio)', '', 'REQUIRED'],
  ])('value de signo vital · %s', (_caso, valor, esperado) => {
    const found = issuesOf('hc-signo-vital', { value: valor }).find(
      (i) => i.field === 'value',
    );
    expect(found?.code ?? null).toBe(esperado);
  });

  it.each([
    ['con Z', '2026-01-15T09:00:00Z', null],
    ['con desfase', '2026-01-15T09:00:00-04:00', null],
    ['sin zona horaria', '2026-01-15T09:00:00', 'INVALID_FORMAT'],
    ['solo fecha', '2026-01-15', 'INVALID_FORMAT'],
    ['futuro', '2027-01-15T09:00:00Z', 'OUT_OF_RANGE'],
  ])('startAt · %s', (_caso, valor, esperado) => {
    const found = issuesOf('hc-encuentro', { startAt: valor }).find(
      (i) => i.field === 'startAt',
    );
    expect(found?.code ?? null).toBe(esperado);
  });

  it('onsetAt admite fecha o fecha con hora', () => {
    expect(issuesOf('hc-diagnostico', { onsetAt: '2025-06-01' })).toEqual([]);
    expect(
      issuesOf('hc-diagnostico', {
        onsetAt: '2025-06-01T08:00:00Z',
        resolvedAt: '2025-06-02',
      }),
    ).toEqual([]);
  });

  it('reglas entre columnas: fin antes del inicio, resolución antes del inicio, rango invertido', () => {
    expect(
      issuesOf('hc-encuentro', { endAt: '2026-01-15T08:00:00Z' })[0],
    ).toMatchObject({ field: 'endAt', code: 'FIELD_COMBINATION_INVALID' });
    expect(
      issuesOf('hc-diagnostico', { resolvedAt: '2025-05-01' })[0],
    ).toMatchObject({ field: 'resolvedAt' });
    expect(
      issuesOf('hc-resultado', { rangeLow: '6.0', rangeHigh: '3.5' })[0],
    ).toMatchObject({ field: 'rangeHigh' });
  });

  it('resultado sin valor y nota sin texto se rechazan', () => {
    expect(
      issuesOf('hc-resultado', { valueDecimal: '', valueText: '' })[0]?.code,
    ).toBe('FIELD_COMBINATION_INVALID');
    expect(
      issuesOf('hc-nota', {
        chiefComplaintText: '',
        subjectiveText: '',
        objectiveText: '',
        assessmentText: '',
        planText: '',
      })[0]?.code,
    ).toBe('FIELD_COMBINATION_INVALID');
  });

  it('un concepto opcional va entero o no va', () => {
    expect(
      issuesOf('hc-encuentro', { classSystem: '', classCode: '' }),
    ).toEqual([]);
    expect(
      issuesOf('hc-encuentro', { classSystem: '', classCode: 'SINT-0001' })[0],
    ).toMatchObject({
      field: 'classSystem',
      code: 'FIELD_COMBINATION_INVALID',
    });
    expect(
      issuesOf('hc-encuentro', {
        classSystem: 'sistema-demo',
        classCode: '',
      })[0],
    ).toMatchObject({ field: 'classCode' });
  });

  it('un concepto obligatorio incompleto es REQUIRED', () => {
    expect(issuesOf('hc-diagnostico', { conditionCode: '' })[0]).toMatchObject({
      field: 'conditionCode',
      code: 'REQUIRED',
    });
  });

  it('la misma sourceRecordId dos veces en el archivo: la segunda se rechaza', () => {
    const spec = kindSpec('hc-alergia')!;
    const result = validateRows(
      spec,
      [rowOf('hc-alergia', {}, 1), rowOf('hc-alergia', {}, 2)],
      NOW,
    );
    expect(result.valid.map((r) => r.row)).toEqual([1]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        row: 2,
        field: 'sourceRecordId',
        code: 'DUPLICATE_IN_FILE',
      }),
    ]);
  });

  it('NINGÚN hallazgo repite el valor recibido', () => {
    const secreto = 'VALOR-SENSIBLE-98765';
    const spec = kindSpec('hc-diagnostico')!;
    const filas = [
      rowOf('hc-diagnostico', {
        documentNumber: `${secreto} x`,
        birthDate: secreto,
        onsetAt: secreto,
        noteText: secreto.repeat(200),
        conditionSystem: secreto,
        conditionCode: '',
      }),
    ];
    const salida = JSON.stringify(validateRows(spec, filas, NOW).issues);
    expect(salida).not.toContain(secreto);
    expect(salida).not.toContain('98765');
  });
});

describe('declaración del lote', () => {
  const valida = {
    sourceOrganization: 'Organización sintética',
    legalBasis: 'Convenio de ejemplo',
    loadedAt: '2026-10-30',
  };

  it('completa: sin objeción', () => {
    expect(invalidDeclarationField(valida, NOW)).toBeNull();
  });

  it.each([
    ['sin origen', { sourceOrganization: '' }, 'sourceOrganization'],
    [
      'origen de 201',
      { sourceOrganization: 'o'.repeat(201) },
      'sourceOrganization',
    ],
    ['origen de 200', { sourceOrganization: 'o'.repeat(200) }, null],
    ['base legal de 2', { legalBasis: 'ab' }, 'legalBasis'],
    ['base legal de 3', { legalBasis: 'abc' }, null],
    ['base legal de 501', { legalBasis: 'b'.repeat(501) }, 'legalBasis'],
    ['sin fecha', { loadedAt: undefined }, 'loadedAt'],
    ['fecha inexistente', { loadedAt: '2026-02-30' }, 'loadedAt'],
    ['fecha futura', { loadedAt: '2026-10-31' }, 'loadedAt'],
  ])('%s', (_caso, cambio, esperado) => {
    expect(invalidDeclarationField({ ...valida, ...cambio }, NOW)).toBe(
      esperado,
    );
  });
});
