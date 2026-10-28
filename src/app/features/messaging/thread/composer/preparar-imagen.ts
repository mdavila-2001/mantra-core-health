import { InjectionToken } from '@angular/core';

import { UPLOAD_MAX_BYTES } from '../../../../core/data-access/files/upload-policy';

/**
 * Las imágenes que el almacenamiento reconoce por firma binaria
 * (`UPLOAD_ACCEPT` sin el PDF). Lo demás que el navegador sepa decodificar
 * —HEIC en Safari, BMP, AVIF— se convierte a JPEG antes de subir.
 */
export const IMAGENES_ACEPTADAS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/**
 * El lado mayor con que viaja una foto. 2048 px alcanzan para leer la letra
 * chica de una receta o de una caja de remedio, y bajan una foto de 12 MP de
 * 4–6 MB a unos cientos de KB: es lo que hace que mandarla por datos móviles
 * no parezca colgada.
 */
export const LADO_MAXIMO = 2048;

/** Calidad del JPEG reducido. Por debajo de 0,8 la letra de una receta se ensucia. */
const CALIDAD = 0.85;

/** Por qué una imagen no se pudo preparar, en palabras para quien la eligió. */
export class ImagenRechazada extends Error {}

/** Lo que necesita `preparar` del navegador. Inyectable para las pruebas. */
export interface Lienzo {
  /** Decodifica el archivo; lanza si el navegador no sabe leerlo. */
  decodificar(archivo: Blob): Promise<{ ancho: number; alto: number; dibujable: CanvasImageSource; cerrar(): void }>;
  /** Dibuja en un lienzo de ese tamaño y lo codifica en el tipo pedido. */
  codificar(fuente: CanvasImageSource, ancho: number, alto: number, tipo: string, calidad: number): Promise<Blob>;
}

/** El lienzo real: `createImageBitmap` + `<canvas>`. Sólo en navegador. */
export const LIENZO_DEL_NAVEGADOR: Lienzo = {
  async decodificar(archivo) {
    // `from-image` aplica la orientación EXIF al decodificar: como el EXIF no
    // sobrevive al redibujo, es la única oportunidad de que la foto tomada
    // con el teléfono de costado no llegue acostada. Se pide explícito y no
    // se confía en el valor por omisión, que cambió entre navegadores.
    const mapa = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    return { ancho: mapa.width, alto: mapa.height, dibujable: mapa, cerrar: () => mapa.close() };
  },
  codificar(fuente, ancho, alto, tipo, calidad) {
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext('2d');
    if (contexto === null) {
      return Promise.reject(new Error('sin contexto 2d'));
    }
    // El JPEG no tiene transparencia: sin fondo, un PNG recortado sale negro.
    // Un PNG redibujado como PNG conserva la suya.
    if (tipo === 'image/jpeg') {
      contexto.fillStyle = '#fff';
      contexto.fillRect(0, 0, ancho, alto);
    }
    contexto.drawImage(fuente, 0, 0, ancho, alto);
    return new Promise((resolver, rechazar) =>
      lienzo.toBlob(
        (blob) => (blob ? resolver(blob) : rechazar(new Error('sin blob'))),
        tipo,
        calidad,
      ),
    );
  },
};

/** El lienzo que usa el composer; las pruebas lo cambian por uno de mentira. */
export const LIENZO = new InjectionToken<Lienzo>('LIENZO', {
  providedIn: 'root',
  factory: () => LIENZO_DEL_NAVEGADOR,
});

/** Si el tipo es una imagen que el servidor acepta tal cual. */
export function esImagenAceptada(tipo: string): boolean {
  return (IMAGENES_ACEPTADAS as readonly string[]).includes(tipo.toLowerCase());
}

