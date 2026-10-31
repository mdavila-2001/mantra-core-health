/**
 * Copia el lote S2 (CIE-10-ES) pasando a https los enlaces de procedencia que la fuente publicó
 * en http. El ingestor exige https; el servidor de cada fuente responde por https (comprobado con
 * curl el 2026-10-22). No cambia ningún texto, licencia ni identificador.
 *
 * Uso: node docs/trabajo/2026-10-22-glossary-cie10/to-https.mjs <entrada.ndjson> <salida.ndjson>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Uso: to-https.mjs <entrada.ndjson> <salida.ndjson>');

const toHttps = (value) => (typeof value === 'string' ? value.replace(/^http:\/\//u, 'https://') : value);
let upgraded = 0;
const lines = [];
for (const line of readFileSync(input, 'utf8').split(/\r?\n/u)) {
  if (line.trim() === '') continue;
  const article = JSON.parse(line);
  for (const section of article.sections ?? []) {
    const next = toHttps(section.sourceUrl);
    if (next !== section.sourceUrl) upgraded++;
    section.sourceUrl = next;
  }
  for (const list of [article.facts, article.references]) {
    for (const item of list ?? []) {
      if (item === null || typeof item !== 'object') continue;
      item.sourceUrl = toHttps(item.sourceUrl);
      item.url = toHttps(item.url);
    }
  }
  lines.push(JSON.stringify(article));
}
writeFileSync(output, `${lines.join('\n')}\n`);
process.stdout.write(`${lines.length} artículos; ${upgraded} secciones pasadas a https\n`);
