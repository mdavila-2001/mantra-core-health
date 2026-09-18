import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
} from '@angular/core';

import type { ThemeMode } from '../../../../core/tokens/design-tokens.types';
import { ThemeService } from '../../../../core/tokens/theme.service';
import { prefersReducedMotion } from '../../../motion/motion-tokens';
import { PointerScene } from '../../../motion/pointer-scene.directive';
import { parkLoops, pauseLoops, resumeLoops } from '../../../motion/scene-loops';
import { SceneQuality } from '../../../motion/scene-quality';
import { AppButton } from '../../atoms/button/button';
import { AuthStage } from '../auth-stage/auth-stage';

/** Las tres medidas del hueco del formulario. Ver `AuthSplit.contentWidth`. */
export type AuthSplitWidth = 'form' | 'wide' | 'full';

/** Las dos puestas en escena. Ver `AuthSplit.scene`. */
export type AuthSplitScene = 'split' | 'stage';

/** Marca de sesión: la secuencia de entrada ya se vio en esta pestaña. */
const INTRO_SEEN_KEY = 'alovida:auth-intro-seen';

/**
 * Cuánto dura la secuencia de entrada de punta a punta (ignición a los 2,1 s
 * más la cascada del formulario). Pasado esto no queda nada que saltar y se
 * sueltan los oyentes.
 */
const INTRO_DURATION_MS = 4200;

function introAlreadySeen(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Sin almacenamiento (navegación privada estricta) la secuencia se
    // vuelve a ver la próxima vez: es lo único que se pierde.
  }
}

/**
 * Lleva al final toda animación CSS FINITA de la escena: la secuencia de
 * entrada termina de golpe y los bucles (el cometa, las ondas, las auroras)
 * siguen como si nada. Terminar y no cancelar: cancelar devolvería cada
 * pieza a su fotograma de partida, que es invisible.
 */
function finishIntro(root: HTMLElement): void {
  if (typeof root.getAnimations !== 'function') {
    return;
  }
  for (const animation of root.getAnimations({ subtree: true })) {
    const iterations = animation.effect?.getComputedTiming().iterations;
    if (animation instanceof CSSAnimation && iterations !== Infinity) {
      animation.finish();
    }
  }
}

/**
 * Estructura partida de las pantallas de acceso: columna de marca a la
 * izquierda y panel de formulario a la derecha.
 *
 * Es la forma del diseño que entregó el diseñador para el alta de profesional,
 * adoptada como estructura común de login y registro para que las dos pantallas
 * se vean de la misma familia.
 *
 * ```html
 * <app-auth-split claim="Tu salud, conectada" tagline="La red más grande…">
 *   <h1>Iniciar sesión</h1>
 *   <form>…</form>
 * </app-auth-split>
 * ```
 *
 * ## El fondo vivo
 *
 * Las dos columnas llevan una aurora —masas de color que derivan solas— y toda
 * la escena se corre con el puntero a través de `appPointerScene`, que publica
 * las variables `--pointer-*` en el nodo raíz. La composición es enteramente
 * CSS: acá no hay ni un `requestAnimationFrame` propio. Se apaga sola con
 * `prefers-reduced-motion` y el paralaje ni siquiera se engancha en pantallas
 * táctiles.
 *
 * **No sabe qué es un token**: es puro layout. El único servicio que toca es el
 * de tema, porque una persona ajusta claro/oscuro **antes** de entrar y ese
 * control tiene que existir también fuera de la aplicación autenticada — hasta
 * ahora solo vivía en la vitrina.
 */
