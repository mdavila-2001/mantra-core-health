#!/usr/bin/env node
/**
 * Genera el catálogo de emojis del chat desde las fuentes oficiales Unicode.
 *
 * ## Por qué un generador y no una lista a mano
 *
 * El selector tenía **150 emojis escritos a mano** en seis categorías. Alcanza
 * para un chat de prueba y no para uno de verdad: lo que la gente busca —una
 * bandera, un animal, un gesto concreto— no estaba, y no había forma de
 * buscarlo porque un emoji escrito en el código no tiene nombre.
 *
 * Tampoco sirve una librería de npm: las tres que hay traen un índice de miles
 * de símbolos **con nombres en inglés**, y acá se escribe en castellano. Buscar
 * «jeringa» tiene que encontrar 💉, no `syringe`.
 *
 * ## Fuentes (regla 70 del proyecto: procedencia, no invención)
 *
 * | Qué | Fuente | Licencia |
 * |---|---|---|
 * | La lista, sus grupos y su orden | `https://unicode.org/Public/emoji/16.0/emoji-test.txt` | Unicode License v3 |
 * | Los nombres y las palabras de búsqueda, en castellano | CLDR 47 `cldr-annotations-full` y `cldr-annotations-derived-full`, locale `es` | Unicode License v3 |
 *
 * Ningún nombre se inventa ni se traduce acá: si CLDR no tiene el emoji en
 * castellano, el emoji **no entra** en el catálogo. Un nombre inventado es un
 * resultado de búsqueda falso.
 *
 * ## Lo que se deja afuera, y por qué
 *
 * - El grupo `Component` (tonos de piel y colores de pelo sueltos): no son
 *   emojis que alguien mande, son modificadores.
 * - Las variantes con tono de piel: multiplican por seis la lista para decir lo
 *   mismo. Elegir tono es una preferencia con su propia interfaz, y no la hay.
 * - Lo que no sea `fully-qualified`: las formas a medias se ven rotas en buena
 *   parte de los sistemas.
 *
 * ## Uso
 *
 * ```bash
 * yarn emoji:catalog            # baja las fuentes y regenera
 * yarn emoji:catalog --offline  # usa lo ya bajado en .cache/emoji/
 * ```
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(RAIZ, '.cache', 'emoji');
const SALIDA = join(
  RAIZ,
  'src/app/features/messaging/thread/composer/emoji-catalog.generated.ts',
);

/** La versión de emoji de la que se toma la lista. */
const VERSION_EMOJI = '16.0';

const FUENTES = {
  'emoji-test.txt': `https://unicode.org/Public/emoji/${VERSION_EMOJI}/emoji-test.txt`,
  'annotations-es.json':
    'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-full/annotations/es/annotations.json',
  'annotations-derived-es.json':
    'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-derived-full/annotationsDerived/es/annotations.json',
};

/**
 * Los nueve grupos de Unicode, con su rótulo en castellano y el emoji que los
 * representa en la tira de pestañas.
 *
 * El orden es el de esta tabla, no el del archivo: en un chat de salud se
 * busca antes una cara que una bandera.
 */
const GRUPOS = [
  { unicode: 'Smileys & Emotion', clave: 'caras', rotulo: 'Caras y emociones', icono: '🙂' },
  { unicode: 'People & Body', clave: 'gente', rotulo: 'Gente y gestos', icono: '👋' },
  { unicode: 'Animals & Nature', clave: 'naturaleza', rotulo: 'Animales y naturaleza', icono: '🌿' },
  { unicode: 'Food & Drink', clave: 'comida', rotulo: 'Comida y bebida', icono: '🍎' },
  { unicode: 'Activities', clave: 'actividades', rotulo: 'Actividades', icono: '⚽' },
  { unicode: 'Travel & Places', clave: 'lugares', rotulo: 'Viajes y lugares', icono: '✈️' },
  { unicode: 'Objects', clave: 'objetos', rotulo: 'Objetos', icono: '💡' },
  { unicode: 'Symbols', clave: 'simbolos', rotulo: 'Símbolos', icono: '❤️' },
  { unicode: 'Flags', clave: 'banderas', rotulo: 'Banderas', icono: '🏳️' },
];

/**
 * La categoría de salud, curada a mano.
 *
 * Es la única lista escrita: son los emojis que un médico y un paciente usan
 * todos los días, y en el catálogo completo quedan repartidos entre «Gente»,
 * «Objetos» y «Símbolos». Tenerlos juntos y primeros es la diferencia entre
 * dos toques y buscar. Los nombres igual salen de CLDR — acá sólo se elige
 * **cuáles**, no cómo se llaman.
 */
