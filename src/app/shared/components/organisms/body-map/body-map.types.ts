import { InjectionToken } from '@angular/core';
import {
  VISTAS_DEL_CUERPO,
  type IdDeVista,
  type VistaDelCuerpo,
} from './body-zones.geometry';

/** Silhouette biological sex proportion model, or undefined for gender-neutral. */
export type SexoDeLaSilueta = 'MALE' | 'FEMALE';

/** Selectable body zone definition. */
export interface ZonaElegible {
  readonly id: string;
  readonly nombre: string;
}

/** Printable zone including SVG path and center coordinates. */
export interface ZonaDibujable extends ZonaElegible {
  readonly d: string;
  readonly centros: readonly (readonly [number, number])[];
  /** Coarse zone it belongs to: marking the coarse id lights it too. */
  readonly madre: string;
  readonly acercaA?: IdDeVista;
}

/** Tapped coordinate inside a zone relative to current view drawing space. */
export interface PuntoTocado {
  readonly zona: string;
  readonly vista: IdDeVista;
  readonly x: number;
  readonly y: number;
}

/** Body view containing printable zones. */
export interface VistaDibujable {
  readonly vista: VistaDelCuerpo;
  readonly zonas: readonly ZonaDibujable[];
}

/** Controls whether view switching waits for image preload. */
export const ESPERAR_IMAGEN_DE_VISTA = new InjectionToken<boolean>(
  'ESPERAR_IMAGEN_DE_VISTA',
  {
    providedIn: 'root',
    factory: () => true,
  },
);

/** URL search parameter names for shared links. */
export const PARAMETRO_ZONA = 'zona';
export const PARAMETRO_VISTA = 'vista';

/** Zone IDs drawn in any view, plus the coarse zones they were cut from. */
export const ZONAS_CON_SILUETA: ReadonlySet<string> = new Set(
  VISTAS_DEL_CUERPO.flatMap((vista) => vista.zonas.flatMap((zona) => [zona.id, zona.madre])),
);
