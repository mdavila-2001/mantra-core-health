import { MEDICA } from '../fixtures/people';
import { notFound, type MockRequest, type MockRouter } from '../mock-router';
import { cuerpo, uuid } from '../mock-store';

/**
 * SIMULADOR de la **firma** y el **sello** médicos de un profesional.
 *
 * Son **imágenes** —la firma manuscrita escaneada y el sello—, no una firma
 * electrónica: ni certificado ni criptografía. El backend real no tiene dónde
 * guardarlas (ver `docs/pendientes-backend-perfil-profesional.md`), así que las
 * dos rutas de abajo existen sólo en la rama `mockup`. Las pantallas y el PDF
 * no las llaman directo: pasan por `FirmaYSelloClient`, y el día que exista el
 * backend se borra este archivo y se retoca esa fachada.
 */

interface ActivosDeFirma {
  readonly signatureFileId: string | null;
  readonly sealFileId: string | null;
}

/** Por perfil profesional. La médica de la maqueta arranca con los dos cargados. */
const activos = new Map<string, ActivosDeFirma>([
  [
    MEDICA.id,
    { signatureFileId: uuid('file-firma-medica'), sealFileId: uuid('file-sello-medica') },
  ],
]);

/** Lo que tiene cargado un profesional; vacío si nunca cargó nada. */
export function activosDeFirmaDe(profileId: string): ActivosDeFirma {
  return activos.get(profileId) ?? { signatureFileId: null, sealFileId: null };
}

/** Guarda sólo lo que viene: una clave ausente deja lo que había. */
export function guardarActivosDeFirma(
  profileId: string,
  cambios: Partial<ActivosDeFirma>,
): ActivosDeFirma {
  const nuevos = { ...activosDeFirmaDe(profileId), ...cambios };
  activos.set(profileId, nuevos);
  return nuevos;
}

function perfilDeSesion(request: MockRequest): string | undefined {
  return request.user?.practitionerProfileId;
}

export function registrarFirmaYSello(router: MockRouter): void {
  router.get('/profiles/practitioners/me/signature-assets', (request) => {
    const profileId = perfilDeSesion(request);
    return profileId === undefined
      ? notFound('No tiene perfil profesional')
      : activosDeFirmaDe(profileId);
  });

  router.put('/profiles/practitioners/me/signature-assets', (request) => {
    const profileId = perfilDeSesion(request);
    if (profileId === undefined) return notFound('No tiene perfil profesional');
    const datos = cuerpo<{ signatureFileId?: string | null; sealFileId?: string | null }>(request);
    return guardarActivosDeFirma(profileId, {
      ...(datos.signatureFileId === undefined ? {} : { signatureFileId: datos.signatureFileId }),
      ...(datos.sealFileId === undefined ? {} : { sealFileId: datos.sealFileId }),
    });
  });
}
