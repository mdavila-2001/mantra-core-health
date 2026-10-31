/* ============================================================================
    ESPEJO DE LA API (copia, no se edita a mano).

    Este archivo es la copia de `mantra-core-health-api/src/modules/clinical_import/clinical-import.schema.spec.ts`.
    La maqueta valida y genera plantillas con el MISMO código que la API, para
    que lo que se ve en pantalla (vista previa, errores por fila, plantillas
    CSV y JSON) sea lo que dirá la API. Si cambia el esquema en la API, se
    vuelve a copiar; no se corrige acá.
    ========================================================================== */

import { parseFile, detectFormat } from './clinical-imports.parser';
import { KIND_SPECS, kindSpec } from './clinical-imports.schema';
import { buildTemplate } from './clinical-imports.template';
import { validateRows } from './clinical-imports.validator';

/* T1: la plantilla sale del mismo esquema que valida. Todo dato es sintético. */

const NOW = new Date('2026-10-30T12:00:00Z');
const TRACED = /^(clinical|chart|profiles|common)\./;

describe('esquema de la carga de historias clínicas', () => {
  it('declara los siete tipos de registro pedidos', () => {
    expect(KIND_SPECS.map((k) => k.kind)).toEqual([
      'hc-encuentro',
      'hc-diagnostico',
      'hc-medicacion',
      'hc-alergia',
      'hc-signo-vital',
      'hc-resultado',
      'hc-nota',
    ]);
  });

  it.each(KIND_SPECS.map((k) => [k.kind]))(
    '%s: cada columna de contenido traza a una entidad real',
    (kind) => {
      const spec = kindSpec(kind)!;
      for (const column of spec.columns) {
        expect(column.source.length).toBeGreaterThan(0);
        if (
          !['documentNumber', 'birthDate', 'sourceRecordId'].includes(
            column.name,
          )
        ) {
          expect(column.source).toMatch(TRACED);
        }
      }
      expect(spec.target).toMatch(TRACED);
    },
  );

  it.each(KIND_SPECS.map((k) => [k.kind]))(
    '%s: ningún código clínico está escrito en el esquema',
    (kind) => {
      const spec = kindSpec(kind)!;
      // Los conceptos viajan como par sistema/código y los ejemplos son marcadores sintéticos.
      for (const column of spec.columns.filter(
        (c) => c.concept !== undefined,
      )) {
        expect(['sistema-demo', 'SINT-0001']).toContain(column.example);
      }
    },
  );
});

