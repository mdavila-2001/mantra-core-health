/* ============================================================================
    La política de subida, tal como el backend la aplica de verdad.

    Existe para que la pantalla deje de pedirle a la persona decisiones que el
    sistema puede resolver solo —la corrección del 10/09/2026 saca «Categoría» y
    «Sensibilidad» del formulario— sin que eso se convierta en enviar valores
    inventados que el servidor rechaza.

    ## De dónde salen estos números y esta lista

    Del repositorio de la API, no de la maqueta:

    - `FILE_STORAGE_MAX_SIZE_BYTES` (`src/common/storage/storage.env.ts`) tiene
      `10 * 1024 * 1024` por omisión, y el interceptor lo aplica **por archivo**
      con `limits: { fileSize, files: 1 }`
      (`common-files.controller.ts`). Por eso el límite se dice «por archivo» y
      por eso un lote son varias peticiones y no un arreglo: el endpoint acepta
      uno.
    - {@link UPLOAD_ACCEPT} es `UPLOAD_MIME_ALLOWLIST.DOCUMENT`
      (`src/common/storage/upload-content-type.ts`), y el servidor **deduce el
      tipo de los primeros bytes**: lo que declare el multipart no lo salva. Un
      formato fuera de esa lista se rechaza con 422, así que ofrecerlo sería
      prometer una subida que no ocurre.
    ========================================================================== */

import type { FileCategory, FileSensitivity } from './files.client';

/**
 * Tope de tamaño **por archivo**, espejo de `FILE_STORAGE_MAX_SIZE_BYTES`.
 *
 * No hay tope de lote: cada archivo viaja en su propia petición, así que lo que
 * limita la cantidad es el tiempo y no una regla del servidor. Por eso la
 * pantalla no anuncia un máximo de archivos que nadie configuró.
 */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Los tipos que el almacenamiento reconoce por firma binaria.
 *
 * Es la lista de `DOCUMENT`, que es la categoría amplia: incluye a la de
 * `IMAGE` entera más el PDF. Se usa en el `accept` del control nativo y también
 * al soltar, porque el atributo sólo filtra el diálogo del sistema.
 */
export const UPLOAD_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/gif';

/** Los mismos tipos, en palabras, para explicar un rechazo. */
export const UPLOAD_ACCEPT_LABEL = 'PDF, JPG, PNG, WEBP o GIF';

/**
 * La categoría técnica que le corresponde a un archivo, deducida de su tipo.
 *
 * ## Por qué se deduce y no se pregunta
 *
 * Porque `category` no es una etiqueta de biblioteca: gobierna qué formatos
 * acepta el almacenamiento (`UPLOAD_MIME_ALLOWLIST`). Preguntárselo a quien
 * sube era pedirle que adivinara una regla del servidor, y equivocarse
 * devolvía «el formato no está permitido para esta categoría» sobre un archivo
 * perfectamente válido.
 *
 * ## Por qué el desconocido cae en `DOCUMENT` y no en `IMAGE`
 *
 * Porque `DOCUMENT` admite **todo** lo que admite `IMAGE` y además el PDF: es
 * el superconjunto, así que elegirlo nunca provoca un rechazo por categoría.
 * Los navegadores mandan `application/octet-stream` para lo que no reconocen, y
 * con `IMAGE` de reserva ese caso fallaba sin motivo.
 */
export function categoryForFile(file: File): FileCategory {
  return file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT';
}

/**
 * Con qué sensibilidad se guarda un adjunto clínico.
 *
 * Sacar el selector del formulario **no** rebaja la protección: los adjuntos de
 * una condición, un procedimiento o un paciente son dato clínico y se guardan
 * como `PHI`, que es lo que el formulario ya traía elegido por omisión. Lo que
 * desaparece es la decisión manual, no la marca — y con ella la posibilidad de
 * que alguien guarde un estudio como `NORMAL` sin querer.
 *
 * `NORMAL` queda para lo que no es clínico y no pasa por acá: una foto de
 * perfil o el logo de una organización, que suben por su propio camino con el
 * valor escrito en el sitio de la llamada.
 */
export const CLINICAL_UPLOAD_SENSITIVITY: FileSensitivity = 'PHI';

const BYTES_POR_UNIDAD = 1024;
const UNIDADES = ['bytes', 'KB', 'MB', 'GB'] as const;

/** Un tamaño en palabras. Mismo criterio que `app-file-input`. */
export function formatearTamano(bytes: number): string {
  if (bytes <= 0) {
    return `0 ${UNIDADES[0]}`;
  }
  const exponente = Math.min(
    Math.floor(Math.log(bytes) / Math.log(BYTES_POR_UNIDAD)),
    UNIDADES.length - 1,
  );
  const tamano = bytes / BYTES_POR_UNIDAD ** exponente;
  return `${Number.parseFloat(tamano.toFixed(1))} ${UNIDADES[exponente]}`;
}
