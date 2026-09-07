#!/usr/bin/env node
/* ============================================================================
    El inventario de componentes que consume la vista «stock de componentes».

    Se genera en tiempo de compilación y no en el navegador por dos motivos:

      1. En el navegador no hay fuentes. Los `input()`, los `imports: []` y los
         selectores de la plantilla sólo existen en el `.ts`; una vez compilado
         quedan metadatos internos de Angular que no son API pública.
      2. El archivo que sale de aquí lleva un `import()` por componente, así que
         **nada** entra en el paquete inicial: cada ficha carga su componente
         cuando se abre, y sólo ése.

    El escaneo es por expresiones regulares sobre el texto, sin compilar
    TypeScript. Es el mismo estilo —y las mismas limitaciones— que
    `audit-design-views.mjs`, que lleva meses en CI: rápido, sin dependencias, y
    equivocándose sólo en construcciones que este repositorio no usa.

    Uso:
      node scripts/generate-component-index.mjs           escribe el índice
      node scripts/generate-component-index.mjs --check   falla si está viejo
    ========================================================================== */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { read, repoPath, SRC_ROOT, walk } from './lib/scan.mjs';

const SALIDA = 'src/app/features/component-stock/component-index.generated.ts';

/* ---- alias de tipos -------------------------------------------------------
   `variant = input<BadgeVariant>('neutral')` no dice nada por sí solo: hay que
   ir a `badge.types.ts` para saber que `BadgeVariant` es
   `'neutral' | 'info' | 'success' | ...`. Sin resolverlo, la ficha no puede
   generar un valor y el componente se monta desnudo, que es justo lo que no
   sirve. Con el alias resuelto, cada entrada de unión recibe una de sus ramas
   —nunca un texto inventado que el componente no sabría pintar—. */

const ALIAS = new Map();
const CONSTANTES = new Map();

for (const file of walk(SRC_ROOT, ['.ts'])) {
  const source = read(file);

  // 1. `export const BADGE_SIZES = ['sm', 'md', 'lg'] as const;`
  for (const m of source.matchAll(/export const (\w+)\s*=\s*\[([^\]]*)\]\s*as const/g)) {
    const valores = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);
    if (valores.length > 0) CONSTANTES.set(m[1], valores);
  }

  // 2. `export type BadgeSize = (typeof BADGE_SIZES)[number];` y las uniones
  //    escritas a mano.
  for (const m of source.matchAll(/export type (\w+)\s*=\s*([^;]+);/g)) {
    ALIAS.set(m[1], m[2].replace(/\s+/g, ' ').trim());
  }

  // 3. `export type { Tone as BadgeVariant } from '../../tone/tone.types';`
  //    El sistema reexporta media docena de tipos así; sin seguir el renombre,
  //    los tonos de Badge, Chip y Alert se quedan sin resolver.
  for (const m of source.matchAll(/export type \{([^}]+)\}\s*from/g)) {
    for (const parte of m[1].split(',')) {
      const renombre = /(\w+)\s+as\s+(\w+)/.exec(parte);
      if (renombre !== null) ALIAS.set(renombre[2], renombre[1]);
    }
  }
  for (const m of source.matchAll(/export \{([^}]+)\}\s*from/g)) {
    for (const parte of m[1].split(',')) {
      const renombre = /(\w+)\s+as\s+(\w+)/.exec(parte);
      if (renombre !== null && !CONSTANTES.has(renombre[2])) {
        ALIAS.set(`const:${renombre[2]}`, renombre[1]);
      }
    }
  }
}

/** Las ramas de un tipo, siguiendo alias, reexportes y `as const`. */
function unionDe(nombre, visitados = new Set()) {
  if (visitados.has(nombre)) return null;
  visitados.add(nombre);

  const constante = CONSTANTES.get(nombre) ?? CONSTANTES.get(ALIAS.get(`const:${nombre}`) ?? '');
  if (constante !== undefined) return constante;

  const definicion = ALIAS.get(nombre);
  if (definicion === undefined) return null;

  const porTypeof = /^\(typeof (\w+)\)\[number\]$/.exec(definicion);
  if (porTypeof !== null) {
    return (
      CONSTANTES.get(porTypeof[1]) ??
      CONSTANTES.get(ALIAS.get(`const:${porTypeof[1]}`) ?? '') ??
      unionDe(porTypeof[1], visitados)
    );
  }

  if (definicion.includes("'")) {
    return [...definicion.matchAll(/'([^']*)'/g)].map((x) => x[1]);
  }

  if (/^\w+$/.test(definicion)) return unionDe(definicion, visitados);

  return null;
}

