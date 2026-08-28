/* ============================================================================
    Los permisos que concede el NAVEGADOR, no el backend.

    Son los únicos permisos que la persona puede mirar y cambiar desde el
    producto sin pedirle nada a nadie: avisos del sistema, ubicación y cámara.
    Todo lo demás que se llama «permiso» en esta aplicación —roles del token,
    acceso delegado, consentimientos— lo concede y lo lee la API, y ninguno de
    ellos tiene hoy un endpoint de lectura para la propia persona.

    Dos reglas que gobiernan este archivo:

    1. **Ninguna página puede quitarse un permiso a sí misma.** La API del
       navegador expone `query` y la petición, nunca la revocación: eso se hace
       desde la configuración del navegador. Por eso acá hay «Permitir» y no
       hay «Quitar», y la pantalla lo dice en palabras en vez de ofrecer un
       botón que no haría nada.

    2. **No saber no es lo mismo que estar denegado.** Safari no implementa
       `permissions.query` para la cámara, y varios navegadores tampoco para la
       ubicación. Ahí el estado honesto es `desconocido` —el navegador no lo
       dice— y no `sin-decidir`, que afirmaría algo que nadie comprobó.
    ========================================================================== */

import {
  DestroyRef,
  DOCUMENT,
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Los tres permisos que el producto usa de verdad. */
export type PermisoDelNavegador = 'avisos' | 'ubicacion' | 'camara';

/**
 * En qué estado está un permiso.
 *
 * `desconocido` y `no-disponible` son distintos a propósito: el primero es «el
 * navegador no sabe decírnoslo pero la función existe» y el segundo es «este
 * navegador no tiene esta función». Colapsarlos haría que un Safari con cámara
 * se leyera como un navegador sin cámara.
 */
export type EstadoPermiso =
  | 'concedido'
  | 'denegado'
  | 'sin-decidir'
  | 'desconocido'
  | 'no-disponible';

/** Nombre del permiso en la API del navegador, para los que la soportan. */
const NOMBRE_ESTANDAR: Readonly<Record<PermisoDelNavegador, PermissionName>> = {
  avisos: 'notifications' as PermissionName,
  ubicacion: 'geolocation' as PermissionName,
  camara: 'camera' as PermissionName,
};

const TODOS: readonly PermisoDelNavegador[] = ['avisos', 'ubicacion', 'camara'];

/** Cuánto se espera a que la persona conteste el cartel de ubicación. */
const ESPERA_UBICACION_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class BrowserPermissionsService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly estados = signal<Readonly<Record<PermisoDelNavegador, EstadoPermiso>>>({
    // Bajo SSR no hay navegador que preguntar. Se parte de `desconocido` y no
    // de `sin-decidir` por la regla 2: en el servidor nadie comprobó nada.
    avisos: 'desconocido',
    ubicacion: 'desconocido',
    camara: 'desconocido',
  });

  /** Qué pide cada permiso ahora mismo, para deshabilitar su botón. */
  private readonly pidiendo = signal<readonly PermisoDelNavegador[]>([]);

  readonly estado = computed(() => this.estados());

  constructor() {
    if (this.esNavegador) {
      void this.refrescar();
      this.escucharCambios();
    }
  }

  /** Si hay una petición en curso para ese permiso. */
  enCurso(permiso: PermisoDelNavegador): boolean {
    return this.pidiendo().includes(permiso);
  }

  /**
   * Si tiene sentido ofrecer el botón «Permitir».
   *
   * Un permiso ya concedido no se vuelve a pedir, y uno denegado tampoco: el
   * navegador ignora la petición en silencio y el cartel no vuelve a aparecer,
   * así que un botón ahí prometería algo que no pasa. En los dos casos lo útil
   * es la frase que manda a la configuración del navegador.
   */
  sePuedePedir(permiso: PermisoDelNavegador): boolean {
    const estado = this.estados()[permiso];
    return estado === 'sin-decidir' || estado === 'desconocido';
  }

  /** Vuelve a preguntarle al navegador por los tres. */
  async refrescar(): Promise<void> {
    if (!this.esNavegador) {
      return;
    }
    const leidos = await Promise.all(TODOS.map((permiso) => this.leer(permiso)));
    this.estados.set({
      avisos: leidos[0],
      ubicacion: leidos[1],
      camara: leidos[2],
    });
  }

  /**
   * Dispara el cartel del navegador para ese permiso.
   *
   * Cada uno se pide por su propia puerta —no hay una genérica—: los avisos con
   * `Notification.requestPermission`, la ubicación pidiendo una posición y la
   * cámara abriendo un flujo que se cierra en el acto. Ni la posición ni el
   * flujo se conservan: lo único que se quiere de esa llamada es el cartel.
   */
  async pedir(permiso: PermisoDelNavegador): Promise<void> {
    if (!this.esNavegador || this.enCurso(permiso)) {
      return;
    }
    this.pidiendo.update((lista) => [...lista, permiso]);
    try {
      if (permiso === 'avisos') {
        await this.pedirAvisos();
      } else if (permiso === 'ubicacion') {
        await this.pedirUbicacion();
      } else {
        await this.pedirCamara();
      }
    } catch {
      // Que la persona diga que no es una respuesta, no un fallo: el estado
      // nuevo lo cuenta el `refrescar` de abajo.
    } finally {
      this.pidiendo.update((lista) => lista.filter((cual) => cual !== permiso));
      await this.refrescar();
    }
  }

  private get ventana(): (Window & typeof globalThis) | null {
    return this.document.defaultView;
  }

  private async leer(permiso: PermisoDelNavegador): Promise<EstadoPermiso> {
    if (!this.existeLaFuncion(permiso)) {
      return 'no-disponible';
    }

    // Los avisos tienen su propia lectura síncrona y fiable en todos lados;
    // `permissions.query` para ellos no agrega nada y falla en algunos.
    if (permiso === 'avisos') {
      return this.traducirNotification(this.ventana?.Notification?.permission);
    }

    const permissions = this.ventana?.navigator?.permissions;
    if (permissions?.query === undefined) {
      return 'desconocido';
    }
    try {
      const estado = await permissions.query({ name: NOMBRE_ESTANDAR[permiso] });
      return this.traducirQuery(estado.state);
    } catch {
      // Nombre no soportado (la cámara en Safari): la función existe, lo que
      // no existe es la forma de consultarla.
      return 'desconocido';
    }
  }

  private existeLaFuncion(permiso: PermisoDelNavegador): boolean {
    const ventana = this.ventana;
    if (ventana === null) {
      return false;
    }
    if (permiso === 'avisos') {
      return ventana.Notification !== undefined;
    }
    if (permiso === 'ubicacion') {
      return ventana.navigator?.geolocation !== undefined;
    }
    return ventana.navigator?.mediaDevices?.getUserMedia !== undefined;
  }

  private traducirNotification(valor: NotificationPermission | undefined): EstadoPermiso {
    if (valor === 'granted') return 'concedido';
    if (valor === 'denied') return 'denegado';
    if (valor === 'default') return 'sin-decidir';
    return 'desconocido';
  }

  private traducirQuery(valor: PermissionState): EstadoPermiso {
    if (valor === 'granted') return 'concedido';
    if (valor === 'denied') return 'denegado';
    return 'sin-decidir';
  }

  private async pedirAvisos(): Promise<void> {
    await this.ventana?.Notification?.requestPermission();
  }

  /**
   * La posición se pide y se descarta: acá no se guarda ni se manda a ningún
   * lado. Quien de verdad necesita la ubicación —«dónde comprar», el alta de
   * paciente— la pide por su cuenta cuando le hace falta.
   */
  private pedirUbicacion(): Promise<void> {
    const geolocation = this.ventana?.navigator?.geolocation;
    if (geolocation === undefined) {
      return Promise.resolve();
    }
    return new Promise((resolver) => {
      geolocation.getCurrentPosition(
        () => resolver(),
        () => resolver(),
        { timeout: ESPERA_UBICACION_MS, maximumAge: Infinity },
      );
    });
  }

  /** El flujo se cierra en el mismo acto: dejar la cámara abierta encendería la luz. */
  private async pedirCamara(): Promise<void> {
    const mediaDevices = this.ventana?.navigator?.mediaDevices;
    if (mediaDevices?.getUserMedia === undefined) {
      return;
    }
    const flujo = await mediaDevices.getUserMedia({ video: true });
    for (const pista of flujo.getTracks()) {
      pista.stop();
    }
  }

  /**
   * Mantiene el estado vivo cuando la persona lo cambia desde el navegador.
   *
   * Sin esto, quitar el permiso desde la barra de direcciones dejaría la
   * pantalla afirmando «concedido» hasta la próxima carga, que es exactamente
   * la clase de mentira que esta vista existe para no contar.
   */
  private escucharCambios(): void {
    const permissions = this.ventana?.navigator?.permissions;
    if (permissions?.query === undefined) {
      return;
    }
    for (const permiso of TODOS) {
      permissions
        .query({ name: NOMBRE_ESTANDAR[permiso] })
        .then((estado) => {
          const alCambiar = () => void this.refrescar();
          estado.addEventListener('change', alCambiar);
          this.destroyRef.onDestroy(() => estado.removeEventListener('change', alCambiar));
        })
        .catch(() => {
          // Sin suscripción posible: queda la lectura de `refrescar`.
        });
    }
  }
}
