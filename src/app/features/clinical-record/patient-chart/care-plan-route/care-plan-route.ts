import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';

/** Un paso del plan tal como lo sostiene el formulario. */
export interface PasoDelPlan {
  readonly clave: number;
  readonly detalle: string;
  readonly cuando: Date | null;
}

/** Un hito de la pista: un paso con algo escrito, ya numerado. */
interface HitoDeLaRuta {
  readonly clave: number;
  readonly numero: number;
  readonly detalle: string;
  readonly cuando: Date | null;
}

/** En qué punto está el plan, para la insignia de la cabecera. */
export type EstadoDelPlan =
  | { readonly tipo: 'listo' }
  | { readonly tipo: 'faltan'; readonly cuantos: number }
  | { readonly tipo: 'vigencia' };

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Cuánto dura la vigencia, en la unidad con la que se habla en la consulta:
 * días hasta dos semanas, semanas hasta dos meses y meses de ahí en más.
 */
export function duracionEnPalabras(desde: Date, hasta: Date): string {
  const dias = Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA);
  if (dias < 1) return 'el mismo día';
  if (dias < 14) return dias === 1 ? '1 día' : `${dias} días`;
  if (dias < 60) return `${Math.round(dias / 7)} semanas`;
  const meses = Math.round(dias / 30.44);
  return meses === 1 ? '1 mes' : `${meses} meses`;
}

/**
 * **Hoja de ruta** de un plan de cuidados — el plan dibujado.
 *
 * ```html
 * <app-care-plan-route [meta]="m" [motivo]="r" [desde]="d" [hasta]="h" [pasos]="p" [estado]="e" />
 * ```
 *
 * Del inicio a la meta, con cada paso en su lugar en el tiempo. Es sólo
 * lectura: proyecta lo que hay en el formulario de alta y no tiene controles,
 * así que vive aparte de él y se prueba sola.
 *
 * A lo ancho la pista corre en horizontal; en un modal angosto o un teléfono,
 * en vertical, porque cuatro hitos de 120 px no entran en 340 y una pista con
 * desplazamiento lateral esconde justo la meta.
 */
@Component({
  selector: 'app-care-plan-route',
  imports: [DatePipe, NavIcon],
  templateUrl: './care-plan-route.html',
  styleUrl: './care-plan-route.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarePlanRoute {
  readonly meta = input('');
  /** El porqué en palabras: la etiqueta del diagnóstico o el motivo escrito. */
  readonly motivo = input('');
  readonly desde = input<Date | null>(null);
  readonly hasta = input<Date | null>(null);
  readonly pasos = input<readonly PasoDelPlan[]>([]);
  readonly estado = input.required<EstadoDelPlan>();

  /**
   * Los hitos, en el orden en que van a ocurrir.
   *
   * Los fechados primero y por fecha; los sin fecha al final, en el orden en
   * que se escribieron: un paso sin día no tiene lugar en el tiempo, pero sigue
   * siendo parte del camino. El número es el del formulario, para que «Paso 2»
   * diga lo mismo arriba y abajo. Un paso vacío no es un hito.
   */
  protected readonly hitos = computed<readonly HitoDeLaRuta[]>(() =>
    this.pasos()
      .map((paso, indice) => ({ ...paso, numero: indice + 1, detalle: paso.detalle.trim() }))
      .filter((hito) => hito.detalle !== '')
      .sort((a, b) => {
        if (a.cuando === null || b.cuando === null) {
          if (a.cuando === b.cuando) return a.numero - b.numero;
          return a.cuando === null ? 1 : -1;
        }
        return a.cuando.getTime() - b.cuando.getTime() || a.numero - b.numero;
      }),
  );

  /** La vigencia en palabras, cuando hay inicio y fin y el fin no es anterior. */
  protected readonly duracion = computed<string | null>(() => {
    const desde = this.desde();
    const hasta = this.hasta();
    return desde === null || hasta === null || hasta < desde
      ? null
      : duracionEnPalabras(desde, hasta);
  });

  /** La insignia de la cabecera: lo que falta, o que el plan ya se puede abrir. */
  protected readonly insignia = computed(() => {
    const estado = this.estado();
    switch (estado.tipo) {
      case 'listo':
        return 'Lista para abrir';
      case 'vigencia':
        return 'Revisar la vigencia';
      case 'faltan':
        return estado.cuantos === 1
          ? 'Falta 1 dato obligatorio'
          : `Faltan ${estado.cuantos} datos obligatorios`;
    }
  });

  protected readonly metaEscrita = computed(() => this.meta().trim());
}
