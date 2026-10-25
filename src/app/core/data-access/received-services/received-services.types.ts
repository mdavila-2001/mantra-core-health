/* ============================================================================
    «Servicios recibidos» de la historia del paciente.

    Un servicio es algo que se le hizo al paciente: una intervención médica
    realizada o una vacuna. La consulta, el laboratorio y la imagenología NO son
    servicios recibidos: la consulta vive en «Atenciones» y el análisis médico en
    «Resultados».

    El tipo es un concepto extensible del servidor; un tipo que este cliente no
    conoce llega como `OTHER` y se dibuja con su etiqueta, sin romper.
    ========================================================================== */

/** Los tipos de servicio que el cliente distingue. */
export type ReceivedServiceType = 'INTERVENTION' | 'VACCINATION' | 'OTHER';

/** De dónde sale el importe del servicio. */
export type ReceivedServiceCostSource = 'INVOICE_LINE' | 'CHARGE_ITEMS';

/** Lo que costó el servicio, como lo registró facturación. Decimal exacto, nunca `number`. */
export interface ReceivedServiceCost {
  readonly amount: string;
  /** `BOB`, `USD`…; `null` si el cargo no declara moneda. */
  readonly currencyCode: string | null;
  readonly source: ReceivedServiceCostSource;
}

/** Un servicio que el paciente recibió. */
export interface ReceivedService {
  readonly id: string;
  readonly type: ReceivedServiceType;
  /** Concepto del tipo: etiqueta de un tipo que el cliente aún no conoce. */
  readonly typeConceptId: string;
  /** Qué se hizo: el código del procedimiento, de la vacuna o del tipo de caso. */
  readonly serviceConceptId: string;
  readonly statusConceptId: string;
  readonly performedAt: Date;
  readonly performerProfileId?: string;
  /** Ya resuelto por el servidor: el paciente no puede leer el padrón de profesionales. */
  readonly performerName?: string;
  readonly practiceSiteId?: string;
  readonly practiceSiteName?: string;
  readonly encounterId?: string;
  readonly outcomeConceptId?: string;
  readonly resultText?: string;
  /** `null` si no hay cobro registrado o si quien pide no ve importes. */
  readonly cost: ReceivedServiceCost | null;
}

/** La respuesta de la lectura. */
export interface ReceivedServicesPage {
  readonly patientProfileId: string;
  /** Más reciente primero. */
  readonly items: readonly ReceivedService[];
  readonly limit: number;
  /** Hay más servicios de los que el tope dejó pasar: se dice, no se calla. */
  readonly truncated: boolean;
  /**
   * Si quien pide ve importes. Con `false` todo `cost` es `null` y NO significa
   * «sin cobro»: el personal clínico lee el servicio sin el dinero.
   */
  readonly costsVisible: boolean;
}
