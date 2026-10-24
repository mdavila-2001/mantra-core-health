/**
 * Trae el Arancel FONASA 2026 (Chile, Modalidad Libre Elección) a la maqueta,
 * convertido a bolivianos: `src/app/core/mock/fixtures/fonasa-aranceles.generated.ts`.
 *
 * Para qué: Bolivia no publica un arancel oficial de imagenología, y el de
 * INLASA cubre sólo los análisis que hace el laboratorio estatal. FONASA es la
 * referencia oficial más cercana que publica el valor de cada estudio. Se usa
 * DONDE NO HAY dato boliviano, y el rótulo de cada precio dice que es una
 * referencia extranjera convertida, no lo que cobra el centro.
 *
 * La fuente es el JSON que extrae la API del PDF oficial
 * (`tools/bolivia-datasets/extract_fonasa.py` → `tools/bolivia-datasets/data/`),
 * con los valores verbatim en pesos chilenos. Acá sólo se convierte:
 *
 *   Bs = CLP ÷ (CLP por USD) × (Bs por USD), redondeado a 2 decimales.
 *
 * Tipos de cambio oficiales del 01/10/2026:
 *   - 972,60 CLP/USD — dólar observado, Banco Central de Chile (publicado por
 *     el SII: https://www.sii.cl/valores_y_fechas/dolar/dolar2026.htm);
 *   - 12,00 Bs/USD — Tipo de Cambio Oficial del Banco Central de Bolivia
 *     (https://www.bcb.gob.bo/bcb_tco_publico_ultima_cotizacion.php).
 *
 * Uso:
 *   node scripts/gen-fonasa-fixture.mjs                  # ../mantra-core-health-api
 *   node scripts/gen-fonasa-fixture.mjs <ruta-a-la-api>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = process.cwd();
const API = resolve(process.argv[2] ?? join(RAIZ, '..', 'mantra-core-health-api'));
const DATOS = join(API, 'tools', 'bolivia-datasets', 'data');
const SALIDA = join(
  RAIZ,
  'src',
  'app',
  'core',
  'mock',
  'fixtures',
  'fonasa-aranceles.generated.ts',
);

const CONVERSION = {
  fecha: '2026-10-01',
  clpPorUsd: 972.6,
  fuenteClp: 'Dólar observado, Banco Central de Chile (SII), 01/10/2026',
  bobPorUsd: 12.0,
  fuenteBob: 'Tipo de Cambio Oficial del Banco Central de Bolivia, vigente el 01/10/2026',
};

/** CLP enteros → cadena decimal en Bs con dos decimales, sin pasar por `toLocaleString`. */
function aBolivianos(clp) {
  const centavos = Math.round((clp / CONVERSION.clpPorUsd) * CONVERSION.bobPorUsd * 100);
  return `${Math.trunc(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}

/** Siglas que el nombre oficial trae en mayúsculas y se quedan así. */
const SIGLAS = new Set([
  'TC',
  'RN',
  'PET',
  'SPECT',
  'TAC',
  'RM',
  'TSH',
  'LDH',
  'HDL',
  'LDL',
  'PCR',
  'VIH',
  'HLA',
  'ACTH',
  'BNP',
  'CEA',
  'PTH',
  'GGT',
  'CK',
  'MB',
  'AOT',
]);

/** «RADIOGRAFÍA DE TÓRAX FRONTAL Y LATERAL» → «Radiografía de tórax frontal y lateral». Sólo cambia la caja. */
function oracion(nombre) {
  const palabras = nombre.toLowerCase().split(' ');
  return palabras
    .map((p, i) => {
      const original = nombre.split(' ')[i] ?? p;
      if (SIGLAS.has(original.replace(/[^A-Z0-9]/g, ''))) return original;
      return i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p;
    })
    .join(' ');
}

function leer(archivo) {
  const datos = JSON.parse(readFileSync(join(DATOS, archivo), 'utf8'));
  return {
    fuente: datos.fuente,
    filas: datos.prestaciones.map((p) => ({
      code: p.codigo,
      name: oracion(p.nombre),
      officialName: p.nombre,
      section: p.seccion,
      valueClp: p.valorClp,
      priceBs: aBolivianos(p.valorClp),
    })),
  };
}

const laboratorio = leer('fonasa-mle-2026-laboratorio.json');
const imagen = leer('fonasa-mle-2026-imagenologia.json');

const cuerpo = `/* ============================================================================
    Arancel FONASA 2026 (Chile, Modalidad Libre Elección), Grupos 03
    «Laboratorio» y 04 «Imagenología», convertido a bolivianos.

    **GENERADO por \`scripts/gen-fonasa-fixture.mjs\`. No editar a mano.**
    Fuente: ${laboratorio.fuente.url}
    Copia leída: ${laboratorio.fuente.copiaLeida} · SHA-256: ${laboratorio.fuente.sha256}
    Columna: ${laboratorio.fuente.columna} (valores verbatim en \`valueClp\`).
    Conversión: CLP ÷ ${CONVERSION.clpPorUsd} × ${CONVERSION.bobPorUsd} — ${CONVERSION.fuenteClp}; ${CONVERSION.fuenteBob}.

    Es una REFERENCIA EXTRANJERA: se usa sólo donde no hay dato boliviano
    (INLASA para laboratorio; para imagen no existe).
    ========================================================================== */

/** Una prestación del arancel. \`priceBs\` es la cadena decimal exacta («39.11»). */
export interface PrestacionFonasa {
  readonly code: string;
  readonly name: string;
  readonly officialName: string;
  readonly section: string | null;
  readonly valueClp: number;
  readonly priceBs: string;
}

export const FONASA_FUENTE = ${JSON.stringify({ url: laboratorio.fuente.url, vigencia: laboratorio.fuente.vigencia, sha256: laboratorio.fuente.sha256 })} as const;

export const FONASA_CONVERSION = ${JSON.stringify(CONVERSION, null, 2)} as const;

export const FONASA_LABORATORIO: readonly PrestacionFonasa[] = ${JSON.stringify(laboratorio.filas, null, 2)};

export const FONASA_IMAGEN: readonly PrestacionFonasa[] = ${JSON.stringify(imagen.filas, null, 2)};
`;

writeFileSync(SALIDA, cuerpo);
console.log(
  `fonasa-aranceles: ${laboratorio.filas.length} de laboratorio + ${imagen.filas.length} de imagen → ${SALIDA}`,
);
