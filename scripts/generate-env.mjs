/**
 * Generador del entorno público del navegador.
 *
 * Angular no lee `.env` al compilar: lo que el navegador ve sale de
 * `src/environments/`, que es código y se empaqueta tal cual. Este script es el
 * único puente entre las dos cosas — lee el entorno del proceso (y `.env` como
 * respaldo) y escribe `src/environments/env.generated.ts`, que los dos archivos
 * de entorno importan.
 *
 * El puente es deliberadamente angosto, y ese es todo el punto de seguridad:
 *
 *   1. Solo cruzan las claves del MANIFIESTO de abajo. El resto del `.env` no
 *      se lee, así que nada que aparezca ahí puede terminar en el paquete por
 *      descuido — ni hoy ni cuando alguien agregue una variable nueva.
 *   2. Toda clave del manifiesto pasa por `assertPublicName`: si el nombre
 *      huele a secreto (SECRET, PASSWORD, TOKEN, KEY…), el script falla en vez
 *      de generar. Protege del cambio futuro, que es cuando esto se rompe.
 *   3. Los valores se validan uno por uno. `PUBLIC_API_BASE_URL` con
 *      `usuario:contraseña@` embebidos, o un valor con pinta de JWT o de clave
 *      privada, aborta la generación.
 *   4. La salida está en `.gitignore`. Los valores de la máquina de cada quien
 *      no se pueden versionar por accidente, y los dos `environment*.ts` que sí
 *      viajan en el repo quedan sin ningún valor concreto adentro.
 *
 * Todo lo que este archivo escribe llega al navegador en texto plano. La regla
 * no es «cuidado con qué se pone acá»: es que acá **no hay** dónde poner un
 * secreto, porque un frontend no puede guardar ninguno.
 *
 * Se ejecuta encadenado en `start`, `build`, `watch` y `test` (package.json), y
 * en el arranque del contenedor (Dockerfile.dev). No hace falta llamarlo a
 * mano; `yarn env:generate` existe para inspeccionar el resultado.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `fileURLToPath` y NO `.pathname`: el pathname de una URL `file:` viene
 * percent-encoded y, en Windows, con una barra delante de la letra de unidad.
 * Con el repositorio en una carpeta con espacios —«Sistema Salud»— el espacio
 * llegaba como `%20` y el generador moría con `ENOENT … Sistema%20Salud`.
 */
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const ENV_FILE = join(REPO_ROOT, '.env');
const OUTPUT_FILE = join(REPO_ROOT, 'src/environments/env.generated.ts');

/**
 * Las únicas variables que cruzan al paquete del navegador.
 *
 * `key` es el nombre en el entorno, `field` el campo de `Environment`. Agregar
 * una entrada acá es la decisión de publicar ese valor a cualquiera que abra
 * las herramientas de desarrollo; el prefijo `PUBLIC_` está para que la
 * decisión se lea también desde el `.env`.
 *
 * `group` anida el campo bajo un objeto (`telemetry.enabled`). `literal` marca
 * los valores que no son texto —booleanos y números—, que se escriben sin
 * comillas para que TypeScript los tipe como corresponde.
 */
const MANIFEST = [
  {
    key: 'PUBLIC_API_BASE_URL',
    field: 'apiBaseUrl',
    validate: validateApiBaseUrl,
    // Nombre anterior, del `scripts/set-env.js` que este archivo reemplaza. Se
    // sigue aceptando para no romper los `.env` que ya lo tengan escrito, con
    // un aviso: el prefijo `PUBLIC_` existe para que se lea desde el propio
    // `.env` qué variables terminan publicadas en el navegador.
    legacyKey: 'API_BASE_URL',
  },

  // --- Telemetría ----------------------------------------------------------
  //
  // Ninguna de estas seis es un secreto, y no puede serlo: el endpoint de
  // trazas no lleva credencial. Lo protege el servidor —mismo origen, límite de
  // tamaño, límite de tasa—, no una clave que cualquiera leería del paquete.
  {
    key: 'PUBLIC_TELEMETRY_ENABLED',
    group: 'telemetry',
    field: 'enabled',
    literal: true,
    validate: validateBoolean,
  },
  {
    key: 'PUBLIC_TELEMETRY_SERVICE_NAME',
    group: 'telemetry',
    field: 'serviceName',
    validate: validateServiceName,
  },
  {
    key: 'PUBLIC_TELEMETRY_NAMESPACE',
    group: 'telemetry',
    field: 'namespace',
    validate: validateServiceName,
  },
  {
    key: 'PUBLIC_TELEMETRY_ENVIRONMENT',
    group: 'telemetry',
    field: 'environment',
    validate: validateServiceName,
  },
  {
    key: 'PUBLIC_TELEMETRY_TRACES_ENDPOINT',
    group: 'telemetry',
    field: 'tracesEndpoint',
    validate: validateTracesEndpoint,
  },
  {
    key: 'PUBLIC_TELEMETRY_SAMPLE_RATIO',
    group: 'telemetry',
    field: 'sampleRatio',
    literal: true,
    validate: validateRatio,
  },

  // --- Demostración ---------------------------------------------------------
  //
  // Enciende la barra de casos de demostración de la ficha clínica. No es un
  // secreto: solo decide si esa UI se pinta. Apagada en producción salvo
  // decisión explícita del despliegue (el default de desarrollo lo pone
  // `environment.development.ts`).
  {
    key: 'PUBLIC_DEMO_PRESETS',
    field: 'demoPresets',
    literal: true,
    validate: validateBoolean,
  },
];