/** Sustituye el alias por la unión que representa, cuando la hay. */
function resolverTipo(tipo) {
  const limpio = tipo.trim();

  const directo = unionDe(limpio);
  if (directo !== null) return directo.map((v) => `'${v}'`).join(' | ');

  const nulable = /^(\w+)\s*\|\s*null$/.exec(limpio);
  if (nulable !== null) {
    const ramas = unionDe(nulable[1]);
    if (ramas !== null) return `${ramas.map((v) => `'${v}'`).join(' | ')} | null`;
  }

  // `readonly Foo[]` se deja como está: el valor lo decide el nombre de la
  // entrada, no las ramas de `Foo`.
  return limpio;
}

/* ---- extracción ----------------------------------------------------------- */

/** El nivel del sistema de diseño al que pertenece un archivo. */
function nivelDe(path) {
  if (path.includes('/shared/components/atoms/')) return 'atomo';
  if (path.includes('/shared/components/molecules/')) return 'molecula';
  if (path.includes('/shared/components/organisms/')) return 'organismo';
  if (path.includes('/features/alovida/')) return 'maqueta';
  if (path.includes('/features/')) return 'pantalla';
  return 'otro';
}

/**
 * Los `input()` con su tipo y si son obligatorios.
 *
 * `scanComponents()` de `lib/scan.mjs` devuelve sólo los nombres, que para un
 * inventario bastan pero no para **generar un valor**: sin el tipo no se sabe
 * si hay que pasar un texto, un número o un arreglo de opciones.
 */
function entradas(source) {
  const salida = [];
  const patron =
    /readonly\s+(\w+)\s*=\s*input(\.required)?\s*(?:<([^>]*(?:<[^>]*>)?[^>]*)>)?\s*\(([^;]*)\)/g;
  let m;
  while ((m = patron.exec(source)) !== null) {
    const [, nombre, requerido, tipo, argumentos] = m;
    const alias = /alias:\s*'([^']+)'/.exec(argumentos ?? '')?.[1];
    salida.push({
      nombre,
      alias: alias ?? null,
      tipo: resolverTipo((tipo ?? '').trim() || inferirTipoDelValor(argumentos ?? '')),
      requerido: requerido !== undefined,
    });
  }
  return salida;
}

