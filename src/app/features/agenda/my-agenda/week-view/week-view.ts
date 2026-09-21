import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type {
  AgendaSlot,
  Booking,
} from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { sufijoDeCodigo } from '../../booking-status';
import type { EstadoResuelto } from '../day-view/day-view';
import { detalleDeLaCita, pacienteDeLaCita, type ParDelDetalle } from '../detalle-de-la-cita';
import type { BloqueoDelMes, EstadoDelDia } from '../month-view/month-view';

/** Una cita de la semana, reducida a lo que entra en una celda de siete. */
export interface CitaDeLaSemana {
  readonly id: string;
  readonly desde: Date;
  /** Cómo se nombra al paciente. Ver `pacienteDe`. */
  readonly paciente: string;
  /**
   * El detalle que se despliega, el MISMO que el día muestra (C-08).
   *
   * Se calcula acá y no al abrir el globo porque el globo se abre con el
   * puntero: hacerlo en ese momento metería trabajo en el camino del `hover`,
   * que es donde menos se perdona. Son cuatro o cinco pares por cita.
   */
  readonly detalle: readonly ParDelDetalle[];
  /** La reserva completa, para que quien contiene la semana pueda operarla. */
  readonly reserva: Booking;
}

/** Un día de la semana, ya resuelto. */
export interface DiaDeLaSemana {
  readonly fecha: Date;
  readonly estado: EstadoDelDia;
  readonly libres: number;
  readonly tomados: number;
  /** Por qué está cerrado, si lo está. */
  readonly motivo: string | null;
  /** Las citas que caben en la celda, en hora ascendente. */
  readonly citas: readonly CitaDeLaSemana[];
  /** Cuántas quedaron fuera de la celda. */
  readonly masCitas: number;
}

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * Cuántos nombres entran en una celda de siete columnas.
 *
 * Tres y no «todos»: con siete días en pantalla, una jornada de doce turnos
 * convierte la semana en una lista vertical de ochenta líneas y deja de
 * responder la pregunta que la semana existe para responder. Lo que sobra se
 * cuenta —«+9 más»— y se ve entero abriendo el día, que es la vista donde los
 * turnos caben con su hora, su estado y sus acciones.
 */
const CITAS_VISIBLES = 3;

/**
 * Los estados en los que el paciente **ya no viene**, y por eso no se nombra.
 *
 * Una cita cancelada sigue existiendo en la lectura —la agenda la muestra con
 * su sello, y así debe ser—, pero pintarla en la semana diría que el martes hay
 * alguien esperando que no va a venir. «No asistió» sí se queda: es un turno
 * que ocurrió, y el médico que revisa su semana pasada necesita verlo.
 */
const ESTADOS_QUE_NO_VIENEN: ReadonlySet<string> = new Set([
  'BOOKING_CANCELLED',
  'BOOKING_RESCHEDULED',
]);

/**
 * **La semana** — el botón que el pedido original pide junto al del mes.
 *
 * *«Luego un botón para ver la semana y otro para ver el mes, cada uno con su
 * respectiva paginación de adelante y atrás.»*
 *
 * ## Por qué existe teniendo el mes
 *
 * Porque son dos preguntas distintas. El mes responde «¿cuándo tengo hueco?»;
 * la semana responde **«¿cómo viene esto?»**, que es la que uno se hace el
 * lunes a la mañana. Con siete días en pantalla los números caben, y por eso
 * acá se muestran **cuántos turnos libres y cuántos tomados** tiene cada día —
 * en el mes eso no entra sin volverlo ilegible.
 *
 * ## El estado se decide con el mismo criterio que el mes
 *
 * `sin-agenda`, `bloqueado`, `libre`, `con-reservas` y `lleno` son los mismos
 * cinco, y se calculan igual. Dos pantallas que pintan la misma agenda no
 * pueden discrepar sobre si un día está lleno.
 */
