#!/usr/bin/env node
/**
 * Verifica que ningún identificador NUEVO del diff esté en castellano.
 *
 * ## Qué regla hace cumplir
 *
 * La regla 29 (transversal a los 36 carriles): toda ruta, identificador,
 * variable, columna, endpoint, clase y archivo **nuevo o tocado** va en
 * inglés; la prosa visible —comentarios, mensajes de toast, nombres de
 * `it('…')`, `aria-label`— sigue en castellano rioplatense. Por eso este
 * verificador NO mira cualquier string: mira sólo las formas que declaran un
 * identificador (`const`, `class`, `interface`…), un `data-testid` o una ruta
 * de router. Mirar todo el árbol de código sería mirar años de identificadores
 * en castellano que este carril no migra (`persistir()`, `claveDe()`,
 * `ahora()` de `cart.store.ts` son un ejemplo real, y no son de este diff).
 *
 * ## Por qué sobre el diff y no sobre el árbol
 *
 * Corriendo sobre el árbol completo, este mismo repo fallaría en cientos de
 * archivos preexistentes. El criterio de aceptación es literal: sobre el
 * árbol actual (sin diff que mirar), el verificador **no reporta nada viejo**.
 * Sólo lo que el diff agrega puede fallar.
 *
 * ## Cómo resuelve la base del diff
 *
 * 1. `CHECK_ENGLISH_BASE`, si está seteada (CI la fija a la rama base real:
 *    `github.event.pull_request.base.sha` en un PR, `github.event.before` en
 *    un push).
 * 2. Si no, `origin/test` — la rama de integración de este esfuerzo.
 * 3. Si ninguna resuelve (clon superficial sin ese ref, o corrida local sin
 *    remoto), no hay diff que comparar: se lo dice y sale en `0`. Es la misma
 *    postura defensiva que `seed:datasets:check` — sin datos no es una
 *    violación, es no poder comprobar.
 *
 * Uso: `node scripts/check-english-identifiers.mjs`
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');

/**
 * Identificadores del manual REDSAT que nombran un concepto de diseño, no una
 * palabra suelta en castellano («firma», «cifras tabulares»). Se quedan.
 *
 * `MantraRadius.firma` y `MantraTypography.cifrasTabulares` son de la app
 * Flutter (`mantra_core_health_mobile/lib/theme/`); se declaran igual acá
 * porque la regla 29 es transversal y este es el único verificador que la
 * hace cumplir con código — si el chequeo se replica en el repo móvil, la
 * lista es la misma.
 */
const EXCEPCIONES_REDSAT = new Set(['firma', 'cifrastabulares']);

/**
 * Palabras function-word del castellano: nunca aparecen en un identificador
 * en inglés, así que son una señal de alta precisión y bajo falso positivo.
 * Deliberadamente chica — un identificador real cae en alguna de estas casi
 * siempre (preposición, artículo o palabra de dominio muy repetida) — y sin
 * palabras ambiguas que también sean inglés o un término técnico neutro.
 */
const STOPWORDS_ES = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'unos', 'unas',
  'con', 'sin', 'para', 'por', 'que', 'como', 'donde', 'cuando', 'cual',
  'segun', 'según', 'sobre', 'entre', 'hacia', 'desde', 'hasta', 'nuevo',
  'nueva', 'nuevos', 'nuevas', 'usuario', 'usuaria', 'cliente', 'direccion',
  'dirección', 'telefono', 'teléfono', 'fecha', 'nombre', 'apellido',
  'correo', 'contrasena', 'contraseña', 'numero', 'número', 'codigo',
  'código', 'pedido', 'carrito', 'sesion', 'sesión', 'cuenta', 'perfil',
  'organizacion', 'organización', 'paciente', 'medico', 'médico', 'turno',
  'agenda', 'receta', 'seguro', 'aseguradora', 'estado', 'motivo', 'razon',
  'razón',
]);

