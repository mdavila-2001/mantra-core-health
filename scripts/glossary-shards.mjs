/**
 * Trae el glosario completo de `glossary-data-build/` a la maqueta:
 * `public/glossary-data/`, que va en `.gitignore` porque pesa.
 *
 * Lee los shards que emiten los importadores (`shards/<categoryKey>/page-<n>.json`
 * y `shards/index.json`, esquema en `glossary-data-build/SCHEMA.md`) y escribe
 * la misma estructura que la semilla, más los índices que el simulador usa
 * para buscar, filtrar por etiqueta y abrir una ficha por id sin bajar el
 * corpus entero (ver `scripts/lib/glossary-shards.mjs`). No reescribe
 * contenido: cada fila pasa tal cual.
 *
 * Uso:
 *   yarn mock:glossary:shards                  # ../glossary-data-build
 *   yarn mock:glossary:shards <ruta-al-build>  # otra ubicación
 *
 * Sin `public/glossary-data/`, la maqueta sirve la semilla
 * (`public/glossary-seed/`, `yarn mock:glossary:seed`), que sale del mismo
 * build sin las fichas completas de `detail/`.
 *
 * Al terminar regenera `src/environments/env.generated.ts`: ahí queda anotado
 * (`mockAssets.glossaryData`) que la descarga completa existe, y el simulador
 * la prueba primero. Si la copiás a mano, corré `yarn env:generate`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { leerBuildDelGlosario, taxonomiaDe } from './lib/glossary-build-reader.mjs';
import { buildGlossaryDataset } from './lib/glossary-shards.mjs';

const RAIZ = process.cwd();
const ORIGEN = resolve(process.argv[2] ?? process.env.GLOSSARY_DATA_BUILD ?? join(RAIZ, '..', 'glossary-data-build'));
const DESTINO = join(RAIZ, 'public', 'glossary-data');

let leido;
try {
  leido = leerBuildDelGlosario(ORIGEN);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const { filas, indice, shards } = leido;

const rutaSemilla = join(RAIZ, 'public', 'glossary-seed', 'manifest.json');
const semilla = existsSync(rutaSemilla) ? JSON.parse(readFileSync(rutaSemilla, 'utf8')) : null;

const archivos = buildGlossaryDataset(filas, { ...taxonomiaDe(filas, indice, semilla), source: 'glossary-data-build' });

rmSync(DESTINO, { recursive: true, force: true });
let bytes = 0;
for (const [ruta, contenido] of archivos) {
  const destino = join(DESTINO, ruta);
  mkdirSync(dirname(destino), { recursive: true });
  const texto = JSON.stringify(contenido);
  bytes += Buffer.byteLength(texto);
  writeFileSync(destino, texto);
}
// Las filas completas (`detail/<slug>.json`: ficha técnica de CIMA, guías de
// MedlinePlus) se copian tal cual; la maqueta las pide sólo al abrir la ficha.
const DETALLE = join(shards, 'detail');
let detalles = 0;
if (existsSync(DETALLE)) {
  mkdirSync(join(DESTINO, 'detail'), { recursive: true });
  for (const nombre of readdirSync(DETALLE)) {
    if (!nombre.endsWith('.json')) continue;
    const texto = readFileSync(join(DETALLE, nombre));
    bytes += texto.length;
    writeFileSync(join(DESTINO, 'detail', nombre), texto);
    detalles += 1;
  }
}

console.log(
  `glossary-data: ${detalles} fichas completas en detail/.`,
);
console.log(
  `glossary-data: ${filas.length} términos de ${ORIGEN}, ${archivos.size} archivos, ${(bytes / 1024 / 1024).toFixed(1)} MB → public/glossary-data/`,
);

// El simulador no pide `glossary-data/` si el entorno generado dice que no está
// (así evita un 404 esperado en la consola): hay que decirle que ahora sí.
execFileSync(process.execPath, [join(RAIZ, 'scripts', 'generate-env.mjs')], { stdio: 'inherit' });
