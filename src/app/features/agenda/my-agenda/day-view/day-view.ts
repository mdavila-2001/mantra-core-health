import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import type { AgendaSlot, Booking } from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BloqueoDelMes } from '../month-view/month-view';

/** Un estado del catálogo, ya resuelto: su código y cómo se lee. */
export interface EstadoResuelto {
  readonly code: string;
  readonly display: string;
}

/** Qué se puede hacer sobre una fila con cita. */
export type AccionDeCita = 'llegó' | 'demora' | 'cancelar';

/** Lo que la fila le pide al contenedor. */
export interface PedidoDeAccion {
  readonly bookingId: string;
  readonly accion: AccionDeCita;
}

/** Una fila de la línea de tiempo. */
export interface FilaDelDia {
  readonly clave: string;
  readonly desde: Date;
  readonly hasta: Date | null;
  /** Qué hay en esa franja. */
  readonly tipo: 'cita' | 'libre' | 'bloqueado';
  /** La cita, cuando la hay. */
  readonly cita: Booking | null;
  /** Cómo se llama quien viene, o el aviso de que no corresponde verlo. */
  readonly paciente: string;
  /** El estado en palabras. */
  readonly estado: string;
  /** El código del estado, para decidir qué acciones ofrecer. */
  readonly statusCode: string;
  /** El motivo del bloqueo. */
  readonly motivo: string | null;
}

/**
 * Los códigos de estado en los que el backend acepta operar.
 *
 * Allowlist a propósito, igual que en «Mis turnos»: el catálogo mezcla
 * convenciones y un estado nuevo o desconocido no debe ofrecer un botón que
 * casi seguro va a fallar.
 */
const OPERABLES: ReadonlySet<string> = new Set([
  'BOOKING_CONFIRMED',
  'BOOKING_CHECKED_IN',
  'BOOKING_REQUESTED',
  'BOOKING_PENDING_CONFIRMATION',
]);

/** Estados que ya no admiten «llegó»: la persona está o estuvo. */
const YA_LLEGO: ReadonlySet<string> = new Set(['BOOKING_CHECKED_IN', 'BOOKING_COMPLETED']);

/**
 * El día del profesional — «¿quién me viene hoy?».
 *
 * ## Por qué es una línea de tiempo y no una lista de reservas
 *
 * Porque la pregunta del pasillo incluye **los huecos**. Una lista de citas
 * dice a quién atiende; una línea de tiempo dice además cuándo está libre —que
 * es lo que hace falta cuando alguien llama urgido, o para saber si se puede ir
 * a almorzar—. El hueco de las 12:00 tiene que verse, no deducirse restando.
 *
 * Se arma fusionando tres cosas: los **cupos** del día, las **citas** que caen
 * en ellos y los **bloqueos**. Cupo sin cita → «libre»; con cita → la fila del
 * paciente; dentro de un bloqueo → bloqueado con su motivo.
 *
 * ## El nombre y el motivo se muestran acá, y está bien
 *
 * TJ-2 los sacó de la vista de la **organización**, no de la del profesional
 * que atiende: para quien va a recibir a esa persona en diez minutos, saber a
 * quién espera y por qué viene es el trabajo. El servidor aplica la regla; esta
 * pantalla sólo muestra lo que le llega.
 */
