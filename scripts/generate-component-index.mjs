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
import {
  cargasDinamicas,
  clasificarNivel,
  elementoQueCumple,
  elementosDeLaPlantilla,
  importsDelDecorador,
  importsDelModulo,
  parsearSelector,
  plantillaDe,
  resolverRelativo,
} from './lib/relaciones-de-uso.mjs';

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

/* El nivel del sistema de diseño ya no sale sólo de la carpeta: ver
   `clasificarNivel` en `lib/relaciones-de-uso.mjs`. La carpeta sigue siendo el
   valor por omisión, y el índice dice de dónde salió cada clasificación. */

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

/*
 * `imports: [...]` y la plantilla se leen con `lib/relaciones-de-uso.mjs`. Antes
 * esto era una regex que sólo veía `<app-…` y cuatro directivas escritas a
 * mano: `<button app-button>` no existía para el índice, y la composición se
 * deducía del import aunque la plantilla no instanciara nada.
 */

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

function problemasEstaticos(componente, source) {
  const problemas = [];

  for (const { clase, selector, linea } of componente.enPlantillaSinImport) {
    problemas.push({
      tipo: 'selector-no-importado',
      detalle: `la plantilla usa ${selector} (línea ${linea}) pero ${clase} no está en imports: la directiva no hace nada`,
    });
  }
  for (const clase of componente.relaciones.disponibleSinInstanciar) {
    problemas.push({
      tipo: 'importado-sin-instanciar',
      detalle: `${clase} está en imports pero ningún elemento de la plantilla cumple su selector ni se carga dinámicamente`,
    });
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

/**
 * La infraestructura del propio banco no es producto: ni el visor ni los
 * anfitriones de `escenarios/` van al índice. Antes el stock se listaba a sí
 * mismo como una «pantalla» más, y cada anfitrión nuevo habría sumado una
 * ficha que nadie va a montar suelta.
 */
const INFRAESTRUCTURA_DEL_BANCO = 'src/app/features/component-stock/';

const archivos = walk(SRC_ROOT, ['.ts'])
  .filter((file) => !file.endsWith('.spec.ts'))
  .filter((file) => !repoPath(file).startsWith(INFRAESTRUCTURA_DEL_BANCO))
  .map((file) => ({ file, source: read(file) }))
  .filter(({ source }) => /@Component\(/.test(source));

const indice = archivos
  .map(({ file, source }) => {
    const path = repoPath(file);
    const clase = /export class (\w+)/.exec(source)?.[1] ?? '(sin clase)';
    const decorador = importsDelDecorador(source);
    return {
      clave: path.replace(/^src\/app\//, '').replace(/\.ts$/, ''),
      path,
      ...clasificarNivel(`/${path}`, source),
      clase,
      selector: /selector:\s*'([^']+)'/.exec(source)?.[1] ?? '(sin selector)',
      onPush: /ChangeDetectionStrategy\.OnPush/.test(source),
      generico: genericos(source),
      entradas: entradas(source),
      salidas: salidas(source),
      importa: decorador.clases,
      clientes: clientes(source),
      tieneSpec: existsSync(file.replace(/\.ts$/, '.spec.ts')),
      resumen: (/\/\*\*\s*\n\s*\*\s*(.+)/.exec(source)?.[1] ?? '').replace(/\s*\*\/\s*$/, '').trim(),
      // Sólo para el análisis; no se emiten.
      _file: file,
      _source: source,
      _decorador: decorador,
    };
  })
  .sort((a, b) => a.clave.localeCompare(b.clave));

/* ---- relaciones de uso ----------------------------------------------------- */

const porRuta = new Map(indice.map((c) => [c.path.replace(/\.ts$/, ''), c]));
const porClase = new Map();
for (const c of indice) porClase.set(c.clase, [...(porClase.get(c.clase) ?? []), c]);
const selectorDe = new Map(indice.map((c) => [c.clave, parsearSelector(c.selector)]));

/**
 * El componente del índice al que apunta un identificador de este archivo.
 *
 * Primero por la ruta del `import` (exacto); si viene de un barrel o de otra
 * forma que no lleva al archivo, por el nombre de la clase, y sólo si es único:
 * dos clases con el mismo nombre no se eligen al azar.
 */
function resolverClase(componente, identificador, delModulo) {
  const imp = delModulo.find((i) => i.nombre === identificador);
  if (imp !== undefined) {
    const absoluta = resolverRelativo(componente._file, imp.desde);
    if (absoluta !== null) {
      const exacto = porRuta.get(repoPath(absoluta));
      if (exacto !== undefined && exacto.clase === imp.original) return { destino: exacto };
    }
  }
  const candidatos = porClase.get(imp?.original ?? identificador) ?? [];
  if (candidatos.length === 1) return { destino: candidatos[0] };
  if (candidatos.length > 1) return { destino: null, ambiguo: candidatos.map((c) => c.clave) };
  return { destino: null };
}

// Cargas dinámicas en todo el código, no sólo en componentes: el servicio de
// diálogos, las directivas y las rutas también montan piezas. Menos el banco:
// su índice generado lleva un `import()` por componente y su visor monta
// cualquiera, así que contarlos diría «todo se carga dinámicamente», que es ruido.
const cargadoDinamicamentePor = new Map();
const cargasPorArchivo = new Map();
for (const file of walk(SRC_ROOT, ['.ts']).filter(
  (f) => !f.endsWith('.spec.ts') && !repoPath(f).startsWith(INFRAESTRUCTURA_DEL_BANCO),
)) {
  const source = read(file);
  const cargas = cargasDinamicas(source);
  if (cargas.length === 0) continue;
  const delModulo = importsDelModulo(source);
  const resueltas = [];
  for (const carga of cargas) {
    let destino = null;
    let ambiguo = null;
    if (carga.via === 'createComponent') {
      const r = resolverClase({ _file: file }, carga.objetivo, delModulo);
      destino = r.destino;
      ambiguo = r.ambiguo ?? null;
    } else {
      const absoluta = resolverRelativo(file, carga.objetivo);
      destino = absoluta === null ? null : (porRuta.get(repoPath(absoluta)) ?? null);
    }
    resueltas.push({ ...carga, destino, ambiguo });
    if (destino !== null) {
      const lista = cargadoDinamicamentePor.get(destino.clave) ?? [];
      lista.push(`${repoPath(file)}:${carga.linea} (${carga.via})`);
      cargadoDinamicamentePor.set(destino.clave, lista);
    }
  }
  cargasPorArchivo.set(repoPath(file), resueltas);
}

for (const componente of indice) {
  const { _file: file, _source: source, _decorador: decorador } = componente;
  const delModulo = importsDelModulo(source);
  const sinResolver = [];
  const plantilla = plantillaDe(file, source, read);
  const elementos = plantilla.html === null ? null : elementosDeLaPlantilla(plantilla.html);

  if (plantilla.html === null && plantilla.origen !== 'ninguna') {
    sinResolver.push({ causa: 'plantilla-no-localizada', detalle: plantilla.origen });
  }
  if (plantilla.interpolada) {
    sinResolver.push({
      causa: 'plantilla-interpolada',
      detalle: 'la plantilla inline usa ${…}: lo interpolado no se analiza',
    });
  }
  for (const expresion of decorador.noLiterales) {
    sinResolver.push({
      causa: 'imports-no-literal',
      detalle: `imports: [...] contiene «${expresion}» (línea ${decorador.linea}): lo que aporta no se resolvió`,
    });
  }

  // imports-available: lo que el decorador pone a disposición.
  const disponibles = [];
  for (const identificador of decorador.clases) {
    const r = resolverClase(componente, identificador, delModulo);
    if (r.ambiguo !== undefined) {
      sinResolver.push({
        causa: 'clase-ambigua',
        detalle: `${identificador} coincide con ${r.ambiguo.length} componentes del índice (${r.ambiguo.join(', ')})`,
      });
    }
    if (r.destino !== null) disponibles.push(r.destino);
  }

  // template-instantiates: la plantilla tiene un elemento que cumple el selector.
  const instancia = [];
  const disponibleSinInstanciar = [];
  const propias = cargasPorArchivo.get(componente.path) ?? [];
  const cargaDinamica = [...new Set(propias.filter((c) => c.destino !== null).map((c) => c.destino.clase))];
  for (const carga of propias) {
    if (carga.destino === null && carga.via === 'createComponent') {
      sinResolver.push({
        causa: 'carga-dinamica-sin-resolver',
        detalle: `createComponent(${carga.objetivo}) en la línea ${carga.linea}: el objetivo no es una clase del índice`,
      });
    }
  }
  for (const destino of disponibles) {
    const partes = selectorDe.get(destino.clave);
    if (elementos === null) {
      sinResolver.push({
        causa: 'sin-plantilla-para-decidir',
        detalle: `${destino.clase} está en imports, pero sin plantilla legible no se puede decidir si se instancia`,
      });
      continue;
    }
    if (partes === null) {
      sinResolver.push({
        causa: 'selector-no-analizable',
        detalle: `${destino.clase} tiene el selector «${destino.selector}», que este análisis no interpreta`,
      });
      continue;
    }
    if (elementoQueCumple(partes, elementos) !== null) instancia.push(destino.clase);
    else if (!cargaDinamica.includes(destino.clase)) disponibleSinInstanciar.push(destino.clase);
  }

  // Selectores de la plantilla cuya clase no está importada: no se instancian.
  const enPlantillaSinImport = [];
  if (elementos !== null) {
    const importadas = new Set(disponibles.map((d) => d.clave));
    // Dos componentes con el mismo selector (hay dos `Composer`, en feed y en
    // mensajería): si la plantilla usa uno importado, el otro no está «sin importar».
    const selectoresImportados = new Set(disponibles.map((d) => d.selector));
    for (const otro of indice) {
      if (importadas.has(otro.clave) || otro.clave === componente.clave) continue;
      if (selectoresImportados.has(otro.selector)) continue;
      const partes = selectorDe.get(otro.clave);
      if (partes === null || partes.every((p) => p.etiqueta === null && p.atributos.length === 0)) continue;
      const el = elementoQueCumple(partes, elementos);
      if (el === null) continue;
      // Un `<button>` a secas no «usa» un componente de selector `button`: sólo
      // cuentan los selectores que exigen algo propio (una etiqueta app-*, un atributo).
      const propio = partes.some((p) => p.atributos.length > 0 || (p.etiqueta ?? '').includes('-'));
      if (!propio) continue;
      if (decorador.noLiterales.length > 0) {
        sinResolver.push({
          causa: 'selector-sin-import-resoluble',
          detalle: `la plantilla usa ${otro.selector} (línea ${el.linea + plantilla.desplazamiento}) y ${otro.clase} podría venir de ${decorador.noLiterales.join(', ')}`,
        });
      } else {
        enPlantillaSinImport.push({ clase: otro.clase, selector: otro.selector, linea: el.linea + plantilla.desplazamiento });
      }
    }
  }

  // type-only: se importan los tipos de un componente o de su `.types`, no la pieza.
  const soloTipo = new Set();
  for (const imp of delModulo) {
    const absoluta = resolverRelativo(file, imp.desde);
    if (absoluta === null) continue;
    const ruta = repoPath(absoluta);
    const deTipos = ruta.endsWith('.types') ? porRuta.get(ruta.slice(0, -'.types'.length)) : undefined;
    const propio = porRuta.get(ruta);
    const destino = deTipos ?? (imp.esTipo ? propio : undefined);
    if (destino === undefined || destino.clave === componente.clave) continue;
    if (instancia.includes(destino.clase) || cargaDinamica.includes(destino.clase)) continue;
    soloTipo.add(destino.clase);
  }

  // Un componente del índice importado como VALOR que no está en `imports: [...]`
  // ni se carga con `createComponent`: `viewChild(X)`, `contentChildren(X)`,
  // `inject(X)`… Es una relación real que las cuatro de arriba no describen, y
  // callarla la volvería ausencia: se declara no resuelta, con la línea.
  const enDecorador = new Set(disponibles.map((d) => d.clave));
  for (const imp of delModulo) {
    if (imp.esTipo) continue;
    const absoluta = resolverRelativo(file, imp.desde);
    const destino = absoluta === null ? undefined : porRuta.get(repoPath(absoluta));
    if (destino === undefined || destino.clase !== imp.original || destino.clave === componente.clave) continue;
    if (enDecorador.has(destino.clave) || cargaDinamica.includes(destino.clase)) continue;
    const cuerpo = source.split('\n');
    const uso = cuerpo.findIndex((l, i) => i + 1 !== imp.linea && !/^\s*(import|\*|\/\/)/.test(l) && new RegExp(`\\b${imp.nombre}\\b`).test(l));
    if (uso === -1) continue;
    sinResolver.push({
      causa: 'referencia-de-valor-no-clasificada',
      detalle: `usa ${destino.clase} como valor en la línea ${uso + 1} («${cuerpo[uso].trim().slice(0, 60)}») sin importarlo en el decorador: ni instancia, ni tipo, ni carga dinámica`,
    });
  }

  componente.relaciones = {
    instancia: [...new Set(instancia)].sort(),
    disponibleSinInstanciar: [...new Set(disponibleSinInstanciar)].sort(),
    soloTipo: [...soloTipo].sort(),
    cargaDinamica: cargaDinamica.sort(),
  };
  componente.enPlantillaSinImport = enPlantillaSinImport;
  componente.unresolvedEvidence = sinResolver;
  componente.cargadoDinamicamentePor = (cargadoDinamicamentePor.get(componente.clave) ?? []).sort();
}

// Composición: SÓLO lo que la plantilla instancia. Lo disponible sin instanciar
// y los tipos quedan en `relaciones`, no inflan la composición.
const nivelDeClase = new Map();
for (const c of indice) nivelDeClase.set(c.clase, (porClase.get(c.clase) ?? []).length === 1 ? c.nivel : null);
for (const componente of indice) {
  const usa = { atomos: [], moleculas: [], organismos: [], otros: [] };
  for (const clase of componente.relaciones.instancia) {
    const nivel = nivelDeClase.get(clase);
    if (nivel === 'atomo') usa.atomos.push(clase);
    else if (nivel === 'molecula') usa.moleculas.push(clase);
    else if (nivel === 'organismo') usa.organismos.push(clase);
    else usa.otros.push(clase);
  }
  componente.usa = usa;
  componente.problemas = problemasEstaticos(componente, componente._source);
}

// Quién usa a quién, al revés: también sólo por instancia en plantilla.
const usadoPor = new Map();
for (const componente of indice) {
  for (const clase of componente.relaciones.instancia) {
    usadoPor.set(clase, [...(usadoPor.get(clase) ?? []), componente.clase]);
  }
}
for (const componente of indice) {
  componente.usadoPor = [...new Set(usadoPor.get(componente.clase) ?? [])].sort();
}

/* ---- acreditación: lo que se puede saber sin ejecutar --------------------- */

/*
 * Seis dimensiones, no un tilde verde. Cuatro salen de acá, del código y de la
 * evidencia versionada; las otras dos —si montó y si alguien interactuó— sólo
 * se saben en el banco, en ejecución, y el banco las completa.
 *
 *   descubierto     está en el índice (siempre true acá: es la fuente)
 *   escenario       hay un anfitrión escrito a mano en component-stock/escenarios
 *   visual          hay capturas versionadas de sus escenarios (#569)
 *   bloqueado       algo externo impide acreditarlo solo, con el motivo
 */
const ESCENARIOS_DIR = join(SRC_ROOT, 'app/features/component-stock/escenarios');
const escenarioPorClave = new Map();
for (const file of walk(ESCENARIOS_DIR, ['.ts']).filter((f) => f.endsWith('.escenarios.ts'))) {
  const clave = /^const CLAVE = '([^']+)'/m.exec(read(file))?.[1];
  if (clave !== undefined) escenarioPorClave.set(clave, repoPath(file));
}

