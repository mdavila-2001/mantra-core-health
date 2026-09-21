/* ============================================================================
    El menú de preferencias de una publicación (AC-01-15 a AC-01-18).

    ## Por qué es una molécula y no marcado dentro de la tarjeta

    Porque la misma fila de siete opciones tiene que aparecer en la tarjeta del
    feed público, en la vista de una publicación suelta y —cuando llegue— en el
    muro con sesión. Escrita adentro de la tarjeta, la segunda vez se copia; a
    la tercera hay tres listas que ya no dicen lo mismo. Es exactamente lo que
    pasó con las pestañas del buscador, que terminaron copiadas en ocho
    plantillas con ocho listas distintas.

    ## Qué resuelve la molécula y qué delega

    Resuelve sola lo que no depende del dominio: copiar el enlace, compartir,
    navegar a la publicación y al perfil, y **mandar a `/auth` con retorno**
    cuando la entrada exige sesión y no la hay.

    Delega lo que sí depende del dominio —denunciar, dejar de ver, contactar—
    porque el destinatario cambia según la pantalla que la monte, y porque una
    molécula compartida que llame a `community.client` sabría de comunidad.

    ## Las entradas con sesión se ofrecen igual (AC-01-17)

    Sin sesión no se esconden ni se deshabilitan: se activan y llevan a
    `/auth?returnUrl=…`, que devuelve a la publicación después de entrar.
    Esconderlas dejaría a alguien sin sesión sin saber que puede denunciar; y
    dejarlas llamar a la API le devolvería un 401 a la cara.
    ========================================================================== */

import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';

import { Tooltip } from '../../atoms/tooltip/tooltip';
import { Menu } from '../menu/menu';
import { MenuItem } from '../menu/menu-item/menu-item';
import { MenuTrigger } from '../menu/menu-trigger/menu-trigger';
import { ToastService } from '../toast/toast.service';

import {
  POST_PREFERENCE_ENTRIES,
  type PostPreferenceAction,
  type PostPreferenceEntry,
} from './post-preferences-menu.types';

@Component({
  selector: 'app-post-preferences-menu',
  imports: [Menu, MenuItem, MenuTrigger, Tooltip],
  templateUrl: './post-preferences-menu.html',
  styleUrl: './post-preferences-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostPreferencesMenu {
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Ruta de la publicación, en comandos de router: `['/p', slug, …]`. */
  readonly postLink = input.required<readonly unknown[]>();

  /** Ruta del perfil de quien la escribió. */
  readonly profileLink = input.required<readonly unknown[]>();

  /** Cómo nombrar la publicación al compartirla. */
  readonly shareTitle = input<string>('Publicación en AloVida');

  /**
   * Si hay sesión. Lo decide quien monta el menú: la molécula no inyecta el
   * `SessionStore` para no atarse a la capa de autenticación.
   */
  readonly hasSession = input<boolean>(false);

  readonly hideSimilarRequested = output<void>();
  readonly reportRequested = output<void>();
  readonly contactRequested = output<void>();

  protected readonly entries: readonly PostPreferenceEntry[] = POST_PREFERENCE_ENTRIES;

  /**
   * La URL absoluta de la publicación.
   *
   * Absoluta y no relativa porque va al portapapeles y a `navigator.share`: un
   * `/p/dra-lopez/post/42` pegado en un mensaje no abre nada.
   *
   * Bajo SSR no hay `location`, así que devuelve la ruta a secas. No importa:
   * copiar y compartir sólo ocurren con un clic, que sólo existe en el
   * navegador.
   */
  protected postUrl(): string {
    const ruta = this.router.serializeUrl(this.router.createUrlTree([...this.postLink()]));
    if (!this.isBrowser) {
      return ruta;
    }
    return new URL(ruta, this.document.location.origin).toString();
  }

  /**
   * Compartir desde afuera del menú.
   *
   * La fila de acciones de la tarjeta (Recomendar · Comentar · Compartir ·
   * Enviar) ofrece «Compartir» como botón visible, y compartir es lo mismo se
   * toque donde se toque: `navigator.share` si existe, copiar el enlace si no.
   * Se expone el gesto en vez de duplicar la lógica en la tarjeta.
   */
  compartir(): void {
    this.run('share');
  }

  protected activate(entry: PostPreferenceEntry): void {
    if (entry.access === 'session' && !this.hasSession()) {
      void this.goToLogin();
      return;
    }
    this.run(entry.action);
  }

  /**
   * Manda a entrar, con retorno.
   *
   * `returnUrl` es la URL **actual**, no la de la publicación: quien está
   * leyendo el feed y toca «Denunciar» quiere volver al feed donde estaba, no
   * caer en la vista suelta de esa publicación.
   */
  private goToLogin(): Promise<boolean> {
    return this.router.navigate(['/auth'], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  private run(action: PostPreferenceAction): void {
    switch (action) {
      case 'openPost':
        void this.router.navigate([...this.postLink()]);
        return;
      case 'openProfile':
        void this.router.navigate([...this.profileLink()]);
        return;
      case 'copyLink':
        void this.copyLink();
        return;
      case 'share':
        void this.share();
        return;
      case 'hideSimilar':
        this.hideSimilarRequested.emit();
        return;
      case 'report':
        this.reportRequested.emit();
        return;
      case 'contactPractitioner':
        this.contactRequested.emit();
        return;
    }
  }

  /**
   * Copia y **avisa** (AC-01-16): sin el aviso, copiar no produce ningún
   * cambio en pantalla y no hay forma de saber si funcionó.
   *
   * El portapapeles falla por permiso denegado, por contexto inseguro (http) y
   * por navegadores viejos. Cuando falla se dice, en vez de mentir con un
   * «copiado» que no ocurrió.
   */
  private async copyLink(): Promise<void> {
    const url = this.postUrl();
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(url);
      this.toasts.success('Enlace copiado');
    } catch {
      this.toasts.error('No se pudo copiar el enlace. Copialo de la barra de direcciones.');
    }
  }

  /**
   * Comparte con la hoja del sistema si el navegador la tiene, y si no copia.
   *
   * `navigator.share` no existe en escritorio salvo en Safari y Edge, así que
   * el camino de reserva no es un caso raro: es el habitual.
   *
   * Cancelar la hoja de compartir lanza `AbortError`, y eso **no** es un
   * error que mostrar: la persona decidió no compartir.
   */
  private async share(): Promise<void> {
    const url = this.postUrl();
    const compartir = this.document.defaultView?.navigator.share;

    if (typeof compartir !== 'function') {
      await this.copyLink();
      return;
    }

    try {
      await compartir.call(this.document.defaultView?.navigator, {
        title: this.shareTitle(),
        url,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      await this.copyLink();
    }
  }
}
