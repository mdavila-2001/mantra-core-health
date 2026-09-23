#!/usr/bin/env node
/**
 * Carril 01 — inventario de vistas del diseñador y de cableado real.
 *
 * Responde tres preguntas que ninguna otra herramienta del repo responde
 * juntas, y que son las que el carril exige antes de tocar una línea de UI:
 *
 * 1. **¿Qué ruta pinta qué componente, y para qué rol?** — cruzando el registro
 *    de secciones (`navigation.map.ts`, que es quien declara los roles) con el
 *    mapa de pantallas de `app.routes.ts`.
 * 2. **¿Existe una vista del diseñador para esa ruta?** — contra
 *    `features/alovida/vistas.manifest.json`, que es el manifiesto de las 126
 *    pantallas portadas desde la bóveda.
 * 3. **¿La pantalla lee la API o se está pintando sola?** — buscando qué
 *    cliente de `core/data-access` inyecta, y qué señales de dato falso tiene.
 *
 * No modifica código. Escribe dos archivos en `docs/reports/generated/`:
 *
 * - `design-view-inventory.md`, la tabla que se lee;
 * - `rutas.json`, la **misma** lista en forma de datos, que consume el barrido
 *   del carril 19 (`playwright/carril-19-route-health.spec.ts`).
 *
 * Que las dos salgan de acá y no de dos lugares es el punto: una lista de rutas
 * escrita a mano en la suite se queda vieja el día que alguien agregue una
 * pantalla, y el barrido diría «todo bien» sin haberla mirado nunca.
 *
 * Uso:
 *   node scripts/audit-design-views.mjs           # escribe
 *   node scripts/audit-design-views.mjs --check   # falla si hay deriva
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { DOCS_ROOT, REPO_ROOT, SRC_ROOT, repoPath, walk } from './lib/scan.mjs';

const OUT = join(DOCS_ROOT, 'reports/generated/design-view-inventory.md');
const OUT_JSON = join(DOCS_ROOT, 'reports/generated/rutas.json');
const checkOnly = process.argv.includes('--check');

const AVISO =
  '<!-- GENERADO POR scripts/audit-design-views.mjs — NO EDITAR A MANO. -->\n\n';

/* ── lectura de las tres fuentes ─────────────────────────────────────────── */

const navMap = readFileSync(join(SRC_ROOT, 'app/core/navigation/navigation.map.ts'), 'utf8');
const appRoutes = readFileSync(join(SRC_ROOT, 'app/app.routes.ts'), 'utf8');

/**
 * Las secciones del registro, con sus roles.
 *
 * Se leen con expresión regular y no importando el módulo porque el script
 * corre en Node sin compilar TypeScript, y agregar un paso de build para leer
 * un array de literales sería desproporcionado. El formato del registro es
 * estable —lo fija `navigation.map.spec.ts`— y cualquier deriva se ve en el
 * recuento: si el archivo declara N secciones y acá salen menos, el conteo del
 * informe no cuadra con `APP_SECTIONS.length`.
 */
function leerSecciones() {
  const secciones = [];
  const bloques = navMap.split(/\n\s*\{\s*\n/).slice(1);
  for (const bloque of bloques) {
    const path = /path:\s*'([^']+)'/.exec(bloque)?.[1];
    if (path === undefined) continue;
    const label = /label:\s*'([^']+)'/.exec(bloque)?.[1] ?? '—';
    const group = /group:\s*'([^']+)'/.exec(bloque)?.[1] ?? '—';
    const availability = /availability:\s*'([^']+)'/.exec(bloque)?.[1] ?? '—';
    const module = /module:\s*'([^']+)'/.exec(bloque)?.[1] ?? '—';
    const rolesRaw = /roles:\s*\[([^\]]*)\]/.exec(bloque)?.[1];
    const roles =
      rolesRaw === undefined
        ? []
        : [...rolesRaw.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    // Los roles excluyentes ignoran el comodín `SUPERADMIN` (corrección #2). El
    // barrido lo necesita para no dar por rota una ruta que rebota a propósito.
    const exclusiveRoles = /exclusiveRoles:\s*true/.test(bloque);
    secciones.push({ path, label, group, roles, exclusiveRoles, availability, module });
  }
  return secciones;
}

