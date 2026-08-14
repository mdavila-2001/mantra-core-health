import { Injectable, InjectionToken, effect, inject, signal } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import type { TutorialDefinition, TutorialProgress, TutorialStatus } from './tutorial.types';

/**
 * Dónde vive el progreso, por cuenta.
 *
 * La clave lleva el identificador de usuario porque dos personas pueden usar el
 * mismo navegador —un mostrador compartido es el caso normal en una clínica— y
 * heredar el progreso de quien estuvo antes convierte la ayuda en ruido: se
 * ofrecerían como completados tutoriales que esta persona nunca vio.
 */
const CLAVE_BASE = 'mantra.tutoriales.progreso';

/**
 * El progreso de tutoriales de quien tiene la sesión abierta.
 *
 * ## Dónde se guarda, y por qué hoy es el navegador
 *
 * El almacenamiento está detrás de una interfaz —{@link TutorialStorageAdapter}—
 * con una sola implementación por ahora, la del navegador. **No es la decisión
 * final**: lo correcto para una cuenta autenticada es el backend, para que quien
 * empieza un tutorial en el consultorio lo continúe desde su casa.
 *
 * Se hizo así porque el backend **no tiene todavía** dónde guardarlo: no existe
 * un módulo de preferencias de usuario ni una tabla de progreso, y agregarlos es
 * una decisión de modelo de datos que no corresponde tomar de costado mientras
 * se construye una ayuda en pantalla. El contrato que haría falta está escrito
 * en `docs/tutoriales.md`, y cambiar de adaptador no toca ni el motor ni una
 * definición: es registrar otro proveedor.
 *
 * Lo que sí se resolvió acá es lo que **no** se puede posponer: que el progreso
 * sea por cuenta y no del navegador, y que un almacenamiento caído —modo
 * privado, cuota llena, un `localStorage` bloqueado por política— degrade a
 * memoria en vez de tumbar la pantalla.
 *
 * ## El versionado
 *
 * Se guarda con qué versión se completó cada tutorial. Un cambio de **mayor**
 * vuelve a marcarlo pendiente —el recorrido cambió de verdad—; uno de menor, no.
 * Obligar a repetir diez pasos porque alguien corrigió una tilde es la forma más
 * segura de que la gente deje de hacer los tutoriales.
 */
@Injectable({ providedIn: 'root' })
export class TutorialProgressStore {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(TUTORIAL_STORAGE);

  private readonly progreso = signal<ReadonlyMap<string, TutorialProgress>>(new Map());

  /** El progreso completo, por tutorial. */
  readonly all = this.progreso.asReadonly();

  constructor() {
    // Cambiar de cuenta cambia el progreso: sin esto, quien entra después ve el
    // avance del anterior. Se lee de nuevo, no se limpia — volver a entrar con
    // la cuenta de antes tiene que recuperar lo suyo.
    effect(() => {
      const usuario = this.auth.userId();
      this.progreso.set(this.storage.read(claveDe(usuario)));
    });
  }

  /** El progreso de un tutorial. Nunca `null`: sin registro, está pendiente. */
  of(tutorialId: string): TutorialProgress {
    return this.progreso().get(tutorialId) ?? pendiente(tutorialId);
  }

  /**
   * El estado de un tutorial **teniendo en cuenta su versión**.
   *
   * Un tutorial completado con una versión mayor anterior vuelve a estar
   * pendiente: lo que se aprendió ya no es lo que la pantalla hace.
   */
  statusOf(tutorial: TutorialDefinition): TutorialStatus {
    const guardado = this.of(tutorial.id);
    if (guardado.status !== 'completado') {
      return guardado.status;
    }
    return mayorDe(guardado.version) === mayorDe(tutorial.version) ? 'completado' : 'pendiente';
  }

  /** Cuánto del catálogo lleva hecho, de 0 a 1. Para la barra del centro. */
  progressOver(tutoriales: readonly TutorialDefinition[]): number {
    if (tutoriales.length === 0) {
      return 0;
    }
    const hechos = tutoriales.filter(
      (tutorial) => this.statusOf(tutorial) === 'completado',
    ).length;
    return hechos / tutoriales.length;
  }

