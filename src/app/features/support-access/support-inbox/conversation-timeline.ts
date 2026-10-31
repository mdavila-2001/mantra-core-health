import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { ClinicalAccessState, InternalNote, SupportConversationMessage } from '../../../core/data-access/support-access/support-inbox.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { formatDateTime } from '../support-labels';

/** Una línea del hilo: un mensaje o una nota interna, en el orden en que pasaron. */
export type TimelineEntry =
  | { readonly kind: 'message'; readonly at: string; readonly message: SupportConversationMessage }
  | { readonly kind: 'note'; readonly at: string; readonly note: InternalNote };

/** Mensajes y notas internas en una sola línea de tiempo, de la más vieja a la más nueva. */
export function buildTimeline(messages: readonly SupportConversationMessage[], notes: readonly InternalNote[]): readonly TimelineEntry[] {
  const entradas: TimelineEntry[] = [
    ...messages.map((message): TimelineEntry => ({ kind: 'message', at: message.sentAt, message })),
    ...notes.map((note): TimelineEntry => ({ kind: 'note', at: note.createdAt, note })),
  ];
  return entradas.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * El hilo de una conversación **como lo ve el equipo**: lo que escribió el
 * paciente, lo que respondió el doctor o alguien en su nombre —con el nombre de
 * la autora real y si el paciente ve el aviso—, y las notas internas con un
 * estilo propio, para que nadie confunda una nota con algo que el paciente lee.
 *
 * La autora real **solo se ve acá**: en el chat del paciente el remitente es el
 * doctor, y la API no manda el nombre de quien escribió a nadie que no sea el
 * equipo o el propio doctor.
 */
@Component({
  selector: 'app-conversation-timeline',
  imports: [AppButton, Badge],
  templateUrl: './conversation-timeline.html',
  styleUrl: './conversation-timeline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationTimeline {
  readonly messages = input.required<readonly SupportConversationMessage[]>();
  readonly notes = input.required<readonly InternalNote[]>();
  readonly doctorName = input.required<string>();
  readonly patientLabel = input.required<string>();
  /**
   * Si el doctor ya autorizó leer lo clínico. Un mensaje con `contentHidden` dice «Contenido clínico
   * oculto» en lugar de su texto mientras no sea `APPROVED`; con `NONE` ofrece pedir el acceso.
   */
  readonly clinicalAccess = input<ClinicalAccessState>('NONE');
  /** Si hay con qué pedir el acceso (la delegación y el permiso que la API entregó). */
  readonly canRequestAccess = input(true);

  /** La persona quiere pedir acceso a la historia clínica desde un mensaje oculto. */
  readonly askAccess = output<void>();

  protected readonly entries = computed(() => buildTimeline(this.messages(), this.notes()));
  protected readonly when = formatDateTime;

  /** El nombre corto de quien habla, para el lector de pantalla y para la burbuja. */
  protected speaker(message: SupportConversationMessage): string {
    if (message.from === 'PATIENT') return this.patientLabel().split('·')[0]!.trim();
    return message.authoredByName === undefined ? this.doctorName() : message.authoredByName;
  }
}
