/**
 * Construye el **conjunto semilla** del glosario en formato de shards:
 * `public/glossary-seed/`, commiteado.
 *
 * Es el respaldo de la maqueta cuando no se bajó el glosario completo
 * (`yarn mock:glossary:shards` → `public/glossary-data/`, fuera de git): los 69
 * curados, las capas de `data/glossary/` y el atlas anatómico, exactamente lo
 * que el simulador servía desde los fixtures en memoria, ya convertido.
 *
 * Los fixtures TypeScript siguen siendo la fuente (`yarn mock:glossary` los
 * regenera y `catalog:sync` del servicio de IA copia `glosario.generated.ts`);
 * esto sólo los convierte. Uso: `yarn mock:glossary:seed`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';

import { buildGlossaryDataset, conceptIdOf } from './lib/glossary-shards.mjs';

const RAIZ = process.cwd();
const DESTINO = join(RAIZ, 'public', 'glossary-seed');
const TEMPORAL = join(RAIZ, 'tmp', 'glossary-seed-export.mjs');

await build({
  entryPoints: [join(RAIZ, 'scripts', 'glossary-seed', 'export-rows.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: TEMPORAL,
  logLevel: 'error',
});
const { filas, taxonomia } = JSON.parse(
  execFileSync(process.execPath, [TEMPORAL], { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }),
);

// Paridad del hash: los ids de los fixtures tienen que ser los que el
// constructor calcula para una fila sin id. Si esto falla, un enlace a un
// término del glosario completo dejaría de coincidir con el de la semilla.
const curado = filas.find((fila) => fila.source === 'alovida-curated');
if (curado === undefined || conceptIdOf(curado.slug) !== curado.id) {
  throw new Error('El hash de ids de scripts/lib/glossary-shards.mjs no coincide con mock-store.ts.');
}

const archivos = buildGlossaryDataset(filas, { ...taxonomia, source: 'seed' });

rmSync(DESTINO, { recursive: true, force: true });
let bytes = 0;
for (const [ruta, contenido] of archivos) {
  const destino = join(DESTINO, ruta);
  mkdirSync(dirname(destino), { recursive: true });
  const texto = JSON.stringify(contenido);
  bytes += Buffer.byteLength(texto);
  writeFileSync(destino, texto);
}
rmSync(TEMPORAL, { force: true });

console.log(
  `glossary-seed: ${filas.length} términos, ${archivos.size} archivos, ${(bytes / 1024 / 1024).toFixed(2)} MB → public/glossary-seed/`,
);
