import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { GuardsCheckEnd, NavigationEnd, NavigationStart, Router } from '@angular/router';

import { BUILD_INFO, buildFingerprint } from './build-info';

/** Dónde publica el servidor la identidad de lo que tiene desplegado. */
export const BUILD_VERSION_URL = '/build-version.json';

/** Cada cuánto se pregunta, como mínimo, con la pestaña visible. */
const INTERVALO_MS = 5 * 60_000;

/** No se pregunta más de una vez en este lapso, aunque haya muchas navegaciones. */
const ESPERA_MINIMA_MS = 60_000;

/**
 * Se da cuenta de que hubo un redespliegue **antes** de que la pestaña abierta
 * pida un trozo que ya no existe.
 *
 * {@link StaleBuildRecovery} arregla el fallo cuando ya ocurrió; esto lo evita.
 * Hace falta las dos cosas porque no todo fallo de carga llega a un lugar
 * donde se pueda atrapar: hay `import()` dinámicos (el PDF, el mapa, el visor
 * 3D, el simulador) cuyo error se convierte en un mensaje genérico dentro de la
 * propia pantalla.
 *
 * ## Cómo
 *
 * Compara la construcción en ejecución (`BUILD_INFO`) con
 * `/build-version.json`, que el servidor sirve sin caché. Pregunta al volver a
 * la pestaña, cada {@link INTERVALO_MS} y al navegar si hace más de
 * {@link ESPERA_MINIMA_MS} que no lo hace. Si difieren, la **próxima**
 * navegación termina en una carga completa de la URL de destino.
 *
 * Nunca recarga por su cuenta: hacerlo podría borrar lo que la persona está
 * escribiendo. Espera a que ella misma cambie de pantalla, y lo hace en
 * `GuardsCheckEnd` —con los `canDeactivate` ya superados—, de modo que un
 * formulario con cambios sin guardar sigue pidiendo confirmación igual que
 * antes.
 */
@Injectable({ providedIn: 'root' })
export class BuildVersionWatcher {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly build = inject(BUILD_INFO);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** El servidor ya tiene otra construcción. */
  readonly outdated = signal(false);

  private ultimaConsulta = 0;
  private ultimaNavegacion = Date.now();
  private enCurso: Promise<void> | null = null;
  private iniciado = false;

  start(): void {
    if (!this.isBrowser || this.iniciado) return;
    this.iniciado = true;
    const view = this.document.defaultView;
    if (view === null) return;

    const alVolver = (): void => {
      if (this.document.visibilityState === 'visible') void this.check();
    };
    this.document.addEventListener('visibilitychange', alVolver);
    const intervalo = view.setInterval(() => {
      if (this.document.visibilityState === 'visible') void this.check();
    }, INTERVALO_MS);

    const sub = this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationStart || evento instanceof NavigationEnd) {
        this.ultimaNavegacion = Date.now();
        return;
      }
      if (!(evento instanceof GuardsCheckEnd)) return;
      if (this.outdated() && evento.shouldActivate) {
        // Carga completa hacia donde iba: trae el `index.html` y los trozos
        // de la construcción nueva. La sesión vive en el almacenamiento, no en
        // memoria, así que sigue iniciada. Se respeta `replaceUrl`, y la
        // navegación de la SPA vieja se aborta: sin eso seguía con resolvers,
        // trozos viejos y el constructor de la pantalla —un POST de un enlace
        // de un solo uso se habría hecho dos veces—.
        const navegacion = this.router.currentNavigation();
        if (navegacion?.extras.replaceUrl === true) {
          view.location.replace(evento.urlAfterRedirects);
        } else {
          view.location.assign(evento.urlAfterRedirects);
        }
        navegacion?.abort();
        return;
      }
      if (Date.now() - this.ultimaConsulta >= ESPERA_MINIMA_MS) void this.check();
    });

    // La primera consulta no compite con el arranque.
    const primera = view.setTimeout(() => void this.check(), 10_000);

    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', alVolver);
      view.clearInterval(intervalo);
      view.clearTimeout(primera);
      sub.unsubscribe();
    });
  }

  /** Cuánto hace que empezó o terminó la última navegación del router. */
  msSinceNavigation(): number {
    return Date.now() - this.ultimaNavegacion;
  }

  /** Pregunta al servidor qué construcción tiene. Un fallo de red no cambia nada. */
  check(): Promise<void> {
    if (!this.isBrowser || this.outdated()) return Promise.resolve();
    this.enCurso ??= this.consultar().finally(() => {
      this.enCurso = null;
    });
    return this.enCurso;
  }

  private async consultar(): Promise<void> {
    this.ultimaConsulta = Date.now();
    const fetchFn = this.document.defaultView?.fetch;
    if (fetchFn === undefined) return;
    try {
      const respuesta = await fetchFn.call(this.document.defaultView, BUILD_VERSION_URL, {
        cache: 'no-store',
        credentials: 'omit',
      });
      if (!respuesta.ok) return;
      const remota: unknown = await respuesta.json();
      if (!esIdentidad(remota)) return;
      if (buildFingerprint(remota) !== buildFingerprint(this.build)) {
        this.outdated.set(true);
      }
    } catch {
      // Sin red, servidor reiniciándose o JSON a medias: se vuelve a preguntar
      // en la próxima oportunidad. No es motivo para recargar.
    }
  }
}

function esIdentidad(valor: unknown): valor is { commit: string; builtAt: string } {
  if (typeof valor !== 'object' || valor === null) return false;
  const { commit, builtAt } = valor as { commit?: unknown; builtAt?: unknown };
  return typeof commit === 'string' && commit !== '' && typeof builtAt === 'string' && builtAt !== '';
}
