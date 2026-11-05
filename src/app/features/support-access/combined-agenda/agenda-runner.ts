import { computed, inject, Injectable, signal } from '@angular/core';
import { switchMap, type Observable } from 'rxjs';

import {
  AccessChallengeCancelledError,
  withAccessChallenge,
  type ChallengeRequestOptions,
} from '../../../core/access-challenge/access-challenge';
import type { ExplainMyAccessRequest } from '../../../core/data-access/access-governance/access-explain.types';
import type { SupportActionInput } from '../../../core/data-access/support-access/support-atom-grants.types';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { dropVerdict, reschedulePreview } from './agenda-actions';
import { failureMessage } from './agenda-errors';
import { clock } from './agenda-grouping';
import type { AgendaEvent } from './agenda-model';
import type { BookRequest } from './agenda-panel';

/**
 * Ejecuta las acciones de la agenda contra la API de agenda de siempre
 * (`SchedulingClient`): no duplica ninguna regla, solo arma las llamadas, pide el
 * motivo cuando hace falta y dice qué pasó.
 *
 * Toda acción nombra **la organización en la que se actúa**: en el aviso de éxito,
 * en el diálogo de confirmación y en el mensaje a lectores de pantalla.
 *
 * Se provee **por pantalla** (no es de la raíz): su estado —`busy`, `failure`— es
 * de la agenda que está abierta.
 */
