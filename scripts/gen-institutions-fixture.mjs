#!/usr/bin/env node
/**
 * Porta las instituciones de salud reales de Bolivia al simulador.
 *
 * ## Por qué existe
 *
 * El directorio de clínicas mostraba **«Clínica Los Olivos», «Hospital San
 * Lucas» y «Clínica Nueva Esperanza»**: tres nombres inventados, en un producto
 * que se le enseña a clínicas y aseguradoras bolivianas de verdad. La regla
 * `00-non-negotiables` §8 lo prohíbe con todas las letras.
 *
 * `data/bolivia-instituciones/` trae las listas reales que aporta el propietario
 * —planillas con establecimiento, razón social, NIT, dirección y teléfono—,
 * destiladas por `tools/extract-bolivia-institutions.py`.
 *
 * ## Qué entra al directorio y qué no
 *
 * Entran las **58 urbanas**: 22 clínicas privadas, 17 hospitales públicos y
 * cajas de salud, y 19 aseguradoras.
 *
 * Los **464 centros de primer nivel** quedan en `data/` pero **no** en el
 * fixture: son postas rurales repartidas por todo el departamento, sin teléfono
 * y sin punto en el mapa, y llenarían el directorio de una ciudad con lugares
 * que están a horas de viaje. Están para quien los necesite, no en la vitrina.
 *
 * ## Las aseguradoras vienen en dos ramos, y no es lo mismo
 *
 * La planilla separa «aseguradoras de personas» (9) de «generales y fianzas»
 * (10). Una compañía de seguros patrimoniales no cubre salud: mezclarlas
 * pondría a Seguros Illimani en el directorio médico. El ramo viaja en
 * `coversHealth`, que lo declara la **sección de la planilla**, no una
 * inferencia de este guion.
 *
 * ## Las coordenadas son una capa derivada
 *
 * Las planillas traen dirección, no coordenadas. `locations.json` lo produce
 * `tools/geocode-bolivia-institutions.py` contra Nominatim, el mismo proveedor
 * que ya usan los mapas, y cada punto viaja con su precisión: `direccion` (9),
 * `via` (25) o `ciudad` (24) — y `ciudad` significa «no se reconoció la
 * dirección, esto es el centro», que la ficha debe decir en vez de fingir.
 *
 * Uso: `yarn mock:institutions`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGEN = join(process.cwd(), 'data', 'bolivia-instituciones');
const DESTINO = join(
  process.cwd(),
  'src',
  'app',
  'core',
  'mock',
  'fixtures',
  'instituciones.generated.ts',
);

const leer = (nombre) => JSON.parse(readFileSync(join(ORIGEN, `${nombre}.json`), 'utf8'));

const manifiesto = leer('manifest');
const clinicas = leer('clinics');
const hospitales = leer('hospitals');
const aseguradoras = leer('insurers');
const ubicaciones = leer('locations');

/* ---- comprobaciones que hacen fallar el generador antes de escribir ------- */

const problemas = [];
const urbanas = [...clinicas, ...hospitales, ...aseguradoras];

for (const institucion of urbanas) {
  if (ubicaciones[institucion.id] === undefined) {
    problemas.push(`${institucion.id} no tiene punto en locations.json`);
  }
  if (!institucion.name) problemas.push(`${institucion.id} no tiene nombre`);
}

const identificadores = new Set();
for (const institucion of urbanas) {
  if (identificadores.has(institucion.id)) problemas.push(`el id ${institucion.id} sale dos veces`);
  identificadores.add(institucion.id);
}

const conteos = manifiesto.counts;
if (clinicas.length !== conteos.clinics) problemas.push('las clínicas no cuadran con el manifiesto');
if (hospitales.length !== conteos.hospitals) problemas.push('los hospitales no cuadran');
if (aseguradoras.length !== conteos.insurers) problemas.push('las aseguradoras no cuadran');

if (problemas.length > 0) {
  console.error('· gen-institutions-fixture — los datos no son consistentes:');
  for (const problema of problemas.slice(0, 20)) console.error(`    ${problema}`);
  process.exit(1);
}

/* ---- normalización ------------------------------------------------------- */

const conPunto = (institucion) => {
  const punto = ubicaciones[institucion.id];
  return { lat: punto.lat, lng: punto.lng, precision: punto.precision };
};

const nulo = (valor) => (valor === undefined || valor === '' ? null : valor);

const clinicasPortadas = clinicas.map((c) => ({
  id: c.id,
  name: c.name,
  legalName: nulo(c.legalName),
  taxId: nulo(c.taxId),
  address: nulo(c.address),
  phone: nulo(c.phone),
  city: c.city,
  sector: c.sector,
  ...conPunto(c),
}));

const hospitalesPortados = hospitales.map((h) => ({
  id: h.id,
  name: h.name,
  address: nulo(h.address),
  phone: nulo(h.phone),
  healthNetwork: nulo(h.healthNetwork),
  kind: h.kind,
  level: h.level ?? null,
  city: h.city,
  sector: h.sector,
  ...conPunto(h),
}));

const aseguradorasPortadas = aseguradoras.map((a) => ({
  id: a.id,
  name: a.name,
  shortName: nulo(a.shortName),
  taxId: nulo(a.taxId),
  address: nulo(a.address),
  branch: a.branch,
  coversHealth: a.coversHealth,
  ...conPunto(a),
}));