@Component({
  selector: 'app-day-view',
  imports: [AppButton, Badge, DatePipe],
  templateUrl: './day-view.html',
  styleUrl: './day-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayView {
  /** El día que se mira. */
  readonly dia = input.required<Date>();

  /** Los cupos de ese día. */
  readonly cupos = input.required<readonly AgendaSlot[]>();

  /** Las citas de ese día. */
  readonly citas = input.required<readonly Booking[]>();

  /** Los bloqueos que lo tocan. */
  readonly bloqueos = input.required<readonly BloqueoDelMes[]>();

  /**
   * Si quien mira puede registrar la llegada.
   *
   * **`POST /scheduling/bookings/:id/check-in` no admite `PRACTITIONER`**:
   * declara `@Roles('SCHEDULING_ADMIN', 'SCHEDULING_AGENT')`. Verificado
   * contra la API viva —el botón devolvía «Rol insuficiente»— y contra el
   * controlador. Abrir el rol no es cosa de esta pantalla: el servicio de
   * check-in **no** comprueba que la cita sea del actor, así que sumarlo a
   * secas dejaría a cualquier profesional marcar la llegada de cualquiera.
   *
   * Mientras tanto no se ofrece un botón que se sabe que va a fallar. Cancelar
   * y avisar demora sí lo admiten, y siguen ahí.
   */
  readonly puedeRegistrarLlegada = input<boolean>(false);

  /**
   * Los estados en palabras, por identificador de concepto.
   *
   * `statusConceptId` es un **uuid de catálogo**, no un código: traducirlo acá
   * a fuerza de `switch` sería inventar el catálogo. Lo resuelve el contenedor
   * con el mismo `readConceptLabels` que usa «Mis turnos», y mientras no llega
   * la fila muestra un texto neutro en vez de un identificador.
   */
  readonly etiquetas = input<ReadonlyMap<string, EstadoResuelto>>(new Map());

  /** Pidieron hacer algo con una cita. */
  readonly accionPedida = output<PedidoDeAccion>();

  /** Volver al mes. */
  readonly volver = output<void>();

  protected readonly titulo = computed(() =>
    this.dia().toLocaleDateString('es-BO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );

  /**
   * La línea de tiempo del día.
   *
   * Se recorre por **cupo** y no por cita: eso es lo que hace que el hueco
   * exista como fila en vez de ser el espacio entre dos citas.
   */
  protected readonly filas = computed<readonly FilaDelDia[]>(() => {
    const porSlot = new Map<string, Booking>();
    for (const cita of this.citas()) {
      if (cita.bookableSlotId) porSlot.set(cita.bookableSlotId, cita);
    }

    return [...this.cupos()]
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .map((cupo) => {
        const bloqueo = this.bloqueoDe(cupo.startAt);
        const cita = porSlot.get(cupo.id) ?? null;

        if (bloqueo !== null && cita === null) {
          return {
            clave: cupo.id,
            desde: cupo.startAt,
            hasta: cupo.endAt,
            tipo: 'bloqueado' as const,
            cita: null,
            paciente: '',
            estado: '',
            statusCode: '',
            motivo: bloqueo.motivo,
          };
        }

        if (cita === null) {
          return {
            clave: cupo.id,
            desde: cupo.startAt,
            hasta: cupo.endAt,
            tipo: 'libre' as const,
            cita: null,
            paciente: '',
            estado: '',
            statusCode: '',
            motivo: null,
          };
        }

        return {
          clave: cupo.id,
          desde: cupo.startAt,
          hasta: cupo.endAt,
          tipo: 'cita' as const,
          cita,
          // Sin nombre no se inventa un relleno ni se muestra el uuid: se dice
          // que no está. Que falte es una condición del servidor, no un error.
          paciente: cita.patientName ?? 'Paciente sin nombre registrado',
          estado: this.etiquetas().get(cita.statusConceptId)?.display ?? 'Reservado',
          statusCode: this.etiquetas().get(cita.statusConceptId)?.code ?? '',
          motivo: null,
        };
      });
  });

  /** Cuántos turnos tiene tomados, para el encabezado. */
  protected readonly resumen = computed(() => {
    const filas = this.filas();
    const conCita = filas.filter((f) => f.tipo === 'cita').length;
    if (filas.length === 0) return 'No atendés este día.';
    return conCita === 0
      ? `${filas.length} turnos publicados, ninguno reservado.`
      : `${conCita} de ${filas.length} turnos reservados.`;
  });

  /**
   * Si a esta persona todavía se le puede marcar la llegada.
   *
   * Se decide por el **código** del concepto y no por su uuid: el catálogo
   * mezcla convenciones —con y sin prefijo de módulo—, así que se compara por
   * sufijo. Sin etiqueta resuelta se ofrece igual: el backend sigue siendo la
   * última palabra, y esconder el botón mientras carga sería peor.
   */
  protected puedeLlegar(fila: FilaDelDia): boolean {
    if (!this.puedeRegistrarLlegada()) return false;
    const codigo = this.codigoDe(fila);
    return codigo === '' || (OPERABLES.has(codigo) && !YA_LLEGO.has(codigo));
  }

  protected puedeOperar(fila: FilaDelDia): boolean {
    const codigo = this.codigoDe(fila);
    return codigo === '' || OPERABLES.has(codigo);
  }

  /** El código del estado, sin el prefijo de módulo. */
  private codigoDe(fila: FilaDelDia): string {
    return fila.statusCode.split(':').pop() ?? '';
  }

  protected pedir(fila: FilaDelDia, accion: AccionDeCita): void {
    if (fila.cita === null) return;
    this.accionPedida.emit({ bookingId: fila.cita.id, accion });
  }

  private bloqueoDe(instante: Date): BloqueoDelMes | null {
    return (
      this.bloqueos().find(
        (b) => b.desde.getTime() <= instante.getTime() && b.hasta.getTime() > instante.getTime(),
      ) ?? null
    );
  }
}
