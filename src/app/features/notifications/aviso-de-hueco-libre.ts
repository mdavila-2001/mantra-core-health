import { DestroyRef, inject, Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationsClient } from '../../core/data-access/notifications/notifications.client';
import type { InAppNotification } from '../../core/data-access/notifications/notifications.types';
import { ToastService } from '@shared/components/molecules/toast/toast.service';

/* ============================================================================
    El aviso de cupo libre, levantado como toast.

    El punto 3.4 del registro de procesos pide que la aplicación **avise** —no
    que el dato esté disponible si alguien abre la campana—: «PUEDES RECIBIR UNA
    NOTIFICACION DE LA APP DONDE TE INFORME QUE UN PACIENTE DESCONFIRMO Y EXISTE
    UN HORARIO DISPONIBLE». Que llegue solo es la mitad del pedido.
    ========================================================================== */

/**
 * Cada cuánto se pregunta si llegó algo.
 *
 * Veinte segundos, y es una elección de **maqueta**: contra la API de verdad
 * esto no se pregunta, se recibe — el módulo 35 ya declara el canal, y el
 * empujón es del servidor. Sondear cada veinte segundos contra un backend real
 * sería multiplicar una consulta por cada pestaña abierta para enterarse tarde
 * igual. Ver `PENDIENTES-BACKEND.md` (P21).
 */
const CADA_MS = 20_000;

/**
 * Cuánto se queda el aviso en pantalla.
 *
 * `null` —fijo hasta que la persona lo cierre— y no los segundos de un toast
 * normal: esto ofrece un turno que alguien más puede tomar mientras tanto. Un
 * aviso que se va solo a los cinco segundos convierte una oportunidad en algo
 * que hay que ver de casualidad.
 */
const NO_SE_VA_SOLO = null;

/** Lo que distingue este aviso de los demás de su categoría. Ver `horario-liberado.ts`. */
const CLASE_DE_AVISO = 'SLOT_RELEASED';

/**
 * Vigila la campana y levanta un toast cuando se libera un horario.
 *
 * ## Por qué está en `features/` y no en `core/mock/`
 *
 * Porque necesita el `ToastService`, que vive en `shared/`, y `core/` no puede
 * importar de `shared/` —la dirección de las capas es `features → shared →
 * core`, y `scripts/check-architecture.mjs` la hace cumplir—. La **regla** de
 * cuándo un cupo queda libre sí es del simulador y vive allá; esto es sólo
 * quien la mira y la muestra.
 *
 * ## Sólo en la maqueta
 *
 * Arranca sólo con `mockBackend`. Contra la API real el aviso llega por el
 * canal del módulo 35 y esta clase no tiene nada que hacer: sondear sería
 * pedirle cada veinte segundos a un servidor que ya sabe cómo empujar.
 */
@Injectable({ providedIn: 'root' })
export class AvisoDeHuecoLibre {
  private readonly auth = inject(AuthService);
  private readonly notificaciones = inject(NotificationsClient);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Los avisos que ya se mostraron.
   *
   * Sin esto, cada vuelta del sondeo volvería a levantar el mismo toast: la
   * notificación sigue sin leer hasta que alguien la abra, así que «no leída»
   * no alcanza como criterio de novedad.
   */
  private readonly yaMostrados = new Set<string>();

  private reloj: ReturnType<typeof setInterval> | null = null;

  /** Empieza a vigilar. Llamarlo dos veces no arranca dos relojes. */
  empezar(): void {
    if (!environment.mockBackend || this.reloj !== null) return;
    this.reloj = setInterval(() => this.mirar(), CADA_MS);
    this.destroyRef.onDestroy(() => this.parar());
    this.mirar();
  }

  parar(): void {
    if (this.reloj === null) return;
    clearInterval(this.reloj);
    this.reloj = null;
  }

  private mirar(): void {
    // Sin sesión no hay campana que mirar: el anunciador vive en el árbol de la
    // aplicación entera, así que también corre en el login y en lo público.
    if (!this.auth.isAuthenticated()) return;
    this.notificaciones.listMine({ unread: true, limit: 20 }).subscribe({
      next: (pagina) => pagina.items.filter(esHuecoLibre).forEach((aviso) => this.mostrar(aviso)),
      // Un sondeo que falla no dice nada: es una comodidad de la maqueta, no
      // una lectura que alguien esté esperando. La campana sigue mostrando lo
      // que haya cuando se la abra.
      error: () => undefined,
    });
  }

  /**
   * Levanta el toast.
   *
   * **Informa, no navega.** El sistema de toasts de este repositorio no lleva
   * acción —`ToastInput` es tono, título, texto y duración— y no se le agrega
   * una para esto: la notificación equivalente ya está en la campana con su
   * `destination`, que es la que sabe abrir el cupo. Dos caminos al mismo lugar,
   * uno de ellos inventado acá, sería la clase de duplicado que esta maqueta ya
   * corrigió en los directorios.
   */
  private mostrar(aviso: InAppNotification): void {
    if (this.yaMostrados.has(aviso.id)) return;
    this.yaMostrados.add(aviso.id);
    this.toasts.show({
      type: 'info',
      title: aviso.subject ?? 'Se liberó un horario',
      message: aviso.bodyText ?? '',
      durationMs: NO_SE_VA_SOLO,
    });
  }
}

/**
 * Si el aviso es de los nuestros.
 *
 * Mira `payloadJson.kind` y no el asunto: el asunto es prosa, se reescribe, y
 * una condición no se cuelga de una frase.
 */
function esHuecoLibre(aviso: InAppNotification): boolean {
  const payload = aviso.payloadJson;
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { kind?: unknown }).kind === CLASE_DE_AVISO
  );
}