@Component({
  selector: 'app-week-view',
  imports: [AppButton, DatePipe],
  templateUrl: './week-view.html',
  styleUrl: './week-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekView {
  /** Cualquier día de la semana que se mira; el lunes se calcula acá. */
  readonly semana = input.required<Date>();
  readonly cupos = input.required<readonly AgendaSlot[]>();
  readonly bloqueos = input.required<readonly BloqueoDelMes[]>();

  /**
   * Las citas de la semana, para poder decir **con quién**.
   *
   * Opcional con lista vacía por omisión: la semana se dibujaba con cupos y
   * bloqueos antes de que esto existiera, y sin citas sigue diciendo lo mismo
   * que decía —cuántos libres y cuántos tomados—. Quien la monte sin este
   * dato no ve una pantalla rota, ve la anterior.
   */
  readonly citas = input<readonly Booking[]>([]);

  /**
   * Las etiquetas de los estados, para saber cuáles ya no vienen.
   *
   * `statusConceptId` es un uuid y traducirlo con un `switch` acá sería
   * inventar el catálogo, que es del backend — mismo criterio que la vista del
   * día. Sin el mapa **no se descarta ninguna**: es preferible nombrar de más
   * a esconder a un paciente que sí viene porque el catálogo no respondió.
   */
  readonly etiquetas = input<ReadonlyMap<string, EstadoResuelto>>(new Map());

  /** La semana elegida, ya como su lunes. */
  readonly semanaElegida = output<Date>();
  readonly diaElegido = output<Date>();

  /**
   * Activaron una cita de la semana — C-08.
   *
   * El globo del `hover` muestra el detalle; activarla abre el MISMO diálogo
   * que abre el día, que es de quien contiene la semana porque necesita el
   * router y el servicio de diálogos. Esta vista sólo dibuja.
   */
  readonly citaElegida = output<Booking>();

  /**
   * El idioma con que se formatean las horas del globo.
   *
   * Entra por input y no se inyecta: esta vista es presentacional. El valor por
   * omisión es `en-US` **a propósito**: es el único que Angular trae registrado
   * siempre, y las horas del globo se piden con un patrón explícito (`HH:mm`),
   * que no depende del idioma. Quien la monta de verdad —`my-agenda`— le pasa
   * el `LOCALE_ID` real; una prueba que la monta sola no tiene que registrar
   * datos de locale para ver un globo.
   */
  readonly idioma = input<string>('en-US');

  /** El lunes de la semana mirada. */
  protected readonly lunes = computed(() => lunesDe(this.semana()));

  protected readonly dias = computed<readonly DiaDeLaSemana[]>(() => {
    const inicio = this.lunes();
    return Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      return this.resolverDia(fecha);
    });
  });

  /** «Del 8 al 14 de septiembre», para el encabezado. */
  protected readonly rotulo = computed(() => {
    const dias = this.dias();
    return { desde: dias[0].fecha, hasta: dias[6].fecha };
  });

  protected readonly totalLibres = computed(() =>
    this.dias().reduce((suma, d) => suma + d.libres, 0),
  );

  protected readonly totalTomados = computed(() =>
    this.dias().reduce((suma, d) => suma + d.tomados, 0),
  );

  /** La medianoche de hoy, para marcar la columna del día en curso. */
  protected readonly hoy = computed(() => {
    const ahora = new Date();
    return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
  });

  /**
   * Qué parte del día ya tiene paciente, de 0 a 100, para la barra de la
   * celda. Sin turnos no hay barra: un día que no se atiende no está «vacío».
   */
  protected ocupacion(dia: DiaDeLaSemana): number | null {
    const total = dia.libres + dia.tomados;
    return total === 0 ? null : Math.round((dia.tomados / total) * 100);
  }

  protected anterior(): void {
    const l = this.lunes();
    this.semanaElegida.emit(new Date(l.getFullYear(), l.getMonth(), l.getDate() - 7));
  }

  protected siguiente(): void {
    const l = this.lunes();
    this.semanaElegida.emit(new Date(l.getFullYear(), l.getMonth(), l.getDate() + 7));
  }

  /**
   * Cómo se nombra al paciente de una cita.
   *
   * Sin nombre no se inventa un relleno ni se muestra el uuid: se dice que no
   * está, con las mismas palabras que la vista del día. Que falte es una
   * condición del servidor —la API manda `patientName` sólo al titular y al
   * profesional de esa agenda—, no un error de la pantalla.
   */
  private pacienteDe(cita: Booking): string {
    return pacienteDeLaCita(cita);
  }

  /** Si el paciente de esa cita todavía viene. Ver `ESTADOS_QUE_NO_VIENEN`. */
  private todaviaViene(cita: Booking): boolean {
    const etiqueta = this.etiquetas().get(cita.statusConceptId);
    if (etiqueta === undefined) return true;
    return !ESTADOS_QUE_NO_VIENEN.has(sufijoDeCodigo(etiqueta.code));
  }

  /**
   * Las citas de un día, ordenadas por hora y recortadas a lo que entra.
   *
   * Se filtra por `startAt` de la propia cita y no cruzando por el cupo: la
   * semana no carga cupos de las siete jornadas con su detalle, y la lectura de
   * citas ya trae la hora del cupo resuelta (`startAt` del DTO). Una cita sin
   * hora no se puede colocar en un día, así que no se cuenta.
   */
  private citasDelDia(fecha: Date, finDelDia: Date): {
    visibles: readonly CitaDeLaSemana[];
    demas: number;
  } {
    const delDia = this.citas()
      .filter((cita) => {
        const desde = cita.startAt;
        if (desde === undefined) return false;
        return (
          desde.getTime() >= fecha.getTime() &&
          desde.getTime() < finDelDia.getTime() &&
          this.todaviaViene(cita)
        );
      })
      .map((cita) => ({
        id: cita.id,
        desde: cita.startAt as Date,
        paciente: this.pacienteDe(cita),
        // C-08 · el MISMO detalle que el día, calculado con la misma función.
        detalle: detalleDeLaCita(
          cita,
          this.etiquetas().get(cita.statusConceptId)?.display ?? 'Reservado',
          this.idioma(),
        ),
        reserva: cita,
      }))
      .sort((a, b) => a.desde.getTime() - b.desde.getTime());

    return {
      visibles: delDia.slice(0, CITAS_VISIBLES),
      demas: Math.max(0, delDia.length - CITAS_VISIBLES),
    };
  }

  private resolverDia(fecha: Date): DiaDeLaSemana {
    const finDelDia = new Date(fecha.getTime() + UN_DIA);
    const { visibles, demas } = this.citasDelDia(fecha, finDelDia);

    // Un bloqueo cuenta si PISA el día, aunque empiece antes o termine después:
    // unas vacaciones de dos semanas cierran los catorce, no sólo el primero.
    const bloqueo = this.bloqueos().find(
      (b) => b.desde.getTime() < finDelDia.getTime() && b.hasta.getTime() > fecha.getTime(),
    );

    const delDia = this.cupos().filter(
      (c) => c.startAt.getTime() >= fecha.getTime() && c.startAt.getTime() < finDelDia.getTime(),
    );

    if (delDia.length === 0) {
      return {
        fecha,
        estado: bloqueo !== undefined ? 'bloqueado' : 'sin-agenda',
        libres: 0,
        tomados: 0,
        motivo: bloqueo?.motivo ?? null,
        // Un día sin cupos publicados puede tener citas igual: el alta directa
        // del profesional (AG-2) crea la cita con su propio cupo puntual, y ese
        // día no aparece como jornada publicada. Decir «No atendés» y esconder
        // al paciente que viene sería el peor error que puede cometer esta
        // vista.
        citas: visibles,
        masCitas: demas,
      };
    }

    const libres = delDia.filter((c) => (c.remainingCapacity ?? 0) > 0).length;
    const tomados = delDia.length - libres;

    // El bloqueo manda sobre el conteo: si el día está cerrado, que tenga cupos
    // sin reservar no significa que se pueda pedir turno.
    if (bloqueo !== undefined) {
      return {
        fecha,
        estado: 'bloqueado',
        libres,
        tomados,
        motivo: bloqueo.motivo ?? null,
        // Mismo criterio que la vista del día: el bloqueo no se traga la cita,
        // porque la persona viene igual.
        citas: visibles,
        masCitas: demas,
      };
    }

    return {
      fecha,
      estado: libres === 0 ? 'lleno' : tomados > 0 ? 'con-reservas' : 'libre',
      libres,
      tomados,
      motivo: null,
      citas: visibles,
      masCitas: demas,
    };
  }
}

/** El lunes de la semana de esa fecha, a medianoche local. */
export function lunesDe(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  // `getDay()` da 0 para domingo: se corre seis días atrás, no uno adelante.
  const desdeElLunes = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desdeElLunes);
  return d;
}
