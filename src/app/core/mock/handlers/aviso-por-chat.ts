import { CONCEPTO, conversaciones, mensajes, SOPORTE_ID, vitrinaDe } from '../fixtures/comunidad';
import { ahora, nuevoId } from '../mock-store';

/* ============================================================================
    Un aviso del sistema en el chat del paciente.

    La confirmación de una cita tiene que llegarle al paciente por el chat de
    la app, no sólo por un toast que ve quien está mirando la pantalla. El aviso
    sale de la cuenta «Soporte AloVida», la misma que la maqueta ya usa para
    hablarle al paciente, en su conversación directa con él (o en una nueva si
    todavía no hablaron).

    Sólo escriben acá los avisos que la plataforma emite sola: confirmaciones
    de turno. Nada que deba decir un profesional sale con esta firma.
    ========================================================================== */

/**
 * Deja `texto` en la conversación entre Soporte y el paciente, y la marca como
 * no leída para él. Devuelve `false` si el paciente no tiene perfil de
 * comunidad (un dependiente sin cuenta, por ejemplo): no hay a quién avisar.
 */
export function avisarPorChatDeSoporte(patientProfileId: string, texto: string): boolean {
  const vitrina = vitrinaDe(patientProfileId);
  if (vitrina === undefined) return false;
  const existente = conversaciones.filtrar(
    (c) => c.groupId === null && c.participantes.length === 2 && c.participantes.includes(vitrina.id) && c.participantes.includes(SOPORTE_ID),
  )[0];
  const conversacion =
    existente ??
    conversaciones.agregar({
      id: nuevoId('conversation'),
      conversationTypeConceptId: CONCEPTO.conversationDirect,
      groupId: null,
      participantes: [vitrina.id, SOPORTE_ID],
      noLeidosPor: {},
    });
  mensajes.agregar({
    id: nuevoId('message'),
    conversationId: conversacion.id,
    senderProfileId: SOPORTE_ID,
    replyToMessageId: null,
    contentTypeConceptId: CONCEPTO.messageText,
    bodyText: texto,
    attachmentFileId: null,
    isEdited: false,
    sentAt: ahora(),
  });
  conversaciones.actualizar(conversacion.id, {
    noLeidosPor: { ...conversacion.noLeidosPor, [vitrina.id]: (conversacion.noLeidosPor[vitrina.id] ?? 0) + 1 },
  });
  return true;
}

/** «martes 6 de octubre a las 08:30», en la zona del navegador. */
export function fechaDelAviso(instante: string): string {
  const d = new Date(instante);
  const dia = new Intl.DateTimeFormat('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const hora = new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${dia} a las ${hora}`;
}
