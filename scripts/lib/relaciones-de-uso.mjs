/* ============================================================================
    Relaciones de uso entre componentes, para el índice del stock.

    «Está en `imports: [...]`» y «se instancia en la plantilla» son dos hechos
    distintos, y el índice los confundía: un import olvidado contaba igual que
    un organismo montado de verdad. Acá se separan las relaciones que el
    análisis de texto PUEDE comprobar:

      imports-available      la clase figura en `imports: [...]` del decorador
      template-instantiates  un elemento de la plantilla cumple su selector
                             (etiqueta, atributo o etiqueta+atributo) Y la
                             clase está importada: sin import, Angular no la monta
      type-only              se importan sus tipos (`import type`, `.types`),
                             no la pieza visual
      dynamic-loads          `createComponent(Clase)` o `import('ruta')`

    Y lo que no puede decidir lo devuelve como **no resuelto, con su causa**:
    nunca como ausencia. Es análisis de texto, no el compilador de plantillas
    de Angular —el §6 del documento maestro prohíbe escribir un compilador—, así
    que cada decisión tiene que poder explicarse en una línea.

    Mismas convenciones que `scripts/inventario-organismos.mjs` (#569), que
    hace lo mismo para seis organismos y se usa acá sólo como contraste.
    ========================================================================== */

import { existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

/* ---- selectores ------------------------------------------------------------ */

/**
 * Un selector de Angular en partes comparables.
 *
 * Devuelve `null` si alguna parte usa algo que este análisis no interpreta
 * (`:not(...)`, combinadores): mejor «no sé» que una coincidencia inventada.
 */
export function parsearSelector(selector) {
  const partes = selector.split(',').map((p) => p.trim()).filter((p) => p !== '');
  if (partes.length === 0) return null;
  const resultado = [];
  for (const parte of partes) {
    const m = /^([a-zA-Z][\w-]*)?((?:\[[^\]]+\]|\.[\w-]+)*)$/.exec(parte);
    if (m === null) return null;
    const [, etiqueta, resto] = m;
    const atributos = [...resto.matchAll(/\[([^\]=]+)(?:=([^\]]*))?\]/g)].map((a) => ({
      nombre: a[1].trim(),
      valor: a[2] === undefined ? null : a[2].trim().replace(/^["']|["']$/g, ''),
    }));
    const clases = [...resto.matchAll(/\.([\w-]+)/g)].map((c) => c[1]);
    if (etiqueta === undefined && atributos.length === 0 && clases.length === 0) return null;
    resultado.push({ etiqueta: etiqueta?.toLowerCase() ?? null, atributos, clases });
  }
  return resultado;
}

/* ---- plantilla ------------------------------------------------------------- */

/** Nombre de atributo tal como Angular lo compara: `[appTooltip]` → `appTooltip`. */
function normalizarAtributo(nombre) {
  let n = nombre;
  if (n.startsWith('bind-')) n = n.slice(5);
  if (n.startsWith('*')) n = n.slice(1);
  if (n.startsWith('[(') && n.endsWith(')]')) n = n.slice(2, -2);
  else if (n.startsWith('[') && n.endsWith(']')) n = n.slice(1, -1);
  else if (n.startsWith('(') && n.endsWith(')')) return null; // un evento no es un atributo
  if (/^(attr|class|style)\./.test(n)) return null; // enlaces de propiedad del DOM
  return n;
}

/**
 * Los elementos de una plantilla, con su línea.
 *
 * Un tokenizador mínimo y no una regex `<[^>]*>`: un `(click)="a > b"` o un
 * `@if (x > 0)` cortaría la etiqueta a la mitad. Los comentarios se quitan
 * antes, porque un `<app-x>` comentado no se instancia.
 */
