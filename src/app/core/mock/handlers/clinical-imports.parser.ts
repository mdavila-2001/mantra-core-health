/* ============================================================================
    ESPEJO DE LA API (copia, no se edita a mano).

    Este archivo es la copia de `mantra-core-health-api/src/modules/clinical_import/clinical-import.parser.ts`.
    La maqueta valida y genera plantillas con el MISMO código que la API, para
    que lo que se ve en pantalla (vista previa, errores por fila, plantillas
    CSV y JSON) sea lo que dirá la API. Si cambia el esquema en la API, se
    vuelve a copiar; no se corrige acá.
    ========================================================================== */

import { messageFor } from './clinical-imports.messages';
import type { KindSpec } from './clinical-imports.schema';
import type {
  FieldIssue,
  ImportFormat,
  ParsedRow,
} from './clinical-imports.model';

/* ============================================================================
    Archivo → filas. CSV (RFC 4180, coma o punto y coma, BOM, CRLF) o JSON.

    Escrito acá y no reutilizando el lector de terminología porque aquél está
    atado a su perfil de importación y a sus mensajes, que pueden nombrar el
    valor leído; los de este módulo salen de `ISSUE_MESSAGES` y nunca lo hacen.

    El número de fila es el de DATOS, desde 1 (el encabezado no cuenta).
    ========================================================================== */

export interface ParsedFile {
  readonly format: ImportFormat;
  readonly rows: readonly ParsedRow[];
  /** Hallazgos del archivo entero: si hay alguno, no hay lote válido. */
  readonly fileIssues: readonly FieldIssue[];
}

const issue = (field: string, code: string): FieldIssue => ({
  field,
  code,
  message: messageFor(code),
});

/** Decide el formato por el nombre y, si no alcanza, por el primer carácter. */
export function detectFormat(fileName: string, text: string): ImportFormat {
  const name = fileName.toLowerCase();
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.csv')) return 'csv';
  const first = text.trimStart()[0];
  return first === '{' || first === '[' ? 'json' : 'csv';
}

function separatorOf(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const commas = firstLine.split(',').length;
  const semicolons = firstLine.split(';').length;
  return semicolons > commas ? ';' : ',';
}

function csvRecords(text: string, separator: ',' | ';'): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;
  const clean = text.replace(/^﻿/, '');
  for (let i = 0; i < clean.length; i += 1) {
    const c = clean[i] as string;
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === separator) {
      record.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i += 1;
      record.push(cell);
      cell = '';
      if (record.some((v) => v.trim() !== '')) records.push(record);
      record = [];
    } else cell += c;
  }
  record.push(cell);
  if (record.some((v) => v.trim() !== '')) records.push(record);
  return records;
}

/** Columnas que faltan, que sobran o que se repiten. Los nombres de columna no son datos. */
function headerIssues(
  spec: KindSpec,
  headers: readonly string[],
  rowCount: number,
): FieldIssue[] {
  if (rowCount === 0) return [issue('*', 'FILE_EMPTY')];
  const known = new Set(spec.columns.map((c) => c.name));
  const issues: FieldIssue[] = [];
  const seen = new Set<string>();
  for (const header of headers) {
    if (seen.has(header)) issues.push(issue('*', 'DUPLICATE_COLUMN'));
    seen.add(header);
    if (!known.has(header)) issues.push(issue('*', 'UNKNOWN_FIELD'));
  }
  for (const column of spec.columns) {
    if (column.required && !seen.has(column.name))
      issues.push(issue(column.name, 'COLUMN_MISSING'));
  }
  return issues;
}

function parseCsv(spec: KindSpec, text: string): ParsedFile {
  const records = csvRecords(text, separatorOf(text));
  const header = (records[0] ?? []).map((h) => h.trim());
  const dataRows = records.slice(1);
  const fileIssues = headerIssues(spec, header, dataRows.length);
  const rows: ParsedRow[] = dataRows.map((cells, index) => ({
    row: index + 1,
    values: Object.fromEntries(
      header.map((h, i) => [h, (cells[i] ?? '').trim()]),
    ),
    malformed: [],
  }));
  return { format: 'csv', rows: fileIssues.length > 0 ? [] : rows, fileIssues };
}

function parseJson(spec: KindSpec, text: string): ParsedFile {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return {
      format: 'json',
      rows: [],
      fileIssues: [issue('*', 'FILE_UNREADABLE')],
    };
  }
  let list: unknown = document;
  if (
    typeof document === 'object' &&
    document !== null &&
    !Array.isArray(document)
  ) {
    const object = document as Record<string, unknown>;
    if (typeof object['kind'] === 'string' && object['kind'] !== spec.kind) {
      return {
        format: 'json',
        rows: [],
        fileIssues: [issue('kind', 'KIND_MISMATCH')],
      };
    }
    list = object['rows'];
  }
  if (!Array.isArray(list)) {
    return {
      format: 'json',
      rows: [],
      fileIssues: [issue('*', 'FILE_UNREADABLE')],
    };
  }

  const known = new Set(spec.columns.map((c) => c.name));
  const fileIssues: FieldIssue[] = [];
  const headers = new Set<string>();
  const rows: ParsedRow[] = list.map((item, index) => {
    const entries =
      typeof item === 'object' && item !== null && !Array.isArray(item)
        ? Object.entries(item)
        : [];
    const values: Record<string, string> = {};
    const malformed: string[] = [];
    for (const [key, raw] of entries) {
      headers.add(key);
      if (raw === null || raw === undefined) values[key] = '';
      else if (typeof raw === 'string') values[key] = raw.trim();
      else if (typeof raw === 'number' || typeof raw === 'boolean')
        values[key] = String(raw);
      else {
        values[key] = '';
        malformed.push(key);
      }
    }
    return { row: index + 1, values, malformed };
  });
  for (const key of headers)
    if (!known.has(key)) fileIssues.push(issue('*', 'UNKNOWN_FIELD'));
  fileIssues.push(
    ...headerIssues(spec, [...headers], rows.length).filter(
      (i) => i.code !== 'UNKNOWN_FIELD',
    ),
  );
  return {
    format: 'json',
    rows: fileIssues.length > 0 ? [] : rows,
    fileIssues,
  };
}

export function parseFile(
  spec: KindSpec,
  format: ImportFormat,
  text: string,
): ParsedFile {
  return format === 'json' ? parseJson(spec, text) : parseCsv(spec, text);
}
