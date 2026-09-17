#!/usr/bin/env node
/**
 * Porta la taxonomía anatómica de Netter al simulador.
 *
 * ## Por qué existe
 *
 * La categoría «Anatomía» de la grilla del glosario existía desde el principio
 * —es la primera de `GLOSSARY_CATEGORY_ORDER`— pero la llenaban **tres términos
 * curados**: corazón, pulmón y riñón. Quien entraba a hojear anatomía veía una
 * ficha y media.
 *
 * `data/netter-anatomia/` trae la taxonomía del Atlas de Netter destilada por
 * `tools/extract-netter-corpus.py`: 8 regiones, 65 subregiones, 548 láminas y
 * 3 161 entradas del índice, cada una con su región, su tipo y las láminas donde
 * aparece.
 *
 * ## Por qué no son `TerminoDeGlosario`
 *
 * El catálogo curado es bilingüe y explicado: cada término tiene nombre en
 * inglés, definición clínica y un resumen en lenguaje llano escrito por alguien.
 * Una entrada del índice de Netter no tiene nada de eso — tiene un nombre en
 * castellano, un tipo y unas láminas.
 *
 * Meterlas en la misma interfaz obligaría a rellenar `enDisplay`,
 * `clinicalDefinitionEs` y `plainSummaryEs` con algo, y ese algo sería
 * inventado. Así que viajan con su propio tipo y `glosario.ts` las adapta a la
 * forma con la que el glosario sale por la API. La pantalla no se entera.
 *
 * ## Las definiciones son 27, no 3 161
 *
 * El corpus arma la definición de cada entidad con una prosa por **tipo** —«El
 * cartílago es tejido conectivo especializado que…»— y el nombre encima. Los 27
 * tipos tienen exactamente una prosa distinta cada uno (comprobado sobre los
 * 3 161 archivos). Se guardan las 27 verbatim y cada entrada apunta a la suya:
 * 5,7 MB de texto repetido que no entran al bundle.
 *
 * Por eso la definición que muestra una entrada describe **su tipo**, y así se
 * rotula. No es la definición de esa estructura en particular: el corpus no la
 * tiene, y escribirla sería inventar anatomía.
 *
 * Uso: `yarn mock:anatomy`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ORIGEN = join(process.cwd(), 'data', 'netter-anatomia');
const DESTINO = join(
  process.cwd(),
  'src',
  'app',
  'core',
  'mock',
  'fixtures',
  'anatomia.generated.ts',
);

const leer = (nombre) => JSON.parse(readFileSync(join(ORIGEN, `${nombre}.json`), 'utf8'));

const manifest = leer('manifest');
const regiones = leer('regions');
const subregiones = leer('subregions');
const laminas = leer('plates');
const tipos = leer('types');
const entidades = leer('entities');
const clinica = leer('clinicalNotes');

/* ---- comprobaciones que hacen fallar el generador antes de escribir -------
   Un fixture a medias llena la pantalla de huecos sin que nada avise. Se rompe
   acá, con el motivo. */

const problemas = [];

const idsRegion = new Set(regiones.map((r) => r.id));
const idsSubregion = new Set(subregiones.map((s) => s.id));
const nombresRegion = new Set(regiones.map((r) => r.name));
const nombresSubregion = new Set(subregiones.map((s) => s.name));
const tiposConocidos = new Set(tipos.map((t) => t.type));
const numerosDeLamina = new Set(laminas.map((l) => l.plate));

for (const subregion of subregiones) {
  if (!idsRegion.has(subregion.regionId)) {
    problemas.push(`la subregión ${subregion.id} cuelga de ${subregion.regionId}, que no existe`);
  }
}

for (const lamina of laminas) {
  if (lamina.regionId !== null && !idsRegion.has(lamina.regionId)) {
    problemas.push(`la lámina ${lamina.plate} declara la región ${lamina.regionId}, que no existe`);
  }
  if (lamina.subregionId !== null && !idsSubregion.has(lamina.subregionId)) {
    problemas.push(`la lámina ${lamina.plate} declara ${lamina.subregionId}, que no existe`);
  }
}

