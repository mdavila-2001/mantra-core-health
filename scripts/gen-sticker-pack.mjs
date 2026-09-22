#!/usr/bin/env node
/**
 * Genera el pack de stickers «AloVida Salud» del chat.
 *
 * ## Qué es un sticker acá
 *
 * Una ilustración **con una frase**. Es lo que lo separa de un emoji grande:
 * un emoji dice un gesto, un sticker dice una cosa —«Ya voy en camino»,
 * «Recuperate pronto»— de un toque, que es justamente lo que se manda en un
 * chat entre un consultorio y un paciente.
 *
 * Cada sticker se compone acá: la ilustración de OpenMoji, la frase en
 * castellano y el fondo redondeado, todo en un SVG propio que se sirve como
 * archivo estático del producto.
 *
 * ## Fuentes y licencia (regla 70 del proyecto)
 *
 * | Qué | Fuente | Licencia |
 * |---|---|---|
 * | Las ilustraciones | OpenMoji 15.0.0, `color/svg` — https://openmoji.org | CC BY-SA 4.0 |
 * | Las frases | Escritas para este producto | Propias |
 *
 * CC BY-SA 4.0 obliga a atribuir y a compartir igual. La atribución queda en
 * `public/stickers/LICENSE.md`, que se genera junto con los archivos, y en el
 * pie del panel de stickers del chat. **No se usan fotos de stock ni
 * ilustraciones sin licencia comprobable** — la regla `00-non-negotiables` §8
 * lo prohíbe y acá no hace falta.
 *
 * ## Los identificadores son fijos
 *
 * El `fileId` de cada sticker está escrito en esta tabla y no se deriva de
 * nada. Son los mismos uuids con los que el backend va a sembrar el pack en
 * `common.files`: si se generaran, cada entorno tendría los suyos y un sticker
 * mandado desde la maqueta no se entendería en producción.
 *
 * ## Uso
 *
 * ```bash
 * yarn sticker:pack            # baja las ilustraciones y regenera
 * yarn sticker:pack --offline  # usa lo ya bajado en .cache/openmoji/
 * ```
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(RAIZ, '.cache', 'openmoji');
const DESTINO_SVG = join(RAIZ, 'public', 'stickers');
// En `core/messaging` y no junto al composer: lo consultan tres —el panel que
// los ofrece, el store que decide no pedirle los bytes al servidor y el hilo
// que los dibuja sin burbuja—. Es del dominio de la mensajería, no de la barra
// de escribir.
const SALIDA_TS = join(RAIZ, 'src/app/core/messaging/sticker-pack.generated.ts');

const OPENMOJI_VERSION = '15.0.0';
const url = (hex) =>
  `https://cdn.jsdelivr.net/npm/openmoji@${OPENMOJI_VERSION}/color/svg/${hex}.svg`;

/**
 * El pack, en el orden en que se muestra.
 *
 * `id` es el uuid con el que viaja el sticker; `hex` el punto de código de la
 * ilustración en OpenMoji; `frase` lo que dice; `nombre` cómo lo anuncia un
 * lector de pantalla.
 */
