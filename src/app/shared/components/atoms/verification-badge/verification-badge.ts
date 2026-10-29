import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
  input,
  PLATFORM_ID,
  signal,
  viewChild,
  type OnDestroy,
} from '@angular/core';

import {
  effectiveVerificationStatus,
  parseVerificationDate,
  toVerificationStatus,
  type VerificationStatus,
} from '@core/verification/verification-status';
import { nextControlId } from '@shared/forms/form-control.context';
import {
  VERIFICATION_COPY,
  VERIFICATION_GLYPH_STATES,
  VERIFICATION_SEAL_PATH,
  type VerificationBadgeSize,
  type VerificationBadgeVariant,
} from './verification-badge.types';

/** Un nombre más largo que esto no es un nombre: se corta para no inflar el aria-label. */
const SUBJECT_MAX_LENGTH = 200;

/** Espera del puntero antes de abrir: cruzar una fila de nombres no dispara una ráfaga de popovers. */
const HOVER_OPEN_DELAY_MS = 200;

/** Margen para que el puntero viaje del pictograma al popover sin que se cierre (WCAG 1.4.13, «hoverable»). */
const HOVER_CLOSE_DELAY_MS = 180;

const POPOVER_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 8;

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/**
 * La insignia de verificación de un profesional: el sello azul con tilde junto
 * al nombre.
 *
 * ```html
 * <app-verification-badge [status]="fila.verification.status" size="sm" subject="Dra. Ana Rojas" />
 * <app-verification-badge variant="label" status="IN_REVIEW" />
 * ```
 *
 * - `VERIFIED` → sello (escudo propio de AloVida) azul con tilde blanco. Es el
 *   ÚNICO estado que pinta un tilde.
 * - `IN_REVIEW` → reloj ámbar con borde: «en verificación», inconfundible con el sello.
 * - `EXPIRED` → pictograma gris con exclamación y su texto: «verificación vencida».
 * - `SUSPENDED` / `UNVERIFIED` / un estado desconocido → NUNCA un glifo. En la
 *   variante `icon` no se pinta nada; en `label` sólo el texto.
 *
 * **El estado lo decide la API.** Este componente no lo infiere ni otorga nada;
 * la única corrección que se permite es bajar un `VERIFIED` cuya vigencia ya
 * pasó a `EXPIRED` (nunca promueve). Pintar o no pintar no es seguridad.
 *
 * Con `interactive` (por omisión) el pictograma es un botón: abre un popover
 * con foco, hover o clic, que se descarta con Esc, no se cierra al mover el
 * puntero hacia él y no tapa contenido útil (WCAG 1.4.13). Con
 * `interactive="false"` —dentro de un enlace o botón, donde no se anida un
 * foco— no hay tabstop y el significado queda en `title`.
 */