/**
 * Deja una imagen lista para subir, o explica por qué no se puede.
 *
 * ## Los metadatos no salen del teléfono
 *
 * Una foto de cámara trae EXIF: modelo del teléfono, fecha y, casi siempre,
 * **las coordenadas GPS de donde se sacó** — la casa de quien manda la foto de
 * su receta. El canvas no copia metadatos, así que redibujar es la manera de
 * quitarlos sin una biblioteca de EXIF. Por formato:
 *
 * - **JPEG: se redibuja siempre**, aunque ya esté bien de tamaño y peso. Es el
 *   formato de la cámara y el que trae el GPS. La orientación se aplica al
 *   decodificar (`imageOrientation: 'from-image'`), porque la etiqueta que la
 *   guardaba se va con el resto. Cuesta una recompresión a 0,85, que en una
 *   foto de 2048 px no se ve.
 * - **HEIC, BMP, AVIF y lo demás que el servidor no reconoce**: se redibujan
 *   como JPEG, como antes. Eso cubre la foto de cámara del iPhone.
 * - **PNG que entra en los topes: no se recomprime.** Es casi siempre una
 *   captura de pantalla, donde el JPEG ensucia la letra y pierde la
 *   transparencia. En vez de redibujarlo se le **sacan los bloques de
 *   metadatos** (`eXIf`, `tEXt`, `zTXt`, `iTXt` —donde va el XMP—, `tIME`) sin
 *   tocar un píxel: {@link quitarMetadatosPng}. Si traía `eXIf` puede traer
 *   también una orientación, así que ese PNG sí se redibuja, como PNG, para no
 *   perderla ni perder la transparencia.
 * - **WEBP que entra en los topes: no se recomprime.** Llega de un sticker,
 *   de una imagen guardada de la web o de algún teléfono Android, y puede
 *   traer los chunks RIFF `EXIF` y `XMP ` con el GPS. Se le **sacan esos dos
 *   chunks** sin tocar un píxel —se recalcula el tamaño RIFF y se apagan los
 *   bits de EXIF y XMP del `VP8X`—: {@link quitarMetadatosWebp}. Si el EXIF
 *   guardaba una orientación distinta de la normal, o los bytes no son un
 *   RIFF/WEBP bien armado (cortado, extensión cambiada), se **redibuja como
 *   WEBP** —con su transparencia—, o como PNG si el navegador no codifica WEBP.
 * - **GIF: nunca se redibuja** —perdería la animación—. Se le **sacan las
 *   extensiones de comentario y las de aplicación** (donde va el XMP), salvo
 *   `NETSCAPE2.0`/`ANIMEXTS1.0`, que guardan el loop: {@link quitarMetadatosGif}.
 *   Un GIF que no se puede recorrer entero se rechaza: no se manda a ciegas.
 *   Si se pasa del tope se rechaza.
 *
 * Lo que pesa más que `UPLOAD_MAX_BYTES` o mide más de {@link LADO_MAXIMO} de
 * lado se redibuja como JPEG con el lado mayor en {@link LADO_MAXIMO}, sea del
 * formato que sea (salvo el GIF). Si un PNG o un WEBP redibujado sin pérdida
 * se pasa del tope, también termina en JPEG.
 *
 * `enNavegador` en falso (SSR) devuelve el archivo sin tocar si ya cumple
 * (al GIF igual se le sacan los metadatos: no hace falta `canvas`) y lo
 * rechaza si no: sin `canvas` no hay cómo reducirlo. En la práctica el
 * servidor nunca recibe un archivo elegido: no hay selector sin navegador.
 */
