import type {
  AvailabilityExceptionType,
  PublishedException,
} from '../../core/data-access/scheduling/scheduling.types';

/**
 * **El vocabulario de los bloqueos de agenda.**
 *
 * ## Qué es un bloqueo, en este producto
 *
 * Un bloqueo es tiempo que el profesional **se reserva** y que la aplicación
 * no debe ofrecer para turnos. El caso que le da sentido a la pantalla es el
 * trabajo de especialidad —quirófano, guardia, ateneo, docencia—: horas que el
 * médico sí trabaja, pero que **no se agendan por la app**. Vacaciones y
 * feriados son el mismo mecanismo con otra intención.
 *
 * Lo que un bloqueo NO es: un cupo. Un cupo se ofrece y se reserva; un bloqueo
 * existe justamente para que no haya cupo.
 *
 * ## Por qué la clase viaja dentro de `reason` y no en `exceptionType`
 *
 * `POST /scheduling/resources/:id/exceptions` acepta un enum cerrado de tres
 * valores —`ABSENCE`, `HOLIDAY`, `EXTRA`— fijado en el backend
 * (`scheduling-catalog.dto.ts`, y el mismo enum en el OpenAPI). No hay un
 * `SPECIALIST_WORK`, y pedirlo dejaría la pantalla esperando a otro equipo.
 *
 * `reason` sí es texto libre, lo devuelve el `GET`, y **ya lo escribía el
 * formulario de bloqueo**. Así que la clase se escribe ahí con una marca
 * estable —`[especialidad] Cirugía programada`— que se lee de vuelta al
 * listar. La marca es una convención del front, no del contrato: el día que el
 * backend agregue el tipo, `TIPO_DE_API` es la única línea que cambia y los
 * bloqueos viejos se siguen leyendo por su marca.
 *
 * El detalle libre se conserva aparte de la marca porque es lo que el
 * profesional escribió y lo que quiere volver a leer; la marca es metadato.
 */

/** Las clases de bloqueo que la pantalla ofrece. */
export type ClaseDeBloqueo = 'especialidad' | 'ausencia' | 'feriado';

/** Cómo se presenta y cómo se manda cada clase. */
export interface DefinicionDeClase {
  readonly clave: ClaseDeBloqueo;
  readonly etiqueta: string;
  /** Qué significa, en los términos del profesional. */
  readonly ayuda: string;
  /** El valor del enum del backend que le corresponde. */
  readonly tipo: AvailabilityExceptionType;
}

/**
 * El orden importa: «trabajo de especialidad» va primero y es el que se elige
 * solo, porque es la razón por la que existe la pantalla.
 */
export const CLASES_DE_BLOQUEO: readonly DefinicionDeClase[] = [
  {
    clave: 'especialidad',
    etiqueta: 'Trabajo de especialidad',
    ayuda:
      'Quirófano, guardia, ateneo, docencia: horas que trabajás y que la app no debe ofrecer para turnos.',
    tipo: 'ABSENCE',
  },
  {
    clave: 'ausencia',
    etiqueta: 'Ausencia',
    ayuda: 'Vacaciones, un trámite, un congreso: no estás disponible.',
    tipo: 'ABSENCE',
  },
  {
    clave: 'feriado',
    etiqueta: 'Feriado',
    ayuda: 'El consultorio no atiende ese día.',
    tipo: 'HOLIDAY',
  },
];

/** La clase con la que arranca el formulario. */
export const CLASE_POR_DEFECTO: ClaseDeBloqueo = 'especialidad';

/** La definición de una clase; nunca devuelve `undefined`. */
export function definicionDe(clase: ClaseDeBloqueo): DefinicionDeClase {
  return CLASES_DE_BLOQUEO.find((c) => c.clave === clase) ?? CLASES_DE_BLOQUEO[0]!;
}

/** El tipo del enum del backend que le toca a una clase. */
export function tipoDeApi(clase: ClaseDeBloqueo): AvailabilityExceptionType {
  return definicionDe(clase).tipo;
}

/** La marca que identifica la clase dentro del texto de `reason`. */
const MARCA = /^\[(especialidad|ausencia|feriado)\]\s*/;