/**
 * Nombres que no pueden publicarse. Se comparan contra las claves del
 * manifiesto, no contra el `.env`: el `.env` puede tener todos los secretos que
 * quiera —no se lee— y lo que hay que impedir es que alguien agregue uno al
 * manifiesto.
 */
const SECRET_LOOKING_NAME =
  /SECRET|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|TOKEN|APIKEY|API_KEY|_KEY$|SIGNATURE|SALT|SESSION|COOKIE/i;

/** Valores que delatan un secreto pegado por error: un JWT o una clave PEM. */
const SECRET_LOOKING_VALUE = /^eyJ[\w-]+\.[\w-]+\./ ;
const PEM_HEADER = '-----BEGIN';

function fail(message) {
  process.stderr.write(`\n[generate-env] ${message}\n\n`);
  process.exit(1);
}

/**
 * Lector de `.env` sin dependencias: `CLAVE=valor` por línea, comentarios con
 * `#`, comillas opcionales. No interpola ni expande nada — un `.env` no es un
 * script y tratarlo como tal es cómo se cuelan sorpresas.
 */
function parseDotEnv(text) {
  const values = new Map();

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim().replace(/^export\s+/, '');
    if (line === '' || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    const quoted = value.length >= 2 && (value.startsWith('"') || value.startsWith("'"));
    if (quoted && value.endsWith(value[0])) {
      value = value.slice(1, -1);
    } else {
      // Sin comillas, un `#` empieza un comentario al final de la línea.
      value = value.split(' #')[0].trim();
    }

    values.set(key, value);
  }

  return values;
}

/** Falla si el nombre de una clave del manifiesto promete un secreto. */
function assertPublicName(key) {
  if (SECRET_LOOKING_NAME.test(key)) {
    fail(
      `«${key}» no puede estar en el MANIFIESTO de scripts/generate-env.mjs.\n` +
        `El nombre indica un secreto, y todo lo que pasa por acá se empaqueta en\n` +
        `el JavaScript que descarga el navegador: sería público para cualquiera.\n` +
        `Un frontend no puede guardar secretos. Ese valor va del lado de la API.`,
    );
  }
}

/** Falla si el valor tiene forma de credencial, sin importar cómo se llame. */
function assertPublicValue(key, value) {
  if (SECRET_LOOKING_VALUE.test(value) || value.includes(PEM_HEADER)) {
    fail(
      `El valor de «${key}» tiene forma de credencial (JWT o clave PEM).\n` +
        `Este archivo se empaqueta para el navegador: no lleva secretos.`,
    );
  }
}

/**
 * Valida y normaliza la raíz de la API.
 *
 * Vacío es válido y es el valor habitual: significa rutas relativas, que
 * resuelve el proxy en desarrollo y el mismo origen en un despliegue.
 */