@Injectable()
export class AgendaActionRunner {
  private readonly scheduling = inject(SchedulingClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  readonly busy = signal(false);
  readonly failure = signal<string | null>(null);
  /** Qué se intentó por última vez y no salió: para ofrecer «¿Por qué no puedo?» con esos mismos datos. */
  private readonly lastAttempt = signal<{
    readonly event: AgendaEvent;
    readonly atom: string;
  } | null>(null);
  /** Lo que se le pregunta a «¿Por qué no puedo?» tras un rechazo: la misma acción, sobre el mismo horario. */
  readonly explainRequest = computed<ExplainMyAccessRequest | null>(() => {
    const intento = this.lastAttempt();
    if (intento === null) return null;
    const { event, atom } = intento;
    return {
      tenantId: event.orgId,
      action: atom as SupportActionInput,
      practitionerRoleAssignmentId: event.roleAssignmentId ?? event.practitionerRoleAssignmentId,
      careSpaceId: event.careSpaceId,
      appointmentStartAt: event.start,
      ...(event.healthcareServiceId === undefined
        ? {}
        : { healthcareServiceId: event.healthcareServiceId }),
    };
  });

  /** Lo que se dice al terminar, para el lector de pantalla. Lo lee la pantalla. */
  readonly announcement = signal('');

  clearFailure(): void {
    this.failure.set(null);
  }

  /**
   * Lo que la API puede pedir antes de dejar hacer algo —motivo, segundo paso, aprobación del doctor— se resuelve en un
   * diálogo y **se reintenta la misma petición** (`AccessChallengeService`). La aprobación se pide **de esa acción**: el
   * permiso, el doctor, el lugar, el servicio y la hora de la cita.
   */
  private challenge(
    event: AgendaEvent,
    atom: string,
    actionLabel: string,
    patientProfileId?: string,
  ): ChallengeRequestOptions {
    return {
      context: withAccessChallenge({
        actionLabel,
        approval: {
          tenantId: event.orgId,
          atom,
          practitionerRoleAssignmentId:
            event.roleAssignmentId ?? event.practitionerRoleAssignmentId,
          careSpaceId: event.careSpaceId,
          appointmentStartAt: event.start,
          ...(event.healthcareServiceId === undefined
            ? {}
            : { healthcareServiceId: event.healthcareServiceId }),
          ...(patientProfileId === undefined ? {} : { patientProfileId }),
        },
      }),
    };
  }

  private run(
    work: Observable<unknown>,
    notice: { readonly title: string; readonly detail: string },
    onDone: () => void,
    attempt?: { readonly event: AgendaEvent; readonly atom: string },
  ): void {
    this.busy.set(true);
    this.failure.set(null);
    this.lastAttempt.set(null);
    work.subscribe({
      next: () => {
        this.busy.set(false);
        this.toasts.success(notice.detail, notice.title);
        this.announcement.set(`${notice.title}. ${notice.detail}`);
        onDone();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        // Cerrar el diálogo de desafío es una decisión de la persona, no un error: no se hizo ningún cambio.
        if (error instanceof AccessChallengeCancelledError) {
          this.announcement.set(
            'No se hizo ningún cambio: usted canceló el paso adicional que se pedía.',
          );
          return;
        }
        this.failure.set(failureMessage(error, 'No pudimos completar la acción.'));
        this.lastAttempt.set(attempt ?? null);
      },
    });
  }

  private where(event: AgendaEvent): string {
    return `${event.doctorName}, ${clock(event.start)}, en ${event.orgName}.`;
  }

  checkIn(event: AgendaEvent, onDone: () => void): void {
    if (this.busy()) return;
    const atom = 'agenda.appointment.check_in';
    this.run(
      this.scheduling.checkInBooking(
        event.bookingId ?? event.id,
        this.challenge(event, atom, 'Registrar la llegada del paciente', event.patientProfileId),
      ),
      {
        title: 'Llegada registrada',
        detail: `${event.patientLabel ?? 'Paciente'} · ${this.where(event)}`,
      },
      onDone,
      { event, atom },
    );
  }

  confirm(event: AgendaEvent, onDone: () => void): void {
    if (this.busy()) return;
    const atom = 'agenda.appointment.confirm';
    this.run(
      this.scheduling.acceptBooking(
        event.bookingId ?? event.id,
        undefined,
        this.challenge(event, atom, 'Confirmar la cita', event.patientProfileId),
      ),
      {
        title: 'Cita confirmada',
        detail: `${event.patientLabel ?? 'Paciente'} · ${this.where(event)}`,
      },
      onDone,
      { event, atom },
    );
  }

  /** Cancelar exige el motivo: el paciente lo ve en el detalle de su cita. */
  async cancel(event: AgendaEvent, onDone: () => void): Promise<void> {
    if (this.busy()) return;
    const reason = await this.dialogs.confirmWithReason(
      {
        title: 'Cancelar la cita',
        message: `Se cancela la cita en ${event.orgName} y el horario queda libre.`,
        details: [
          { label: 'Organización', value: event.orgName },
          { label: 'Paciente', value: event.patientLabel ?? 'Cita' },
          { label: 'Doctor', value: event.doctorName },
          {
            label: 'Horario',
            value: `${new Date(event.start).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}, ${clock(event.start)}`,
          },
        ],
        confirmLabel: 'Cancelar la cita',
        cancelLabel: 'Conservar la cita',
        destructive: true,
      },
      {
        label: 'Motivo de la cancelación',
        hint: 'El paciente lo ve en el detalle de su cita.',
        minLength: 5,
        maxLength: 300,
      },
    );
    if (reason === null) return;
    const atom = 'agenda.appointment.cancel';
    this.run(
      this.scheduling.cancelBooking(
        event.bookingId ?? event.id,
        { cancelledBy: 'PROVIDER', reasonText: reason },
        this.challenge(
          event,
          atom,
          `Cancelar la cita de ${event.patientLabel ?? 'un paciente'}, ${clock(event.start)}`,
          event.patientProfileId,
        ),
      ),
      {
        title: 'Cita cancelada',
        detail: `${event.patientLabel ?? 'Paciente'} · ${this.where(event)}`,
      },
      onDone,
      { event, atom },
    );
  }

  /**
   * Reprogramar: muestra de dónde sale y adónde va, con la organización, y pide el
   * motivo. Si el destino no sirve, lo dice y no pregunta nada.
   */
  async reschedule(
    source: AgendaEvent,
    target: AgendaEvent,
    now: Date,
    onDone: () => void,
  ): Promise<void> {
    if (this.busy()) return;
    const verdict = dropVerdict(source, target, now);
    if (!verdict.ok) {
      this.toasts.warning(verdict.reason, 'No se puede mover la cita ahí');
      return;
    }
    const reason = await this.dialogs.confirmWithReason(
      {
        title: 'Reprogramar la cita',
        message:
          verdict.warnings.length === 0
            ? 'La cita se mueve a este horario. El horario anterior queda libre.'
            : verdict.warnings.join(' '),
        details: reschedulePreview(source, target).map((line) => ({
          label: line.label,
          value: line.value,
        })),
        confirmLabel: 'Reprogramar',
        cancelLabel: 'Dejarla donde está',
      },
      {
        label: 'Motivo del cambio',
        hint: 'El paciente ve el motivo en el detalle de su cita.',
        minLength: 5,
        maxLength: 300,
      },
    );
    if (reason === null) return;
    const atom = 'agenda.appointment.reschedule';
    this.run(
      this.scheduling.rescheduleBooking(
        source.bookingId ?? source.id,
        { toSlotId: target.id, reasonText: reason },
        this.challenge(
          source,
          atom,
          `Reprogramar la cita de ${source.patientLabel ?? 'un paciente'} a ${clock(target.start)}`,
          source.patientProfileId,
        ),
      ),
      {
        title: 'Cita reprogramada',
        detail: `${source.patientLabel ?? 'Paciente'} pasó a ${clock(target.start)} con ${target.doctorName}, en ${target.orgName}.`,
      },
      onDone,
      { event: source, atom },
    );
  }

  /** Crear, atender sin cita o anotar en la lista de espera: los tres arrancan con un paciente ya elegido. */
  book(event: AgendaEvent, request: BookRequest, onDone: () => void): void {
    if (this.busy()) return;
    const { patient, representative } = request.picked;
    const reason = [
      request.reason,
      representative === null
        ? ''
        : `Representante: ${representative.name} (${representative.relationship})`,
    ]
      .filter((t) => t !== '')
      .join(' · ');
    const detail = `${patient.displayName} · ${this.where(event)}`;
    switch (request.mode) {
      case 'CREATE':
        this.run(
          // Se retiene y se confirma: los dos pasos de siempre de la agenda.
          this.scheduling.placeHold(event.id, { patientProfileId: patient.profileId }).pipe(
            switchMap((hold) =>
              this.scheduling.confirmHold(
                hold.holdToken,
                {
                  tenantId: event.orgId,
                  patientProfileId: patient.profileId,
                  channel: 'DESK',
                  ...(reason === '' ? {} : { reasonText: reason }),
                },
                this.challenge(
                  event,
                  'agenda.appointment.create',
                  `Crear la cita de ${patient.displayName}, ${clock(event.start)}`,
                  patient.profileId,
                ),
              ),
            ),
          ),
          { title: 'Cita creada', detail },
          onDone,
          { event, atom: 'agenda.appointment.create' },
        );
        return;
      case 'WALK_IN':
        this.run(
          this.scheduling.createDirectAppointment(
            {
              patientProfileId: patient.profileId,
              resourceId: event.resourceId ?? '',
              startAt: event.start,
              durationMinutes: Math.max(
                5,
                Math.round(
                  (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000,
                ),
              ),
              ...(reason === '' ? {} : { reasonText: reason }),
              walkIn: true,
              // Se declara el lugar y el servicio del horario que se eligió; la API los contrasta con los del doctor.
              careSpaceId: event.careSpaceId,
              ...(event.healthcareServiceId === undefined
                ? {}
                : { healthcareServiceId: event.healthcareServiceId }),
            },
            { tenantId: event.orgId },
            this.challenge(
              event,
              'agenda.appointment.walk_in',
              `Atender sin cita a ${patient.displayName}`,
              patient.profileId,
            ),
          ),
          { title: 'Paciente atendido sin cita', detail },
          onDone,
          { event, atom: 'agenda.appointment.walk_in' },
        );
        return;
      case 'WAITLIST':
        this.run(
          this.scheduling.enrollWaitlist(
            {
              tenantId: event.orgId,
              patientProfileId: patient.profileId,
              desiredFrom: new Date(event.start),
              desiredTo: new Date(event.end),
              bookableSlotId: event.id,
            },
            this.challenge(
              event,
              'agenda.waitlist.manage',
              `Anotar a ${patient.displayName} en la lista de espera`,
              patient.profileId,
            ),
          ),
          { title: 'Anotado en la lista de espera', detail },
          onDone,
          { event, atom: 'agenda.waitlist.manage' },
        );
    }
  }
}
