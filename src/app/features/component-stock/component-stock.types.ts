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

export interface ComponenteDelStock {
  /** Ruta sin `src/app/` ni extensión. Es la clave en la URL. */
  readonly clave: string;
  readonly nivel: NivelDeComponente;
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
