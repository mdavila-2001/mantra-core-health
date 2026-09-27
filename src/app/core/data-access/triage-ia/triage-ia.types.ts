/* ============================================================================
    Lo que responde el servicio de triage por IA (AlovidaAIService,
    `POST /v1/triage/analyze`), reducido a lo que la pantalla usa.

    El contrato completo está en `docs/contracts/openapi.json` de ese
    repositorio. Acá se declara sólo lo que se lee: si el servicio agrega
    campos, esta pantalla no se entera ni se rompe.
    ========================================================================== */

/** Una especialidad sugerida, en el vocabulario de la tabla de síntomas. */
export interface EspecialidadIa {
  readonly nombre: string;
  readonly peso: number;
}

/** Un hallazgo: un síntoma de la tabla curada o «molestia en tal parte». */
export interface HallazgoIa {
  /** El `id` de la tabla curada («dolor-de-panza») o «molestia:parte» («mancha:espalda»). */
  readonly code: string;
  readonly label: string;
  /** `curated` si es de la tabla del frontend; `anatomy` si lo armó la capa anatómica. */
  readonly kind: 'curated' | 'anatomy';
  /** Zonas de la silueta: los mismos `id` que `ZONAS_DEL_CUERPO`. */
  readonly zones: readonly string[];
  readonly bodyPart: { readonly code: string; readonly label: string; readonly side: string | null } | null;
  readonly alarm: boolean;
  readonly especialidades: readonly EspecialidadIa[];
}

/** Lo que el servicio entendió de un texto. */
export interface LecturaIa {
  readonly symptoms: readonly HallazgoIa[];
  readonly urgency: 'urgente' | 'prioritaria' | 'programada';
}
