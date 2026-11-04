/** Shapes of the body-map geometry (rationale: `body-zones.geometry.ts`). */

/** Una zona dibujable: su `id` (el de la tabla de zonas) y su contorno. */
export interface SiluetaDeZona {
  readonly id: string;
  /** Contorno(s) cerrado(s), `M…Z`; puede tener varios subtrazos. */
  readonly d: string;
  /**
   * Un punto adentro de cada parte de la zona (las dos manos son dos partes):
   * donde se pone el marcador cuando la zona queda elegida.
   */
  readonly centros: readonly (readonly [number, number])[];
  /**
   * The coarse zone it was cut from («rodilla-der» → «rodillas»). The AI
   * reading and the symptom table speak in coarse ids: marking one lights
   * every fine zone that shares it.
   */
  readonly madre: string;
  /** Si al elegirla la figura pasa a otra vista (la cabeza acerca la cara). */
  readonly acercaA?: IdDeVista;
}

export type IdDeVista = 'frente' | 'espalda' | 'cara';

/** Una manera de mirar el cuerpo: de frente, de espaldas o la cara de cerca. */
export interface VistaDelCuerpo {
  readonly id: IdDeVista;
  /** Rótulo del selector de vista. */
  readonly nombre: string;
  readonly viewBox: string;
  /** El render del maniquí en esta vista (WebP con fondo transparente). */
  readonly image: string;
  readonly zonas: readonly SiluetaDeZona[];
}
