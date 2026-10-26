#!/usr/bin/env node
/**
 * Gate de cierre de las correcciones 31–40.
 *
 * Juzga, carril por carril, si la evidencia alcanza para declararlo cerrado, y
 * sale distinto de 0 si no. Lo que cada criterio exige y de dónde sale está en
 * `docs/testing/gate-correcciones.md`.
 *
 *   node scripts/check-correcciones.mjs                  todos los carriles
 *   node scripts/check-correcciones.mjs --carril 34      uno (o `31,32`)
 *   node scripts/check-correcciones.mjs criterios        los criterios y su fuente
 *   node scripts/check-correcciones.mjs registrar typecheck --carril 34 -- yarn typecheck
 *   node scripts/check-correcciones.mjs revisar 34 --revisor X --veredicto APROBADO --desde <rev>
 *
 * Salida: 0 todos PASA · 1 algún FALLA · 2 sin FALLA pero algún NO EVALUABLE.
 */

import { fileURLToPath } from 'node:url';

import { main } from './lib/correcciones-cli.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
process.exitCode = await main(process.argv.slice(2), { repo });