export async function prepararImagen(
  archivo: File,
  enNavegador: boolean,
  lienzo: Lienzo = LIENZO_DEL_NAVEGADOR,
): Promise<File> {
  const tipo = archivo.type.toLowerCase();
  const aceptada = esImagenAceptada(tipo);

  if (tipo === 'image/gif') {
    if (archivo.size > UPLOAD_MAX_BYTES) {
      throw new ImagenRechazada(`«${archivo.name}» pesa más de 10 MB. Los GIF no se pueden achicar.`);
    }
    return limpiarGif(archivo);
  }

  if (!enNavegador) {
    if (aceptada && archivo.size <= UPLOAD_MAX_BYTES) {
      return archivo;
    }
    throw new ImagenRechazada(`No pudimos preparar «${archivo.name}».`);
  }

  let imagen: Awaited<ReturnType<Lienzo['decodificar']>>;
  try {
    imagen = await lienzo.decodificar(archivo);
  } catch {
    throw new ImagenRechazada(
      aceptada
        ? `No pudimos abrir «${archivo.name}». Puede estar dañada.`
        : `«${archivo.name}» no es una imagen que podamos mandar. Probá con JPG, PNG, WEBP o GIF.`,
    );
  }

  try {
    const ladoMayor = Math.max(imagen.ancho, imagen.alto);
    const entraEnLosTopes = aceptada && archivo.size <= UPLOAD_MAX_BYTES && ladoMayor <= LADO_MAXIMO;
    if (entraEnLosTopes && tipo === 'image/webp') {
      const limpio = await limpiarWebp(archivo);
      if (limpio !== 'redibujar') {
        return limpio;
      }
      // Calidad 1: Chromium codifica WEBP sin pérdida. Un navegador que no
      // sabe codificar WEBP devuelve PNG (`toBlob` cae a PNG): se respeta.
      const blob = await lienzo.codificar(imagen.dibujable, imagen.ancho, imagen.alto, 'image/webp', 1);
      if (blob.size <= UPLOAD_MAX_BYTES) {
        const comoPng = blob.type !== 'image/webp';
        return new File([blob], comoPng ? renombrar(archivo.name, 'png') : archivo.name, {
          type: comoPng ? 'image/png' : 'image/webp',
          lastModified: archivo.lastModified,
        });
      }
      // Redibujado se pasó del tope: sigue como JPEG.
    }
    if (entraEnLosTopes && tipo === 'image/png') {
      const limpio = await limpiarPng(archivo);
      if (limpio !== 'redibujar') {
        return limpio;
      }
      const blob = await lienzo.codificar(imagen.dibujable, imagen.ancho, imagen.alto, 'image/png', 1);
      if (blob.size <= UPLOAD_MAX_BYTES) {
        return new File([blob], archivo.name, { type: 'image/png', lastModified: archivo.lastModified });
      }
      // Redibujado sin compresión con pérdida se pasó del tope: sigue como JPEG.
    }

    let escala = Math.min(1, LADO_MAXIMO / ladoMayor);
    let calidad = CALIDAD;
    // Dos intentos más chicos si todavía no entra. En la práctica el primero
    // alcanza: 2048 px en JPEG 0,85 rara vez pasa de 1,5 MB.
    for (let intento = 0; intento < 3; intento++) {
      const ancho = Math.max(1, Math.round(imagen.ancho * escala));
      const alto = Math.max(1, Math.round(imagen.alto * escala));
      const blob = await lienzo.codificar(imagen.dibujable, ancho, alto, 'image/jpeg', calidad);
      if (blob.size <= UPLOAD_MAX_BYTES) {
        return new File([blob], renombrarComoJpeg(archivo.name), {
          type: 'image/jpeg',
          lastModified: archivo.lastModified,
        });
      }
      escala *= 0.75;
      calidad = 0.75;
    }
    throw new ImagenRechazada(`«${archivo.name}» es demasiado grande, aun achicándola.`);
  } catch (error) {
    if (error instanceof ImagenRechazada) {
      throw error;
    }
    throw new ImagenRechazada(`No pudimos preparar «${archivo.name}».`);
  } finally {
    imagen.cerrar();
  }
}

/** La firma de 8 bytes con que empieza todo PNG. */
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/**
 * Los bloques de un PNG que guardan datos de quien sacó o editó la imagen y
 * no hacen falta para dibujarla. Los de color (`iCCP`, `gAMA`, `cHRM`,
 * `sRGB`) y los de densidad (`pHYs`) se quedan: cambian cómo se ve.
 */
const BLOQUES_DE_METADATOS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

/**
 * Le saca a un PNG los bloques de metadatos sin decodificarlo: los píxeles,
 * la paleta y la transparencia quedan byte a byte.
 *
 * Devuelve `null` si los bytes no son un PNG bien armado (no se adivina: el
 * que llama decide). No verifica los CRC: no los cambia, sólo deja de copiar
 * bloques enteros.
 */
