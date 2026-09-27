import { HttpHeaders } from '@angular/common/http';

import { mensajes, VITRINA_MEDICA, VITRINA_PACIENTE } from '../fixtures/comunidad';
import { MockRouter, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { registrarComunidad } from './community.handlers';
import { registrarArchivos } from './files.handlers';

/**
 * `GET /community/conversations/:id/attachments/:fileId/content` — el adjunto
 * de una conversación, para quien participa en ella (5.1 · FT-32-R02).
 *
 * La API lo sirve desde el PR que cerró la descarga contextual; el simulador no
 * tenía la ruta, así que en `mockup` toda foto o PDF de un chat quedaba como
 * «no se pudo cargar». Como la API, cualquier combinación ajena es el mismo 404.
 */
describe('adjuntos de conversación (simulador)', () => {
  const router = new MockRouter();
  registrarArchivos(router);
  registrarComunidad(router);

  const patientUser = buscarUsuario('paciente')!;
  const doctorUser = buscarUsuario('medica')!;

  const DERMATOLOGY_CONVERSATION = uuid('conv-paciente-dermatologo');
  const CARDIOLOGY_CONVERSATION = uuid('conv-equipo-cardio');
  const MOLE_PHOTO = uuid('file-lunar');
  const GUIDE_PDF = uuid('file-guia-anticoagulacion');

  function requestContent(conversationId: string, fileId: string, profileId: string, user: MockUser | null): unknown {
    const path = `/community/conversations/${conversationId}/attachments/${fileId}/content`;
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams({ profileId }),
      body: null,
      headers: new HttpHeaders(),
      user,
    });
  }

  /** El estado HTTP, con el mismo criterio que el enrutador: sólo `{status, body}` es respuesta. */
  function statusOf(valor: unknown): number {
    return typeof valor === 'object' &&
      valor !== null &&
      'body' in valor &&
      typeof (valor as MockReply).status === 'number'
      ? (valor as MockReply).status
      : 200;
  }

  describe('correcto', () => {
    it('quien participa lee la foto que mandó, con su nombre en Content-Disposition', () => {
      const response = requestContent(DERMATOLOGY_CONVERSATION, MOLE_PHOTO, VITRINA_PACIENTE.id, patientUser) as {
        body: unknown;
        headers: Record<string, string>;
      };

      expect(statusOf(response)).toBe(200);
      expect(String(response.body)).toContain('data:image/svg+xml');
      expect(response.headers['Content-Disposition']).toContain('lunar.jpg');
    });
  });

  describe('límite', () => {
    it('un documento del grupo llega como PDF, no como el dibujo de la miniatura', () => {
      const response = requestContent(CARDIOLOGY_CONVERSATION, GUIDE_PDF, VITRINA_MEDICA.id, doctorUser) as { body: Blob };

      expect(statusOf(response)).toBe(200);
      expect(response.body).toBeInstanceOf(Blob);
      expect(response.body.type).toBe('application/pdf');
    });

    it('un mensaje que nombra un archivo que ya no existe responde 404, no bytes vacíos', () => {
      const orphanFileId = uuid('file-que-no-existe');
      mensajes.agregar({
        id: uuid('msg-adjunto-huerfano'),
        conversationId: DERMATOLOGY_CONVERSATION,
        senderProfileId: VITRINA_PACIENTE.id,
        replyToMessageId: null,
        contentTypeConceptId: mensajes.todos()[0]!.contentTypeConceptId,
        bodyText: '',
        attachmentFileId: orphanFileId,
        isEdited: false,
        sentAt: new Date().toISOString(),
      });

      expect(statusOf(requestContent(DERMATOLOGY_CONVERSATION, orphanFileId, VITRINA_PACIENTE.id, patientUser))).toBe(404);
    });
  });

  describe('inválido / no autorizado', () => {
    it('quien no participa de la conversación recibe 404', () => {
      expect(statusOf(requestContent(CARDIOLOGY_CONVERSATION, GUIDE_PDF, VITRINA_PACIENTE.id, patientUser))).toBe(404);
    });

    it('un perfil que no es el de la sesión recibe 404, aunque ese perfil participe', () => {
      expect(statusOf(requestContent(DERMATOLOGY_CONVERSATION, MOLE_PHOTO, VITRINA_PACIENTE.id, doctorUser))).toBe(404);
    });

    it('un archivo de otra conversación no se lee por ésta', () => {
      expect(statusOf(requestContent(DERMATOLOGY_CONVERSATION, GUIDE_PDF, VITRINA_PACIENTE.id, patientUser))).toBe(404);
    });

    it('sin sesión, 404', () => {
      expect(statusOf(requestContent(DERMATOLOGY_CONVERSATION, MOLE_PHOTO, VITRINA_PACIENTE.id, null))).toBe(404);
    });
  });
});
