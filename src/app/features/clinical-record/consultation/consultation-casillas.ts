/* Grid tiles of the consultation: what each one says and the visible order. */

/**
 * Las casillas de la rejilla. Las posibilidades del expediente que se
 * registran atendiendo —una por pestaña de la historia que admite alta— más la
 * que sólo tiene sentido con la persona delante: el formulario clínico de la
 * especialidad.
 *
 * «Medición» no existe más (pedido del propietario, 25/09/2026): un signo
 * vital es una fila de la nota médica, no un registro aparte. «Internación»
 * salió ese día y vuelve el 04/11/2026, junto a «Derivar», a pedido del
 * propietario: abre la internación en curso o el ingreso real (ADT), con la
 * persona ya elegida. Al día siguiente del 25/09 salieron dos más, «Nota médica» y «Documento»: las absorbe
 * el formulario médico (ver CASILLAS).
 *
 * Y una casilla que no registra nada, «Pagos»: la respuesta a «¿esto ya está
 * pagado?», que se necesita en la consulta misma cuando quien atiende también
 * ejecuta el tratamiento.
 */
export type CasillaDeConsulta =
  | 'diagnosticos'
  | 'medicacion'
  | 'ordenes'
  | 'reconsulta'
  | 'derivacion'
  | 'internacion'
  | 'planes'
  | 'formulario'
  | 'pagos';

/** Lo que dice cada casilla antes de abrirse. */
export interface CasillaVisible {
  readonly clave: CasillaDeConsulta;
  readonly titulo: string;
  readonly descripcion: string;
  /** El encabezado del modal. No repite el título de la casilla. */
  readonly tituloDelModal: string;
  /** Cuántos registros de ese tipo ya tiene la persona, o `null` si no se cuenta. */
  readonly cantidad: number | null;
  /** Lo que sigue a la cifra: «en la historia», o el nombre de lo contado. */
  readonly rotuloDeCantidad: string;
  /**
   * Qué tan confiable es la cifra (`ConsultationReferrals.missingCount`):
   * `loading` o `failed` sin cifra; `stale` con cifra vieja («al menos N»,
   * falló la última relectura); `null` si la casilla no cuenta o la cifra está al día.
   */
  readonly lecturaDeCantidad: 'loading' | 'failed' | 'stale' | null;
  /** El trazo del icono, en un `viewBox` de 24. */
  readonly icono: string;
  /** El `data-testid` de la casilla. Estable: las pruebas de navegador lo usan. */
  readonly testId: string;
}

export interface DefinicionDeCasilla {
  readonly titulo: string;
  readonly descripcion: string;
  readonly tituloDelModal: string;
  readonly icono: string;
  readonly testId: string;
}

/**
 * Contrato C0 de las casillas, ya sin Medición, y sin «Nota
 * médica» ni «Documento» (pedido del propietario, 26/09/2026): las dos viven
 * ahora al final del formulario médico, como campos adicionales con texto y
 * archivos. El orden visible se declara abajo en ORDEN_DE_CASILLAS y empieza
 * por el formulario médico, porque receta, orden de análisis, plan de
 * cuidados y reconsulta cuelgan de su respuesta.
 */
export const CASILLAS: Readonly<Record<CasillaDeConsulta, DefinicionDeCasilla>> = {
  diagnosticos: {
    titulo: 'Diagnóstico',
    descripcion: 'Una condición nueva, con su estado clínico y su categoría.',
    tituloDelModal: 'Nuevo diagnóstico',
    icono: 'M9 3h6l1 3h3v15H5V6h3l1-3Zm3 6v6m-3-3h6',
    testId: 'consulta-casilla-diagnosticos',
  },
  medicacion: {
    titulo: 'Receta',
    descripcion: 'Prescribir, firmar y emitir medicación.',
    tituloDelModal: 'Prescribir medicación',
    icono: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 8h6M9 15h4',
    testId: 'consulta-casilla-medicacion',
  },
  ordenes: {
    titulo: 'Orden de análisis',
    descripcion: 'Un estudio solicitado durante la consulta.',
    tituloDelModal: 'Pedir un análisis',
    icono: 'M9 3h6v5l4 10a2 2 0 0 1-2 3H7a2 2 0 0 1-2-3l4-10V3Zm-2 12h10',
    testId: 'consulta-casilla-ordenes',
  },
  reconsulta: {
    titulo: 'Reconsulta',
    descripcion: 'La próxima cita, con fecha acordada.',
    tituloDelModal: 'Agendar la reconsulta',
    icono: 'M4 5h16v16H4V5Zm4-2v4m8-4v4M4 10h16m-8 3v5m-2-2 2 2 2-2',
    testId: 'consulta-casilla-reconsulta',
  },
  derivacion: {
    titulo: 'Derivar',
    descripcion: 'A otro profesional u organización médica, por un servicio concreto.',
    tituloDelModal: 'Derivar a otro profesional u organización',
    icono: 'M5 12h11m-4-4 4 4-4 4M19 5v14',
    testId: 'consulta-casilla-derivacion',
  },
  internacion: {
    titulo: 'Internación',
    descripcion: 'Si está internado y dónde; o ingresarlo en un hospital.',
    tituloDelModal: 'Internar a la persona',
    icono: 'M3 18V8m0 6h18v4M7 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm4 3V9h7a3 3 0 0 1 3 3v2',
    testId: 'consulta-casilla-internacion',
  },
  planes: {
    titulo: 'Plan de cuidados',
    descripcion: 'Un objetivo y las actividades para alcanzarlo.',
    tituloDelModal: 'Abrir un plan de cuidados',
    icono: 'M4 6h16M4 12h10M4 18h7m6-1 2 2 4-4',
    testId: 'consulta-casilla-planes',
  },
  formulario: {
    titulo: 'Formulario médico',
    descripcion: 'La ficha de la especialidad, con sus campos, notas y archivos.',
    tituloDelModal: 'Llenar el formulario médico',
    icono: 'M4 4h16v16H4V4Zm4 5h8M8 12h8M8 15h5',
    testId: 'consulta-casilla-formulario',
  },
  pagos: {
    titulo: 'Pagos',
    descripcion: 'Lo que ya pagó: comprobantes, fechas e importes.',
    tituloDelModal: 'Pagos de la persona',
    icono: 'M3 7h18v10H3V7Zm0 4h18M7 15h3',
    testId: 'consulta-casilla-pagos',
  },
};

/** La bajada de «Pagos» cuando la facturación simulada está encendida. */
export const DESCRIPCION_DE_PAGOS_CON_FACTURACION = 'Plan de pagos, notas de venta y factura.';

export const ORDEN_DE_CASILLAS: readonly CasillaDeConsulta[] = [
  'formulario',
  'ordenes',
  'diagnosticos',
  'medicacion',
  'planes',
  'reconsulta',
  'derivacion',
  'internacion',
  'pagos',
];
