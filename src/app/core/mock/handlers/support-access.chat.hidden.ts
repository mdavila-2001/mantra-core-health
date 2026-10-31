import { CLINICAL_CONTENT_HIDDEN_TEXT, type ClinicalAccessState, type SupportConversationMessage } from '../../data-access/support-access/support-inbox.types';
import { autorias } from '../fixtures/support-hospital';
import { esMensajeClinico } from '../fixtures/support-hospital-inbox';
import type { SimulatedMessage } from '../fixtures/community';

/**
 * El **contenido clínico oculto** de la bandeja, como lo hace la API
 * (`CLINICAL_CONTENT_HIDDEN_TEXT`, `community-support-inbox.service.ts`).
 *
 * - **Lista**: si el último mensaje del paciente parece clínico, `lastPatientMessage` y
 *   `lastMessagePreview` salen con el marcador en lugar del texto, siempre.
 * - **Detalle**: mientras `patientContext.clinicalAccess` no sea `APPROVED`, los mensajes que
 *   escribió el propio doctor (no su equipo en su nombre) y los del paciente que parecen clínicos
 *   salen con `bodyText` = marcador, `isClinical: true` y `contentHidden: true`. Lo administrativo y
 *   lo que escribió el equipo se lee siempre. Con `APPROVED` salen completos.
 */

/** El adelanto de la lista de un mensaje del paciente: el texto recortado, o el marcador si es clínico. */
export function adelantoDe(texto: string): string {
  return esMensajeClinico(texto) ? CLINICAL_CONTENT_HIDDEN_TEXT : texto.slice(0, 140);
}

/** Un mensaje de la conversación tal como lo ve quien tiene (o no) acceso clínico aprobado. */
export function mensajeVisible(m: SimulatedMessage, perfilDoctor: string, acceso: ClinicalAccessState, nombreDe: (userId: string) => string): SupportConversationMessage {
  const delDoctor = m.senderProfileId === perfilDoctor;
  const autoria = autorias.get(m.id);
  const clinicoDelPaciente = !delDoctor && esMensajeClinico(m.bodyText);
  // Lo que escribió el equipo en nombre del doctor se lee siempre; lo que escribió el propio doctor, no.
  const delPropioDoctor = delDoctor && autoria === undefined;
  const oculto = acceso !== 'APPROVED' && (clinicoDelPaciente || delPropioDoctor);
  return {
    id: m.id,
    from: delDoctor ? 'DOCTOR_SIDE' : 'PATIENT',
    bodyText: oculto ? CLINICAL_CONTENT_HIDDEN_TEXT : m.bodyText,
    sentAt: m.sentAt,
    isClinical: clinicoDelPaciente || oculto,
    ...(oculto ? { contentHidden: true } : {}),
    ...(autoria === undefined ? {} : { authoredByName: nombreDe(autoria.authorUserId), disclosureShown: autoria.disclosureShown }),
  };
}
