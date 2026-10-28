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
 * - **WEBP que entra en los topes: pasa sin tocar.** Ninguna cámara lo
 *   produce; llega de un sticker o de una imagen guardada de la web, y
 *   redibujarlo como JPEG le quitaría la transparencia.
 * - **GIF: nunca se redibuja** —perdería la animación—: si se pasa del tope se
 *   rechaza.
 *
 * Lo que pesa más que `UPLOAD_MAX_BYTES` o mide más de {@link LADO_MAXIMO} de
 * lado se redibuja como JPEG con el lado mayor en {@link LADO_MAXIMO}, sea del
 * formato que sea (salvo el GIF).
 *
 * `enNavegador` en falso (SSR) devuelve el archivo sin tocar si ya cumple y
 * lo rechaza si no: sin `canvas` no hay cómo reducirlo. En la práctica el
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
    return archivo;
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
      return archivo;
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
  const limpio = new Uint8Array(partes.reduce((total, parte) => total + parte.length, 0));
  let cursor = 0;
  for (const parte of partes) {
    limpio.set(parte, cursor);
    cursor += parte.length;
  }
  return { limpio, quitados };
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

/** `IMG_2041.HEIC` → `IMG_2041.jpg`; sin extensión, se le agrega. */
export function renombrarComoJpeg(nombre: string): string {
  const base = nombre.replace(/\.[^./\\]+$/, '');
  return `${base || 'foto'}.jpg`;
}
