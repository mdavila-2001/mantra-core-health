#!/usr/bin/env node
/**
 * Verifica que la documentación cubra lo que el código realmente tiene.
 *
 * Cuatro coberturas, y las cuatro fallan por defecto de documentación, nunca al
 * revés: si el código crece y la documentación no, esto lo dice.
 *
 *   1. Toda ruta declarada tiene ficha en docs/routes/.
 *   2. Todo organismo compartido se nombra en docs/.
 *   3. Todo servicio inyectable se nombra en docs/.
 *   4. Ningún archivo de docs/ tiene marcadores provisionales.
 *
 * La cuarta es la que hace cumplir el criterio del plan: cero TODO, TBD o
 * secciones vacías en la entrega. Se acota a `docs/` porque los TODO del código
 * son del producto, no de la documentación — y de hecho hay uno legítimo en
 * `login.ts` que este verificador no debe tocar.
 *
 * Uso: node scripts/check-doc-coverage.mjs
 */

import { DOCS_ROOT, read, repoPath, scanComponents, scanRoutes, scanServices, walk } from './lib/scan.mjs';

const docs = walk(DOCS_ROOT, ['.md']).map((file) => ({
  path: repoPath(file),
  text: read(file),
}));

/** Todo el texto de la documentación, para buscar menciones. */
const corpus = docs.map((doc) => doc.text).join('\n');

const problems = [];

// --- 1 · rutas --------------------------------------------------------------

const routes = scanRoutes();

/**
 * Rutas que no necesitan ficha propia: las que no pintan nada.
 *
 * La redirección interna y el comodín se documentan en el catálogo, que sí es
 * obligatorio; una ficha de diez secciones para `redirectTo` sería una página
 * vacía, que es justo lo que el plan prohíbe.
 */
const routesWithoutScreen = routes.filter(
  (route) => route.component === null || route.redirectTo !== null,
);
const routesWithScreen = routes.filter(
  (route) => route.component !== null && route.redirectTo === null,
);

for (const route of routesWithScreen) {
  if (!corpus.includes(`\`${route.url}\``)) {
    problems.push(`ruta sin documentar: ${route.url} (${route.component})`);
  }
}

const catalog = docs.find((doc) => doc.path === 'docs/routes/route-catalog.md');
if (catalog === undefined) {
  problems.push('falta docs/routes/route-catalog.md');
} else {
  for (const route of routesWithoutScreen) {
    const shown = route.url === '/**' ? '`**`' : `\`${route.url}\``;
    if (!catalog.text.includes(shown) && !catalog.text.includes(`\`${route.url}\``)) {
      problems.push(`ruta ausente del catálogo: ${route.url}`);
    }
  }
}

// --- 2 · organismos ---------------------------------------------------------

const components = scanComponents();
const organisms = components.filter((component) => component.level === 'organismo');

for (const organism of organisms) {
  if (!corpus.includes(organism.selector) && !corpus.includes(`\`${organism.className}\``)) {
    problems.push(`organismo sin mencionar: ${organism.selector} (${organism.className})`);
  }
}

// --- 3 · servicios ----------------------------------------------------------

for (const service of scanServices()) {
  if (!corpus.includes(service.className)) {
    problems.push(`servicio sin mencionar: ${service.className}`);
  }
}

// --- 4 · marcadores provisionales -------------------------------------------

/**
 * Marcadores que no pueden quedar en la entrega.
 *
 * Se buscan como palabra suelta y en mayúsculas para no marcar la palabra
 * «pendiente» usada en prosa —que es legítima y aparece varias veces
 * describiendo decisiones abiertas—.
 */
const PLACEHOLDERS = /\b(TODO|TBD|FIXME|XXX|LOREM IPSUM|COMPLETAR|PENDIENTE DE ESCRIBIR)\b/;

for (const doc of docs) {
  // Las citas del código sí pueden contener un TODO real del producto: se
  // ignoran los bloques de código, que es donde viven.
  const prose = doc.text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const match = PLACEHOLDERS.exec(prose);
  if (match !== null) {
    problems.push(`marcador provisional «${match[1]}» en ${doc.path}`);
  }

  if (prose.trim().length < 200) {
    problems.push(`página demasiado corta (¿vacía?): ${doc.path}`);
  }
}

// --- informe ----------------------------------------------------------------

if (problems.length > 0) {
  console.error(`\n✗ check-doc-coverage — ${problems.length} hallazgo(s)\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  process.exit(1);
}

console.log('✓ check-doc-coverage');
console.log(`  ${routes.length} rutas · ${organisms.length} organismos · ${scanServices().length} servicios`);
console.log(`  ${docs.length} páginas, sin marcadores provisionales`);
