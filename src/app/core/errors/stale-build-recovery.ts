import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, Injector, PLATFORM_ID } from '@angular/core';

import { BUILD_INFO, buildFingerprint } from '../build/build-info';
import { BuildVersionWatcher } from '../build/build-version-watcher';

/**
 * Recuperación ante una pestaña que corre una construcción que el servidor ya
 * no tiene.
 *
 * ## El fallo que resuelve
 *
 * Cada `yarn build` pone nombres nuevos a los trozos que se cargan bajo demanda
 * (`chunk-CT2XDVRL.js`), y el redespliegue borra los de la construcción
 * anterior. Una pestaña abierta **antes** del redespliegue sigue ejecutando el
 * `main-*.js` viejo, que conoce sólo los nombres viejos. La primera vez que esa
 * pestaña necesita un trozo que todavía no había bajado —lo típico: el panel
 * del paciente después de iniciar sesión, que no se carga en la pantalla de
 * acceso— el servidor responde 404 y Angular falla:
 *
 * - la ruta perezosa, con `Failed to fetch dynamically imported module`;
 * - cada bloque `@defer`, con `NG0750`.
 *
 * Recargar «lo arregla» porque trae el `index.html` nuevo con los nombres
 * nuevos. `Cache-Control: no-cache` sobre el HTML (`server.ts`) evita servir
 * HTML viejo en una visita **nueva**, pero no puede hacer nada por una pestaña
 * que ya estaba abierta. Lo mismo ocurre durante un despliegue con dos
 * contenedores vivos detrás del mismo alias de red.
 *
 * ## Qué hace
 *
 * Cuando el fallo tiene esa forma, hace por la persona lo que ella hacía a mano:
 * una carga completa de la página a la que iba. **Una sola vez por
 * construcción**: si después de recargar la construcción sigue siendo la misma
 * —el trozo falta de verdad, no es una pestaña vieja—, no vuelve a recargar y el
 * fallo sigue su curso normal (registro, pantalla de error). Sin esa guarda un
 * artefacto roto dejaría el navegador recargando en bucle.
 *
 * Dos puertas, según dónde ocurrió el fallo:
 *
 * - {@link recoverFrom}, **al navegar** (el router, `ErrorRecovery`): la
 *   pantalla nueva no llegó a abrirse, no hay nada escrito que perder y los
 *   `canDeactivate` ya se superaron. Recarga directamente.
 * - {@link recoverFromBackground}, **fuera de una navegación** (un `@defer`, el
 *   simulador): la persona puede estar a mitad de un formulario, y un corte de
 *   red da el mismo mensaje que un 404. Primero confirma con el servidor que
 *   hay otra construcción; sólo recarga si la pantalla acaba de abrirse, y si
 *   no deja marcada la pestaña para que el **próximo** cambio de pantalla sea
 *   una carga completa.
 */
@Injectable({ providedIn: 'root' })
export class StaleBuildRecovery {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly build = inject(BUILD_INFO);
  // Perezoso: el vigilante trae el Router, y este servicio lo inyecta el
  // `ErrorHandler`, que no puede depender del Router al construirse.
  private readonly injector = inject(Injector);

  /**
   * Fallo fuera de una navegación. Confirma con el servidor que hay una
   * construcción nueva (un corte de red no lo es) y recarga sólo si la
   * pantalla se abrió hace menos de {@link RECIEN_ABIERTA_MS}; si no, la
   * pestaña queda marcada y la próxima navegación hace la carga completa.
   * Resuelve `true` si recargó.
   */
  async recoverFromBackground(error: unknown): Promise<boolean> {
    if (!this.isBrowser || !isStaleBuildError(error)) return false;
    const watcher = this.injector.get(BuildVersionWatcher);
    await watcher.check();
    if (!watcher.outdated()) return false;
    if (watcher.msSinceNavigation() > RECIEN_ABIERTA_MS) return false;
    return this.recoverFrom(error);
  }