/**
 * Qué componente pinta cada sección: el mapa directo, el diferido, o nada
 * —y «nada» significa el placeholder, que es justo lo que el carril busca—.
 */
function leerPantallas() {
  const pantallas = new Map();

  // Los componentes del mapa directo se importan arriba del archivo: de ahí
  // sale su ruta, que el literal del mapa no tiene.
  const importados = new Map();
  for (const m of appRoutes.matchAll(/import\s*\{\s*([\w,\s]+?)\s*\}\s*from\s*'(\.[^']+)'/g)) {
    for (const nombre of m[1].split(',').map((n) => n.trim())) {
      importados.set(nombre, m[2]);
    }
  }

  const directo = /const PANTALLAS:[\s\S]*?\n\};/.exec(appRoutes)?.[0] ?? '';
  for (const m of directo.matchAll(/'?([\w/-]+)'?:\s*(\w+),/g)) {
    pantallas.set(m[1], {
      componente: m[2],
      carga: 'directa',
      archivo: importados.get(m[2]) ?? null,
    });
  }

  // El mapa diferido se recorre **por entrada** y no con una sola expresión que
  // abarque clave, `import()` y clase: las entradas están formateadas a mano y
  // el `.then((m) => m.X)` cae a veces dos líneas más abajo y con coma final,
  // así que un cuantificador perezoso largo se comía la entrada siguiente y
  // emparejaba una clave con el componente de otra. Ese error no se nota: da
  // una tabla plausible y equivocada.
  const diferido = /const PANTALLAS_DIFERIDAS:[\s\S]*?\n\};/.exec(appRoutes)?.[0] ?? '';
  const entradas = [
    ...diferido.matchAll(/^ {2}'?([\w/-]+)'?:\s*\(\)\s*=>/gm),
  ];
  for (const [i, entrada] of entradas.entries()) {
    const desde = entrada.index;
    const hasta = entradas[i + 1]?.index ?? diferido.length;
    const cuerpo = diferido.slice(desde, hasta);
    const archivo = /import\(\s*'([^']+)'\s*\)/.exec(cuerpo)?.[1] ?? null;
    const componente = /m\.(\w+)/.exec(cuerpo)?.[1] ?? '(sin clase)';
    pantallas.set(entrada[1], { componente, carga: 'diferida', archivo });
  }

  return pantallas;
}

/** Las pantallas que cuelgan de una sección sin ser entradas de menú. */
function leerPantallasHijas() {
  const hijas = [];

  // La ventana es holgada porque entre el `path:` y su `import()` puede haber
  // `title`, `data`, `canActivate` y un comentario largo explicando por qué.
  // Con una ventana corta, una entrada bien escrita simplemente desaparecía del
  // inventario — y desaparecer en silencio es el defecto que este script busca.
  const bloque = /const PANTALLAS_HIJAS:[\s\S]*?\n\];/.exec(appRoutes)?.[0] ?? '';
  for (const m of bloque.matchAll(
    /path:\s*'([^']+)'[\s\S]{0,900}?import\(\s*'([^']+)'\s*\)[\s\S]{0,120}?m\.(\w+)\)/g,
  )) {
    hijas.push({ ruta: m[1], archivo: m[2], componente: m[3], origen: 'hija' });
  }

  // Las pantallas de operación se declaran por función, no por literal.
  //
  // El `import(...)` admite saltos de línea adentro del paréntesis: el
  // formateador parte las rutas largas, y una expresión que exigiera
  // `import('…')` en una sola línea perdía la mitad de las pantallas de
  // operación sin decir nada.
  for (const m of appRoutes.matchAll(
    /pantallaDe(\w+)\(\s*(?:'([^']+)',\s*)?'([^']+)',\s*'[^']*',\s*\(\)\s*=>\s*\n?\s*import\(\s*'([^']+)'\s*\)[\s\S]{0,200}?m\.(\w+)/g,
  )) {
    const seccion = m[2] ?? SECCION_DE_HELPER[m[1]] ?? m[1];
    hijas.push({
      ruta: `${seccion}/${m[3]}`,
      archivo: m[4],
      componente: m[5],
      origen: 'operación',
    });
  }

  return hijas;
}

/** Qué sección prefija cada helper `pantallaDeXxx` de `app.routes.ts`. */
const SECCION_DE_HELPER = {
  AccesoDelegado: 'administration/delegated-access',
  ProveedoresDeIdentidad: 'administration/identity-providers',
  VerificacionIdentidad: 'administration/identity-assurance',
  ContextoSanitario: 'administration/health-context',
  Geolocalizacion: 'administration/geolocation',
};

/** Las 126 pantallas portadas desde la bóveda, por su ruta. */
function leerVistasDelDisenador() {
  const manifiesto = JSON.parse(
    readFileSync(join(SRC_ROOT, 'app/features/alovida/vistas.manifest.json'), 'utf8'),
  );
  return manifiesto.generadas;
}

/* ── análisis de cada pantalla ───────────────────────────────────────────── */

/** Todos los clientes de datos que el proyecto expone, por nombre de clase. */
function clientesDeDatos() {
  const clientes = new Set();
  for (const file of walk(join(SRC_ROOT, 'app/core/data-access'), ['.ts'])) {
    if (file.endsWith('.spec.ts')) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(/export class (\w*Client)\b/g)) {
      clientes.add(m[1]);
    }
  }
  return clientes;
}

