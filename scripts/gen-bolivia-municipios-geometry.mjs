#!/usr/bin/env node
/**
 * Genera `bolivia-municipalities.geometry.ts`: el contorno de cada municipio
 * de Bolivia, en el mismo sistema de coordenadas que las siluetas de los
 * departamentos, para sombrear el municipio elegido dentro del mapa.
 *
 * Uso:
 *   node scripts/gen-bolivia-municipios-geometry.mjs <adm3.geojson> <bo-geography.catalog.ts>
 *
 * · `adm3.geojson` — geoBoundaries gbOpen `BOL / ADM3` simplificado
 *   (`BOL-ADM3` de GeoBolivia, dominio público). Es un objeto de Git LFS: se
 *   baja de `media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/
 *   releaseData/gbOpen/BOL/ADM3/geoBoundaries-BOL-ADM3_simplified.geojson`.
 * · `bo-geography.catalog.ts` — el catálogo de la API con los 340 municipios
 *   y su código INE (`mantra-core-health-api/src/common/seed/`).
 *
 * Cada polígono se cruza con el catálogo por nombre normalizado **dentro de su
 * departamento** (el departamento sale de la silueta donde cae el punto
 * interior del polígono), así que los siete nombres repetidos entre
 * departamentos no se confunden. Lo que no cruza se declara al final; no se
 * inventa ningún contorno.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , rutaAdm3, rutaCatalogo] = process.argv;
if (!rutaAdm3 || !rutaCatalogo) {
  console.error('Uso: node gen-bolivia-municipios-geometry.mjs <adm3.geojson> <catalogo.ts>');
  process.exit(1);
}

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = join(
  aqui,
  '../src/app/shared/components/organisms/department-map/bolivia-municipalities.geometry.ts',
);
const rutaSilhuetas = join(
  aqui,
  '../src/app/shared/components/organisms/department-map/bolivia-departments.geometry.ts',
);

const TOLERANCIA_GRADOS = 0.02; // ≈ 2 km
const AREA_MINIMA_RELATIVA = 0.02; // islas menores al 2 % del mayor polígono del municipio se caen

/* ---- proyección: la de las siluetas ---------------------------------------- */
const ALTO = 1000;

const adm3 = JSON.parse(readFileSync(rutaAdm3, 'utf8'));

function anillosExteriores(geom) {
  const polis = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return polis.map((p) => p[0]);
}

let minLng = Infinity;
let maxLng = -Infinity;
let minLat = Infinity;
let maxLat = -Infinity;
for (const f of adm3.features) {
  for (const anillo of anillosExteriores(f.geometry)) {
    for (const [lng, lat] of anillo) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
}
const cosLatMedia = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
const escala = ALTO / (maxLat - minLat);
const proyectar = ([lng, lat]) => [(lng - minLng) * cosLatMedia * escala, (maxLat - lat) * escala];
console.log(
  `Proyección: lng0=${minLng} lat1=${maxLat} cos=${cosLatMedia} k=${escala} → ancho ${(
    (maxLng - minLng) *
    cosLatMedia *
    escala
  ).toFixed(1)}`,
);

/* ---- geometría auxiliar ----------------------------------------------------- */
function areaFirmada(anillo) {
  let s = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    s += anillo[j][0] * anillo[i][1] - anillo[i][0] * anillo[j][1];
  }
  return s / 2;
}

function distPuntoSegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function douglasPeucker(pts, tol) {
  if (pts.length < 3) return pts;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distPuntoSegmento(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  const izq = douglasPeucker(pts.slice(0, idx + 1), tol);
  const der = douglasPeucker(pts.slice(idx), tol);
  return [...izq.slice(0, -1), ...der];
}

function simplificarAnillo(anillo, tol) {
  const abierto = anillo.slice(0, -1);
  if (abierto.length < 4) return anillo;
  // Se parte el anillo en dos mitades para que DP no colapse un lazo cerrado.
  const mitad = Math.floor(abierto.length / 2);
  const a = douglasPeucker(abierto.slice(0, mitad + 1), tol);
  const b = douglasPeucker([...abierto.slice(mitad), abierto[0]], tol);
  const res = [...a.slice(0, -1), ...b.slice(0, -1)];
  return res.length >= 3 ? res : abierto;
}

function dentro(punto, anillo) {
  let en = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i];
    const [xj, yj] = anillo[j];
    if (yi > punto[1] !== yj > punto[1] && punto[0] < ((xj - xi) * (punto[1] - yi)) / (yj - yi) + xi) {
      en = !en;
    }
  }
  return en;
}

