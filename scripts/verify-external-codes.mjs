/**
 * Verifica con red que cada código ICD-10-CM y LOINC de las capas ES del glosario
 * **existe en su fuente**, y con `--write` completa `enDisplay` con el título oficial.
 *
 * ## Por qué existe
 *
 * Un código de memoria puede estar mal por un dígito y seguir pareciendo válido:
 * `24627-2` no es la radiografía de tórax sino «CT Chest». La capa ES la escribe
 * gente, y esta verificación es lo que convierte «creo que es este código» en
 * «la fuente dice que este código existe y se llama así» (regla 00 §7).
 *
 * ## Fuente
 *
 * NLM Clinical Table Search Service, sin clave: `icd10cm/v3` y `loinc_items/v3`,
 * buscando por el campo de código exacto (`sf=code` / `sf=LOINC_NUM`). Es la
 * misma API que usan los importadores de la API (`tools/terminology-import/`).
 * Se respeta un retardo entre llamadas para ser buen ciudadano.
 *
 * Uso: `node scripts/verify-external-codes.mjs [--write]`
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CORPUS, leerCapa } from './lib/glosario-corpus.mjs';

const ESCRIBIR = process.argv.includes('--write');
const RETARDO_MS = 130;
const CAPAS_ES = ['enfermedades-atencion-primaria.ndjson', 'analisis-frecuentes.ndjson'];

const FUENTES = {
  icd10cm: (code) =>
    `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code&maxList=5&terms=${encodeURIComponent(code)}`,
  loinc: (code) =>
    `https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?sf=LOINC_NUM&df=LOINC_NUM,LONG_COMMON_NAME&maxList=5&terms=${encodeURIComponent(code)}`,
};

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * El título oficial del código, o `null` si la fuente no lo tiene.
 *
 * La API devuelve `[total, [códigos], null, [[código, nombre], …]]` y busca por
 * prefijo, así que hay que quedarse con la coincidencia **exacta** (con o sin
 * punto en ICD: `J45.20` y `J4520` nombran lo mismo).
 */
async function tituloOficial(sistema, code) {
  const respuesta = await fetch(FUENTES[sistema](code));
  if (!respuesta.ok)
    throw new Error(`NLM respondió HTTP ${respuesta.status} para ${sistema} ${code}`);
  const [, , , pares] = await respuesta.json();
  const normal = (c) => String(c).replace('.', '').toUpperCase();
  const exacto = (pares ?? []).find(([c]) => normal(c) === normal(code));
  return exacto ? exacto[1] : null;
}

let faltantes = 0;
let verificados = 0;
let completados = 0;
for (const nombre of CAPAS_ES) {
  const capa = leerCapa(nombre);
  if (capa.problemas.length > 0) {
    for (const p of capa.problemas) console.error(`[verificar] ${nombre}:${p.linea} ${p.motivo}`);
    continue;
  }
  const filas = [];
  for (const fila of capa.filas) {
    const { linea, ...resto } = fila;
    const sistema = resto.codeSystem;
    if (!(sistema in FUENTES)) {
      console.error(`[verificar] ${nombre}:${linea} sistema desconocido «${sistema}»`);
      faltantes += 1;
      filas.push(resto);
      continue;
    }
    const titulo = await tituloOficial(sistema, resto.code);
    await dormir(RETARDO_MS);
    if (titulo === null) {
      console.error(
        `[verificar] ${nombre}:${linea} ${sistema} «${resto.code}» (${resto.slug}) NO EXISTE en la fuente`,
      );
      faltantes += 1;
    } else {
      verificados += 1;
      if (resto.enDisplay !== titulo) {
        if (ESCRIBIR) {
          completados += 1;
          resto.enDisplay = titulo;
        } else {
          console.warn(
            `[verificar] ${nombre}:${linea} ${resto.code}: enDisplay «${resto.enDisplay ?? ''}» ≠ oficial «${titulo}» (corré con --write)`,
          );
        }
      }
    }
    filas.push(resto);
  }
  if (ESCRIBIR) {
    writeFileSync(join(CORPUS, nombre), `${filas.map((f) => JSON.stringify(f)).join('\n')}\n`);
  }
}

console.log(
  `[verificar] ${verificados} códigos existen · ${faltantes} faltantes${ESCRIBIR ? ` · ${completados} enDisplay completados` : ''}`,
);
process.exit(faltantes > 0 ? 1 : 0);