/**
 * Arma el `reason` que se manda: la marca y, detrás, lo que escribió el
 * profesional.
 */
export function componerMotivo(clase: ClaseDeBloqueo, detalle: string): string {
  const limpio = detalle.trim();
  return limpio === '' ? `[${clase}]` : `[${clase}] ${limpio}`;
}

/** Lo que se lee de un `reason` guardado. */
export interface MotivoLeido {
  readonly clase: ClaseDeBloqueo;
  /** Lo que escribió el profesional, sin la marca. Vacío si no escribió nada. */
  readonly detalle: string;
  /** `false` cuando el texto no traía marca y la clase se dedujo. */
  readonly marcado: boolean;
}

/**
 * Lee la clase de un bloqueo guardado.
 *
 * Sin marca —los bloqueos anteriores a esta pantalla, y los que cree cualquier
 * otro cliente— se cae al tipo del backend: `HOLIDAY` es feriado y todo lo
 * demás, ausencia. Nunca se los muestra como trabajo de especialidad: afirmar
 * un dato que nadie declaró es peor que ofrecer el genérico.
 */
export function leerMotivo(reason: string | undefined, esFeriado: boolean): MotivoLeido {
  const texto = (reason ?? '').trim();
  const marca = MARCA.exec(texto);
  if (marca !== null) {
    return {
      clase: marca[1] as ClaseDeBloqueo,
      detalle: texto.slice(marca[0].length).trim(),
      marcado: true,
    };
  }
  return { clase: esFeriado ? 'feriado' : 'ausencia', detalle: texto, marcado: false };
}

/**
 * Un bloqueo listo para leer en una tabla.
 *
 * Los instantes llegan como texto ISO del `GET`; acá ya son fechas, porque la
 * pantalla los tiene que ordenar y comparar con hoy, no sólo imprimirlos.
 */
export interface BloqueoVisible {
  readonly id: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly clase: ClaseDeBloqueo;
  readonly etiquetaDeClase: string;
  readonly detalle: string;
  /** `true` cuando cubre días enteros de medianoche a medianoche. */
  readonly diasEnteros: boolean;
  /** Cuántos días abarca, contando el primero. */
  readonly dias: number;
  /** `true` cuando el bloqueo ya terminó. */
  readonly pasado: boolean;
}

const UN_DIA = 24 * 60 * 60 * 1000;

/** Si el instante cae exactamente en la medianoche local. */
function esMedianoche(fecha: Date): boolean {
  return (
    fecha.getHours() === 0 &&
    fecha.getMinutes() === 0 &&
    fecha.getSeconds() === 0 &&
    fecha.getMilliseconds() === 0
  );
}

/**
 * Traduce lo que devuelve el `GET` a lo que la tabla muestra.
 *
 * `esFeriado` lo decide quien llama, porque el `GET` devuelve un
 * `exceptionTypeConceptId` —un uuid— y traducirlo es cosa del catálogo de
 * terminología, que este módulo no conoce a propósito: acá vive el vocabulario
 * del producto, no una dependencia de red.
 */
export function aBloqueoVisible(
  excepcion: PublishedException,
  esFeriado: boolean,
  ahora: Date = new Date(),
): BloqueoVisible {
  const desde = new Date(excepcion.startAt);
  const hasta = new Date(excepcion.endAt);
  const { clase, detalle } = leerMotivo(excepcion.reason, esFeriado);
  const diasEnteros = esMedianoche(desde) && esMedianoche(hasta);
  const bruto = Math.round((hasta.getTime() - desde.getTime()) / UN_DIA);
  return {
    id: excepcion.id,
    desde,
    hasta,
    clase,
    etiquetaDeClase: definicionDe(clase).etiqueta,
    detalle,
    diasEnteros,
    // Los días enteros van de medianoche a medianoche del siguiente: un día
    // solo mide 24 h y tiene que decir «1 día», no «0».
    dias: diasEnteros ? Math.max(1, bruto) : 1,
    pasado: hasta.getTime() <= ahora.getTime(),
  };
}