export function quitarMetadatosPng(
  bytes: Uint8Array,
): { readonly limpio: Uint8Array; readonly quitados: readonly string[] } | null {
  if (bytes.length < FIRMA_PNG.length || FIRMA_PNG.some((byte, i) => bytes[i] !== byte)) {
    return null;
  }
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const partes: Uint8Array[] = [bytes.subarray(0, FIRMA_PNG.length)];
  const quitados: string[] = [];
  let posicion: number = FIRMA_PNG.length;
  let terminado = false;
  // Cada bloque: largo (4) + tipo (4) + datos (largo) + CRC (4).
  while (posicion + 12 <= bytes.length) {
    const largo = vista.getUint32(posicion);
    const fin = posicion + 12 + largo;
    if (fin > bytes.length) {
      return null;
    }
    const tipo = String.fromCharCode(...bytes.subarray(posicion + 4, posicion + 8));
    if (BLOQUES_DE_METADATOS.has(tipo)) {
      quitados.push(tipo);
    } else {
      partes.push(bytes.subarray(posicion, fin));
    }
    posicion = fin;
    if (tipo === 'IEND') {
      terminado = true;
      break;
    }
  }
  if (!terminado) {
    return null;
  }
  return { limpio: unir(partes), quitados };
}

/**
 * El PNG sin metadatos, el mismo archivo si no tenía, o `'redibujar'` si
 * traía `eXIf` —que puede guardar una orientación— o no se pudo leer.
 */
async function limpiarPng(archivo: File): Promise<File | 'redibujar'> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await archivo.arrayBuffer());
  } catch {
    return 'redibujar';
  }
  const resultado = quitarMetadatosPng(bytes);
  if (resultado === null) {
    // Lo decodificó el navegador pero no es un PNG bien armado por dentro
    // (un archivo con la extensión cambiada, por ejemplo): redibujado no
    // arrastra nada que no sean píxeles.
    return 'redibujar';
  }
  if (resultado.quitados.includes('eXIf')) {
    return 'redibujar';
  }
  if (resultado.quitados.length === 0) {
    return archivo;
  }
  return new File([resultado.limpio as Uint8Array<ArrayBuffer>], archivo.name, {
    type: 'image/png',
    lastModified: archivo.lastModified,
  });
}

/** Concatena partes en un solo arreglo. */
function unir(partes: readonly Uint8Array[]): Uint8Array {
  const unido = new Uint8Array(partes.reduce((total, parte) => total + parte.length, 0));
  let cursor = 0;
  for (const parte of partes) {
    unido.set(parte, cursor);
    cursor += parte.length;
  }
  return unido;
}

const ascii = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

/** Bits del primer byte de datos de `VP8X` (RFC 9649 §2.7). */
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

/**
 * Le saca a un WEBP los chunks `EXIF` y `XMP ` sin decodificarlo: `VP8 `,
 * `VP8L`, `ALPH`, `ICCP`, `ANIM`/`ANMF` quedan byte a byte. Recalcula el
 * tamaño RIFF y apaga en `VP8X` los bits de EXIF y XMP.
 *
 * Devuelve `null` si los bytes no son un RIFF/WEBP bien armado o vienen
 * cortados (el que llama decide). `exif` es el contenido del chunk `EXIF`
 * quitado, por si guardaba una orientación. Lo que haya después del final
 * declarado del RIFF se descarta: ningún decodificador lo lee.
 */
