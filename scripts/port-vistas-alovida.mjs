/* ============================================================================
    Porta las maquetas HTML de la bóveda a componentes Angular.

    Fuente: SALUD/Vistas/HTML/**.html en el vault de documentación — 133
    pantallas maquetadas contra ALOVIDA v1.1. Cada archivo es una página
    completa: marco (nav + header, o header público + pie), contenido, y una
    barra de andamiaje al final que no es parte del producto.

    Acá se separa lo que se repite de lo que no:
      · el marco sale UNA vez, a los dos shells de src/app/features/alovida/shell
      · el contenido de `<main class="app-main__inner">` sale a un componente
        por pantalla, que el shell pinta en su <router-outlet>

    ARCHIVO GENERADOR. Lo que produce se puede editar a mano; si se vuelve a
    correr, lo pisa. Ver PORT-ALOVIDA.md.
    ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { JSDOM } from 'jsdom';

const VAULT =
  '/Users/pablo/Documents/GitHub/mantra_core_technologies_health_docs/SALUD/Vistas/HTML';
const FRONT = '/Users/pablo/Documents/GitHub/mantra-core-health';
const SALIDA = join(FRONT, 'src/app/features/alovida');

/* Los directorios de módulo se nombran «VNN-slug»; la ruta pública se queda
   con el slug, que es lo que un humano lee en la barra de direcciones. */
const MODULOS = {
  'V02-common': { segmento: 'datos-compartidos', titulo: 'Datos compartidos' },
  'V03-terminology': { segmento: 'terminologia', titulo: 'Terminología' },
  /* «directorio» y no «organizaciones»: el proxy de desarrollo desvía todo lo
     que empieza con `/org` hacia la API, así que una ruta llamada
     `/organizaciones/...` nunca llega al router — la responde el backend con un
     404. Es la misma trampa que documenta proxy.conf.json. */
  'V04-directory': { segmento: 'directorio', titulo: 'Organizaciones' },
  'V05-profiles': { segmento: 'personas', titulo: 'Personas' },
  'V06-authz': { segmento: 'accesos', titulo: 'Identidad y accesos' },
  'V65-buscador': { segmento: 'buscar', titulo: 'Buscador' },
  landing: { segmento: 'inicio', titulo: 'Portada' },
};

// --------------------------------------------------------------- utilidades

function listarHtml(raiz) {
  const salida = [];
  for (const entrada of readdirSync(raiz)) {
    const ruta = join(raiz, entrada);
    if (statSync(ruta).isDirectory()) {
      if (entrada === '_assets' || entrada === 'imagenes') continue;
      salida.push(...listarHtml(ruta));
    } else if (entrada.endsWith('.html')) {
      salida.push(ruta);
    }
  }
  return salida;
}

/** «V04-01-organizaciones-listado» → { codigo: 'V04-01', slug: 'organizaciones-listado' } */
function partirNombre(archivo) {
  const nombre = basename(archivo, '.html');
  const m = /^(V\d{2}-\d{2})-(.+)$/.exec(nombre);
  return m ? { codigo: m[1], slug: m[2] } : { codigo: null, slug: nombre };
}

const pascal = (slug) =>
  slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('')
    .replace(/[^A-Za-z0-9]/g, '');

/* Sin tildes ni eñes en identificadores de TypeScript ni en segmentos de ruta. */
const sinTildes = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '');

// ------------------------------------------------------------- recolección

const archivos = listarHtml(VAULT).sort();
/** Índice de destino: ruta absoluta del .html de la maqueta → ruta Angular. */
const rutaPorArchivo = new Map();
const vistas = [];

