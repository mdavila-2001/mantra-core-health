import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';

import type {
  ActivityTypeOption,
  AgendaSlot, Booking } from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BloqueoDelMes } from '../month-view/month-view';

/** Un estado del catálogo, ya resuelto: su código y cómo se lee. */
export interface EstadoResuelto {
  readonly code: string;
  readonly display: string;
}

/** Qué se puede hacer sobre un bloque con cita. */
export type AccionDeCita = 'llegó' | 'demora' | 'cancelar';

/** Lo que el bloque le pide al contenedor. */
export interface PedidoDeAccion {
  readonly bookingId: string;
  readonly accion: AccionDeCita;
}

/** El rato que se tocó para crear algo ahí (AG-5: la tarjeta única). */
export interface RatoTocado {
  readonly desde: Date;
  readonly hasta: Date;
}

/** Un bloque de la línea de horas. */
/** Los tonos que el badge del sistema de diseño sabe pintar. */
export type TonoDeBadge = 'primary' | 'secondary' | 'info' | 'success' | 'warning';

/** Los que la API puede mandar hoy. `error` NO está: es el de los bloqueos. */
const TONOS: readonly TonoDeBadge[] = ['primary', 'secondary', 'info', 'success', 'warning'];

/**
 * El tono que manda el servidor, o uno neutro si no lo conocemos.
 *
 * La guarda no es defensiva de más: el catálogo es del servidor y puede ganar
 * una tipología con un tono que este front todavía no compila. Que entonces se
 * pinte neutra es mejor que que la agenda no cargue — y **jamás cae en `error`**,
 * que es el de los bloqueos: una actividad pintada de rojo diría que el rato
 * está cerrado cuando no lo está.
 */
function aTono(valor: string): TonoDeBadge {
  return TONOS.includes(valor as TonoDeBadge) ? (valor as TonoDeBadge) : 'secondary';
}

export interface BloqueDelDia {
  readonly clave: string;
  readonly desde: Date;
  readonly hasta: Date;
  /**
   * Qué hay en ese rato. `aire` es el hueco entre bloques — el receso del
   * doctor o simplemente tiempo sin agenda: no invita, no tiene borde, pero
   * OCUPA su altura para que el día se lea como es.
   */
  readonly tipo: 'cita' | 'libre' | 'ocupado' | 'aire';
  /** La cita, cuando la hay. */
  readonly cita: Booking | null;
  /** Cómo se llama quien viene. */
  readonly paciente: string;
  /** El estado en palabras. */
  readonly estado: string;
  /** El código del estado, para decidir qué acciones ofrecer. */
  readonly statusCode: string;
  /**
   * Qué clase de actividad es: consulta, procedimiento, control…
   *
   * El propietario lo pidió así: «con otros colores los otros procedimientos
   * (TURNOS, OPERACIONES, ETC.) catalogado por tipología raíz». `null` cuando
   * la reserva no declara tipo, que es lo corriente en una consulta común.
   */
  readonly tipologia: { readonly label: string; readonly tone: TonoDeBadge } | null;
  /** El rótulo del tiempo ocupado. */
  readonly motivo: string | null;
  /** El id de la excepción, para poder quitarla. */
  readonly excepcionId: string | null;
  /** La altura del bloque, proporcional a su duración. */
  readonly alturaPx: number;
}

/**
 * Cuántos píxeles mide un minuto.
 *
 * Es LA decisión visual de AG-5: la cirugía de 3 horas se VE grande (288px) y
 * la consulta de 30 minutos, chica (48px). El valor sale de que media hora
 * —el turno típico— tiene que alcanzar para dos líneas de texto.
 */
const PX_POR_MINUTO = 1.6;

/**
 * La altura mínima de un bloque con contenido.
 *
 * Un turno de 10 minutos medido a escala son 16px: no entra ni el nombre.
 * El mínimo garantiza legibilidad; el aire NO lo usa — un hueco de 5 minutos
 * debe verse chico, porque lo es.
 */
