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
import { Alert } from '../../../shared/components/molecules/alert/alert';

/**
 * Cómo se llama cada categoría **en lenguaje llano**.
 *
 * No se muestran los nombres del contrato (`CLINICAL`, `SCHEDULING`): son
 * vocabulario del sistema. Quien configura sus avisos razona en «recetas y
 * consultas», no en categorías de un enum.
 */
const ROTULOS: Readonly<
  Record<NotificationCategory, { titulo: string; detalle: string }>
> = {
  CLINICAL: {
    titulo: 'Recetas y consultas',
    detalle:
      'Cuando tu médico emite una receta o cierra una consulta tuya.',
  },
  SCHEDULING: {
    titulo: 'Turnos',
    detalle:
      'Recordatorios, cambios de cita, demoras y cupos que se liberan.',
  },
  MESSAGES: {
    titulo: 'Chats',
    detalle: 'Cuando alguien te escribe por la mensajería.',
  },
  SOCIAL: {
    titulo: 'Actividad social',
    detalle: 'Reacciones, comentarios y seguidores en tus publicaciones.',
  },
};

/** El orden en que se muestran: lo clínico primero, lo social último. */
const ORDEN: readonly NotificationCategory[] = [
  'CLINICAL',
  'SCHEDULING',
  'MESSAGES',
  'SOCIAL',
];

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
  imports: [Alert, AppButton, FormsModule],
  templateUrl: './notification-preferences.html',
  styleUrl: './notification-preferences.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPreferences {
  private readonly notifications = inject(NotificationsClient);
  private readonly store = inject(NotificationsStore);

  protected readonly categorias = signal<readonly CategoryPreference[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  protected readonly guardado = signal(false);

  /** Ventana de silencio en **hora local**, que es lo que se escribe. */
  protected readonly silencioActivo = signal(false);
  protected readonly desde = signal('22:00');
  protected readonly hasta = signal('07:00');

  /** Las categorías ordenadas y con su rótulo legible. */
  protected readonly filas = computed(() =>
    ORDEN.map((category) => ({
      category,
      ...ROTULOS[category],
      optedIn:
        this.categorias().find((fila) => fila.category === category)?.optedIn ??
        true,
    })),
  );

  constructor() {
    this.cargar();
  }

  protected alternar(category: NotificationCategory): void {
    this.categorias.update((filas) => {
      const existe = filas.some((fila) => fila.category === category);
      return existe
        ? filas.map((fila) =>
            fila.category === category
              ? { category, optedIn: !fila.optedIn }
              : fila,
          )
        : [...filas, { category, optedIn: false }];
    });
    this.guardado.set(false);
  }

  protected alternarSilencio(): void {
    this.silencioActivo.set(!this.silencioActivo());
    this.guardado.set(false);
  }

  protected guardar(): void {
    this.guardando.set(true);
    this.error.set('');

    this.notifications
      .updatePreferences({
        categories: this.categorias(),
        quietHours: this.silencioActivo()
          ? {
              start: aUtc(this.desde()),
              end: aUtc(this.hasta()),
            }
          : null,
      })
      .subscribe({
        next: (preferencias) => {
          this.aplicar(preferencias.categories, preferencias.quietHours);
          this.guardando.set(false);
          this.guardado.set(true);
          // La campana lee del store: si no se le avisa, seguiría contando
          // avisos de una categoría que la persona acaba de silenciar.
          this.store.refrescar();
        },
        error: () => {
          this.guardando.set(false);
          this.error.set('No pudimos guardar tus preferencias.');
        },
      });
  }

  private cargar(): void {
    this.notifications.readPreferences().subscribe({
      next: (preferencias) => {
        this.aplicar(preferencias.categories, preferencias.quietHours);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No pudimos cargar tus preferencias.');
      },
    });
  }

  private aplicar(
    categorias: readonly CategoryPreference[],
    silencio: QuietHours | null,
  ): void {
    this.categorias.set(categorias);
    this.silencioActivo.set(silencio !== null);
    if (silencio !== null) {
      this.desde.set(aLocal(silencio.start));
      this.hasta.set(aLocal(silencio.end));
    }
  }
}

/**
 * De hora local a UTC, conservando sólo `HH:mm`.
 *
 * Se apoya en una fecha real —hoy— y no en aritmética de offsets, para que el
 * huso que aplique sea el que el navegador dice que rige, no uno calculado a
 * mano que se equivoca con las medias horas (India, Terranova).
 */
function aUtc(horaLocal: string): string {
  const [horas, minutos] = horaLocal.split(':').map(Number);
  const fecha = new Date();
  fecha.setHours(horas, minutos, 0, 0);
  return `${dos(fecha.getUTCHours())}:${dos(fecha.getUTCMinutes())}`;
}

/** De UTC a hora local, el camino de vuelta. */
function aLocal(horaUtc: string): string {
  const [horas, minutos] = horaUtc.split(':').map(Number);
  const fecha = new Date();
  fecha.setUTCHours(horas, minutos, 0, 0);
  return `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

/** Dos dígitos, que es lo que un `<input type="time">` acepta. */
function dos(valor: number): string {
  return String(valor).padStart(2, '0');
}