for (const archivo of archivos) {
  const rel = relative(VAULT, archivo);
  const partes = rel.split('/');
  const carpeta = partes.length > 1 ? partes[0] : '.';
  const esIndice = basename(archivo) === 'index.html';

  // El índice de la maqueta —el catálogo de pantallas— no es producto.
  if (esIndice && carpeta !== 'landing') continue;

  const modulo = MODULOS[carpeta];
  if (!modulo) continue;

  const { codigo, slug } = partirNombre(archivo);
  const esLanding = carpeta === 'landing';
  const slugFinal = esLanding ? 'portada' : sinTildes(slug);
  const ruta = esLanding ? '/inicio' : `/${modulo.segmento}/${slugFinal}`;

  rutaPorArchivo.set(archivo, ruta);
  vistas.push({
    archivo,
    carpeta,
    modulo,
    codigo,
    slug: slugFinal,
    ruta,
    /* La subcarpeta nombra al actor: security-admin, clinician, publico… Es
       dato de la ficha, y se conserva para el cableado de permisos. */
    actor: partes.length > 2 ? partes[1] : null,
  });
}

/* Colisiones: dos pantallas del mismo módulo con el mismo slug tras quitarle el
   código. Se resuelven devolviéndoles el código, que es único por ficha. */
const porRuta = new Map();
for (const v of vistas) {
  const choque = porRuta.get(v.ruta);
  if (choque) {
    for (const c of [choque, v]) {
      if (!c.codigo) continue;
      rutaPorArchivo.delete(c.archivo);
      c.slug = `${c.codigo.toLowerCase()}-${c.slug}`;
      c.ruta = `/${c.modulo.segmento}/${c.slug}`;
      rutaPorArchivo.set(c.archivo, c.ruta);
      porRuta.set(c.ruta, c);
    }
    continue;
  }
  porRuta.set(v.ruta, v);
}

// --------------------------------------------------------------- conversión

/**
 * El texto de la maqueta es HTML plano, pero Angular lo va a compilar como
 * plantilla: `{{` abriría una interpolación y `@if` un bloque de control. Se
 * neutralizan los dos, sin tocar nada más.
 */
