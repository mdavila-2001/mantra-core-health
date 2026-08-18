/**
 * El dominio del test, independiente del motor de navegador.
 *
 * ## Por qué esto es declarativo y no un «driver» compartido
 *
 * Cypress conduce con una cola de comandos encadenables y Playwright con
 * promesas. Una capa que intente unificar las dos formas de esperar termina
 * siendo más frágil que las dos suites que quería evitar — y cuando falla, falla
 * en la abstracción, que es el peor lugar para depurar.
 *
 * Así que acá no hay ejecución: hay **qué** pasa, en qué orden, con qué actor y
 * qué tiene que ser cierto al final. Cada adaptador interpreta lo mismo con sus
 * propias primitivas, y la comparación entre los dos es honesta porque parten de
 * la misma definición.
 *
 * ## Regla de verdad única
 *
 * Si Playwright y Cypress difieren sobre el mismo `JourneyId`, no se elige el
 * que pasó: se investiga el desacuerdo. El `JourneySpec` es la definición
 * funcional y los dos adaptadores tienen que demostrarla.
 */

/** Identificador estable de un journey, según §16 del contrato de testing. */
export type JourneyId =
  | 'P3-E2E-001'
  | 'P3-E2E-002'
  | 'P6-E2E-001'
  | 'P6-E2E-002';

/** Etiquetas lógicas; cada runner las traduce a su propio filtro. */
export type JourneyTag =
  | '@smoke'
  | '@critical'
  | '@p3'
  | '@p6'
  | '@auth'
  | '@community'
  | '@moderation';

/**
 * Una acción de dominio.
 *
 * Es el **nombre** de lo que hace una persona, no cómo se hace: «publica»,
 * «reacciona», «decide». El cómo —qué botón, qué espera— vive en el page object
 * de cada adaptador, porque depende de la interfaz real y cambia con ella.
 */
export interface JourneyAction {
  /** Quién actúa. Una clave del catálogo de semillas. */
  readonly actor: string;
  /** Qué hace, en vocabulario de negocio. */
  readonly action: string;
  /** Sobre qué: una clave del manifiesto de semillas o un dato del propio journey. */
  readonly target?: string;
  /** Notas para quien lea el catálogo sin abrir el adaptador. */
  readonly note?: string;
}

/** Una afirmación de negocio que tiene que ser cierta en ese punto. */
export interface JourneyAssertion {
  /** Qué se afirma, en vocabulario de negocio. */
  readonly assert: string;
  /** Sobre qué se afirma, si hace falta acotarlo. */
  readonly subject?: string;
  /** Por qué esta afirmación está en el journey y no se puede aflojar. */
  readonly note?: string;
}

/** Un paso: o alguien hace algo, o algo tiene que ser cierto. */
export type JourneyStep = JourneyAction | JourneyAssertion;

/** `true` si el paso es una afirmación. */
export function esAsercion(step: JourneyStep): step is JourneyAssertion {
  return 'assert' in step;
}

/** La definición completa de un recorrido de negocio. */
export interface JourneySpec {
  readonly id: JourneyId;
  /** Qué demuestra, en una línea. */
  readonly title: string;
  readonly tags: readonly JourneyTag[];
  /** Actores que participan, por clave del catálogo de semillas. */
  readonly actors: readonly string[];
  /**
   * Lo que tiene que existir **antes** de empezar, por clave del manifiesto.
   *
   * Nunca incluye el efecto que el journey produce: si la publicación, la
   * decisión o la reseña vinieran sembradas, el journey no probaría que el
   * sistema las produce.
   */
  readonly preconditions: readonly string[];
  /**
   * Servicios que tienen que estar realmente arriba.
   *
   * Se declara para que el fallo diga «el worker de fan-out no corrió» en vez de
   * «no apareció la publicación», que es el mismo hecho contado de una forma que
   * no ayuda.
   */
  readonly requiresLive: readonly string[];
  readonly steps: readonly JourneyStep[];
}
