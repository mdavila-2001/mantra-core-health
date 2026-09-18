import { Injectable, signal } from '@angular/core';

/** Dónde se recuerda, durante la sesión del navegador, que este equipo no sostiene la escena. */
const LITE_SCENE_KEY = 'alovida:scene-lite';

/**
 * Mediana del tiempo de cuadro desde la que la escena se da por insostenible.
 *
 * 25 ms son 40 cuadros por segundo. Medido el 2026-09-18 en `/auth`: con GPU la
 * mediana es 16,7 ms; dibujando por software (el caso de un equipo modesto o
 * con la aceleración por hardware apagada), 84 ms a 1366×768 y 117 ms a
 * 1920×1080. El umbral queda lejos de los dos lados.
 */
const MAX_SMOOTH_FRAME_MS = 25;

/** Lo que se deja pasar antes de medir: el arranque de la app no es la escena. */
const WARMUP_MS = 500;

/** Cuánto se mide. */
const SAMPLE_MS = 1000;

/** Con menos cuadros que estos en la ventana, la mediana no dice nada. */
const MIN_SAMPLES = 5;

/** Núcleos lógicos o GB de memoria desde los que ni se intenta la escena animada. */
const LOW_END_CORES = 2;
const LOW_END_MEMORY_GB = 2;

/** Lo que Chromium expone además de lo tipado en `lib.dom`. */
type NavigatorHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

/**
 * Decide si las escenas decorativas corren completas o en su versión quieta.
 *
 * Existe porque el escenario del acceso —esferas, rayos, piso en perspectiva,
 * grano, todo en bucle— va a 60 cuadros con una GPU decente y a 9–13 sin ella,
 * y a esa cadencia escribir en el campo de correo llega a tardar más de un
 * segundo. La versión quieta es la misma escena, estacionada en su reposo.
 *
 * Dos señales, en orden:
 *
 * 1. **Lo que declara el equipo**: muy pocos núcleos, muy poca memoria o el
 *    ahorro de datos pedido. Decide sin medir.
 * 2. **Lo que se mide**: la mediana del tiempo de cuadro durante un segundo.
 *    Es la señal buena —un equipo de ocho núcleos con la aceleración apagada
 *    no declara nada raro y aun así no llega—, y la mediana no se deja
 *    engañar por una tarea larga suelta del arranque.
 *
 * Cuando da «liviana» se recuerda en `sessionStorage`, así la pantalla
 * siguiente (elegir tipo de cuenta, volver al acceso) arranca quieta sin pagar
 * otro segundo de medición a nueve cuadros.
 */
@Injectable({ providedIn: 'root' })
export class SceneQuality {
  private readonly liteState = signal(readRememberedLite());

  /** `true` cuando las escenas deben quedarse en su reposo. */
  readonly lite = this.liteState.asReadonly();

  private pending: Promise<boolean> | null = null;

  /**
   * Resuelve si la escena corre en versión liviana, midiendo si hace falta.
   *
   * Varias escenas que preguntan a la vez comparten la misma medición: en
   * desarrollo el acceso se monta dos veces y dos contadores de cuadros
   * simultáneos se estorbarían entre sí.
   */
  assess(): Promise<boolean> {
    if (this.lite()) {
      return Promise.resolve(true);
    }
    if (deviceLooksLowEnd(navigator as NavigatorHints)) {
      this.markLite();
      return Promise.resolve(true);
    }
    this.pending ??= medianFrameMs().then((frameMs) => {
      if (frameMs === null) {
        // Pestaña oculta: no hubo cuadros que medir. Se vuelve a intentar la
        // próxima vez en vez de dar el equipo por bueno sin evidencia.
        this.pending = null;
        return false;
      }
      if (frameMs > MAX_SMOOTH_FRAME_MS) {
        this.markLite();
      }
      return this.lite();
    });
    return this.pending;
  }

  private markLite(): void {
    this.liteState.set(true);
    try {
      sessionStorage.setItem(LITE_SCENE_KEY, '1');
    } catch {
      // Sin almacenamiento se vuelve a medir en la próxima pantalla: es lo único que se pierde.
    }
  }
}

function readRememberedLite(): boolean {
  try {
    return sessionStorage.getItem(LITE_SCENE_KEY) === '1';
  } catch {
    return false;
  }
}

function deviceLooksLowEnd(hints: NavigatorHints): boolean {
  if (hints.connection?.saveData === true) {
    return true;
  }
  if (hints.hardwareConcurrency > 0 && hints.hardwareConcurrency <= LOW_END_CORES) {
    return true;
  }
  return hints.deviceMemory !== undefined && hints.deviceMemory <= LOW_END_MEMORY_GB;
}

/**
 * La mediana del intervalo entre cuadros, en milisegundos.
 *
 * Con la pestaña visible y menos de {@link MIN_SAMPLES} cuadros en un segundo,
 * el equipo va a menos de cinco cuadros por segundo: eso ya es la respuesta, y
 * se devuelve `Infinity`. Con la pestaña oculta el navegador no pide cuadros y
 * no hay nada que concluir: `null`.
 */
function medianFrameMs(): Promise<number | null> {
  return new Promise((resolve) => {
    const intervals: number[] = [];
    let previous: number | null = null;
    let frame = 0;

    const tick = (now: number): void => {
      if (previous !== null) {
        intervals.push(now - previous);
      }
      previous = now;
      frame = requestAnimationFrame(tick);
    };

    setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, WARMUP_MS);

    setTimeout(() => {
      cancelAnimationFrame(frame);
      if (intervals.length >= MIN_SAMPLES) {
        resolve(median(intervals));
        return;
      }
      resolve(document.visibilityState === 'visible' ? Infinity : null);
    }, WARMUP_MS + SAMPLE_MS);
  });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