function validateApiBaseUrl(key, value) {
  if (value === '') return '';

  let url;
  try {
    url = new URL(value);
  } catch {
    return fail(
      `«${key}» debe ser una URL absoluta (https://api.ejemplo.com) o quedar vacía\n` +
        `para usar rutas relativas. Se recibió: ${value}`,
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`«${key}» debe usar http o https. Se recibió el esquema ${url.protocol}`);
  }

  if (url.username !== '' || url.password !== '') {
    fail(
      `«${key}» lleva credenciales embebidas en la URL (usuario:contraseña@).\n` +
        `Terminarían en el paquete del navegador y en cada petición del historial.\n` +
        `La autenticación va por cabecera, no en la raíz de la API.`,
    );
  }

  if (url.search !== '' || url.hash !== '') {
    fail(
      `«${key}» no puede llevar query ni fragmento: es una raíz, no una petición.\n` +
        `Se recibió: ${value}`,
    );
  }

  // Sin barra final: `apiUrl()` la agrega al unir (ver core/data-access/api.ts).
  return `${url.origin}${url.pathname}`.replace(/\/$/, '');
}

/** `true`/`1`/`yes` y sus contrarios. Cualquier otra cosa aborta. */
function validateBoolean(key, value) {
  const normalized = value.toLowerCase();
  if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) return true;
  if (['false', '0', 'no', ''].includes(normalized)) return false;

  return fail(
    `«${key}» debe ser true o false. Se recibió: ${value}\n` +
      `Un valor ambiguo acá decidiría en silencio si la telemetría se enciende.`,
  );
}

/**
 * Proporción de muestreo.
 *
 * Se valida acá y no en el navegador porque un ratio inválido en producción
 * significa una de dos cosas —cero trazas o el 100 % del tráfico— y las dos se
 * descubren tarde. Fallar en el build lo dice mientras alguien está mirando.
 */
function validateRatio(key, value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
    return fail(
      `«${key}» debe ser un número entre 0 y 1 (0.1 = el 10 % de las trazas).\n` +
        `Se recibió: ${value}`,
    );
  }
  return ratio;
}

/**
 * Nombre de servicio, espacio o entorno.
 *
 * Se acota a lo que un identificador de OpenTelemetry admite sin sorpresas. La
 * restricción real es otra: este valor se ve en el panel de Jaeger junto a cada
 * traza, así que no puede llevar nada de una persona ni de una organización.
 */
function validateServiceName(key, value) {
  if (!/^[a-z0-9][a-z0-9._-]{0,62}$/i.test(value)) {
    fail(
      `«${key}» solo admite letras, números, punto, guion y guion bajo\n` +
        `(hasta 63 caracteres). Se recibió: ${value}`,
    );
  }
  return value;
}

/**
 * Destino de las trazas.
 *
 * Lo esperado es una ruta relativa (`/otel/v1/traces`): mismo origen, sin CORS
 * y sin tocar la política de seguridad de contenido. Se admite una URL absoluta
 * para el caso de un subdominio propio de telemetría, con las mismas
 * prohibiciones que la raíz de la API — y con un aviso, porque exige abrir
 * `connect-src` y revisar el CORS del gateway.
 */
function validateTracesEndpoint(key, value) {
  if (value.startsWith('/')) return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    return fail(
      `«${key}» debe ser una ruta relativa (/otel/v1/traces) o una URL absoluta.\n` +
        `Se recibió: ${value}`,
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`«${key}» debe usar http o https. Se recibió el esquema ${url.protocol}`);
  }
  if (url.username !== '' || url.password !== '') {
    fail(
      `«${key}» lleva credenciales embebidas en la URL (usuario:contraseña@).\n` +
        `Terminarían en el paquete del navegador. El endpoint de trazas no se\n` +
        `autentica desde el cliente: lo protege el servidor.`,
    );
  }
  if (url.search !== '') {
    fail(`«${key}» no puede llevar query: una clave ahí sería pública. Se recibió: ${value}`);
  }

  process.stderr.write(
    `[generate-env] «${key}» apunta a otro origen (${url.origin}).\n` +
      `  Hay que abrir connect-src en src/server/security-headers.ts y permitir\n` +
      `  el CORS del gateway, o las trazas se bloquean sin aviso en el navegador.\n`,
  );

  return `${url.origin}${url.pathname}`;
}

/**
 * Identidad del artefacto: versión, commit y momento del build.
 *
 * No sale del `.env` ni del entorno, así que **no pasa por el manifiesto**: no
 * es configuración que alguien decida publicar, es la huella de lo que se está
 * construyendo. Por eso tampoco lleva rama, autor ni entorno — eso sí serían
 * datos de la organización viajando al navegador de cualquiera.
 *
 * El commit se lee de Git y cae en `'desconocido'` si el build no corre dentro
 * de un repositorio, que es el caso de una imagen construida desde un tarball.
 */
