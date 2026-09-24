/* ============================================================================
    Lo que el servicio de triage entendió, traducido a la forma de la tabla.

    ## Por qué traducir a `Sintoma`

    Porque todo lo que viene después —los chips, quitar y agregar, la alarma,
    `recomendar` y el cruce con el directorio— ya sabe trabajar con `Sintoma`.
    El servicio devuelve sus especialidades con el mismo vocabulario de la
    tabla («Traumatología», «Dermatología»), así que un hallazgo suyo entra al
    mismo camino que uno reconocido acá, sin una segunda lógica de
    recomendación.

    ## Qué aporta sobre el motor local

    El motor local reconoce las filas de la tabla. El servicio usa ese mismo
    motor y le suma una capa anatómica: «me duele la pantorrilla», «manchas en
    la espalda» o «un chichón en la frente» no tienen fila, y el servicio los
    devuelve como «dolor en la pantorrilla», con su zona y su especialidad.
    También ubica los de la tabla: «se me durmió la mano izquierda» sigue
    siendo *hormigueo*, ahora con la mano y el lado.
    ========================================================================== */

import type { HallazgoIa, LecturaIa } from '@core/data-access/triage-ia/triage-ia.types';

import { normalizar, TODOS_LOS_SINTOMAS, type Sintoma } from './sintomas';

const POR_ID: ReadonlyMap<string, Sintoma> = new Map(TODOS_LOS_SINTOMAS.map((s) => [s.id, s]));

/** Una lectura y el texto que la produjo. */
export interface LecturaDelTexto {
  readonly texto: string;
  readonly lectura: LecturaIa;
}

/**
 * Si la lectura todavía vale para lo que hay escrito.
 *
 * Vale mientras el texto actual la **contenga**: seguir escribiendo o dictando
 * agrega al final, y lo que el servicio ya entendió sigue siendo cierto. Si se
 * borró o se cambió algo del medio, deja de valer hasta que llegue la nueva —
 * mostrar un chip de algo que la persona ya borró es peor que esperar un
 * instante.
 */
export function lecturaVigente(guardada: LecturaDelTexto | null, texto: string): LecturaIa | null {
  if (guardada === null) {
    return null;
  }
  return texto.trim().startsWith(guardada.texto.trim()) ? guardada.lectura : null;
}

/** Los hallazgos del servicio como síntomas de la tabla, en el orden en que llegaron. */
export function sintomasDeLaLectura(lectura: LecturaIa | null): readonly Sintoma[] {
  if (lectura === null) {
    return [];
  }
  return lectura.symptoms.map(comoSintoma).filter((s): s is Sintoma => s !== null);
}

function comoSintoma(hallazgo: HallazgoIa): Sintoma | null {
  if (hallazgo.kind === 'curated') {
    const fila = POR_ID.get(hallazgo.code);
    // Un código que la tabla de este build no tiene se ignora: la tabla del
    // servicio puede ir un commit adelante o atrás.
    return fila === undefined ? null : { ...fila, nombre: conUbicacion(fila.nombre, hallazgo) };
  }
  return {
    id: hallazgo.code,
    nombre: conLado(hallazgo.label, hallazgo),
    sinonimos: [],
    especialidades: hallazgo.especialidades.map(({ nombre, peso }) => ({ nombre, peso })),
    ...(hallazgo.alarm ? { alarma: true } : {}),
  };
}

/**
 * «hormigueo o adormecimiento · mano izquierda».
 *
 * Sólo se agrega la parte si el nombre no la dice ya: «dolor de rodilla» con la
 * rodilla sería repetir.
 */
function conUbicacion(nombre: string, hallazgo: HallazgoIa): string {
  const parte = hallazgo.bodyPart;
  if (parte === null) {
    return nombre;
  }
  if (normalizar(nombre).includes(normalizar(parte.label))) {
    return conLado(nombre, hallazgo);
  }
  return `${nombre} · ${parte.label}${parte.side === null ? '' : ` (${ladoDicho(parte.side)})`}`;
}

function conLado(nombre: string, hallazgo: HallazgoIa): string {
  const lado = hallazgo.bodyPart?.side ?? null;
  return lado === null ? nombre : `${nombre} (${ladoDicho(lado)})`;
}

function ladoDicho(lado: string): string {
  return lado === 'ambos' ? 'ambos lados' : `lado ${lado}`;
}

/**
 * Lo reconocido acá más lo que aportó el servicio, sin repetir.
 *
 * Un síntoma que reconocieron los dos queda **en la versión del servicio**,
 * que trae la parte y el lado; y en el lugar en que lo puso el texto, para que
 * los chips no salten. Los que sólo vio el servicio van después.
 */
export function combinar(delTexto: readonly Sintoma[], deLaLectura: readonly Sintoma[]): readonly Sintoma[] {
  const lectura = new Map(deLaLectura.map((s) => [s.id, s]));
  const locales = delTexto.map((s) => lectura.get(s.id) ?? s);
  const yaEstan = new Set(locales.map((s) => s.id));
  return [...locales, ...deLaLectura.filter((s) => !yaEstan.has(s.id))];
}