const CAPTURAS_DIR = join(SRC_ROOT, '..', 'docs/frontend/evidence/refactor-declarativo');
const capturas = existsSync(CAPTURAS_DIR)
  ? walk(CAPTURAS_DIR, ['.png'])
      .map((f) => repoPath(f))
      .filter((f) => /\/stock-[^/]+\.png$/.test(f) && !f.endsWith('-marco.png'))
  : [];

/** Un tipo que el generador de valores sabe producir cumpliéndolo. */
function tipoGenerable(tipo) {
  const t = tipo.replace(/\s*\|\s*null$/, '').trim();
  return (
    /^(string|number|boolean|Date)$/.test(t) ||
    t.includes("'") ||
    /^(readonly\s+)?string\[\]$/.test(t) ||
    /SelectOption|Option\b/.test(t)
  );
}

for (const componente of indice) {
  const slug = componente.clave.split('/').pop();
  const escenario = escenarioPorClave.get(componente.clave) ?? null;
  const bloqueos = [];
  for (const u of componente.unresolvedEvidence) {
    if (u.causa === 'referencia-de-valor-no-clasificada' && /inject\(/.test(u.detalle)) {
      bloqueos.push(`necesita un padre que lo provea: ${u.detalle}`);
    }
  }
  const complejas = componente.entradas.filter((e) => e.requerido && !tipoGenerable(e.tipo)).map((e) => e.nombre);
  if (escenario === null && complejas.length > 0) {
    bloqueos.push(`sin escenario y con entradas obligatorias que el generador no sabe cumplir: ${complejas.join(', ')}`);
  }
  componente.acreditacion = {
    descubierto: true,
    escenario,
    capturasVisuales: escenario === null ? [] : capturas.filter((c) => c.includes(`/stock-${slug}-`)).sort(),
    bloqueos,
  };
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
      nivelOrigen: c.nivelOrigen,
      nivelPorRuta: c.nivelPorRuta,
      nivelDeclaradoInvalido: c.nivelDeclaradoInvalido,
      clase: c.clase,
      selector: c.selector,
      path: c.path,
      resumen: c.resumen,
      generico: c.generico,
      entradas: c.entradas,
      salidas: c.salidas,
      usa: c.usa,
      usadoPor: c.usadoPor,
      relaciones: c.relaciones,
      cargadoDinamicamentePor: c.cargadoDinamicamentePor,
      unresolvedEvidence: c.unresolvedEvidence,
      acreditacion: c.acreditacion,
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
// Se regenera en cada \`yarn dev\` y \`yarn build\`; está fuera de git.
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

const suma = (f) => indice.reduce((n, c) => n + f(c), 0);
console.log(
  `  relaciones: ${suma((c) => c.relaciones.instancia.length)} template-instantiates · ` +
    `${suma((c) => c.relaciones.disponibleSinInstanciar.length)} imports-available sin instanciar · ` +
    `${suma((c) => c.relaciones.soloTipo.length)} type-only · ` +
    `${suma((c) => c.cargadoDinamicamentePor.length)} dynamic-loads`,
);
console.log(
  `  nivel: ${indice.filter((c) => c.nivelOrigen === 'declarado').length} declarado · ` +
    `${indice.filter((c) => c.nivelOrigen === 'por-ruta').length} por-ruta · ` +
    `${suma((c) => c.unresolvedEvidence.length)} unresolvedEvidence en ` +
    `${indice.filter((c) => c.unresolvedEvidence.length > 0).length} componentes`,
);
const total = indice.length;
console.log(
  `  acreditación: descubiertos ${total}/${total} · con escenario ${indice.filter((c) => c.acreditacion.escenario !== null).length}/${total} · ` +
    `verificados visualmente ${indice.filter((c) => c.acreditacion.capturasVisuales.length > 0).length}/${total} · ` +
    `bloqueados ${indice.filter((c) => c.acreditacion.bloqueos.length > 0).length}/${total} · ` +
    'montó e interactuó: se miden en el banco (runtime)',
);
