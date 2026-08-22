import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import {
  channelIsConfigured,
  channelTypeLabel,
  NOTIFICATION_CATEGORY,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CHANNEL_TYPE,
} from '../../core/data-access/notifications/notification-concepts';
import { NotificationsClient } from '../../core/data-access/notifications/notifications.client';
import type {
  MyInAppNotification,
  NotificationChannel,
  NotificationPreference,
} from '../../core/data-access/notifications/notifications.types';
import { AnnounceOnAppear } from '../../shared/a11y/announce-on-appear';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { Switch } from '../../shared/components/atoms/switch/switch';

/** Una fila de categoría, tal como la pinta el panel de preferencias. */
interface CategoryRow {
  readonly categoryConceptId: string;
  readonly label: string;
  readonly optedIn: boolean;
}

/** Una fila de canal externo, con si está realmente configurado en este entorno. */
interface ChannelRow {
  readonly channel: NotificationChannel;
  readonly label: string;
  readonly configured: boolean;
  readonly optedIn: boolean;
}

/**
 * «Notificaciones»: mi bandeja y mis preferencias.
 *
 * ## Para qué sirve esta pantalla
 *
 * Acá el doctor ve las notificaciones que el sistema ya le generó — nuevas
 * solicitudes, cambios de cita, alertas contables — y configura por qué canal
 * y para qué categoría quiere recibir cada una. Las alertas críticas de
 * seguridad y las de citas confirmadas **no** se pueden desactivar acá: llegan
 * siempre, sin importar la preferencia (no tienen fila de categoría propia:
 * viajan sin categoría o con una no-promocional, que nunca se suprime por
 * preferencia).
 *
 * ## Ejemplo
 *
 * Si registrás un gasto en Contabilidad, esta pantalla es donde aparece la
 * confirmación («Registraste un gasto: Insumos (80.00)»), y donde podés
 * desactivar el aviso de esa categoría si no lo querés más.
 *
 * ## Qué funciona hoy en este entorno
 *
 * La notificación **interna** (esta bandeja) es real: se guarda y se puede
 * consultar. WhatsApp, SMS y push se pueden dejar configurados como
 * preferencia, pero **ningún proveedor externo está conectado todavía** —
 * activarlos no hace que llegue nada por ese canal; el correo sí tiene un
 * proveedor real detrás. Esta pantalla lo marca explícitamente en vez de
 * simular un envío que no ocurre.
 */
@Component({
  selector: 'app-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AnnounceOnAppear, Alert, Card, DatePipe, EmptyState, PageHeader, Switch],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications {
  private readonly client = inject(NotificationsClient);

  private readonly canales = toSignal(
    this.client.listChannels().pipe(catchError(() => of<readonly NotificationChannel[]>([]))),
    { initialValue: undefined },
  );

  /**
   * Escrito a mano (no `toSignal` puro): tras guardar una preferencia hay que
   * releerlas, y `toSignal` de una única suscripción no ofrece forma de
   * volver a disparar la petición sin un signal de "intento" adicional.
   */
  private readonly preferencias = signal<readonly NotificationPreference[] | undefined>(
    undefined,
  );

  protected readonly bandeja = toSignal(
    this.client.listMyInApp(50).pipe(catchError(() => of<readonly MyInAppNotification[]>([]))),
    { initialValue: undefined },
  );

  protected readonly cargando = computed(
    () => this.canales() === undefined || this.preferencias() === undefined,
  );

  protected readonly canalInternoId = computed(
    () =>
      this.canales()?.find((c) => c.channelTypeConceptId === NOTIFICATION_CHANNEL_TYPE.IN_APP)
        ?.id,
  );

  /** Categorías conocidas, con su preferencia sobre el canal interno (el único que entrega hoy). */
  protected readonly categorias = computed<readonly CategoryRow[]>(() => {
    const prefs = this.preferencias() ?? [];
    const canalInterno = this.canalInternoId();
    return Object.values(NOTIFICATION_CATEGORY).map((categoryConceptId) => {
      const pref = prefs.find(
        (p) => p.channelId === canalInterno && p.categoryConceptId === categoryConceptId,
      );
      return {
        categoryConceptId,
        label: NOTIFICATION_CATEGORY_LABELS[categoryConceptId] ?? categoryConceptId,
        // Sin preferencia guardada, el backend no suprime nada: el default real
        // es "recibir". El toggle refleja ese default, no un valor inventado.
        optedIn: pref?.optedIn ?? true,
      };
    });
  });

  /** Los demás canales (correo, WhatsApp, SMS, push), con si están realmente conectados. */
  protected readonly otrosCanales = computed<readonly ChannelRow[]>(() => {
    const prefs = this.preferencias() ?? [];
    return (this.canales() ?? [])
      .filter((c) => c.channelTypeConceptId !== NOTIFICATION_CHANNEL_TYPE.IN_APP)
      .map((channel) => {
        const pref = prefs.find((p) => p.channelId === channel.id && !p.categoryConceptId);
        return {
          channel,
          label: channelTypeLabel(channel.channelTypeConceptId),
          configured: channelIsConfigured(channel.channelTypeConceptId),
          optedIn: pref?.optedIn ?? true,
        };
      });
  });

  protected readonly guardandoId = signal<string | null>(null);

  constructor() {
    this.client.getMyPreferences().subscribe((items) => this.preferencias.set(items));
  }

  protected toggleCategoria(fila: CategoryRow, optedIn: boolean): void {
    const channelId = this.canalInternoId();
    if (channelId === undefined) return;
    this.guardar(`${channelId}:${fila.categoryConceptId}`, {
      channelId,
      categoryConceptId: fila.categoryConceptId,
      optedIn,
    });
  }

  protected toggleCanal(fila: ChannelRow, optedIn: boolean): void {
    this.guardar(fila.channel.id, { channelId: fila.channel.id, optedIn });
  }

  private guardar(
    key: string,
    input: { channelId: string; categoryConceptId?: string; optedIn: boolean },
  ): void {
    this.guardandoId.set(key);
    this.client.setPreference(input).subscribe({
      next: () => {
        this.guardandoId.set(null);
        this.client.getMyPreferences().subscribe((items) => this.preferencias.set(items));
      },
      error: () => this.guardandoId.set(null),
    });
  }
}
