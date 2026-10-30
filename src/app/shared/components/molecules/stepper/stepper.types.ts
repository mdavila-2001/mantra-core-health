/* ============================================================================
    Contratos del Stepper — indicador de avance por fases.

    El componente es **controlado**: no infiere el estado de cada paso, lo
    recibe ya resuelto. Quien lo use decide qué está hecho, qué se está
    haciendo y qué falta, porque esa lógica —qué fase persistió contra su API—
    vive en la pantalla, no en un indicador visual.

    Eso vale también para el modo interactivo: el stepper avisa qué paso se
    pidió, y es la pantalla la que decide si se puede ir. Un indicador que
    navegara solo se saltaría la validación de quien lo monta.
    ========================================================================== */

import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/** Los tres estados de un paso. Sin ámbar: no es el punto de acción. */
export const STEP_STATUSES = ['complete', 'current', 'upcoming'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

/** Un paso del recorrido: su rótulo y en qué estado está. */
export interface StepperStep {
  readonly label: string;
  readonly status: StepStatus;

  /**
   * El glifo del paso, del set cerrado del nav.
   *
   * Opcional y sin defecto, por la misma regla que rige el set: se declara
   * cuando **dice algo que el rótulo no dice ya**. Un recorrido de tres fases
   * genéricas no gana nada con tres dibujos; uno de cinco —identidad, contacto,
   * domicilio, trabajo, seguro— se reconoce de un vistazo.
   *
   * No reemplaza al ordinal como seña de estado: el paso completado sigue
   * mostrando su ✓ y el pendiente su marcador punteado, porque el estado no se
   * puede distinguir sólo por color ni sólo por dibujo.
   */
  readonly icon?: NavIconName;

  /**
   * El paso no se puede abrir todavía.
   *
   * Sólo tiene efecto en modo interactivo. El control queda con
   * `aria-disabled` —no con el atributo nativo— para que siga siendo
   * alcanzable con el teclado: un paso que desaparece del recorrido no explica
   * por qué no se puede ir, y «por qué no» es justo lo que hay que decir.
   */
  readonly disabled?: boolean;

  /**
   * Por qué no se puede abrir, en castellano y de cara a la persona.
   *
   * Viaja al lector de pantalla junto al estado del paso. Sin esto, un control
   * deshabilitado es una puerta cerrada sin cartel.
   */
  readonly disabledReason?: string;
}

/**
 * Dónde va quien recorre los pasos, en tanto por ciento **del recorrido**:
 * 0 % sobre el primer marcador y 100 % sobre el último.
 *
 * Es la **única** definición de «cuánto avanzó» que tiene el sistema para un
 * recorrido por fases. El stepper la dibuja con sus marcadores y su riel (el
 * riel se llena hasta el marcador actual, ni un tramo más), y quien monta
 * además una barra de progreso —`app-paginated-form`— la deriva de esta misma
 * lista en vez de calcularla desde otro número: así las dos cosas no se pueden
 * separar, que es lo que pasaba cuando la barra contaba «páginas terminadas
 * sobre el total» y el stepper «posición sobre los tramos».
 *
 * - Un solo paso (o ninguno): 0 %, no hay recorrido que medir.
 * - Con paso actual: `posición / (pasos − 1)`, redondeado.
 * - Sin paso actual: 100 % si todos están completados, 0 % si no.
 *
 * Por qué sobre `pasos − 1` y no sobre `pasos`: el riel une marcadores, y
 * entre N marcadores hay N − 1 tramos. Medir sobre N dejaba al último paso en
 * (N − 1)/N: una barra que nunca llegaba al final del riel.
 */
export function porcentajeDelRecorrido(steps: readonly StepperStep[]): number {
  if (steps.length < 2) {
    return 0;
  }
  const actual = steps.findIndex((step) => step.status === 'current');
  if (actual === -1) {
    return steps.every((step) => step.status === 'complete') ? 100 : 0;
  }
  return Math.round((actual / (steps.length - 1)) * 100);
}