@Component({
  selector: 'app-auth-split',
  imports: [AppButton, AuthStage, PointerScene],
  templateUrl: './auth-split.html',
  styleUrl: './auth-split.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthSplit {
  private readonly themeService = inject(ThemeService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sceneQuality = inject(SceneQuality);

  constructor() {
    // Solo en el navegador: bajo SSR no hay animaciones ni almacenamiento.
    afterNextRender(() => {
      if (this.scene() === 'stage') {
        this.armIntroSkip();
      }
      // Con «reducir movimiento» el CSS ya apagó todo: no hay bucles que cuidar.
      if (!prefersReducedMotion()) {
        this.armSceneBudget();
      }
    });
  }

  /** Titular grande de la columna de marca. */
  readonly claim = input.required<string>();

  /** Bajada del titular. */
  readonly tagline = input<string>('');

  /**
   * Cuánto ancho puede ocupar el formulario proyectado.
   *
   * `form` (27 rem) es la medida de un formulario de acceso: pocos campos, uno
   * debajo del otro. `wide` (40 rem) es para altas largas que agrupan campos
   * cortos de a dos por fila —el registro— y que a 27 rem quedarían con dos
   * columnas de menos de 200 px.
   *
   * `full` es otra cosa, y por eso no es «otro número»: **se lleva la columna
   * de marca** y le da la ventana entera al formulario. Es para las altas que
   * sirve el motor por partes, donde el contenido de una página son cuatro
   * campos y una barra de avance: encerrado en 40 rem contra media pantalla,
   * el paso se leía como una tarjetita en una esquina en vez de como la tarea
   * que la persona vino a hacer. Sin la columna, el fondo vivo y el selector de
   * tema siguen ahí —pasan a ocupar toda la escena—, y la marca la sostiene la
   * píldora de `__marca-mini`, que en este modo se muestra también en
   * escritorio.
   *
   * Existe como entrada y no como una regla suelta porque la limitación **tiene
   * que vivir en esta plantilla**: con encapsulación emulada, un selector de
   * este componente no alcanza al contenido proyectado, así que la pantalla de
   * adentro no puede fijarse el ancho a sí misma.
   */
  readonly contentWidth = input<AuthSplitWidth>('form');

  /**
   * Cómo se pone en escena la pantalla.
   *
   * `split` es la estructura partida de siempre: columna de marca a la
   * izquierda, formulario sobre la superficie del tema a la derecha. La usan
   * las altas, que proyectan formularios SIN tarjeta propia y necesitan esa
   * superficie clara debajo para leerse.
   *
   * `stage` convierte la ventana entera en el escenario del latido: el trazo
   * de ECG cruza de punta a punta —por detrás de la tarjeta—, con auroras,
   * cuadrícula de monitor y motas detrás. Solo sirve para contenido que trae
   * su propia tarjeta opaca (el acceso): el escenario es oscuro en los dos
   * temas, como lo era la columna de marca, y un texto suelto encima no se
   * leería en claro.
   */
  readonly scene = input<AuthSplitScene>('split');

  /**
   * El titular y la bajada, envueltos en una lista de un solo elemento para
   * poder recorrerlos con `@for … track`.
   *
   * No es adorno: en el registro el texto cambia al elegir paciente o
   * profesional, y una interpolación a secas lo reemplazaría de golpe, sin
   * transición. Con `track` sobre el propio texto, cambiarlo destruye el nodo y
   * crea otro, así que la animación de entrada vuelve a correr y el titular
   * nuevo aparece en vez de aparecer ya puesto.
   *
   * Van como `computed` y no como literal en la plantilla para no alojar un
   * arreglo nuevo en cada detección de cambios.
   */
  protected readonly claimKeyed = computed(() => [this.claim()]);
  protected readonly taglineKeyed = computed(() => {
    const texto = this.tagline();
    return texto === '' ? [] : [texto];
  });

  protected readonly theme = this.themeService.currentTheme;

  protected readonly themeOptions: readonly { mode: ThemeMode; label: string }[] = [
    { mode: 'light', label: 'Claro' },
    { mode: 'dark', label: 'Oscuro' },
    { mode: 'system', label: 'Sistema' },
  ];

  protected setTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }

  /**
   * La secuencia de entrada del escenario se ve completa UNA vez por sesión y
   * se salta con cualquier tecla o clic, como la de un juego. No es cortesía:
   * quien vuelve al acceso después de cerrar sesión viene a trabajar, y tres
   * segundos de espectáculo antes de poder escribir la contraseña serían un
   * peaje. El formulario, además, es usable durante la secuencia: la primera
   * tecla que se escribe en él ya la termina.
   */
  private armIntroSkip(): void {
    const root = this.host.nativeElement;
    if (introAlreadySeen()) {
      finishIntro(root);
      return;
    }

    // La marca de «vista» se pone cuando la secuencia TERMINA o se salta, no
    // al empezar: en desarrollo el acceso se monta dos veces en la misma carga
    // (medido: dos armados con 19 ms de diferencia), y marcar al empezar hacía
    // que la segunda instancia leyera «ya vista» y la saltara sola.
    const doc = root.ownerDocument;
    const release = (): void => {
      doc.removeEventListener('keydown', skip, true);
      doc.removeEventListener('pointerdown', skip, true);
      clearTimeout(timer);
    };
    const complete = (): void => {
      markIntroSeen();
      release();
    };
    const skip = (): void => {
      finishIntro(root);
      complete();
    };
    doc.addEventListener('keydown', skip, true);
    doc.addEventListener('pointerdown', skip, true);
    const timer = setTimeout(complete, INTRO_DURATION_MS);
    // Destruirse no es verla: solo se sueltan los oyentes.
    this.destroyRef.onDestroy(release);
  }

  /**
   * Que el fondo no le cueste a la persona el formulario.
   *
   * Dos reglas, medidas el 2026-09-18 en `/auth` dibujando sin GPU: la escena
   * completa va a 9–13 cuadros por segundo, y escribir 19 letras en el correo
   * tardó 1 260 ms con el procesador lento contra 59 ms con la escena quieta.
   *
   * 1. **Equipo que no la sostiene → escena en reposo.** Lo decide
   *    `SceneQuality`; acá se termina la secuencia de encendido (a nueve
   *    cuadros son tres segundos de tirones) y se estacionan los bucles.
   * 2. **Mientras el foco está en el formulario, el fondo se congela.** Vale
   *    para todos los equipos: quien escribe no mira el fondo, y la mitad del
   *    trabajo de cada cuadro se va en recomponerlo. Vuelve a moverse cuando
   *    el foco sale de la pantalla.
   */
  private armSceneBudget(): void {
    const root = this.host.nativeElement;
    let destroyed = false;

    void this.sceneQuality.assess().then((lite) => {
      if (lite && !destroyed) {
        finishIntro(root);
        parkLoops(root);
      }
    });

    const onFocusIn = (): void => {
      pauseLoops(root);
    };
    const onFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget;
      if (next instanceof Node && root.contains(next)) {
        return;
      }
      // En versión liviana los bucles están estacionados: reanudarlos sería
      // devolverle al equipo justo lo que no sostiene.
      if (!this.sceneQuality.lite()) {
        resumeLoops(root);
      }
    };
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);

    this.destroyRef.onDestroy(() => {
      destroyed = true;
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
    });
  }
}