const PACK = [
  { clave: 'saludo', hex: '1F44B', frase: '¡Hola!', nombre: 'Hola', id: 'a7c1f0e2-0001-4a00-9000-5713ca110001' },
  { clave: 'gracias', hex: '1F64F', frase: '¡Gracias!', nombre: 'Gracias', id: 'a7c1f0e2-0002-4a00-9000-5713ca110002' },
  { clave: 'en-camino', hex: '1F697', frase: 'Ya voy en camino', nombre: 'Ya voy en camino', id: 'a7c1f0e2-0003-4a00-9000-5713ca110003' },
  { clave: 'llegando-tarde', hex: '23F0', frase: 'Llego unos minutos tarde', nombre: 'Llego tarde', id: 'a7c1f0e2-0004-4a00-9000-5713ca110004' },
  { clave: 'confirmado', hex: '2705', frase: 'Turno confirmado', nombre: 'Turno confirmado', id: 'a7c1f0e2-0005-4a00-9000-5713ca110005' },
  { clave: 'te-espero', hex: '1FA7A', frase: 'Te espero en la consulta', nombre: 'Te espero en la consulta', id: 'a7c1f0e2-0006-4a00-9000-5713ca110006' },
  { clave: 'receta-lista', hex: '1F48A', frase: 'Tu receta está lista', nombre: 'Receta lista', id: 'a7c1f0e2-0007-4a00-9000-5713ca110007' },
  { clave: 'tomar-remedio', hex: '1F552', frase: 'Acordate del remedio', nombre: 'Acordate del remedio', id: 'a7c1f0e2-0008-4a00-9000-5713ca110008' },
  { clave: 'resultados', hex: '1F9EA', frase: 'Resultados listos', nombre: 'Resultados listos', id: 'a7c1f0e2-0009-4a00-9000-5713ca110009' },
  { clave: 'ayunas', hex: '1F957', frase: 'Vení en ayunas', nombre: 'Vení en ayunas', id: 'a7c1f0e2-0010-4a00-9000-5713ca110010' },
  { clave: 'mejorate', hex: '1F917', frase: 'Recuperate pronto', nombre: 'Recuperate pronto', id: 'a7c1f0e2-0011-4a00-9000-5713ca110011' },
  { clave: 'animo', hex: '1F4AA', frase: '¡Ánimo!', nombre: 'Ánimo', id: 'a7c1f0e2-0012-4a00-9000-5713ca110012' },
  { clave: 'cuidate', hex: '2764', frase: 'Cuidate mucho', nombre: 'Cuidate mucho', id: 'a7c1f0e2-0013-4a00-9000-5713ca110013' },
  { clave: 'descansa', hex: '1F634', frase: 'Descansá', nombre: 'Descansá', id: 'a7c1f0e2-0014-4a00-9000-5713ca110014' },
  { clave: 'agua', hex: '1F4A7', frase: 'Tomá agua', nombre: 'Tomá agua', id: 'a7c1f0e2-0015-4a00-9000-5713ca110015' },
  { clave: 'control', hex: '1FA7A', frase: 'Control en dos semanas', nombre: 'Control en dos semanas', id: 'a7c1f0e2-0016-4a00-9000-5713ca110016' },
  { clave: 'entendido', hex: '1F44C', frase: 'Entendido', nombre: 'Entendido', id: 'a7c1f0e2-0017-4a00-9000-5713ca110017' },
  { clave: 'consulta', hex: '2753', frase: 'Tengo una consulta', nombre: 'Tengo una consulta', id: 'a7c1f0e2-0018-4a00-9000-5713ca110018' },
  { clave: 'reprogramar', hex: '1F4C6', frase: '¿Podemos reprogramar?', nombre: 'Podemos reprogramar', id: 'a7c1f0e2-0019-4a00-9000-5713ca110019' },
  { clave: 'urgencia', hex: '1F691', frase: 'Es urgente', nombre: 'Es urgente', id: 'a7c1f0e2-0020-4a00-9000-5713ca110020' },
  { clave: 'estudios', hex: '1FA7B', frase: 'Traé tus estudios', nombre: 'Traé tus estudios', id: 'a7c1f0e2-0021-4a00-9000-5713ca110021' },
  { clave: 'buen-dia', hex: '2600', frase: '¡Buen día!', nombre: 'Buen día', id: 'a7c1f0e2-0022-4a00-9000-5713ca110022' },
  { clave: 'buenas-noches', hex: '1F319', frase: 'Buenas noches', nombre: 'Buenas noches', id: 'a7c1f0e2-0023-4a00-9000-5713ca110023' },
  { clave: 'felicitaciones', hex: '1F389', frase: '¡Felicitaciones!', nombre: 'Felicitaciones', id: 'a7c1f0e2-0024-4a00-9000-5713ca110024' },
];

/** El ancho del lienzo del sticker, en píxeles de su viewBox. */
const LIENZO = 240;