function escaparParaAngular(html) {
  const BLOQUES = /@(if|else|for|empty|switch|case|default|defer|placeholder|loading|error|let)\b/g;
  return html
    .replace(/\{\{/g, "{{ '{{' }}")
    .replace(BLOQUES, (m) => `{{ '${m}' }}`)
    .replace(/data-ng-query-params=/g, '[queryParams]=')
    /* jsdom serializa los atributos en minúsculas, y el selector de la
       directiva del router distingue mayúsculas: `routerlink` no engancha. */
    .replace(/\brouterlink=/g, 'routerLink=');
}

/**
 * Destino de un `index.html` de la maqueta: la primera pantalla portada del
 * módulo al que pertenece. El índice de la raíz apunta a la portada pública.
 */
function portadaDeModulo(destino) {
  if (basename(destino) !== 'index.html') return null;
  const carpeta = basename(dirname(destino));
  if (!MODULOS[carpeta]) return '/inicio';
  return vistas.find((v) => v.carpeta === carpeta)?.ruta ?? '/inicio';
}

/** Reescribe enlaces e imágenes de la maqueta a lo que entiende el front. */
function cablear(documento, archivoOrigen, avisos) {
  const dir = dirname(archivoOrigen);

  documento.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/.test(href)) {
      if (href === '#') {
        /* En la maqueta `#` significa «existe en el mapa, todavía no está
           maquetada». Se conserva como enlace muerto declarado, no navegable,
           para no fabricar una ruta que daría 404. */
        a.removeAttribute('href');
        a.setAttribute('aria-disabled', 'true');
        a.setAttribute('data-sin-destino', '');
      }
      return;
    }
    /* `?estado=paso2` es la navegación entre etapas de un formulario: la misma
       pantalla con otro bloque visible. Se conserva como parámetro de consulta
       y lo atiende AlovidaRuntimeService.fijarEstado(). */
    const soloEstado = /^\?estado=([\w-]+)$/.exec(href);
    if (soloEstado) {
      a.removeAttribute('href');
      a.setAttribute('routerLink', '.');
      /* Un nombre de atributo con corchetes no es HTML válido y jsdom lo
         rechaza: se marca acá y se traduce a `[queryParams]` al serializar. */
      a.setAttribute('data-ng-query-params', `{ estado: '${soloEstado[1]}' }`);
      return;
    }

    const destino = join(dir, href.split('#')[0].split('?')[0]);
    /* Los `index.html` de la maqueta son el catálogo de pantallas del módulo,
       que no es producto. La portada enlaza a varios: se los redirige a la
       primera pantalla real del módulo, que es lo que el enlace prometía. */
    const ruta = rutaPorArchivo.get(destino) ?? portadaDeModulo(destino);
    if (ruta) {
      a.removeAttribute('href');
      a.setAttribute('routerLink', ruta);
      return;
    }
    a.removeAttribute('href');
    a.setAttribute('aria-disabled', 'true');
    a.setAttribute('data-sin-destino', '');
    avisos.push(`enlace sin destino portado: ${href}`);
  });

  documento.querySelectorAll('img[src], use[href]').forEach((el) => {
    const attr = el.tagName === 'IMG' ? 'src' : 'href';
    const valor = el.getAttribute(attr);
    if (valor && valor.includes('imagenes/')) {
      el.setAttribute(attr, `/alovida/imagenes/${basename(valor)}`);
    }
  });

  documento.querySelectorAll('[style*="imagenes/"]').forEach((el) => {
    el.setAttribute(
      'style',
      el
        .getAttribute('style')
        .replace(/url\(['"]?[^'")]*imagenes\/([^'")]+)['"]?\)/g, "url('/alovida/imagenes/$1')"),
    );
  });

  /* El rol y el estado del interruptor de tema los pone ahora
     AlovidaThemeToggleDirective, que es quien sabe qué tema se está pintando.
     Dejarlos escritos acá los congelaría en el valor que tenían al maquetar. */
  documento.querySelectorAll('[app-theme-toggle]').forEach((boton) => {
    ['role', 'type', 'aria-checked', 'aria-label'].forEach((attr) => boton.removeAttribute(attr));
  });

  /* El selector de pantalla y la barra de estados son andamiaje de la maqueta
     estática: acá cada vista renderiza su estado real. */
  documento.querySelectorAll('.barra-maqueta, [data-ir-a-pantalla], script').forEach((el) => {
    el.remove();
  });
}

/**
 * Sin la barra de andamiaje no hay quién conmute los estados de la pantalla.
 * Los bloques alternativos de `.app-view-state-host` ya vienen con `hidden` en
 * el markup; lo que no lo trae son los elementos `[data-solo-estado]`, que en
 * la maqueta ocultaba el JavaScript al arrancar. Se ocultan acá, contra el
 * estado por defecto, que es el primero que declara la pantalla.
 */
function fijarEstadoPorDefecto(documento) {
  const primerHost = documento.querySelector('.app-view-state-host [data-estado]');
  const defecto = primerHost?.getAttribute('data-estado') ?? 'datos';
  documento.querySelectorAll('[data-solo-estado]').forEach((el) => {
    const estados = (el.getAttribute('data-solo-estado') ?? '').split(',').map((s) => s.trim());
    if (!estados.includes(defecto)) {
      el.setAttribute('hidden', '');
    }
  });
  return defecto;
}

/** Título de la pantalla: sale del <title> de la maqueta, sin la marca. */
function titulo(documento) {
  const bruto = documento.querySelector('title')?.textContent ?? '';
  return bruto.replace(/\s*—\s*AloVida\s*$/, '').trim();
}

// -------------------------------------------------------------- generación

/* Se limpia sólo lo generado. `shell/` queda: los dos marcos se escriben a
   mano una vez —son el nav y el header de la maqueta, con la navegación
   dirigida por datos— y el generador no tiene por qué pisarlos. */
