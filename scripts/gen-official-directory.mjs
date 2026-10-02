/**
 * Lleva el directorio oficial de salud de Bolivia a la maqueta:
 * `public/directorio-oficial/`, que el simulador lee bajo demanda (como el
 * glosario) para no meter quince mil fichas en el bundle.
 *
 * La fuente es `salud-db/data/directorio-oficial/` del repositorio del modelo,
 * que arma `build_directorio_oficial.py` desde AGEMED (farmacias vigentes al
 * 01/10/2026), el RUES 2026 (Ministerio de Salud y Deportes / SNIS) y Overture
 * Places (CDLA-Permissive-2.0 / Apache-2.0 / CC0). Es el mismo dato que el
 * paquete de seeds siembra en la base: la maqueta y la API ven lo mismo.
 *
 * No reescribe contenido. Sólo:
 * - pone en mayúscula inicial los nombres que la fuente escribe todo en
 *   mayúsculas («FARMACIA SAN JUAN» → «Farmacia San Juan»);
 * - arma el subtítulo con lo que la fuente declara (tipo, nivel, resolución);
 * - asigna la categoría del directorio con las reglas de
 *   `fixtures/categorias-publicas.ts`.
 *
 * Uso:
 *   node scripts/gen-official-directory.mjs                    # ../mantra-core-health-model
 *   node scripts/gen-official-directory.mjs <ruta-al-modelo>
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = process.cwd();
const MODELO = resolve(process.argv[2] ?? join(RAIZ, '..', 'mantra-core-health-model'));
const ORIGEN = join(MODELO, 'salud-db', 'data', 'directorio-oficial');
const DESTINO = join(RAIZ, 'public', 'directorio-oficial');

const leer = (nombre) => JSON.parse(readFileSync(join(ORIGEN, nombre), 'utf8'));
const manifiesto = leer('manifest.json');

const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'el', 'en', 'para', 'por', 'con']);
/** «FARMACIA SAN JUAN» → «Farmacia San Juan»; lo que ya trae minúsculas queda igual. */
function titulo(texto) {
  if (!texto || texto !== texto.toUpperCase()) return texto;
  return texto
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && MENORES.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

function slugDe(texto) {
  return texto
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 110);
}

/** Categoría del directorio (los códigos de `CATEGORIA` en categorias-publicas.ts). */
function categoriaDeRues(r) {
  if (r.subsector === 'Seguridad Social (CAJAS)') return 'caja-de-salud';
  if (r.subsector === 'Público') return r.level === '1er NIVEL' ? 'centro-de-primer-nivel' : 'hospital-publico';
  return 'clinica-privada';
}
const CATEGORIA_DE_OVERTURE = {
  CLINIC: 'clinica-privada',
  DENTAL: 'odontologia',
  LABORATORY: 'laboratorio-clinico',
  IMAGING: 'imagenologia',
};
const TITULAR_DE_OVERTURE = {
  CLINIC: 'Consultorio o clínica',
  DENTAL: 'Consultorio odontológico',
  LABORATORY: 'Laboratorio clínico',
  IMAGING: 'Centro de diagnóstico por imagen',
};

const fichas = [];
for (const r of leer('farmacias-agemed.json')) {
  fichas.push({
    id: r.id,
    kind: 'PHARMACY',
    name: titulo(r.name),
    headline: [titulo(r.subtype) ?? 'Farmacia', r.license ? `Resolución AGEMED ${r.license.number}` : null].filter(Boolean).join(' · '),
    category: null,
    source: 'AGEMED',
    license: r.license?.number ?? null,
    r,
  });
}
for (const r of leer('establecimientos-rues.json')) {
  fichas.push({
    id: r.id,
    kind: 'ORGANIZATION',
    name: titulo(r.name),
    headline: [titulo(r.subtype), r.level, r.subsector, `RUES ${r.officialCode}`].filter(Boolean).join(' · '),
    category: categoriaDeRues(r),
    source: 'RUES',
    officialCode: r.officialCode,
    r,
  });
}
for (const r of leer('lugares-overture.json')) {
  const diagnostico = r.kind === 'LABORATORY' || r.kind === 'IMAGING';
  fichas.push({
    id: r.id,
    kind: diagnostico ? 'DIAGNOSTIC_UNIT' : 'ORGANIZATION',
    unitKind: diagnostico ? r.kind : undefined,
    name: titulo(r.name),
    headline: `${TITULAR_DE_OVERTURE[r.kind]} · fuente comunitaria (Overture)`,
    category: CATEGORIA_DE_OVERTURE[r.kind],
    source: 'OVERTURE',
    r,
  });
}

fichas.sort((a, b) => a.id.localeCompare(b.id));
const usados = new Set();
const salida = { PHARMACY: [], ORGANIZATION: [], DIAGNOSTIC_UNIT: [] };
for (const f of fichas) {
  const base = slugDe(`${f.name} ${f.r.municipalityName ?? f.r.municipalityText ?? ''}`) || 'ficha';
  let slug = base;
  for (let n = 2; usados.has(slug); n += 1) slug = `${base}-${n}`;
  usados.add(slug);
  salida[f.kind].push({
    id: f.id,
    slug,
    name: f.name,
    headline: f.headline,
    category: f.category,
    ...(f.unitKind ? { unitKind: f.unitKind } : {}),
    city: f.r.municipalityName ?? null,
    department: f.r.department ?? null,
    address: f.r.address ?? null,
    lat: f.r.latitude ?? null,
    lng: f.r.longitude ?? null,
    phone: f.r.phone ?? null,
    source: f.source,
    ...(f.license ? { license: f.license } : {}),
    ...(f.officialCode ? { officialCode: f.officialCode } : {}),
  });
}

rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO, { recursive: true });
const ARCHIVO = { PHARMACY: 'farmacias.json', ORGANIZATION: 'organizaciones.json', DIAGNOSTIC_UNIT: 'diagnostico.json' };
let bytes = 0;
for (const [kind, filas] of Object.entries(salida)) {
  const texto = JSON.stringify(filas);
  bytes += texto.length;
  writeFileSync(join(DESTINO, ARCHIVO[kind]), texto);
}
const indice = {
  generadoDe: 'mantra-core-health-model/salud-db/data/directorio-oficial',
  archivos: ARCHIVO,
  totales: Object.fromEntries(Object.entries(salida).map(([k, v]) => [k, v.length])),
  fuentes: Object.fromEntries(
    Object.entries(manifiesto.fuentes).map(([k, v]) => [k, { url: v.url ?? null, licencia: v.licencia, version: v.version ?? v.actualizacion ?? null }]),
  ),
};
writeFileSync(join(DESTINO, 'index.json'), JSON.stringify(indice, null, 2));
console.log(
  `directorio-oficial: ${fichas.length} fichas (${Object.entries(indice.totales).map(([k, v]) => `${k} ${v}`).join(' · ')}), ${(bytes / 1024 / 1024).toFixed(1)} MB → public/directorio-oficial/`,
);
