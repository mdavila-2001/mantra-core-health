import { RECURSO_CONSULTORIO_MEDICA, RECURSO_MEDICA, reservas } from './fixtures/agenda';
import { ESTADO_RESERVA } from './fixtures/conceptos';
import { MEDICA, PACIENTE } from './fixtures/personas';
import { ahora, uuid } from './mock-store';

/* ============================================================================
    El horario que se libera solo, y a quién se le avisa.

    Es el punto 3.4 del registro de procesos, módulo Paciente:

    > «Si no encuentras cita en el día que necesitas y confirmas para otra fecha
    > PUEDES RECIBIR UNA NOTIFICACION DE LA APP DONDE TE INFORME QUE UN PACIENTE
    > DESCONFIRMO Y EXISTE UN HORARIO DISPONIBLE.»

    ## Esto lo hace el backend, y todavía no existe

    Vive en `core/mock/` porque es **comportamiento de servidor**: decidir que
    un cupo quedó libre y avisarle a quien lo estaba esperando no es trabajo de
    una pantalla. Acá se simula para poder recorrerlo; lo que la API tiene que
    construir está anotado en `PENDIENTES-BACKEND.md` (P21).

    ## Qué se toma como «se liberó»

    El pedido dice «un paciente desconfirmó». Lo que la maqueta observa es la
    señal que sí puede observar sin que nadie apriete nada: **la reserva sigue
    confirmada y ya pasaron diez minutos de su hora sin que se iniciara la
    consulta**. Quien reservó no llegó, y el cupo está de hecho libre.

    No es un atajo: es la misma conclusión con el dato que hay. Un
    «desconfirmar» explícito también libera el cupo, y cuando exista entra por
    la misma puerta — {@link horariosLiberados} sólo mira el estado y el reloj.

    ## Por qué diez minutos

    Es la tolerancia que ya usa la agenda para dar por perdida una consulta que
    no arrancó, y es el número que pidió el propietario. Está acá arriba y con
    nombre para que cambiarlo sea una línea y no una búsqueda.
    ========================================================================== */

/** Minutos de gracia antes de dar por libre un cupo que nadie inició. */
export const MINUTOS_DE_GRACIA = 10;

/**
 * Los estados en los que una reserva **todavía no empezó**.
 *
 * `BK-CHECKED-IN` cuenta: la persona llegó y anunció, pero si diez minutos
 * después nadie inició la consulta el cupo tampoco se está usando. Lo que saca
 * a una reserva de esta lista es que la consulta arranque (`BK-IN-PROGRESS`) o
 * termine (`BK-COMPLETED`).
 */
const SIN_EMPEZAR = ['BK-CONFIRMED', 'BK-CHECKED-IN'] as const;

/** Un cupo que quedó libre, con lo que hace falta para ofrecerlo. */
export interface HorarioLiberado {
  readonly bookableSlotId: string;
  readonly resourceId: string;
  readonly startAt: string;
  readonly endAt: string;
  /** La reserva que lo dejó libre. Sirve para no avisar dos veces por lo mismo. */
  readonly reservaId: string;
}

/**
 * Los cupos de la médica que quedaron libres **y todavía se pueden tomar**.
 *
 * Se calcula **en cada lectura** y no se guarda: depende del reloj, y una lista
 * guardada al arrancar diría a las once lo que era cierto a las nueve. Es
 * también lo que hace que el aviso *llegue* mientras alguien recorre la
 * maqueta, en vez de estar ahí desde el principio.
 *
 * ## Por qué la ventana se cierra cuando el cupo termina
 *
 * Porque un cupo liberado es una oportunidad **de ahora**, no un dato de
 * archivo: quien lo toma va a que lo atiendan en ese hueco. Sin este corte, a
 * media tarde se ofrecían los tres de la mañana a la vez —vistos en la maqueta
 * el 09/09/2026: tres avisos apilados, todos de horas que ya habían pasado
 * enteras—. Un aviso que ofrece algo que no se puede tomar es peor que ninguno:
 * enseña que los avisos de la aplicación no valen la pena de leerse.
 */
export function horariosLiberados(): readonly HorarioLiberado[] {
  const ahoraMs = Date.parse(ahora());
  const sinEmpezar = new Set(SIN_EMPEZAR.map((codigo) => ESTADO_RESERVA[codigo]));

  return reservas
    .filtrar(
      (r) =>
        (r.resourceId === RECURSO_MEDICA || r.resourceId === RECURSO_CONSULTORIO_MEDICA) &&
        r.patientProfileId !== PACIENTE.id &&
        sinEmpezar.has(r.statusConceptId) &&
        // Ya pasó la gracia…
        Date.parse(r.startAt) + MINUTOS_DE_GRACIA * 60_000 <= ahoraMs &&
        // …y el cupo todavía no terminó, así que se puede tomar.
        Date.parse(r.endAt) > ahoraMs,
    )
    .map((r) => ({
      bookableSlotId: r.bookableSlotId,
      resourceId: r.resourceId,
      startAt: r.startAt,
      endAt: r.endAt,
      reservaId: r.id,
    }))
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
}

/**
 * Si a esta persona le interesa que se libere un cupo de la médica.
 *
 * El registro es explícito en la condición: le avisa a quien **no consiguió el
 * día que quería y confirmó para otra fecha**. Acá eso se traduce en tener una
 * cita futura con la misma profesional: si ya la vas a ver mañana, que se
 * libere un hueco hoy es una oportunidad; si no la esperás, es ruido.
 *
 * @param patientProfileId - El perfil de quien está mirando la campana.
 */
export function esperaUnHueco(patientProfileId: string): boolean {
  const ahoraMs = Date.parse(ahora());
  return reservas
    .filtrar((r) => r.patientProfileId === patientProfileId)
    .some(
      (r) =>
        (r.resourceId === RECURSO_MEDICA || r.resourceId === RECURSO_CONSULTORIO_MEDICA) &&
        Date.parse(r.startAt) > ahoraMs,
    );
}

/** Cómo se lee una hora en el aviso: «martes 10 a las 10:30». */
function cuando(iso: string): string {
  const fecha = new Date(iso);
  const dia = fecha.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });
  const hora = fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  return `${dia} a las ${hora}`;
}

/**
 * El aviso de un hueco libre, con la forma que ya tiene la campana.
 *
 * `payloadJson.kind` es lo que distingue este aviso de los demás de su
 * categoría, y es lo que mira el anunciador de la maqueta para levantarlo como
 * toast. Va en el `payload` y no en el asunto porque el asunto es prosa y
 * cambia; una condición no se cuelga de una frase.
 */
export function avisoDeHorarioLiberado(hueco: HorarioLiberado) {
  return {
    id: uuid(`notif-hueco-${hueco.bookableSlotId}`),
    userId: PACIENTE.userId,
    category: 'SCHEDULING' as const,
    subject: 'Se liberó un horario',
    bodyText: `Un paciente no confirmó su cita del ${cuando(hueco.startAt)} con la ${MEDICA.professionalTitle} ${MEDICA.displayName}. Si te sirve mejor que la tuya, podés tomarla.`,
    destination: { type: 'APPOINTMENT', id: hueco.bookableSlotId },
    payloadJson: {
      kind: 'SLOT_RELEASED',
      bookableSlotId: hueco.bookableSlotId,
      resourceId: hueco.resourceId,
      startAt: hueco.startAt,
      releasedBy: hueco.reservaId,
    },
    unread: true,
    availableAt: ahora(),
    readAt: null,
  };
}
