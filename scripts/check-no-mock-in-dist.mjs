#!/usr/bin/env node
/**
 * El paquete de producción no lleva código del simulador (O3-4 / H-5).
 *
 * Se corre DESPUÉS de `yarn build` (configuración `production`, la por omisión;
 * vale igual para `production-api` y `real-api`). Recorre todo lo que quedó en
 * `dist/` —navegador y servidor— y busca marcas que sólo existen en el backend
 * simulado (`src/app/core/mock/`). Si aparece una, sale con 1 y dice en qué
 * archivo.
 *
 * Cómo se eligieron las marcas: son literales que el minificador no toca
 * (textos, claves de almacenamiento, patrones de ruta, semillas) y que **no**
 * aparecen en ningún archivo fuera de `core/mock/`. Cada una tapa una pieza
 * distinta, para que sacar del paquete una sola no alcance para pasar:
 *
 *   - el interceptor del backend simulado (`mock-backend.interceptor.ts`);
 *   - los manejadores de rutas (`handlers/`), que van en su propio fragmento;
 *   - las cuentas de prueba y su emisión de tokens (`mock-session.ts`);
 *   - el cartel «Modo demo» (`mock-banner.ts`).
 *
 * Si una marca deja de existir en el simulador (se renombra un texto), el
 * control la reporta como «marca huérfana» y falla: una marca que no está en
 * la fuente no protege nada.
 *
 * Uso:
 *   node scripts/check-no-mock-in-dist.mjs            # revisa dist/
 *   node scripts/check-no-mock-in-dist.mjs <carpeta>  # revisa otra salida
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const RAIZ = process.cwd();
const SIMULADOR = join(RAIZ, 'src', 'app', 'core', 'mock');
const DIST = resolve(RAIZ, process.argv[2] ?? 'dist');

/** Marca → archivo del simulador donde vive (para comprobar que sigue ahí) y qué delata. */
const MARCAS = [
  {
    texto: 'Fallo del backend simulado',
    fuente: 'mock-backend.interceptor.ts',
    delata: 'el interceptor del backend simulado',
  },
  {
    texto: 'mock:registrar',
    fuente: 'mock-backend.interceptor.ts',
    delata: 'el registro de peticiones del interceptor simulado',
  },
  {
    texto: 'MOCK_ROUTER_LOADER',
    fuente: 'mock-backend.interceptor.ts',
    delata: 'el cargador de los manejadores simulados',
  },
  {
    texto: 'Alerta epidemiológica de dengue · Santa Cruz',
    fuente: 'handlers/admin-modules.handlers.ts',
    delata: 'los manejadores de rutas del simulador',
  },
  {
    texto: 'Alquiler del consultorio, semestre adelantado',
    fuente: 'handlers/finance.handlers.ts',
    delata: 'los manejadores de rutas del simulador',
  },
  {
    texto: 'tenant-clinica-los-olivos',
    fuente: 'mock-session.ts',
    delata: 'las cuentas de prueba y sus organizaciones',
  },
  {
    texto: 'Todo lo que ve sale de datos de prueba',
    fuente: 'mock-banner.ts',
    delata: 'el cartel «Modo demo» con las cuentas de prueba',
  },
];

/* Extensiones de texto: lo binario (imágenes, fuentes, mallas 3D) no puede llevar código. */
const DE_TEXTO = /\.(m?js|cjs|html|json|css|map|txt)$/i;

function* recorrer(carpeta) {
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) yield* recorrer(ruta);
    else if (DE_TEXTO.test(nombre)) yield ruta;
  }
}

function* recorrerFuente(carpeta) {
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) yield* recorrerFuente(ruta);
    else if (nombre.endsWith('.ts')) yield ruta;
  }
}

// 1 · Las marcas siguen existiendo en el simulador.
const huerfanas = MARCAS.filter((m) => {
  const archivo = join(SIMULADOR, m.fuente);
  return !existsSync(archivo) || !readFileSync(archivo, 'utf8').includes(m.texto);
});

// 2 · Las marcas no existen fuera del simulador (si no, no delatarían nada).
const ambiguas = [];
for (const archivo of recorrerFuente(join(RAIZ, 'src'))) {
  const rel = relative(RAIZ, archivo).replaceAll('\\', '/');
  if (rel.startsWith('src/app/core/mock/') || rel.endsWith('.spec.ts') || rel.startsWith('src/testing/')) continue;
  const contenido = readFileSync(archivo, 'utf8');
  for (const m of MARCAS) if (contenido.includes(m.texto)) ambiguas.push(`${m.texto} → ${rel}`);
}

if (huerfanas.length > 0 || ambiguas.length > 0) {
  console.error('\n✗ check-no-mock-in-dist: las marcas del simulador no son confiables');
  for (const m of huerfanas) console.error(`  marca huérfana: «${m.texto}» ya no está en core/mock/${m.fuente}`);
  for (const a of ambiguas) console.error(`  marca ambigua (aparece fuera del simulador): ${a}`);
  console.error('');
  process.exit(1);
}

// 3 · El paquete.
if (!existsSync(DIST)) {
  console.error(`\n✗ check-no-mock-in-dist: no existe ${relative(RAIZ, DIST) || DIST}. Corré antes \`yarn build\`.\n`);
  process.exit(1);
}

const hallazgos = [];
let revisados = 0;
for (const archivo of recorrer(DIST)) {
  revisados++;
  const contenido = readFileSync(archivo, 'utf8');
  for (const m of MARCAS) {
    if (contenido.includes(m.texto)) hallazgos.push({ archivo: relative(RAIZ, archivo), marca: m });
  }
}

if (revisados === 0) {
  console.error(`\n✗ check-no-mock-in-dist: ${relative(RAIZ, DIST)} no tiene archivos de texto. ¿Build incompleto?\n`);
  process.exit(1);
}

if (hallazgos.length > 0) {
  console.error(`\n✗ check-no-mock-in-dist: el paquete lleva código del simulador (${hallazgos.length} coincidencias)`);
  for (const { archivo, marca } of hallazgos) {
    console.error(`  ${archivo}: «${marca.texto}» — ${marca.delata}`);
  }
  console.error(
    '\n  Una compilación contra la API real no debe importar `core/mock/`. La aplicación entra al simulador sólo' +
      '\n  por `core/simulator/simulator.ts`, que `angular.json` reemplaza en `development` y `demo`.\n',
  );
  process.exit(1);
}

console.log(
  `✓ check-no-mock-in-dist: ${revisados} archivos de ${relative(RAIZ, DIST)} sin código del simulador (${MARCAS.length} marcas).`,
);
