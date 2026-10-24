#!/usr/bin/env node
/**
 * Genera el padrón de universidades por país que alimenta los desplegables
 * «País de estudio» y «Universidad» del alta de profesionales.
 *
 * ## Por qué existe
 *
 * El propietario pidió (02/10/2026) que universidad y país de estudio dejaran de
 * ser texto libre y fueran desplegables **poblados con datos**, en forma de
 * árbol: se elige el país y la lista de universidades se acota a ese país.
 * Hasta acá sólo había una lista curada a mano de universidades bolivianas
 * (`src/app/core/profesion/instituciones-educativas.ts`), y la regla de datos
 * del proyecto pide no hardcodear un padrón sin dataset ni estrategia de
 * importación. Esto es la estrategia de importación.
 *
 * ## La fuente
 *
 * `Hipo/university-domains-list` (MIT): ~10 300 universidades de 200 países,
 * con nombre, país e ISO alpha-2. Se lee **fijada a un commit** para que dos
 * corridas den el mismo fichero; subir la versión es cambiar `COMMIT` y volver a
 * correr. El JSON (2,2 MB) no se versiona: se descarga a `data/universidades/`
 * si no está, y esa carpeta está en `.gitignore`.
 *
 * ## Qué se transforma y qué no
 *
 * - **Bolivia se omite a propósito.** La lista boliviana sigue siendo la curada
 *   (Sistema de la Universidad Boliviana + privadas autorizadas): es la regla
 *   del propietario del 13/09/2026 —«catalogadas como autorizadas»— y la fuente
 *   externa trae variantes duplicadas («Universidad Católica Boliviana, La Paz»
 *   cuatro veces). La composición vive en `universidades-por-pais.ts`.
 * - Los nombres se recortan y se deduplican por igualdad exacta dentro de cada
 *   país; **no se corrigen ni se traducen**: lo que viaja al backend es el
 *   nombre tal cual, en `issuingInstitutionText`.
 * - El nombre del país sale de `Intl.DisplayNames` en español, con el Node que
 *   corre esto (ICU completo desde Node 13). Los países se ordenan por ese
 *   nombre, y las universidades por nombre, ambos con cotejo español.
 *
 * Uso: node scripts/gen-universidades-por-pais.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const COMMIT = '603e10f51b67c6553b9bca9aecc0db4c2417ed10';
const URL_FUENTE = `https://raw.githubusercontent.com/Hipo/university-domains-list/${COMMIT}/world_universities_and_domains.json`;
const FUENTE_LOCAL = resolve(raiz, 'data/universidades', `world_universities_and_domains.${COMMIT.slice(0, 7)}.json`);
const DESTINO = resolve(raiz, 'src/app/core/profesion/universidades-por-pais.generated.ts');
/**
 * Las ciudades de cada universidad, de Wikidata (CC0), que deja en caché
 * `gen-ciudades-de-universidades.mjs`. Opcional: sin la caché el padrón sale
 * igual, sin ciudades, y el desplegable de ciudad queda vacío y bloqueado.
 */
const CIUDADES = resolve(raiz, 'data/universidades/wikidata-ciudades.json');

/** Países que NO se importan: Bolivia tiene su lista curada. */
const OMITIDOS = new Set(['BO']);

async function fuente() {
  if (!existsSync(FUENTE_LOCAL)) {
    mkdirSync(dirname(FUENTE_LOCAL), { recursive: true });
    const respuesta = await fetch(URL_FUENTE);
    if (!respuesta.ok) {
      throw new Error(`No se pudo descargar la fuente: HTTP ${respuesta.status}`);
    }
    writeFileSync(FUENTE_LOCAL, await respuesta.text());
  }
  return JSON.parse(readFileSync(FUENTE_LOCAL, 'utf8'));
}

const cotejo = new Intl.Collator('es', { sensitivity: 'base' });
const ciudades = existsSync(CIUDADES) ? JSON.parse(readFileSync(CIUDADES, 'utf8')).paises : {};
const nombresDePais = new Intl.DisplayNames(['es'], { type: 'region' });