  /**
   * Si el fallo es de versión vieja, recarga hacia `destino` (o la página
   * actual) y devuelve `true`. Si no corresponde —otro fallo, el servidor, o ya
   * se intentó con esta misma construcción—, no toca nada y devuelve `false`.
   */
  recoverFrom(error: unknown, destino?: string): boolean {
    if (!this.isBrowser || !isStaleBuildError(error)) return false;

    const huella = buildFingerprint(this.build);
    const storage = sesion(this.document);
    // Sin almacenamiento de sesión no hay forma de saber si ya se recargó: se
    // prefiere mostrar el fallo antes que arriesgar un bucle.
    if (storage === null) return false;
    try {
      if (storage.getItem(RECOVERY_KEY) === huella) return false;
      storage.setItem(RECOVERY_KEY, huella);
    } catch {
      return false;
    }

    const location = this.document.defaultView?.location;
    if (location === undefined) return false;
    if (destino !== undefined && destino !== '') {
      location.assign(destino);
    } else {
      location.reload();
    }
    return true;
  }
}

/** Una pantalla abierta hace menos que esto todavía no tiene nada escrito que perder. */
export const RECIEN_ABIERTA_MS = 8_000;

/** Clave de `sessionStorage` con la huella de la última construcción recargada. */
export const RECOVERY_KEY = 'alovida.recarga-por-version';

/** Reexportada para quien ya la importaba de acá. */
export { buildFingerprint };

/**
 * Los textos con los que cada navegador informa que no pudo bajar un módulo, y
 * el código de Angular para un `@defer` cuyas dependencias no cargaron.
 *
 * - Chromium: `Failed to fetch dynamically imported module: …`
 * - Firefox: `error loading dynamically imported module: …`
 * - Safari: `Importing a module script failed.`
 * - Angular: `NG0750` (código `-750`) — `@defer` sin poder cargar.
 * - Webpack/esbuild antiguos: `ChunkLoadError`, `Loading chunk … failed`.
 */
const PATRONES = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading chunk [\w-]+ failed/i,
  /\bNG0750\b/,
] as const;

/** ¿El fallo es el de un trozo de la construcción que no se pudo bajar? */
export function isStaleBuildError(error: unknown): boolean {
  return encadenados(error).some((e) => {
    if (typeof e === 'object' && e !== null) {
      const { code, name } = e as { code?: unknown; name?: unknown };
      if (code === -750 || code === 750) return true;
      if (name === 'ChunkLoadError') return true;
    }
    const texto = mensaje(e);
    return texto !== '' && PATRONES.some((p) => p.test(texto));
  });
}

/** El error y sus causas (`cause`, `rejection` de una promesa no atendida), sin ciclos. */
function encadenados(error: unknown): unknown[] {
  const vistos: unknown[] = [];
  let actual: unknown = error;
  while (actual !== undefined && actual !== null && !vistos.includes(actual) && vistos.length < 5) {
    vistos.push(actual);
    if (typeof actual !== 'object') break;
    const { cause, rejection } = actual as { cause?: unknown; rejection?: unknown };
    actual = cause ?? rejection;
  }
  return vistos;
}

function mensaje(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const { message } = error as { message?: unknown };
    if (typeof message === 'string') return message;
  }
  return '';
}

function sesion(document: Document): Storage | null {
  try {
    return document.defaultView?.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * El fallo de carga de una ruta, a la espera de que la pantalla de recuperación
 * lo atienda.
 *
 * `app.routes.ts` convierte cada `import()` fallido de una ruta en
 * `ErrorRecovery` (`chunkFallido`). Devolver un componente en vez de relanzar
 * evita la navegación muerta, pero se tragaba el error: no quedaba código de
 * soporte ni se intentaba recargar. El cargador de la ruta corre fuera de un
 * contexto de inyección, así que deja el error acá y `ErrorRecovery` —que sí
 * puede inyectar— lo recoge al crearse.
 */
let falloDeRutaPendiente: { readonly error: unknown; readonly at: number } | null = null;

/** Pasado esto, un fallo pendiente es de una navegación que no terminó (un guard la canceló): se descarta. */
const VIGENCIA_DEL_FALLO_MS = 15_000;

export function recordRouteChunkFailure(error: unknown): void {
  falloDeRutaPendiente = { error, at: Date.now() };
}

/** Devuelve el fallo pendiente (una sola vez, si es reciente) o `null`. */
export function takeRouteChunkFailure(): { readonly error: unknown } | null {
  const pendiente = falloDeRutaPendiente;
  falloDeRutaPendiente = null;
  if (pendiente === null || Date.now() - pendiente.at > VIGENCIA_DEL_FALLO_MS) return null;
  return { error: pendiente.error };
}
