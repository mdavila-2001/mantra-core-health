import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, DOCUMENT, effect, inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { SessionStore } from '../../auth/session.store';
import { TelemetryClient } from '../../data-access/telemetry/telemetry.client';
import type { ActivityEvent } from '../../data-access/telemetry/telemetry.types';
import { routeTemplate } from '../routing/route-template';
import { describirElemento, esCampo, tipoDeCampo } from './ux-element';
import {
  campoEnfocado,
  clic,
  DetectorDeClicRepetido,
  paginaAbandonada,
  paginaVista,
  type EventoUx,
  type Lienzo,
} from './ux-events';
import { UX_ANALYTICS_CONFIG } from './ux-analytics.config';

const CLAVE_SESION = 'mch.ux.session';
const CLAVE_MUESTREO = 'mch.ux.sampled';

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
 * ## La API es la autoridad
 *
 * Cada evento lleva el `userId` de la sesión, y con él la API exige un
 * consentimiento `GRANTED` vigente para el propósito del esquema: sin él, lo
 * descarta y lo cuenta en `skipped`. El navegador no decide quién consintió.
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private buffer: ActivityEvent[] = [];
  private enVuelo = false;
  private pagina: PaginaEnCurso | null = null;
  private sessionId = '';
  private muestreada = false;
  private iniciada = false;
  private readonly repetidos = new DetectorDeClicRepetido();
  private desconectar: (() => void) | null = null;

  constructor() {
    // Sin sesión no hay token, y la API rechazaría el lote. Lo acumulado de la
    // sesión que terminó no se puede mandar con la de otra persona: se tira.
    effect(() => {
      if (!this.session.isAuthenticated()) {
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

    let temporizador: ReturnType<typeof setInterval> | null = null;
    this.zone.runOutsideAngular(() => {
      this.document.addEventListener('click', alClic, { capture: true, passive: true });
      this.document.addEventListener('focusin', alFoco, { capture: true, passive: true });
      this.document.addEventListener('visibilitychange', alOcultar);
      ventana?.addEventListener('scroll', alDesplazar, { passive: true });
      ventana?.addEventListener('pagehide', alSalir);
      temporizador = setInterval(() => this.enviar(false), this.config.flushIntervalMs);
    });

    this.desconectar = () => {
      navegaciones.unsubscribe();
      this.document.removeEventListener('click', alClic, { capture: true });
      this.document.removeEventListener('focusin', alFoco, { capture: true });
      this.document.removeEventListener('visibilitychange', alOcultar);
      ventana?.removeEventListener('scroll', alDesplazar);
      ventana?.removeEventListener('pagehide', alSalir);
      if (temporizador !== null) {
        clearInterval(temporizador);
      }
    };
  }

  /**
   * Manda lo acumulado. Un lote por vez: con uno en vuelo, el siguiente espera
   * al próximo tick en vez de competir por la misma conexión.
   *
   * @param keepalive - La pestaña se oculta o se cierra.
   */
  enviar(keepalive: boolean): void {
    if (this.enVuelo || this.buffer.length === 0 || !this.session.isAuthenticated()) {
      return;
    }

    const lote = this.buffer.splice(0, keepalive ? this.config.maxKeepaliveBatch : this.config.maxBatch);
    this.enVuelo = true;
    this.client.captureActivityEvents({ events: lote }, keepalive).subscribe({
      next: () => {
        this.enVuelo = false;
      },
      error: (error: unknown) => {
        this.enVuelo = false;
        if (esReintentable(error)) {
          this.buffer = [...lote, ...this.buffer].slice(-this.config.maxBuffer);
        }
      },
    });
  }

  private alNavegar(url: string): void {
    const ruta = routeTemplate(this.router, url);
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

    const userId = this.session.userId();
    const tenantId = this.session.activeTenantId();
    this.buffer.push({
      eventSchemaDefinitionId: this.config.eventSchemaDefinitionId,
      eventName: evento.nombre,
      eventIdempotencyKey: nuevoUuid(),
      ...(userId === null ? {} : { userId }),
      sessionId: this.sessionId,
      ...(tenantId === null ? {} : { tenantId }),
      routeTemplate: ruta.slice(0, 300),
      occurredAt: new Date().toISOString(),
      properties: evento.propiedades,
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

/** Red caída, límite de tasa o fallo del servidor: vale la pena reintentar. */
function esReintentable(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse)) {
    return false;
  }
  return error.status === 0 || error.status === 429 || error.status >= 500;
}
