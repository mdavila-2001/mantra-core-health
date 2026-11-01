import { computed, DestroyRef, effect, inject, Injectable, Injector, signal, untracked } from '@angular/core';
import type { Subscription } from 'rxjs';

import { SessionStore } from '../auth/session.store';
import { UiVisibilityClient } from '../data-access/ui-visibility/ui-visibility.client';
import type { MyUiVisibility } from '../data-access/ui-visibility/ui-visibility.types';
import { errorToViewState } from '../http/error-to-view-state';
import {
  dataOf,
  loading,
  m34CodeOf,
  ready,
  routeAuthPending,
  stale,
} from '../view-state/view-state';
import type { M34Code, ViewState, ViewStateStatus } from '../view-state/view-state.types';

/** Estados en los que el servicio **falló y se queda abierto**: no se oculta nada. */
const ESTADOS_DE_FALLO: ReadonlySet<ViewStateStatus> = new Set([
  'offline',
  'error',
  'forbidden',
  'not-found',
  'validation',
]);

/** Lo que el servicio sabe de sí mismo, para pintarlo en un panel de diagnóstico. */
export interface UiVisibilityDiagnostic {
  readonly status: ViewStateStatus;
  /** Código del M34 del estado (`S1`, `S2`, `S9`…), o `null` en el camino feliz. */
  readonly m34: M34Code | null;
  /** `true` si el pedido falló y por eso **no se oculta nada** (la API sigue autorizando). */
  readonly failedOpen: boolean;
  readonly version: string | null;
  readonly generatedAt: string | null;
  readonly hiddenCount: number;
  /** El identificador de la petición fallida (S9), para encontrarla en el servidor. */
  readonly requestId: string | null;
}

/**
 * Qué se le presenta a esta sesión: el motor de visibilidad del front.
 *
 * ## Lo que NO es
 *
 * **No es autorización.** Ocultar un elemento no protege nada: la API autoriza cada petición (RBAC/PDP) y un
 * elemento oculto cuyo endpoint sigue permitido se puede llamar, y eso es correcto. Esto decide qué se *presenta*;
 * nunca concede acceso.
 *
 * ## Qué hace
 *
 * Una vez arrancado ({@link start}), pide `GET /me/ui-visibility` —sólo lo oculto— al abrir la sesión y vuelve a pedirlo cuando cambia **quién** es o
 * **desde qué organización** actúa. El servidor ya resolvió especificidad, vigencia y cascada de ancestros, así que
 * el cliente **no recalcula nada**: si una clave no está en `hiddenKeys`, es visible.
 *
 * ## Política de fallo: abierto
 *
 * Si el pedido falla, **no se oculta nada** —ocultar por una caída de red le quitaría a la persona pantallas que sí
 * puede usar, y la API es la que protege— y el estado queda visible (`state`, `diagnostic`) para quien tenga que
 * entender por qué una regla no se aplicó. Una excepción deliberada: si ya había reglas de **esta misma sesión** y el
 * refresco falla, se conservan como S7 (dato con antigüedad) en vez de volver a mostrar todo.
 *
 * Mientras carga (S2) también se muestra todo; la guarda de ruta espera el desenlace ({@link whenSettled}) para no
 * dejar entrar a una pantalla que está a punto de ocultarse.
 */
@Injectable({ providedIn: 'root' })
export class UiVisibilityService {
  private readonly client = inject(UiVisibilityClient);
  private readonly session = inject(SessionStore);
  private readonly injector = inject(Injector);

  private readonly estado = signal<ViewState<MyUiVisibility>>(routeAuthPending());
  private siguiendo = false;
  private identidad: string | null = null;
  private pedido: Subscription | null = null;
  private generacion = 0;
  private esperando: (() => void)[] = [];

  /** El estado del pedido, con la forma de los 9 estados del M34. */
  readonly state = this.estado.asReadonly();

  /** Las claves ocultas. Vacío mientras carga, si falló o si no hay sesión: se falla abierto. */
  readonly hiddenKeys = computed<readonly string[]>(() => dataOf(this.estado())?.hiddenKeys ?? []);

  private readonly hiddenSet = computed<ReadonlySet<string>>(() => new Set(this.hiddenKeys()), {
    // Un refresco con las mismas reglas no vuelve a pintar el menú.
    equal: (a, b) => a.size === b.size && [...a].every((clave) => b.has(clave)),
  });

  /** La versión de las reglas que se están aplicando, o `null` si no hay ninguna. */
  readonly version = computed<string | null>(() => dataOf(this.estado())?.version ?? null);

  /** `true` si el último pedido falló y por eso no se está ocultando nada. */
  readonly failedOpen = computed(() => ESTADOS_DE_FALLO.has(this.estado().status));

