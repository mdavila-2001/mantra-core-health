import { Directive } from '@angular/core';

import { FORM_CONTROL_CONTEXT } from './form-control.context';

/**
 * Corta el contexto de `app-form-field` para los controles de adentro.
 *
 * Un control que vive DENTRO de otro control (la hora y los minutos del
 * calendario) heredaba el campo del de afuera: su `id` —duplicado— y su rótulo
 * como título del modal. Sobre el elemento que los envuelve, quedan sueltos y
 * se nombran con su propio `ariaLabel`.
 */
@Directive({
  selector: '[appNoFieldContext]',
  standalone: true,
  providers: [{ provide: FORM_CONTROL_CONTEXT, useValue: null }],
})
export class NoFieldContext {}