/** Escapa lo que va dentro de un nodo de texto SVG. */
function escapar(texto) {
  return texto
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

/**
 * Parte la frase en a lo sumo dos renglones, cortando por la palabra del medio.
 *
 * Dos y no más: un sticker con tres renglones de texto deja de leerse de un
 * vistazo, que es lo único que un sticker tiene que conseguir.
 */
function renglones(frase) {
  if (frase.length <= 16) {
    return [frase];
  }
  const palabras = frase.split(' ');
  let mejor = 1;
  let menorDiferencia = Infinity;
  for (let corte = 1; corte < palabras.length; corte += 1) {
    const izquierda = palabras.slice(0, corte).join(' ').length;
    const derecha = palabras.slice(corte).join(' ').length;
    const diferencia = Math.abs(izquierda - derecha);
    if (diferencia < menorDiferencia) {
      menorDiferencia = diferencia;
      mejor = corte;
    }
  }
  return [palabras.slice(0, mejor).join(' '), palabras.slice(mejor).join(' ')];
}

/** El contenido de la ilustración de OpenMoji, sin su envoltorio `<svg>`. */
function tripas(svg) {
  const adentro = /<svg[^>]*>([\s\S]*)<\/svg>/u.exec(svg);
  const cuerpo = adentro === null ? svg : adentro[1];
  // OpenMoji trae una capa `line` con el contorno negro y otra `color`. Las dos
  // se conservan: el contorno es lo que le da el aire de ilustración y no de
  // mancha de color.
  return cuerpo.replace(/<!--[\s\S]*?-->/gu, '').trim();
}

/**
 * Compone el SVG del sticker.
 *
 * Sin fondo opaco: un sticker se apoya sobre la burbuja o sobre el papel del
 * hilo, y un rectángulo blanco detrás lo convertiría en una estampilla. El
 * texto va en la tipografía del sistema —un `<img>` no carga fuentes de la
 * página— con una sombra suave para que se lea sobre cualquier fondo.
 */
function componer(sticker, ilustracion) {
  const lineas = renglones(sticker.frase);
  const tamano = lineas.length === 1 ? 22 : 19;
  const desdeY = lineas.length === 1 ? 206 : 194;
  const textos = lineas
    .map(
      (linea, i) =>
        `    <text x="${LIENZO / 2}" y="${desdeY + i * (tamano + 4)}" text-anchor="middle" font-family="Poppins, 'Segoe UI', system-ui, sans-serif" font-size="${tamano}" font-weight="600" fill="#0B3953">${escapar(linea)}</text>`,
    )
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LIENZO} ${LIENZO}" width="${LIENZO}" height="${LIENZO}" role="img" aria-label="${escapar(sticker.nombre)}">
  <title>${escapar(sticker.nombre)}</title>
  <!-- Ilustración: OpenMoji ${OPENMOJI_VERSION} (${sticker.hex}), CC BY-SA 4.0 — https://openmoji.org -->
  <g transform="translate(48 24) scale(2)">
${tripas(ilustracion)}
  </g>
  <g>
${textos}
  </g>
</svg>
`;
}

async function bajar(sticker, offline) {
  const destino = join(CACHE, `${sticker.hex}.svg`);
  if (existsSync(destino)) {
    return readFile(destino, 'utf8');
  }
  if (offline) {
    throw new Error(`Falta ${destino}. Corré sin --offline para bajarlo.`);
  }
  const respuesta = await fetch(url(sticker.hex));
  if (!respuesta.ok) {
    throw new Error(`${url(sticker.hex)} respondió ${respuesta.status}`);
  }
  const svg = await respuesta.text();
  await writeFile(destino, svg);
  return svg;
}

function comoTypeScript() {
  const filas = PACK.map(
    (s) =>
      `  {
    id: '${s.id}',
    clave: '${s.clave}',
    nombre: ${JSON.stringify(s.nombre)},
    frase: ${JSON.stringify(s.frase)},
    url: '/stickers/${s.clave}.svg',
  },`,
  ).join('\n');

  return `/* ============================================================================
    El pack de stickers «AloVida Salud».

    **GENERADO por \`scripts/gen-sticker-pack.mjs\`. No editar a mano.**

    Las ilustraciones son de OpenMoji ${OPENMOJI_VERSION} (https://openmoji.org),
    bajo **CC BY-SA 4.0**; las frases se escribieron para este producto. La
    atribución completa está en \`public/stickers/LICENSE.md\` y se muestra al
    pie del panel de stickers.

    Los \`id\` son fijos y no se derivan de nada: son los mismos uuids con los
    que el backend siembra el pack en \`common.files\`, de modo que un sticker
    mandado desde un entorno se entiende en el otro.

    Regenerar con \`yarn sticker:pack\`.
    ========================================================================== */

/** Un sticker del pack. */
export interface Sticker {
  /** El \`fileId\` con el que viaja el mensaje. Fijo en todos los entornos. */
  readonly id: string;
  readonly clave: string;
  /** Cómo lo anuncia un lector de pantalla. */
  readonly nombre: string;
  /** Lo que dice el sticker. */
  readonly frase: string;
  /** De dónde se pinta. Es un archivo del producto, no del usuario. */
  readonly url: string;
}

export const PACK_DE_STICKERS: readonly Sticker[] = [
${filas}
];

/**
 * El sticker de un \`fileId\`, o \`undefined\` si ese archivo no es uno.
 *
 * Es lo que le permite al hilo dibujar un sticker **sin fondo de burbuja** y
 * sin pedirle los bytes al servidor: el pack es del producto y el cliente ya lo
 * tiene. Un adjunto cualquiera sigue el camino de siempre.
 */
export function stickerDe(fileId: string | undefined): Sticker | undefined {
  return fileId === undefined ? undefined : porId().get(fileId);
}

let indice: ReadonlyMap<string, Sticker> | null = null;
function porId(): ReadonlyMap<string, Sticker> {
  indice ??= new Map(PACK_DE_STICKERS.map((sticker) => [sticker.id, sticker]));
  return indice;
}
`;
}

function licencia() {
  const lista = PACK.map(
    (s) => `| \`${s.clave}.svg\` | ${s.nombre} | OpenMoji \`${s.hex}\` |`,
  ).join('\n');

  return `# Pack de stickers «AloVida Salud»

**GENERADO por \`scripts/gen-sticker-pack.mjs\`. No editar a mano.**

## Ilustraciones

Las ilustraciones provienen de **OpenMoji ${OPENMOJI_VERSION}** —
<https://openmoji.org> — y están bajo licencia
**Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**:
<https://creativecommons.org/licenses/by-sa/4.0/>

Obtenidas el ${new Date().toISOString().slice(0, 10)} desde
\`https://cdn.jsdelivr.net/npm/openmoji@${OPENMOJI_VERSION}/color/svg/\`.

CC BY-SA 4.0 exige **atribuir** la fuente y **compartir igual** las obras
derivadas. Estos archivos son obras derivadas: combinan la ilustración de
OpenMoji con una frase escrita para este producto, y se distribuyen bajo la
misma licencia. La atribución también se muestra al pie del panel de stickers
del chat.

## Frases

Escritas para AloVida. No provienen de ninguna fuente de terceros.

## Los archivos

| Archivo | Frase | Ilustración |
|---|---|---|
${lista}
`;
}

async function main() {
  const offline = process.argv.includes('--offline');
  await mkdir(CACHE, { recursive: true });
  await mkdir(DESTINO_SVG, { recursive: true });

  for (const sticker of PACK) {
    const ilustracion = await bajar(sticker, offline);
    await writeFile(join(DESTINO_SVG, `${sticker.clave}.svg`), componer(sticker, ilustracion));
  }

  await writeFile(join(DESTINO_SVG, 'LICENSE.md'), licencia());
  await writeFile(SALIDA_TS, comoTypeScript());

  process.stdout.write(`${PACK.length} stickers → ${DESTINO_SVG}\n`);
  process.stdout.write(`catálogo → ${SALIDA_TS}\n`);
}

await main();