for (const modulo of Object.values(MODULOS)) {
  rmSync(join(SALIDA, modulo.segmento), { recursive: true, force: true });
}
for (const archivo of ['vistas.manifest.json', 'marcos.crudos.json', 'alovida.routes.ts', 'alovida-nav.data.ts']) {
  rmSync(join(SALIDA, archivo), { force: true });
}
mkdirSync(SALIDA, { recursive: true });

const avisosGlobales = [];
const generadas = [];
let marcoPrivado = null;
let marcoPublico = null;
const navPorModulo = new Map();

for (const vista of vistas) {
  const crudo = readFileSync(vista.archivo, 'utf8');
  const dom = new JSDOM(crudo);
  const doc = dom.window.document;

  const avisos = [];
  cablear(doc, vista.archivo, avisos);
  const estado = fijarEstadoPorDefecto(doc);

  const esPrivada = !!doc.querySelector('.app-shell');
  const esPublica = !!doc.querySelector('.app-public-shell');
  const arquetipo = doc.body.getAttribute('data-arquetipo');

  // El marco se guarda de la primera pantalla que lo trae y no se repite más.
  if (esPrivada && !marcoPrivado) {
    marcoPrivado = {
      nav: doc.querySelector('.app-side-nav')?.outerHTML ?? '',
      header: doc.querySelector('.app-header')?.outerHTML ?? '',
    };
  }

  /* El nav de cada maqueta trae desplegado SÓLO el módulo de la pantalla que
     se está viendo. Se recoge una vez por módulo: de ahí sale la lista de
     secciones del cajón y el rótulo con el que el módulo aparece en el nav. */
  if (esPrivada && !navPorModulo.has(vista.carpeta)) {
    const activo = doc.querySelector('.app-side-nav__group > a[aria-current="true"] span');
    const sub = [...doc.querySelectorAll('.app-side-nav__sub > a')].map((a) => ({
      etiqueta: (a.textContent ?? '').trim(),
      ruta: a.getAttribute('routerLink') ?? a.getAttribute('routerlink'),
    }));
    if (sub.length) {
      navPorModulo.set(vista.carpeta, {
        segmento: vista.modulo.segmento,
        rotulo: (activo?.textContent ?? vista.modulo.titulo).trim(),
        secciones: sub.filter((s) => s.ruta),
      });
    }
  }
  if (esPublica && !marcoPublico) {
    marcoPublico = {
      header: doc.querySelector('.app-public-header')?.outerHTML ?? '',
      pie: doc.querySelector('.app-public-pie')?.outerHTML ?? '',
    };
  }

  let contenido;
  if (vista.carpeta === 'landing') {
    // La portada no usa el marco: es su propio lienzo de punta a punta.
    doc.querySelectorAll('script').forEach((el) => el.remove());
    contenido = doc.body.innerHTML;
  } else {
    contenido = doc.querySelector('main.app-main__inner')?.innerHTML ?? doc.body.innerHTML;
  }

  /* `organizaciones/organizaciones-listado` no necesita llamarse
     OrganizacionesOrganizacionesListado: si el slug ya arranca con el nombre
     del módulo, alcanza con el slug. */
  const baseNombre = vista.slug.startsWith(`${vista.modulo.segmento}-`)
    ? vista.slug
    : `${vista.modulo.segmento}-${vista.slug}`;
  const nombre = pascal(baseNombre);
  const carpetaSalida = join(SALIDA, vista.modulo.segmento, vista.slug);
  mkdirSync(carpetaSalida, { recursive: true });

  const selector = `app-alovida-${sinTildes(baseNombre)}`;
  const plantilla = escaparParaAngular(contenido.trim());

  /* Sólo se importa lo que la plantilla usa: un import de más es un
     NG8113 por pantalla, y son 126. */
  const usados = [];
  if (/\brouterLink=/.test(plantilla)) {
    usados.push({ simbolo: 'RouterLink', desde: '@angular/router' });
  }
  if (/app-theme-toggle/.test(plantilla)) {
    usados.push({
      simbolo: 'AlovidaThemeToggleDirective',
      desde: '@core/alovida/alovida-theme-toggle.directive',
    });
  }
  const imports = usados.length ? `\n  imports: [${usados.map((u) => u.simbolo).join(', ')}],` : '';
  const lineasImport = usados.length
    ? `\n${usados.map((u) => `import { ${u.simbolo} } from '${u.desde}';`).join('\n')}\n`
    : '';

  writeFileSync(
    join(carpetaSalida, `${vista.slug}.html`),
    `${plantilla}\n`,
    'utf8',
  );

  writeFileSync(
    join(carpetaSalida, `${vista.slug}.ts`),
    `/* ${titulo(doc)}
   Portada de ${relative(VAULT, vista.archivo)} en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { Component } from '@angular/core';
${lineasImport}
@Component({
  selector: '${selector}',${imports}
  templateUrl: './${vista.slug}.html',
})
export class ${nombre} {}
`,
    'utf8',
  );

  generadas.push({
    ...vista,
    nombre,
    selector,
    titulo: titulo(doc),
    arquetipo,
    estado,
    marco: vista.carpeta === 'landing' ? 'lienzo' : esPublica ? 'publico' : 'privado',
    importacion: `@features/alovida/${vista.modulo.segmento}/${vista.slug}/${vista.slug}`,
  });
  avisos.forEach((a) => avisosGlobales.push(`${relative(VAULT, vista.archivo)}: ${a}`));
}