const CLIENTES = clientesDeDatos();

/**
 * Señales de que una pantalla no está mostrando datos reales.
 *
 * Cada patrón se eligió por lo que apareció **en este repo**, no de una lista
 * genérica: los datos de muestra de las vistas portadas viven en archivos
 * `*.data.ts` con constantes `_DE_MUESTRA`, y ese es el marcador más fiable.
 */
const OLORES = [
  [/_DE_MUESTRA\b/, 'datos de muestra'],
  // El nombre del olor va **entre acentos graves**: es el marcador literal que
  // se encontró en el código, y `check-doc-coverage` prohíbe marcadores
  // provisionales sueltos en `docs/` —ignorando, a propósito, los que están en
  // un bloque o span de código, que es justo este caso—. Sin los acentos, este
  // informe dejaba en rojo esa verificación y con ella el PR de cualquiera.
  [/\bTODO\b|\bFIXME\b/, '`TODO`/`FIXME`'],
  [/lorem ipsum/i, 'lorem'],
  [/\bfaker\b/i, 'faker en runtime'],
  [/próximamente|proximamente|coming soon|en construcción/i, 'promesa sin pantalla'],
  // El generador de vistas portadas marca así los enlaces de la maqueta que no
  // llevan a ningún lado. Es el marcador más honesto del repo y el que dice, sin
  // ambigüedad, que la pantalla todavía no está cableada.
  [/data-sin-destino/, 'enlaces sin destino'],
];

/**
 * Qué se puede decir de un componente leyendo su archivo y su carpeta.
 *
 * Se mira la carpeta entera y no sólo el `.ts` porque el marcado y los datos de
 * muestra viven al lado (`.html`, `.data.ts`), y un dato falso en la plantilla
 * cuenta igual que uno en la clase.
 */