function distABorde(punto, anillo) {
  let m = Infinity;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    m = Math.min(m, distPuntoSegmento(punto, anillo[j], anillo[i]));
  }
  return m;
}

/** Punto interior lejos del borde (polo de inaccesibilidad, por rejilla refinada). */
function puntoInterior(anillo) {
  let mx0 = Infinity;
  let my0 = Infinity;
  let mx1 = -Infinity;
  let my1 = -Infinity;
  for (const [x, y] of anillo) {
    mx0 = Math.min(mx0, x);
    mx1 = Math.max(mx1, x);
    my0 = Math.min(my0, y);
    my1 = Math.max(my1, y);
  }
  let mejor = null;
  let mejorD = -1;
  let x0 = mx0;
  let x1 = mx1;
  let y0 = my0;
  let y1 = my1;
  for (let ronda = 0; ronda < 4; ronda++) {
    const pasos = 20;
    const sx = (x1 - x0) / pasos;
    const sy = (y1 - y0) / pasos;
    for (let i = 0; i <= pasos; i++) {
      for (let j = 0; j <= pasos; j++) {
        const p = [x0 + i * sx, y0 + j * sy];
        if (!dentro(p, anillo)) continue;
        const d = distABorde(p, anillo);
        if (d > mejorD) {
          mejorD = d;
          mejor = p;
        }
      }
    }
    if (mejor === null) break;
    x0 = mejor[0] - sx;
    x1 = mejor[0] + sx;
    y0 = mejor[1] - sy;
    y1 = mejor[1] + sy;
  }
  return mejor ?? anillo[0];
}

/* ---- siluetas de los departamentos (para saber dónde cae cada polígono) ---- */
const textoSiluetas = readFileSync(rutaSilhuetas, 'utf8');
const siluetas = [...textoSiluetas.matchAll(/sigla: '([A-Z]{2})'[\s\S]*?d: '([^']+)'/g)].map((m) => ({
  sigla: m[1],
  anillos: m[2]
    .split('M')
    .filter(Boolean)
    .map((tramo) =>
      tramo
        .replace('Z', '')
        .split('L')
        .map((par) => par.split(' ').map(Number)),
    ),
}));
if (siluetas.length !== 9) throw new Error(`Se esperaban 9 siluetas, hay ${siluetas.length}`);

function departamentoDe(punto) {
  for (const s of siluetas) {
    if (s.anillos.some((a) => dentro(punto, a))) return s.sigla;
  }
  return null;
}

/* ---- catálogo de la API ----------------------------------------------------- */
const normalizar = (t) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const catalogo = [
  ...readFileSync(rutaCatalogo, 'utf8').matchAll(
    /\{\s*ine: '(\d{6})',\s*name: '([^']+)',\s*province: (?:'[^']+'|"[^"]+"),\s*department: '([A-Z]{2})',?\s*\}/g,
  ),
].map((m) => ({ ine: m[1], nombre: m[2], sigla: m[3] }));
console.log(`Catálogo: ${catalogo.length} municipios`);

/* ---- alias: cómo escribe cada fuente los municipios que no coinciden ------- */
/* `nombre ADM3|sigla` → código INE del catálogo. Se revisó uno por uno: son
   diferencias de escritura («Coro Coro» / «Corocoro») o municipios que el
   catálogo del INE nombra con su capital («San Ignacio de Velasco»). */
