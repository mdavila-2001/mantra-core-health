import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, DOCUMENT, effect, inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { isAccessTokenExpired } from '../../auth/access-token';
import { SessionStore } from '../../auth/session.store';
import { TelemetryClient } from '../../data-access/telemetry/telemetry.client';
import type { ActivityEvent } from '../../data-access/telemetry/telemetry.types';
import { UxConsent } from '../consent/ux-consent.service';
import { routeTemplate } from '../routing/route-template';
import { describirElemento, esCampo, limpiarValor, tipoDeCampo } from './ux-element';
import {
  campoEnfocado,
  clic,
  DetectorDeClicRepetido,
  EVENTOS_UX,
  paginaAbandonada,
  paginaVista,
  type EventoUx,
  type Lienzo,
} from './ux-events';
import { UX_ANALYTICS_CONFIG } from './ux-analytics.config';

const CLAVE_SESION = 'mch.ux.session';
const CLAVE_MUESTREO = 'mch.ux.sampled';

/**
 * Un evento en la cola, con la identidad **solo en memoria**.
 *
 * El cuerpo que sale ya no lleva `userId`, `sessionId` ni `tenantId`: los pone
 * la API desde el token (y mandarlos da 400). Pero el servicio sí necesita
 * saber de quién y bajo qué organización se capturó cada evento, para no
 * mandar con el token de otra persona lo que se midió para la anterior.
 */
interface EnCola {
  readonly usuario: string | null;
  readonly tenantId: string | null;
  readonly evento: ActivityEvent;
}

/** Lo que se acumula de la página en curso hasta que se abandona. */
interface PaginaEnCurso {
  readonly ruta: string;
  readonly desde: number;
  profundidadMaxima: number;
  clics: number;
  /** La última medida de esta página: al navegar, el DOM ya es el de la siguiente. */
  lienzo: Lienzo;
  /**
   * Si su `pagina_vista` se encoló. La pantalla de acceso se ve sin sesión y no
   * se captura; su abandono, que ocurre ya con sesión, tampoco: sería un
   * abandono sin vista.
   */
  readonly capturada: boolean;
}

/**
 * Captura de interacciones del portal para los mapas de calor.
 *
 * Mide, acumula y manda en lotes a `POST /telemetry/activity-events`. Lo que
 * sale y con qué forma lo deciden `ux-events.ts` y `ux-element.ts`; esto solo
 * engancha los oyentes y administra el buffer.
 *
 * ## Consentimiento y señales de privacidad
 *
 * `UxConsent` decide qué puede salir. Con DNT o Global Privacy Control la
 * captura **no arranca**. Con la decisión ausente solo salen `pagina_vista`
 * contra el esquema del propósito agregado (sin identidad ni propiedades) y
 * nunca clics. Con el consentimiento otorgado sale todo contra el esquema que lo
 * exige. Un retiro vacía la cola.
 *
 * ## La API es la autoridad
 *
 * El cuerpo no lleva `userId`, `sessionId` ni `tenantId`: la API los deriva del
 * token y rechaza con 400 el lote que los mande. Con la identidad que ella
 * pone, exige un consentimiento `GRANTED` vigente para el propósito del
 * esquema y, sin él, descarta el evento y lo cuenta en `skipped`. El navegador
 * no decide quién consintió. La pestaña viaja como la propiedad declarada
 * `pestana`, para distinguir pestañas de una misma sesión.
 *
 * ## La telemetría nunca rompe la pantalla
 *
 * Los oyentes son pasivos y corren fuera de Angular, un fallo de red no llega a
 * la persona y un lote rechazado por un 4xx no se reintenta: ese lote no va a
 * entrar nunca, y reintentarlo sería una petición fallida cada diez segundos.
 * Lo que falla por red o por un 5xx se reintenta en el próximo tick, y la clave
 * de idempotencia de cada evento impide contarlo dos veces.
 */
