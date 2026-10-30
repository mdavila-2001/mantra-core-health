import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { ViewState } from '../../core/view-state/view-state.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../core/view-state/view-state';

import { NotificationsClient } from '../../core/data-access/notifications/notifications.client';
import type { InAppNotification } from '../../core/data-access/notifications/notifications.types';
import { rutaDeNotificacion } from '../../core/notifications/notification-routes';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../shared/components/molecules/card/card';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { NotificationActions } from '../../shared/components/molecules/notification-actions/notification-actions';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  agruparPorDia,
  horaRelativa,
  iconoDeCategoria,
  nombreDeCategoria,
  type DiaDeAvisos,
} from './notification-presentation';

/** Cuántas trae cada página. */
const PAGE_SIZE = 25;

/** Índice de la pestaña «Sin leer»: la única que consulta la API con `unread=true`. */
const UNREAD_TAB = 1;

/**
 * El centro de notificaciones — carril P1.
 *
 * ## Por qué es una pantalla y no un panel más grande
 *
 * Porque tiene URL. Un desplegable no se puede compartir, no se puede dejar
 * abierto en una pestaña y no tiene dónde poner un filtro. La campana es para
 * enterarse; esto es para revisar.
 *
 * ## «Ver más» y no «página 3 de 47»
 *
 * El contrato no da totales: trae `count` de esta página y `nextCursor`.
 * Contar el total obligaría a recorrer la bandeja entera.
 */
