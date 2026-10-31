import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';

/** Por qué la API no guardó las reglas de red, en una de pocas categorías que la pantalla sabe explicar. */
export type IpRulesFailureKind = 'LOCK_OUT' | 'CIDR' | 'VALIDITY' | 'FORBIDDEN' | 'OFFLINE' | 'OTHER';

export interface IpRulesFailure {
  readonly kind: IpRulesFailureKind;
  readonly message: string;
}

/**
 * Lee el fallo de `PUT /org/ip-access-rules`. Los tres rechazos de negocio son
 * `422` con `details.reason`; se ramifica por ese código y nunca por el mensaje.
 *
 * - `IP_RULES_WOULD_LOCK_OUT_ACTOR`: el conjunto dejaría fuera la red desde la que
 *   se está guardando. La API **no cambia nada**: nadie se encierra afuera de su
 *   propia organización.
 * - `IP_RULE_CIDR_INVALID`: algún rango no se puede leer.
 * - `IP_RULE_VALIDITY_INVALID`: una regla termina antes de empezar.
 */
export function ipRulesFailureOf(error: unknown): IpRulesFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return { kind: 'OTHER', message: 'No pudimos guardar las redes. Vuelva a intentarlo.' };
  }
  if (error.status === 0) {
    return { kind: 'OFFLINE', message: 'No pudimos conectarnos. Revise su conexión y reintente: no se guardó nada.' };
  }
  const detalles = readApiError(error)?.details;
  switch (detalles?.['reason']) {
    case 'IP_RULES_WOULD_LOCK_OUT_ACTOR':
      return {
        kind: 'LOCK_OUT',
        message:
          'No se guardó nada: con estas reglas usted quedaría fuera de su propia organización. La red desde la que está trabajando ahora no entraría. Agregue una red permitida que la incluya, o quite la regla que la bloquea, y vuelva a guardar.',
      };
    case 'IP_RULE_CIDR_INVALID': {
      const rango = typeof detalles['cidr'] === 'string' ? ` («${detalles['cidr']}»)` : '';
      return {
        kind: 'CIDR',
        message: `No se guardó nada: uno de los rangos${rango} no es válido. Escríbalo con la barra y el número del final, por ejemplo 190.129.0.0/16 o 203.0.113.7/32.`,
      };
    }
    case 'IP_RULE_VALIDITY_INVALID':
      return { kind: 'VALIDITY', message: 'No se guardó nada: una regla termina antes de empezar. La fecha final tiene que ser posterior a la inicial.' };
    default:
      break;
  }
  if (error.status === 403) {
    return { kind: 'FORBIDDEN', message: 'Solo quien administra la seguridad de la organización puede cambiar sus redes.' };
  }
  return { kind: 'OTHER', message: 'No pudimos guardar las redes. Vuelva a intentarlo.' };
}