const constante = (nombre, tipo, valor) =>
  `export const ${nombre}: ${tipo} = ${JSON.stringify(valor, null, 2)};\n\n`;

const reparto = Object.entries(
  urbanas.reduce((cuenta, i) => {
    const p = ubicaciones[i.id].precision;
    return { ...cuenta, [p]: (cuenta[p] ?? 0) + 1 };
  }, {}),
)
  .sort((a, b) => b[1] - a[1])
  .map(([p, n]) => `\`${p}\` — ${n}`)
  .join(' · ');

const cabecera = `/* ============================================================================
    Las instituciones de salud reales de Bolivia, portadas al simulador.

    **GENERADO por \`scripts/gen-institutions-fixture.mjs\`. No editar a mano.**
    La fuente es \`data/bolivia-instituciones/\`, que destila
    \`tools/extract-bolivia-institutions.py\` de las planillas del propietario.

    ${clinicasPortadas.length} clínicas privadas · ${hospitalesPortados.length} hospitales públicos y cajas ·
    ${aseguradorasPortadas.length} aseguradoras.

    Reemplazan a «Clínica Los Olivos», «Hospital San Lucas» y «Clínica Nueva
    Esperanza», que eran nombres inventados en un producto que se le enseña a
    clínicas bolivianas de verdad.

    ## Lo que NO trae, y por qué

    · **Los ${manifiesto.counts.primaryCare} centros de primer nivel.** Están en \`data/\` pero no acá:
      son postas rurales de todo el departamento, sin teléfono ni punto, y
      llenarían el directorio de una ciudad con lugares a horas de viaje.

    · **Lo que la planilla deja vacío.** Cuatro clínicas no declaran razón social
      ni NIT, y viajan en \`null\`. No se completa.

    · **Habilitaciones, acreditaciones y servicios.** Las planillas no los
      declaran. Inventarlos para un establecimiento real sería peor que no
      tenerlos.

    ## Las coordenadas son derivadas, y lo dicen

    Las planillas traen dirección. El punto sale de Nominatim y cada uno viaja
    con su precisión: ${reparto}.
    \`ciudad\` significa que no se reconoció la dirección y el punto es el centro
    — la ficha debe decirlo en vez de fingir precisión.

    ## Las aseguradoras vienen en dos ramos

    \`coversHealth\` sale de la sección de la planilla: ${aseguradorasPortadas.filter((a) => a.coversHealth).length} de personas
    (cubren salud) y ${aseguradorasPortadas.filter((a) => !a.coversHealth).length} generales y de fianzas, que no.

    Regenerar con \`yarn mock:institutions\`.
    ========================================================================== */

/** Con cuánta precisión se resolvió el punto de una institución. */
export type PrecisionDeInstitucion = 'direccion' | 'via' | 'ciudad';

/** Una clínica privada. \`legalName\` y \`taxId\` son \`null\` si la planilla no los trae. */
export interface ClinicaReal {
  readonly id: string;
  readonly name: string;
  readonly legalName: string | null;
  readonly taxId: string | null;
  readonly address: string | null;
  readonly phone: string | null;
  readonly city: string;
  readonly sector: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision: PrecisionDeInstitucion;
}

/** Un hospital público o una caja de salud. \`level\` es el nivel de atención. */
export interface HospitalReal {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly phone: string | null;
  /** Sólo los de segundo nivel declaran red. */
  readonly healthNetwork: string | null;
  readonly kind: string;
  readonly level: number | null;
  readonly city: string;
  readonly sector: string;
  readonly lat: number;
  readonly lng: number;
  readonly precision: PrecisionDeInstitucion;
}

/** Una aseguradora. \`coversHealth\` lo declara la sección de la planilla. */
export interface AseguradoraReal {
  readonly id: string;
  readonly name: string;
  readonly shortName: string | null;
  readonly taxId: string | null;
  readonly address: string | null;
  readonly branch: string;
  readonly coversHealth: boolean;
  readonly lat: number;
  readonly lng: number;
  readonly precision: PrecisionDeInstitucion;
}

/** La procedencia, para mostrarla al pie de las pantallas. */
export const INSTITUCIONES_META = {
  package: ${JSON.stringify(manifiesto.package)},
  schemaVersion: ${JSON.stringify(manifiesto.schemaVersion)},
  extractedOn: ${JSON.stringify(manifiesto.extractedOn)},
  scope: ${JSON.stringify(manifiesto.scope)},
  warnings: ${JSON.stringify(manifiesto.warnings)},
} as const;

`;

const cuerpo =
  constante('CLINICAS_REALES', 'readonly ClinicaReal[]', clinicasPortadas) +
  constante('HOSPITALES_REALES', 'readonly HospitalReal[]', hospitalesPortados) +
  constante('ASEGURADORAS_REALES', 'readonly AseguradoraReal[]', aseguradorasPortadas);

writeFileSync(DESTINO, cabecera + cuerpo, 'utf8');

console.log('· gen-institutions-fixture');
console.log(
  `  ${clinicasPortadas.length} clínicas · ${hospitalesPortados.length} hospitales y cajas · ` +
    `${aseguradorasPortadas.length} aseguradoras (${aseguradorasPortadas.filter((a) => a.coversHealth).length} de salud) · ${reparto}`,
);