  /** Si los requisitos de un tutorial ya están hechos. */
  prerequisitesMet(
    tutorial: TutorialDefinition,
    catalogo: readonly TutorialDefinition[],
  ): boolean {
    return (tutorial.prerequisites ?? []).every((id) => {
      const requisito = catalogo.find((candidato) => candidato.id === id);
      // Un requisito que no está en el catálogo de ESTA sesión no se exige: casi
      // siempre es un tutorial de otro rol, y exigir algo que no se puede hacer
      // deja el tutorial inalcanzable para siempre.
      return requisito === undefined || this.statusOf(requisito) === 'completado';
    });
  }

  started(tutorial: TutorialDefinition, stepId: string): void {
    const previo = this.of(tutorial.id);
    this.guardar({
      ...previo,
      status: 'en-curso',
      stepId,
      version: tutorial.version,
      startedAt: previo.startedAt ?? ahora(),
      lastSeenAt: ahora(),
    });
  }

  advanced(tutorialId: string, stepId: string): void {
    this.guardar({ ...this.of(tutorialId), stepId, lastSeenAt: ahora() });
  }

  completed(tutorial: TutorialDefinition): void {
    const previo = this.of(tutorial.id);
    this.guardar({
      ...previo,
      status: 'completado',
      stepId: null,
      version: tutorial.version,
      completedAt: ahora(),
      lastSeenAt: ahora(),
      // Se cuenta cada vez que se termina, no cada vez que se empieza: repetir
      // un tutorial es normal y saber cuántas veces se completó dice algo;
      // cuántas veces se abandonó a la mitad, también, pero es otro dato.
      repetitions: previo.repetitions + 1,
    });
  }

  /**
   * Se abandonó a la mitad.
   *
   * Queda en `omitido` **con el paso**, no en pendiente: la diferencia es que un
   * tutorial omitido ofrece «Continuar» y uno pendiente ofrece «Empezar», y esa
   * es la información que la persona necesita para decidir.
   */
  skipped(tutorialId: string, stepId: string | null): void {
    this.guardar({ ...this.of(tutorialId), status: 'omitido', stepId, lastSeenAt: ahora() });
  }

  /** Vuelve a cero un tutorial, para hacerlo de nuevo desde el principio. */
  reset(tutorialId: string): void {
    const previo = this.of(tutorialId);
    // Las repeticiones NO se borran: son historia de la persona, no estado del
    // recorrido, y reiniciar para repasar no debería aparentar que nunca lo hizo.
    this.guardar({ ...pendiente(tutorialId), repetitions: previo.repetitions });
  }

  /**
   * Actualiza en memoria y **después** delega en el adaptador.
   *
   * El orden importa: la pantalla se dibuja desde la señal, así que aunque el
   * guardado falle, el recorrido en curso sigue viéndose bien. Y el fallo del
   * adaptador no se propaga, por la misma razón por la que el adaptador del
   * navegador atrapa lo suyo: no poder persistir el avance de un tutorial no
   * puede tumbar la pantalla que la persona está usando. Se avisa por consola —
   * un error tragado en silencio es peor que uno ruidoso— pero el flujo sigue.
   */
  private guardar(entrada: TutorialProgress): void {
    const siguiente = new Map(this.progreso());
    siguiente.set(entrada.tutorialId, entrada);
    this.progreso.set(siguiente);

    try {
      this.storage.write(claveDe(this.auth.userId()), siguiente);
    } catch (error) {
      console.warn('No se pudo guardar el progreso de tutoriales.', error);
    }
  }
}

/**
 * Dónde se guarda el progreso.
 *
 * Existe para que cambiar el navegador por el backend sea registrar otro
 * proveedor y no tocar el motor. Las dos operaciones son síncronas a propósito:
 * la asincronía de una escritura remota se resuelve **dentro** del adaptador —
 * escribiendo local y sincronizando después—, porque un motor de tutoriales que
 * tiene que esperar una petición para pasar de paso se siente roto.
 */
