import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NotificationsClient } from '../../../core/data-access/notifications/notifications.client';
import type {
  CategoryPreference,
  NotificationCategory,
  QuietHours,
} from '../../../core/data-access/notifications/notifications.types';
import { NotificationsStore } from '../../../core/notifications/notifications.store';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';

/**
 * Cómo se llama cada categoría **en lenguaje llano**.
 *
 * No se muestran los nombres del contrato (`CLINICAL`, `SCHEDULING`): son
 * vocabulario del sistema. Quien configura sus avisos razona en «recetas y
 * consultas», no en categorías de un enum.
 */
const LABELS: Readonly<
  Record<NotificationCategory, { title: string; detail: string }>
> = {
  CLINICAL: {
    title: 'Recetas y consultas',
    detail:
      'Cuando tu médico emite una receta o cierra una consulta tuya.',
  },
  SCHEDULING: {
    title: 'Turnos',
    detail:
      'Recordatorios, cambios de cita, demoras y cupos que se liberan.',
  },
  MESSAGES: {
    title: 'Chats',
    detail: 'Cuando alguien te escribe por la mensajería.',
  },
  SOCIAL: {
    title: 'Actividad social',
    detail: 'Reacciones, comentarios y seguidores en tus publicaciones.',
  },
};

/** El orden en que se muestran: lo clínico primero, lo social último. */
const ORDER: readonly NotificationCategory[] = [
  'CLINICAL',
  'SCHEDULING',
  'MESSAGES',
  'SOCIAL',
];

/**
 * El ícono decorativo de cada renglón (AC-17-2). Del set cerrado de
 * `atoms/nav-icon/`, no uno nuevo: «Recetas y consultas» ya se reconoce en el
 * resto del producto con `note`, «Turnos» con `calendar`, y así.
 */
const ICONS: Readonly<Record<NotificationCategory, NavIconName>> = {
  CLINICAL: 'note',
  SCHEDULING: 'calendar',
  MESSAGES: 'chat',
  SOCIAL: 'people',
};

/**
 * Preferencias de notificación — carril P9.
 *
 * ## La hora se escribe en local y se guarda en UTC
 *
 * El backend compara la ventana de silencio contra `getUTCHours()`. Nadie
 * piensa su noche en UTC, así que la pantalla convierte: lo que se escribe es
 * hora local y lo que viaja es UTC, y al leer se hace el camino inverso.
 *
 * Es en el cliente porque **el modelo no guarda el huso horario de nadie**.
 * Tiene un límite conocido y declarado en el reporte: si la persona cambia de
 * huso —o entra el horario de verano— la ventana queda corrida y hay que
 * volver a guardarla. Guardar la hora local sin el huso sería peor: el
 * servidor la aplicaría como UTC y el silencio caería en cualquier momento.
 *
 * ## Silenciar aplaza, no borra
 *
 * Lo dice la pantalla, porque es lo que hace: una notificación que cae en la
 * ventana **existe** y aparece cuando la ventana termina. Prometer «no te
 * molesto» y perder un aviso serían dos cosas distintas.
 */
