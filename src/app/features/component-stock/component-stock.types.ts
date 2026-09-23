import type { Type } from '@angular/core';

/* ============================================================================
    Los contratos del stock de componentes.

    Los rellena `scripts/generate-component-index.mjs` leyendo las fuentes; acá
    sólo se declara la forma. Este archivo sí está en git — el generado, no.
    ========================================================================== */

export type NivelDeComponente = 'atomo' | 'molecula' | 'organismo' | 'pantalla' | 'maqueta' | 'otro';

export interface EntradaDeComponente {
  readonly nombre: string;
  readonly alias: string | null;
  /** El tipo tal cual está escrito en el `input<...>()`. */
  readonly tipo: string;
  readonly requerido: boolean;
}

export interface ProblemaDeComponente {
  readonly tipo:
    | 'selector-no-importado'
    | 'importado-sin-instanciar'
    | 'sin-prueba'
    | 'entrada-sin-tipo'
    | 'console'
    | 'pendiente'
    | 'de-muestra'
    | 'sin-onpush';
  readonly detalle: string;
}

export interface ComposicionDeComponente {
  readonly atomos: readonly string[];
  readonly moleculas: readonly string[];
  readonly organismos: readonly string[];
  readonly otros: readonly string[];
}

/**
 * Las relaciones que el análisis de texto puede comprobar, separadas.
 *
 * `usa` y `usadoPor` salen SÓLO de `instancia`: un import que la plantilla no
 * usa o un tipo importado no son composición.
 */
export interface RelacionesDeComponente {
  /** template-instantiates: importada y con un elemento que cumple su selector. */
  readonly instancia: readonly string[];
  /** imports-available sin instancia en la plantilla ni carga dinámica. */
  readonly disponibleSinInstanciar: readonly string[];
  /** type-only: se importan sus tipos, no la pieza visual. */
  readonly soloTipo: readonly string[];
  /** dynamic-loads hechas por este componente (`createComponent`, `import()`). */
  readonly cargaDinamica: readonly string[];
}

/** Lo que el análisis no pudo decidir. Nunca se convierte en «no existe». */
export interface EvidenciaNoResuelta {
  readonly causa:
    | 'plantilla-no-localizada'
    | 'plantilla-interpolada'
    | 'imports-no-literal'
    | 'clase-ambigua'
    | 'carga-dinamica-sin-resolver'
    | 'sin-plantilla-para-decidir'
    | 'selector-no-analizable'
    | 'selector-sin-import-resoluble'
    | 'referencia-de-valor-no-clasificada';
  readonly detalle: string;
}

export type OrigenDelNivel = 'por-ruta' | 'declarado';

/**
 * Lo que el índice sabe de la acreditación sin ejecutar nada. Las otras dos
 * dimensiones —si montó y si se interactuó— las mide el banco en ejecución.
 */
export interface AcreditacionEstatica {
  /** Está en el índice: el generador lo encontró en el código. */
  readonly descubierto: boolean;
  /** El archivo del anfitrión escrito a mano, o `null` si no hay escenario. */
  readonly escenario: string | null;
  /** Capturas versionadas de sus escenarios (sólo cuenta si hay escenario). */
  readonly capturasVisuales: readonly string[];
  /** Lo que impide acreditarlo solo, con el motivo. Vacío = nada lo bloquea. */
  readonly bloqueos: readonly string[];
}

export interface ComponenteDelStock {
  /** Ruta sin `src/app/` ni extensión. Es la clave en la URL. */
  readonly clave: string;
  readonly nivel: NivelDeComponente;
  /** De dónde salió `nivel`: la carpeta, o `@nivelAtomico` en el componente. */
  readonly nivelOrigen: OrigenDelNivel;
  /** El nivel que daría la carpeta, para ver si lo declarado lo contradice. */
  readonly nivelPorRuta: NivelDeComponente;
  /** Un `@nivelAtomico` con un valor que no es un nivel: se rechazó y se dice. */
  readonly nivelDeclaradoInvalido: string | null;
  readonly clase: string;
  readonly selector: string;
  readonly path: string;
  readonly resumen: string;
  /** Los parámetros genéricos de la clase, si los tiene. */
  readonly generico: string | null;
  readonly entradas: readonly EntradaDeComponente[];
  readonly salidas: readonly string[];
  readonly usa: ComposicionDeComponente;
  readonly usadoPor: readonly string[];
  readonly relaciones: RelacionesDeComponente;
  /** `archivo:línea (vía)` de quien lo monta con `createComponent` o `import()`. */
  readonly cargadoDinamicamentePor: readonly string[];
  readonly unresolvedEvidence: readonly EvidenciaNoResuelta[];
  readonly acreditacion: AcreditacionEstatica;
  readonly clientes: readonly string[];
  readonly tieneSpec: boolean;
  readonly problemas: readonly ProblemaDeComponente[];
  /** Carga diferida: nadie entra en el paquete inicial. */
  readonly cargar: () => Promise<Type<unknown>>;
}

export const ETIQUETA_DE_NIVEL: Readonly<Record<NivelDeComponente, string>> = {
  atomo: 'Átomo',
  molecula: 'Molécula',
  organismo: 'Organismo',
  pantalla: 'Pantalla',
  maqueta: 'Maqueta portada',
  otro: 'Otro',
};
