import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';

/** Dónde se guarda lo que la persona ya conoció. Lleva el usuario, como el progreso de tutoriales. */
const STORAGE_KEY = 'alovida.primeros-pasos';

/** Lo que se recuerda por cuenta. */
interface FirstStepsMemory {
  /** Prefijos de ruta que ya visitó, p. ej. `/my-account/pharmacy`. */
  readonly visited: readonly string[];
  /** Si cerró la tarjeta después de completarla. */
  readonly dismissed: boolean;
  /** Si plegó la lista para dejar sólo el título y el avance. */
  readonly collapsed: boolean;
}

const EMPTY: FirstStepsMemory = { visited: [], dismissed: false, collapsed: false };

/**
 * «Primeros pasos» del paciente — qué secciones ya conoció.
 *
 * ## Por qué existe
 *
 * El paciente que entra por primera vez no sabe qué hay detrás de cada entrada
 * del menú, y quien se aburre rápido no lee un manual. La lista de primeros
 * pasos le da **una cosa por vez** y le muestra el avance; ver la barra llenarse
 * es lo que hace que vuelva a tocar la siguiente.
 *
 * ## Qué se guarda y dónde
 *
 * Sólo las rutas que ya abrió, en el navegador y por cuenta —la misma decisión
 * que `TutorialProgressStore` y por el mismo motivo: el backend no tiene un
 * módulo de preferencias de usuario—. No es un dato clínico ni de negocio: si
 * se pierde, la lista vuelve a empezar y nada más. Bajo SSR, o con el
 * almacenamiento bloqueado, se degrada a memoria.
 *
 * Las misiones que **sí** tienen un dato real detrás —tener una cita, haber
 * hecho el recorrido— no se leen de acá: las resuelve el inicio con lo que ya
 * trae de la API y del progreso de tutoriales.
 */
@Injectable({ providedIn: 'root' })
export class FirstStepsStore {
  private readonly auth = inject(AuthService);

  private readonly memory = signal<FirstStepsMemory>(EMPTY);

  /** Prefijos de ruta visitados por la cuenta en sesión. */
  readonly visited = computed(() => this.memory().visited);

  /** Si la persona cerró la tarjeta ya completa. */
  readonly dismissed = computed(() => this.memory().dismissed);

  /** Si la persona plegó la lista. Se recuerda: plegarla y que vuelva abierta en cada visita molesta. */
  readonly collapsed = computed(() => this.memory().collapsed);

  private tracking = false;

  constructor() {
    effect(() => {
      this.memory.set(read(keyFor(this.auth.userId())));
    });
  }

  /**
   * Empieza a anotar las rutas que se abren. Lo llama el armazón una sola vez;
   * llamarlo de nuevo no duplica la suscripción.
   */
  track(router: Router, destroyRef: DestroyRef): void {
    if (this.tracking) {
      return;
    }
    this.tracking = true;
    this.markVisited(router.url);
    const subscription = router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.markVisited(event.urlAfterRedirects));
    destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      this.tracking = false;
    });
  }

  /** Si alguna vez abrió una ruta que empieza por `prefix`. */
  hasVisited(prefix: string): boolean {
    return this.memory().visited.some((route) => route === prefix || route.startsWith(prefix + '/'));
  }

  /** Cierra la tarjeta. Sólo se ofrece cuando ya completó todo. */
  dismiss(): void {
    this.save({ ...this.memory(), dismissed: true });
  }

  /** Pliega o despliega la lista de pasos. */
  toggleCollapsed(): void {
    this.save({ ...this.memory(), collapsed: !this.memory().collapsed });
  }

  private markVisited(url: string): void {
    const route = url.split(/[?#]/)[0];
    if (route === '' || this.memory().visited.includes(route)) {
      return;
    }
    this.save({ ...this.memory(), visited: [...this.memory().visited, route] });
  }

  private save(next: FirstStepsMemory): void {
    this.memory.set(next);
    write(keyFor(this.auth.userId()), next);
  }
}

function keyFor(userId: string | null): string {
  return `${STORAGE_KEY}.${userId ?? 'anonimo'}`;
}

function read(key: string): FirstStepsMemory {
  if (typeof localStorage === 'undefined') {
    return EMPTY;
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return EMPTY;
    }
    const parsed = JSON.parse(raw) as Partial<FirstStepsMemory>;
    return {
      visited: Array.isArray(parsed.visited) ? parsed.visited.filter(isString) : [],
      dismissed: parsed.dismissed === true,
      collapsed: parsed.collapsed === true,
    };
  } catch {
    // Un valor corrupto o un almacenamiento bloqueado no tumban el inicio:
    // la lista vuelve a empezar, que es lo peor que puede pasar.
    return EMPTY;
  }
}

function write(key: string, value: FirstStepsMemory): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('No se pudo guardar el avance de «Primeros pasos»; queda sólo en memoria.', error);
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
