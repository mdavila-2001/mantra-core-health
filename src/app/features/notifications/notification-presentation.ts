import type { NavIconName } from '../../shared/components/atoms/nav-icon/nav-icon.types';
import type { InAppNotification } from '../../core/data-access/notifications/notifications.types';

/* ============================================================================
    Cómo se lee una notificación: su ícono, su hora y en qué día cae.

    Tres funciones puras, fuera del componente, porque son lo único de esta
    pantalla que se puede equivocar en silencio — un día mal calculado o un
    «hace 25 h» no rompen nada, sólo mienten — y porque probarlas exige fijar
    el reloj, que dentro de un componente obliga a montar media aplicación.

    Todas reciben `ahora` en vez de leer el reloj: una función que consulta la
    hora del sistema no se puede probar dos veces con el mismo resultado.
    ========================================================================== */

/**
 * El glifo de cada familia de aviso.
 *
 * Las cuatro categorías son las del contrato (`NotificationCategory`), y el
 * dibujo dice de qué se trata antes de leer el título: es lo que permite
 * barrer una bandeja de treinta filas sin leerlas todas.
 *
 * El genérico es la campana, no un hueco: una categoría nueva del backend
 * entra con un dibujo honesto —«esto es un aviso»— en vez de una fila coja.
 */
export function iconoDeCategoria(categoria: string | undefined): NavIconName {
  switch (categoria) {
    case 'CLINICAL':
      return 'stethoscope';
    case 'SCHEDULING':
      return 'calendar';
    case 'MESSAGES':
      return 'chat';
    case 'SOCIAL':
      return 'people';
    default:
      return 'bell';
  }
}

/** Cómo se nombra cada familia en pantalla. */
export function nombreDeCategoria(categoria: string | undefined): string {
  switch (categoria) {
    case 'CLINICAL':
      return 'Clínico';
    case 'SCHEDULING':
      return 'Turnos';
    case 'MESSAGES':
      return 'Mensajes';
    case 'SOCIAL':
      return 'Red';
    default:
      return 'Aviso';
  }
}

/** El día calendario de una fecha, para comparar sin la hora. */
function claveDelDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/**
 * Cuánto hace que llegó, dicho como lo diría una persona.
 *
 * Hasta el minuto es «recién»; después minutos, horas y días. Pasada la
 * semana se vuelve a la fecha: «hace 34 días» obliga a hacer la cuenta, y lo
 * que se quiere saber a esa altura es *cuándo*, no *hace cuánto*.
 *
 * Una fecha futura —el reloj del navegador atrasado respecto del servidor es
 * lo normal, no una rareza— se dice «recién» y no «hace -3 minutos».
 */
export function horaRelativa(fecha: Date, ahora: Date): string {
  const transcurrido = ahora.getTime() - fecha.getTime();
  if (transcurrido < MINUTO) return 'recién';
  if (transcurrido < HORA) {
    const minutos = Math.floor(transcurrido / MINUTO);
    return `hace ${minutos} min`;
  }
  if (transcurrido < DIA) {
    const horas = Math.floor(transcurrido / HORA);
    return `hace ${horas} h`;
  }
  // De acá para arriba se cuenta por **día calendario**, no por horas
  // transcurridas, y por la misma razón que `agruparPorDia`: algo del día 8
  // visto el día 10 a la mañana hace 30 horas, y decir «ayer» debajo de un
  // encabezado que dice «8 de septiembre» es hacer dudar de las dos cosas.
  const dias = Math.round((claveDelDia(ahora) - claveDelDia(fecha)) / DIA);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias <= 7) return `hace ${dias} días`;
  return fecha.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
}

/** Un día de la bandeja, con sus avisos. */
export interface DiaDeAvisos {
  /** «Hoy», «Ayer» o la fecha escrita. Es la clave de `@for`, así que es única. */
  readonly etiqueta: string;
  readonly avisos: readonly InAppNotification[];
}

/**
 * Reparte los avisos en días, **conservando el orden** en el que llegaron.
 *
 * El orden lo pone el backend (más nuevo primero) y acá no se reordena: la
 * bandeja se pagina con cursor, así que ordenar del lado del cliente sólo
 * ordenaría la página cargada y el resultado cambiaría al pulsar «ver más».
 *
 * «Hoy» y «Ayer» se calculan por **día calendario**, no por horas
 * transcurridas: a las 00:30 lo de las 23:00 es de ayer aunque haga hora y
 * media, y decir «hoy» ahí es lo que hace dudar de si un aviso es nuevo.
 */
export function agruparPorDia(
  avisos: readonly InAppNotification[],
  ahora: Date,
): readonly DiaDeAvisos[] {
  const hoy = claveDelDia(ahora);
  const ayer = hoy - DIA;
  const grupos: DiaDeAvisos[] = [];

  for (const aviso of avisos) {
    const dia = claveDelDia(aviso.availableAt);
    const etiqueta =
      dia === hoy
        ? 'Hoy'
        : dia === ayer
          ? 'Ayer'
          : aviso.availableAt.toLocaleDateString('es-BO', {
              day: 'numeric',
              month: 'long',
              year:
                aviso.availableAt.getFullYear() === ahora.getFullYear() ? undefined : 'numeric',
            });

    const ultimo = grupos.at(-1);
    if (ultimo?.etiqueta === etiqueta) {
      (ultimo.avisos as InAppNotification[]).push(aviso);
    } else {
      grupos.push({ etiqueta, avisos: [aviso] });
    }
  }

  return grupos;
}
