#!/usr/bin/env node
/**
 * Verifica el modo `real-api` del front: el único arranque soportado con el
 * backend simulado apagado (B-24).
 *
 * ## Qué defecto impide
 *
 * La rama `mockup` fija `mockBackend: true` en `environment.ts` y en
 * `environment.development.ts`, y ninguno lee el entorno del proceso. Sin una
 * configuración explícita no había forma de correr el front contra la API real
 * sin editar archivos versionados antes de cada corrida; y el interruptor
 * `apiRealForzada` no alcanza para certificar, porque la maqueta sigue encendida.
 *
 * ## Qué comprueba
 *
 *   - `build.configurations.real-api` reemplaza `environment.ts` por
 *     `environment.real-api.ts`, y `serve.configurations.real-api` la usa;
 *   - `real-api` apaga SSR y prerender (`server: false`, `ssr: false`,
 *     `outputMode: static`), igual que `e2e-real`: con la maqueta apagada el
 *     prerender pide datos a una API que en el build no existe, la app no
 *     estabiliza y el build queda colgado;
 *   - `development` sigue reemplazándolo por `environment.development.ts`,
 *     `production` no lo reemplaza, y los defaults no cambiaron;
 *   - el servidor de desarrollo sigue teniendo `proxyConfig`;
 *   - `yarn start:real-api` arranca esa configuración;
 *   - `real-api` declara `mockBackend: false` y los otros dos entornos `true`;
 *   - `real-api` declara `campaignsDemo: false` y `paymentDemo: false`: con la
 *     API real ninguna demo fabrica campañas ni pagos (MOCKS OFF).
 *
 * Uso: node scripts/check-real-api-config.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (ruta) => readFileSync(resolve(RAIZ, ruta), 'utf8');

const ENTORNO = 'src/environments/environment.ts';
const errores = [];
const exigir = (condicion, mensaje) => {
  if (!condicion) errores.push(mensaje);
};

const angular = JSON.parse(leer('angular.json'));
const [nombre, proyecto] = Object.entries(angular.projects)[0];
const build = proyecto.architect.build;
const serve = proyecto.architect.serve;

const reemplazoDe = (configuracion) =>
  (build.configurations?.[configuracion]?.fileReplacements ?? []).find((r) => r.replace === ENTORNO)
    ?.with ?? null;

exigir(
  reemplazoDe('real-api') === 'src/environments/environment.real-api.ts',
  'build «real-api» tiene que reemplazar environment.ts por environment.real-api.ts',
);
const realApi = build.configurations?.['real-api'] ?? {};
exigir(realApi.server === false, 'build «real-api» tiene que declarar server: false');
exigir(realApi.ssr === false, 'build «real-api» tiene que declarar ssr: false');
exigir(realApi.outputMode === 'static', 'build «real-api» tiene que declarar outputMode: static');
exigir(
  reemplazoDe('development') === 'src/environments/environment.development.ts',
  'build «development» tiene que seguir usando environment.development.ts',
);
exigir(reemplazoDe('production') === null, 'build «production» no tiene que reemplazar environment.ts');
exigir(build.defaultConfiguration === 'production', 'el build por defecto tiene que seguir siendo «production»');
exigir(serve.defaultConfiguration === 'development', 'el serve por defecto tiene que seguir siendo «development»');
exigir(
  serve.configurations?.['real-api']?.buildTarget === `${nombre}:build:real-api`,
  'serve «real-api» tiene que usar el build «real-api»',
);
exigir(Boolean(serve.options?.proxyConfig), 'el servidor de desarrollo tiene que conservar proxyConfig');

const scripts = JSON.parse(leer('package.json')).scripts ?? {};
exigir(
  /ng serve --configuration real-api\b/.test(scripts['start:real-api'] ?? ''),
  '«yarn start:real-api» tiene que arrancar ng serve --configuration real-api',
);

exigir(
  /mockBackend:\s*false/.test(leer('src/environments/environment.real-api.ts')),
  'environment.real-api.ts tiene que declarar mockBackend: false',
);
for (const demo of ['campaignsDemo', 'paymentDemo']) {
  exigir(
    new RegExp(`\\b${demo}:\\s*false\\b`).test(leer('src/environments/environment.real-api.ts')),
    `environment.real-api.ts tiene que declarar ${demo}: false`,
  );
}
for (const archivo of [ENTORNO, 'src/environments/environment.development.ts']) {
  exigir(/mockBackend:\s*true/.test(leer(archivo)), `${archivo} tiene que seguir con mockBackend: true`);
}

if (errores.length > 0) {
  console.error('[check-real-api-config] Configuración real-api inválida:');
  for (const error of errores) console.error(`  ✗ ${error}`);
  process.exit(1);
}
console.log(
  '[check-real-api-config] ✓ real-api apaga la maqueta, las demos de campañas y pago, y el SSR; development y production intactos.',
);