export function elementosDeLaPlantilla(html) {
  const sinComentarios = html.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
  const elementos = [];
  let i = 0;
  while (i < sinComentarios.length) {
    const abre = sinComentarios.indexOf('<', i);
    if (abre === -1) break;
    const etiqueta = /^<([a-zA-Z][\w-]*)/.exec(sinComentarios.slice(abre, abre + 80));
    if (etiqueta === null) {
      i = abre + 1;
      continue;
    }
    let j = abre + etiqueta[0].length;
    let comilla = null;
    for (; j < sinComentarios.length; j++) {
      const ch = sinComentarios[j];
      if (comilla !== null) {
        if (ch === comilla) comilla = null;
      } else if (ch === '"' || ch === "'") comilla = ch;
      else if (ch === '>') break;
    }
    const cuerpo = sinComentarios.slice(abre + etiqueta[0].length, j).replace(/\/$/, '');
    const atributos = new Map();
    for (const a of cuerpo.matchAll(/([^\s=/"']+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
      const nombre = normalizarAtributo(a[1]);
      if (nombre === null) continue;
      atributos.set(nombre, a[2] === undefined ? '' : a[2].replace(/^["']|["']$/g, ''));
    }
    const clases = new Set((atributos.get('class') ?? '').split(/\s+/).filter(Boolean));
    elementos.push({
      etiqueta: etiqueta[1].toLowerCase(),
      atributos,
      clases,
      linea: sinComentarios.slice(0, abre).split('\n').length,
    });
    i = j + 1;
  }
  return elementos;
}

/** El primer elemento que cumple el selector ya parseado, o `null`. */
export function elementoQueCumple(partes, elementos) {
  for (const el of elementos) {
    for (const parte of partes) {
      if (parte.etiqueta !== null && parte.etiqueta !== el.etiqueta) continue;
      const atributosOk = parte.atributos.every(
        (a) => el.atributos.has(a.nombre) && (a.valor === null || el.atributos.get(a.nombre) === a.valor),
      );
      if (!atributosOk) continue;
      if (!parte.clases.every((c) => el.clases.has(c))) continue;
      return el;
    }
  }
  return null;
}

/**
 * La plantilla de un componente: inline o `templateUrl`.
 *
 * `leer(ruta)` se inyecta para poder probarlo sin disco.
 */
export function plantillaDe(file, source, leer) {
  const inline = /\btemplate:\s*`([\s\S]*?)`/.exec(source);
  if (inline !== null) {
    return {
      html: inline[1],
      origen: 'inline',
      interpolada: inline[1].includes('${'),
      // La línea del `.ts` donde empieza el literal, para citar el hallazgo.
      desplazamiento: source.slice(0, inline.index).split('\n').length - 1,
    };
  }
  const url = /\btemplateUrl:\s*'([^']+)'/.exec(source)?.[1];
  if (url === undefined) return { html: null, origen: 'ninguna', interpolada: false, desplazamiento: 0 };
  const ruta = join(dirname(file), url);
  if (!existsSync(ruta)) return { html: null, origen: `templateUrl no encontrada: ${url}`, interpolada: false, desplazamiento: 0 };
  return { html: leer(ruta), origen: ruta, interpolada: false, desplazamiento: 0 };
}

/* ---- imports del decorador y del módulo ------------------------------------ */

/**
 * Las entradas de `imports: [...]` del decorador `@Component`.
 *
 * `noLiterales` son las que no son un identificador suelto (`...COMUNES`,
 * `forwardRef(() => X)`): sin resolverlas no se sabe qué ponen a disposición.
 */
export function importsDelDecorador(source) {
  const decorador = source.indexOf('@Component(');
  if (decorador === -1) return { clases: [], noLiterales: [], linea: null };
  const m = /\bimports:\s*\[/g;
  m.lastIndex = decorador;
  const inicio = m.exec(source);
  if (inicio === null) return { clases: [], noLiterales: [], linea: null };
  const linea = source.slice(0, inicio.index).split('\n').length;
  const contenido = hastaElCierre(source, inicio.index + inicio[0].length);
  const clases = [];
  const noLiterales = [];
  for (const crudo of contenido.split(',')) {
    const x = crudo.trim();
    if (x === '') continue;
    if (/^[A-Z]\w*$/.test(x)) clases.push(x);
    else noLiterales.push(x.replace(/\s+/g, ' ')); // `...COMUNES`, `forwardRef(() => X)`, una constante
  }
  return { clases, noLiterales, linea };
}

/**
 * El texto desde `desde` hasta el `]` que cierra, sin comentarios.
 *
 * Cuenta corchetes y paréntesis y salta comentarios y cadenas: un comentario
 * con comas o con `]` adentro partía el arreglo y dejaba imports fuera —o
 * inventaba entradas con el texto del comentario—.
 */
function hastaElCierre(source, desde) {
  let profundidad = 0;
  let salida = '';
  for (let i = desde; i < source.length; i++) {
    const ch = source[i];
    const sig = source[i + 1];
    if (ch === '/' && sig === '/') {
      const fin = source.indexOf('\n', i);
      i = fin === -1 ? source.length : fin - 1;
      continue;
    }
    if (ch === '/' && sig === '*') {
      const fin = source.indexOf('*/', i + 2);
      i = fin === -1 ? source.length : fin + 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const fin = source.indexOf(ch, i + 1);
      salida += source.slice(i, fin + 1);
      i = fin;
      continue;
    }
    if (ch === '[' || ch === '(') profundidad++;
    if (ch === ']' || ch === ')') {
      if (profundidad === 0) return salida;
      profundidad--;
    }
    salida += ch;
  }
  return salida;
}

/**
 * Los `import` del módulo con su ruta, separando los que sólo traen tipos.
 *
 * `import type { A }` y `import { type A, type B }` (todos con `type`) son de
 * tipos. Un `import { type A, B }` mixto trae `B` como valor.
 */
export function importsDelModulo(source) {
  const salida = [];
  for (const m of source.matchAll(/^import\s+(type\s+)?\{([^}]*)\}\s*from\s*'([^']+)'/gm)) {
    const soloTipoDeclarado = m[1] !== undefined;
    const nombres = m[2]
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n !== '');
    const linea = source.slice(0, m.index).split('\n').length;
    for (const n of nombres) {
      const esTipo = soloTipoDeclarado || n.startsWith('type ');
      const limpio = n.replace(/^type\s+/, '');
      const [original, alias] = limpio.split(/\s+as\s+/);
      salida.push({ nombre: (alias ?? original).trim(), original: original.trim(), desde: m[3], esTipo, linea });
    }
  }
  return salida;
}

/** Resuelve un especificador relativo a la ruta absoluta del módulo, sin extensión. */
export function resolverRelativo(file, especificador) {
  if (!especificador.startsWith('.')) return null;
  return normalize(join(dirname(file), especificador));
}

/* ---- cargas dinámicas ------------------------------------------------------ */

/**
 * `createComponent(X, ...)` e `import('ruta')` de un archivo, con su línea.
 *
 * `objetivo` es el identificador o la ruta tal como está escrita; quien llama
 * decide si corresponde a un componente del índice.
 */
export function cargasDinamicas(source) {
  const salida = [];
  for (const m of source.matchAll(/\bcreateComponent\(\s*([\w.]+)/g)) {
    salida.push({ via: 'createComponent', objetivo: m[1], linea: source.slice(0, m.index).split('\n').length });
  }
  for (const m of source.matchAll(/\bimport\(\s*'([^']+)'\s*\)/g)) {
    salida.push({ via: 'import()', objetivo: m[1], linea: source.slice(0, m.index).split('\n').length });
  }
  return salida;
}

/* ---- nivel atómico --------------------------------------------------------- */

export const NIVELES_DECLARABLES = ['atomo', 'molecula', 'organismo'];

/** El nivel que da la carpeta. Es la regla de siempre, ahora con nombre. */
export function nivelPorRuta(path) {
  if (path.includes('/shared/components/atoms/')) return 'atomo';
  if (path.includes('/shared/components/molecules/')) return 'molecula';
  if (path.includes('/shared/components/organisms/')) return 'organismo';
  if (path.includes('/features/alovida/')) return 'maqueta';
  if (path.includes('/features/')) return 'pantalla';
  return 'otro';
}

/**
 * El nivel declarado en el propio componente, si lo hay.
 *
 * Se declara con una etiqueta de documentación junto a la clase:
 *
 *     /** @nivelAtomico organismo *\/
 *
 * Un valor que no es un nivel del sistema de diseño no se acepta: se devuelve
 * como inválido para que el índice lo diga en vez de ignorarlo.
 */
export function nivelDeclarado(source) {
  const m = /@nivelAtomico\s+([\w-]+)/.exec(source);
  if (m === null) return { nivel: null, invalido: null };
  return NIVELES_DECLARABLES.includes(m[1]) ? { nivel: m[1], invalido: null } : { nivel: null, invalido: m[1] };
}

/** Nivel final y de dónde salió: lo declarado gana sobre la carpeta. */
export function clasificarNivel(path, source) {
  const porRuta = nivelPorRuta(path);
  const declarado = nivelDeclarado(source);
  if (declarado.nivel !== null) {
    return { nivel: declarado.nivel, nivelOrigen: 'declarado', nivelPorRuta: porRuta, nivelDeclaradoInvalido: null };
  }
  return { nivel: porRuta, nivelOrigen: 'por-ruta', nivelPorRuta: porRuta, nivelDeclaradoInvalido: declarado.invalido };
}
