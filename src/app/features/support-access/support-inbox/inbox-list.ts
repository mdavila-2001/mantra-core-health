import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { isReservedBlock, RESERVED_BLOCK_LABEL } from '../../../core/access-challenge/access-challenge';
import type { ExplainMyAccessRequest } from '../../../core/data-access/access-governance/access-explain.types';
import { isHiddenClinicalPreview, type SupportInboxDoctor, type SupportInboxItem } from '../../../core/data-access/support-access/support-inbox.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AccessWhyNot } from '../../access-governance/why-not/why-not';
import { elapsedText, inboxDoctorColor, ownerText, slaOf, statusText, type SlaState } from './inbox-model';

/**
 * La lista de conversaciones de la bandeja. Solo dibuja: lo que recibe ya viene
 * filtrado y ordenado, y lo que el usuario hace sale como evento.
 *
 * Cada fila dice, sin abrirla: quién escribió, un adelanto del mensaje, de qué
 * doctor es (con su color de la agenda), si es **clínico** (marca roja), quién la
 * tiene y cuánto falta para el plazo de respuesta. El plazo se dice con
 * palabras y no solo con color: «Vencida hace 25 min».
 */
@Component({
  selector: 'app-inbox-list',
  imports: [AccessWhyNot, AppButton, Badge],
  templateUrl: './inbox-list.html',
  styleUrl: './inbox-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboxList {
  readonly items = input.required<readonly SupportInboxItem[]>();
  readonly doctors = input.required<readonly SupportInboxDoctor[]>();
  readonly selectedId = input<string | null>(null);
  /** El «ahora» con el que se miden los plazos: lo da quien la usa, para que todo envejezca a la vez. */
  readonly now = input.required<Date>();
  /** La conversación que se está tomando, para frenar el doble clic. */
  readonly busyId = input<string | null>(null);

  readonly open = output<string>();
  readonly take = output<string>();

  protected color(item: SupportInboxItem): { readonly fondo: string; readonly borde: string } {
    return inboxDoctorColor(this.doctors(), item.practitionerProfileId);
  }

  protected sla(item: SupportInboxItem): SlaState {
    return slaOf(item, this.now());
  }

  /**
   * Si el adelanto de la fila es el marcador de contenido clínico oculto. Se mira `lastMessagePreview`
   * y `lastPatientMessage`: la API puede poner el marcador en cualquiera de los dos.
   */
  protected hidden(item: SupportInboxItem): boolean {
    return isHiddenClinicalPreview(item.lastMessagePreview) || isHiddenClinicalPreview(item.lastPatientMessage);
  }

  /** Una conversación de un paciente reservado sale como bloque «Reservado»: no se abre, y se puede preguntar por qué. */
  protected readonly reservado = isReservedBlock;
  protected readonly reservadoLabel = RESERVED_BLOCK_LABEL;

  /** «¿Por qué no puedo?»: ver la bandeja de ese doctor, en esa organización. */
  protected pregunta(item: SupportInboxItem): ExplainMyAccessRequest {
    const doctor = this.doctors().find((d) => d.practitionerProfileId === item.practitionerProfileId);
    return { tenantId: item.organizationId, action: 'messages.inbox.view', ...(doctor === undefined ? {} : { practitionerRoleAssignmentId: doctor.id }) };
  }

  protected readonly owner = ownerText;
  protected readonly status = statusText;

  protected elapsed(item: SupportInboxItem): string {
    return elapsedText(item.lastMessageAt, this.now());
  }
}