function readBuildInfo() {
  let version = '0.0.0';
  try {
    version = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')).version ?? version;
  } catch {
    // Sin manifiesto legible queda el valor por defecto.
  }

  let commit = 'desconocido';
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Fuera de un repositorio, o sin git instalado.
  }

  return { version, commit, builtAt: new Date().toISOString() };
}

/** `enabled: true,` precedido de su comentario, con la sangría pedida. */
function renderField({ field, value, key, literal }, indent) {
  const rendered = literal === true ? String(value) : JSON.stringify(value);
  return `${indent}/** Desde ${key}. */\n${indent}${field}: ${rendered},`;
}

function render(entries) {
  const lines = entries
    .filter((entry) => entry.group === undefined)
    .map((entry) => renderField(entry, '  '));

  /** Las entradas con `group`, anidadas bajo un objeto con ese nombre. */
  const grouped = new Map();
  for (const entry of entries) {
    if (entry.group === undefined) continue;
    grouped.set(entry.group, [...(grouped.get(entry.group) ?? []), entry]);
  }

  for (const [group, groupEntries] of grouped) {
    lines.push(
      `  ${group}: {`,
      ...groupEntries.map((entry) => renderField(entry, '    ')),
      '  },',
    );
  }

  const body = lines.length === 0 ? '' : `\n${lines.join('\n')}\n`;
  const build = readBuildInfo();

  return `/**
 * ARCHIVO GENERADO — no editar a mano, no versionar.
 *
 * Lo escribe \`scripts/generate-env.mjs\` a partir del entorno del proceso y de
 * \`.env\`, antes de cada \`start\`, \`build\`, \`watch\` y \`test\`. Cualquier cambio
 * hecho acá se pierde en la siguiente ejecución; lo que se edita es el \`.env\`.
 *
 * Solo trae las claves del manifiesto que estén definidas. Las que falten las
 * completa cada archivo de entorno con su valor por defecto, que es lo que hace
 * que el proyecto levante sin \`.env\`.
 *
 * Todo lo de acá viaja al navegador en texto plano: es configuración pública.
 */

import type { BuildInfo, EnvironmentOverrides } from './environment.types';

export const envFromProcess: EnvironmentOverrides = {${body}};

/**
 * Identidad de este artefacto. No sale del \`.env\`: es la huella del build.
 * Responde «qué código está corriendo», que es la primera pregunta de cualquier
 * incidente.
 */
export const buildInfo: BuildInfo = {
  version: ${JSON.stringify(build.version)},
  commit: ${JSON.stringify(build.commit)},
  builtAt: ${JSON.stringify(build.builtAt)},
};
`;
}

function main() {
  const fileValues = existsSync(ENV_FILE)
    ? parseDotEnv(readFileSync(ENV_FILE, 'utf8'))
    : new Map();

  const entries = [];

  for (const { key, field, group, literal, validate, legacyKey } of MANIFEST) {
    assertPublicName(key);

    // El entorno del proceso gana al `.env`: es lo que inyecta docker-compose y
    // lo que usa un despliegue, donde no hay archivo.
    const read = (name) => process.env[name] ?? fileValues.get(name);

    let usedKey = key;
    let raw = read(key);

    if (raw === undefined && legacyKey !== undefined) {
      raw = read(legacyKey);
      if (raw !== undefined) {
        usedKey = legacyKey;
        process.stderr.write(
          `[generate-env] «${legacyKey}» está en desuso: renombrala a «${key}» en tu .env.\n`,
        );
      }
    }

    if (raw === undefined) continue;

    const value = raw.trim();
    assertPublicValue(usedKey, value);
    entries.push({ key: usedKey, field, group, literal, value: validate(usedKey, value) });
  }

  const output = render(entries);

  // Solo se escribe si cambió: el archivo está bajo el ojo del compilador en
  // modo watch y reescribirlo igual dispararía una recompilación por orden.
  const current = existsSync(OUTPUT_FILE) ? readFileSync(OUTPUT_FILE, 'utf8') : null;
  if (current === output) {
    process.stdout.write('[generate-env] sin cambios en src/environments/env.generated.ts\n');
    return;
  }

  writeFileSync(OUTPUT_FILE, output, 'utf8');

  const summary =
    entries.length === 0
      ? 'sin variables definidas (se usan los valores por defecto)'
      : entries.map(({ key, value }) => `${key}=${value === '' ? '(vacío)' : value}`).join(', ');

  process.stdout.write(`[generate-env] src/environments/env.generated.ts · ${summary}\n`);
}

main();