@Injectable({
  providedIn: 'root',
})
export class UxAnalytics {
  private readonly config = inject(UX_ANALYTICS_CONFIG);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly client = inject(TelemetryClient);
  private readonly consent = inject(UxConsent);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private buffer: EnCola[] = [];
  private enVuelo = false;
  private pagina: PaginaEnCurso | null = null;
  private sessionId = '';
  private muestreada = false;
  private iniciada = false;
  /** Fallos reintentables seguidos: alargan la espera antes del próximo envío. */
  private fallosSeguidos = 0;
  private pausaHasta = 0;
  /**
   * Sube con cada cambio de usuario. Un lote que falla después de que otra
   * persona inició sesión no se reencola: saldría con el token de ella.
   */
  private generacion = 0;
  /** El `userId` que vio el último cambio de sesión; por él se detecta el relevo. */
  private ultimoUsuario: string | null = null;
  /**
   * Por qué la captura se detuvo (estado y motivo que dio la API), o `null`.
   * Un 400 que apaga el SDK sin decir por qué es indepurable: queda aquí y en
   * `console.warn`.
   */
  motivoDeApagado: string | null = null;
  private readonly repetidos = new DetectorDeClicRepetido();
  private desconectar: (() => void) | null = null;

  constructor() {
    // Sin sesión no hay token, y la API rechazaría el lote. Lo acumulado de la
    // sesión que terminó no se puede mandar con la de otra persona: se tira.
    // Y la sesión del navegador se renueva: en el equipo compartido de un
    // consultorio, quien entra después en la misma pestaña no puede quedar en
    // el mismo recorrido (la API agrupa por `sessionId`) ni heredar la página
    // abierta de quien salió.
    effect(() => {
      const usuario = this.session.userId();
      if (usuario === this.ultimoUsuario) {
        return;
      }
      const habiaUsuario = this.ultimoUsuario !== null;
      this.ultimoUsuario = usuario;
      this.generacion += 1;
      if (habiaUsuario) {
        this.buffer = [];
        this.pagina = null;
        if (this.iniciada) {
          this.sessionId = this.renovar(CLAVE_SESION);
        }
      }
    });

    // Un retiro (o cualquier paso a «ninguno») vacía lo que ya se midió: lo
    // capturado con el consentimiento no sale una vez que la persona lo retira.
    effect(() => {
      if (this.consent.modo() === 'ninguno') {
        this.buffer = [];
      }
    });

    this.destroyRef.onDestroy(() => this.detener());
  }

  /**
   * Engancha los oyentes. Idempotente, y no hace nada en el servidor, con la
   * captura apagada o si la sesión del navegador quedó fuera del muestreo.
   */
  start(): void {
    if (!this.isBrowser || !this.config.active || this.iniciada) {
      return;
    }
    // DNT / Global Privacy Control: la persona ya dijo que no. No se engancha
    // nada, ni siquiera las vistas anónimas.
    if (this.consent.bloqueadaPorPrivacidad) {
      this.motivoDeApagado = 'senal-de-privacidad (DNT o Global Privacy Control)';
      console.info('[ux-analytics] no arranca: el navegador pide no ser rastreado (DNT o GPC).');
      return;
    }
    this.iniciada = true;
    this.sessionId = this.leerOCrear(CLAVE_SESION, () => nuevoUuid());
    this.muestreada = this.leerOCrear(CLAVE_MUESTREO, () => String(Math.random() < this.config.sampleRatio)) === 'true';
    if (!this.muestreada) {
      return;
    }

    const navegaciones = this.router.events
      .pipe(filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd))
      .subscribe((evento) => this.alNavegar(evento.urlAfterRedirects));

    const ventana = this.document.defaultView;
    const alClic = (evento: MouseEvent) => this.alClic(evento);
    const alFoco = (evento: FocusEvent) => this.alFoco(evento);
    const alDesplazar = () => this.alDesplazar();
    const alOcultar = () => {
      if (this.document.visibilityState === 'hidden') {
        this.enviar(true);
      }
    };
    const alSalir = () => {
      this.cerrarPagina(true);
      this.enviar(true);
    };
    // Volver con «atrás» desde la caché del navegador (bfcache) no dispara un
    // `NavigationEnd`: la página se reabre a mano, o nada se capturaría hasta
    // la próxima navegación.
    const alVolver = (evento: PageTransitionEvent) => {
      if (evento.persisted && this.pagina === null) {
        this.alNavegar(this.router.url);
      }
    };