@Component({
  selector: 'app-notification-preferences',
  imports: [Alert, AppButton, FormsModule, NavIcon, Switch],
  templateUrl: './notification-preferences.html',
  styleUrl: './notification-preferences.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPreferences {
  private readonly notifications = inject(NotificationsClient);
  private readonly store = inject(NotificationsStore);

  protected readonly categories = signal<readonly CategoryPreference[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly saved = signal(false);

  /** Ventana de silencio en **hora local**, que es lo que se escribe. */
  protected readonly quietHoursEnabled = signal(false);
  protected readonly from = signal('22:00');
  protected readonly to = signal('07:00');

  /**
   * Lo último que el servidor confirmó. Guardar es todo-o-nada (un solo
   * `PUT`), así que si falla no hay «la mitad se guardó»: se vuelve acá
   * entero — categorías y silencio — y no sólo el campo que se tocó último
   * (AC-17-7). Arranca igual a lo que trae `load()`.
   */
  private confirmed: {
    categories: readonly CategoryPreference[];
    quietHoursEnabled: boolean;
    from: string;
    to: string;
  } = { categories: [], quietHoursEnabled: false, from: '22:00', to: '07:00' };

  /** Las categorías ordenadas y con su rótulo legible e ícono. */
  protected readonly rows = computed(() =>
    ORDER.map((category) => ({
      category,
      ...LABELS[category],
      icon: ICONS[category],
      optedIn:
        this.categories().find((row) => row.category === category)?.optedIn ??
        true,
    })),
  );

  constructor() {
    this.load();
  }

  /**
   * El `app-switch` manda su valor nuevo ya resuelto (`checkedChange`): se
   * escribe tal cual, no se invierte el anterior.
   */
  protected toggle(category: NotificationCategory, optedIn: boolean): void {
    if (this.saving()) {
      // El botón «Guardar» ya bloquea un segundo clic mientras guarda
      // (AC-17-8); esto cubre además que un switch se toque en ese mismo
      // instante y quede un valor que el PUT en vuelo no va a mandar.
      return;
    }
    this.categories.update((rows) => {
      const exists = rows.some((row) => row.category === category);
      return exists
        ? rows.map((row) => (row.category === category ? { category, optedIn } : row))
        : [...rows, { category, optedIn }];
    });
    this.saved.set(false);
  }

  protected toggleQuietHours(enabled: boolean): void {
    if (this.saving()) {
      return;
    }
    this.quietHoursEnabled.set(enabled);
    this.saved.set(false);
  }

  protected save(): void {
    this.saving.set(true);
    this.error.set('');

    this.notifications
      .updatePreferences({
        categories: this.categories(),
        quietHours: this.quietHoursEnabled()
          ? {
              start: toUtc(this.from()),
              end: toUtc(this.to()),
            }
          : null,
      })
      .subscribe({
        next: (preferences) => {
          this.apply(preferences.categories, preferences.quietHours);
          this.saving.set(false);
          this.saved.set(true);
          // La campana lee del store: si no se le avisa, seguiría contando
          // avisos de una categoría que la persona acaba de silenciar.
          this.store.refrescar();
        },
        error: () => {
          // Nada quedó guardado: el switch (y el resto del formulario)
          // vuelve a lo último confirmado, no se queda «encendido de
          // mentira» (AC-17-7).
          this.restoreConfirmed();
          this.saving.set(false);
          this.error.set('No pudimos guardar tus preferencias.');
        },
      });
  }

  private load(): void {
    this.notifications.readPreferences().subscribe({
      next: (preferences) => {
        this.apply(preferences.categories, preferences.quietHours);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No pudimos cargar tus preferencias.');
      },
    });
  }

  private apply(
    categories: readonly CategoryPreference[],
    quietHours: QuietHours | null,
  ): void {
    this.categories.set(categories);
    this.quietHoursEnabled.set(quietHours !== null);
    if (quietHours !== null) {
      this.from.set(toLocal(quietHours.start));
      this.to.set(toLocal(quietHours.end));
    }
    this.confirmed = {
      categories,
      quietHoursEnabled: quietHours !== null,
      from: quietHours !== null ? toLocal(quietHours.start) : this.from(),
      to: quietHours !== null ? toLocal(quietHours.end) : this.to(),
    };
  }

  private restoreConfirmed(): void {
    this.categories.set(this.confirmed.categories);
    this.quietHoursEnabled.set(this.confirmed.quietHoursEnabled);
    this.from.set(this.confirmed.from);
    this.to.set(this.confirmed.to);
  }
}

/**
 * De hora local a UTC, conservando sólo `HH:mm`.
 *
 * Se apoya en una fecha real —hoy— y no en aritmética de offsets, para que el
 * huso que aplique sea el que el navegador dice que rige, no uno calculado a
 * mano que se equivoca con las medias horas (India, Terranova).
 */
function toUtc(localTime: string): string {
  const [hours, minutes] = localTime.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return `${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())}`;
}

/** De UTC a hora local, el camino de vuelta. */
function toLocal(utcTime: string): string {
  const [hours, minutes] = utcTime.split(':').map(Number);
  const date = new Date();
  date.setUTCHours(hours, minutes, 0, 0);
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** Dos dígitos, que es lo que un `<input type="time">` acepta. */
function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}