writeFileSync(
  join(SALIDA, 'vistas.manifest.json'),
  `${JSON.stringify(
    {
      generadas: generadas.map((g) => ({
        codigo: g.codigo,
        titulo: g.titulo,
        ruta: g.ruta,
        marco: g.marco,
        arquetipo: g.arquetipo,
        actor: g.actor,
        nombre: g.nombre,
        importacion: g.importacion,
        origen: relative(VAULT, g.archivo),
      })),
      marcos: { privado: !!marcoPrivado, publico: !!marcoPublico },
    },
    null,
    2,
  )}\n`,
  'utf8',
);

// --------------------------------------------------- navegación del cajón

const navGenerado = `/* ============================================================================
    Secciones del nav lateral, por módulo.

    ARCHIVO GENERADO por scripts/port-vistas-alovida.mjs. Sale del propio nav de
    las maquetas: cada pantalla de la bóveda trae desplegado el módulo al que
    pertenece, y de ahí se recoge la lista. Los rótulos y el orden son los de
    la bóveda, no una interpretación.
    ========================================================================== */

/** Una entrada del submenú de un módulo. */
export interface SeccionAlovida {
  readonly etiqueta: string;
  readonly ruta: string;
}

/** Un módulo del nav, con sus secciones maquetadas. */
export interface ModuloAlovida {
  readonly segmento: string;
  readonly rotulo: string;
  readonly secciones: readonly SeccionAlovida[];
}

export const MODULOS_ALOVIDA: readonly ModuloAlovida[] = ${JSON.stringify(
  [...navPorModulo.values()],
  null,
  2,
).replace(/"([a-z]+)":/g, '$1:')} as const;

/** Índice por segmento, que es lo que trae la URL. */
export const MODULO_POR_SEGMENTO = new Map<string, ModuloAlovida>(
  MODULOS_ALOVIDA.map((modulo) => [modulo.segmento, modulo]),
);
`;
writeFileSync(join(SALIDA, 'alovida-nav.data.ts'), navGenerado, 'utf8');

// ------------------------------------------------------------------ rutas

const porModuloRutas = new Map();
for (const g of generadas) {
  const clave = g.marco === 'lienzo' ? '__lienzo' : g.marco === 'publico' ? '__publico' : g.modulo.segmento;
  if (!porModuloRutas.has(clave)) porModuloRutas.set(clave, []);
  porModuloRutas.get(clave).push(g);
}

/* El arquetipo viaja en los datos de la ruta y el marco lo estampa en el
   <body>: la hoja tiene reglas de composición que cuelgan de él
   (`body[data-arquetipo="formulario"] .app-main__inner { gap: … }`). En la
   maqueta estaba escrito en el <body> de cada archivo. */