const ALIAS = new Map([
  ['Villa Ancoraimes|LP', '020202'],
  ['Corocoro|LP', '020301'],
  ['Nuestra Señora de La Paz|LP', '020101'],
  ['Santiago de Callapa|LP', '020308'],
  ['Puerto Mayor de Carabuco|LP', '020403'],
  ['Puerto Mayor de Guaqui|LP', '020802'],
  ['Tiahuanacu|LP', '020803'],
  ['La (Marka) San Andrés de Mach|LP', '020805'],
  ['Jesús de Machaka|LP', '020806'],
  ['Villa Libertad Licoma|LP', '021006'],
  ['Sicasica|LP', '021301'],
  ['Andamarca|OR', '041201'],
  ['Yunguyo del Litoral|OR', '040504'],
  ['Zudañez|CH', '010301'],
  ['Mojocoya|CH', '010303'],
  ['Villa Ricardo Mugia - Icla|CH', '010304'],
  ['Sopachui|CH', '010403'],
  ['Alcalá|CH', '010404'],
  ['Villa Vaca Guzmán|CH', '011001'],
  ['Ayopaya|CB', '030301'],
  ['Villa Gualberto Villarroel|CB', '031405'],
  ['Sipesipe|CB', '030902'],
  ['Chuquihuta Ayllu Jucumani|PT', '050204'],
  ['San Pedro|PT', '050501'],
  ['Cotagaita|PT', '050601'],
  ['Vitiche|PT', '050602'],
  ['San Pablo|PT', '051001'],
  ['San Ignacio|SC', '070301'],
  ['San Miguel|SC', '070302'],
  ['San Rafael|SC', '070303'],
  ['Yapacaní|SC', '070403'],
  ['San Juan|SC', '070404'],
  ['San José|SC', '070501'],
  ['Santa Rosa|SC', '070602'],
  ['Gutiérrez|SC', '070705'],
  ['Trigal|SC', '070802'],
  ['Moromoro|SC', '070803'],
  ['Pampa Grande|SC', '070902'],
  ['Ascención de Guarayos|SC', '071501'],
  ['Puerto Menor de Rurrenabaque|BE', '080304'],
  ['Santa Ana|BE', '080401'],
  ['San Ignacio|BE', '080501'],
  ['Santa Rosa|PD', '090401'],
]);

/* ---- construir -------------------------------------------------------------- */
const usados = new Set();
const sinCatalogo = [];
const resultado = [];

