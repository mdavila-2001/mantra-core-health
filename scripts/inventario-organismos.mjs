#!/usr/bin/env node
/* ============================================================================
    El grafo de usos de los organismos canónicos, con la relación diferenciada.

    `generate-component-index.mjs` responde «quién importa a quién» leyendo el
    array `imports: [...]` del decorador. Eso dice que la pieza está
    **disponible**, no que se instancie: un import olvidado cuenta igual que
    una tabla montada de verdad. Para decidir una extracción hace falta
    distinguir, y esto lo distingue:

      imports-available     la clase está en `imports: [...]` del componente
      template-instantiates la plantilla tiene `<app-x` (con su condición)
      projection-composes   el consumidor aporta contenido a una ranura
      type-only             importa tipos del contrato, no la pieza visual
      dynamic-loads         alguien la carga con `import()` / `createComponent`

    Y separa **producto** (lo que se despliega), **maqueta** (`features/alovida`,
    referencia de diseño que no se migra — ADR-0014), **catálogo** (el banco y
    la vitrina) y **prueba** (`.spec.ts`), porque contar las cuatro juntas es
    la forma más fácil de inflar una adopción.

    Es análisis de texto sobre las mismas convenciones que `lib/scan.mjs`: no
    certifica composición —eso lo hace el compilador de plantillas de Angular—,
    pero cada arista lleva archivo y línea para poder ir a mirarla.

    Uso:
      node scripts/inventario-organismos.mjs           escribe JSON y Markdown
      node scripts/inventario-organismos.mjs --check   falla si están viejos
    ========================================================================== */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { read, REPO_ROOT, repoPath, SRC_ROOT, walk } from './lib/scan.mjs';

const SALIDA_JSON = 'docs/frontend/refactor-declarativo/usos-organismos.json';
const SALIDA_MD = 'docs/frontend/refactor-declarativo/usos-organismos.md';

/** Las piezas cuyo uso real interesa: los seis organismos y la regla extraída. */
const PIEZAS = [
  {
    id: 'shared/components/organisms/data-table/data-table',
    clase: 'DataTable',
    selector: 'app-data-table',
    ranuras: [],
    tipos: 'shared/components/organisms/data-table/data-table.types',
  },
  {
    id: 'shared/components/organisms/content-dialog/content-dialog',
    clase: 'ContentDialog',
    selector: 'app-content-dialog',
    ranuras: ['dialog-actions'],
    tipos: null,
  },
  {
    id: 'shared/components/organisms/view-state-host/view-state-host',
    clase: 'ViewStateHost',
    selector: 'app-view-state-host',
    ranuras: [
      'vsh-auth-pending',
      'vsh-skeleton',
      'vsh-empty',
      'vsh-validation',
      'vsh-forbidden',
      'vsh-not-found',
      'vsh-offline',
      'vsh-error',
      'vsh-stale',
    ],
    tipos: 'core/view-state/view-state.types',
  },
  {
    id: 'shared/components/organisms/filter-bar/filter-bar',
    clase: 'FilterBar',
    selector: 'app-filter-bar',
    ranuras: [],
    tipos: null,
  },
  {
    id: 'shared/components/organisms/page-header/page-header',
    clase: 'PageHeader',
    selector: 'app-page-header',
    ranuras: ['page-actions', 'page-meta'],
    tipos: null,
  },
  {
    id: 'shared/components/organisms/directory-page/directory-page',
    clase: 'DirectoryPage',
    selector: 'app-directory-page',
    ranuras: ['slot=antes-de-filtros', 'slot=portada'],
    tipos: 'shared/components/organisms/directory-page/directory-page.types',
  },
  {
    id: 'shared/components/organisms/data-table/cursor-history',
    clase: 'historialDeCursor',
    selector: null,
    ranuras: [],
    tipos: null,
  },
];

/** A qué mundo pertenece un archivo. Se cuentan por separado, siempre. */
function mundoDe(path) {
  if (path.endsWith('.spec.ts')) return 'prueba';
  if (path.includes('/features/alovida/')) return 'maqueta';
  if (path.includes('/features/component-stock/') || path.includes('/features/design-system-sample/')) {
    return 'catalogo';
  }
  if (path.includes('/shared/components/organisms/')) return 'organismo';
  return 'producto';
}

/**
 * La condición bajo la que se renderiza una línea: el bloque de control de
 * flujo (`@if`, `@for`, `@switch`/`@case`, `@else`) más cercano que la
 * contiene, o «siempre». Se recorre hacia atrás contando llaves.
 */
