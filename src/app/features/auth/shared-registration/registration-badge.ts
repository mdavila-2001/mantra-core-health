import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

import { AccountIcon } from '../../../shared/components/atoms/account-icon/account-icon';
import type { AccountIconName } from '../../../shared/components/atoms/account-icon/account-icon.types';

/** Un destello de la celebración: hacia dónde sale y de qué color. */
interface Spark {
  readonly x: string;
  readonly y: string;
  readonly color: string;
}

/**
 * Ocho destellos repartidos cada 45° sobre un radio de 3,2 rem. Los vectores
 * van calculados acá y no con `cos()`/`sin()` de CSS: así la composición no
 * depende de que el navegador soporte funciones trigonométricas, y cada
 * destello es un par de números que se pueden leer.
 */
const SPARKS: readonly Spark[] = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
  const angle = (i * Math.PI) / 4 - Math.PI / 2;
  const radius = 3.2;
  const colors = ['--c-aqua-400', '--c-mint-400', '--c-petrol-400', '--c-sage-400'];
  return {
    x: `${(Math.cos(angle) * radius).toFixed(2)}rem`,
    y: `${(Math.sin(angle) * radius).toFixed(2)}rem`,
    color: `var(${colors[i % colors.length]})`,
  };
});

/**
 * La insignia del alta: el ícono animado del tipo de cuenta que se está
 * creando, en un azulejo, a la izquierda del título.
 *
 * ## Por qué existe
 *
 * Las seis altas abrían con un título y nada más: «Crear cuenta de paciente» y
 * «Registre su farmacia» eran la misma página con otro texto. La insignia le da
 * a cada tipo su cara —la del ícono que se eligió un paso antes— y mantiene el
 * hilo entre la tarjeta que se pulsó y el formulario que se abrió.
 *
 * ## Dos estados
 *
 * - **Reposo** (`celebrate = false`): el azulejo con el ícono, que se dibuja al
 *   nacer como en la rejilla.
 * - **Celebración** (`celebrate = true`): el alta terminó. El azulejo crece, se
 *   asienta con un rebote, se dibuja una marca de verificación y salen ocho
 *   destellos que se desvanecen. Una sola vez; no hay bucle.
 *
 * Es decorativa entera (`aria-hidden`): lo que se anuncia es el título de la
 * confirmación, que ya trae `appAnuncio`, y no hay nada que un lector pueda
 * hacer con un dibujo. «Reducir movimiento» deja la composición terminada y
 * sin destellos.
 */
@Component({
  selector: 'app-registration-badge',
  imports: [AccountIcon],
  template: `
    <span class="badge" [class.badge--celebrate]="celebrate()" aria-hidden="true">
      <app-account-icon class="badge__icon" [name]="type()" />
      @if (celebrate()) {
        <svg
          class="badge__check"
          viewBox="0 0 24 24"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          focusable="false"
        >
          <circle class="badge__check-disc" cx="12" cy="12" r="11" />
          <path class="badge__check-mark" pathLength="1" d="M7 12.6l3.2 3.2L17 8.9" />
        </svg>
        @for (spark of sparks; track $index) {
          <span
            class="badge__spark"
            [style.--x]="spark.x"
            [style.--y]="spark.y"
            [style.--c]="spark.color"
            [style.--n]="$index"
          ></span>
        }
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .badge {
      position: relative;
      display: grid;
      place-items: center;
      inline-size: 3.25rem;
      block-size: 3.25rem;
      border: 1px solid color-mix(in srgb, var(--brand-primary) 28%, var(--border-default));
      border-radius: var(--r-xl);
      background: color-mix(in srgb, var(--brand-primary) 9%, var(--bg-surface));
      color: var(--brand-primary);
    }

    .badge__icon {
      inline-size: 1.75rem;
      block-size: 1.75rem;
    }

    /* ---- Celebración ------------------------------------------------------ */
    .badge--celebrate {
      inline-size: 4.5rem;
      block-size: 4.5rem;
      animation: badge-pop 620ms var(--ease-spring) both;
    }

    .badge--celebrate .badge__icon {
      inline-size: 2.5rem;
      block-size: 2.5rem;
    }

    @keyframes badge-pop {
      from {
        transform: scale(0.6);
        opacity: 0;
      }
    }

    /* La marca de verificación, colgada de la esquina del azulejo. */
    .badge__check {
      position: absolute;
      inset-inline-end: -0.45rem;
      inset-block-end: -0.45rem;
      inline-size: 1.6rem;
      block-size: 1.6rem;
      animation: badge-check-in 360ms var(--ease-spring) 420ms both;
    }

    .badge__check-disc {
      fill: var(--st-success-bg);
      stroke: var(--st-success-bd);
      stroke-width: 1.5;
    }

    .badge__check-mark {
      stroke: var(--st-success-fg);
      stroke-width: 2.4;
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      animation: badge-check-draw 380ms var(--ease-out) 620ms forwards;
    }

    @keyframes badge-check-in {
      from {
        transform: scale(0);
      }
    }

    @keyframes badge-check-draw {
      to {
        stroke-dashoffset: 0;
      }
    }

    /* Los destellos salen del centro, se abren y se apagan. Nacen con un
       escalonado corto para que no sea un solo estallido. */
    .badge__spark {
      position: absolute;
      inset-block-start: 50%;
      inset-inline-start: 50%;
      inline-size: 0.5rem;
      block-size: 0.5rem;
      margin: -0.25rem 0 0 -0.25rem;
      border-radius: var(--r-full);
      background: var(--c, currentColor);
      opacity: 0;
      animation: badge-spark 900ms var(--ease-out) calc(300ms + var(--n, 0) * 40ms) both;
    }

    @keyframes badge-spark {
      0% {
        opacity: 0;
        transform: translate(0, 0) scale(0.2);
      }
      25% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translate(var(--x, 0px), var(--y, 0px)) scale(1);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .badge--celebrate,
      .badge__check,
      .badge__check-mark {
        animation: none !important;
      }

      .badge__check-mark {
        stroke-dashoffset: 0;
      }

      .badge__spark {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationBadge {
  /** El tipo de cuenta que se está creando: el mismo ícono de la rejilla. */
  readonly type = input.required<AccountIconName>();

  /** El alta terminó: el azulejo crece, se marca y suelta destellos. */
  readonly celebrate = input(false, { transform: booleanAttribute });

  protected readonly sparks = SPARKS;
}
