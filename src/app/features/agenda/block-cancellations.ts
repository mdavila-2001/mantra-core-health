import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { readApiError } from '../../core/http/api-error';
import { SchedulingClient } from '../../core/data-access/scheduling/scheduling.client';
import type {
  AffectedBooking,
  RetiredTemplate,
  TemplateLiveBookings,
} from '../../core/data-access/scheduling/scheduling.types';
import { DialogService } from '../../shared/components/molecules/dialog/dialog-service';

/** El `failureCode` con el que la API dice «hay citas en ese rato: confirme». */
export const BOOKINGS_REQUIRE_CONFIRMATION = 'BOOKINGS_REQUIRE_CONFIRMATION';

/**
 * Las citas que un bloqueo alcanza, leídas del error de la API — o `null` si
 * el error es otro.
 *
 * Bloquear un rato con citas no falla: la API responde 422 (o 409 al cerrar
 * cupos sueltos) con `failureCode` y la lista completa, y **no cancela nada**
 * hasta que se repita el pedido con `cancelAffectedBookings: true`. Ese error
 * es la vista previa; esto lo reconoce.
 */
export function affectedBookingsOf(error: unknown): readonly AffectedBooking[] | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const details = readApiError(error)?.details;
  if (details?.['failureCode'] !== BOOKINGS_REQUIRE_CONFIRMATION) return null;
  const list = details['affectedBookings'];
  if (!Array.isArray(list)) return null;
  return list.filter(isAffectedBooking);
}

function isAffectedBooking(value: unknown): value is AffectedBooking {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['bookingId'] === 'string' && typeof v['startAt'] === 'string';
}

/**
 * El paso de confirmación de un bloqueo que cancela citas (24/10/2026).
 *
 * El propietario pidió que bloquear la agenda **cancele** las citas del rato y
 * **avise** a cada paciente, con una condición: el profesional ve antes a quién
 * deja sin cita y confirma. La API hace su parte en dos pedidos; esto hace la
 * del navegador en uno solo para quien bloquea:
 *
 * 1. se manda el bloqueo sin confirmar;
 * 2. si la API responde con la lista, se muestra el modal con nombre y hora de
 *    cada cita, y «Bloquear y cancelar»;
 * 3. con el sí, se repite el pedido con `cancelAffectedBookings: true`.
 *
 * Sin el sí no se repite nada, y el resultado es `null`: la pantalla vuelve a
 * su estado sin un error, porque no hubo ninguno.
 */
@Injectable({ providedIn: 'root' })
export class BlockCancellations {
  private readonly dialogs = inject(DialogService);
  private readonly scheduling = inject(SchedulingClient);
  private readonly locale = inject(LOCALE_ID);

  /**
   * Corre `request(false)`; si la API pide confirmación, pregunta y, con el sí,
   * corre `request(true)`. Cualquier otro error se propaga tal cual.
   */
  withConfirmation<T>(request: (confirmed: boolean) => Observable<T>): Observable<T | null> {
    return request(false).pipe(
      catchError((error: unknown) => {
        const affected = affectedBookingsOf(error);
        if (affected === null) return throwError(() => error);
        return from(this.confirm(affected)).pipe(
          switchMap((yes) => (yes ? request(true) : of(null))),
        );
      }),
    );
  }

