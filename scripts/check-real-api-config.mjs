#!/usr/bin/env node
/** Verifica API real predeterminada, demo explicita y production-api con SSR. */

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

const simulatedFlags = [
  'mockBackend', 'demoPresets', 'paymentDemo', 'loyaltyDemo',
  'campaignsDemo', 'billingSiatDemo', 'designMockups',
];
for (const filename of [
  ENTORNO,
  ...['development', 'real-api', 'e2e-real', 'production-api'].map(
    (mode) => `src/environments/environment.${mode}.ts`,
  ),
]) {
  for (const flag of simulatedFlags) {
    exigir(new RegExp(`\\b${flag}:\\s*false\\b`).test(leer(filename)), `${filename}: ${flag} debe estar apagado`);
  }
}
const demoEnvironment = leer('src/environments/environment.demo.ts');
for (const flag of simulatedFlags) {
  exigir(new RegExp(`\\b${flag}:\\s*true\\b`).test(demoEnvironment), `demo: ${flag} debe estar encendido`);
}
exigir(reemplazoDe('demo') === 'src/environments/environment.demo.ts', 'demo debe reemplazar el entorno');
exigir(serve.configurations?.demo?.buildTarget === `${nombre}:build:development,demo`, 'serve demo debe combinar development,demo');
exigir(/ng serve --configuration development,demo\b/.test(scripts['start:demo'] ?? ''), 'start:demo debe usar development,demo');
exigir(serve.configurations?.demo?.proxyConfig === 'proxy.demo.conf.mjs', 'solo demo usa medios simulados');
exigir(serve.options?.proxyConfig === 'proxy.conf.mjs', 'el proxy por defecto es real');
const { default: realProxy } = await import('../proxy.conf.mjs');
const { default: demoProxy } = await import('../proxy.demo.conf.mjs');
exigir(!realProxy.some((entry) => entry.bypass !== undefined), 'API real no permite sustituciones de medios');
exigir(demoProxy[0]?.context?.includes('/public/media'), 'demo conserva medios sinteticos');
for (const mode of ['real-api', 'e2e-real']) {
  const config = build.configurations?.[mode] ?? {};
  exigir(reemplazoDe(mode) === `src/environments/environment.${mode}.ts`, `${mode}: reemplazo de entorno`);
  exigir(config.server === false && config.ssr === false && config.outputMode === 'static', `${mode}: conservar CSR`);
}
for (const mode of ['production', 'production-api']) {
  const initial = build.configurations?.[mode]?.budgets?.find((budget) => budget.type === 'initial');
  exigir(initial?.maximumError === '1.5MB', `${mode}: presupuesto inicial 1.5MB`);
}

/**
 * `production-api` (H1.S1, 2026-09-26): el build real, con SSR encendido.
 *
 * A diferencia de `real-api` —pensado para `ng serve` sin SSR—, esta
 * configuración tiene que mantener el renderizado en servidor y apagar, además
 * del mock, **las cuatro** demostraciones: contra la API real ninguna puede
 * fabricar datos que ningún backend respalda.
 */
const PRODUCTION_API = 'production-api';
const produccionApi = build.configurations?.[PRODUCTION_API] ?? {};
exigir(
  reemplazoDe(PRODUCTION_API) === 'src/environments/environment.production-api.ts',
  `build «${PRODUCTION_API}» tiene que reemplazar environment.ts por environment.production-api.ts`,
);
exigir(
  produccionApi.server !== false && produccionApi.ssr !== false,
  `build «${PRODUCTION_API}» tiene que mantener el SSR encendido (server/ssr distintos de false)`,
);
exigir(
  produccionApi.outputMode !== 'static',
  `build «${PRODUCTION_API}» no puede degradar a outputMode: static`,
);
const tunelesEnAllowedHosts = (host) => /\.(devtunnels\.ms|trycloudflare\.com|ngrok-free\.app|loca\.lt)$/.test(host);
exigir(
  !(produccionApi.security?.allowedHosts ?? []).some(tunelesEnAllowedHosts),
  `build «${PRODUCTION_API}» no puede declarar dominios de túneles en security.allowedHosts`,
);
const produccionApiEnv = leer('src/environments/environment.production-api.ts');
exigir(
  /mockBackend:\s*false/.test(produccionApiEnv),
  'environment.production-api.ts tiene que declarar mockBackend: false',
);
for (const demo of ['demoPresets', 'paymentDemo', 'loyaltyDemo', 'campaignsDemo']) {
  exigir(
    new RegExp(`\\b${demo}:\\s*false\\b`).test(produccionApiEnv),
    `environment.production-api.ts tiene que declarar ${demo}: false`,
  );
}

if (errores.length > 0) {
  console.error('[check-real-api-config] Configuración real-api inválida:');
  for (const error of errores) console.error(`  ✗ ${error}`);
  process.exit(1);
}
console.log('[check-real-api-config] PASS: API real por defecto, demo explicita y production-api con SSR.');
