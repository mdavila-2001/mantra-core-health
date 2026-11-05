import { InjectionToken, type Signal } from '@angular/core';

/**
 * Lo único que el expediente necesita saber de un bloque de alta: si hay algo
 * escrito que se perdería al cerrar el modal sin guardar.
 *
 * Las siete altas del expediente (`patient-chart.html`) montan un bloque
 * distinto detrás de un único `@switch`, y el modal que las envuelve
 * (`app-content-dialog`) es uno solo. Preguntarle al bloque montado —cualquiera
 * que sea— si tiene un borrador es más simple que espejar el estado en siete
 * banderas del expediente: el bloque ya sabe qué es su borrador (`patient-chart`
 * no puede saberlo sin conocer el dominio de cada uno), y el expediente sólo
 * necesita leerlo.
 *
 * Cada bloque se ofrece con:
 * ```ts
 * providers: [{ provide: DRAFT_BLOCK, useExisting: forwardRef(() => DocumentBlock) }]
 * ```
 * e implementa `DraftBlock` con un `computed` público. El patrón espeja el que
 * ya usa `attachment-uploader.tieneCambiosPendientes()` (que `attachment-dialog`
 * ya consume) — el nombre del miembro es el mismo a propósito.
 */
export interface DraftBlock {
  readonly tieneCambiosPendientes: Signal<boolean>;

  /**
   * Si el borrador **ya dejó algo registrado** (p. ej. el diagnóstico existe y sólo
   * falló la nota), lo que hay que decir al descartar: «Todavía no se registró» sería
   * falso. `null` o ausente: no se registró nada y vale el texto de siempre. Con un
   * mensaje, el anfitrión además **relee** al descartar, porque el servidor ya tiene algo.
   */
  readonly mensajeDeDescarte?: Signal<string | null>;
}

export const DRAFT_BLOCK = new InjectionToken<DraftBlock>('DraftBlock');
