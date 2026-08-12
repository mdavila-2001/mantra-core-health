import {
  afterEveryRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

import { BROWSABLE_PROTOCOLS, type LinkVariant } from './link.types';

/**
 * Enlace de texto. Selector de **atributo** sobre el ancla: el host ES el
 * `<a>`, así que el `href`, el `routerLink` y el menú contextual del navegador
 * siguen siendo los nativos.
 *
 * ```html
 * <a app-link href="/pacientes/123">Ver ficha</a>
 * <a app-link routerLink="/schedule" variant="subtle">Agenda del día</a>
 * <a app-link href="https://www.who.int/es">Guía OMS</a>
 * ```
 *
 * Un enlace a otro sitio se detecta solo por el `href` y sale con
 * `target="_blank"` + `rel="noopener noreferrer"` —la pestaña nueva no puede
 * quedarse con una referencia a la sesión clínica— y lo dice en palabras, no
 * solo con el ícono. `external` fuerza la decisión en los dos sentidos.
 *
 * La detección corre en el navegador: bajo SSR el HTML sale sin `target`/`rel`
 * y se completan en la hidratación. Si el enlace tiene que salir marcado ya
 * desde el servidor, pasá `[external]="true"` explícito.
 */
@Component({
  selector: 'a[app-link]',
  templateUrl: './link.html',
  styleUrl: './link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'linkClasses()',
    '[attr.target]': 'isExternal() ? "_blank" : null',
    '[attr.rel]': 'isExternal() ? "noopener noreferrer" : null',
  },
})
export class Link {
  private readonly hostElement = inject<ElementRef<HTMLAnchorElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  readonly variant = input<LinkVariant>('default');

  /** Override manual. Sin valor manda lo que diga el `href`. */
  readonly external = input<boolean | undefined>(undefined);

  private readonly detectedExternal = signal(false);

  readonly isExternal = computed(() => this.external() ?? this.detectedExternal());

  readonly linkClasses = computed(() => `link link--${this.variant()}`);

  constructor() {
    // Un `href` estático ya está en el elemento cuando se construye la
    // directiva: leerlo acá hace que el HTML del servidor SALGA con
    // `target`/`rel`, sin esperar a la hidratación. Es lo que evita la ventana
    // en la que un enlace externo se puede clickear todavía sin `noopener`.
    this.detectedExternal.set(this.pointsToAnotherSite());

    // Los hooks de render no corren en el servidor, así que esto es el guard
    // de plataforma: releer el `href` en cada render cubre el caso de un
    // `[href]` que cambia.
    afterEveryRender(() => this.detectedExternal.set(this.pointsToAnotherSite()));
  }

  /** Absoluto, navegable y de otro origen: los tres, o no es «externo». */
  private pointsToAnotherSite(): boolean {
    const href = this.hostElement.nativeElement.getAttribute('href');
    if (!href) {
      return false;
    }

    const base = this.document.location?.href;
    if (!base) {
      return false;
    }

    try {
      const url = new URL(href, base);
      const protocols: readonly string[] = BROWSABLE_PROTOCOLS;
      return protocols.includes(url.protocol) && url.origin !== new URL(base).origin;
    } catch {
      // Un href que no parsea no es un destino: no se lo marca como externo.
      return false;
    }
  }
}