for (const f of adm3.features) {
  const anillos = anillosExteriores(f.geometry)
    .map((a) => ({ a, area: Math.abs(areaFirmada(a.map(proyectar))) }))
    .sort((x, y) => y.area - x.area);
  const mayor = anillos[0];
  const proyectado = anillos
    .filter((r) => r.area >= mayor.area * AREA_MINIMA_RELATIVA)
    .map((r) => r.a.map(proyectar));
  const interior = puntoInterior(proyectado[0]);
  const sigla = departamentoDe(interior);
  const clave = normalizar(f.properties.shapeName);
  const porAlias = ALIAS.get(`${f.properties.shapeName}|${sigla}`);
  const candidatos = catalogo.filter((c) =>
    porAlias !== undefined
      ? c.ine === porAlias
      : normalizar(c.nombre) === clave && (sigla === null || c.sigla === sigla) && !usados.has(c.ine),
  );
  if (candidatos.length !== 1) {
    sinCatalogo.push(`${f.properties.shapeName} [${sigla}] interior=${interior.map((v) => v.toFixed(0))} → ${candidatos.length} candidatos`);
    continue;
  }
  const ine = candidatos[0];
  if (usados.has(ine.ine)) throw new Error(`INE repetido: ${ine.ine} (${f.properties.shapeName})`);
  usados.add(ine.ine);

  // tolerancia en píxeles: grados → px
  const tolPx = TOLERANCIA_GRADOS * escala;
  const d = proyectado
    .map((anillo) => simplificarAnillo([...anillo, anillo[0]], tolPx))
    .map((anillo) => 'M' + anillo.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z')
    .join('');
  resultado.push({
    ine: ine.ine,
    sigla: ine.sigla,
    nombre: ine.nombre,
    x: Math.round(interior[0] * 10) / 10,
    y: Math.round(interior[1] * 10) / 10,
    d,
  });
}

resultado.sort((a, b) => a.ine.localeCompare(b.ine));
const sinPoligono = catalogo.filter((c) => !usados.has(c.ine));
console.log(`Cruzados: ${resultado.length}`);
console.log(`Polígonos sin catálogo (${sinCatalogo.length}):`, sinCatalogo);
console.log(`Catálogo sin polígono (${sinPoligono.length}):`, sinPoligono.map((c) => `${c.ine} ${c.nombre}`));

/* ---- salida ----------------------------------------------------------------- */
const ENCABEZADO = `/* ============================================================================
    El contorno de cada municipio de Bolivia, para sombrear el municipio
    elegido dentro del mapa de departamentos. **Archivo generado**: no se edita
    a mano; se regenera con \`scripts/gen-bolivia-municipios-geometry.mjs\`.

    ## Fuente declarada — regla \`.claude/rules/70-data-seeders.md\`

    | | |
    |---|---|
    | \`source_name\` | geoBoundaries **gbOpen** — \`BOL / ADM3\` |
    | Origen del dato | **GeoBolivia** (\`geo.gob.bo\`), el geoportal oficial del Estado Plurinacional |
    | Descarga | \`github.com/wmgeolab/geoBoundaries\` \`9469f09\` \`releaseData/gbOpen/BOL/ADM3/geoBoundaries-BOL-ADM3_simplified.geojson\` |
    | Licencia | **Dominio público** (\`boundaryLicense: "Public Domain"\`) |
    | Obtenido | 2026-09-30 |

    ## Qué se le hizo al dato

    1. Cruce con el catálogo de la API (\`bo-geography.catalog.ts\`, código INE
       \`DDPPMM\`) por nombre normalizado **dentro del departamento** donde cae el
       punto interior del polígono: los nombres repetidos entre departamentos no
       se confunden. Lo que no cruzó **no se dibuja** —no se inventa un
       contorno—; el mapa sigue marcando su departamento.
    2. Sólo los anillos exteriores que llegan al 2 % del mayor de su municipio.
    3. Douglas-Peucker a 0,02° (≈ 2 km).
    4. La **misma proyección** que \`bolivia-departments.geometry.ts\` (viewBox
       884 × 1000), para que cada municipio caiga dentro de su departamento.
    5. \`x\`/\`y\` es un punto **interior** lejos del borde (no el centroide: hay
       municipios cóncavos) — donde va el punto cuando no se conoce la dirección.
    ========================================================================== */

/** Un municipio, tal como se dibuja. */
export interface ContornoDeMunicipio {
  /** Código del INE, \`DDPPMM\`. */
  readonly ine: string;
  /** Sigla del departamento al que pertenece. */
  readonly sigla: string;
  /** Nombre como lo escribe el catálogo. */
  readonly nombre: string;
  /** Punto interior, en coordenadas del \`viewBox\`. */
  readonly x: number;
  readonly y: number;
  /** El atributo \`d\` del \`<path>\`, ya proyectado. */
  readonly d: string;
}

/**
 * La proyección de las siluetas, para llevar una latitud/longitud al \`viewBox\`.
 * Equirrectangular con la abscisa corregida por el coseno de la latitud media.
 */
export const PROYECCION_DE_BOLIVIA = {
  lng0: ${minLng},
  lat1: ${maxLat},
  coseno: ${cosLatMedia},
  escala: ${escala},
} as const;

`;

const cuerpo =
  'export const CONTORNOS_DE_MUNICIPIOS: readonly ContornoDeMunicipio[] = [\n' +
  resultado
    .map(
      (r) =>
        `  { ine: '${r.ine}', sigla: '${r.sigla}', nombre: ${JSON.stringify(r.nombre).replace(/"/g, "'")}, x: ${r.x}, y: ${r.y}, d: '${r.d}' },`,
    )
    .join('\n') +
  '\n];\n';

writeFileSync(destino, ENCABEZADO + cuerpo);
console.log(`Escrito ${destino} (${(ENCABEZADO.length + cuerpo.length) / 1024} kB)`);
