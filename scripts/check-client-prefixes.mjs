#!/usr/bin/env node
/**
 * Verifica que **toda** llamada de `core/data-access` caiga en un prefijo que el
 * proxy enrute hacia la API.
 *
 * ## El defecto que esto impide
 *
 * `check-api-prefixes.mjs` comprueba que las tres declaraciones digan **lo
 * mismo**; ninguna comprobaba que digan **lo suficiente**. Un cliente nuevo con
 * un prefijo que no está en ninguna de las tres compila, pasa sus pruebas
 * unitarias —que doblan `HttpClient` y nunca salen a la red— y falla sólo
 * cuando alguien abre la pantalla.
 *
 * Y falla de la peor manera: el servidor de desarrollo devuelve el `index.html`
 * de Angular con **200**, así que el cliente no ve un error de red sino un JSON
 * inválido. Sale como «error inesperado» y nadie mira el proxy.
 *
 * Medido el 2026-08-17 antes de existir este archivo: **39 operaciones de 258**
 * quedaban sin rutear, entre ellas las 27 del muro social —que ya estaba
 * integrado en `dev`—, el catálogo de servicios, las aseguradoras, el laboratorio
 * y las interacciones medicamentosas. Ninguna prueba lo denunciaba.
 *
 * ## Qué compara
 *
 * Los endpoints que `scanEndpoints()` extrae de `*.client.ts` —la misma fuente
 * que ya alimenta el inventario— contra los prefijos de `proxy.conf.json`. Un
 * endpoint está ruteado si algún prefijo es su ruta entera o su comienzo hasta
 * un separador: `/community` cubre `/community/posts`, y `/admin/tenants` no
 * cubre `/administration/patients`, que es justamente la distinción que el
 * proxy hace y por la que los prefijos de dos segmentos existen.
 *
 * Uso: node scripts/check-client-prefixes.mjs
 */

import { join } from 'node:path';

import { read, REPO_ROOT, scanEndpoints } from './lib/scan.mjs';

/** Los prefijos del bloque de la API; `/otel` va al colector, no al backend. */
function prefijosDeLaApi() {
  const bloques = JSON.parse(read(join(REPO_ROOT, 'proxy.conf.json')));
  return bloques
    .filter((bloque) => !(bloque.context ?? []).includes('/otel'))
    .flatMap((bloque) => bloque.context ?? []);
}

/** `true` si el prefijo enruta ese endpoint, con el mismo criterio que el proxy. */
function enruta(prefijo, endpoint) {
  return endpoint === prefijo || endpoint.startsWith(`${prefijo}/`);
}

const prefijos = prefijosDeLaApi();
const operaciones = scanEndpoints();
const huerfanas = operaciones.filter(
  (operacion) => !prefijos.some((prefijo) => enruta(prefijo, operacion.endpoint)),
);

if (huerfanas.length > 0) {
  console.error(`\n✗ check-client-prefixes — ${huerfanas.length} operación(es) sin rutear\n`);

  const porCliente = new Map();
  for (const operacion of huerfanas) {
    const lista = porCliente.get(operacion.client) ?? [];
    lista.push(`${operacion.method} ${operacion.endpoint}`);
    porCliente.set(operacion.client, lista);
  }
  for (const [cliente, llamadas] of [...porCliente].sort()) {
    console.error(`  ${cliente} (${llamadas.length})`);
    for (const llamada of llamadas.sort()) console.error(`      ${llamada}`);
  }

  console.error(
    '\n  El servidor de desarrollo responde estas rutas con el index.html de\n' +
      '  Angular y un 200: el cliente recibe HTML donde espera JSON. Agregá el\n' +
      '  prefijo a las TRES declaraciones (proxy.conf.json, proxy.conf.docker.json\n' +
      '  y deploy/nginx.conf) y comprobá que no se coma una ruta del router.\n',
  );
  process.exit(1);
}

console.log('✓ check-client-prefixes');
console.log(
  `  ${operaciones.length} operaciones de core/data-access, todas cubiertas por los ${prefijos.length} prefijos`,
);
