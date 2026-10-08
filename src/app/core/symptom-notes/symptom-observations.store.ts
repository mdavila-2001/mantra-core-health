import { Injectable, InjectionToken, computed, effect, inject, signal } from '@angular/core';

import { AuthService } from '../auth/auth.service';

/**
 * Las observaciones de síntomas que el paciente decidió guardar desde «¿A qué especialista
 * consultar?» (pedido del propietario, 2026-10-08).
 *
 * ## Por qué en el dispositivo y no en el servidor
 *
 * El modelo no tiene dónde guarde el PACIENTE una observación libre: `clinical.observations` y
 * `chart.clinical_note_versions` sólo los escribe un profesional, y las encuestas sólo responden
 * invitaciones. Lo único que el paciente escribe y el servidor guarda es el **motivo de consulta**
 * de su reserva (`scheduling.appointment_bookings.reason_text`, máx. 500, visible sólo para quien
 * reserva y quien atiende). Por eso: la observación se guarda acá, por cuenta, y cuando el paciente
 * pide un turno viaja como ese motivo (`booking-new` la precarga, editable). Guardarla en el
 * servidor por sí sola pide una tabla nueva en el modelo canónico: no se inventa desde el front.
 */
export interface SintomaObservado {
  readonly id: string;
  /** Cómo se mostró: con el término del glosario y la forma llana. */
  readonly nombre: string;
  /** Código del glosario (p. ej. «CIE-10 R51»), si lo tiene. */
  readonly codigo: string | null;
}

export interface ObservacionDeSintomas {
  readonly id: string;
  /** ISO 8601. */
  readonly creada: string;
  /** Lo que la persona escribió o dictó, tal cual. */
  readonly texto: string;
  readonly sintomas: readonly SintomaObservado[];
  /** Si ya viajó como motivo de una reserva: no se vuelve a precargar. */
  readonly usada: boolean;
}

const CLAVE_BASE = 'alovida.observaciones-de-sintomas';
/** Cuántas se conservan: las más viejas se descartan. */
export const MAX_OBSERVACIONES = 30;
/** Una observación más vieja que esto ya no describe lo que le pasa hoy: no se precarga. */
const VIGENCIA_PARA_RESERVAR_MS = 14 * 24 * 60 * 60 * 1000;
/** Largo que declara `ConfirmBookingDto` para el motivo. */
const MAX_MOTIVO = 500;

@Injectable({ providedIn: 'root' })
export class SymptomObservationsStore {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(SYMPTOM_OBSERVATIONS_STORAGE);

  private readonly guardadas = signal<readonly ObservacionDeSintomas[]>([]);

  /** De la más nueva a la más vieja. */
  readonly lista = this.guardadas.asReadonly();

  /** La más reciente que todavía no viajó como motivo y sigue vigente. */
  readonly pendiente = computed<ObservacionDeSintomas | null>(() => {
    const ahora = Date.now();
    return this.guardadas().find((o) => !o.usada && ahora - Date.parse(o.creada) <= VIGENCIA_PARA_RESERVAR_MS) ?? null;
  });

  constructor() {
    effect(() => {
      this.guardadas.set(this.storage.read(claveDe(this.auth.userId())));
    });
  }

  guardar(texto: string, sintomas: readonly SintomaObservado[], ahora: Date = new Date()): ObservacionDeSintomas {
    const nueva: ObservacionDeSintomas = {
      id: `obs-${ahora.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      creada: ahora.toISOString(),
      texto: texto.trim(),
      sintomas: [...sintomas],
      usada: false,
    };
    this.escribir([nueva, ...this.guardadas()].slice(0, MAX_OBSERVACIONES));
    return nueva;
  }

  borrar(id: string): void {
    this.escribir(this.guardadas().filter((o) => o.id !== id));
  }

  /** Tras reservar con ella: deja de precargarse. */
  marcarUsada(id: string): void {
    this.escribir(this.guardadas().map((o) => (o.id === id ? { ...o, usada: true } : o)));
  }

  private escribir(siguiente: readonly ObservacionDeSintomas[]): void {
    this.guardadas.set(siguiente);
    try {
      this.storage.write(claveDe(this.auth.userId()), siguiente);
    } catch (error) {
      console.warn('No se pudo guardar la observación de síntomas.', error);
    }
  }
}

/**
 * La observación, escrita como motivo de consulta para el profesional: primero los síntomas con su
 * término del glosario, después lo que la persona contó con sus palabras. Cabe en 500 caracteres.
 */
export function comoMotivoDeConsulta(observacion: ObservacionDeSintomas): string {
  const sintomas = observacion.sintomas.map((s) => (s.codigo ? `${s.nombre} [${s.codigo}]` : s.nombre)).join('; ');
  const partes = [
    sintomas === '' ? null : `Síntomas: ${sintomas}.`,
    observacion.texto === '' ? null : `Lo que contó el paciente: «${observacion.texto}»`,
  ].filter((p): p is string => p !== null);
  const motivo = partes.join(' ');
  return motivo.length <= MAX_MOTIVO ? motivo : `${motivo.slice(0, MAX_MOTIVO - 1)}…`;
}

/** Mismo patrón adaptador que `HelpBlockDismissalStore`: sincrónico y reemplazable en las pruebas. */
export interface SymptomObservationsStorageAdapter {
  read(clave: string): readonly ObservacionDeSintomas[];
  write(clave: string, observaciones: readonly ObservacionDeSintomas[]): void;
}

/** El adaptador del navegador. Degrada a memoria si `localStorage` falla. */
class BrowserSymptomObservationsStorage implements SymptomObservationsStorageAdapter {
  private readonly memoria = new Map<string, readonly ObservacionDeSintomas[]>();

  read(clave: string): readonly ObservacionDeSintomas[] {
    try {
      const crudo = localStorage.getItem(clave);
      if (crudo === null) {
        return this.memoria.get(clave) ?? [];
      }
      const leido: unknown = JSON.parse(crudo);
      return Array.isArray(leido) ? (leido as ObservacionDeSintomas[]) : [];
    } catch {
      return this.memoria.get(clave) ?? [];
    }
  }

  write(clave: string, observaciones: readonly ObservacionDeSintomas[]): void {
    this.memoria.set(clave, observaciones);
    localStorage.setItem(clave, JSON.stringify(observaciones));
  }
}

/** Para el servidor: bajo SSR no hay `localStorage` ni nada que guardar. */
class NoopSymptomObservationsStorage implements SymptomObservationsStorageAdapter {
  read(): readonly ObservacionDeSintomas[] {
    return [];
  }
  write(): void {
    /* En el servidor no hay dónde, y no es un error. */
  }
}

export const SYMPTOM_OBSERVATIONS_STORAGE = new InjectionToken<SymptomObservationsStorageAdapter>(
  'SYMPTOM_OBSERVATIONS_STORAGE',
  {
    providedIn: 'root',
    factory: () =>
      typeof localStorage === 'undefined'
        ? new NoopSymptomObservationsStorage()
        : new BrowserSymptomObservationsStorage(),
  },
);

/** Por cuenta: dos personas pueden compartir el navegador. */
function claveDe(usuario: string | null): string {
  return `${CLAVE_BASE}.${usuario ?? 'anonimo'}`;
}