export function quitarMetadatosWebp(bytes: Uint8Array): {
  readonly limpio: Uint8Array;
  readonly quitados: readonly string[];
  readonly exif: Uint8Array | null;
} | null {
  if (bytes.length < 12 || ascii(bytes.subarray(0, 4)) !== 'RIFF' || ascii(bytes.subarray(8, 12)) !== 'WEBP') {
    return null;
  }
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fin = 8 + vista.getUint32(4, true);
  if (fin > bytes.length || fin < 12) {
    return null;
  }
  const partes: Uint8Array[] = [];
  const quitados: string[] = [];
  let exif: Uint8Array | null = null;
  let vp8x: Uint8Array | null = null;
  let posicion = 12;
  // Cada chunk: FourCC (4) + tamaño LE (4) + datos + un byte de relleno si el tamaño es impar.
  while (posicion < fin) {
    if (posicion + 8 > fin) {
      return null;
    }
    const tipo = ascii(bytes.subarray(posicion, posicion + 4));
    const largo = vista.getUint32(posicion + 4, true);
    const finChunk = posicion + 8 + largo + (largo % 2);
    if (finChunk > fin) {
      return null;
    }
    if (tipo === 'EXIF' || tipo === 'XMP ') {
      quitados.push(tipo);
      if (tipo === 'EXIF') {
        exif = bytes.subarray(posicion + 8, posicion + 8 + largo);
      }
    } else if (tipo === 'VP8X' && partes.length === 0 && largo >= 10) {
      // Copia: no se toca el arreglo de quien llama.
      vp8x = bytes.slice(posicion, finChunk);
      partes.push(vp8x);
    } else {
      partes.push(bytes.subarray(posicion, finChunk));
    }
    posicion = finChunk;
  }
  if (partes.length === 0) {
    return null;
  }
  if (vp8x !== null) {
    vp8x[8] &= ~(VP8X_EXIF | VP8X_XMP);
  }
  const cuerpo = unir(partes);
  const cabecera = new Uint8Array(12);
  cabecera.set(bytes.subarray(0, 12));
  new DataView(cabecera.buffer).setUint32(4, 4 + cuerpo.length, true);
  return { limpio: unir([cabecera, cuerpo]), quitados, exif };
}

/**
 * La orientación (etiqueta `0x0112` del IFD0) de un bloque EXIF/TIFF, con o
 * sin el prefijo `Exif\0\0`. `null` si no la trae o no se puede leer.
 */
export function orientacionExif(exif: Uint8Array): number | null {
  let tiff = exif;
  if (tiff.length >= 6 && ascii(tiff.subarray(0, 6)) === 'Exif\0\0') {
    tiff = tiff.subarray(6);
  }
  if (tiff.length < 8) {
    return null;
  }
  const orden = ascii(tiff.subarray(0, 2));
  if (orden !== 'II' && orden !== 'MM') {
    return null;
  }
  const le = orden === 'II';
  const vista = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const ifd = vista.getUint32(4, le);
  if (ifd + 2 > tiff.length) {
    return null;
  }
  const entradas = vista.getUint16(ifd, le);
  for (let i = 0; i < entradas; i++) {
    const entrada = ifd + 2 + i * 12;
    if (entrada + 12 > tiff.length) {
      return null;
    }
    if (vista.getUint16(entrada, le) === 0x0112) {
      return vista.getUint16(entrada + 8, le);
    }
  }
  return null;
}

/**
 * El WEBP sin metadatos, el mismo archivo si no tenía, o `'redibujar'` si no
 * se pudo leer o el EXIF giraba la imagen (al decodificar se aplica el giro;
 * quitarlo sin redibujar la dejaría acostada).
 */
async function limpiarWebp(archivo: File): Promise<File | 'redibujar'> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await archivo.arrayBuffer());
  } catch {
    return 'redibujar';
  }
  const resultado = quitarMetadatosWebp(bytes);
  if (resultado === null) {
    return 'redibujar';
  }
  if (resultado.exif !== null) {
    const orientacion = orientacionExif(resultado.exif);
    if (orientacion !== null && orientacion !== 1) {
      return 'redibujar';
    }
  }
  if (resultado.quitados.length === 0 && resultado.limpio.length === bytes.length) {
    return archivo;
  }
  return new File([resultado.limpio as Uint8Array<ArrayBuffer>], archivo.name, {
    type: 'image/webp',
    lastModified: archivo.lastModified,
  });
}

/** Las extensiones de aplicación de un GIF que guardan el loop de la animación. */
const APLICACIONES_DEL_LOOP = new Set(['NETSCAPE2.0', 'ANIMEXTS1.0']);

/**
 * Le saca a un GIF lo que no hace falta para dibujarlo ni animarlo: las
 * extensiones de comentario (`0x21 0xFE`), las de aplicación salvo
 * `NETSCAPE2.0`/`ANIMEXTS1.0` (ahí va el XMP, `XMP DataXMP`) y las de tipo
 * desconocido. Quedan byte a byte la cabecera, las paletas, los cuadros, los
 * controles gráficos (`0xF9`: demora y transparencia) y el texto plano
 * (`0x01`, que se dibuja). Lo que siga al trailer `0x3B` se descarta.
 *
 * Devuelve `null` si no es un GIF o no se puede recorrer hasta el trailer.
 */
