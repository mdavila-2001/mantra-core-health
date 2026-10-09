import { Directive, inject, input, TemplateRef } from '@angular/core';

/**
 * Marca la plantilla de un campo que el motor no sabe dibujar.
 *
 * ```html
 * <app-paginated-form [paginas]="paginas()" [form]="form">
 *   <ng-template appCampoPersonalizado="odontograma_fdi">
 *     <app-odontogram [(mapa)]="mapaDental" />
 *   </ng-template>
 * </app-paginated-form>
 * ```
 *
 * Existe para que el motor **no tenga que conocer el dominio**. El odontograma
 * de la ficha clínica es un mapa dental de 32 piezas con su propio estado: no
 * es un control de texto y no cabe en un `@switch` de tipos genéricos. Sin esta
 * vía de escape, la única forma de paginarlo sería meter una rama clínica
 * dentro de un componente compartido — y detrás de esa vendrían todas las
 * demás.
 *
 * El motor le reserva su sitio en la página, con su rótulo y su ayuda; lo que
 * va dentro es cosa de quien lo usa.
 */
@Directive({
  selector: '[appCampoPersonalizado]',
})
export class CampoPersonalizado {
  /** La `key` del campo al que corresponde esta plantilla. */
  readonly key = input.required<string>({ alias: 'appCampoPersonalizado' });

  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}
