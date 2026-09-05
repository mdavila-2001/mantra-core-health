/** Tipos de la vista para `services-catalog`. Se mapean desde los DTOs, no son ellos. */

/** Una práctica de la organización — la misma forma que expone `GET /practices`. */
export interface Practice {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

/**
 * Un servicio del catálogo maestro de una práctica.
 *
 * `defaultPrice` es sólo referencia: el precio que de verdad se cotiza lo pone
 * cada doctor al armar el presupuesto, nunca este valor a ciegas.
 */
export interface ServiceCatalogItem {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly serviceConceptId?: string;
  readonly defaultPrice: string;
  readonly currencyConceptId?: string;
  /**
   * Sigla de la moneda (`BOB`, `USD`), cuando la API pudo resolverla.
   *
   * Viene del servidor y no se deduce acá: el `currencyConceptId` es un uuid y
   * el front no tiene catálogo de monedas. Queda `undefined` en las filas que
   * apuntan a uno de los juegos de conceptos de moneda que el producto todavía
   * no unificó; en ese caso el importe se muestra sin unidad, que es lo que
   * hacía antes, en vez de inventarle una.
   */
  readonly currencyCode?: string;
  readonly taxCodeId?: string;
  readonly incomeAccountId?: string;
  readonly isActive: boolean;
}

/**
 * Lo que se puede corregir de un servicio ya dado de alta.
 *
 * El código y la práctica identifican al servicio dentro de su catálogo: no
 * están acá porque moverlos sería otra operación, no una corrección.
 */
export interface ServiceCatalogChanges {
  readonly name?: string;
  readonly defaultPrice?: string;
  readonly currencyConceptId?: string;
  readonly isActive?: boolean;
}

/**
 * Una página del catálogo de servicios.
 *
 * `nextCursor` es **opaco**: se reenvía tal cual y no se interpreta. La API no
 * publica su forma justamente para poder cambiar las columnas de orden sin
 * romper a nadie.
 */
export interface ServiceCatalogPage {
  readonly items: readonly ServiceCatalogItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Parámetros de la búsqueda paginada del catálogo. */
export interface ServiceCatalogQuery {
  /** Texto libre sobre código o nombre. */
  readonly query?: string;
  /** Filtra por servicios activos (`true`) o inactivos (`false`). */
  readonly isActive?: boolean;
  /** Cursor devuelto por la página anterior. */
  readonly cursor?: string;
  /** Servicios por página; la API usa 50 por defecto. */
  readonly limit?: number;
}

/** Cuerpo de la alta de un servicio nuevo en el catálogo. */
export interface NewServiceCatalogItem {
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly defaultPrice: string;
  readonly serviceConceptId?: string;
  readonly currencyConceptId?: string;
  readonly taxCodeId?: string;
  readonly incomeAccountId?: string;
  readonly isActive?: boolean;
}

/* ---- el nomenclador de procedimientos (TAREA-22) --------------------------
   Es el **arancel de referencia**, no el catálogo de la práctica: acá no hay
   nada que un profesional haya dado de alta. Sirve para importar. */

/**
 * Una entrada del arancel de honorarios.
 *
 * `referencePrice` viaja como cadena **con su unidad al lado**, y la unidad
 * puede no ser dinero: `UMA` es la unidad de cuenta del arancel de Santa Cruz,
 * no una moneda, y su factor de conversión no está declarado en ninguna parte
 * del producto. Mostrar «20» sin decir «UMA» sería mostrar un precio falso.
 */
export interface ProcedureNomenclatureItem {
  readonly conceptId: string;
  readonly code: string;
  readonly display: string;
  readonly specialty: string | null;
  readonly group: string | null;
  readonly referencePrice: string | null;
  /** `UMA` o `USD`. Ver el comentario de la interfaz. */
  readonly priceUnit: string | null;
  /**
   * Si el texto de origen necesita revisión humana.
   *
   * Son las 228 entradas que salieron dañadas del reconocimiento óptico del
   * arancel. Importar una de éstas en silencio mete un nombre y un precio
   * dudosos en la lista de un profesional.
   */
  readonly ocrSuspect: boolean;
}

/** Una página del nomenclador, por cursor opaco. */
export interface ProcedureNomenclaturePage {
  readonly items: readonly ProcedureNomenclatureItem[];
  readonly nextCursor: string | null;
}

/** Una especialidad del arancel, con cuántos procedimientos agrupa. */
export interface ProcedureSpecialty {
  readonly specialty: string;
  readonly count: number;
}

/** Filtros y paginación del nomenclador. */
export interface ProcedureNomenclatureQuery {
  readonly specialty?: string;
  readonly query?: string;
  readonly cursor?: string;
  readonly limit?: number;
}
