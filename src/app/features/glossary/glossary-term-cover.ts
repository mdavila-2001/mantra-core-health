import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { GlossaryCategoryIcon } from './glossary-category-icon';

/**
 * Sistema del cuerpo cuyo pictograma se dibuja en la portada. Sólo los que
 * tienen dibujo propio: el resto cae al ícono de la categoría, que existe para
 * todas.
 */
export type GlossarySystemPictogram = 'respiratory' | 'cardiovascular' | 'renal' | 'musculoskeletal';

/** De la etiqueta clínica del término (`glossary-tag-…`) a su pictograma. */
const PICTOGRAM_OF_TAG: Readonly<Record<string, GlossarySystemPictogram>> = {
  'glossary-tag-respiratory': 'respiratory',
  'glossary-tag-cardiovascular': 'cardiovascular',
  'glossary-tag-renal': 'renal',
  'glossary-tag-urologic': 'renal',
  'glossary-tag-musculoskeletal': 'musculoskeletal',
};

/** El pictograma de la primera etiqueta que tiene uno, o `null`. */
export function pictogramOfTags(tags: readonly { readonly internalCode: string }[]): GlossarySystemPictogram | null {
  for (const tag of tags) {
    const pictograma = PICTOGRAM_OF_TAG[tag.internalCode];
    if (pictograma !== undefined) return pictograma;
  }
  return null;
}

/**
 * La portada de un término que no tiene foto.
 *
 * Una foto médica sólo se muestra con su autor y su licencia verificados, y la
 * mayoría de los términos no la tienen. En vez de un recuadro vacío con un
 * ícono suelto, la portada dibuja el sistema del cuerpo del término (pulmones,
 * corazón…) o, si no hay, el ícono de su categoría, sobre un fondo del tema.
 * Es una ilustración y se dice que lo es: nunca imita una foto.
 *
 * Es decorativa (`aria-hidden`): el nombre de la categoría y las etiquetas ya
 * están escritos al lado, y repetirlos al lector de pantalla sería ruido.
 */
@Component({
  selector: 'app-glossary-term-cover',
  imports: [GlossaryCategoryIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      display: block;
    }

    .portada {
      position: relative;
      display: grid;
      place-items: center;
      aspect-ratio: 4 / 3;
      min-block-size: 9rem;
      overflow: hidden;
      border: 1px solid var(--border-default);
      border-radius: var(--r-lg);
      background:
        radial-gradient(
          circle at 50% 46%,
          color-mix(in srgb, var(--brand-secondary) 30%, transparent) 0,
          transparent 62%
        ),
        linear-gradient(
          145deg,
          color-mix(in srgb, var(--brand-primary) 10%, var(--bg-surface)),
          color-mix(in srgb, var(--brand-secondary) 16%, var(--bg-surface))
        );
      color: var(--brand-primary);
    }

    /* Dos anillos concéntricos detrás del dibujo: le dan profundidad sin meter
       una imagen. */
    .portada::before,
    .portada::after {
      content: '';
      position: absolute;
      inset-block-start: 46%;
      inset-inline-start: 50%;
      translate: -50% -50%;
      border: 1px solid color-mix(in srgb, var(--brand-primary) 18%, transparent);
      border-radius: 50%;
    }

    .portada::before {
      inline-size: 62%;
      aspect-ratio: 1;
    }

    .portada::after {
      inline-size: 86%;
      aspect-ratio: 1;
      border-color: color-mix(in srgb, var(--brand-primary) 10%, transparent);
    }

    .portada__dibujo {
      position: relative;
      z-index: 1;
      inline-size: 38%;
      min-inline-size: 4.5rem;
      max-inline-size: 7rem;
      aspect-ratio: 1;
    }

    .portada__dibujo svg {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }

    .portada__nota {
      position: absolute;
      inset-block-end: var(--sp-2);
      inset-inline: var(--sp-2);
      z-index: 1;
      text-align: center;
      color: var(--text-muted);
      font-size: var(--fs-overline);
    }
  `,
  template: `
    <div class="portada">
      <span class="portada__dibujo">
        @switch (pictograma()) {
          @case ('respiratory') {
            <!-- Pulmones y tráquea. -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 3v8M12 11l-3 2M12 11l3 2" />
              <path d="M9 8.5C6.5 8.5 4.2 12.5 3.6 16.6c-.3 2.1.9 3.4 2.8 3.2 1.7-.2 2.6-1.4 2.6-3.2V9.4Z" />
              <path d="M15 8.5c2.5 0 4.8 4 5.4 8.1.3 2.1-.9 3.4-2.8 3.2-1.7-.2-2.6-1.4-2.6-3.2V9.4Z" />
            </svg>
          }
          @case ('cardiovascular') {
            <!-- Corazón con pulso. -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20.5 4.2 12.6a4.7 4.7 0 0 1 6.6-6.7l1.2 1.1 1.2-1.1a4.7 4.7 0 0 1 6.6 6.7Z" />
              <path d="M7 12.2h2.6l1.3-2.6 2.2 5.2 1.4-2.6H17" />
            </svg>
          }
          @case ('renal') {
            <!-- Los dos riñones. -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8.5 4C5.8 4 4 7.5 4 12s1.8 8 4.5 8c1.8 0 2.5-1.6 2-3-.4-1.1-1.3-1.6-1.3-3.1S10.1 11 10.5 9.9c.5-1.4-.2-5.9-2-5.9Z" />
              <path d="M15.5 4C18.2 4 20 7.5 20 12s-1.8 8-4.5 8c-1.8 0-2.5-1.6-2-3 .4-1.1 1.3-1.6 1.3-3.1S13.9 11 13.5 9.9c-.5-1.4.2-5.9 2-5.9Z" />
            </svg>
          }
          @case ('musculoskeletal') {
            <!-- Hueso largo. -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">
              <g transform="rotate(-45 12 12)">
                <path d="M6.65 10.8H17.35A2.2 2.2 0 1 1 20.32 12 2.2 2.2 0 1 1 17.35 13.2H6.65A2.2 2.2 0 1 1 3.68 12 2.2 2.2 0 1 1 6.65 10.8Z" />
              </g>
            </svg>
          }
          @default {
            <app-glossary-category-icon [category]="category()" />
          }
        }
      </span>
      <span class="portada__nota">Ilustración de referencia</span>
    </div>
  `,
})
export class GlossaryTermCover {
  /** El `internalCode` de la categoría del término: el ícono de respaldo. */
  readonly category = input<string>('');
  /** El pictograma del sistema del cuerpo, si el término tiene uno. */
  readonly system = input<GlossarySystemPictogram | null>(null);

  protected readonly pictograma = computed(() => this.system());
}
