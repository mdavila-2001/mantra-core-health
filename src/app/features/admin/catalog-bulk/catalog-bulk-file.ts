import type { KindInfo } from './catalog-bulk-kinds';
import { CATALOG_BULK_MAX_ROWS } from './catalog-bulk-kinds';

export type ParsedFile =
  | { readonly ok: true; readonly rows: readonly Record<string, unknown>[] }
  | { readonly ok: false; readonly message: string };

const TRUE_WORDS = new Set(['true', 'si', 'sí', '1', 'yes']);
const FALSE_WORDS = new Set(['false', 'no', '0']);

/** Splits one CSV line honoring double quotes. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { cells.push(cell); cell = ''; }
    else cell += c;
  }
  cells.push(cell);
  return cells.map((v) => v.trim());
}

/** Types a raw CSV cell by the column kind; unknown words stay text so the API rejects them. */
function typed(info: KindInfo, column: string, raw: string): unknown {
  if (info.numeric.includes(column)) {
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : raw;
  }
  if (info.boolean.includes(column)) {
    const w = raw.toLowerCase();
    return TRUE_WORDS.has(w) ? true : FALSE_WORDS.has(w) ? false : raw;
  }
  return raw;
}

function fromCsv(text: string, info: KindInfo): ParsedFile {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return { ok: false, message: 'El CSV necesita una fila de encabezados y al menos una de datos.' };
  const head = lines[0]!;
  const delimiter = [';', '\t', ','].reduce((a, b) => (head.split(b).length > head.split(a).length ? b : a));
  const columns = splitLine(head, delimiter);
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line, delimiter);
    const row: Record<string, unknown> = {};
    columns.forEach((column, i) => {
      const raw = cells[i] ?? '';
      if (column !== '' && raw !== '') row[column] = typed(info, column, raw);
    });
    return row;
  });
  return { ok: true, rows };
}

/** Reads a CSV or JSON (array of objects) file into bulk rows, within the API row cap. */
export function parseCatalogFile(name: string, text: string, info: KindInfo): ParsedFile {
  let parsed: ParsedFile;
  if (name.toLowerCase().endsWith('.json')) {
    try {
      const data: unknown = JSON.parse(text);
      const ok = Array.isArray(data) && data.every((r) => typeof r === 'object' && r !== null && !Array.isArray(r));
      parsed = ok
        ? { ok: true, rows: data as Record<string, unknown>[] }
        : { ok: false, message: 'El JSON debe ser un arreglo de objetos, uno por fila.' };
    } catch {
      parsed = { ok: false, message: 'El archivo no es un JSON válido.' };
    }
  } else {
    parsed = fromCsv(text, info);
  }
  if (!parsed.ok) return parsed;
  if (parsed.rows.length === 0) return { ok: false, message: 'El archivo no tiene filas.' };
  if (parsed.rows.length > CATALOG_BULK_MAX_ROWS) {
    return { ok: false, message: `El archivo tiene ${parsed.rows.length} filas; el máximo por carga es ${CATALOG_BULK_MAX_ROWS}.` };
  }
  return parsed;
}

/** The value of a row's key column, for the report. */
export function keyOfRow(row: Record<string, unknown> | undefined, field: string): string {
  const v = row?.[field];
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '—';
}