/** Cuando el input no declara tipo, se deduce del valor por omisión. */
function inferirTipoDelValor(argumentos) {
  const valor = argumentos.split(',')[0]?.trim() ?? '';
  if (valor === '' ) return 'unknown';
  if (valor === 'true' || valor === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(valor)) return 'number';
  if (/^['"`]/.test(valor)) return 'string';
  if (valor.startsWith('[')) return 'unknown[]';
  return 'unknown';
}

function salidas(source) {
  const nombres = [];
  const patron = /readonly\s+(\w+)\s*=\s*output\s*(?:<([^>]*)>)?\s*\(/g;
  let m;
  while ((m = patron.exec(source)) !== null) nombres.push(m[1]);
  return nombres;
}

/** Las clases del array `imports: [...]` del decorador. */
function importados(source) {
  const bloque = /imports:\s*\[([\s\S]*?)\]/.exec(source)?.[1];
  if (bloque === undefined) return [];
  return bloque
    .split(',')
    .map((x) => x.replace(/\/\/.*$/gm, '').trim())
    .filter((x) => /^[A-Z]\w*$/.test(x));
}

/** Los selectores que la plantilla usa de verdad. */
function selectoresDeLaPlantilla(file, source) {
  const inline = /template:\s*`([\s\S]*?)`/.exec(source)?.[1];
  const htmlFile = file.replace(/\.ts$/, '.html');
  const html = inline ?? (existsSync(htmlFile) ? readFileSync(htmlFile, 'utf8') : '');
  const usados = new Set();
  for (const m of html.matchAll(/<(app-[\w-]+)/g)) usados.add(m[1]);
  for (const m of html.matchAll(/\[?(appTooltip|appMenuTrigger|appTutorialTarget|appCampoPersonalizado)\]?/g)) {
    usados.add(m[1]);
  }
  return [...usados];
}

/** Los clientes de `core/data-access` que el componente inyecta. */
function clientes(source) {
  const nombres = new Set();
  for (const m of source.matchAll(/inject\((\w*Client)\)/g)) nombres.add(m[1]);
  return [...nombres];
}

/** Los parámetros genéricos de la clase: `DataTable<Row>` no se instancia igual. */
function genericos(source) {
  return /export class \w+\s*<([^>]+)>/.exec(source)?.[1]?.trim() ?? null;
}

/* ---- problemas detectables sin ejecutar nada ------------------------------ */

function problemasEstaticos(componente, source, indice) {
  const problemas = [];

  const declarados = new Set(componente.importa);
  const porSelector = new Map(indice.map((c) => [c.selector, c.clase]));
  for (const selector of componente.selectoresEnPlantilla) {
    const clase = porSelector.get(selector);
    if (clase !== undefined && !declarados.has(clase)) {
      problemas.push({
        tipo: 'selector-no-importado',
        detalle: `la plantilla usa <${selector}> pero ${clase} no está en imports: la directiva no hace nada`,
      });
    }
  }

  if (!componente.tieneSpec && componente.nivel !== 'maqueta') {
    problemas.push({ tipo: 'sin-prueba', detalle: 'no tiene archivo .spec.ts' });
  }

  for (const entrada of componente.entradas) {
    if (entrada.requerido && entrada.tipo === 'unknown') {
      problemas.push({
        tipo: 'entrada-sin-tipo',
        detalle: `${entrada.nombre} es obligatoria y no declara tipo`,
      });
    }
  }

  if (/console\.(log|debug)\(/.test(source)) {
    problemas.push({ tipo: 'console', detalle: 'deja rastros de console.log en el código' });
  }
  const todo = /\b(TODO|FIXME)\b/.exec(source);
  if (todo !== null) problemas.push({ tipo: 'pendiente', detalle: `queda un ${todo[1]} sin resolver` });
  if (/_DE_MUESTRA|próximamente|en construcción/i.test(source)) {
    problemas.push({ tipo: 'de-muestra', detalle: 'contiene datos o texto de muestra' });
  }
  if (!componente.onPush) {
    problemas.push({ tipo: 'sin-onpush', detalle: 'no usa ChangeDetectionStrategy.OnPush' });
  }

  return problemas;
}

/* ---- el índice ------------------------------------------------------------ */

const archivos = walk(SRC_ROOT, ['.ts'])
  .filter((file) => !file.endsWith('.spec.ts'))
  .map((file) => ({ file, source: read(file) }))
  .filter(({ source }) => /@Component\(/.test(source));

const indice = archivos
  .map(({ file, source }) => {
    const path = repoPath(file);
    const clase = /export class (\w+)/.exec(source)?.[1] ?? '(sin clase)';
    return {
      clave: path.replace(/^src\/app\//, '').replace(/\.ts$/, ''),
      path,
      nivel: nivelDe(`/${path}`),
      clase,
      selector: /selector:\s*'([^']+)'/.exec(source)?.[1] ?? '(sin selector)',
      onPush: /ChangeDetectionStrategy\.OnPush/.test(source),
      generico: genericos(source),
      entradas: entradas(source),
      salidas: salidas(source),
      importa: importados(source),
      selectoresEnPlantilla: selectoresDeLaPlantilla(file, source),
      clientes: clientes(source),
      tieneSpec: existsSync(file.replace(/\.ts$/, '.spec.ts')),
      resumen: (/\/\*\*\s*\n\s*\*\s*(.+)/.exec(source)?.[1] ?? '').replace(/\s*\*\/\s*$/, '').trim(),
    };
  })
  .sort((a, b) => a.clave.localeCompare(b.clave));

// Composición: de qué nivel es cada clase importada.
const nivelPorClase = new Map(indice.map((c) => [c.clase, c.nivel]));
const clavePorClase = new Map(indice.map((c) => [c.clase, c.clave]));

for (const componente of indice) {
  const usa = { atomos: [], moleculas: [], organismos: [], otros: [] };
  for (const clase of componente.importa) {
    const nivel = nivelPorClase.get(clase);
    if (nivel === 'atomo') usa.atomos.push(clase);
    else if (nivel === 'molecula') usa.moleculas.push(clase);
    else if (nivel === 'organismo') usa.organismos.push(clase);
    else if (nivel !== undefined) usa.otros.push(clase);
  }
  componente.usa = usa;
  componente.problemas = problemasEstaticos(componente, read(join(SRC_ROOT, '..', componente.path)), indice);
}

// Quién usa a quién, al revés.
const usadoPor = new Map();
for (const componente of indice) {
  for (const clase of componente.importa) {
    if (!nivelPorClase.has(clase)) continue;
    const lista = usadoPor.get(clase) ?? [];
    lista.push(componente.clase);
    usadoPor.set(clase, lista);
  }
}
for (const componente of indice) {
  componente.usadoPor = (usadoPor.get(componente.clase) ?? []).sort();
}

/* ---- el archivo ----------------------------------------------------------- */

const destino = join(SRC_ROOT, '..', SALIDA);

/** La ruta relativa desde el archivo generado hasta el componente. */
function importDesdeElIndice(path) {
  const desde = dirname(destino);
  const hasta = join(SRC_ROOT, '..', path).replace(/\.ts$/, '');
  const relativa = relative(desde, hasta).split('\\').join('/');
  return relativa.startsWith('.') ? relativa : `./${relativa}`;
}

const entradasTs = indice
  .map((c) => {
    const datos = {
      clave: c.clave,
      nivel: c.nivel,
      clase: c.clase,
      selector: c.selector,
      path: c.path,
      resumen: c.resumen,
      generico: c.generico,
      entradas: c.entradas,
      salidas: c.salidas,
      usa: c.usa,
      usadoPor: c.usadoPor,
      clientes: c.clientes,
      tieneSpec: c.tieneSpec,
      problemas: c.problemas,
    };
    const json = JSON.stringify(datos, null, 2)
      .split('\n')
      .map((linea, i) => (i === 0 ? linea : `  ${linea}`))
      .join('\n');
    return `  {\n    ...${json},\n    cargar: () => import('${importDesdeElIndice(c.path)}').then((m) => m.${c.clase} as Type<unknown>),\n  },`;
  })
  .join('\n');

const contenido = `// GENERADO POR scripts/generate-component-index.mjs — NO EDITAR A MANO.
// Se regenera en cada \`yarn start\` y \`yarn build\`; está fuera de git.
import type { Type } from '@angular/core';

import type { ComponenteDelStock } from './component-stock.types';

/** Los ${indice.length} componentes del proyecto, con su ficha y su carga diferida. */
export const COMPONENTES: readonly ComponenteDelStock[] = [
${entradasTs}
];
`;

if (process.argv.includes('--check')) {
  const actual = existsSync(destino) ? readFileSync(destino, 'utf8') : '';
  if (actual !== contenido) {
    console.error('✗ el índice de componentes no refleja el código.');
    console.error('  Ejecutá: node scripts/generate-component-index.mjs');
    process.exit(1);
  }
  console.log(`✓ índice de componentes al día (${indice.length} componentes)`);
  process.exit(0);
}

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, contenido);

const porNivel = indice.reduce((acc, c) => ({ ...acc, [c.nivel]: (acc[c.nivel] ?? 0) + 1 }), {});
const conProblemas = indice.filter((c) => c.problemas.length > 0).length;

console.log(`✓ ${SALIDA}`);
console.log(
  `  ${indice.length} componentes · ` +
    Object.entries(porNivel)
      .map(([nivel, n]) => `${n} ${nivel}${n === 1 ? '' : 's'}`)
      .join(' · '),
);
console.log(`  ${conProblemas} con algo que mirar`);
