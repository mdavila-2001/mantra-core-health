import { Injectable, InjectionToken, inject, signal } from '@angular/core';

/**
 * La ambulancia de confianza: con ella, el botón de emergencia llama directo en vez de mostrar la
 * lista de números (pedido del propietario, 2026-10-08). Se configura al registrarse o desde el
 * propio botón.
 *
 * ## Por qué en el dispositivo
 *
 * El modelo no tiene dónde guardarla: `profiles.related_persons` es para personas (contacto de
 * emergencia, tutor), no para un servicio, y no hay una tabla de preferencias por usuario. Además
 * se carga en el registro, antes de que exista la cuenta. Queda en este dispositivo —y la pantalla lo
 * dice—; llevarla al servidor pide una tabla en el modelo canónico.
 */
export interface AmbulanciaDeConfianza {
  readonly nombre: string;
  /** Tal como lo devuelve `app-phone-input` (con prefijo de país). */
  readonly telefono: string;
}

const CLAVE = 'alovida.ambulancia-de-confianza';
/** El nombre cuando la persona sólo cargó el teléfono. */
export const NOMBRE_POR_DEFECTO = 'Mi ambulancia de confianza';

@Injectable({ providedIn: 'root' })
export class TrustedAmbulanceStore {
  private readonly storage = inject(TRUSTED_AMBULANCE_STORAGE);
  private readonly guardada = signal<AmbulanciaDeConfianza | null>(this.storage.read(CLAVE));

  readonly ambulancia = this.guardada.asReadonly();

  guardar(nombre: string, telefono: string): void {
    const numero = telefono.trim();
    if (numero === '') {
      return;
    }
    const ambulancia = { nombre: nombre.trim() || NOMBRE_POR_DEFECTO, telefono: numero };
    this.guardada.set(ambulancia);
    this.storage.write(CLAVE, ambulancia);
  }

  quitar(): void {
    this.guardada.set(null);
    this.storage.write(CLAVE, null);
  }
}

export interface TrustedAmbulanceStorageAdapter {
  read(clave: string): AmbulanciaDeConfianza | null;
  write(clave: string, ambulancia: AmbulanciaDeConfianza | null): void;
}

class BrowserTrustedAmbulanceStorage implements TrustedAmbulanceStorageAdapter {
  read(clave: string): AmbulanciaDeConfianza | null {
    try {
      const crudo = localStorage.getItem(clave);
      if (crudo === null) {
        return null;
      }
      const leido = JSON.parse(crudo) as Partial<AmbulanciaDeConfianza> | null;
      return leido && typeof leido.telefono === 'string' && leido.telefono !== ''
        ? { nombre: typeof leido.nombre === 'string' && leido.nombre !== '' ? leido.nombre : NOMBRE_POR_DEFECTO, telefono: leido.telefono }
        : null;
    } catch {
      return null;
    }
  }

  write(clave: string, ambulancia: AmbulanciaDeConfianza | null): void {
    try {
      if (ambulancia === null) {
        localStorage.removeItem(clave);
      } else {
        localStorage.setItem(clave, JSON.stringify(ambulancia));
      }
    } catch (error) {
      console.warn('No se pudo guardar la ambulancia de confianza en este dispositivo.', error);
    }
  }
}

/** Bajo SSR no hay `localStorage`: el botón muestra la lista de números. */
class NoopTrustedAmbulanceStorage implements TrustedAmbulanceStorageAdapter {
  read(): AmbulanciaDeConfianza | null {
    return null;
  }
  write(): void {
    /* En el servidor no hay dónde. */
  }
}

export const TRUSTED_AMBULANCE_STORAGE = new InjectionToken<TrustedAmbulanceStorageAdapter>(
  'TRUSTED_AMBULANCE_STORAGE',
  {
    providedIn: 'root',
    factory: () =>
      typeof localStorage === 'undefined'
        ? new NoopTrustedAmbulanceStorage()
        : new BrowserTrustedAmbulanceStorage(),
  },
);