export interface TutorialStorageAdapter {
  read(clave: string): ReadonlyMap<string, TutorialProgress>;
  write(clave: string, progreso: ReadonlyMap<string, TutorialProgress>): void;
}

/**
 * El adaptador del navegador.
 *
 * Todo pasa por `try`/`catch` y **ninguno se traga el error en silencio**: se
 * degrada a memoria y se avisa por consola una sola vez. `localStorage` tira en
 * más casos de los que parece —modo privado de Safari, cuota llena, política de
 * empresa— y ninguno de esos justifica que la aplicación deje de andar.
 */
class BrowserTutorialStorage implements TutorialStorageAdapter {
  private readonly memoria = new Map<string, ReadonlyMap<string, TutorialProgress>>();
  private avisado = false;

  read(clave: string): ReadonlyMap<string, TutorialProgress> {
    try {
      const crudo = localStorage.getItem(clave);
      if (crudo === null) {
        return this.memoria.get(clave) ?? new Map();
      }
      const plano = JSON.parse(crudo) as Record<string, TutorialProgress>;
      return new Map(Object.entries(plano));
    } catch (error) {
      this.avisar(error);
      return this.memoria.get(clave) ?? new Map();
    }
  }

  write(clave: string, progreso: ReadonlyMap<string, TutorialProgress>): void {
    this.memoria.set(clave, progreso);
    try {
      localStorage.setItem(clave, JSON.stringify(Object.fromEntries(progreso)));
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
      'No se pudo usar el almacenamiento local para el progreso de tutoriales; ' +
        'se guarda sólo en memoria durante esta sesión.',
      error,
    );
  }
}

/** El adaptador en uso. Se reemplaza en las pruebas y el día que haya backend. */
export const TUTORIAL_STORAGE = new InjectionToken<TutorialStorageAdapter>('TUTORIAL_STORAGE', {
  providedIn: 'root',
  factory: () =>
    // Bajo SSR no hay `localStorage`, y tocarlo tira. El progreso de tutoriales
    // no se renderiza en el servidor, así que un adaptador que no guarda nada es
    // exactamente lo correcto ahí.
    typeof localStorage === 'undefined' ? new NoopTutorialStorage() : new BrowserTutorialStorage(),
});

/** El que no guarda nada. Para el servidor. */
class NoopTutorialStorage implements TutorialStorageAdapter {
  read(): ReadonlyMap<string, TutorialProgress> {
    return new Map();
  }
  write(): void {
    /* No hay dónde, y no es un error: en el servidor no hay progreso que guardar. */
  }
}

/** La clave del almacenamiento para una cuenta. */
function claveDe(usuario: string | null): string {
  return `${CLAVE_BASE}.${usuario ?? 'anonimo'}`;
}

/** El estado inicial de un tutorial que nadie tocó. */
function pendiente(tutorialId: string): TutorialProgress {
  return {
    tutorialId,
    status: 'pendiente',
    stepId: null,
    version: '0.0',
    startedAt: null,
    completedAt: null,
    lastSeenAt: ahora(),
    repetitions: 0,
  };
}

/** La parte mayor de una versión `mayor.menor`. */
function mayorDe(version: string): string {
  return version.split('.')[0] ?? '0';
}

function ahora(): string {
  return new Date().toISOString();
}

/** Para el centro de tutoriales: el conteo por estado, de una pasada. */
export function contarPorEstado(
  tutoriales: readonly TutorialDefinition[],
  estadoDe: (tutorial: TutorialDefinition) => TutorialStatus,
): Readonly<Record<TutorialStatus, number>> {
  const conteo: Record<TutorialStatus, number> = {
    pendiente: 0,
    'en-curso': 0,
    completado: 0,
    omitido: 0,
  };
  for (const tutorial of tutoriales) {
    conteo[estadoDe(tutorial)] += 1;
  }
  return conteo;
}
