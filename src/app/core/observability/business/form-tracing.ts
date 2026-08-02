import { inject, Injectable } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { tap, type Observable } from 'rxjs';

import { ATTR, SPAN_NAMES, type UiResult } from '../tracing/tracing.constants';
import { TracingService } from '../tracing/tracing.service';

/**
 * Medir un formulario **sin tocar lo que la persona escribió**.
 *
 * Es la instrumentación con más riesgo de todo el sistema: un formulario de
 * este proyecto contiene contraseñas, códigos de segundo factor, correos y
 * documentos de identidad. La regla no es «tener cuidado al elegir campos»: es
 * que **esta clase no recibe valores**. Recibe el formulario para contar
 * errores, y de ahí solo salen números.
 *
 * ## Qué se puede responder con esto
 *
 * - Cuánto tarda un envío de principio a fin, red incluida.
 * - Cuántos envíos terminan en error de validación del servidor.
 * - Si el formulario que falla es siempre el mismo.
 * - De qué navegación venía el envío, porque el span cuelga de ella.
 *
 * ## Qué no
 *
 * Qué escribió nadie, qué campo falló, si el correo existía. Un atributo que
 * dijera «el campo `email` no es válido» ya empieza a describir a una persona
 * concreta cuando se cruza con la hora y la ruta.
 *
 * ## Cómo se usa
 *
 * ```ts
 * this.formTracing
 *   .traceSubmit('login', 'auth', this.form, () => this.auth.login(credenciales))
 *   .subscribe({ next: …, error: … });
 * ```
 *
 * El `subscribe` no cambia: lo que devuelve es el mismo Observable, envuelto.
 * Si nadie se suscribe, no se abre ningún span — igual que la petición no sale.
 */
@Injectable({ providedIn: 'root' })
export class FormTracing {
  private readonly tracing = inject(TracingService);

  /**
   * @param formName Nombre estable del formulario (`login`, `register-patient`).
   *   Nunca dinámico: es lo que agrupa en Jaeger.
   * @param feature Área a la que pertenece (`auth`, `panel`).
   * @param form El formulario, **solo para contar errores**.
   * @param source Fábrica del Observable del envío. Fábrica y no Observable ya
   *   construido, para que el trabajo empiece al suscribirse y no antes.
   */
  traceSubmit<T>(
    formName: string,
    feature: string,
    form: AbstractControl,
    source: () => Observable<T>,
  ): Observable<T> {
    const errorCount = countInvalidControls(form);

    return this.tracing.traceObservable(
      SPAN_NAMES.formSubmit,
      {
        [ATTR.formName]: formName,
        [ATTR.feature]: feature,
        [ATTR.action]: 'submit',
        /**
         * Cuántos controles estaban inválidos **al enviar**. Un número, no una
         * lista de nombres: saber que fallaron tres campos sirve para detectar
         * un formulario que la gente no consigue completar; saber cuáles empieza
         * a describir a quien lo estaba rellenando.
         */
        [ATTR.validationErrorCount]: errorCount,
        'validation.success': errorCount === 0,
      },
      (span) =>
        /**
         * Solo hay que anotar los dos finales que `traceObservable` no conoce.
         * El tercero —`cancelled`, cuando alguien se da de baja sin que el
         * envío termine— ya lo pone él en su `finalize`, y volver a escribirlo
         * acá sería duplicar la misma decisión en dos sitios.
         */
        source().pipe(
          tap({
            complete: () => span.setAttribute(ATTR.result, SUCCESS),
            error: () => span.setAttribute(ATTR.result, FAILED),
          }),
        ),
    );
  }
}

const SUCCESS: UiResult = 'success';
const FAILED: UiResult = 'error';

/**
 * Cuántos controles hoja están inválidos.
 *
 * Se recorren los hijos en vez de mirar `form.invalid` porque ese booleano solo
 * dice que algo falla. El número distingue «se le olvidó un campo» de «no
 * consiguió completar el formulario», que son dos problemas distintos de la
 * pantalla.
 */
export function countInvalidControls(control: AbstractControl): number {
  const children = childrenOf(control);

  if (children.length === 0) {
    return control.invalid ? 1 : 0;
  }

  return children.reduce((total, child) => total + countInvalidControls(child), 0);
}

/** Los hijos de un `FormGroup` o `FormArray`; vacío para un `FormControl`. */
function childrenOf(control: AbstractControl): AbstractControl[] {
  const container = control as { controls?: unknown };
  const controls = container.controls;

  if (Array.isArray(controls)) {
    return controls as AbstractControl[];
  }
  if (typeof controls === 'object' && controls !== null) {
    return Object.values(controls as Record<string, AbstractControl>);
  }
  return [];
}