function analizar(archivoRelativo) {
  if (archivoRelativo === null) return { existe: false, apis: [], olores: [] };

  const base = archivoRelativo
    .replace(/^\.\//, 'src/app/')
    .replace(/^@features\//, 'src/app/features/');
  const ts = join(REPO_ROOT, `${base}.ts`);
  if (!existsSync(ts)) return { existe: false, apis: [], olores: [] };

  const fuentes = walk(dirname(ts), ['.ts', '.html'])
    .filter((f) => !f.endsWith('.spec.ts'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  const apis = [...CLIENTES].filter((cliente) =>
    new RegExp(`\\binject\\(\\s*${cliente}\\s*\\)`).test(fuentes),
  );
  const olores = OLORES.filter(([patron]) => patron.test(fuentes)).map(([, nombre]) => nombre);

  return { existe: true, apis, olores, archivo: repoPath(ts) };
}

/**
 * Cómo se resume el estado de una pantalla en una palabra.
 *
 * `portada` distingue las 126 vistas de la bóveda del resto: su marcado es
 * estático **por diseño** —es el entregable del diseñador, no una pantalla a
 * medio hacer— y llamarlas «presentacionales» las mezclaría con los paneles de
 * operación, que sí son pantallas terminadas que no listan nada.
 */
function estadoDe({ existe, apis, olores }, availability, portada = false) {
  if (!existe) return availability === 'planificada' ? 'placeholder' : 'sin pantalla';
  if (apis.length > 0) return olores.length > 0 ? 'conectada con deuda' : 'conectada';
  if (portada) return 'maqueta portada';
  if (olores.includes('datos de muestra')) return 'maqueta';
  if (olores.length > 0) return 'con deuda';
  return 'presentacional';
}

/* ── informe ─────────────────────────────────────────────────────────────── */

const secciones = leerSecciones();
const pantallas = leerPantallas();
const hijas = leerPantallasHijas();
const disenador = leerVistasDelDisenador();

const filasSecciones = secciones.map((s) => {
  const pantalla = pantallas.get(s.path) ?? null;
  const analisis = analizar(pantalla?.archivo ?? null);
  return { ...s, pantalla, analisis, estado: estadoDe(analisis, s.availability) };
});

const filasHijas = hijas.map((h) => {
  const analisis = analizar(h.archivo);
  // El rol de una pantalla hija es el de la sección de la que cuelga: se llega
  // desde ella, y el menú ya la filtró.
  const seccion = secciones
    .filter((s) => h.ruta.startsWith(`${s.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return {
    ...h,
    roles: seccion?.roles ?? [],
    seccion: seccion?.label ?? '—',
    analisis,
    estado: estadoDe(analisis, 'disponible'),
  };
});

const filasDisenador = disenador.map((v) => {
  const analisis = analizar(v.importacion);
  return { ...v, analisis, estado: estadoDe(analisis, 'disponible', true) };
});

function rol(roles) {
  return roles.length === 0 ? 'cualquier sesión' : roles.join(' · ');
}

function lista(xs, vacio = '—') {
  return xs.length === 0 ? vacio : xs.join(', ');
}

const lineas = [];
lineas.push('# Inventario de vistas del diseñador y cableado real');
lineas.push('');
lineas.push(
  `Carril 01. ${filasSecciones.length} secciones del registro, ` +
    `${filasHijas.length} pantallas hijas o de operación y ` +
    `${filasDisenador.length} vistas portadas desde la bóveda.`,
);
lineas.push('');
lineas.push('## Estados');
lineas.push('');
lineas.push('| Estado | Qué significa |');
lineas.push('|---|---|');
lineas.push('| `conectada` | Inyecta al menos un cliente de `core/data-access`. |');
lineas.push('| `conectada con deuda` | Lee la API, pero además arrastra un marcador (`TODO`, dato de muestra). |');
lineas.push('| `presentacional` | Pinta sin pedir nada. Correcto si es un panel de acciones; sospechoso si debía listar. |');
lineas.push('| `maqueta portada` | Vista de la bóveda con marcado estático. Es el entregable del diseñador, no una pantalla a medio hacer. |');
lineas.push('| `maqueta` | Pinta con constantes `_DE_MUESTRA` fuera de `alovida/`. |');
lineas.push('| `con deuda` | Tiene `TODO`, promesa sin pantalla u otro marcador. |');
lineas.push('| `placeholder` | Sección declarada `planificada`: cae en `SectionPlaceholder` a propósito. |');
lineas.push('');

lineas.push('## Secciones del menú');
lineas.push('');
lineas.push('| Rol | Ruta | Vista actual | API que usa | Estado | Acción |');
lineas.push('|---|---|---|---|---|---|');
for (const f of filasSecciones) {
  const vista = f.pantalla === null ? '`SectionPlaceholder`' : `\`${f.pantalla.componente}\``;
  const accion =
    f.estado === 'placeholder'
      ? 'ninguna — declarada planificada'
      : f.estado === 'maqueta' || f.estado === 'maqueta portada'
        ? 'cablear contra su API'
        : f.estado === 'con deuda' || f.estado === 'conectada con deuda'
          ? `resolver: ${lista(f.analisis.olores)}`
          : f.estado === 'presentacional'
            ? 'verificar que no deba listar'
            : 'ninguna';
  lineas.push(
    `| ${rol(f.roles)} | \`/${f.path}\` | ${vista} | ${lista(f.analisis.apis)} | ${f.estado} | ${accion} |`,
  );
}
lineas.push('');

lineas.push('## Pantallas hijas y de operación');
lineas.push('');
lineas.push('| Rol | Ruta | Vista actual | API que usa | Estado |');
lineas.push('|---|---|---|---|---|');
for (const f of filasHijas.sort((a, b) => a.ruta.localeCompare(b.ruta))) {
  lineas.push(
    `| ${rol(f.roles)} | \`/${f.ruta}\` | \`${f.componente}\` | ${lista(f.analisis.apis)} | ${f.estado} |`,
  );
}
lineas.push('');

const maquetas = filasDisenador.filter((f) => f.estado === 'maqueta');
lineas.push('## Vistas del diseñador portadas desde la bóveda');
lineas.push('');
lineas.push(
  `Las ${filasDisenador.length} pantallas de \`features/alovida/\`, generadas por ` +
    '`scripts/port-vistas-alovida.mjs` desde la bóveda. Son **la vista del ' +
    'diseñador** a la que se refiere la corrección #8: antes de crear una ' +
    'pantalla nueva hay que buscar acá. ' +
    `${maquetas.length} todavía pintan con datos de muestra.`,
);
lineas.push('');
lineas.push('| Código | Actor | Ruta | Componente | API que usa | Estado |');
lineas.push('|---|---|---|---|---|---|');
for (const f of filasDisenador) {
  lineas.push(
    `| ${f.codigo} | ${f.actor ?? '—'} | \`${f.ruta}\` | \`${f.nombre}\` | ${lista(f.analisis.apis)} | ${f.estado} |`,
  );
}
lineas.push('');

const resumen = {};
for (const f of [...filasSecciones, ...filasHijas, ...filasDisenador]) {
  resumen[f.estado] = (resumen[f.estado] ?? 0) + 1;
}
lineas.push('## Recuento');
lineas.push('');
lineas.push('| Estado | Pantallas |');
lineas.push('|---|---|');
for (const [estado, total] of Object.entries(resumen).sort((a, b) => b[1] - a[1])) {
  lineas.push(`| ${estado} | ${total} |`);
}
lineas.push('');

const contenido = AVISO + lineas.join('\n');

/**
 * La misma lista, en datos, para el barrido del carril 19.
 *
 * Las rutas con parámetro (`:profileId`) se marcan y **no** se emiten como
 * navegables: abrirlas con un identificador inventado mide el manejo de un 404
 * del backend, que es otra prueba y no la de que la pantalla existe.
 */
const catalogo = {
  generadoPor: 'scripts/audit-design-views.mjs',
  secciones: filasSecciones.map((f) => ({
    ruta: `/${f.path}`,
    etiqueta: f.label,
    grupo: f.group,
    roles: f.roles,
    rolesExclusivos: f.exclusiveRoles === true,
    componente: f.pantalla?.componente ?? 'SectionPlaceholder',
    apis: f.analisis.apis,
    estado: f.estado,
    parametrizada: f.path.includes(':'),
  })),
  hijas: filasHijas.map((f) => ({
    ruta: `/${f.ruta}`,
    seccion: f.seccion,
    roles: f.roles,
    componente: f.componente,
    apis: f.analisis.apis,
    estado: f.estado,
    parametrizada: f.ruta.includes(':'),
  })),
  portadas: filasDisenador.map((f) => ({
    ruta: f.ruta,
    codigo: f.codigo,
    actor: f.actor,
    componente: f.nombre,
    estado: f.estado,
    parametrizada: f.ruta.includes(':'),
  })),
};
const contenidoJson = `${JSON.stringify(catalogo, null, 2)}\n`;

if (checkOnly) {
  const desactualizados = [
    [OUT, contenido],
    [OUT_JSON, contenidoJson],
  ].filter(([archivo, esperado]) => {
    const actual = existsSync(archivo) ? readFileSync(archivo, 'utf8') : '';
    return actual !== esperado;
  });

  if (desactualizados.length > 0) {
    console.error(
      `✗ ${desactualizados.length} salida(s) del auditor quedaron desactualizadas.\n` +
        '  Volvé a correr: node scripts/audit-design-views.mjs',
    );
    process.exit(1);
  }
  console.log('✓ inventario de vistas y catálogo de rutas al día');
} else {
  mkdirSync(join(DOCS_ROOT, 'reports/generated'), { recursive: true });
  writeFileSync(OUT, contenido, 'utf8');
  writeFileSync(OUT_JSON, contenidoJson, 'utf8');
  console.log('✓ docs/reports/generated/design-view-inventory.md');
  console.log('✓ docs/reports/generated/rutas.json');
  for (const [estado, total] of Object.entries(resumen).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${estado}: ${total}`);
  }
}