const ALTURA_MINIMA_PX = 40;

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
 * El día del profesional como línea de horas — la agenda del iPhone (AG-5).
 *
 * ## La decisión visual: altura proporcional a la duración
 *
 * Era el caso del odontólogo: «la cirugía de 3 horas y la consulta de 45
 * minutos». En una lista plana las dos eran una fila igual; acá la cirugía se
 * VE grande y la consulta chica, y el día se lee de un vistazo sin leer horas.
 *
 * ## Los cuatro orígenes se pintan distinto, sin leyenda técnica
 *
 * - **cita**: el nombre del paciente adentro, con sus acciones.
 * - **ocupado**: el tiempo del doctor sin paciente (reunión, guardia — AG-3),
 *   con su rótulo y en tono apagado. Antes sólo se veía si un cupo caía
 *   adentro; ahora es un bloque propio — la reunión de 13:15 existe aunque no
 *   haya cupos a esa hora.
 * - **libre**: invita — es tocable y abre la tarjeta de creación.
 * - **aire**: el hueco entre bloques. Ni borde ni texto: el respiro no invita,
 *   pero ocupa su altura, porque un día con huecos TIENE huecos.
 *
 * ## Tocar un rato vacío crea
 *
 * Un bloque libre (o el aire) emite el rato tocado con su rango ya puesto; el
 * contenedor abre la tarjeta única de AG-5 prellenada. Cero menú previo.
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

  /** Los bloqueos y el tiempo ocupado que lo tocan. */
  readonly bloqueos = input.required<readonly BloqueoDelMes[]>();

  /**
   * Las tipologías, para poder pintar cada actividad.
   *
   * Entra por input y no se pide acá: esta vista sólo dibuja, y quien la usa ya
   * tiene el catálogo cargado. Con la lista vacía todo se ve como hasta ahora
   * — un catálogo que no cargó no puede dejar la agenda en blanco.
   */
  readonly tipologias = input<readonly ActivityTypeOption[]>([]);

  /**
   * La tipología de una cita, o `null` si no declara ninguna.
   *
   * `null` es el caso corriente y no un error: una consulta común no necesita
   * decir que es una consulta. Lo que el propietario quiere distinguir son las
   * OTRAS —operaciones, controles, teleconsultas—, y pintar todas obligaría a
   * mirar el color hasta en lo que no lo necesita.
   */
  private tipologiaDe(cita: Booking): { label: string; tone: TonoDeBadge } | null {
    const concepto = cita.typeConceptId;
    if (concepto === undefined) return null;
    const encontrada = this.tipologias().find((t) => t.conceptId === concepto);
    return encontrada === undefined
      ? null
      : { label: encontrada.label, tone: aTono(encontrada.tone) };
  }

  /**
   * Si quien mira puede registrar la llegada.
   *
   * **`POST /scheduling/bookings/:id/check-in` no admite `PRACTITIONER`**:
   * declara `@Roles('SCHEDULING_ADMIN', 'SCHEDULING_AGENT')`. Verificado
   * contra la API viva. Mientras tanto no se ofrece un botón que se sabe que
   * va a fallar.
   */
  readonly puedeRegistrarLlegada = input<boolean>(false);

  /**
   * Los estados en palabras, por identificador de concepto.
   *
   * `statusConceptId` es un **uuid de catálogo**: traducirlo acá a fuerza de
   * `switch` sería inventar el catálogo. Lo resuelve el contenedor.
   */
  readonly etiquetas = input<ReadonlyMap<string, EstadoResuelto>>(new Map());

  /** Pidieron hacer algo con una cita. */
  readonly accionPedida = output<PedidoDeAccion>();

  /** Tocaron un rato vacío (o el «+») para crear algo ahí. */
  readonly ratoTocado = output<RatoTocado>();

  /** Pidieron quitar un tiempo ocupado. */
  readonly quitarOcupado = output<string>();

  /** Volver al mes. */
  readonly volver = output<void>();

  /**
   * Ir al día siguiente o al anterior — «un botón de ver mañana, y así
   * sucesivamente» del pedido original.
   *
   * Emite el desplazamiento en días y no la fecha ya calculada: sumar un día es
   * cosa del calendario, y hacerlo acá con `+24h` se rompe el día que cambia el
   * horario de verano. Quien tiene la agenta cargada sabe recorrerla.
   */
  readonly diaCambiado = output<number>();

  /**
   * Alguien tocó una tarjeta y quiere ver todo lo de ese rato.
   *
   * El pedido original: «cards al estilo de Google Calendar que son cliqueables
   * que abren un modal con todo el detalle de la actividad». El modal lo arma
   * quien tiene los datos completos —esta vista sólo dibuja—, así que acá se
   * emite el bloque y se decide afuera.
   */
  readonly detallePedido = output<BloqueDelDia>();

  /**
   * Correr la agenda del día N minutos — «mover horario» del pedido.
   *
   * Emite los minutos y, si se pidió «de acá en adelante», **desde qué rato**.
   * Es el «seleccionable a todos o ciertos slots en específico»: o el día
   * entero, o de un punto hacia adelante, que es como uno lo piensa cuando se
   * atrasa a media mañana.
   */
  readonly movimientoPedido = output<{ minutos: number; desde: Date | null }>();

  /** Cerrar un rato libre, con el bloqueo que impide que vuelva. */
  readonly cierrePedido = output<BloqueDelDia>();

  /** Si el panel de mover está abierto. */
  protected readonly moverAbierto = signal(false);

  /**
   * Cuánto se puede correr, en minutos.
   *
   * Una lista corta y no un campo libre: mover el horario se decide entre
   * pacientes, y en ese momento nadie quiere teclear un número.
   */
  protected readonly desplazamientos = [10, 15, 20, 30, 45, 60] as const;

  /** Desde qué rato se mueve, o `null` para el día entero. */
  protected readonly moverDesde = signal<Date | null>(null);

  protected abrirMover(desde: Date | null): void {
    this.moverDesde.set(desde);
    this.moverAbierto.set(true);
  }

  protected pedirMovimiento(minutos: number): void {
    this.movimientoPedido.emit({ minutos, desde: this.moverDesde() });
    this.moverAbierto.set(false);
  }

  protected readonly titulo = computed(() =>
    this.dia().toLocaleDateString('es-BO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );

  /**
   * La línea de horas, con bloques proporcionales.
   *
   * Se arma en tres pasos: los cupos (cita o libre), el tiempo ocupado como
   * bloques PROPIOS —una reunión existe aunque no haya cupos a esa hora—, y el
   * aire entre bloques consecutivos. Los cupos que caen dentro de un ocupado se
   * omiten: la API ya los retiró de la oferta, y pintarlos además del bloque
   * ocupado diría dos cosas sobre el mismo rato.
   */
  protected readonly bloques = computed<readonly BloqueDelDia[]>(() => {
    const porSlot = new Map<string, Booking>();
    for (const cita of this.citas()) {
      if (cita.bookableSlotId) porSlot.set(cita.bookableSlotId, cita);
    }

    const delDia: BloqueDelDia[] = [];

    // 1 · el tiempo ocupado, como bloques propios.
    for (const bloqueo of this.bloqueosDelDia()) {
      delDia.push({
        clave: `ocupado-${bloqueo.id ?? bloqueo.desde.getTime()}`,
        desde: bloqueo.desde,
        hasta: bloqueo.hasta,
        tipo: 'ocupado',
        cita: null,
        paciente: '',
        estado: '',
        statusCode: '',
        tipologia: null,
        motivo: bloqueo.motivo,
        excepcionId: bloqueo.id ?? null,
        alturaPx: this.altura(bloqueo.desde, bloqueo.hasta, true),
      });
    }

    // 2 · los cupos: cita o libre. Un LIBRE dentro de un ocupado se omite —la
    // API ya lo retiró de la oferta, y pintarlo además del bloque ocupado diría
    // dos cosas sobre el mismo rato—. Una CITA dentro de un bloqueo se muestra
    // SIEMPRE: el bloqueo no se la traga, porque la persona viene igual.
    for (const cupo of this.cupos()) {
      const hasta = cupo.endAt ?? cupo.startAt;
      const cita = porSlot.get(cupo.id) ?? null;
      if (cita === null && this.dentroDeOcupado(cupo.startAt, hasta)) continue;

      if (cita === null) {
        delDia.push({
          clave: cupo.id,
          desde: cupo.startAt,
          hasta,
          tipo: 'libre',
          cita: null,
          paciente: '',
          estado: '',
          statusCode: '',
          tipologia: null,
          motivo: null,
          excepcionId: null,
          alturaPx: this.altura(cupo.startAt, hasta, true),
        });
        continue;
      }

      delDia.push({
        clave: cupo.id,
        desde: cupo.startAt,
        hasta,
        tipo: 'cita',
        cita,
        // Sin nombre no se inventa un relleno ni se muestra el uuid: se dice
        // que no está. Que falte es una condición del servidor, no un error.
        paciente: cita.patientName ?? 'Paciente sin nombre registrado',
        estado: this.etiquetas().get(cita.statusConceptId)?.display ?? 'Reservado',
        statusCode: this.etiquetas().get(cita.statusConceptId)?.code ?? '',
        tipologia: this.tipologiaDe(cita),
        motivo: null,
        excepcionId: null,
        alturaPx: this.altura(cupo.startAt, hasta, true),
      });
    }

    delDia.sort((a, b) => a.desde.getTime() - b.desde.getTime());

    // 3 · el aire entre bloques consecutivos. Sin mínimo de altura: un hueco
    // de 5 minutos debe verse chico, porque lo es.
    const conAire: BloqueDelDia[] = [];
    for (const [indice, bloque] of delDia.entries()) {
      if (indice > 0) {
        const anterior = delDia[indice - 1];
        const huecoMs = bloque.desde.getTime() - anterior.hasta.getTime();
        if (huecoMs > 0) {
          conAire.push({
            clave: `aire-${anterior.hasta.getTime()}`,
            desde: anterior.hasta,
            hasta: bloque.desde,
            tipo: 'aire',
            cita: null,
            paciente: '',
            estado: '',
            statusCode: '',
            tipologia: null,
            motivo: null,
            excepcionId: null,
            alturaPx: this.altura(anterior.hasta, bloque.desde, false),
          });
        }
      }
      conAire.push(bloque);
    }
    return conAire;
  });

  /** Cuántos turnos tiene tomados, para el encabezado. */
  protected readonly resumen = computed(() => {
    const bloques = this.bloques();
    const cupos = bloques.filter((b) => b.tipo === 'cita' || b.tipo === 'libre');
    const conCita = bloques.filter((b) => b.tipo === 'cita').length;
    const ocupados = bloques.filter((b) => b.tipo === 'ocupado').length;
    if (cupos.length === 0 && ocupados === 0) return 'No atendés este día.';
    const partes: string[] = [];
    if (cupos.length > 0) {
      partes.push(
        conCita === 0
          ? `${cupos.length} turnos publicados, ninguno reservado`
          : `${conCita} de ${cupos.length} turnos reservados`,
      );
    }
    if (ocupados > 0) {
      partes.push(`${ocupados} ${ocupados === 1 ? 'rato ocupado' : 'ratos ocupados'}`);
    }
    return `${partes.join(' · ')}.`;
  });

  /**
   * Si a esta persona todavía se le puede marcar la llegada.
   *
   * Se decide por el **código** del concepto y no por su uuid: el catálogo
   * mezcla convenciones, así que se compara por sufijo. Sin etiqueta resuelta
   * se ofrece igual: el backend sigue siendo la última palabra.
   */
  protected puedeLlegar(bloque: BloqueDelDia): boolean {
    if (!this.puedeRegistrarLlegada()) return false;
    const codigo = this.codigoDe(bloque);
    return codigo === '' || (OPERABLES.has(codigo) && !YA_LLEGO.has(codigo));
  }

  protected puedeOperar(bloque: BloqueDelDia): boolean {
    const codigo = this.codigoDe(bloque);
    return codigo === '' || OPERABLES.has(codigo);
  }

  protected pedir(bloque: BloqueDelDia, accion: AccionDeCita): void {
    if (bloque.cita === null) return;
    this.accionPedida.emit({ bookingId: bloque.cita.id, accion });
  }

  /** Tocar un bloque libre o el aire abre la tarjeta con el rango puesto. */
  protected tocar(bloque: BloqueDelDia): void {
    if (bloque.tipo !== 'libre' && bloque.tipo !== 'aire') return;
    this.ratoTocado.emit({ desde: bloque.desde, hasta: bloque.hasta });
  }

  /**
   * El «+» del encabezado: crear sin haber tocado un rato.
   *
   * Propone la próxima hora en punto del día mirado, media hora — la tarjeta
   * deja ajustar todo, esto es sólo un punto de partida razonable.
   */
  protected crear(): void {
    const base = new Date(this.dia());
    const ahora = new Date();
    const hora = base.toDateString() === ahora.toDateString() ? ahora.getHours() + 1 : 9;
    base.setHours(hora, 0, 0, 0);
    const hasta = new Date(base.getTime() + 30 * 60_000);
    this.ratoTocado.emit({ desde: base, hasta });
  }

  /** El código del estado, sin el prefijo de módulo. */
  private codigoDe(bloque: BloqueDelDia): string {
    return bloque.statusCode.split(':').pop() ?? '';
  }

  private altura(desde: Date, hasta: Date, conMinimo: boolean): number {
    const minutos = Math.max(0, (hasta.getTime() - desde.getTime()) / 60_000);
    const px = Math.round(minutos * PX_POR_MINUTO);
    return conMinimo ? Math.max(px, ALTURA_MINIMA_PX) : px;
  }

  /** Los bloqueos que tocan el día mirado, recortados a sus límites. */
  private bloqueosDelDia(): readonly BloqueoDelMes[] {
    const inicio = new Date(this.dia());
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 1);

    return this.bloqueos()
      .filter((b) => b.desde.getTime() < fin.getTime() && b.hasta.getTime() > inicio.getTime())
      .map((b) => ({
        ...b,
        // Un bloqueo de varios días se recorta al día mirado: la guardia del
        // fin de semana no debe pintar un bloque de 72 horas en el martes.
        desde: b.desde.getTime() < inicio.getTime() ? inicio : b.desde,
        hasta: b.hasta.getTime() > fin.getTime() ? fin : b.hasta,
      }));
  }

  private dentroDeOcupado(desde: Date, hasta: Date): boolean {
    return this.bloqueosDelDia().some(
      (b) => b.desde.getTime() < hasta.getTime() && b.hasta.getTime() > desde.getTime(),
    );
  }
}