const datosDeRuta = (g) => (g.arquetipo ? `\n        data: { arquetipo: '${g.arquetipo}' },` : '');

const rutaHija = (g) =>
  `      {
        path: '${g.slug}',
        title: ${JSON.stringify(g.titulo)},${datosDeRuta(g)}
        loadComponent: () =>
          import('${g.importacion}').then((m) => m.${g.nombre}),
      },`;

const publicas = porModuloRutas.get('__publico') ?? [];
const lienzo = porModuloRutas.get('__lienzo') ?? [];

/* Cada módulo cuelga de su propio segmento y monta el marco ahí, en lugar de
   agrupar todo bajo una ruta de path vacío. Es a propósito: el armazón que ya
   tenía la aplicación también vive en `path: ''`, y dos padres vacíos
   compitiendo por la misma URL dejan el ruteo dependiendo de que el router
   retroceda. Con el segmento explícito no hay ambigüedad que resolver. */
const grupoConMarco = (segmento, lista, marco) => `  {
    path: '${segmento}',
    loadComponent: () =>
      import('@features/alovida/shell/${marco.archivo}').then((m) => m.${marco.clase}),
    children: [
      { path: '', pathMatch: 'full', redirectTo: '${lista[0].slug}' },
${lista.map(rutaHija).join('\n')}
    ],
  },`;

const bloquesPrivados = [...porModuloRutas.entries()]
  .filter(([clave]) => !clave.startsWith('__'))
  .map(([segmento, lista]) =>
    grupoConMarco(segmento, lista, { archivo: 'alovida-shell', clase: 'AlovidaShell' }),
  )
  .join('\n');

const bloquePublico = publicas.length
  ? grupoConMarco(publicas[0].modulo.segmento, publicas, {
      archivo: 'alovida-public-shell',
      clase: 'AlovidaPublicShell',
    })
  : '';

const rutasGeneradas = `/* ============================================================================
    Rutas de las pantallas portadas desde la bóveda.

    ARCHIVO GENERADO por scripts/port-vistas-alovida.mjs. Tres marcos: la portada
    va sin marco —es su propio lienzo de punta a punta—, el buscador va bajo el
    marco público, y los cinco módulos de sesión bajo el marco con nav y header.

    Cada pantalla se carga por demanda: son ${generadas.length}, y ninguna sesión
    las abre todas. El title y el arquetipo salen de la ficha de la bóveda.
    ========================================================================== */

import { Routes } from '@angular/router';

export const ALOVIDA_ROUTES: Routes = [
${lienzo
  .map(
    (g) => `  {
    path: '${g.ruta.replace(/^\//, '')}',
    title: ${JSON.stringify(g.titulo)},${datosDeRuta(g).replace(/\n        /g, '\n    ')}
    loadComponent: () => import('${g.importacion}').then((m) => m.${g.nombre}),
  },`,
  )
  .join('\n')}
${bloquePublico}
${bloquesPrivados}
];
`;
writeFileSync(join(SALIDA, 'alovida.routes.ts'), rutasGeneradas, 'utf8');

writeFileSync(
  join(SALIDA, 'marcos.crudos.json'),
  `${JSON.stringify({ privado: marcoPrivado, publico: marcoPublico }, null, 2)}\n`,
  'utf8',
);

const porMarco = generadas.reduce((acc, g) => ({ ...acc, [g.marco]: (acc[g.marco] ?? 0) + 1 }), {});
console.log(`vistas portadas: ${generadas.length}`, porMarco);
if (avisosGlobales.length) {
  console.log(`\navisos (${avisosGlobales.length}):`);
  avisosGlobales.slice(0, 20).forEach((a) => console.log(`  · ${a}`));
  if (avisosGlobales.length > 20) console.log(`  … y ${avisosGlobales.length - 20} más`);
}