@Component({
  selector: 'app-notification-center',
  // `AppButtonLink` es el que hace de `<a app-button>` un botón: sin él, el
  // ancla de «Preferencias» quedaba sin variante ni talle —texto suelto, sin
  // el contorno de `outline`— y medía distinto que el botón de al lado.
  imports: [
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    EmptyState,
    NavIcon,
    NgTemplateOutlet,
    NotificationActions,
    PageHeader,
    RouterLink,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './notification-center.html',
  styleUrl: './notification-center.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationCenter {
  private readonly notifications = inject(NotificationsClient);
  private readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);

  protected readonly avisos = signal<readonly InAppNotification[]>([]);
  protected readonly cargando = signal(false);
  protected readonly errorState = signal<ViewState<readonly InAppNotification[]> | null>(null);
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargoAlgunaVez = signal(false);
  protected readonly sinLeer = signal(0);

  /** Todas las pestañas conservan el cursor; sólo «Sin leer» usa el filtro API. */
  protected readonly pestana = signal(0);
  protected readonly soloSinLeer = computed(() => this.pestana() === UNREAD_TAB);

  protected readonly avisosFiltrados = computed(() => {
    const tab = this.pestana();
    return this.avisos().filter((aviso) => {
      if (tab === UNREAD_TAB) return aviso.unread;
      if (tab === 2)
        return aviso.category === 'CLINICAL' && aviso.destination?.type !== 'PRESCRIPTION';
      if (tab === 3) return aviso.category === 'MESSAGES';
      if (tab === 4) return aviso.destination?.type === 'PRESCRIPTION';
      if (tab === 5) return aviso.category === 'SOCIAL' || aviso.destination?.type === 'POST';
      return true;
    });
  });

  /**
   * El reloj con el que se dicen los «hace 2 h».
   *
   * Se fija al cargar y no en cada render: un `Date.now()` dentro de la
   * plantilla haría que la lista se repinte sola y que dos filas del mismo
   * segundo digan cosas distintas.
   */
  protected readonly ahora = signal(new Date());

  /** Los avisos repartidos por día, en el orden en que llegaron. */
  protected readonly grupos = computed<readonly DiaDeAvisos[]>(() =>
    agruparPorDia(this.avisosFiltrados(), this.ahora()),
  );

  protected readonly estado = computed<ViewState<readonly InAppNotification[]>>(() => {
    const fallo = this.errorState();
    if (fallo) return fallo;
    if (!this.cargoAlgunaVez()) return loading();
    const visibles = this.avisosFiltrados();
    if (visibles.length === 0 && !this.hayMas()) {
      return empty({ label: 'Ir a preferencias', route: '/settings' }, this.descripcionVacio());
    }
    return ready(visibles);
  });

  /**
   * El título del vacío conserva los textos de siempre para «Todas» y «Sin
   * leer» (los comprueba `playwright/carril-35-notification-center.spec.ts`);
   * las pestañas de categoría dicen que no hay avisos de esa familia.
   */
  protected readonly tituloVacio = computed(() => {
    const tab = this.pestana();
    if (tab === 0) return 'Todavía no tiene notificaciones';
    if (tab === UNREAD_TAB) return 'No tiene notificaciones sin leer';
    return 'No tiene avisos en esta categoría';
  });
  protected readonly descripcionVacio = computed(() =>
    this.pestana() === 0 || this.pestana() === UNREAD_TAB
      ? 'Acá van a aparecer los avisos de sus recetas, sus consultas, sus citas y sus mensajes.'
      : 'Cuando llegue uno de esta categoría, lo va a ver acá.',
  );
  protected readonly hayFiltrosSinResultados = computed(
    () => this.avisosFiltrados().length === 0 && this.hayMas(),
  );

  protected readonly iconoDeCategoria = iconoDeCategoria;
  protected readonly nombreDeCategoria = nombreDeCategoria;

  protected horaDe(aviso: InAppNotification): string {
    return horaRelativa(aviso.availableAt, this.ahora());
  }

  /**
   * Cambia de pestaña: es el mismo filtro de antes, con otra forma.
   *
   * «Sin leer» es la única que pide otra consulta a la API (`unread=true`), así
   * que entrar **o salir** de ella vuelve a cargar desde cero. Si sólo se
   * recargara al entrar, al volver a «Todas» (o a una categoría) la lista
   * seguiría siendo la de las sin leer y las leídas desaparecerían.
   */
  protected elegirPestana(indice: number): void {
    const anterior = this.pestana();
    if (indice === anterior) return;
    this.pestana.set(indice);
    if (indice === UNREAD_TAB || anterior === UNREAD_TAB) this.recargar();
  }

  protected readonly hayMas = computed(() => this.cursor() !== null);

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.ahora.set(new Date());
    this.avisos.set([]);
    this.cursor.set(null);
    this.cargoAlgunaVez.set(false);
    this.errorState.set(null);
    this.cargar();
  }

  protected verMas(): void {
    this.cargar();
  }

  /** La ruta de un aviso, o `null` si no navega a ninguna. */
  protected rutaDe(aviso: InAppNotification): string | null {
    return rutaDeNotificacion(aviso.destination);
  }

  /**
   * Abre un aviso: lo marca leído y navega si tiene destino.
   *
   * Se actualiza la fila en memoria además de refrescar el store, para que la
   * lista no parpadee: sin eso, marcar una notificación de la mitad de la
   * página la dejaría en negrita hasta la próxima carga completa.
   */
  protected abrir(aviso: InAppNotification): void {
    const ruta = this.rutaDe(aviso);
    this.marcarLeida(aviso);
    if (ruta) {
      void this.router.navigateByUrl(ruta);
    }
  }

  /**
   * Marca un aviso como leído sin navegar.
   *
   * Es lo único que se puede hacer con un aviso **sin destino**: no es un
   * control —un enlace que no lleva a ningún lado se lee como producto roto—,
   * y sin este botón la única salida para sacarlo de «sin leer» era «Marcar
   * todas», que se lleva puestas las demás.
   */
  protected marcarLeida(aviso: InAppNotification): void {
    if (aviso.unread) {
      this.notifications.markRead(aviso.id).subscribe({
        next: () => {
          this.avisos.update((lista) =>
            lista.map((item) =>
              item.id === aviso.id ? { ...item, unread: false } : item,
            ),
          );
          this.sinLeer.update((total) => Math.max(0, total - 1));
          // El badge del header lee del store: si no se le avisa, la campana
          // seguiría contando una notificación que la persona ya abrió.
          this.store.refrescar();
        },
        error: (error: unknown) =>
          this.errorState.set(errorToViewState<readonly InAppNotification[]>(error)),
      });
    }
  }

  /**
   * Una acción de la notificación terminó: se da por leída, se relee la bandeja
   * y se avisa a la campana. Se recarga la lista entera y no la fila, porque
   * quien decidió por una solicitud ya no debe ver sus botones.
   */
  protected alEjecutarAccion(aviso: InAppNotification): void {
    const cerrar = (): void => {
      this.store.refrescar();
      this.recargar();
    };
    if (!aviso.unread) {
      cerrar();
      return;
    }
    this.notifications.markRead(aviso.id).subscribe({ next: cerrar, error: cerrar });
  }

  protected marcarTodas(): void {
    this.notifications.markAllRead().subscribe({
      next: () => {
        this.store.refrescar();
        this.recargar();
      },
      error: (error: unknown) =>
        this.errorState.set(errorToViewState<readonly InAppNotification[]>(error)),
    });
  }

  private cargar(): void {
    if (this.cargando()) {
      return;
    }
    this.cargando.set(true);
    this.errorState.set(null);

    const cursor = this.cursor();
    this.notifications
      .listMine({
        limit: PAGE_SIZE,
        ...(this.soloSinLeer() ? { unread: true } : {}),
        ...(cursor === null ? {} : { cursor }),
      })
      .subscribe({
        next: (pagina) => {
          this.avisos.update((lista) => [...lista, ...pagina.items]);
          this.cursor.set(pagina.nextCursor);
          this.sinLeer.set(pagina.unreadCount);
          this.cargoAlgunaVez.set(true);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.cargando.set(false);
          this.cargoAlgunaVez.set(true);
          this.errorState.set(errorToViewState<readonly InAppNotification[]>(error));
        },
      });
  }
}