describe.each(KIND_SPECS.map((k) => [k.kind]))('plantillas de %s', (kind) => {
  const spec = kindSpec(kind)!;

  it('CSV: el encabezado es el de las columnas y la fila de ejemplo PASA la validación', () => {
    const file = buildTemplate(kind, 'csv')!;
    expect(file.fileName).toBe(`plantilla-${kind}-v1.csv`);
    const lines = file.content.trim().split('\n');
    expect(lines[0]!.split(',')).toEqual(spec.columns.map((c) => c.name));
    const parsed = parseFile(spec, 'csv', file.content);
    expect(parsed.fileIssues).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(validateRows(spec, parsed.rows, NOW).issues).toEqual([]);
  });

  it('JSON: trae esquema, ejemplo y reglas; y como archivo también PASA la validación', () => {
    const file = buildTemplate(kind, 'json')!;
    expect(file.contentType).toContain('application/json');
    const document = JSON.parse(file.content) as {
      kind: string;
      columns: { name: string; required: boolean; source: string }[];
      rows: unknown[];
      rules: string[];
    };
    expect(document.kind).toBe(kind);
    expect(document.columns.map((c) => c.name)).toEqual(
      spec.columns.map((c) => c.name),
    );
    expect(document.columns.every((c) => c.source.length > 0)).toBe(true);
    expect(document.rules.length).toBeGreaterThan(0);
    const parsed = parseFile(spec, 'json', file.content);
    expect(parsed.fileIssues).toEqual([]);
    expect(validateRows(spec, parsed.rows, NOW).issues).toEqual([]);
  });

  it('el CSV y el JSON de la plantilla traen el MISMO ejemplo', () => {
    const csv = parseFile(spec, 'csv', buildTemplate(kind, 'csv')!.content)
      .rows[0]!.values;
    const json = parseFile(spec, 'json', buildTemplate(kind, 'json')!.content)
      .rows[0]!.values;
    expect(json).toEqual(csv);
  });

  it('una columna fuera de la plantilla se rechaza (CSV y JSON), sin nombrarla', () => {
    const csv = buildTemplate(kind, 'csv')!
      .content.replace('\n', ',columnaAjena\n')
      .replace(/\n$/, ',x\n');
    const a = parseFile(spec, 'csv', csv);
    expect(a.fileIssues.map((i) => i.code)).toContain('UNKNOWN_FIELD');
    expect(JSON.stringify(a.fileIssues)).not.toContain('columnaAjena');
    const doc = JSON.parse(buildTemplate(kind, 'json')!.content) as {
      rows: Record<string, string>[];
    };
    doc.rows[0]!['columnaAjena'] = 'x';
    const b = parseFile(spec, 'json', JSON.stringify(doc));
    expect(b.fileIssues.map((i) => i.code)).toContain('UNKNOWN_FIELD');
  });

  it('falta una columna obligatoria: se rechaza el archivo entero', () => {
    const csv = buildTemplate(kind, 'csv')!.content.replace(
      'documentNumber',
      'otraCosa',
    );
    const parsed = parseFile(spec, 'csv', csv);
    expect(parsed.fileIssues.map((i) => i.code)).toContain('COLUMN_MISSING');
    expect(parsed.rows).toEqual([]);
  });
});

describe('lectura de archivos', () => {
  const spec = kindSpec('hc-alergia')!;

  it('detecta el formato por nombre y por contenido', () => {
    expect(detectFormat('a.JSON', 'x')).toBe('json');
    expect(detectFormat('a.csv', '[')).toBe('csv');
    expect(detectFormat('sin-extension', ' [{}]')).toBe('json');
    expect(detectFormat('sin-extension', 'a,b')).toBe('csv');
  });

  it('acepta BOM, CRLF, punto y coma y comillas', () => {
    const header = spec.columns.map((c) => c.name).join(';');
    const row = spec.columns
      .map((c) => (c.name === 'documentNumber' ? '"SINT-0001"' : c.example))
      .join(';');
    const parsed = parseFile(spec, 'csv', `﻿${header}\r\n${row}\r\n`);
    expect(parsed.fileIssues).toEqual([]);
    expect(parsed.rows[0]!.values['documentNumber']).toBe('SINT-0001');
  });

  it('archivo vacío, JSON roto y JSON de otro tipo: motivos propios', () => {
    expect(parseFile(spec, 'csv', '').fileIssues[0]!.code).toBe('FILE_EMPTY');
    expect(parseFile(spec, 'json', '{rota').fileIssues[0]!.code).toBe(
      'FILE_UNREADABLE',
    );
    expect(
      parseFile(spec, 'json', JSON.stringify({ kind: 'hc-nota', rows: [] }))
        .fileIssues[0]!.code,
    ).toBe('KIND_MISMATCH');
    expect(parseFile(spec, 'json', '[]').fileIssues[0]!.code).toBe(
      'FILE_EMPTY',
    );
  });

  it('un valor anidado en JSON se marca como malformado, sin leerlo', () => {
    const doc = JSON.parse(buildTemplate('hc-alergia', 'json')!.content) as {
      rows: Record<string, unknown>[];
    };
    doc.rows[0]!['substanceCode'] = { a: 1 };
    const parsed = parseFile(spec, 'json', JSON.stringify(doc));
    const result = validateRows(spec, parsed.rows, NOW);
    expect(result.issues.find((i) => i.field === 'substanceCode')?.code).toBe(
      'INVALID_FORMAT',
    );
  });
});
