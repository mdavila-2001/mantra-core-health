#!/usr/bin/env node
/**
 * Verifica que las tres declaraciones de los prefijos de la API digan lo mismo.
 *
 * La superficie de red de la aplicación son seis prefijos, y están escritos en
 * **tres lugares** que nadie mantiene a la par por sí solo:
 *
 * ```text
 * proxy.conf.json          el `yarn start` del host
 * proxy.conf.docker.json   el contenedor de desarrollo
 * deploy/api-locations.conf  el reverse proxy (referencia y despliegue)
 * ```
 *
 * No se pueden unificar: los dos primeros son configuración de un servidor de
 * desarrollo que no interpola nada, y el tercero es de otro programa entero.
 *
 * El modo de fallo que esto evita es el peor de todos: un módulo nuevo de la
 * API agregado en desarrollo y olvidado en producción **funciona en la máquina
 * de quien lo escribió** y devuelve el `index.html` de Angular en el servidor,
 * que no es JSON — así que sale como S9 «error inesperado» y nadie sospecha del
 * proxy.
 *
 * Uso: node scripts/check-api-prefixes.mjs
 */

import { join } from 'node:path';

import { exists, read, REPO_ROOT } from './lib/scan.mjs';

/** Los prefijos de un `proxy.conf*.json` de Angular. */
function desdeProxyJson(archivo) {
  const contexto = JSON.parse(read(join(REPO_ROOT, archivo)));
  return new Set(contexto.flatMap((entrada) => entrada.context ?? []));
}

/**
 * Los prefijos de las `location ^~ /x/` de nginx.
 *
 * Se normaliza la barra final: nginx la lleva —`location ^~ /iam/`— y el proxy
 * de Angular no —`"/iam"`—. Comparar sin normalizar daría seis diferencias
 * falsas y el verificador se volvería ruido.
 *
 * Admite prefijos de más de un segmento (`/admin/tenants`): son la salida
 * cuando el primer segmento solo sería ambiguo frente a una ruta de la
 * aplicación — `/admin` ya desvió `/administration/patients` una vez.
 */
function desdeNginx(archivo) {
  const conf = read(join(REPO_ROOT, archivo));
  const prefijos = new Set();
  // El punto entra en la clase de caracteres por `/socket.io`, que es un
  // prefijo real de la API y no un nombre de archivo.
  const location = /location\s+\^~\s+(\/[\w.-]+(?:\/[\w.-]+)*)\/?\s/g;

  let match;
  while ((match = location.exec(conf)) !== null) {
    prefijos.add(match[1]);
  }
  return prefijos;
}

const FUENTES = [
  { nombre: 'proxy.conf.json', leer: () => desdeProxyJson('proxy.conf.json') },
  { nombre: 'proxy.conf.docker.json', leer: () => desdeProxyJson('proxy.conf.docker.json') },
  // Dos archivos y no uno: la lista de la API se extrajo a `api-locations.conf`
  // para que el proxy de referencia y el del despliegue en Coolify la incluyan
  // los dos en vez de tener cada uno su copia, pero `/otel` sigue en
  // `nginx.conf` porque NO va a la API — va al servidor de renderizado. Se leen
  // juntos para comparar contra la misma superficie de antes.
  {
    nombre: 'deploy/api-locations.conf + nginx.conf',
    // `archivos` existe para esta entrada: la comprobación de existencia de
    // abajo mira rutas, y el nombre de esta fuente es una etiqueta para el
    // informe, no un archivo.
    archivos: ['deploy/api-locations.conf', 'deploy/nginx.conf'],
    leer: () =>
      new Set([
        ...desdeNginx('deploy/api-locations.conf'),
        ...desdeNginx('deploy/nginx.conf'),
      ]),
  },
];

const problemas = [];
const leidas = [];

for (const fuente of FUENTES) {
  const archivos = fuente.archivos ?? [fuente.nombre];
  const ausentes = archivos.filter((archivo) => !exists(join(REPO_ROOT, archivo)));
  if (ausentes.length > 0) {
    problemas.push(`falta ${ausentes.join(', ')}`);
    continue;
  }
  try {
    leidas.push({ ...fuente, prefijos: fuente.leer() });
  } catch (error) {
    problemas.push(`${fuente.nombre} no se pudo leer: ${String(error)}`);
  }
}

if (leidas.length > 1) {
  const [referencia, ...resto] = leidas;

  for (const otra of resto) {
    const faltan = [...referencia.prefijos].filter((p) => !otra.prefijos.has(p));
    const sobran = [...otra.prefijos].filter((p) => !referencia.prefijos.has(p));

    for (const prefijo of faltan) {
      problemas.push(`${otra.nombre} no declara «${prefijo}» (sí está en ${referencia.nombre})`);
    }
    for (const prefijo of sobran) {
      problemas.push(`${otra.nombre} declara «${prefijo}», que no está en ${referencia.nombre}`);
    }
  }
}

if (problemas.length > 0) {
  console.error('\n✗ check-api-prefixes\n');
  for (const problema of problemas) console.error(`  ${problema}`);
  console.error('');
  process.exit(1);
}

const prefijos = [...(leidas[0]?.prefijos ?? [])].sort();
console.log('✓ check-api-prefixes');
console.log(`  ${prefijos.length} prefijos, iguales en las ${leidas.length} fuentes`);
console.log(`  ${prefijos.join('  ')}`);
