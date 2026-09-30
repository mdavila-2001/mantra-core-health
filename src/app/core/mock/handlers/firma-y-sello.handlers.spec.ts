import { HttpHeaders } from '@angular/common/http';

import { MEDICA } from '../fixtures/personas';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { uuid } from '../mock-store';
import { crearRouterSimulado } from './index';
import { fileContent } from './files.handlers';
import { activosDeFirmaDe } from './firma-y-sello.handlers';

/**
 * La firma y el sello médicos del simulador: **imágenes**, no firma electrónica.
 *
 * Se llama a los manejadores directo, como `mock-backend.spec.ts`, para no
 * depender de la capa HTTP.
 */
const router = crearRouterSimulado();

function pedir(
  method: MockMethod,
  path: string,
  user: { readonly practitionerProfileId?: string } | null,
  body: unknown = {},
): unknown {
  const request = {
    method,
    path,
    params: {},
    query: new URLSearchParams(),
    body,
    headers: new HttpHeaders(),
    user,
  } as unknown as MockRequest;
  return router.match(method, path)!.handler(request);
}

const RUTA = '/profiles/practitioners/me/signature-assets';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

describe('firma y sello en el simulador', () => {
  it('la médica de la maqueta arranca con los dos cargados, y son archivos que existen', () => {
    const activos = pedir('GET', RUTA, { practitionerProfileId: MEDICA.id }) as {
      signatureFileId: string;
      sealFileId: string;
    };

    expect(activos.signatureFileId).toBe(uuid('file-firma-medica'));
    expect(activos.sealFileId).toBe(uuid('file-sello-medica'));
    expect(fileContent(activos.signatureFileId)).toBeDefined();
    expect(fileContent(activos.sealFileId)).toBeDefined();
  });

  it('una cuenta sin perfil profesional recibe 404', () => {
    const respuesta = pedir('GET', RUTA, {});

    expect(isMockReply(respuesta) && respuesta.status).toBe(404);
  });

  it('un profesional que nunca cargó nada recibe las dos en null', () => {
    const activos = pedir('GET', RUTA, { practitionerProfileId: 'hpid-sin-nada' });

    expect(activos).toEqual({ signatureFileId: null, sealFileId: null });
  });

  it('PUT cambia sólo lo que viene: una clave ausente deja lo que había', () => {
    const user = { practitionerProfileId: 'hpid-parcial' };
    pedir('PUT', RUTA, user, { signatureFileId: 'f1', sealFileId: 's1' });

    pedir('PUT', RUTA, user, { signatureFileId: 'f2' });

    expect(pedir('GET', RUTA, user)).toEqual({ signatureFileId: 'f2', sealFileId: 's1' });
  });

  it('PUT con null quita esa imagen y deja la otra', () => {
    const user = { practitionerProfileId: 'hpid-quita' };
    pedir('PUT', RUTA, user, { signatureFileId: 'f1', sealFileId: 's1' });

    pedir('PUT', RUTA, user, { sealFileId: null });

    expect(pedir('GET', RUTA, user)).toEqual({ signatureFileId: 'f1', sealFileId: null });
  });

  it('cada profesional ve sólo lo suyo', () => {
    pedir('PUT', RUTA, { practitionerProfileId: 'hpid-a' }, { signatureFileId: 'solo-de-a' });

    expect(activosDeFirmaDe('hpid-b').signatureFileId).toBeNull();
  });

  describe('el alta del doctor', () => {
    const alta = (body: object) =>
      pedir('POST', '/iam/auth/register-practitioner', null, {
        email: `nuevo-${Math.random()}@example.test`,
        ...body,
      }) as { practitionerProfileId: string };

    it('guarda la firma y el sello que vinieron como imágenes, bajo el perfil recién creado', () => {
      const creado = alta({ signatureImageBase64: PNG, sealImageBase64: PNG });

      const activos = activosDeFirmaDe(creado.practitionerProfileId);
      expect(activos.signatureFileId).not.toBeNull();
      expect(activos.sealFileId).not.toBeNull();
      expect(fileContent(activos.signatureFileId!)).toBeDefined();
    });

    it('con sólo la firma, el sello queda sin cargar', () => {
      const creado = alta({ signatureImageBase64: PNG });

      const activos = activosDeFirmaDe(creado.practitionerProfileId);
      expect(activos.signatureFileId).not.toBeNull();
      expect(activos.sealFileId).toBeNull();
    });

    it('sin ninguna de las dos el alta sigue igual y no crea nada', () => {
      const creado = alta({});

      expect(activosDeFirmaDe(creado.practitionerProfileId)).toEqual({
        signatureFileId: null,
        sealFileId: null,
      });
    });
  });
});