for (const entidad of entidades) {
  if (!tiposConocidos.has(entidad.type)) {
    problemas.push(`la entrada ${entidad.id} es de tipo ${entidad.type}, que no tiene definición`);
  }
  if (entidad.region !== null && !nombresRegion.has(entidad.region)) {
    problemas.push(`la entrada ${entidad.id} dice estar en «${entidad.region}», que no es una región`);
  }
  if (entidad.subregion !== null && !nombresSubregion.has(entidad.subregion)) {
    problemas.push(`la entrada ${entidad.id} dice estar en «${entidad.subregion}», que no es una subregión`);
  }
  for (const plate of entidad.plates) {
    if (!numerosDeLamina.has(plate)) {
      problemas.push(`la entrada ${entidad.id} cita la lámina ${plate}, que no está entre las 548`);
    }
  }
}

for (const nota of clinica) {
  if (!numerosDeLamina.has(nota.plate)) {
    problemas.push(`la nota clínica cita la lámina ${nota.plate}, que no existe`);
  }
}

const slugs = new Map();
const comoSlug = (texto) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');

for (const entidad of entidades) {
  const base = comoSlug(entidad.name) || 'entrada';
  // El índice del Atlas repite formas («anterior» cuelga de varias entradas),
  // así que el slug se desempata con el id, que sí es único. Sin esto dos
  // entradas distintas compartirían enlace.
  const slug = slugs.has(base) ? `${base}-${entidad.id.slice(4, 10)}` : base;
  slugs.set(base, true);
  entidad.slug = slug;
}

const slugsUsados = new Set();
for (const entidad of entidades) {
  if (slugsUsados.has(entidad.slug)) {
    problemas.push(`el slug «${entidad.slug}» sale dos veces`);
  }
  slugsUsados.add(entidad.slug);
}

if (problemas.length > 0) {
  console.error('· gen-anatomy-fixture — el corpus no es consistente:');
  for (const problema of problemas.slice(0, 20)) console.error(`    ${problema}`);
  if (problemas.length > 20) console.error(`    … y ${problemas.length - 20} más`);
  process.exit(1);
}

/* ---- normalización -------------------------------------------------------
   Las definiciones largas de región y subregión se recortan al primer párrafo:
   el resto explica cómo debe aprenderlas un modelo de IA, que no es lo que lee
   quien hojea el glosario. Se recorta por párrafo, nunca a media frase. */

const primerParrafo = (texto) => (texto ?? '').split('\n\n')[0].trim();

const regionesPortadas = regiones.map((r) => ({
  id: r.id,
  name: r.name,
  plateFrom: r.plateFrom,
  plateTo: r.plateTo,
  definition: primerParrafo(r.definition),
}));

const subregionesPortadas = subregiones.map((s) => ({
  id: s.id,
  regionId: s.regionId,
  name: s.name,
  plateFrom: s.plateFrom,
  plateTo: s.plateTo,
  definition: primerParrafo(s.definition),
}));

const entradasPortadas = entidades.map((e) => ({
  id: e.id,
  slug: e.slug,
  name: e.name,
  type: e.type,
  confidence: e.confidence,
  region: e.region,
  subregion: e.subregion,
  plates: e.plates,
}));

const constante = (nombre, tipo, valor) =>
  `export const ${nombre}: ${tipo} = ${JSON.stringify(valor, null, 2)};\n\n`;

