/* ============================================================================
    Contratos del motor de tutoriales.

    ## Qué es esto y qué no

    Un tutorial es un **dato**, no código. Se declara en un archivo de
    configuración y el motor lo ejecuta; agregar uno nuevo no toca ni una línea
    del motor. Esa es la única regla de diseño que no se negocia acá, porque es
    la que decide si dentro de seis meses hay treinta tutoriales o hay tres y un
    `if` gigante.

    ## Por qué los pasos apuntan por atributo y no por selector CSS

    Un paso apunta a `data-tutorial-id="agenda-selector-recurso"`, no a
    `.agenda__filtro > app-select`. La diferencia importa: la clase existe para
    dar estilo y cambia cuando alguien rediseña la pantalla, sin que nadie se
    entere de que rompió un tutorial. El atributo existe **sólo** para esto, así
    que borrarlo es una decisión explícita y se ve en el diff.

    ## Por qué un paso puede fallar sin romper nada

    En una aplicación real el elemento objetivo puede no estar: llega por una
    petición que todavía no volvió, depende de un rol que esta sesión no tiene, o
    sencillamente alguien lo borró. El motor espera un rato acotado y, si no
    aparece, **sigue** — el paso se salta y queda anotado. Un tutorial que se
    cuelga es peor que un tutorial que se saltea un paso.
    ========================================================================== */

/**
 * De qué lado del elemento se dibuja el globo.
 *
 * `auto` es el valor sano por defecto: el motor mide el elemento y elige el lado
 * con más espacio. Fijar un lado sirve cuando el objetivo está pegado a un borde
 * y la medición elige mal.
 */
export const TUTORIAL_PLACEMENTS = ['auto', 'top', 'bottom', 'left', 'right', 'center'] as const;
export type TutorialPlacement = (typeof TUTORIAL_PLACEMENTS)[number];

/**
 * Qué tiene que hacer la persona para que el paso avance.
 *
 * - `next`: leer y tocar «Siguiente». Es el caso corriente.
 * - `click`: hacer clic en el elemento resaltado. El paso avanza solo al
 *   detectarlo, y por eso estos pasos **no bloquean** el elemento.
 * - `input`: escribir algo en el campo resaltado.
 * - `navigate`: llegar a otra ruta. Avanza cuando la URL coincide.
 *
 * Los tres últimos son los que convierten un recorrido en una práctica: se
 * aprende haciendo, no mirando.
 */
export const TUTORIAL_ADVANCE_MODES = ['next', 'click', 'input', 'navigate'] as const;
export type TutorialAdvanceMode = (typeof TUTORIAL_ADVANCE_MODES)[number];

/** Cuánto cuesta un tutorial, para que quien elige sepa en qué se mete. */
export const TUTORIAL_LEVELS = ['inicial', 'intermedio', 'avanzado'] as const;
export type TutorialLevel = (typeof TUTORIAL_LEVELS)[number];

/** Un paso: una sola acción principal, explicada en una o dos frases. */
export interface TutorialStep {
  /** Único dentro del tutorial. Viaja en el progreso guardado. */
  readonly id: string;

  readonly title: string;

  /** Qué hacer y por qué. En segunda persona, sin jerga técnica. */
  readonly body: string;

  /**
   * El `data-tutorial-id` del elemento a resaltar.
   *
   * Omitirlo produce un paso **sin ancla**: el globo se centra en la pantalla.
   * Es lo correcto para el primer paso de un tutorial («esto es lo que vas a
   * aprender») y para el último, que no señalan nada.
   */
  readonly target?: string;

  readonly placement?: TutorialPlacement;

  /**
   * La ruta donde vive este paso.
   *
   * Si la URL actual no coincide, el motor **navega** antes de resaltar. Es lo
   * que permite que un tutorial cruce pantallas sin que la persona tenga que
   * saber a dónde ir.
   */
  readonly route?: string;

  readonly advanceOn?: TutorialAdvanceMode;

  /**
   * Cuánto esperar a un elemento que todavía no está, en milisegundos.
   *
   * Existe porque los elementos que importan casi siempre llegan después de una
   * petición. Cumplido el plazo el paso se salta: el motor no se cuelga.
   */
  readonly waitForTargetMs?: number;

