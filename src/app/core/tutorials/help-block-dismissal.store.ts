import { Injectable, InjectionToken, effect, inject, signal } from '@angular/core';

import { AuthService } from '../auth/auth.service';

/**
 * Dónde vive qué ayudas se cerraron, por cuenta.
 *
 * Mismo motivo que `tutorial-progress.store.ts`: dos personas pueden compartir
 * navegador, y heredar los cierres de quien estuvo antes escondería una
 * explicación que esta persona nunca vio.
 */
const CLAVE_BASE = 'mantra.ayudas.descartadas';

/**
 * Qué bloques de ayuda por pestaña cerró quien tiene la sesión abierta.
 *
 * Es deliberadamente más simple que {@link TutorialProgressStore}: acá no hay
 * pasos ni versión, sólo un conjunto de identificadores cerrados. Un cambio de
 * contenido del bloque no lo vuelve a mostrar solo — si hace falta forzarlo,
 * se cambia el `helpId` en el llamador, mismo criterio que forzar un tutorial
 * nuevo cambiando su `id`.
 */
@Injectable({ providedIn: 'root' })
export class HelpBlockDismissalStore {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(HELP_BLOCK_STORAGE);

  private readonly descartadas = signal<ReadonlySet<string>>(new Set());

  constructor() {
    effect(() => {
      const usuario = this.auth.userId();
      this.descartadas.set(this.storage.read(claveDe(usuario)));
    });
  }

  isDismissed(helpId: string): boolean {
    return this.descartadas().has(helpId);
  }

  dismiss(helpId: string): void {
    const siguiente = new Set(this.descartadas());
    siguiente.add(helpId);
    this.descartadas.set(siguiente);

    try {
      this.storage.write(claveDe(this.auth.userId()), siguiente);
    } catch (error) {
      console.warn('No se pudo guardar qué ayudas se cerraron.', error);
    }
  }
}

/** Mismo patrón adaptador que `TutorialStorageAdapter`: sincrónico, reemplazable. */
export interface HelpBlockStorageAdapter {
  read(clave: string): ReadonlySet<string>;
  write(clave: string, descartadas: ReadonlySet<string>): void;
}

/** El adaptador del navegador. Degrada a memoria si `localStorage` falla. */
class BrowserHelpBlockStorage implements HelpBlockStorageAdapter {
  private readonly memoria = new Map<string, ReadonlySet<string>>();
  private avisado = false;

  read(clave: string): ReadonlySet<string> {
    try {
      const crudo = localStorage.getItem(clave);
      if (crudo === null) {
        return this.memoria.get(clave) ?? new Set();
      }
      return new Set(JSON.parse(crudo) as string[]);
    } catch (error) {
      this.avisar(error);
      return this.memoria.get(clave) ?? new Set();
    }
  }

  write(clave: string, descartadas: ReadonlySet<string>): void {
    this.memoria.set(clave, descartadas);
    try {
      localStorage.setItem(clave, JSON.stringify([...descartadas]));
    } catch (error) {
      this.avisar(error);
    }
  }

  private avisar(error: unknown): void {
    if (this.avisado) {
      return;
    }
    this.avisado = true;
    console.warn(
      'No se pudo usar el almacenamiento local para las ayudas cerradas; ' +
        'se guarda sólo en memoria durante esta sesión.',
      error,
    );
  }
}

/** El que no guarda nada. Para el servidor: bajo SSR no hay `localStorage`. */
class NoopHelpBlockStorage implements HelpBlockStorageAdapter {
  read(): ReadonlySet<string> {
    return new Set();
  }
  write(): void {
    /* No hay dónde, y no es un error: en el servidor no hay nada que cerrar. */
  }
}

export const HELP_BLOCK_STORAGE = new InjectionToken<HelpBlockStorageAdapter>(
  'HELP_BLOCK_STORAGE',
  {
    providedIn: 'root',
    factory: () =>
      typeof localStorage === 'undefined'
        ? new NoopHelpBlockStorage()
        : new BrowserHelpBlockStorage(),
  },
);

/** La clave del almacenamiento para una cuenta. */
function claveDe(usuario: string | null): string {
  return `${CLAVE_BASE}.${usuario ?? 'anonimo'}`;
}
