import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import {
  NotificationsStore,
  type AvisoUnificado,
} from '../../../../core/notifications/notifications.store';
import { Badge } from '../../atoms/badge/badge';

/**
 * La campana del header — carril P1.
 *
 * ## Qué hace y qué no
 *
 * Muestra el conteo sin leer y las últimas ocho de las dos bandejas. **No es
 * el centro**: el panel es para enterarse y saltar, y por eso ofrece «ver
 * todas» en vez de paginar acá. Un desplegable con paginación es un centro de
 * notificaciones que nadie puede compartir por enlace.
 *
 * ## Por qué el panel se cierra al navegar
 *
 * Porque tocar una notificación es irse a otra pantalla, y un desplegable que
 * sobrevive a la navegación queda flotando sobre una pantalla que no lo pidió.
 *
 * ## Lo que se marca leído, y lo que no
 *
 * Abrir una notificación del módulo 35 la marca. Las sociales no: `community`
 * no expone esa escritura —lo verificó el relevamiento del carril— y bajar el
 * badge en pantalla sin que el servidor lo sepa haría que el próximo tic lo
 * volviera a subir. Prometer menos y cumplirlo.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [Badge, DatePipe, RouterLink],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBell {
  private readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);

  protected readonly abierto = signal(false);

  protected readonly sinLeer = this.store.sinLeer;
  protected readonly avisos = this.store.avisos;
  protected readonly error = this.store.error;

  /** El badge sólo aparece con algo que contar: un «0» es ruido. */
  protected readonly hayPendientes = computed(() => this.sinLeer() > 0);

  protected readonly etiqueta = computed(() =>
    this.sinLeer() === 0
      ? 'Notificaciones. No tenés ninguna sin leer'
      : `Notificaciones. Tenés ${this.sinLeer()} sin leer`,
  );

  constructor() {
    // El sondeo arranca acá y no en un proveedor de arranque: la campana sólo
    // existe dentro del armazón autenticado, así que montarla es la señal
    // inequívoca de que hay una sesión con interfaz a la que avisarle.
    this.store.iniciar();
  }

  protected alternar(): void {
    const proximo = !this.abierto();
    this.abierto.set(proximo);
    // Al abrir se refresca: quien la abre quiere lo de ahora, no lo del último
    // tic, que puede ser de hace cuarenta segundos.
    if (proximo) {
      this.store.refrescar();
    }
  }

  protected cerrar(): void {
    this.abierto.set(false);
  }

  protected marcarTodas(): void {
    this.store.marcarTodasLeidas();
  }

  /**
   * Abre una notificación: la marca leída y navega si tiene a dónde.
   *
   * Se marca **antes** de navegar y no se espera la respuesta: el badge se
   * corrige en el refresco que dispara `marcarLeida`, y hacer esperar a
   * alguien a que un `POST` vuelva para recién llevarlo a su receta sería
   * cobrarle la contabilidad de la campana.
   */
  protected abrir(aviso: AvisoUnificado): void {
    this.store.marcarLeida(aviso);
    this.cerrar();
    if (aviso.ruta) {
      void this.router.navigateByUrl(aviso.ruta);
    }
  }
}
