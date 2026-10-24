import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { formatDate } from '@angular/common';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { readApiError } from '../../core/http/api-error';
import type { AffectedBooking } from '../../core/data-access/scheduling/scheduling.types';
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
