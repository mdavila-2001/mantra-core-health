#!/usr/bin/env node
/**
 * Porta el índice del atlas anatómico al glosario del simulador.
 *
 * ## Qué entra, y qué se queda fuera
 *
 * La fuente es `data/anatomy-atlas/`, la taxonomía anatómica v2 auditada: 8
 * regiones, 48 subregiones y **548 láminas** del Atlas de Anatomía Humana de
 * Netter, 4.ª edición, con su número canónico, su bloque editorial y su nivel
 * de confianza.
 *
 * Entran las láminas. **No entran las 3 161 entidades del índice**, y la razón
 * está medida, no supuesta: sus etiquetas son fragmentos del índice escaneado
 * con contexto arrastrado entre entradas. 1 400 de 3 161 (44 %) traen daño
 * visible —«Abertura — mujer», «Abertura lateral (agujero de Luschka) —
 * espinoso», donde el paréntesis de una entrada anterior se pegó a decenas de
 * forámenes que no tienen nada que ver—. No es ruido de OCR que se pueda
 * filtrar: es un defecto de cómo se partió el índice en entradas, y las que
 * parecen sanas incluyen igual muchas mal cortadas.
 *
 * Un glosario clínico que muestre «Abertura — mujer» como término anatómico es
 * peor que no tener el término. El propio corpus lo dice: se declara **para
 * entrenamiento de IA**, conserva la forma fuente literalmente y advierte que
 * no debe usarse como nomenclatura normativa sin cotejar contra FIPAT.
 *
 * Las láminas no tienen ese problema: 546 de 548 vienen de encabezado de
 * página o de la tabla de contenidos (`gold_manual`, `gold_ocr_title`), y sólo
 * 16 arrastran una cola de OCR que se recorta con una regla explícita.
 *
 * ## Qué se extrae de cada definición
 *
 * Los archivos de definición mezclan tres cosas: la descripción anatómica de
 * la región, prosa sobre **cómo entrenar una IA con esto**, y una advertencia
 * de qué no inferir. Sólo la primera y la tercera le sirven a quien consulta;
 * la del entrenamiento no se emite. Por eso esto extrae párrafos concretos en
 * vez de volcar el archivo.
 *
 * Uso: `yarn mock:anatomy`
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ORIGEN = join(process.cwd(), 'data', 'anatomy-atlas');
const DESTINO = join(
  process.cwd(),
  'src',
  'app',
  'core',
  'mock',
  'fixtures',
  'anatomia-atlas.generated.ts',
);

const leer = (...p) => readFileSync(join(ORIGEN, ...p), 'utf8');

/* ---- las 8 regiones y sus subregiones ------------------------------------ */

/**
 * De `03_regiones/R0N_*.md`: el identificador, el rango de láminas, la
 * descripción regional y la lista de subregiones con sus rangos.
 */
function regiones() {
  const archivos = readdirSync(join(ORIGEN, '03_regiones'))
    .filter((n) => n.endsWith('.md'))
    .sort();

  return archivos.map((archivo) => {
    const texto = leer('03_regiones', archivo);
    const nombre = /^#\s+(.+)$/m.exec(texto)?.[1]?.trim();
    const id = /^-\s+ID:\s+`(R\d+)`/m.exec(texto)?.[1];
    const rango = /Láminas Netter:\s+\*\*(\d+)-(\d+)\*\*/.exec(texto);

    // El primer párrafo tras «Definición ampliada»: es la descripción
    // anatómica. El segundo habla de modelar IA y no se emite.
    const cuerpo = texto.split('## Definición ampliada')[1] ?? '';
    const parrafo = cuerpo
      .split('\n\n')
      .map((p) => p.trim())
      .find((p) => p !== '');

    const subregiones = [...texto.matchAll(/^-\s+`(R\d+S\d+)`\s+\*\*(.+?)\*\*\s+—\s+láminas\s+(\d+)-(\d+)/gm)].map(
      (m) => ({
        id: m[1],
        name: m[2].trim(),
        plateFrom: Number(m[3]),
        plateTo: Number(m[4]),
      }),
    );

    if (id === undefined || nombre === undefined || rango === null) {
      throw new Error(`No se pudo leer la región de ${archivo}`);
    }

    return {
      id,
      name: nombre,
      plateFrom: Number(rango[1]),
      plateTo: Number(rango[2]),
      description: limpiarMarcas(parrafo ?? ''),
      subregions: subregiones,
    };
  });
}

/* ---- las 548 láminas ------------------------------------------------------ */