const porIso = new Map();
let totalFuente = 0;
for (const fila of await fuente()) {
  totalFuente += 1;
  const iso = String(fila.alpha_two_code ?? '').toUpperCase();
  const nombre = String(fila.name ?? '').trim();
  if (!/^[A-Z]{2}$/.test(iso) || OMITIDOS.has(iso) || nombre === '') continue;
  if (!porIso.has(iso)) porIso.set(iso, new Set());
  porIso.get(iso).add(nombre);
}

const paises = [...porIso.entries()]
  .map(([iso, universidades]) => ({
    iso,
    nombre: nombresDePais.of(iso) ?? iso,
    universidades: [...universidades].sort(cotejo.compare),
    ciudades: ciudades[iso] ?? {},
  }))
  .filter((pais) => pais.nombre !== pais.iso)
  .sort((a, b) => cotejo.compare(a.nombre, b.nombre));

const totalUniversidades = paises.reduce((suma, pais) => suma + pais.universidades.length, 0);
const totalConCiudad = paises.reduce(
  (suma, pais) => suma + pais.universidades.filter((u) => pais.ciudades[u]?.length).length,
  0,
);

const literal = (texto) => JSON.stringify(texto).replace(/'/g, "\\'").replace(/^"|"$/g, "'").replace(/\\"/g, '"');

const lineas = [
  '/* ============================================================================',
  '    Universidades por país, para los desplegables de «dónde lo estudiaste».',
  '',
  '    **GENERADO por `scripts/gen-universidades-por-pais.mjs`. No editar a mano.**',
  `    Fuente: Hipo/university-domains-list @ ${COMMIT.slice(0, 7)} (MIT),`,
  `    ${totalFuente} filas → ${paises.length} países · ${totalUniversidades} universidades.`,
  `    Ciudades: Wikidata (CC0), cruzadas por dominio web; ${totalConCiudad} universidades con ciudad.`,
  '',
  '    Bolivia NO está acá: su lista es la curada de `instituciones-educativas.ts`',
  '    y la composición de ambas vive en `universidades-por-pais.ts`, que es lo que',
  '    importan las pantallas. Nadie importa este fichero directamente.',
  '   ========================================================================== */',
  '',
  '/** Un país con las universidades que la fuente le atribuye, ya ordenadas. */',
  'export interface PaisGenerado {',
  '  /** ISO 3166-1 alpha-2, como lo trae la fuente. */',
  '  readonly iso: string;',
  '  /** El nombre en español, de `Intl.DisplayNames` al generar. */',
  '  readonly nombre: string;',
  '  readonly universidades: readonly string[];',
  '  /** Las ciudades de cada universidad que Wikidata conoce, por nombre. */',
  '  readonly ciudades?: Readonly<Record<string, readonly string[]>>;',
  '}',
  '',
  'export const PAISES_GENERADOS: readonly PaisGenerado[] = [',
];
for (const pais of paises) {
  lineas.push(`  {`, `    iso: '${pais.iso}',`, `    nombre: ${literal(pais.nombre)},`, `    universidades: [`);
  for (const universidad of pais.universidades) lineas.push(`      ${literal(universidad)},`);
  lineas.push(`    ],`);
  const conCiudad = pais.universidades.filter((u) => pais.ciudades[u]?.length);
  if (conCiudad.length > 0) {
    lineas.push(`    ciudades: {`);
    for (const universidad of conCiudad) {
      lineas.push(`      ${literal(universidad)}: [${pais.ciudades[universidad].map(literal).join(', ')}],`);
    }
    lineas.push(`    },`);
  }
  lineas.push(`  },`);
}
lineas.push('];', '');

writeFileSync(DESTINO, lineas.join('\n'));
console.log(
  `· gen-universidades-por-pais — ${paises.length} países, ${totalUniversidades} universidades → ${DESTINO.replace(raiz + '/', '')}`,
);