  /**
   * Si el resaltado deja pasar el clic al elemento.
   *
   * `true` por defecto en los pasos con `advanceOn: 'click'` —no se puede pedir
   * que toquen algo y a la vez taparlo— y `false` en el resto, para que un clic
   * distraído no dispare una acción real en medio de una explicación.
   */
  readonly interactive?: boolean;

  /** Roles que ven este paso. Omitir = cualquiera que vea el tutorial. */
  readonly roles?: readonly string[];

  /** Qué decir si la persona se traba. Se muestra bajo el cuerpo, atenuado. */
  readonly hint?: string;
}

/** Un tutorial completo. Es todo lo que hace falta declarar para tener uno. */
export interface TutorialDefinition {
  readonly id: string;

  /**
   * Versión del contenido, `mayor.menor`.
   *
   * Sube de **mayor** cuando el recorrido cambia de verdad —pasos nuevos, otro
   * orden, otra pantalla—; de menor para una corrección de texto. El progreso
   * guardado lleva la versión con la que se completó, y sólo un cambio de mayor
   * vuelve a marcar el tutorial como pendiente: obligar a repetir un recorrido
   * de diez pasos porque alguien arregló una tilde es una forma segura de que
   * dejen de hacerse.
   */
  readonly version: string;

  readonly title: string;
  readonly description: string;

  /** Agrupa en el centro de ayuda. Coincide con el grupo del menú cuando aplica. */
  readonly category: string;

  /** Dónde empieza. El motor navega acá antes del primer paso. */
  readonly route?: string;

  /** Roles que pueden verlo. Omitir = cualquier sesión. */
  readonly roles?: readonly string[];

  readonly estimatedMinutes: number;
  readonly level: TutorialLevel;

  /**
   * Tutoriales que conviene haber hecho antes.
   *
   * No se bloquea el acceso: se avisa. Bloquear un tutorial por no haber hecho
   * otro convierte una ayuda en un trámite, y quien ya sabe usar la aplicación
   * no debería tener que fingir que aprende para llegar al que le interesa.
   */
  readonly prerequisites?: readonly string[];

  /** Qué hacer después. Se ofrece al terminar. */
  readonly next?: string;

  /**
   * Si se ofrece solo la primera vez que alguien entra a su ruta.
   *
   * Uno solo debería tenerlo —el de bienvenida—: dos tutoriales peleando por
   * abrirse al entrar es exactamente la experiencia que nadie quiere.
   */
  readonly autoStart?: boolean;

  readonly steps: readonly TutorialStep[];
}

/** En qué anda una persona con un tutorial. */
export const TUTORIAL_STATUSES = ['pendiente', 'en-curso', 'completado', 'omitido'] as const;
export type TutorialStatus = (typeof TUTORIAL_STATUSES)[number];

/** El progreso de una persona en un tutorial, tal como se guarda. */
export interface TutorialProgress {
  readonly tutorialId: string;
  readonly status: TutorialStatus;
  /** El paso en el que quedó, para poder continuar. */
  readonly stepId: string | null;
  /** Con qué versión se completó. Decide si hay que repetirlo. */
  readonly version: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly lastSeenAt: string;
  /** Cuántas veces se completó. Repetir un tutorial es normal, no un error. */
  readonly repetitions: number;
}

/**
 * Un problema de configuración detectado al registrar.
 *
 * Se acumulan y se reportan juntos en vez de tirar en el primero: quien arregla
 * configuraciones quiere la lista completa, no un problema por corrida.
 */
export interface TutorialConfigIssue {
  readonly tutorialId: string;
  readonly stepId?: string;
  readonly code: TutorialIssueCode;
  readonly message: string;
}

export const TUTORIAL_ISSUE_CODES = [
  'id-duplicado',
  'sin-pasos',
  'paso-duplicado',
  'version-invalida',
  'requisito-inexistente',
  'requisito-circular',
  'siguiente-inexistente',
  'ruta-invalida',
  'rol-imposible',
] as const;
export type TutorialIssueCode = (typeof TUTORIAL_ISSUE_CODES)[number];

/** Por qué un paso no se pudo mostrar. Se registra; no rompe el recorrido. */
export interface TutorialStepFailure {
  readonly tutorialId: string;
  readonly stepId: string;
  readonly reason: 'sin-elemento' | 'ruta-inalcanzable';
}