/** Patrones de línea que declaran un identificador que la regla cubre. */
const PATRONES_IDENTIFICADOR = [
  // const/let/var/function/class/interface/type/enum Nombre
  /\b(?:const|let|var|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  // data-testid="algo" en plantillas
  /data-testid\s*=\s*["']([^"']+)["']/g,
  // path: 'ruta' de rutas del router
  /\bpath:\s*['"]([^'"]*)['"]/g,
];

function ejecutar(comando, args) {
  try {
    return execFileSync(comando, args, { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (error) {
    return { error };
  }
}

/** El ref contra el que comparar, o `null` si ninguno resuelve. */
function resolverBase() {
  const candidatos = [process.env.CHECK_ENGLISH_BASE, 'origin/test'].filter(
    (ref) => typeof ref === 'string' && ref.length > 0,
  );

  for (const ref of candidatos) {
    const salida = ejecutar('git', ['rev-parse', '--verify', ref]);
    if (typeof salida === 'string') return ref;
  }
  return null;
}

/** Nombre de archivo nuevo/tocado → sub-palabras candidatas a revisar. */
function palabrasDeRuta(ruta) {
  const base = ruta.split('/').at(-1) ?? ruta;
  return base.replace(/\.[^.]+$/, '');
}

/** Separa un identificador camelCase/PascalCase/kebab/snake en sub-palabras. */
function subpalabras(identificador) {
  return identificador
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .map((palabra) => palabra.toLowerCase())
    .filter((palabra) => palabra.length > 0);
}

const ACENTOS_ES = /[áéíóúñüÁÉÍÓÚÑÜ]/;

/** `null` si el identificador pasa; el motivo textual si no. */
function motivoSiEsCastellano(identificador) {
  const palabras = subpalabras(identificador);
  for (const palabra of palabras) {
    if (EXCEPCIONES_REDSAT.has(palabra)) continue;
    if (ACENTOS_ES.test(palabra)) return `«${palabra}» lleva tilde/ñ española`;
    if (STOPWORDS_ES.has(palabra)) return `«${palabra}» es una palabra del castellano`;
  }
  return null;
}

/** Líneas agregadas (`+…`, sin el `+++` de cabecera) de un diff unificado, por archivo. */
function lineasAgregadasPorArchivo(diff) {
  const porArchivo = new Map();
  let archivoActual = null;

  for (const linea of diff.split('\n')) {
    if (linea.startsWith('+++ b/')) {
      archivoActual = linea.slice('+++ b/'.length);
      if (!porArchivo.has(archivoActual)) porArchivo.set(archivoActual, []);
      continue;
    }
    if (linea.startsWith('+++') || linea.startsWith('---')) continue;
    if (linea.startsWith('+') && archivoActual !== null) {
      porArchivo.get(archivoActual).push(linea.slice(1));
    }
  }
  return porArchivo;
}

/** Archivos nuevos del diff (estado `A`), para revisar también el nombre de ruta. */
function archivosNuevos(base) {
  const salida = ejecutar('git', ['diff', '--name-status', `${base}...HEAD`]);
  if (typeof salida !== 'string') return [];
  return salida
    .split('\n')
    .filter((linea) => linea.startsWith('A\t'))
    .map((linea) => linea.slice(2).trim());
}

function main() {
  const base = resolverBase();
  const hallazgos = [];

  if (base === null) {
    console.log(
      'check-english-identifiers: no hay una base de diff resoluble ' +
        '(ni CHECK_ENGLISH_BASE ni origin/test). Sin diff, no se reporta ' +
        'nada del árbol existente.',
    );
    process.exit(0);
  }

  const diff = ejecutar('git', [
    'diff',
    '--unified=0',
    `${base}...HEAD`,
    '--',
    '*.ts',
    '*.html',
  ]);

  if (typeof diff !== 'string') {
    console.log(`check-english-identifiers: no se pudo diffear contra "${base}"; se omite.`);
    process.exit(0);
  }

  const porArchivo = lineasAgregadasPorArchivo(diff);
  for (const [archivo, lineas] of porArchivo) {
    lineas.forEach((linea, indice) => {
      for (const patron of PATRONES_IDENTIFICADOR) {
        for (const coincidencia of linea.matchAll(patron)) {
          const identificador = coincidencia[1];
          if (identificador === undefined || identificador === '') continue;
          const motivo = motivoSiEsCastellano(identificador);
          if (motivo !== null) {
            hallazgos.push({ archivo, linea: indice + 1, identificador, motivo, texto: linea.trim() });
          }
        }
      }
    });
  }

  for (const ruta of archivosNuevos(base)) {
    const motivo = motivoSiEsCastellano(palabrasDeRuta(ruta));
    if (motivo !== null) {
      hallazgos.push({ archivo: ruta, linea: 0, identificador: palabrasDeRuta(ruta), motivo, texto: '(nombre de archivo)' });
    }
  }

  if (hallazgos.length === 0) {
    console.log(`check-english-identifiers: OK — sin identificadores nuevos en castellano contra "${base}".`);
    process.exit(0);
  }

  console.log(`check-english-identifiers: ${hallazgos.length} identificador(es) nuevo(s) en castellano.`);
  for (const hallazgo of hallazgos) {
    const ubicacion = hallazgo.linea > 0 ? `${hallazgo.archivo}:${hallazgo.linea}` : hallazgo.archivo;
    console.log(`  ${ubicacion} — "${hallazgo.identificador}" (${hallazgo.motivo})`);
    console.log(`    ${hallazgo.texto}`);
  }
  process.exit(1);
}

main();
