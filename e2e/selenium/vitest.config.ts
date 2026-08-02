import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Corredor de la suite de Selenium.
 *
 * ## Por qué Vitest y no otro corredor
 *
 * El repositorio ya corre Vitest para las pruebas unitarias: reutilizarlo no
 * agrega ninguna dependencia, ni un segundo dialecto de `describe`/`expect`, ni
 * otra configuración de TypeScript que mantener. Mocha o Jest habrían traído
 * las tres cosas para dar exactamente lo mismo.
 *
 * Es una configuración **aparte** de `vitest.config.ts` porque no comparten
 * nada: aquélla mide cobertura de código de aplicación en jsdom, ésta conduce
 * un navegador de verdad desde Node.
 */

const raiz = resolve(import.meta.dirname, '../..');

/** Carpeta de artefactos de esta corrida. La estampa `run-e2e-selenium.mjs`. */
const runId = process.env['E2E_RUN_ID'] ?? new Date().toISOString().replace(/[:.]/g, '-');
const artefactos = resolve(raiz, process.env['E2E_ARTIFACTS_DIR'] ?? 'artifacts/selenium', runId);

/**
 * Archivos en paralelo.
 *
 * Cada prueba levanta su propio navegador con perfil limpio y elige su
 * escenario de API por cookie, así que dos archivos simultáneos no se pisan.
 * Dos es el punto donde la corrida se acorta a la mitad sin que el agente de CI
 * se quede sin memoria; `E2E_WORKERS=1` la hace enteramente secuencial cuando
 * hay que depurar.
 */
const workers = Number(process.env['E2E_WORKERS'] ?? 2);

export default defineConfig({
  root: raiz,
  test: {
    name: 'e2e-selenium',
    include: ['e2e/selenium/specs/**/*.spec.ts'],
    environment: 'node',
    globalSetup: ['e2e/selenium/harness/global-setup.ts'],

    /**
     * Los tiempos son generosos porque cada prueba abre un navegador, carga la
     * aplicación y espera a que hidrate. No son el mecanismo de sincronización
     * —eso son las esperas explícitas— sino el techo por encima del cual algo
     * está claramente roto.
     */
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // La preparación global construye el artefacto: eso solo ya son minutos.
    teardownTimeout: 30_000,

    pool: 'forks',
    fileParallelism: workers > 1,
    maxWorkers: workers,

    /**
     * Sin reintentos. Una prueba que pasa al segundo intento no es una prueba
     * que pasa: es una que esconde una condición de carrera. Si aparece
     * inestabilidad, se arregla la espera —para eso está `core/wait.helpers.ts`—
     * y no se tapa con un reintento.
     */
    retry: 0,

    // Un `test.only` olvidado convertiría la suite entera en una sola prueba.
    allowOnly: process.env['CI'] === undefined,

    reporters: process.env['CI'] === undefined
      ? ['verbose', ['junit', { suiteName: 'Selenium E2E' }], 'json']
      : ['verbose', 'github-actions', ['junit', { suiteName: 'Selenium E2E' }], 'json'],

    outputFile: {
      junit: resolve(artefactos, 'junit.xml'),
      json: resolve(artefactos, 'resultados.json'),
    },
  },
});
