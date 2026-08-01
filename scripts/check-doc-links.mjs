#!/usr/bin/env node
/**
 * Verifica que ningún enlace interno de `docs/` esté roto.
 *
 * Es la comprobación que sustituye a la construcción estricta de MkDocs, que no
 * se puede ejecutar acá porque MkDocs no está instalado y añadirlo sería una
 * dependencia nueva. Lo que MkDocs haría —resolver cada enlace relativo contra
 * el árbol de archivos— lo hace esto, sin instalar nada.
 *
 * Cubre:
 *   - enlaces relativos a otros archivos de docs/ y del repositorio
 *   - anclas dentro del mismo archivo y en otros archivos
 *   - imágenes referenciadas
 *
 * No cubre enlaces externos (http/https): comprobarlos exigiría red, y un
 * verificador que depende de la red falla por motivos que no son del proyecto.
 *
 * Uso: node scripts/check-doc-links.mjs
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { DOCS_ROOT, read, REPO_ROOT, repoPath, walk } from './lib/scan.mjs';

const files = walk(DOCS_ROOT, ['.md']);
const problems = [];
let checked = 0;

/**
 * Ancla de GitHub/MkDocs a partir de un encabezado.
 *
 * Minúsculas, se quitan los signos que no sean letra, número, espacio o guion,
 * y **cada** espacio pasa a guion. Se conservan los acentos: tanto GitHub como
 * MkDocs los admiten en el fragmento, y este proyecto escribe en español.
 *
 * El detalle que importa es que los espacios **no se colapsan**: un encabezado
 * como `## 3.2 · Dependencias circulares` pierde el `·` y deja los dos espacios
 * que lo rodeaban, así que el ancla real lleva dos guiones seguidos
 * (`#32--dependencias-circulares`). Colapsarlos generaría un ancla que ningún
 * navegador encuentra, y este verificador aprobaría enlaces rotos.
 */
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    // El énfasis y el código se quitan; el guion bajo NO, porque forma parte
    // del ancla real (GitHub y MkDocs lo conservan) y aparece en los nombres de
    // constantes que esta documentación usa como encabezado.
    .replace(/[`*~]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

/** Todas las anclas que un archivo ofrece. */
function anchorsOf(file) {
  const anchors = new Set();
  for (const line of read(file).split('\n')) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading !== null) anchors.add(slug(heading[1]));
  }
  return anchors;
}

const anchorCache = new Map();
function anchors(file) {
  if (!anchorCache.has(file)) anchorCache.set(file, anchorsOf(file));
  return anchorCache.get(file);
}

for (const file of files) {
  const source = read(file);
  const here = dirname(file);

  // `[texto](destino)`, ignorando lo que esté dentro de un bloque de código.
  const withoutCode = source.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const link = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  let match;
  while ((match = link.exec(withoutCode)) !== null) {
    const target = match[1];

    if (/^(https?:|mailto:|tel:)/.test(target)) continue;

    checked += 1;

    const [pathPart, anchor] = target.split('#');

    // Ancla del propio archivo: `[…](#seccion)`.
    if (pathPart === '') {
      if (anchor !== undefined && !anchors(file).has(anchor)) {
        problems.push(`${repoPath(file)} → ancla inexistente #${anchor}`);
      }
      continue;
    }

    const resolved = resolve(here, pathPart);

    if (!existsSync(resolved)) {
      problems.push(`${repoPath(file)} → destino inexistente: ${target}`);
      continue;
    }

    if (anchor !== undefined && resolved.endsWith('.md') && !anchors(resolved).has(anchor)) {
      problems.push(`${repoPath(file)} → ancla inexistente: ${target}`);
    }
  }
}

void join;
void REPO_ROOT;

if (problems.length > 0) {
  console.error(`\n✗ check-doc-links — ${problems.length} enlace(s) roto(s) de ${checked}\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  process.exit(1);
}

console.log('✓ check-doc-links');
console.log(`  ${checked} enlaces internos válidos en ${files.length} archivos`);