/**
 * Restos del escaneo que el OCR pega al título y no son parte de él.
 *
 * El encabezado de cada lámina comparte página con numeración, marcas de
 * sección y el pie del Atlas, y el OCR se los lleva por delante. Quedan
 * fragmentos de una a cuatro letras delante («ql Agujeros de la base del
 * cráneo», «a] Atrio y ventrículo derechos», «ños) Vasos y nódulos
 * linfáticos») y colas detrás («… visión superior La», «Arteria subclavia a»,
 * «… visión posterior os»).
 *
 * **Lo difícil es que hay fragmentos cortos que sí son parte del título.**
 * `Aa.`, `Nn.`, `Mm.` y `Vv.` son las abreviaturas anatómicas de arterias,
 * nervios, músculos y venas, y aparecen al principio de decenas de láminas.
 * Una regla que borre «token corto inicial» se las lleva puestas y deja
 * títulos mutilados que nadie nota hasta que busca «Nn. craneales» y no
 * aparece.
 *
 * Por eso la regla tiene tres condiciones a la vez: el fragmento mide cuatro
 * caracteres o menos, **no** está en la lista de abreviaturas, y lo que queda
 * detrás empieza en mayúscula. Con eso `TC` sobrevive al final de «imágenes
 * axiales de TC» y `Bazo` sigue siendo un título entero de cuatro letras.
 */
const ABREVIATURAS_ANATOMICAS = ['Aa.', 'Nn.', 'Mm.', 'Vv.', 'Ll.', 'A.', 'N.', 'M.', 'V.'];
const COLAS_DE_ESCANEO = ['al', 'ES', 'EN', 'El', 'La', 'la', 'Ei', 'Es', 'en', 'el', 'os', 'as'];

function sinRestosDelante(titulo) {
  for (let previo = ''; previo !== titulo; ) {
    previo = titulo;

    // Una letra sola con espacio detrás nunca abre un título: las
    // abreviaturas anatómicas llevan punto (`A.`, `Aa.`) y miden dos o más.
    // Va primero porque las hay encadenadas y mezcladas con signos —«a a
    // Exploración de la cabeza», «a / Músculos de la expresión facial»— y la
    // regla de más abajo, que exige mayúscula detrás, no las desarma.
    titulo = titulo.replace(/^[A-Za-zÁÉÍÓÚáéíóúÑñ]\s+/, '').trim();

    const partido = /^(\S{1,4})\s+(.*)$/.exec(titulo);
    if (
      partido !== null &&
      !ABREVIATURAS_ANATOMICAS.includes(partido[1]) &&
      /^[A-ZÁÉÍÓÚÑ]/.test(partido[2]) &&
      // Una palabra capitalizada de verdad («Base del cráneo») no es un resto.
      !/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}/.test(partido[1])
    ) {
      titulo = partido[2].trim();
      continue;
    }
    titulo = titulo.replace(/^[/|·—\-\])»“”‘’:,.]+\s*/, '').trim();
  }
  return titulo;
}

function sinRestosDetras(titulo) {
  for (let previo = ''; previo !== titulo; ) {
    previo = titulo;
    titulo = titulo.replace(/[\s:;,.\-–—]+$/, '').trim();
    const cola = /\s+(\S{1,2})$/.exec(titulo);
    if (
      cola !== null &&
      (COLAS_DE_ESCANEO.includes(cola[1]) || /^[A-Za-zÁÉÍÓÚáéíóúÑñ]$/.test(cola[1]))
    ) {
      titulo = titulo.slice(0, cola.index).trim();
    }
  }
  return titulo;
}

/** ¿Quedó algo legible? Un título sin ninguna palabra de cuatro letras, no. */
function esLegible(titulo) {
  return /[A-Za-zÁÉÍÓÚáéíóúÑñ]{4,}/.test(titulo) && /^[A-ZÁÉÍÓÚÑ0-9]/.test(titulo);
}

function tituloLimpio(bruto) {
  return sinRestosDetras(sinRestosDelante(bruto.trim()));
}