@Component({
  selector: 'app-verification-badge',
  imports: [NgTemplateOutlet],
  templateUrl: './verification-badge.html',
  styleUrl: './verification-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.vb-host--hidden]': '!painted()',
  },
})
export class VerificationBadge implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  /** El estado tal como lo dijo la API. Cualquier valor desconocido se trata como no verificado. */
  readonly status = input<VerificationStatus | string | null | undefined>('UNVERIFIED');
  readonly size = input<VerificationBadgeSize>('md');
  readonly variant = input<VerificationBadgeVariant>('icon');
  /** Fecha de la verificación (ISO o `Date`). Sólo se muestra con `VERIFIED`. */
  readonly verifiedAt = input<Date | string | null | undefined>(null);
  /** Hasta cuándo vale. Se muestra con `VERIFIED` («vigente hasta») y con `EXPIRED` («venció el»). */
  readonly validUntil = input<Date | string | null | undefined>(null);
  /** A quién pertenece, para el nombre accesible: «Dra. Ana Rojas, profesional verificado». */
  readonly subject = input<string | null | undefined>(null);
  /** Botón con popover (por omisión). Falso dentro de un enlace o botón. */
  readonly interactive = input<boolean>(true);
  /** Aparición con un leve resorte. Falso por omisión: en una lista de 50 filas distrae. */
  readonly animated = input<boolean>(false);

  protected readonly sealPath = VERIFICATION_SEAL_PATH;

  protected readonly open = signal(false);
  protected readonly popoverId = nextControlId('vb-popover');
  private readonly popover = viewChild<ElementRef<HTMLElement>>('popover');
  private readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');

  private pointerInside = false;
  private pinned = false;
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  /** Referencia estable: `removeEventListener` necesita la MISMA función. */
  private readonly onDocumentPointerDown = (event: Event): void => {
    if (!this.hostElement.nativeElement.contains(event.target as Node | null)) {
      this.close();
    }
  };
  private readonly closeOnViewportChange = (): void => this.close();

  /** El estado a pintar: el declarado, salvo un VERIFIED con la vigencia ya vencida. */
  readonly state = computed<VerificationStatus>(() =>
    effectiveVerificationStatus(
      toVerificationStatus(this.status()),
      parseVerificationDate(this.validUntil()),
    ),
  );

  /** `icon` pinta sólo los estados con glifo; `label` pinta todos (los sin glifo, sólo texto). */
  readonly painted = computed(
    () => this.variant() === 'label' || this.hasGlyph(),
  );

  readonly hasGlyph = computed(() =>
    (VERIFICATION_GLYPH_STATES as readonly string[]).includes(this.state()),
  );

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

  /** Todo el significado en una frase: es el `title` cuando no hay popover. */
  readonly summary = computed(() => {
    const copy = this.copy();
    const parts = [copy.name + '.', copy.meaning];
    if (copy.limits !== undefined) {
      parts.push(copy.limits);
    }
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

  ngOnDestroy(): void {
    this.clearTimers();
    this.listenToDocument(false);
  }

  /* ---- popover --------------------------------------------------------------
     Se abre con el puntero (tras una espera corta), con el foco y con el clic o
     Enter; se cierra con Esc, al perder el foco, al salir el puntero de
     pictograma Y popover, o con un clic fuera. Un clic lo «fija»: es la forma
     de abrirlo en una pantalla táctil. */

  protected hoverIn(): void {
    this.pointerInside = true;
    this.clearCloseTimer();
    if (this.open() || this.openTimer !== null || !this.isBrowser) {
      return;
    }
    this.openTimer = setTimeout(() => {
      this.openTimer = null;
      this.show();
    }, HOVER_OPEN_DELAY_MS);
  }

  protected hoverOut(): void {
    this.pointerInside = false;
    this.clearOpenTimer();
    this.scheduleClose();
  }

  protected focusIn(): void {
    this.clearCloseTimer();
    this.show();
  }

  protected focusOut(): void {
    if (!this.pinned) {
      this.scheduleClose();
    }
  }

  protected toggle(): void {
    if (this.open() && this.pinned) {
      this.close();
      return;
    }
    this.pinned = true;
    this.show();
  }

  protected close(): void {
    this.clearTimers();
    this.pinned = false;
    this.pointerInside = false;
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    this.listenToDocument(false);
    const popover = this.popover()?.nativeElement;
    if (popover !== undefined) {
      try {
        popover.hidePopover?.();
      } catch {
        /* ya estaba cerrado */
      }
    }
  }

  private show(): void {
    if (!this.isBrowser || this.open() || !this.interactive() || !this.painted()) {
      return;
    }
    this.open.set(true);
    this.listenToDocument(true);
    // El popover existe sólo con `open`: se muestra en la capa superior y se
    // ubica cuando el render lo puso en el DOM.
    afterNextRender(() => this.placePopover(), { injector: this.injector });
  }

  private placePopover(): void {
    const popover = this.popover()?.nativeElement;
    const trigger = this.trigger()?.nativeElement;
    if (popover === undefined || trigger === undefined) {
      return;
    }
    try {
      popover.showPopover?.();
    } catch {
      /* sin Popover API queda como bloque fijo: igual se ubica */
    }
    const view = this.document.defaultView;
    const viewportWidth = view?.innerWidth ?? 0;
    const viewportHeight = view?.innerHeight ?? 0;
    const anchor = trigger.getBoundingClientRect();
    const box = popover.getBoundingClientRect();

    const centered = anchor.left + anchor.width / 2 - box.width / 2;
    const left = Math.max(
      VIEWPORT_MARGIN_PX,
      Math.min(centered, viewportWidth - box.width - VIEWPORT_MARGIN_PX),
    );
    const above = anchor.top - box.height - POPOVER_GAP_PX;
    const top =
      above >= VIEWPORT_MARGIN_PX || anchor.bottom + box.height + POPOVER_GAP_PX > viewportHeight
        ? Math.max(VIEWPORT_MARGIN_PX, above)
        : anchor.bottom + POPOVER_GAP_PX;
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
    popover.dataset['placement'] = top >= anchor.bottom ? 'bottom' : 'top';
  }

  private scheduleClose(): void {
    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      const focused = this.hostElement.nativeElement.contains(this.document.activeElement);
      if (!this.pointerInside && !focused && !this.pinned) {
        this.close();
      }
    }, HOVER_CLOSE_DELAY_MS);
  }

  private listenToDocument(listen: boolean): void {
    const view = this.document.defaultView;
    if (view === null) {
      return;
    }
    if (listen) {
      this.document.addEventListener('pointerdown', this.onDocumentPointerDown, true);
      view.addEventListener('scroll', this.closeOnViewportChange, { passive: true, capture: true });
      view.addEventListener('resize', this.closeOnViewportChange, { passive: true });
      return;
    }
    this.document.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    view.removeEventListener('scroll', this.closeOnViewportChange, { capture: true });
    view.removeEventListener('resize', this.closeOnViewportChange);
  }

  private clearOpenTimer(): void {
    if (this.openTimer !== null) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
  }

  private clearCloseTimer(): void {
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearOpenTimer();
    this.clearCloseTimer();
  }

  private format(date: Date): string {
    try {
      return new Intl.DateTimeFormat('es', DATE_FORMAT).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }
}