const SALUD = [
  '🩺', '💊', '💉', '🩹', '🩻', '🧪', '🧬', '🦷', '🫀', '🫁',
  '🧠', '🦴', '👁️', '👂', '🦻', '🩸', '🌡️', '🏥', '🚑', '⚕️',
  '👩‍⚕️', '👨‍⚕️', '🧑‍⚕️', '🤒', '🤕', '🤧', '😷', '🤢', '🥴', '😮‍💨',
  '🧴', '🧼', '🚽', '🛌', '💤', '📋', '📄', '📆', '⏰', '✅',
];

/** Los tonos de piel, que se descartan junto con sus variantes. */
const TONOS = /[\u{1F3FB}-\u{1F3FF}]/u;

async function bajar(offline) {
  await mkdir(CACHE, { recursive: true });
  const contenidos = {};
  for (const [nombre, url] of Object.entries(FUENTES)) {
    const destino = join(CACHE, nombre);
    if (offline || existsSync(destino)) {
      if (!existsSync(destino)) {
        throw new Error(`Falta ${destino}. Corré sin --offline para bajarlo.`);
      }
      contenidos[nombre] = await readFile(destino, 'utf8');
      continue;
    }
    process.stdout.write(`bajando ${nombre}… `);
    const respuesta = await fetch(url);
    if (!respuesta.ok) {
      throw new Error(`${url} respondió ${respuesta.status}`);
    }
    const texto = await respuesta.text();
    await writeFile(destino, texto);
    contenidos[nombre] = texto;
    process.stdout.write('ok\n');
  }
  return contenidos;
}

/** Lee `emoji-test.txt` y devuelve los emojis por grupo, en su orden. */
function leerLista(texto) {
  const porGrupo = new Map();
  let grupo = '';
  for (const linea of texto.split('\n')) {
    const marca = /^# group: (.+)$/u.exec(linea);
    if (marca) {
      grupo = marca[1].trim();
      continue;
    }
    if (linea.startsWith('#') || linea.trim() === '') {
      continue;
    }
    const fila = /^([0-9A-F ]+);\s*fully-qualified\s*#\s*(\S+)/u.exec(linea);
    if (fila === null) {
      continue;
    }
    const emoji = fila[2];
    if (grupo === 'Component' || TONOS.test(emoji)) {
      continue;
    }
    if (!porGrupo.has(grupo)) {
      porGrupo.set(grupo, []);
    }
    porGrupo.get(grupo).push(emoji);
  }
  return porGrupo;
}

/** Quita tildes y baja a minúsculas, como hace el buscador del selector. */
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase();
}

/**
 * La misma secuencia sin los selectores de variación.
 *
 * `emoji-test.txt` escribe ⚕️ con `U+FE0F` al final —la forma «con pinta de
 * emoji»— y CLDR lo indexa sin él. Sin normalizar las dos puntas se perdían
 * **371 emojis**, entre ellos 👩‍⚕️, 🌡️, 👁️ y ⚕️: justo los de salud, que es
 * para lo que existe este chat.
 */
function sinVariacion(emoji) {
  return emoji.replace(/\uFE0F/gu, '');
}

/** Junta las anotaciones de CLDR: nombre corto (`tts`) y palabras (`default`). */
function leerAnotaciones(...jsons) {
  const mapa = new Map();
  for (const json of jsons) {
    const datos = JSON.parse(json);
    const raiz = datos.annotations ?? datos.annotationsDerived;
    for (const [emoji, anotacion] of Object.entries(raiz.annotations)) {
      const nombre = anotacion.tts?.[0];
      if (nombre === undefined) {
        continue;
      }
      const entrada = { nombre, palabras: anotacion.default ?? [] };
      mapa.set(emoji, entrada);
      // También por su forma sin `U+FE0F`, que es como viene de la lista.
      const desnudo = sinVariacion(emoji);
      if (!mapa.has(desnudo)) {
        mapa.set(desnudo, entrada);
      }
    }
  }
  return mapa;
}

/**
 * Arma la entrada de un emoji: el símbolo, su nombre en castellano y las
 * palabras con las que se lo encuentra, ya normalizadas y sin repetir lo que
 * el nombre ya dice.
 */
