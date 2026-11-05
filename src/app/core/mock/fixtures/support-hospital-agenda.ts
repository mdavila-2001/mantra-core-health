import { iso, uuid } from '../mock-store';
import { DOCTORES_POR_TENANT } from './support-hospital';

/* ---- la agenda base ------------------------------------------------------------ */

export interface FilaAgendaBase {
  readonly id: string;
  readonly tenantId: string;
  readonly doctorId: string;
  readonly careSpaceId: string;
  readonly healthcareServiceId: string;
  readonly start: string;
  readonly end: string;
  /** Estado de partida; los cambios del recorrido viven en `ajustesDeAgenda`. */
  readonly status: 'FREE' | 'BOOKED' | 'CONFIRMED' | 'CHECKED_IN';
  readonly patientLabel?: string;
  readonly reasonLabel?: string;
}

const PACIENTES_DE_EJEMPLO: readonly string[] = [
  'Rosa Mamani · CI ***556',
  'Juan Carlos Vaca · CI ***102',
  'Lucía Vargas · CI ***771',
  'Mario Ortiz · CI ***340',
  'Elena Suárez · CI ***918',
  'Pedro Salvatierra · CI ***265',
];
const MOTIVOS_DE_EJEMPLO: readonly string[] = [
  'Control de rutina',
  'Dolor persistente',
  'Resultado de estudios',
  'Primera consulta',
  'Seguimiento',
];

/**
 * Mañana y tarde, con el mediodía vacío: la semana y la línea de tiempo se ven
 * como una agenda real (huecos, no una pared). Los seis primeros son los de
 * siempre —las pruebas dependen de las 9:00 y las 9:30—.
 */
const HORAS: readonly [number, number][] = [
  [9, 0],
  [9, 30],
  [10, 0],
  [10, 30],
  [11, 0],
  [11, 30],
  [12, 0],
  [12, 30],
  [14, 0],
  [14, 30],
  [15, 0],
  [15, 30],
  [16, 0],
  [16, 30],
  [17, 0],
  [17, 30],
];

/** Cuántos días antes y después de hoy hay agenda: una semana atrás y dos adelante. */
const DIAS_ATRAS = -7;
const DIAS_ADELANTE = 14;

/** La agenda (recurso) de un doctor en un espacio: estable, para quien la pide por `resourceId`. */
export function recursoDeAgenda(doctorId: string, careSpaceId: string): string {
  return uuid(`hp-res-${doctorId}-${careSpaceId}`);
}

/**
 * Las horas en que un doctor atiende en cada uno de sus lugares. **Un doctor no
 * está en dos lugares a la vez**: el primer lugar es la mañana; el segundo, la
 * tarde; y un tercero (el quirófano) comparte la tarde con el segundo en días
 * alternos. Así la agenda se parece a una real: nada de dos horarios del mismo
 * doctor pisándose, y el tiempo del mediodía libre.
 */
function horasDelLugar(indiceLugar: number): readonly (readonly [number, number])[] {
  return indiceLugar === 0 ? HORAS.slice(0, 8) : HORAS.slice(8);
}

function generarAgenda(): readonly FilaAgendaBase[] {
  const filas: FilaAgendaBase[] = [];
  for (const [tenantId, doctores] of Object.entries(DOCTORES_POR_TENANT)) {
    for (const d of doctores) {
      const tresLugares = d.placements.length > 2;
      d.placements.forEach((lugarDeAtencion, indiceLugar) => {
        for (let dia = DIAS_ATRAS; dia <= DIAS_ADELANTE; dia += 1) {
          // Con tres lugares, el segundo y el tercero se turnan la tarde.
          const esDiaImpar = Math.abs(dia) % 2 === 1;
          if (tresLugares && indiceLugar === 1 && esDiaImpar) continue;
          if (tresLugares && indiceLugar === 2 && !esDiaImpar) continue;
          const horas = horasDelLugar(indiceLugar);
          horas.forEach(([hora, minuto], k) => {
            const indiceHora = HORAS.findIndex(([h, m]) => h === hora && m === minuto);
            const semilla = `${d.id}-${indiceLugar}-${dia}-${indiceHora}`;
            // La primera hora de hoy en cada lugar de atención es una cita
            // confirmada (la recorren las pruebas de llegada del paciente); la
            // segunda, un horario libre. El resto reparte tres de cada cuatro
            // libres a mano, sin azar: el mismo día siempre trae lo mismo.
            const fijoHoy = dia === 0 && k === 0;
            const libreHoy = dia === 0 && k === 1;
            const yaLlego = dia === 0 && k === 2 && indiceLugar === 0;
            const hash = Array.from(semilla).reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
            const ocupado = fijoHoy || yaLlego || (!libreHoy && hash % 4 === 0);
            // De lo ocupado, una de cada tres citas nace **reservada, por confirmar**
            // (la acción «Confirmar» solo existe para esas). La cita fija de hoy sigue
            // confirmada y la tercera del primer lugar ya llegó.
            const estado: FilaAgendaBase['status'] = !ocupado ? 'FREE' : fijoHoy ? 'CONFIRMED' : yaLlego ? 'CHECKED_IN' : hash % 3 === 1 ? 'BOOKED' : 'CONFIRMED';
            filas.push({
              id: uuid(`hp-slot-${semilla}`),
              tenantId,
              doctorId: d.id,
              careSpaceId: lugarDeAtencion.careSpaceId,
              healthcareServiceId: lugarDeAtencion.healthcareServiceId,
              start: iso(dia, hora, minuto),
              end: iso(dia, hora, minuto + 30),
              status: estado,
              ...(ocupado
                ? {
                    patientLabel: PACIENTES_DE_EJEMPLO[hash % PACIENTES_DE_EJEMPLO.length]!,
                    reasonLabel: MOTIVOS_DE_EJEMPLO[hash % MOTIVOS_DE_EJEMPLO.length]!,
                  }
                : {}),
            });
          });
        }
      });
    }
  }
  return filas;
}

let agendaBase: readonly FilaAgendaBase[] | null = null;
let agendaPorId: ReadonlyMap<string, FilaAgendaBase> | null = null;

/** La agenda de partida, generada una vez. */
export function agendaDePartida(): readonly FilaAgendaBase[] {
  agendaBase ??= generarAgenda();
  return agendaBase;
}

export function filaDeAgenda(id: string): FilaAgendaBase | undefined {
  agendaPorId ??= new Map(agendaDePartida().map((fila) => [fila.id, fila]));
  return agendaPorId.get(id);
}
