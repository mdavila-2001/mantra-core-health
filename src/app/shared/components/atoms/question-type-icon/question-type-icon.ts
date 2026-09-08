import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { AnswerType } from '@core/data-access/surveys/surveys.types';

/**
 * El ícono del tipo de respuesta de una pregunta.
 *
 * ```html
 * <app-question-type-icon [tipo]="pregunta.answerType" />
 * ```
 *
 * ## Por qué un set propio y no `NavIconName`
 *
 * Por lo mismo que las especialidades: el set del nav responde «¿qué sección es
 * esta?» y no tiene con qué distinguir una escala de una elección múltiple —les
 * tocaría `survey` a las cinco, que es repetir el mismo dibujo cinco veces en
 * la misma pantalla, justo lo que la regla del set prohíbe—.
 *
 * Son cinco y son cerrados: los cinco de `AnswerType`. No hay `default` que
 * dibuje un genérico porque no hay un sexto tipo posible — si el contrato suma
 * uno, TypeScript señala este archivo, que es exactamente lo que tiene que
 * pasar.
 *
 * ## Cada dibujo es el control con el que se responde
 *
 * No son símbolos abstractos: son el propio control en miniatura —los renglones
 * de un texto, los puntos de una escala, el círculo marcado de una elección
 * simple, las casillas de una múltiple—. Es lo que hace que se reconozcan sin
 * leer la etiqueta de al lado, que es lo único que un ícono aporta.
 *
 * Siempre `aria-hidden`: el tipo va escrito al lado en todas las pantallas que
 * lo usan.
 */
@Component({
  selector: 'app-question-type-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'icono-tipo-pregunta',
    'aria-hidden': 'true',
  },
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }

    svg {
      width: 100%;
      height: 100%;
    }
  `,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @switch (tipo()) {
        @case ('TEXT') {
          <!-- Tres renglones escritos y el cuarto a medias: un texto libre.
               La caja alrededor es lo que lo separa de una lista. -->
          <rect x="3" y="5" width="18" height="14" rx="2.2" />
          <path d="M6.6 9.6h10.8M6.6 12.6h10.8M6.6 15.6h5.4" />
        }
        @case ('SCALE') {
          <!-- Una regla con sus muescas y el punto elegido: una escala se
               responde señalando un lugar entre dos extremos. -->
          <path d="M3.4 15.4h17.2" />
          <path d="M6.2 15.4v-3M12 15.4v-4.6M17.8 15.4v-3" />
          <circle cx="12" cy="8.4" r="2.2" />
        }
        @case ('BOOLEAN') {
          <!-- Un interruptor: dos posiciones y nada en el medio. -->
          <rect x="2.6" y="7.6" width="18.8" height="8.8" rx="4.4" />
          <circle cx="16.6" cy="12" r="2.6" fill="currentColor" stroke="none" />
        }
        @case ('SINGLE_CHOICE') {
          <!-- Dos radios, el de arriba marcado: se elige uno y sólo uno. -->
          <circle cx="6.4" cy="8" r="2.8" />
          <circle cx="6.4" cy="8" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="6.4" cy="16" r="2.8" />
          <path d="M12 8h8M12 16h8" />
        }
        @case ('MULTIPLE_CHOICE') {
          <!-- Dos casillas, la de arriba con su tilde: se eligen varias. -->
          <rect x="3.6" y="5.2" width="5.6" height="5.6" rx="1.4" />
          <path d="m4.9 8 1.3 1.3 2.2-2.4" />
          <rect x="3.6" y="13.2" width="5.6" height="5.6" rx="1.4" />
          <path d="M12 8h8M12 16h8" />
        }
      }
    </svg>
  `,
})
export class QuestionTypeIcon {
  readonly tipo = input.required<AnswerType>();
}
