/**
 * Trae la LINAME 2022-2024 (Lista Nacional de Medicamentos Esenciales de
 * Bolivia) a la maqueta: `src/app/core/mock/fixtures/liname.generated.ts`.
 *
 * La fuente es el JSON que la API extrae del PDF oficial
 * (`tools/bolivia-datasets/extract_liname.py` → `tools/bolivia-datasets/data/`).
 * Agrupa por ATC nivel 5 —un medicamento del vademécum por ATC, como la API— y
 * no reescribe nada salvo los acentos graves («sòdica» → «sódica»), que el
 * castellano no usa. Lo que la fuente publica con ATC incompleto («A03AC**») no
 * entra: no es un código nivel 5.
 *
 * Uso:
 *   node scripts/gen-liname-fixture.mjs                  # ../mantra-core-health-api
 *   node scripts/gen-liname-fixture.mjs <ruta-a-la-api>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = process.cwd();
const API = resolve(process.argv[2] ?? join(RAIZ, '..', 'mantra-core-health-api'));
const ENTRADA = join(API, 'tools', 'bolivia-datasets', 'data', 'liname-2022-2024.json');
const SALIDA = join(RAIZ, 'src', 'app', 'core', 'mock', 'fixtures', 'liname.generated.ts');

const GRAVES = { à: 'á', è: 'é', ì: 'í', ò: 'ó', ù: 'ú', À: 'Á', È: 'É', Ì: 'Í', Ò: 'Ó', Ù: 'Ú' };
const agudos = (t) => t.replace(/[àèìòùÀÈÌÒÙ]/g, (c) => GRAVES[c]);
const unicos = (xs) => [...new Set(xs.filter(Boolean))];

const { fuente, medicamentos } = JSON.parse(readFileSync(ENTRADA, 'utf8'));
const porAtc = new Map();
for (const m of medicamentos) {
  if (!m.atc) continue;
  const fila = {
    ...m,
    nombre: agudos(m.nombre),
    forma: agudos(m.forma),
    concentracion: agudos(m.concentracion),
  };
  porAtc.set(m.atc, [...(porAtc.get(m.atc) ?? []), fila]);
}

/** El nombre más repetido entre las presentaciones del ATC; a igualdad, el más corto. */
function nombreDe(filas) {
  const cuenta = new Map();
  for (const f of filas) cuenta.set(f.nombre, (cuenta.get(f.nombre) ?? 0) + 1);
  return [...cuenta].sort(
    (a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]),
  )[0][0];
}

const filas = [...porAtc]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([atc, fs]) => ({
    atc,
    name: nombreDe(fs),
    doseForms: unicos(fs.map((f) => f.forma)),
    strengths: unicos(fs.map((f) => f.concentracion).filter((c) => !/^Según/i.test(c))),
    presentations: fs
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      .map((f) => ({
        code: f.codigo,
        form: f.forma,
        strength: f.concentracion,
        restrictedUse: f.usoRestringido,
      })),
  }));

const cuerpo = `/* ============================================================================
    LINAME 2022-2024 — Lista Nacional de Medicamentos Esenciales de Bolivia
    (${fuente.organismo}), agrupada por ATC nivel 5.

    **GENERADO por \`scripts/gen-liname-fixture.mjs\`. No editar a mano.**
    Extraída del PDF oficial por la API (\`tools/bolivia-datasets/extract_liname.py\`),
    SHA-256 del PDF: ${fuente.sha256}.
    ${filas.length} medicamentos. La LINAME no trae indicaciones, dosis ni
    contraindicaciones, y este archivo tampoco.
    ========================================================================== */

export interface PresentacionLiname {
  /** Código LINAME (\`J-01-49\`). */
  readonly code: string;
  readonly form: string;
  readonly strength: string;
  /** «R» en la LINAME: uso restringido. */
  readonly restrictedUse: boolean;
}

export interface MedicamentoLiname {
  readonly atc: string;
  readonly name: string;
  readonly doseForms: readonly string[];
  readonly strengths: readonly string[];
  readonly presentations: readonly PresentacionLiname[];
}

export const MEDICAMENTOS_LINAME: readonly MedicamentoLiname[] = ${JSON.stringify(filas, null, 2)};
`;
writeFileSync(SALIDA, cuerpo);
console.log(`liname: ${filas.length} medicamentos → ${SALIDA}`);
