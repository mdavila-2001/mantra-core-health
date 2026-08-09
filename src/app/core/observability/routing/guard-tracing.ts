import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';

import { ATTR, SPAN_NAMES, type GuardResult } from '../tracing/tracing.constants';
import { TracingService } from '../tracing/tracing.service';
import { routeTemplate } from './route-template';

/**
 * Envuelve un guard para medirlo, sin cambiar lo que decide.
 *
 * ## Por qué no se deduce de los eventos del Router
 *
 * `GuardsCheckStart` y `GuardsCheckEnd` dan la duración de **la fase entera** y
 * un booleano. No dicen qué guard decidió, ni si dejó pasar o desvió: los dos
 * casos llegan como `shouldActivate: false`. Con un solo guard en la aplicación
 * la diferencia parece menor; con tres, «algo bloqueó la navegación» deja de
 * ser una respuesta.
 *
 * Envolver el guard sí lo sabe: conoce su nombre y ve el valor devuelto.
 *
 * ## Lo que se registra, y lo que no
 *
 * El nombre del guard, el resultado en una de cuatro palabras y la plantilla de
 * la ruta. **Nada del motivo.** Ni el token, ni los claims, ni los roles, ni si
 * la sesión existía: un atributo que dijera «sin sesión» frente a «rol
 * insuficiente» describe el estado de autenticación de una persona concreta en
 * un sistema de salud, y eso no es un dato de rendimiento.
 *
 * `denied` y `redirected` bastan para lo que la telemetría tiene que responder:
 * si un guard está bloqueando navegaciones, y cuánto tarda en decidirlo.
 */
export function tracedGuard(name: string, guard: CanActivateFn): CanActivateFn {
  return (route, state) => {
    const tracing = inject(TracingService);
    const router = inject(Router);

    return tracing.runInSpan(
      SPAN_NAMES.guardEvaluate,
      {
        [ATTR.guardName]: name,
        'angular.guard.type': 'canActivate',
        [ATTR.routeTemplate]: routeTemplate(router, state.url),
      },
      (span) => {
        const decision = guard(route, state);

        /**
         * Se admite el retorno síncrono porque es lo que este proyecto usa: el
         * guard decide con el token ya decodificado en memoria, sin red — es la
         * razón por la que S1 y S2 son estados distintos en el contrato del
         * M34. Un guard asíncrono no rompería nada, pero su resultado quedaría
         * sin clasificar, así que se marca aparte en vez de fingir que se sabe.
         */
        span.setAttribute(ATTR.guardResult, classify(decision));

        return decision;
      },
    );
  };
}

/**
 * De lo que el guard devolvió a una de cuatro palabras.
 *
 * La lista es cerrada —`GUARD_RESULTS` en `tracing.constants.ts`— porque el
 * propósito es contar: «cuántas navegaciones bloqueó este guard esta semana»
 * solo se puede responder si «denied» se escribe siempre igual.
 */
function classify(decision: unknown): GuardResult | 'pending' {
  if (decision === true) return 'allowed';
  if (decision === false) return 'denied';
  if (isUrlTree(decision)) return 'redirected';

  /**
   * Una promesa o un Observable. No se suscribe para averiguarlo: suscribirse
   * a lo que devuelve un guard lo ejecutaría dos veces. El Router ya lo hará, y
   * la telemetría no puede permitirse tener efectos.
   */
  return 'pending';
}

function isUrlTree(value: unknown): value is UrlTree {
  return typeof value === 'object' && value !== null && 'root' in value && 'queryParams' in value;
}
