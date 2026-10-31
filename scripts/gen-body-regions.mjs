#!/usr/bin/env node
/**
 * Recorta el mapeo región-del-catálogo -> mallas del atlas 3D para ejecución.
 *
 * ## De dónde sale
 *
 * `docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/catalogo/regiones-cuerpo-3d.json`
 * (196 KB, con criterios, structureIds y cajas de verificación) y los cinco GLB
 * de `public/anatomy-atlas-3d/models/` para las cajas de las articulaciones.
 * Nada se copia a mano: se vuelve a correr este script.
 *
 * ## Qué se queda y qué no
 *
 * - Se queda lo que el picker usa: tipo de malla, cómo se elige tocando, capa,
 *   mallas por lado, grupos de encuadre y, para las articulaciones, su caja en
 *   metros (sale del GLB: `translation ± scale` con `KHR_mesh_quantization`).
 * - Se va lo que sólo sirve para revisar (`criterio`, `structureIds`,
 *   `uberon_region`, `caja_cm_verificada`, avisos) y lo que el catálogo ya
 *   dice (`nombre`, `padre`, `lateral`: llegan por la entrada `regions` del
 *   picker, no se duplican).
 * - Cada id de malla aparece UNA vez en `mallas`; el resto son posiciones en
 *   esa tabla. Por eso pesa una fracción del original.
 *
 * ## Salida
 *
 * `public/anatomy-atlas-3d/catalog/body-regions.json`
 *
 * Uso:
 *   node scripts/gen-body-regions.mjs           escribe el archivo
 *   node scripts/gen-body-regions.mjs --check   falla (1) si el archivo no es el que saldría hoy
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const ORIGEN = join(
  RAIZ,
  'docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/catalogo/regiones-cuerpo-3d.json',
);
const MODELOS = join(RAIZ, 'public/anatomy-atlas-3d/models');
const DESTINO = join(RAIZ, 'public/anatomy-atlas-3d/catalog/body-regions.json');
const VERSION_DEL_FORMATO = 1;

/** Caja de cada malla en metros: `[minx, miny, minz, maxx, maxy, maxz]`. */
function cajasDeLosGlb() {
  const cajas = new Map();
  for (const archivo of readdirSync(MODELOS).filter((f) => f.endsWith('.glb')).sort()) {
    const datos = readFileSync(join(MODELOS, archivo));
    const largo = datos.readUInt32LE(12);
    const gltf = JSON.parse(datos.subarray(20, 20 + largo).toString('utf8'));
    for (const nodo of gltf.nodes) {
      if (nodo.mesh === undefined) continue;
      // Posiciones int16 normalizadas en [-1, 1]: la caja es translation ± scale.
      // Sólo vale sin rotación ni jerarquía, y se comprueba.
      if (nodo.rotation || nodo.children) throw new Error(`${archivo}: ${nodo.name} trae rotación o hijos`);
      const t = nodo.translation;
      const s = nodo.scale;
      cajas.set(nodo.name, [0, 1, 2].map((i) => t[i] - s[i]).concat([0, 1, 2].map((i) => t[i] + s[i])));
    }
  }
  return cajas;
}

function unionDeCajas(cajas) {
  if (cajas.length === 0) return null;
  return [0, 1, 2, 3, 4, 5].map((k) => (k < 3 ? Math.min(...cajas.map((c) => c[k])) : Math.max(...cajas.map((c) => c[k]))));
}

function interseccion(a, b) {
  if (a === null || b === null) return null;
  const caja = [0, 1, 2, 3, 4, 5].map((k) => (k < 3 ? Math.max(a[k], b[k]) : Math.min(a[k], b[k])));
  return [0, 1, 2].every((k) => caja[k] < caja[k + 3]) ? caja : null;
}

const redondear = (caja) => caja.map((v) => Math.round(v * 10000) / 10000);

function generar() {
  const origen = JSON.parse(readFileSync(ORIGEN, 'utf8'));
  const cajas = cajasDeLosGlb();

  const usados = new Set();
  const recoger = (lista) => lista.forEach((id) => usados.add(id));
  for (const r of origen.regiones) {
    for (const lado of ['izquierda', 'derecha', 'centro']) recoger(r.mallas[lado]);
    for (const lado of ['izquierda', 'derecha']) r.encuadre?.grupos[lado].forEach(recoger);
  }
  const tabla = [...usados].sort();
  const posicion = new Map(tabla.map((id, i) => [id, i]));
  const pos = (lista) => lista.map((id) => posicion.get(id));
  for (const id of tabla) if (!cajas.has(id)) throw new Error(`Malla sin caja en los GLB: ${id}`);

  const regions = {};
  for (const r of origen.regiones) {
    const fila = {
      tipo: r.tipo_malla,
      tocar: r.al_tocar,
      capa: r.capa_preferida,
      capas: r.capas_con_mallas,
      izq: pos(r.mallas.izquierda),
      der: pos(r.mallas.derecha),
      centro: pos(r.mallas.centro),
    };
    if (r.encuadre) {
      const grupos = { izq: r.encuadre.grupos.izquierda.map(pos), der: r.encuadre.grupos.derecha.map(pos) };
      const caja = {};
      for (const lado of ['izq', 'der']) {
        const delGrupo = grupos[lado].map((g) => unionDeCajas(g.map((i) => cajas.get(tabla[i]))));
        const total = r.encuadre.modo === 'interseccion' ? delGrupo.reduce(interseccion) : unionDeCajas(delGrupo);
        if (total === null || total === undefined) throw new Error(`Encuadre vacío: ${r.region} (${lado})`);
        caja[lado] = redondear(total);
      }
      fila.encuadre = { modo: r.encuadre.modo, ...grupos, caja };
    }
    regions[r.region] = fila;
  }

  // Malla -> región al tocarla, agrupado por región (el nombre se escribe una vez).
  const toque = {};
  for (const [malla, region] of Object.entries(origen.toque_malla_a_region)) {
    if (!regions[region]) throw new Error(`toque: región desconocida ${region}`);
    (toque[region] ??= []).push(posicion.get(malla));
    if (posicion.get(malla) === undefined) throw new Error(`toque: malla fuera de la tabla ${malla}`);
  }
  for (const lista of Object.values(toque)) lista.sort((a, b) => a - b);

  return (
    JSON.stringify({
      version: VERSION_DEL_FORMATO,
      catalogo: origen.catalogo.version,
      generadoDesde: 'docs/trabajo/2026-10-31-solicitud-estudios-catalogo-completo/catalogo/regiones-cuerpo-3d.json',
      mallas: tabla,
      regiones: regions,
      toque,
    }) + '\n'
  );
}

const salida = generar();
if (process.argv.includes('--check')) {
  const actual = existsSync(DESTINO) ? readFileSync(DESTINO, 'utf8') : null;
  if (actual !== salida) {
    console.error('body-regions.json no es el que saldría hoy del mapeo: corra `node scripts/gen-body-regions.mjs`.');
    process.exit(1);
  }
  console.log(`body-regions.json al día (${salida.length} bytes).`);
} else {
  writeFileSync(DESTINO, salida);
  console.log(`body-regions.json escrito: ${salida.length} bytes.`);
}