function condicionDe(lineas, indice) {
  let profundidad = 0;
  for (let i = indice; i >= 0; i -= 1) {
    const linea = lineas[i];
    // Las llaves de la propia línea del match no cuentan como cierre.
    if (i !== indice) {
      profundidad += (linea.match(/}/g) ?? []).length;
      profundidad -= (linea.match(/{/g) ?? []).length;
    }
    if (profundidad < 0) {
      const control = /@(if|for|else if|else|switch|case|default|defer)\b[^{]*/.exec(linea);
      if (control !== null) return control[0].trim();
      // Una llave que abre sin control de flujo (un `@let`, un objeto): se
      // sigue subiendo con la profundidad corregida.
      profundidad = 0;
    }
  }
  return 'siempre';
}

/** La plantilla de un componente: inline o en su `.html` hermano. */
function plantillaDe(file, source) {
  const inline = /template:\s*`([\s\S]*?)`/.exec(source)?.[1];
  if (inline !== undefined) return { texto: inline, path: repoPath(file) };
  const html = file.replace(/\.ts$/, '.html');
  if (existsSync(html)) return { texto: read(html), path: repoPath(html) };
  return null;
}

// Los `.spec.ts` entran a propósito: sus anfitriones de prueba también
// instancian organismos, y se cuentan en su propio mundo («prueba»).
const componentes = walk(SRC_ROOT, ['.ts'])
  .map((file) => ({ file, source: read(file) }))
  .filter(({ source }) => /@Component\(/.test(source))
  .map(({ file, source }) => ({
    file,
    path: repoPath(file),
    clase: /export class (\w+)/.exec(source)?.[1] ?? '(sin clase)',
    source,
    importa: (/imports:\s*\[([\s\S]*?)\]/.exec(source)?.[1] ?? '')
      .split(',')
      .map((x) => x.replace(/\/\/.*$/gm, '').trim())
      .filter((x) => /^[A-Z]\w*$/.test(x)),
    plantilla: plantillaDe(file, source),
  }));

const todosLosTs = walk(SRC_ROOT, ['.ts']).map((file) => ({ file, path: repoPath(file), source: read(file) }));

const usos = [];

for (const pieza of PIEZAS) {
  const esComponente = pieza.selector !== null;

  for (const componente of componentes) {
    const consumerId = componente.path.replace(/^src\/app\//, '').replace(/\.ts$/, '');
    if (consumerId === pieza.id) continue;

    const disponible = esComponente && componente.importa.includes(pieza.clase);
    if (disponible) {
      usos.push({
        consumerId,
        componentId: pieza.id,
        relation: 'imports-available',
        sourceLocation: componente.path,
        renderCondition: null,
        productOrSupport: mundoDe(componente.path),
        verificationStatus: 'estatico',
      });
    }

    if (esComponente && componente.plantilla !== null) {
      const lineas = componente.plantilla.texto.split('\n');
      // El selector suele ir solo en su línea, con los atributos debajo: el
      // final de línea cuenta como límite.
      const patron = new RegExp(`<${pieza.selector}(?=[\\s>/]|$)`);
      let instancias = 0;
      lineas.forEach((linea, indice) => {
        if (!patron.test(linea)) return;
        instancias += 1;
        usos.push({
          consumerId,
          componentId: pieza.id,
          relation: 'template-instantiates',
          sourceLocation: `${componente.plantilla.path}:${indice + 1}`,
          renderCondition: condicionDe(lineas, indice),
          productOrSupport: mundoDe(componente.path),
          // Sin la clase en `imports`, el selector es un elemento desconocido:
          // Angular no instancia nada y el `<app-x>` queda vacío.
          verificationStatus: disponible ? 'estatico' : 'selector-sin-importar',
        });
      });

      for (const ranura of pieza.ranuras) {
        // El atributo de ranura también suele ir solo en su línea.
        const conRanura = new RegExp(`\\b${ranura.replace('=', '=["\']?')}["\']?(?:[\\s>]|$)`);
        lineas.forEach((linea, indice) => {
          if (!conRanura.test(linea) || instancias === 0) return;
          usos.push({
            consumerId,
            componentId: pieza.id,
            relation: 'projection-composes',
            sourceLocation: `${componente.plantilla.path}:${indice + 1}`,
            renderCondition: ranura,
            productOrSupport: mundoDe(componente.path),
            verificationStatus: 'estatico',
          });
        });
      }
    }
  }

  for (const archivo of todosLosTs) {
    const consumerId = archivo.path.replace(/^src\/app\//, '').replace(/\.ts$/, '');
    if (consumerId === pieza.id) continue;

    if (pieza.tipos !== null) {
      const modulo = pieza.tipos.split('/').at(-1);
      const soloTipos = new RegExp(`import type \\{[^}]*\\} from '[^']*/${modulo}'`);
      if (soloTipos.test(archivo.source)) {
        usos.push({
          consumerId,
          componentId: pieza.id,
          relation: 'type-only',
          sourceLocation: archivo.path,
          renderCondition: null,
          productOrSupport: mundoDe(archivo.path),
          verificationStatus: 'estatico',
        });
      }
    }

    if (!esComponente) {
      const modulo = pieza.id.split('/').at(-1);
      const importaFuncion = new RegExp(`import \\{[^}]*\\b${pieza.clase}\\b[^}]*\\} from '[^']*/${modulo}'`);
      if (importaFuncion.test(archivo.source)) {
        usos.push({
          consumerId,
          componentId: pieza.id,
          relation: 'imports-available',
          sourceLocation: archivo.path,
          renderCondition: null,
          productOrSupport: mundoDe(archivo.path),
          verificationStatus: 'estatico',
        });
        const llamadas = (archivo.source.match(new RegExp(`\\b${pieza.clase}\\(`, 'g')) ?? []).length;
        if (llamadas > 0) {
          usos.push({
            consumerId,
            componentId: pieza.id,
            relation: 'template-instantiates',
            sourceLocation: archivo.path,
            renderCondition: `${llamadas} llamada(s)`,
            productOrSupport: mundoDe(archivo.path),
            verificationStatus: 'estatico',
          });
        }
      }
    }
  }

  // El banco monta cualquier componente del índice con `createComponent`: es
  // una carga dinámica identificada, distinta de un uso en plantilla.
  if (esComponente) {
    usos.push({
      consumerId: 'features/component-stock/component-stock',
      componentId: pieza.id,
      relation: 'dynamic-loads',
      sourceLocation: 'src/app/features/component-stock/component-index.generated.ts',
      renderCondition: 'ficha elegida en /design-system/stock',
      productOrSupport: 'catalogo',
      verificationStatus: 'estatico',
    });
  }
}

/* ---- hallazgos: lo que el grafo deja ver ----------------------------------- */

const hallazgos = [];
for (const pieza of PIEZAS) {
  if (pieza.selector === null) continue;
  const porConsumidor = new Map();
  for (const uso of usos.filter((u) => u.componentId === pieza.id)) {
    const lista = porConsumidor.get(uso.consumerId) ?? new Set();
    lista.add(uso.relation);
    porConsumidor.set(uso.consumerId, lista);
  }
  for (const [consumerId, relaciones] of porConsumidor) {
    if (relaciones.has('imports-available') && !relaciones.has('template-instantiates')) {
      hallazgos.push({
        tipo: 'import-sin-instanciar',
        componentId: pieza.id,
        consumerId,
        detalle: `${pieza.clase} está en imports pero la plantilla no usa <${pieza.selector}>`,
      });
    }
  }
  for (const uso of usos.filter((u) => u.componentId === pieza.id && u.verificationStatus === 'selector-sin-importar')) {
    hallazgos.push({
      tipo: 'selector-sin-importar',
      componentId: pieza.id,
      consumerId: uso.consumerId,
      detalle: `<${pieza.selector}> en ${uso.sourceLocation} sin ${pieza.clase} en imports: no se instancia`,
    });
  }
}

/* ---- resumen --------------------------------------------------------------- */

const MUNDOS = ['producto', 'organismo', 'catalogo', 'maqueta', 'prueba'];

function resumenDe(pieza) {
  const propios = usos.filter((u) => u.componentId === pieza.id);
  const consumidores = (relation, mundo) =>
    new Set(propios.filter((u) => u.relation === relation && u.productOrSupport === mundo).map((u) => u.consumerId)).size;
  return {
    componentId: pieza.id,
    clase: pieza.clase,
    instanciadoEn: Object.fromEntries(MUNDOS.map((m) => [m, consumidores('template-instantiates', m)])),
    disponibleEn: Object.fromEntries(MUNDOS.map((m) => [m, consumidores('imports-available', m)])),
    proyectanContenido: consumidores('projection-composes', 'producto'),
    soloTipos: consumidores('type-only', 'producto'),
  };
}

const resumen = PIEZAS.map(resumenDe);

const json = {
  schemaVersion: 1,
  generadoPor: 'scripts/inventario-organismos.mjs',
  sourceCommit: process.env['SOURCE_COMMIT'] ?? 'ver `git rev-parse HEAD` al generar',
  relaciones: ['imports-available', 'template-instantiates', 'projection-composes', 'type-only', 'dynamic-loads'],
  mundos: MUNDOS,
  resumen,
  hallazgos,
  usos: usos.sort(
    (a, b) =>
      a.componentId.localeCompare(b.componentId) ||
      a.relation.localeCompare(b.relation) ||
      a.sourceLocation.localeCompare(b.sourceLocation),
  ),
};

const md = [
  '# Usos de los organismos canónicos',
  '',
  'Generado por `node scripts/inventario-organismos.mjs`. No editar a mano: se regenera.',
  '',
  'Cada arista lleva **relación**, **archivo y línea**, **condición de renderizado** y **mundo**',
  '(producto, organismo, catálogo, maqueta o prueba). Un `imports-available` sin',
  '`template-instantiates` es una pieza disponible que nadie monta. El detalle completo, con',
  'todas las aristas, está en `usos-organismos.json`.',
  '',
  '## Consumidores por mundo (componentes distintos que instancian la pieza)',
  '',
  '| Pieza | Producto | Catálogo | Maqueta | Organismo | Prueba | Proyectan contenido (producto) | Importan solo tipos (producto) |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...resumen.map(
    (r) =>
      `| \`${r.clase}\` | ${r.instanciadoEn.producto} | ${r.instanciadoEn.catalogo} | ${r.instanciadoEn.maqueta} | ${r.instanciadoEn.organismo} | ${r.instanciadoEn.prueba} | ${r.proyectanContenido} | ${r.soloTipos} |`,
  ),
  '',
  `## Hallazgos (${hallazgos.length})`,
  '',
  ...(hallazgos.length === 0
    ? ['Ninguno: todo import de un organismo se instancia, y todo selector está importado.']
    : ['| Tipo | Pieza | Consumidor | Detalle |', '|---|---|---|---|', ...hallazgos.map((h) => `| ${h.tipo} | \`${h.componentId.split('/').at(-1)}\` | \`${h.consumerId}\` | ${h.detalle} |`)]),
  '',
  '## Condiciones de renderizado en producto',
  '',
  'Cuántas instancias de cada organismo están bajo un control de flujo, y cuántas siempre.',
  '',
  '| Pieza | Siempre | Bajo `@if`/`@for`/`@case` |',
  '|---|---:|---:|',
  ...PIEZAS.filter((p) => p.selector !== null).map((p) => {
    const propios = usos.filter(
      (u) => u.componentId === p.id && u.relation === 'template-instantiates' && u.productOrSupport === 'producto',
    );
    const siempre = propios.filter((u) => u.renderCondition === 'siempre').length;
    return `| \`${p.clase}\` | ${siempre} | ${propios.length - siempre} |`;
  }),
  '',
].join('\n');

const destinoJson = join(REPO_ROOT, SALIDA_JSON);
const destinoMd = join(REPO_ROOT, SALIDA_MD);
const contenidoJson = `${JSON.stringify(json, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const actualJson = existsSync(destinoJson) ? readFileSync(destinoJson, 'utf8') : '';
  const actualMd = existsSync(destinoMd) ? readFileSync(destinoMd, 'utf8') : '';
  const sinCommit = (texto) => texto.replace(/"sourceCommit": "[^"]*"/, '');
  if (sinCommit(actualJson) !== sinCommit(contenidoJson) || actualMd !== md) {
    console.error('✗ el grafo de usos de organismos no refleja el código.');
    console.error('  Ejecutá: node scripts/inventario-organismos.mjs');
    process.exit(1);
  }
  console.log(`✓ grafo de usos al día (${usos.length} aristas, ${hallazgos.length} hallazgos)`);
  process.exit(0);
}

mkdirSync(dirname(destinoJson), { recursive: true });
writeFileSync(destinoJson, contenidoJson);
writeFileSync(destinoMd, md);
console.log(`✓ ${SALIDA_JSON} · ${usos.length} aristas · ${hallazgos.length} hallazgos`);
console.log(`✓ ${SALIDA_MD}`);
for (const r of resumen) {
  console.log(
    `  ${r.clase.padEnd(18)} producto ${String(r.instanciadoEn.producto).padStart(3)} · catálogo ${r.instanciadoEn.catalogo} · maqueta ${r.instanciadoEn.maqueta} · prueba ${r.instanciadoEn.prueba}`,
  );
}
