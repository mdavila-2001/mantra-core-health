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
    // `createImageBitmap` respeta la orientación EXIF por defecto: la foto
    // tomada con el teléfono de costado no llega acostada.
    const mapa = await createImageBitmap(archivo);
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
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, ancho, alto);
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
 * - Una aceptada, liviana y de tamaño razonable **pasa sin tocar**: volver a
 *   comprimir lo que ya está bien sólo pierde calidad.
 * - Una que pesa más que `UPLOAD_MAX_BYTES`, mide más de {@link LADO_MAXIMO}
 *   de lado o viene en un formato que el servidor no reconoce (HEIC, BMP…) se
 *   redibuja como JPEG con el lado mayor en {@link LADO_MAXIMO}.
 * - El GIF no se redibuja —perdería la animación—: si se pasa del tope se
 *   rechaza.
 *
 * `enNavegador` en falso (SSR) devuelve el archivo sin tocar si ya cumple y
 * lo rechaza si no: sin `canvas` no hay cómo reducirlo.
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
    if (aceptada && archivo.size <= UPLOAD_MAX_BYTES && ladoMayor <= LADO_MAXIMO) {
      return archivo;
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

/** `IMG_2041.HEIC` → `IMG_2041.jpg`; sin extensión, se le agrega. */
export function renombrarComoJpeg(nombre: string): string {
  const base = nombre.replace(/\.[^./\\]+$/, '');
  return `${base || 'foto'}.jpg`;
}
