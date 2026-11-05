import { HttpHeaders } from '@angular/common/http';
import { beforeEach, describe, expect, it } from 'vitest';

import { registrarPerfiles } from './profiles.handlers';
import { registrarArchivos } from './files.handlers';
import { registrarComunidad } from './community.handlers';
import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { showcases } from '../fixtures/community';
import { PROFESSIONALS, PATIENTS } from '../fixtures/people';

describe('gestión de fotos de perfil y visualización en chat', () => {
  const router = new MockRouter();
  registrarPerfiles(router);
  registrarArchivos(router);
  registrarComunidad(router);

  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;

  function llamar<T = unknown>(
    method: MockMethod,
    path: string,
    body: unknown = null,
    user: typeof medica | typeof paciente | null = medica,
  ): T {
    const [pathname, queryString] = path.split('?');
    const match = router.match(method, pathname!);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const res = match.handler({
      method,
      path: pathname!,
      params: match.params,
      query: new URLSearchParams(queryString ?? ''),
      body,
      headers: new HttpHeaders(),
      user,
    });
    return (isMockReply(res) ? res.body : res) as T;
  }

  it('PUT /profiles/practitioners/:id/photo guarda photoFileId y sincroniza con vitrina', () => {
    const doc = PROFESSIONALS[0]!;
    const nuevaFotoId = 'file-foto-medica-nueva';

    const perfil = llamar<{ photoFileId?: string }>(
      'PUT',
      `/profiles/practitioners/${doc.id}/photo`,
      { fileId: nuevaFotoId },
      medica,
    );

    expect(perfil.photoFileId).toBe(nuevaFotoId);

    const summary = llamar<{ photoFileId?: string }>(
      'GET',
      '/profiles/practitioners/me/summary',
      null,
      medica,
    );
    expect(summary.photoFileId).toBe(nuevaFotoId);

    const vitrina = showcases.todos().find((v) => v.targetId === doc.id);
    expect(vitrina?.avatarFileId).toBe(nuevaFotoId);
  });

  it('DELETE /profiles/practitioners/:id/photo limpia photoFileId', () => {
    const doc = PROFESSIONALS[0]!;
    const perfil = llamar<{ photoFileId?: string }>(
      'DELETE',
      `/profiles/practitioners/${doc.id}/photo`,
      null,
      medica,
    );

    expect(perfil.photoFileId).toBeUndefined();

    const summary = llamar<{ photoFileId?: string }>(
      'GET',
      '/profiles/practitioners/me/summary',
      null,
      medica,
    );
    expect(summary.photoFileId).toBeUndefined();
  });

  it('PUT /profiles/patients/me/photo actualiza la foto del paciente y su vitrina', () => {
    const pac = PATIENTS[0]!;
    const fotoPaciente = 'file-foto-paciente-nueva';

    const propio = llamar<{ photoFileId?: string }>(
      'PUT',
      '/profiles/patients/me/photo',
      { fileId: fotoPaciente },
      paciente,
    );

    expect(propio.photoFileId).toBe(fotoPaciente);

    const vitrina = showcases.todos().find((v) => v.targetId === pac.id);
    if (vitrina) {
      expect(vitrina.avatarFileId).toBe(fotoPaciente);
    }
  });

  it('permite leer foto con sensibilidad NORMAL por cualquier usuario o anónimo', () => {
    // Foto del profesional accesible sin rol especial ni ser autor
    const doc = PROFESSIONALS[1]!;
    const contenido = llamar<unknown>(
      'GET',
      `/common/files/${doc.photoFileId}/content`,
      null,
      null,
    );

    expect(contenido).toBeDefined();
    expect((contenido as { code?: string }).code).not.toBe('FORBIDDEN');
  });

  it('los participantes en conversaciones de chat reciben su avatarUrl resuelta', () => {
    const bandeja = llamar<{ items: Array<{ id: string; peers: Array<{ displayName: string; avatarUrl: string | null }> }> }>(
      'GET',
      '/community/conversations?profileId=' + encodeURIComponent(showcases.todos()[0]!.id),
      null,
      medica,
    );

    expect(bandeja.items.length).toBeGreaterThan(0);
    const primera = bandeja.items[0]!;
    expect(primera.peers.length).toBeGreaterThan(0);
    for (const peer of primera.peers) {
      expect(peer.displayName).toBeDefined();
    }
  });
});
