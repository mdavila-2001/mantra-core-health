import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  parseVerificationDate,
  toVerificationStatus,
  type VerificationStatus,
} from '@core/verification/verification-status';
import { Tooltip } from '../tooltip/tooltip';
import {
  VERIFICATION_COPY,
  VERIFICATION_SEAL_PATH,
  type VerificationBadgeSize,
  type VerificationBadgeVariant,
} from './verification-badge.types';

/** Un nombre más largo que esto no es un nombre: se corta para no inflar el aria-label. */
const SUBJECT_MAX_LENGTH = 200;

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/**
 * La insignia de verificación de un profesional: el «check azul» de Twitter o
 * Instagram, con la misma gramática.
 *
 * ```html
 * <app-verification-badge [status]="fila.verification.status" size="sm" subject="Dra. Ana Rojas" />
 * <app-verification-badge variant="label" status="IN_REVIEW" />
 * ```
 *
 * - `VERIFIED` → sello azul con tilde blanco. Es el ÚNICO estado que pinta un check.
 * - `IN_REVIEW` → reloj ámbar con borde: «en verificación», inconfundible con el check.
 * - `SUSPENDED` / `EXPIRED` → pictograma neutro SIN check, con su texto.
 * - `UNVERIFIED` o un estado desconocido → nada (sólo la variante `label` dice «No verificado»).
 *
 * **El estado lo decide la API.** Este componente no lo infiere, no lo calcula a
 * partir de fechas y no otorga nada: pintar o no pintar el sello no es
 * seguridad. Para pasar de un DTO a un estado se usa `verificationOf`
 * (`core/verification`).
 *
 * Nunca depende sólo del color: la forma (sello con tilde / reloj / guion), el
 * `aria-label` y el tooltip dicen lo mismo. El tooltip abre con foco y con
 * hover; con `interactive="false"` —dentro de un enlace o un botón, donde no se
 * puede anidar un foco— no hay tabstop y el significado queda en `title`.
 */
@Component({
  selector: 'app-verification-badge',
  imports: [Tooltip],
  templateUrl: './verification-badge.html',
  styleUrl: './verification-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.vb-host--hidden]': '!painted()',
  },
})
export class VerificationBadge {
  /** El estado tal como lo dijo la API. Cualquier valor desconocido se trata como no verificado. */
  readonly status = input<VerificationStatus | string | null | undefined>('UNVERIFIED');
  readonly size = input<VerificationBadgeSize>('md');
  readonly variant = input<VerificationBadgeVariant>('icon');
  /** Fecha de la verificación (ISO o `Date`). Sólo se muestra con `VERIFIED`. */
  readonly verifiedAt = input<Date | string | null | undefined>(null);
  /** Hasta cuándo vale. Se muestra con `VERIFIED` («válida hasta») y con `EXPIRED` («venció el»). */
  readonly validUntil = input<Date | string | null | undefined>(null);
  /** A quién pertenece, para el nombre accesible: «Dra. Ana Rojas, profesional verificado». */
  readonly subject = input<string | null | undefined>(null);
  /** Con foco y tooltip (por omisión). Falso dentro de un enlace o botón. */
  readonly interactive = input<boolean>(true);
  /** Aparición con un leve resorte. Falso por omisión: en una lista de 50 filas distrae. */
  readonly animated = input<boolean>(false);

  protected readonly sealPath = VERIFICATION_SEAL_PATH;

  readonly state = computed<VerificationStatus>(() => toVerificationStatus(this.status()));

  /** `UNVERIFIED` sólo se pinta en la variante con texto. */
  readonly painted = computed(() => this.state() !== 'UNVERIFIED' || this.variant() === 'label');

  readonly copy = computed(() => VERIFICATION_COPY[this.state()]);

  readonly rootClasses = computed(() => {
    const state = this.state().toLowerCase().replace('_', '-');
    const classes = ['vb', `vb--${state}`, `vb--${this.size()}`, `vb--${this.variant()}`];
    if (this.animated()) {
      classes.push('vb--animated');
    }
    return classes.join(' ');
  });

  /** «Profesional verificado», o «Dra. Ana Rojas, profesional verificado» si hay sujeto. */
  readonly ariaLabel = computed(() => {
    const name = this.copy().name;
    const subject = (this.subject() ?? '').trim();
    if (subject === '') {
      return name;
    }
    const clipped =
      subject.length > SUBJECT_MAX_LENGTH ? `${subject.slice(0, SUBJECT_MAX_LENGTH - 1)}…` : subject;
    return `${clipped}, ${name.charAt(0).toLowerCase()}${name.slice(1)}`;
  });

  /** «Verificación realizada el 12 de marzo de 2026», o `null` si no hay fecha real o el estado no la admite. */
  readonly verifiedAtText = computed(() => {
    if (this.state() !== 'VERIFIED') {
      return null;
    }
    const date = parseVerificationDate(this.verifiedAt());
    return date === null ? null : `Verificación realizada el ${this.format(date)}`;
  });

  /** La vigencia, con el verbo que corresponde al estado. */
  readonly validUntilText = computed(() => {
    const state = this.state();
    if (state !== 'VERIFIED' && state !== 'EXPIRED') {
      return null;
    }
    const date = parseVerificationDate(this.validUntil());
    if (date === null) {
      return null;
    }
    return state === 'EXPIRED'
      ? `Venció el ${this.format(date)}`
      : `Vigente hasta el ${this.format(date)}`;
  });

  /** El globo en una sola frase: es lo que muestra el tooltip si no hubiera plantilla. */
  readonly summary = computed(() => {
    const parts = [this.copy().name + '.', this.copy().meaning];
    const verified = this.verifiedAtText();
    const until = this.validUntilText();
    if (verified !== null) {
      parts.push(verified + '.');
    }
    if (until !== null) {
      parts.push(until + '.');
    }
    return parts.join(' ');
  });

  private format(date: Date): string {
    try {
      return new Intl.DateTimeFormat('es', DATE_FORMAT).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }
}