const cabecera = `/* ============================================================================
    La taxonomía anatómica del Atlas de Netter, portada al simulador.

    **GENERADO por \`scripts/gen-anatomy-fixture.mjs\`. No editar a mano.**
    La fuente es \`data/netter-anatomia/\`, que destila
    \`tools/extract-netter-corpus.py\` del paquete auditado.

    ${regionesPortadas.length} regiones · ${subregionesPortadas.length} subregiones · ${laminas.length} láminas ·
    ${entradasPortadas.length} entradas del índice en ${tipos.length} tipos · ${clinica.length} notas clínicas.

    ## Lo que este archivo NO trae, y por qué

    · **Ilustraciones y texto del Atlas.** Netter es obra con derechos. Acá hay
      taxonomía, títulos de lámina y términos del índice: nada más.

    · **Una definición por entrada.** El corpus no la tiene. Lo que tiene es una
      prosa por tipo —las ${tipos.length} de \`DEFINICIONES_DE_TIPO\`— y la pantalla debe
      rotularla como lo que es: qué es un músculo, no qué es *este* músculo.

    · **Origen, inserción, inervación, irrigación, función o patología.** El
      corpus lo prohíbe explícitamente. Que dos términos compartan lámina es una
      relación de representación, no de causalidad.

    ## Lo que sí dice, y con cuánta confianza

    \`confidence\` viene del cotejo entre dos pasadas de OCR independientes:
    \`consensus_high\` es acuerdo fuerte, \`consensus_medium\` es dudoso y
    \`new_ocr_only\` sólo lo vio una. **Ninguno equivale a revisión humana término
    por término**, y la forma del nombre es la del índice, sin corregir.

    Regenerar con \`yarn mock:anatomy\`.
    ========================================================================== */

/** Una región del Atlas: el bloque editorial de más alto nivel. */
export interface RegionAnatomica {
  readonly id: string;
  readonly name: string;
  readonly plateFrom: number;
  readonly plateTo: number;
  readonly definition: string;
}

/** Una subregión, el nodo intermedio entre la región y la lámina. */
export interface SubregionAnatomica {
  readonly id: string;
  readonly regionId: string;
  readonly name: string;
  readonly plateFrom: number;
  readonly plateTo: number;
  readonly definition: string;
}

/** Una lámina del Atlas, por su número canónico 1-548. */
export interface LaminaAnatomica {
  readonly plate: number;
  readonly title: string;
  readonly regionId: string | null;
  readonly subregionId: string | null;
  /** Cómo se obtuvo el título: revisión manual u OCR de la tabla de contenidos. */
  readonly titleConfidence: string | null;
}

/** La prosa que describe un TIPO de estructura. Una por tipo, no por entrada. */
export interface DefinicionDeTipo {
  readonly type: string;
  readonly definition: string;
}

/**
 * Una entrada del índice del Atlas.
 *
 * \`name\` es la forma **fuente**, sin corregir: el corpus no sustituye en
 * silencio un término dudoso por su equivalente FIPAT.
 */
export interface EntradaAnatomica {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly type: string;
  readonly confidence: string;
  readonly region: string | null;
  readonly subregion: string | null;
  /** Las láminas donde el índice la referencia. */
  readonly plates: readonly number[];
}

/**
 * Una entrada clínica asociada a una lámina.
 *
 * La definición y el tratamiento **no se atribuyen al Atlas**: salen de fuente
 * web curada, que viaja en \`verificationSource\`. No es prescripción.
 */
export interface NotaClinicaAnatomica {
  readonly plate: number;
  readonly title: string;
  readonly definition: string;
  readonly treatment: string;
  readonly verificationSource: string | null;
  readonly guardrail: string;
}

/** La procedencia del paquete, para mostrarla al pie de las pantallas. */
export const ANATOMIA_META = {
  package: ${JSON.stringify(manifest.package)},
  schemaVersion: ${JSON.stringify(manifest.schemaVersion)},
  primarySource: ${JSON.stringify(manifest.primarySource)},
  normalizationSource: ${JSON.stringify(manifest.normalizationSource)},
  warnings: ${JSON.stringify(manifest.warnings)},
  notIncluded: ${JSON.stringify(manifest.notIncluded)},
} as const;

`;

const cuerpo =
  constante('REGIONES_ANATOMICAS', 'readonly RegionAnatomica[]', regionesPortadas) +
  constante('SUBREGIONES_ANATOMICAS', 'readonly SubregionAnatomica[]', subregionesPortadas) +
  constante('LAMINAS_ANATOMICAS', 'readonly LaminaAnatomica[]', laminas) +
  constante('DEFINICIONES_DE_TIPO', 'readonly DefinicionDeTipo[]', tipos) +
  constante('ENTRADAS_ANATOMICAS', 'readonly EntradaAnatomica[]', entradasPortadas) +
  constante('NOTAS_CLINICAS_ANATOMICAS', 'readonly NotaClinicaAnatomica[]', clinica);

writeFileSync(DESTINO, cabecera + cuerpo, 'utf8');

console.log('· gen-anatomy-fixture');
console.log(
  `  ${regionesPortadas.length} regiones · ${subregionesPortadas.length} subregiones · ${laminas.length} láminas · ` +
    `${entradasPortadas.length} entradas · ${tipos.length} tipos · ${clinica.length} notas clínicas`,
);
