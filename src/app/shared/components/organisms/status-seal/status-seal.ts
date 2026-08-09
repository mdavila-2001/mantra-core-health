import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { NeutralTone, Tone } from '../../tone/tone.types';
import { UNKNOWN_STATUS_VARIANT, type StatusSealVariant } from './status-seal.types';

/**
 * El estado del trámite en tono, forma y texto: el mapa único variante → tono.
 * `pending` e `in-review` comparten el ámbar de advertencia —el trámite espera
 * a alguien— y se distinguen por la forma del ícono, que también porta
 * significado.
 */
const VARIANT_TONES: Readonly<Record<StatusSealVariant, Tone | NeutralTone>> = Object.freeze({
  pending: 'warning',
  'in-review': 'warning',
  approved: 'success',
  rejected: 'error',
  expired: 'info',
  unknown: 'neutral',
});

/**
 * Sello de estado de un trámite: el veredicto de un caso de verificación, una
 * solicitud, una autorización.
 *
 * ```html
 * <app-status-seal variant="approved" label="Aprobado">
 *   Emitido el 12/07/2026.
 * </app-status-seal>
 * ```
 *
 * `label` es obligatorio: el color y la forma acompañan, nunca portan solos el
 * significado. El contenido proyectado es el detalle opcional (fechas, guía).
 *
 * **Sin `role` ni región viva a propósito**: es un sello estático — la pantalla
 * que lo monta ya anuncia con `appAnuncio`. El nombre accesible es el contenido
 * visible.
 */
@Component({
  selector: 'app-status-seal',
  imports: [],
  templateUrl: './status-seal.html',
  styleUrl: './status-seal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'sealClasses()',
  },
})
export class StatusSeal {
  readonly variant = input<StatusSealVariant>(UNKNOWN_STATUS_VARIANT);

  /** El estado en palabras. Siempre presente: el tono solo lo colorea. */
  readonly label = input.required<string>();

  readonly sealClasses = computed(() => {
    // el color no lo pone el sello: lo resuelve `tone.css`, como en Badge y Chip.
    // Fuera del union tipado (interop sin tipos), degrada a neutro como el ícono.
    const tone: Tone | NeutralTone | undefined = VARIANT_TONES[this.variant()];
    return `status-seal tone--${tone ?? 'neutral'}`;
  });
}
