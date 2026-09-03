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
 * El ícono decorativo de cada renglón (AC-17-2). Del set cerrado de
 * `atoms/nav-icon/`, no uno nuevo: «Recetas y consultas» ya se reconoce en el
 * resto del producto con `note`, «Turnos» con `calendar`, y así.
 */
const ICONOS: Readonly<Record<NotificationCategory, NavIconName>> = {
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

  protected readonly categorias = signal<readonly CategoryPreference[]>([]);
  protected readonly cargando = signal(true);
  protected readonly guardando = signal(false);
  protected readonly error = signal('');
  protected readonly guardado = signal(false);

  /** Ventana de silencio en **hora local**, que es lo que se escribe. */
  protected readonly silencioActivo = signal(false);
  protected readonly desde = signal('22:00');
  protected readonly hasta = signal('07:00');

  /**
   * Lo último que el servidor confirmó. Guardar es todo-o-nada (un solo
   * `PUT`), así que si falla no hay «la mitad se guardó»: se vuelve acá
   * entero — categorías y silencio — y no sólo el campo que se tocó último
   * (AC-17-7). Arranca igual a lo que trae `cargar()`.
   */
  private confirmadas: {
    categorias: readonly CategoryPreference[];
    silencioActivo: boolean;
    desde: string;
    hasta: string;
  } = { categorias: [], silencioActivo: false, desde: '22:00', hasta: '07:00' };

  /** Las categorías ordenadas y con su rótulo legible e ícono. */
  protected readonly filas = computed(() =>
    ORDEN.map((category) => ({
      category,
      ...ROTULOS[category],
      icono: ICONOS[category],
      optedIn:
        this.categorias().find((fila) => fila.category === category)?.optedIn ??
        true,
    })),
  );

  constructor() {
    this.cargar();
  }

  /**
   * El `app-switch` manda su valor nuevo ya resuelto (`checkedChange`): se
   * escribe tal cual, no se invierte el anterior.
   */
  protected alternar(category: NotificationCategory, optedIn: boolean): void {
    if (this.guardando()) {
      // El botón «Guardar» ya bloquea un segundo clic mientras guarda
      // (AC-17-8); esto cubre además que un switch se toque en ese mismo
      // instante y quede un valor que el PUT en vuelo no va a mandar.
      return;
    }
    this.categorias.update((filas) => {
      const existe = filas.some((fila) => fila.category === category);
      return existe
        ? filas.map((fila) => (fila.category === category ? { category, optedIn } : fila))
        : [...filas, { category, optedIn }];
    });
    this.guardado.set(false);
  }

  protected alternarSilencio(activo: boolean): void {
    if (this.guardando()) {
      return;
    }
    this.silencioActivo.set(activo);
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
          // Nada quedó guardado: el switch (y el resto del formulario)
          // vuelve a lo último confirmado, no se queda «encendido de
          // mentira» (AC-17-7).
          this.restaurarConfirmadas();
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
    this.confirmadas = {
      categorias,
      silencioActivo: silencio !== null,
      desde: silencio !== null ? aLocal(silencio.start) : this.desde(),
      hasta: silencio !== null ? aLocal(silencio.end) : this.hasta(),
    };
  }

  private restaurarConfirmadas(): void {
    this.categorias.set(this.confirmadas.categorias);
    this.silencioActivo.set(this.confirmadas.silencioActivo);
    this.desde.set(this.confirmadas.desde);
    this.hasta.set(this.confirmadas.hasta);
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
