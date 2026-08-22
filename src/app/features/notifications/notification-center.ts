import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';

import { NotificationsClient } from '../../core/data-access/notifications/notifications.client';
import type { InAppNotification } from '../../core/data-access/notifications/notifications.types';
import { rutaDeNotificacion } from '../../core/notifications/notification-routes';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/** Cuántas trae cada página. */
const PAGE_SIZE = 25;

/**
 * El centro de notificaciones — carril P1.
 *
 * ## Por qué es una pantalla y no un panel más grande
 *
 * Porque tiene URL. Un desplegable no se puede compartir, no se puede dejar
 * abierto en una pestaña y no tiene dónde poner un filtro. La campana es para
 * enterarse; esto es para revisar.
 *
 * ## Sólo la bandeja del módulo 35
 *
 * La campana fusiona `messaging` y `community`, pero el centro pagina, y
 * paginar dos fuentes con cursores distintos y ordenarlas por fecha sin un
 * cursor común produce huecos: la página 2 de una fuente puede traer algo más
 * nuevo que la página 1 de la otra. Se pagina lo que tiene el orden — lo
 * clínico, la agenda y los mensajes, que es lo que la gente viene a buscar — y
 * lo social se ve en su muro. Queda anotado en el reporte como el precio de no
 * unificar backends esta semana.
 *
 * ## «Ver más» y no «página 3 de 47»
 *
 * El contrato no da totales: trae `count` de esta página y `nextCursor`.
 * Contar el total obligaría a recorrer la bandeja entera.
 */
@Component({
  selector: 'app-notification-center',
  imports: [Alert, AppButton, DatePipe, EmptyState, PageHeader],
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
  protected readonly error = signal('');
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargoAlgunaVez = signal(false);
  protected readonly sinLeer = signal(0);

  /** Si se muestran sólo las no leídas. */
  protected readonly soloSinLeer = signal(false);

  protected readonly hayMas = computed(() => this.cursor() !== null);
  protected readonly vacio = computed(
    () => this.cargoAlgunaVez() && this.avisos().length === 0,
  );

  constructor() {
    this.cargar();
  }

  /** Alterna el filtro y vuelve a empezar: el cursor viejo es de otra consulta. */
  protected alternarFiltro(): void {
    this.soloSinLeer.set(!this.soloSinLeer());
    this.recargar();
  }

  protected recargar(): void {
    this.avisos.set([]);
    this.cursor.set(null);
    this.cargoAlgunaVez.set(false);
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
        error: () => this.error.set('No pudimos marcar la notificación.'),
      });
    }
    if (ruta) {
      void this.router.navigateByUrl(ruta);
    }
  }

  protected marcarTodas(): void {
    this.notifications.markAllRead().subscribe({
      next: () => {
        this.store.refrescar();
        this.recargar();
      },
      error: () => this.error.set('No pudimos marcar tus notificaciones.'),
    });
  }

  private cargar(): void {
    if (this.cargando()) {
      return;
    }
    this.cargando.set(true);
    this.error.set('');

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
        error: () => {
          this.cargando.set(false);
          this.cargoAlgunaVez.set(true);
          this.error.set('No pudimos cargar tus notificaciones.');
        },
      });
  }
}