function entrada(emoji, anotaciones) {
  const anotacion =
    anotaciones.get(emoji) ?? anotaciones.get(sinVariacion(emoji));
  if (anotacion === undefined) {
    return null;
  }
  const enNombre = normalizar(anotacion.nombre);
  const claves = [
    ...new Set(
      anotacion.palabras
        .map(normalizar)
        .filter((palabra) => palabra !== '' && !enNombre.includes(palabra)),
    ),
  ];
  return { e: emoji, n: anotacion.nombre, k: claves.join('|') };
}

function comoTypeScript(grupos, totales) {
  const cuerpo = grupos
    .map(
      (grupo) => `  {
    clave: '${grupo.clave}',
    rotulo: '${grupo.rotulo}',
    icono: '${grupo.icono}',
    emojis: [
${grupo.emojis
  .map((e) => `      { e: '${e.e}', n: ${JSON.stringify(e.n)}, k: ${JSON.stringify(e.k)} },`)
  .join('\n')}
    ],
  },`,
    )
    .join('\n');

  return `/* ============================================================================
    El catálogo de emojis del chat.

    **GENERADO por \`scripts/gen-emoji-catalog.mjs\`. No editar a mano.**

    Fuentes, con su procedencia:
    · La lista, sus grupos y su orden — Unicode Emoji ${VERSION_EMOJI},
      https://unicode.org/Public/emoji/${VERSION_EMOJI}/emoji-test.txt
    · Los nombres y las palabras de búsqueda, en castellano — CLDR, locale \`es\`
      (\`cldr-annotations-full\` y \`cldr-annotations-derived-full\`),
      https://github.com/unicode-org/cldr-json
    Las dos bajo Unicode License v3. Ningún nombre se inventó ni se tradujo acá.

    Sin tonos de piel: multiplican la lista por seis para decir lo mismo, y
    elegirlos es una preferencia con su propia interfaz, que no existe todavía.

    Regenerar con \`yarn emoji:catalog\`.
    Total: ${totales} emojis en ${grupos.length} grupos.
    ========================================================================== */

/** Un emoji con lo que hace falta para mostrarlo y para encontrarlo. */
export interface EmojiDelCatalogo {
  /** El símbolo. */
  readonly e: string;
  /** Cómo se llama en castellano, tal como lo dice CLDR. */
  readonly n: string;
  /**
   * Las demás palabras con las que se lo encuentra, separadas por \`|\`.
   *
   * Ya vienen sin tildes y en minúsculas —el buscador normaliza la consulta y
   * compara directo— y no repiten lo que el nombre ya dice.
   */
  readonly k: string;
}

/** Un grupo del selector, con su pestaña. */
export interface GrupoDeEmojis {
  readonly clave: string;
  readonly rotulo: string;
  readonly icono: string;
  readonly emojis: readonly EmojiDelCatalogo[];
}

export const GRUPOS_DE_EMOJIS: readonly GrupoDeEmojis[] = [
${cuerpo}
];
`;
}

async function main() {
  const offline = process.argv.includes('--offline');
  const archivos = await bajar(offline);
  const lista = leerLista(archivos['emoji-test.txt']);
  const anotaciones = leerAnotaciones(
    archivos['annotations-es.json'],
    archivos['annotations-derived-es.json'],
  );

  const sinNombre = [];
  const construir = (emojis) =>
    emojis
      .map((emoji) => {
        const item = entrada(emoji, anotaciones);
        if (item === null) {
          sinNombre.push(emoji);
        }
        return item;
      })
      .filter((item) => item !== null);

  const grupos = [
    {
      clave: 'salud',
      rotulo: 'Salud',
      icono: '🩺',
      emojis: construir(SALUD),
    },
    ...GRUPOS.map((grupo) => ({
      clave: grupo.clave,
      rotulo: grupo.rotulo,
      icono: grupo.icono,
      emojis: construir(lista.get(grupo.unicode) ?? []),
    })),
  ];

  const totales = grupos.reduce((suma, grupo) => suma + grupo.emojis.length, 0);
  await writeFile(SALIDA, comoTypeScript(grupos, totales));

  for (const grupo of grupos) {
    process.stdout.write(`  ${grupo.rotulo.padEnd(24)} ${grupo.emojis.length}\n`);
  }
  process.stdout.write(`\n${totales} emojis → ${SALIDA}\n`);
  if (sinNombre.length > 0) {
    process.stdout.write(
      `${sinNombre.length} sin nombre en CLDR es, descartados: ${sinNombre.slice(0, 10).join(' ')}\n`,
    );
  }
}

await main();