export function quitarMetadatosGif(
  bytes: Uint8Array,
): { readonly limpio: Uint8Array; readonly quitados: readonly string[] } | null {
  const firma = bytes.length >= 6 ? ascii(bytes.subarray(0, 6)) : '';
  if ((firma !== 'GIF87a' && firma !== 'GIF89a') || bytes.length < 13) {
    return null;
  }
  /** Salta sub-bloques desde `posicion` hasta el terminador; `-1` si se corta. */
  const saltarSubbloques = (posicion: number): number => {
    while (posicion < bytes.length) {
      const largo = bytes[posicion];
      posicion += 1 + largo;
      if (largo === 0) {
        return posicion;
      }
    }
    return -1;
  };
  const tablaDe = (empaquetado: number): number => (empaquetado & 0x80 ? 3 * (1 << ((empaquetado & 0x07) + 1)) : 0);

  let posicion = 13 + tablaDe(bytes[10]);
  if (posicion > bytes.length) {
    return null;
  }
  const partes: Uint8Array[] = [bytes.subarray(0, posicion)];
  const quitados: string[] = [];
  while (posicion < bytes.length) {
    const introductor = bytes[posicion];
    if (introductor === 0x3b) {
      partes.push(bytes.subarray(posicion, posicion + 1));
      return { limpio: unir(partes), quitados };
    }
    let fin: number;
    let quitar: string | null = null;
    if (introductor === 0x2c) {
      // Descriptor de imagen (10) + paleta local + tamaño mínimo LZW (1) + datos.
      if (posicion + 11 > bytes.length) {
        return null;
      }
      const datos = posicion + 10 + tablaDe(bytes[posicion + 9]) + 1;
      fin = datos > bytes.length ? -1 : saltarSubbloques(datos);
    } else if (introductor === 0x21) {
      if (posicion + 2 > bytes.length) {
        return null;
      }
      const etiqueta = bytes[posicion + 1];
      fin = saltarSubbloques(posicion + 2);
      if (etiqueta === 0xfe) {
        quitar = 'comentario';
      } else if (etiqueta === 0xff) {
        const id = bytes[posicion + 2] === 11 && posicion + 14 <= bytes.length
          ? ascii(bytes.subarray(posicion + 3, posicion + 14))
          : '';
        if (!APLICACIONES_DEL_LOOP.has(id)) {
          quitar = `aplicación ${id.trim() || 'desconocida'}`;
        }
      } else if (etiqueta !== 0xf9 && etiqueta !== 0x01) {
        quitar = `extensión 0x${etiqueta.toString(16)}`;
      }
    } else {
      return null;
    }
    if (fin < 0) {
      return null;
    }
    if (quitar === null) {
      partes.push(bytes.subarray(posicion, fin));
    } else {
      quitados.push(quitar);
    }
    posicion = fin;
  }
  // Sin trailer: cortado.
  return null;
}

/** El GIF sin metadatos, o el mismo archivo si no tenía. Rechaza uno corrupto. */
async function limpiarGif(archivo: File): Promise<File> {
  let bytes: Uint8Array | null = null;
  try {
    bytes = new Uint8Array(await archivo.arrayBuffer());
  } catch {
    // Se rechaza abajo.
  }
  const resultado = bytes === null ? null : quitarMetadatosGif(bytes);
  if (bytes === null || resultado === null) {
    throw new ImagenRechazada(`No pudimos abrir «${archivo.name}». El GIF parece dañado o incompleto.`);
  }
  if (resultado.quitados.length === 0 && resultado.limpio.length === bytes.length) {
    return archivo;
  }
  return new File([resultado.limpio as Uint8Array<ArrayBuffer>], archivo.name, {
    type: 'image/gif',
    lastModified: archivo.lastModified,
  });
}

/** `IMG_2041.HEIC` → `IMG_2041.jpg`; sin extensión, se le agrega. */
export function renombrarComoJpeg(nombre: string): string {
  return renombrar(nombre, 'jpg');
}

function renombrar(nombre: string, extension: string): string {
  const base = nombre.replace(/\.[^./\\]+$/, '');
  return `${base || 'foto'}.${extension}`;
}
