/* ============================================================================
    The links of the patient's clinical network (strip 3's input contract,
    with the nodes in `red-clinica.types.ts`).
    ========================================================================== */

/**
 * Why two nodes are connected. Each type says **which way** the arrow goes
 * (`desde` → `hasta`) in the table below, and there are no others: a link
 * outside this list would be a made-up association.
 */
export const TIPOS_DE_VINCULO = [
  'registrado-en',
  'reconsulta-de',
  'derivada-desde',
  'recibida-en',
  'orden-de-derivacion',
  'pedido-para',
  'evidencia-de',
  'indicado-para',
  'reemplazado-por',
  'reemplaza-receta',
  'estudio-previo',
  'resultado-de',
  'plan-para',
  'atendida-en',
  'durante-internacion',
] as const;

export type TipoDeVinculo = (typeof TIPOS_DE_VINCULO)[number];

/** How a link reads from each end: outgoing (desde) and incoming (hasta). */
export interface LecturaDeVinculo {
  readonly saliente: string;
  readonly entrante: string;
}

export const LECTURA_DE_VINCULO: Readonly<Record<TipoDeVinculo, LecturaDeVinculo>> = {
  'registrado-en': { saliente: 'Se registró en', entrante: 'Se registró aquí' },
  'reconsulta-de': { saliente: 'Reconsulta de', entrante: 'Tuvo como reconsulta' },
  'derivada-desde': { saliente: 'Derivada desde', entrante: 'Originó la derivación' },
  'recibida-en': { saliente: 'Recibida en', entrante: 'Llegada por derivación' },
  'orden-de-derivacion': { saliente: 'Orden asociada', entrante: 'Pedida por la derivación' },
  'pedido-para': { saliente: 'Se pidió para estudiar', entrante: 'Estudio pedido para esto' },
  'evidencia-de': { saliente: 'Sustentó la decisión sobre', entrante: 'Decisión sustentada en' },
  'indicado-para': { saliente: 'Indicado para', entrante: 'Tratamiento indicado' },
  'reemplazado-por': { saliente: 'Descartado en favor de', entrante: 'Reemplaza a' },
  'reemplaza-receta': { saliente: 'Reemplazada por', entrante: 'Reemplaza a la receta' },
  'estudio-previo': { saliente: 'Reutiliza o repite', entrante: 'Reutilizado o repetido por' },
  'resultado-de': { saliente: 'Resultado de', entrante: 'Su resultado' },
  'plan-para': { saliente: 'Plan para', entrante: 'Plan de cuidados' },
  'atendida-en': { saliente: 'Atendida en', entrante: 'Atención de la cita' },
  'durante-internacion': { saliente: 'Durante la internación', entrante: 'Atención durante la internación' },
};

/** A network connection. */
export interface AristaDeRed {
  readonly desde: string;
  readonly hasta: string;
  readonly tipo: TipoDeVinculo;
  /**
   * `true` when the link is not stored in the contract but deduced (same
   * date, same reason). The panel says so in words: an inferred link is not a
   * clinical fact.
   */
  readonly inferido?: boolean;
}
