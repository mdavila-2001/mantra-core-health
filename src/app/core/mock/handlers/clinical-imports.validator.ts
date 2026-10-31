/* ============================================================================
    ESPEJO DE LA API (copia, no se edita a mano).

    Este archivo es la copia de `mantra-core-health-api/src/modules/clinical_import/clinical-import.validator.ts`.
    La maqueta valida y genera plantillas con el MISMO código que la API, para
    que lo que se ve en pantalla (vista previa, errores por fila, plantillas
    CSV y JSON) sea lo que dirá la API. Si cambia el esquema en la API, se
    vuelve a copiar; no se corrige acá.
    ========================================================================== */

import { messageFor } from './clinical-imports.messages';
import {
  DECIMAL_PATTERN,
  DOCUMENT_PATTERN,
  STRING_MAX,
  TEXT_MAX,
  conceptGroups,
  type ColumnSpec,
  type KindSpec,
} from './clinical-imports.schema';
import type {
  FieldIssue,
  ImportDeclaration,
  ParsedRow,
  RowIssue,
} from './clinical-imports.model';

/* ============================================================================
    Validación por fila (capa 1: esquema). No consulta nada: la resolución del
    paciente y de los códigos es la capa 2 (`clinical-import.evaluator.ts`).

    Todo hallazgo sale de `ISSUE_MESSAGES`: ni el mensaje ni el código contienen
    el valor recibido.
    ========================================================================== */

const issue = (field: string, code: string): FieldIssue => ({
  field,
  code,
  message: messageFor(code),
});

export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function isRealDatetime(value: string): boolean {
  return (
    DATETIME_PATTERN.test(value) &&
    isRealDate(value.slice(0, 10)) &&
    !Number.isNaN(Date.parse(value))
  );
}

/** Un día de tolerancia por desfase de reloj entre el origen y este servidor. */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

function issueOfValue(
  column: ColumnSpec,
  value: string,
  now: Date,
): FieldIssue | null {
  if (value === '')
    return column.required ? issue(column.name, 'REQUIRED') : null;
  const max = column.max ?? (column.type === 'text' ? TEXT_MAX : STRING_MAX);
  switch (column.type) {
    case 'string':
    case 'text':
      if (value.length > max) return issue(column.name, 'TOO_LONG');
      if (column.name === 'documentNumber' && !DOCUMENT_PATTERN.test(value))
        return issue(column.name, 'INVALID_FORMAT');
      return null;
    case 'decimal':
      return DECIMAL_PATTERN.test(value)
        ? null
        : issue(column.name, 'INVALID_FORMAT');
    case 'date':
      if (!isRealDate(value)) return issue(column.name, 'INVALID_FORMAT');
      return Date.parse(`${value}T00:00:00Z`) >
        now.getTime() + FUTURE_TOLERANCE_MS
        ? issue(column.name, 'OUT_OF_RANGE')
        : null;
    case 'datetime':
    case 'dateOrDatetime': {
      const valid =
        isRealDatetime(value) ||
        (column.type === 'dateOrDatetime' && isRealDate(value));
      if (!valid) return issue(column.name, 'INVALID_FORMAT');
      return Date.parse(value) > now.getTime() + FUTURE_TOLERANCE_MS
        ? issue(column.name, 'OUT_OF_RANGE')
        : null;
    }
  }
}

/** Hallazgos de UNA fila, columna por columna y luego las reglas entre columnas. */
export function validateRow(
  spec: KindSpec,
  row: ParsedRow,
  now: Date,
): FieldIssue[] {
  const issues: FieldIssue[] = [];
  for (const column of spec.columns) {
    if (row.malformed.includes(column.name)) {
      issues.push(issue(column.name, 'INVALID_FORMAT'));
      continue;
    }
    const found = issueOfValue(column, row.values[column.name] ?? '', now);
    if (found !== null) issues.push(found);
  }

  // Un concepto opcional va entero o no va: sistema sin código (o al revés) no se puede resolver.
  for (const group of conceptGroups(spec)) {
    if (group.required) continue;
    const system = row.values[group.systemField] ?? '';
    const code = row.values[group.codeField] ?? '';
    if ((system === '') !== (code === '')) {
      const missing = system === '' ? group.systemField : group.codeField;
      if (!issues.some((i) => i.field === missing))
        issues.push(issue(missing, 'FIELD_COMBINATION_INVALID'));
    }
  }

  if (issues.length === 0) {
    for (const rule of spec.rules) {
      if (rule.violated(row.values))
        issues.push({
          field: rule.field,
          code: rule.code,
          message: rule.message,
        });
    }
  }
  return issues;
}

export interface SchemaValidation {
  /** Filas sin problemas de esquema, en orden. */
  readonly valid: readonly ParsedRow[];
  readonly issues: readonly RowIssue[];
  /** Filas con al menos un problema. */
  readonly rejectedRows: readonly number[];
}

/** Valida todas las filas y detecta la clave de origen repetida dentro del archivo. */
export function validateRows(
  spec: KindSpec,
  rows: readonly ParsedRow[],
  now: Date,
): SchemaValidation {
  const issues: RowIssue[] = [];
  const valid: ParsedRow[] = [];
  const rejectedRows: number[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const found = validateRow(spec, row, now);
    if (found.length === 0) {
      const key = row.values['sourceRecordId'] ?? '';
      if (seen.has(key))
        found.push(issue('sourceRecordId', 'DUPLICATE_IN_FILE'));
      else seen.add(key);
    }
    if (found.length === 0) valid.push(row);
    else {
      rejectedRows.push(row.row);
      for (const f of found) issues.push({ row: row.row, ...f });
    }
  }
  return { valid, issues, rejectedRows };
}

/** Qué campo de la declaración es inválido, o `null`. Pide los tres, siempre. */
export function invalidDeclarationField(
  declaration: Partial<Record<keyof ImportDeclaration, unknown>>,
  now: Date,
): keyof ImportDeclaration | null {
  const text = (value: unknown, min: number, max: number): boolean =>
    typeof value === 'string' &&
    value.trim().length >= min &&
    value.trim().length <= max;
  if (!text(declaration.sourceOrganization, 1, 200))
    return 'sourceOrganization';
  if (!text(declaration.legalBasis, 3, 500)) return 'legalBasis';
  const loadedAt = declaration.loadedAt;
  if (typeof loadedAt !== 'string' || !isRealDate(loadedAt)) return 'loadedAt';
  if (loadedAt > now.toISOString().slice(0, 10)) return 'loadedAt';
  return null;
}