    let temporizador: ReturnType<typeof setInterval> | null = null;
    this.zone.runOutsideAngular(() => {
      this.document.addEventListener('click', alClic, { capture: true, passive: true });
      this.document.addEventListener('focusin', alFoco, { capture: true, passive: true });
      this.document.addEventListener('visibilitychange', alOcultar);
      ventana?.addEventListener('scroll', alDesplazar, { passive: true });
      ventana?.addEventListener('pagehide', alSalir);
      ventana?.addEventListener('pageshow', alVolver);
      temporizador = setInterval(() => this.enviar(false), this.config.flushIntervalMs);
    });

    this.desconectar = () => {
      navegaciones.unsubscribe();
      this.document.removeEventListener('click', alClic, { capture: true });
      this.document.removeEventListener('focusin', alFoco, { capture: true });
      this.document.removeEventListener('visibilitychange', alOcultar);
      ventana?.removeEventListener('scroll', alDesplazar);
      ventana?.removeEventListener('pagehide', alSalir);
      ventana?.removeEventListener('pageshow', alVolver);
      if (temporizador !== null) {
        clearInterval(temporizador);
      }
    };
  }

  /**
   * Manda lo acumulado. Un lote por vez: con uno en vuelo, el siguiente espera
   * al próximo tick en vez de competir por la misma conexión.
   *
   * @param keepalive - La pestaña se oculta o se cierra. Ese lote sale aunque
   *   haya otro en vuelo: ocultar y cerrar llegan seguidos, y el abandono que se
   *   encola al cerrar no tendría otro momento.
   */
  enviar(keepalive: boolean): void {
    if (this.buffer.length === 0 || !this.session.isAuthenticated()) {
      return;
    }
    if (!keepalive && (this.enVuelo || Date.now() < this.pausaHasta)) {
      return;
    }
    // Con el access token vencido, `authInterceptor` primero rota el refresh
    // token, y esa petición no lleva `keepalive`: la página se descarga a la
    // mitad, `localStorage` se queda con el token viejo y al volver la API lo
    // toma por reutilización y revoca la sesión. Mejor perder el lote.
    const claims = this.session.claims();
    if (keepalive && (claims === null || isAccessTokenExpired(claims))) {
      return;
    }

    const generacion = this.generacion;
    // El efecto que vacía el buffer al cambiar de usuario corre después del
    // cambio, no en el mismo instante: lo que se capturó para otra persona (u
    // otra organización) se filtra acá también, que es donde se le pone el token.
    const usuario = this.session.userId();
    const tenantId = this.session.activeTenantId();
    const lote = this.buffer
      .splice(0, keepalive ? this.config.maxKeepaliveBatch : this.config.maxBatch)
      .filter((item) => item.usuario === usuario && item.tenantId === tenantId);
    if (lote.length === 0) {
      return;
    }
    this.enVuelo = true;
    this.client.captureActivityEvents({ events: lote.map((item) => item.evento) }, keepalive).subscribe({
      next: () => {
        this.enVuelo = false;
        this.fallosSeguidos = 0;
        this.pausaHasta = 0;
      },
      error: (error: unknown) => {
        this.enVuelo = false;
        if (generacion !== this.generacion) {
          // La sesión con la que se capturó ya no existe: el lote se pierde.
          return;
        }
        if (esReintentable(error)) {
          this.buffer = [...lote, ...this.buffer].slice(-this.config.maxBuffer);
          // Espera creciente (10 s, 20 s, 40 s… hasta 5 min): un 429 o una API
          // caída no reciben una petición por tick de cada pestaña abierta.
          this.fallosSeguidos += 1;
          const espera = Math.min(this.config.flushIntervalMs * 2 ** (this.fallosSeguidos - 1), 5 * 60_000);
          this.pausaHasta = Date.now() + espera;
        } else if (esDefinitivo(error)) {
          // El esquema no existe o no está activo, el lote no valida o el rol no
          // alcanza: ningún lote de esta sesión va a entrar. Se deja de
          // capturar, y se deja dicho por qué.
          this.motivoDeApagado = describirRechazo(error);
          console.warn(`[ux-analytics] captura detenida: ${this.motivoDeApagado}`);
          this.buffer = [];
          this.detener();
        } else if (error instanceof HttpErrorResponse && error.status === 422) {
          // Una propiedad o una ruta que la API no admite: ese lote no entra
          // nunca, pero los siguientes pueden. Se descarta y se registra.
          console.warn(`[ux-analytics] lote descartado: ${describirRechazo(error)}`);
        }
      },
    });
  }

  private alNavegar(url: string): void {
    const ruta = normalizarRuta(routeTemplate(this.router, url));
    const anterior = this.pagina?.ruta ?? null;
    if (anterior === ruta) {
      // Cambió solo la consulta o el fragmento: es la misma página.
      return;
    }
    this.cerrarPagina(false);
    const capturada = this.session.isAuthenticated();
    this.pagina = { ruta, desde: Date.now(), profundidadMaxima: 0, clics: 0, lienzo: this.lienzo(), capturada };
    this.encolar(paginaVista(this.pagina.lienzo, anterior));
    // La primera pantalla cuenta como vista aunque nadie desplace: se mide en
    // el próximo cuadro, cuando la ruta nueva ya se pintó.
    const ventana = this.document.defaultView;
    if (typeof ventana?.requestAnimationFrame === 'function') {
      this.zone.runOutsideAngular(() => ventana.requestAnimationFrame(() => this.alDesplazar()));
    }
  }

  private alClic(evento: MouseEvent): void {
    const objetivo = describirElemento(evento.target);
    if (objetivo === null) {
      return;
    }
    if (this.pagina !== null) {
      this.pagina.clics += 1;
    }

    const porTeclado = evento.detail === 0;
    const repetido = !porTeclado && this.repetidos.registrar(Date.now(), evento.clientX, evento.clientY);
    const rectangulo = objetivo.ancla.getBoundingClientRect();
    this.encolar(
      clic(
        this.lienzo(),
        objetivo,
        {
          xDocumento: evento.pageX,
          yDocumento: evento.pageY,
          xVentana: evento.clientX,
          yVentana: evento.clientY,
          rectangulo,
          porTeclado,
        },
        repetido,
      ),
    );
  }

  private alFoco(evento: FocusEvent): void {
    if (!esCampo(evento.target)) {
      return;
    }
    const objetivo = describirElemento(evento.target);
    if (objetivo !== null) {
      this.encolar(campoEnfocado(this.lienzo(), objetivo, tipoDeCampo(evento.target)));
    }
  }

  private alDesplazar(): void {
    if (this.pagina === null) {
      return;
    }
    const ventana = this.document.defaultView;
    const raiz = this.document.documentElement;
    if (ventana === null || raiz.scrollHeight <= 0) {
      return;
    }
    this.pagina.lienzo = this.lienzo();
    const profundidad = (ventana.scrollY + ventana.innerHeight) / raiz.scrollHeight;
    if (profundidad > this.pagina.profundidadMaxima) {
      this.pagina.profundidadMaxima = profundidad;
    }
  }

  /**
   * @param medir - `true` al cerrar la pestaña, cuando el DOM todavía es el de
   *   esta página. Al navegar ya no lo es y vale la última medida.
   */
  private cerrarPagina(medir: boolean): void {
    if (this.pagina === null) {
      return;
    }
    if (medir) {
      this.alDesplazar();
    }
    const { profundidadMaxima, desde, clics, lienzo, ruta, capturada } = this.pagina;
    if (capturada) {
      this.encolar(paginaAbandonada(lienzo, { profundidadMaxima, msEnPagina: Date.now() - desde, clics }), ruta);
    }
    this.pagina = null;
  }

  private encolar(evento: EventoUx, ruta = this.pagina?.ruta): void {
    if (!this.session.isAuthenticated() || ruta === undefined) {
      return;
    }

    const modo = this.consent.modo();
    // Sin decisión solo se miden páginas, y de forma anónima; sin permiso (o con
    // DNT/GPC/retiro) no se mide nada.
    if (modo === 'ninguno' || (modo === 'anonimo' && evento.nombre !== EVENTOS_UX.paginaVista)) {
      return;
    }

    const base = {
      eventName: evento.nombre,
      eventIdempotencyKey: nuevoUuid(),
      routeTemplate: ruta.slice(0, 300),
      occurredAt: new Date().toISOString(),
    };
    const completo: ActivityEvent = {
      ...base,
      eventSchemaDefinitionId: this.config.eventSchemaDefinitionId,
      properties: [...evento.propiedades, { propertyName: 'pestana', valueType: 'STRING', valueString: this.sessionId }],
    };
    // El esquema anónimo no admite ninguna propiedad: solo la plantilla de ruta.
    const anonimo: ActivityEvent = {
      ...base,
      eventSchemaDefinitionId: this.config.anonymousSchemaDefinitionId,
      properties: [],
    };
    this.buffer.push({
      usuario: this.session.userId(),
      tenantId: this.session.activeTenantId(),
      evento: modo === 'completo' ? completo : anonimo,
    });

    if (this.buffer.length > this.config.maxBuffer) {
      this.buffer.splice(0, this.buffer.length - this.config.maxBuffer);
    }
    if (this.buffer.length >= this.config.maxBatch) {
      this.enviar(false);
    }
  }

  private lienzo(): Lienzo {
    const ventana = this.document.defaultView;
    const raiz = this.document.documentElement;
    return {
      anchoVentana: ventana?.innerWidth ?? 0,
      altoVentana: ventana?.innerHeight ?? 0,
      anchoDocumento: raiz.scrollWidth,
      altoDocumento: raiz.scrollHeight,
    };
  }

  /**
   * Lee de `sessionStorage` o crea el valor. `sessionStorage` y no
   * `localStorage`: vive lo que vive la pestaña, que es la sesión que se mide,
   * y no deja un identificador persistente en el equipo.
   */
  private leerOCrear(clave: string, crear: () => string): string {
    try {
      const almacenado = this.document.defaultView?.sessionStorage.getItem(clave);
      if (almacenado) {
        return almacenado;
      }
      const nuevo = crear();
      this.document.defaultView?.sessionStorage.setItem(clave, nuevo);
      return nuevo;
    } catch {
      // Almacenamiento bloqueado (modo privado, política del navegador): el
      // valor vive en memoria lo que dure la página.
      return crear();
    }
  }

  /** Descarta el valor guardado y crea otro. */
  private renovar(clave: string): string {
    try {
      this.document.defaultView?.sessionStorage.removeItem(clave);
    } catch {
      // Almacenamiento bloqueado: `leerOCrear` ya trabaja en memoria.
    }
    return this.leerOCrear(clave, () => nuevoUuid());
  }

  private detener(): void {
    this.desconectar?.();
    this.desconectar = null;
  }
}