/** Quita negritas y comillas angulares del markdown, que no van al dato. */
function limpiarMarcas(texto) {
  return texto
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mayúscula inicial.
 *
 * En la fuente el párrafo arranca en minúscula porque continúa la frase del
 * párrafo anterior, el que repite el título. Acá ese párrafo no viaja, así que
 * el texto empieza donde empieza y tiene que leerse como una frase.
 */
function conMayuscula(texto) {
  return texto === '' ? '' : texto[0].toUpperCase() + texto.slice(1);
}

/** La tabla que el corpus publica para parsers. */
function laminasDeLaTabla() {
  const filas = [];
  for (const linea of leer('14_machine_readable_md', 'laminas.md').split('\n')) {
    if (!/^\|\d+\|/.test(linea.trim())) continue;
    const c = linea.trim().replace(/^\||\|$/g, '').split('|');
    filas.push({
      plate: Number(c[0]),
      rawTitle: c[1].trim(),
      regionName: c[2].trim(),
      subregionName: c[3].trim(),
      pdfPage: Number(c[4]),
      titleConfidence: c[5].trim(),
    });
  }
  return filas;
}

/**
 * De la ficha de una lámina: la descripción anatómica y la advertencia.
 *
 * El archivo trae cinco bloques y sólo dos sirven acá. El párrafo de la
 * descripción es el **segundo** de «Definición anatómica ampliada»: el primero
 * repite el título y el bloque editorial, que ya están como campos.
 */
function fichaDeLamina(numero) {
  const carpeta = join(ORIGEN, '04_laminas_definiciones_largas');
  const prefijo = `lamina_${String(numero).padStart(3, '0')}_`;
  const archivo = readdirSync(carpeta).find((n) => n.startsWith(prefijo));
  if (archivo === undefined) return { description: '', doNotInfer: '' };

  const texto = readFileSync(join(carpeta, archivo), 'utf8');
  const cuerpo = texto.split('## Definición anatómica ampliada')[1] ?? '';
  const parrafos = cuerpo
    .split('\n\n')
    .map((p) => p.trim())
    .filter((p) => p !== '' && !p.startsWith('#') && !p.startsWith('-') && !p.startsWith('```'));

  const advertencia = (texto.split('## Qué NO inferir')[1] ?? '')
    .split('\n\n')
    .map((p) => p.trim())
    .find((p) => p !== '');

  return {
    regionalContext: conMayuscula(limpiarMarcas(parrafos[1] ?? parrafos[0] ?? '')),
    doNotInfer: limpiarMarcas(advertencia ?? ''),
  };
}

/* ---- comprobaciones antes de escribir ------------------------------------ */

const REGIONES = regiones();
const TABLA = laminasDeLaTabla();
const problemas = [];

if (TABLA.length !== 548) problemas.push(`la tabla trae ${TABLA.length} láminas y no 548`);

const nombresDeRegion = new Set(REGIONES.map((r) => r.name));
for (const fila of TABLA) {
  // «Anatomía seccional» es un bloque propio del Atlas que no tiene región: se
  // deja pasar porque el corpus lo declara así, no por descuido.
  if (!nombresDeRegion.has(fila.regionName) && fila.regionName !== 'Anatomía seccional') {
    problemas.push(`la lámina ${fila.plate} dice región «${fila.regionName}», que no existe`);
  }
}

if (problemas.length > 0) {
  console.error('· gen-anatomy-atlas-fixture — la fuente no es consistente:');
  for (const p of problemas.slice(0, 15)) console.error(`    ${p}`);
  process.exit(1);
}

const LAMINAS = TABLA.map((fila) => {
  const ficha = fichaDeLamina(fila.plate);
  const region = REGIONES.find((r) => r.name === fila.regionName);
  const subregion = region?.subregions.find((s) => s.name === fila.subregionName);
  const limpio = tituloLimpio(fila.rawTitle);
  // Dos láminas de 548 llegan con el encabezado ilegible («e” ae», «parse dedo
  // ace»): no hay nada que recortar, el OCR no leyó el título. Se las nombra
  // por su bloque, que es un dato cierto, en vez de mostrar el ruido.
  const titulo = esLegible(limpio)
    ? limpio
    : `Lámina ${fila.plate} · ${fila.subregionName || fila.regionName}`;

  return {
    id: `PLATE_${String(fila.plate).padStart(3, '0')}`,
    plate: fila.plate,
    title: titulo,
    regionId: region?.id ?? null,
    regionName: fila.regionName,
    subregionId: subregion?.id ?? null,
    subregionName: fila.subregionName,
    pdfPage: fila.pdfPage,
    titleConfidence: fila.titleConfidence,
    regionalContext: ficha.regionalContext,
    doNotInfer: ficha.doNotInfer,
  };
});

const recortados = TABLA.filter((f) => tituloLimpio(f.rawTitle) !== f.rawTitle).length;
const sinContexto = LAMINAS.filter((l) => l.regionalContext === '').length;

/* ---- emisión -------------------------------------------------------------- */

const manifiesto = leer('00_MANIFEST.md');
const entidadesTotales = /Entidades con definición larga:\s*([\d,]+)/.exec(manifiesto)?.[1] ?? '3,161';

const cabecera = `/* ============================================================================
    El índice del atlas anatómico, portado al glosario del simulador.

    **GENERADO por \`scripts/gen-anatomy-atlas-fixture.mjs\`. No editar a mano.**
    La fuente es \`data/anatomy-atlas/\` — la taxonomía anatómica v2 auditada
    sobre el Atlas de Anatomía Humana de Netter, 4.ª edición.

    ${REGIONES.length} regiones · ${REGIONES.reduce((n, r) => n + r.subregions.length, 0)} subregiones · ${LAMINAS.length} láminas.

    ## Las ${entidadesTotales} entidades del índice NO están acá, y es a propósito

    Sus etiquetas son fragmentos del índice escaneado con contexto arrastrado
    entre entradas: 1 400 de 3 161 traen daño visible —«Abertura — mujer»,
    «Abertura lateral (agujero de Luschka) — espinoso», donde el paréntesis de
    una entrada anterior quedó pegado a decenas de forámenes ajenos—. No es
    ruido filtrable sino un defecto de cómo se partió el índice, y entre las
    que parecen sanas hay muchas mal cortadas.

    Mostrar «Abertura — mujer» como término anatómico en un producto clínico es
    peor que no tener el término. El corpus mismo se declara **para
    entrenamiento de IA** y advierte que su forma fuente no es nomenclatura
    normativa sin cotejar contra FIPAT.

    ## Qué se emite de cada lámina

    El archivo de origen mezcla la descripción anatómica con prosa sobre cómo
    entrenar un modelo. Acá sólo viaja lo que le sirve a quien consulta: la
    descripción de la región y la advertencia de qué **no** se puede inferir de
    una lámina, que es justo lo que un atlas visual no dice.

    Títulos a los que se les quitó un resto del escaneo: ${recortados}.
    Láminas sin contexto regional en la fuente: ${sinContexto}.

    Regenerar con \`yarn mock:anatomy\`.
    ========================================================================== */

/** Una subregión: el bloque editorial dentro de una región. */
export interface SubregionAnatomica {
  readonly id: string;
  readonly name: string;
  readonly plateFrom: number;
  readonly plateTo: number;
}

/** Una de las ${REGIONES.length} regiones del atlas. */
export interface RegionAnatomica {
  readonly id: string;
  readonly name: string;
  readonly plateFrom: number;
  readonly plateTo: number;
  readonly description: string;
  readonly subregions: readonly SubregionAnatomica[];
}

/**
 * Una lámina del atlas.
 *
 * \`titleConfidence\` dice de dónde salió el título: \`gold_manual\` verificado a
 * mano, \`gold_ocr_title\` del encabezado de la página, \`derived_from_toc\` de la
 * tabla de contenidos. No es decorado: distingue lo comprobado de lo leído por
 * una máquina.
 */
export interface LaminaAnatomica {
  readonly id: string;
  readonly plate: number;
  readonly title: string;
  readonly regionId: string | null;
  readonly regionName: string;
  readonly subregionId: string | null;
  readonly subregionName: string;
  /** La página del PDF escaneado. Metadato de trazabilidad, no el número de lámina. */
  readonly pdfPage: number;
  readonly titleConfidence: string;
  /**
   * El contexto anatómico del bloque editorial al que pertenece la lámina.
   *
   * **No describe la lámina, describe su región y su subregión**, y por eso se
   * llama así: en la fuente es el mismo texto para todas las láminas del mismo
   * bloque. Llamarlo «descripción» haría creer que cada lámina trae la suya.
   */
  readonly regionalContext: string;
  /** Lo que una lámina **no** autoriza a concluir. Viaja con el dato a propósito. */
  readonly doNotInfer: string;
}

/** La procedencia, para mostrarla al pie. */
export const ATLAS_META = {
  source: 'Netter, Atlas de Anatomía Humana, 4.ª edición',
  edition: '4',
  plates: ${LAMINAS.length},
  regions: ${REGIONES.length},
  subregions: ${REGIONES.reduce((n, r) => n + r.subregions.length, 0)},
  note: 'Índice y bloques editoriales extraídos por OCR y auditados. Las descripciones son derivadas, no citas del Atlas.',
} as const;

`;

const cuerpo =
  `export const REGIONES_ANATOMICAS: readonly RegionAnatomica[] = ${JSON.stringify(REGIONES, null, 2)};\n\n` +
  `export const LAMINAS_ANATOMICAS: readonly LaminaAnatomica[] = ${JSON.stringify(LAMINAS, null, 2)};\n`;

import { writeFileSync } from 'node:fs';
writeFileSync(DESTINO, cabecera + cuerpo, 'utf8');

console.log('· gen-anatomy-atlas-fixture');
console.log(
  `  ${REGIONES.length} regiones · ${REGIONES.reduce((n, r) => n + r.subregions.length, 0)} subregiones · ${LAMINAS.length} láminas`,
);
console.log(`  títulos recortados: ${recortados} · sin contexto: ${sinContexto}`);
console.log(`  → ${DESTINO.replace(process.cwd() + '/', '')}`);
