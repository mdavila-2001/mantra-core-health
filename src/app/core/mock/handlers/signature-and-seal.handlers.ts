import { MEDICAL } from '../fixtures/people';
import { notFound, type MockRequest, type MockRouter } from '../mock-router';
import { cuerpo, uuid } from '../mock-store';

/**
 * SIMULADOR de la **firma** y el **sello** médicos de un profesional.
 *
 * Son **imágenes** —la firma manuscrita escaneada y el sello—, no una firma
 * electrónica: ni certificado ni criptografía. Las dos rutas de abajo imitan
 * `GET`/`PUT /profiles/practitioners/me/signature-assets` de la API. Las
 * pantallas y el PDF no las llaman directo: pasan por `FirmaYSelloClient`.
 */

interface SignatureAssets {
  readonly signatureFileId: string | null;
  readonly sealFileId: string | null;
}

/** Por perfil profesional. La médica de la maqueta arranca con los dos cargados. */
const storedAssets = new Map<string, SignatureAssets>([
  [
    MEDICAL.id,
    { signatureFileId: uuid('file-firma-medica'), sealFileId: uuid('file-sello-medica') },
  ],
]);

/** Lo que tiene cargado un profesional; vacío si nunca cargó nada. */
export function signatureAssetsOf(profileId: string): SignatureAssets {
  return storedAssets.get(profileId) ?? { signatureFileId: null, sealFileId: null };
}

/** Guarda sólo lo que viene: una clave ausente deja lo que había. */
export function signatureSaveAssets(
  profileId: string,
  cambios: Partial<SignatureAssets>,
): SignatureAssets {
  const nuevos = { ...signatureAssetsOf(profileId), ...cambios };
  storedAssets.set(profileId, nuevos);
  return nuevos;
}

function sessionProfile(request: MockRequest): string | undefined {
  return request.user?.practitionerProfileId;
}

export function registerSignatureAndSeal(router: MockRouter): void {
  router.get('/profiles/practitioners/me/signature-assets', (request) => {
    const profileId = sessionProfile(request);
    return profileId === undefined
      ? notFound('No tiene perfil profesional')
      : signatureAssetsOf(profileId);
  });

  router.put('/profiles/practitioners/me/signature-assets', (request) => {
    const profileId = sessionProfile(request);
    if (profileId === undefined) return notFound('No tiene perfil profesional');
    const datos = cuerpo<{ signatureFileId?: string | null; sealFileId?: string | null }>(request);
    return signatureSaveAssets(profileId, {
      ...(datos.signatureFileId === undefined ? {} : { signatureFileId: datos.signatureFileId }),
      ...(datos.sealFileId === undefined ? {} : { sealFileId: datos.sealFileId }),
    });
  });
}