/**
 * Un uuid v4. `crypto.randomUUID` solo existe en contextos seguros (HTTPS o
 * `localhost`); servido por HTTP en la red local (`yarn start:lan`) no está, y
 * `getRandomValues` sí.
 */
export function nuevoUuid(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Cada segmento de la ruta pasa por la misma limpieza que los atributos.
 *
 * `routeTemplate` devuelve la URL saneada tal cual cuando ninguna ruta del
 * Router encaja —un enlace viejo que cae en `**`—, y acá esa ruta se guarda
 * junto al `userId`. Los `:param` de una plantilla ya resuelta pasan intactos.
 */
export function normalizarRuta(ruta: string): string {
  const segmentos = ruta.split('/').filter((segmento) => segmento !== '');
  return `/${segmentos.map((segmento) => (segmento.startsWith(':') ? segmento : limpiarValor(segmento))).join('/')}`.slice(
    0,
    300,
  );
}

/**
 * 400, 403, 404 o 412: el lote no va a entrar nunca, y los siguientes tampoco
 * (campo no declarado, rol, esquema inexistente, esquema `DEPRECATED` o sesión
 * no registrada).
 */
function esDefinitivo(error: unknown): boolean {
  return error instanceof HttpErrorResponse && [400, 403, 404, 412].includes(error.status);
}

/**
 * «412 TELEMETRY_EVENT_SCHEMA_NOT_ACTIVE: …»: el estado y lo que dijo la API.
 * Nunca incluye el cuerpo del lote.
 */
export function describirRechazo(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'error desconocido';
  }
  const cuerpo: unknown = error.error;
  const campos = typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
  const reasonText = typeof campos['reason'] === 'string' ? campos['reason'] : typeof campos['code'] === 'string' ? campos['code'] : '';
  const mensaje = Array.isArray(campos['message'])
    ? campos['message'].filter((m): m is string => typeof m === 'string').join('; ')
    : typeof campos['message'] === 'string'
      ? campos['message']
      : '';
  return [String(error.status), reasonText, mensaje].filter((parte) => parte !== '').join(' ').slice(0, 500);
}

/** Red caída, límite de tasa o fallo del servidor: vale la pena reintentar. */
function esReintentable(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }
  return error.status === 0 || error.status === 429 || error.status >= 500;
}
