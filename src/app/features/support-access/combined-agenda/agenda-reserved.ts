import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { RESERVED_BLOCK_LABEL } from '../../../core/access-challenge/access-challenge';
import type { ExplainMyAccessRequest } from '../../../core/data-access/access-governance/access-explain.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AccessWhyNot } from '../../access-governance/why-not/why-not';
import { clock } from './agenda-grouping';
import { orgToneColors, type AgendaEvent } from './agenda-model';

/**
 * El panel de un bloque **«Reservado»**: el horario está ocupado, pero el detalle de la cita no está disponible para quien
 * mira (un paciente VIP, un menor, una cita fuera de ventana: la API **no dice cuál** para no revelarlo). Se muestra lo que sí
 * se sabe —cuándo, con quién y dónde— y se ofrece «¿Por qué no puedo?», que pregunta a la API por **su** caso y le dice qué
 * puede hacer. No ofrece ninguna acción sobre la cita: sin `bookingId` no hay a qué dirigirla.
 */
@Component({
  selector: 'app-agenda-reserved',
  imports: [AccessWhyNot, AppButton],
  templateUrl: './agenda-reserved.html',
  styleUrl: './agenda-reserved.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaReserved {
  readonly event = input.required<AgendaEvent>();
  readonly closed = output<void>();

  protected readonly label = RESERVED_BLOCK_LABEL;
  protected readonly clock = clock;
  protected readonly orgColors = computed(() => orgToneColors(this.event().orgTone));
  protected readonly dateText = computed(() =>
    new Date(this.event().start).toLocaleDateString('es-BO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );

  /** La pregunta: ver esta cita, sobre este doctor, lugar y hora. */
  protected readonly pregunta = computed<ExplainMyAccessRequest>(() => {
    const e = this.event();
    return {
      tenantId: e.orgId,
      action: 'agenda.appointment.view',
      practitionerRoleAssignmentId: e.practitionerRoleAssignmentId,
      careSpaceId: e.careSpaceId,
      appointmentStartAt: e.start,
    };
  });
}