  /**
   * Retira un horario preguntando antes qué hacer con sus citas vivas
   * (etapa C, 24/10/2026: «cambiar el horario avisa al paciente»).
   *
   * 1. Pide la vista previa (`live-bookings`).
   * 2. Sin citas: retira como siempre. Con citas: pregunta —cancelarlas y
   *    avisar, o conservarlas y seguir atendiéndolas— y retira con esa
   *    decisión. Con un paciente ya recibido sólo cabe conservar, y se dice.
   *
   * `null` cuando la persona vuelve atrás sin retirar.
   */
  retireTemplate(templateId: string): Observable<RetiredTemplate | null> {
    return this.scheduling.listTemplateLiveBookings(templateId).pipe(
      // Sin vista previa —una API anterior a este cambio responde 404, y quien
      // no administra la agenda recibe 403— se retira como siempre: conservando
      // las citas. Perder el retiro entero por no poder mostrar la lista sería
      // una regresión; cancelar sin mostrarla, un daño.
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && (error.status === 404 || error.status === 403)
          ? of<TemplateLiveBookings>({ templateId, total: 0, bookings: [], present: [] })
          : throwError(() => error),
      ),
      switchMap((live) => from(this.decideRetire(live))),
      switchMap((decision) =>
        decision === 'abort' ? of(null) : this.scheduling.retireTemplate(templateId, decision),
      ),
    );
  }

  /** Qué hacer con las citas vivas de un horario que se va a retirar. */
  async decideRetire(live: TemplateLiveBookings): Promise<'cancel' | 'keep' | 'abort'> {
    if (live.total === 0) return 'keep';

    if (live.present.length > 0) {
      const sigue = await this.dialogs.confirm({
        title: 'Hay un paciente ya recibido',
        message:
          'Mientras haya alguien en el consultorio no se cancelan sus citas desde acá. Puede retirar el horario conservando todas las citas, y seguir atendiéndolas.',
        details: this.rows([...live.present, ...live.bookings]),
        confirmLabel: 'Retirar y conservar las citas',
        cancelLabel: 'Volver',
      });
      return sigue ? 'keep' : 'abort';
    }

    const n = live.bookings.length;
    const cancelar = await this.dialogs.confirm({
      title: n === 1 ? 'Este horario tiene una cita' : `Este horario tiene ${n} citas`,
      message:
        'Puede cancelarlas ahora y avisar a cada paciente, o conservarlas y seguir atendiéndolas aunque el horario deje de publicarse.',
      details: this.rows(live.bookings),
      confirmLabel: n === 1 ? 'Cancelar la cita y avisar' : 'Cancelar las citas y avisar',
      cancelLabel: 'Conservar las citas',
      destructive: true,
    });
    return cancelar ? 'cancel' : 'keep';
  }

  private rows(affected: readonly AffectedBooking[]): { label: string; value: string }[] {
    return affected.map((cita) => ({
      label: cita.patientName ?? 'Paciente sin nombre registrado',
      value: `${formatDate(cita.startAt, 'EEEE d/M, HH:mm', this.locale)}${
        cita.pending ? ' · solicitud sin responder' : ''
      }`,
    }));
  }

  /** El modal: una fila por cita, con quién y cuándo. */
  confirm(affected: readonly AffectedBooking[]): Promise<boolean> {
    const n = affected.length;
    return this.dialogs.confirm({
      title: n === 1 ? 'Este bloqueo cancela una cita' : `Este bloqueo cancela ${n} citas`,
      message:
        n === 1
          ? 'Le avisaremos al paciente que su cita se canceló. Esto no se puede deshacer.'
          : 'Le avisaremos a cada paciente que su cita se canceló. Esto no se puede deshacer.',
      details: affected.map((cita) => ({
        label: cita.patientName ?? 'Paciente sin nombre registrado',
        value: `${formatDate(cita.startAt, 'EEEE d/M, HH:mm', this.locale)}${
          cita.pending ? ' · solicitud sin responder' : ''
        }`,
      })),
      confirmLabel: n === 1 ? 'Bloquear y cancelar la cita' : 'Bloquear y cancelar las citas',
      cancelLabel: 'Volver',
      destructive: true,
    });
  }
}

/**
 * La frase del aviso de éxito: cuántas citas se cancelaron, si alguna.
 *
 * Tolera `undefined` porque la maqueta y una API anterior a este cambio no
 * devuelven `cancelledBookings`: ahí no se canceló nada y no se dice nada.
 */
export function cancelledBookingsText(cancelled: number | undefined): string {
  if (cancelled === undefined || cancelled === 0) return '';
  return cancelled === 1
    ? ' Se canceló 1 cita y le avisamos al paciente.'
    : ` Se cancelaron ${cancelled} citas y le avisamos a cada paciente.`;
}
