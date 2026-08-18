#!/usr/bin/env node
/**
 * Corre las **dos** suites de extremo a extremo del carril P4 contra un mismo
 * servidor, y deja un resumen único.
 *
 * ## Por qué existe
 *
 * Cypress y Playwright cubren el mismo journey a propósito —el catálogo del
 * carril pide los dos adaptadores— pero **no conviven solos**. Ponerlas a correr
 * juntas costó destrabar tres cosas, y ninguna de las tres se anuncia como lo
 * que es:
 *
 * 1. **`ELECTRON_RUN_AS_NODE`**. Si está en el entorno —la ponen varias
 *    herramientas que embeben Electron, y queda heredada— el binario de Cypress
 *    arranca como Node y rechaza sus propios argumentos:
 *
 *        Cypress.app/Contents/MacOS/Cypress: bad option: --no-sandbox
 *
 *    Cypress lo reporta como «Cypress failed to start … missing library or
 *    dependency» y enlaza a la página de dependencias del sistema, que manda a
 *    buscar el problema al lado equivocado. Playwright no la usa y no se entera.
 *    Acá se borra del entorno del hijo.
 *
 * 2. **`cypress/e2e/real/**` está excluido por omisión.** La exclusión gana
 *    sobre el `--spec` que se pida por línea de comandos, y el mensaje —«no spec
 *    files were found»— no menciona que haya una exclusión de por medio. Se abre
 *    con `E2E_SUITE`, que acá se fija.
 *
 * 3. **Las dos apuntan a servidores distintos por omisión**: Playwright a
 *    `:4200` y Cypress levanta su propio arnés. Contra servidores distintos, dos
 *    suites que deberían coincidir dejan de ser comparables — y cuando una falla
 *    no se sabe si es el producto o el arnés. Acá las dos reciben la **misma**
 *    URL base.
 *
 * ## Uso
 *
 *     node scripts/e2e-carril-p4.mjs                    # las dos suites
 *     node scripts/e2e-carril-p4.mjs --solo=playwright
 *     node scripts/e2e-carril-p4.mjs --solo=cypress
 *     E2E_BASE_URL=http://localhost:4300 node scripts/e2e-carril-p4.mjs
 *     E2E_API_URL=http://localhost:3000 node scripts/e2e-carril-p4.mjs
 *
 * El servidor tiene que estar levantado y hablando con una API con los datos de
 * `yarn seed:e2e`. Este script no lo levanta: hacerlo lo ataría a una forma de
 * servir —desarrollo o SSR construido— y el carril necesita poder probar las
 * dos.
 */

import { spawnSync } from 'node:child_process';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4250';

/**
 * La API, para las comprobaciones que **no** pasan por el navegador.
 *
 * Las dos suites no la necesitan igual, y ésa es la cuarta trampa de hacerlas
 * convivir: los journeys de Playwright afirman cosas del contrato HTTP —que el
 * 404 del despublicado tenga el mismo cuerpo que el del inexistente, que un
 * prefijo de otro vertical no redirija— y para eso hablan con la API
 * **directo**, por `E2E_API_URL`, cuyo valor por omisión (`:3005`) no es el de
 * este entorno. Cypress no la usa: todo lo suyo entra por el navegador y sale
 * por el proxy.
 *
 * Pasarle sólo `E2E_BASE_URL` a las dos deja a Playwright buscando una API que
 * no está ahí, y el fallo se lee como «la API no responde» cuando la API está
 * perfectamente viva en otro puerto.
 */
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3001';
const soloArg = process.argv.find((a) => a.startsWith('--solo='));
const solo = soloArg ? soloArg.split('=')[1] : 'ambas';

/**
 * El entorno para los hijos, saneado.
 *
 * Se copia y se borra la variable en vez de usar `env -u`, que no existe en
 * Windows: este repositorio se clona también ahí.
 */
function entorno(extra = {}) {
  const env = { ...process.env, E2E_BASE_URL: BASE, E2E_API_URL: API, ...extra };
  delete env['ELECTRON_RUN_AS_NODE'];
  return env;
}

/** Corre un comando y devuelve si salió bien. */
function correr(titulo, comando, args, extra = {}) {
  console.log(`\n─── ${titulo} ───`);
  const r = spawnSync(comando, args, { stdio: 'inherit', env: entorno(extra), shell: false });
  return r.status === 0;
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log(`Front bajo prueba: ${BASE}`);
console.log(`API bajo prueba:   ${API}   (sólo Playwright la llama directo)`);

const resultados = [];

if (solo === 'ambas' || solo === 'playwright') {
  resultados.push([
    'Playwright',
    correr('Playwright · journeys', npx, [
      'playwright',
      'test',
      'carril-p4-buscador-publico',
      '--reporter=list',
    ]),
  ]);
  resultados.push([
    'Playwright · evidencia',
    correr('Playwright · capturas', npx, [
      'playwright',
      'test',
      'carril-p4-evidencia',
      '--reporter=list',
    ]),
  ]);
}

if (solo === 'ambas' || solo === 'cypress') {
  resultados.push([
    'Cypress',
    correr(
      'Cypress · journeys',
      npx,
      [
        'cypress',
        'run',
        '--e2e',
        '--browser',
        'chrome',
        '--spec',
        'cypress/e2e/real/11-directorio-publico.cy.ts',
      ],
      // Sin esto la exclusión por omisión se come el `--spec` y el mensaje no
      // dice por qué.
      { E2E_SUITE: 'real' },
    ),
  ]);
}

console.log('\n═══ Resumen ═══');
for (const [nombre, ok] of resultados) {
  console.log(`  ${ok ? '✓' : '✗'}  ${nombre}`);
}

const fallaron = resultados.filter(([, ok]) => !ok);
if (fallaron.length > 0) {
  console.error(`\n${fallaron.length} suite(s) con fallos.`);
  process.exit(1);
}
console.log('\nLas dos suites pasan contra el mismo servidor.');