  readonly diagnostic = computed<UiVisibilityDiagnostic>(() => {
    const estado = this.estado();
    const datos = dataOf(estado);
    return {
      status: estado.status,
      m34: m34CodeOf(estado),
      failedOpen: this.failedOpen(),
      version: datos?.version ?? null,
      generatedAt: datos?.generatedAt ?? null,
      hiddenCount: datos?.hiddenKeys.length ?? 0,
      requestId: 'requestId' in estado && estado.requestId !== undefined ? estado.requestId : null,
    };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.pedido?.unsubscribe();
      this.liberar();
    });
  }

  /**
   * Empieza a seguir la sesión: pide las reglas al abrirse y las vuelve a pedir cuando cambia quién es o desde qué
   * organización actúa. Idempotente.
   *
   * **No arranca solo al construirse**, a propósito: lo arranca `provideAppInitializer` en `app.config.ts` (y la guarda
   * de ruta, por si corre antes). Así una pantalla que sólo consulta `isVisible` —en una prueba, por ejemplo— no sale
   * a la red por una dependencia que no declaró, y sin arrancar todo es visible.
   */
  start(): void {
    if (this.siguiendo) {
      return;
    }
    this.siguiendo = true;
    // El `effect` sólo lee las señales de la sesión; el pedido sale del contexto reactivo.
    effect(
      () => {
        const clave = this.claveDeIdentidad();
        untracked(() => this.alCambiarLaIdentidad(clave));
      },
      { injector: this.injector },
    );
  }

  /**
   * ¿Se presenta este elemento? Reactivo: leerlo en una plantilla o en un `computed` lo suscribe a los cambios.
   * Una clave que el catálogo no conoce es visible (sin regla, gana lo declarado por omisión del lado del servidor).
   */
  isVisible(key: string): boolean {
    return !this.hiddenSet().has(key);
  }

  /** Vuelve a pedir las reglas (p. ej. tras editar reglas en el portal admin). Conserva las actuales si falla. */
  refresh(): void {
    if (this.identidad === null) {
      return;
    }
    this.cargar(true);
  }

  /**
   * Invalidación por versión: si quien llama sabe que las reglas vigentes son otras (`version` distinta de la que se
   * está aplicando), se recargan. Una versión igual no cuesta una petición.
   */
  noteVersion(version: string): void {
    const actual = this.version();
    if (this.identidad !== null && actual !== null && actual !== version) {
      this.refresh();
    }
  }

  /**
   * Asegura que el servicio ya miró la sesión actual: arranca el seguimiento si faltaba y evalúa la identidad **ya**.
   * La guarda lo llama antes de preguntar: el `effect` corre en la siguiente detección de cambios y una guarda corre antes.
   */
  ensureStarted(): void {
    this.start();
    this.alCambiarLaIdentidad(this.claveDeIdentidad());
  }

  /**
   * Se resuelve cuando el pedido en curso terminó (bien o mal) o tras `maxMs`. **Nunca rechaza**: ante la duda,
   * abierto. Con la sesión sin pedido en vuelo se resuelve de inmediato.
   */
  whenSettled(maxMs = 4000): Promise<void> {
    if (this.estado().status !== 'loading') {
      return Promise.resolve();
    }
    return new Promise<void>((resolver) => {
      const liberar = (): void => {
        clearTimeout(plazo);
        this.esperando = this.esperando.filter((f) => f !== liberar);
        resolver();
      };
      const plazo = setTimeout(liberar, maxMs);
      this.esperando.push(liberar);
    });
  }

  /** `usuario|organización|limitada`, o `null` sin sesión o con el token de alcance limitado (no hay nada que pedir). */
  private claveDeIdentidad(): string | null {
    if (!this.session.isAuthenticated() || this.session.limitedToEnrollment()) {
      return null;
    }
    return `${this.session.userId() ?? ''}|${this.session.activeTenantId() ?? ''}`;
  }

  private alCambiarLaIdentidad(clave: string | null): void {
    if (clave === this.identidad) {
      return;
    }
    this.identidad = clave;
    if (clave === null) {
      // Sin sesión: se olvida todo. Las reglas de la persona anterior no pasan a la siguiente.
      this.generacion += 1;
      this.pedido?.unsubscribe();
      this.pedido = null;
      this.fijar(routeAuthPending());
      return;
    }
    this.cargar(false);
  }

  private cargar(esRefresco: boolean): void {
    this.pedido?.unsubscribe();
    const generacion = ++this.generacion;
    const previo = esRefresco ? dataOf(this.estado()) : null;
    if (previo === null) {
      this.fijar(loading());
    }
    this.pedido = this.client.mine().subscribe({
      next: (respuesta) => {
        if (generacion === this.generacion) {
          this.fijar(ready(respuesta));
        }
      },
      error: (error: unknown) => {
        if (generacion !== this.generacion) {
          return;
        }
        // Un refresco fallido conserva las reglas de esta sesión con su antigüedad; el primer pedido, abierto.
        this.fijar(previo === null ? errorToViewState<MyUiVisibility>(error) : stale(previo, new Date(previo.generatedAt)));
      },
    });
  }

  private fijar(estado: ViewState<MyUiVisibility>): void {
    this.estado.set(estado);
    if (estado.status !== 'loading') {
      this.liberar();
    }
  }

  private liberar(): void {
    const pendientes = this.esperando;
    this.esperando = [];
    pendientes.forEach((f) => f());
  }
}
