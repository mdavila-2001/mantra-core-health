import type { Signal, Type } from '@angular/core';

/* ============================================================================
    Escenarios tipados del stock de componentes.

    El escáner (`generate-component-index.mjs`) **descubre** los componentes y
    sus entradas; el generador de valores (`core/mock/faker/props.ts`) rellena
    lo que puede adivinar por nombre y por tipo. Eso alcanza para un botón y no
    alcanza para un organismo: `DataTable` pide un `ViewState<readonly Row[]>`,
    columnas con plantillas de celda y una función de identidad, y ninguna de
    las tres se puede escribir en un JSON ni adivinar por el nombre. Montado
    «a ciegas», el organismo se caía o mostraba un contenedor vacío — que es
    peor que no mostrarlo, porque parece que el componente no anda.

    Un escenario es un **anfitrión** —un componente de Angular escrito a mano—
    que importa la misma implementación canónica que usa el producto, la monta
    con un contrato válido, le proyecta hijos reales y registra lo que emite.
    Las funciones, las plantillas y la proyección viven en TypeScript, que es el
    único lugar donde pueden vivir; el registro (`escenarios.ts`) solo apunta a
    esas clases.

    Lo que un escenario acredita: **fuente** (importa la implementación real),
    **composición** (monta sus hijos y proyecta contenido) e **interacción**
    (sus salidas se ven). Lo que NO acredita: integración con la API ni paridad
    visual — eso se mide aparte, contra la pantalla que lo usa.
    ========================================================================== */

/** Una emisión del componente montado, tal como la vio el anfitrión. */
export interface SalidaRegistrada {
  /** El nombre del `output` que emitió. */
  readonly salida: string;
  /** El payload, ya legible: un id, un código de columna, una cuenta. */
  readonly detalle: string;
  /** `performance.now()` al recibirla, para leer el orden y la distancia. */
  readonly momento: number;
}

/**
 * Lo que todo anfitrión expone al banco.
 *
 * `variante` la fija el banco con `setInput` antes de montar; `salidas` la lee
 * la pestaña de salidas para mostrar lo que el componente emitió.
 */
export interface AnfitrionDeEscenario {
  /** Lo que el componente emitió desde que se montó, en orden de llegada. */
  readonly salidas: Signal<readonly SalidaRegistrada[]>;
}

/**
 * Un escenario: una variante nombrada de un anfitrión, con lo que hay que
 * esperar ver y lo que hay que poder provocar.
 */
export interface EscenarioDeComponente {
  /** `<clave del componente>#<variante>`. Único en el registro. */
  readonly id: string;
  /** La `clave` del componente en el índice generado (ruta sin `src/app/`). */
  readonly clave: string;
  /** El valor de la entrada `variante` del anfitrión. */
  readonly variante: string;
  readonly titulo: string;
  /** Lo que tiene que verse montado. Es la aserción manual del escenario. */
  readonly seVe: string;
  /** Qué tocar y qué salida tiene que aparecer al hacerlo. */
  readonly interacciones: readonly string[];
  /** Las salidas que el escenario puede producir; las demás no aplican. */
  readonly salidasEsperadas: readonly string[];
  /** El anfitrión que monta el componente canónico con este contrato. */
  readonly host: Type<AnfitrionDeEscenario>;
  /** Dónde está escrito el anfitrión, para leer el contrato completo. */
  readonly fuente: string;
}
