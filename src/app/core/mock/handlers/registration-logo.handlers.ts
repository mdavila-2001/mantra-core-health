import { preconditionFailed, reply, type MockRouter } from '../mock-router';
import { nuevoId } from '../mock-store';

/* ============================================================================
    La pre-carga del logo del consultorio en el alta del médico:
    `POST /iam/auth/upload-registration-logo` de la API.

    Sin sesión, como la del documento legal: quien sube todavía no tiene
    cuenta, y el alta reclama el archivo por `ownSite.logoFileId`.
    ========================================================================== */

/** Espejo de `LOGO_IMAGE_MIME_TYPES` de la API (`common/storage/logo-image.ts`). */
const LOGO_MIME_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];

/** Espejo de `LOGO_MAX_BYTES` y del límite del `FileInterceptor` de la ruta: 2 MB. */
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Responde como la API: 413 por encima del tope, 422 sin archivo o con un
 * formato que no es png, jpeg ni webp, y 201 con el id a reenviar.
 *
 * Decide por el tipo que declara el navegador: el manejador es síncrono y no
 * puede leer los bytes, así que la detección por firma binaria es sólo de la API.
 */
export function registerRegistrationLogo(router: MockRouter): void {
  router.post('/iam/auth/upload-registration-logo', ({ body }) => {
    const file =
      typeof FormData !== 'undefined' && body instanceof FormData ? body.get('file') : null;
    if (!(file instanceof File)) {
      return preconditionFailed('No se recibió contenido en el campo "file"');
    }
    if (file.size > LOGO_MAX_BYTES) {
      return reply(413, {
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'El logo supera los 2 MB',
        error: 'Payload Too Large',
      });
    }
    if (!LOGO_MIME_TYPES.includes(file.type)) {
      return preconditionFailed('El logo debe ser una imagen PNG, JPEG o WebP', {
        detectedMimeType: file.type || null,
      });
    }
    return reply(201, {
      fileId: nuevoId('registro-logo'),
      originalName: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
    });
  });
}
