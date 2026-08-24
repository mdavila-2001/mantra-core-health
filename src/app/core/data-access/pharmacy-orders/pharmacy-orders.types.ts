/**
 * Tipos del pedido de farmacia (carril FAR-I2, sobre el contrato acordado de
 * la tanda de farmacia — README del día 1).
 *
 * El backend de pedidos (FAR-E1) todavía no existe: estos tipos espejan el
 * contrato **acordado**, no un DTO publicado. Cuando E1 publique el suyo, el
 * ajuste vive acá y en el cliente; las pantallas leen estos nombres y no se
 * enteran. Misma convención de montos que `pharmacy.types.ts`: texto exacto,
 * porque el `numeric` de la base no cabe sin pérdida en un `number`.
 */

/**
 * Los estados del pedido, en el orden del recorrido feliz y con los
 * terminales al final. Es el value set pedido a Marcelo (la solicitud está en
 * `COORDINACION-AGENTES.md`); mientras el catálogo no exista, estos códigos
 * provisorios son la identidad — jamás se muestran: la etiqueta en castellano
 * vive en `pedido-status.ts` de la pantalla.
 */
export const ESTADOS_DE_PEDIDO = [
  'ENVIADO',
  'EN_REVISION',
  'CONFIRMADO',
  'ACEPTACION_PENDIENTE',
  'ACEPTADO',
  'LISTO_PARA_RETIRO',
  'RETIRADO',
  'RECHAZADO',
  'VENCIDO',
  'CANCELADO',
] as const;

export type EstadoDePedido = (typeof ESTADOS_DE_PEDIDO)[number];

/**
 * Cómo llega el pedido a la persona. `RETIRO` es el default del contrato;
 * los dos envíos existen sólo si la persona tiene esa dirección cargada, y el
 * courier real es FAR-E4 — por eso el copy honesto es «la farmacia coordina
 * la entrega».
 */
export const MODALIDADES_DE_ENTREGA = ['RETIRO', 'DOMICILIO', 'TRABAJO'] as const;

export type ModalidadDeEntrega = (typeof MODALIDADES_DE_ENTREGA)[number];

/** Un renglón del pedido, ya en palabras: lo que la pantalla puede mostrar. */
export interface LineaDePedido {
  /** El producto del directorio, o `null` si el medicamento no tiene uno. */
  readonly productId: string | null;
  /**
   * El concepto de terminología del medicamento, si el origen lo conocía.
   * Es la llave para que la bandeja (FAR-I3) pueda ofrecer productos del
   * mismo concepto cuando FAR-E2 publique el catálogo del tenant.
   */
  readonly conceptId?: string;
  readonly medicamento: string;
  /** «500 mg · caja x 20», o `null` si el directorio no lo publica. */
  readonly presentacion: string | null;
  readonly cantidad: number;
  /** Precio unitario como texto exacto, o `null` sin precio publicado. */
  readonly precio: string | null;
  readonly moneda: string | null;
  /** `false` = la sede no puede confirmar este renglón; se dice claro. */
  readonly disponible: boolean;
}

/** Una de las dos puntas de una propuesta de sustitución. */
export interface OpcionDeSustitucion {
  readonly nombre: string;
  readonly precio: string | null;
}

/**
 * «Te proponen: [genérico X — Bs 25] en lugar de [marca Y — Bs 60]».
 * La decisión es siempre de la persona: aceptar, preferir el original o
 * cancelar — el cliente sólo transporta la propuesta.
 */
export interface PropuestaDeSustitucion {
  readonly id: string;
  readonly original: OpcionDeSustitucion;
  readonly propuesta: OpcionDeSustitucion;
  readonly moneda: string | null;
}

/**
 * El hito de un envío artesanal (la costura de FAR-E4): la farmacia lo marca
 * a mano y el texto es honesto — no hay tracking real detrás.
 */
export const HITOS_DE_ENVIO = ['EN_CAMINO', 'ENTREGADO'] as const;

export type HitoDeEnvio = (typeof HITOS_DE_ENVIO)[number];

/** Una entrega registrada en mostrador: cuándo y qué renglones se llevó. */
export interface EntregaRegistrada {
  readonly momento: Date;
  /** Índices (base 0) de las líneas del pedido que salieron en esta entrega. */
  readonly indices: readonly number[];
}

/* ─── El pago (carril FAR-I5, contrato provisorio de FAR-E4) ────────────── */

/**
 * Estados del pago, value set provisorio del front (como `ESTADOS_DE_PEDIDO`).
 * La pasarela real no existe: `PAGADO` llega hoy por dos caminos — el
 * mostrador al cerrar la dispensación, o el simulador del QR detrás del gate.
 * TODO(FAR-E4): el puerto real define el catálogo y este set se ajusta acá.
 */
export const ESTADOS_DE_PAGO = ['PENDIENTE', 'PAGADO'] as const;

export type EstadoDePago = (typeof ESTADOS_DE_PAGO)[number];

/**
 * De dónde salió el pago. `QR_DEMO` existe sólo mientras la pasarela no está:
 * el comprobante lo dice en palabras («Pago demo») y nadie lo confunde con
 * dinero real.
 */
export const ORIGENES_DE_PAGO = ['MOSTRADOR', 'QR_DEMO'] as const;

export type OrigenDePago = (typeof ORIGENES_DE_PAGO)[number];

/**
 * El pago del pedido, tal como el comprobante y las pantallas lo leen.
 *
 * `total` y `moneda` se **congelan al pagar**: son lo que se cobró, no un
 * puntero al total vivo del pedido. Sin esto, una sustitución aceptada
 * después del pago reescribiría retroactivamente lo que dice el comprobante.
 */
export interface PagoDelPedido {
  readonly estado: EstadoDePago;
  /** Sólo con `PAGADO`; pendiente no tiene origen. */
  readonly origen: OrigenDePago | null;
  readonly pagadoEl: Date | null;
  /** Lo cobrado, como texto exacto — o `null` si se cobró sin precio publicado. */
  readonly total: string | null;
  readonly moneda: string | null;
}

/** Un pedido de farmacia, tal como las pantallas lo leen. */
export interface PedidoFarmacia {
  readonly id: string;
  readonly estado: EstadoDePedido;
  readonly creadoEl: Date;
  /** Cuándo vence la reserva. Llega con `LISTO_PARA_RETIRO` (48 h). */
  readonly venceEl: Date | null;
  readonly farmacia: string;
  readonly sede: string;
  readonly direccion: string | null;
  readonly modalidad: ModalidadDeEntrega;
  /** Sólo con modalidad de envío: la dirección elegida, ya en texto. */
  readonly direccionDeEntrega: string | null;
  /**
   * Quién pidió, en palabras — lo que la bandeja de la farmacia muestra.
   * En el backend real sale del token de la sesión que envió; el mock hace
   * lo mismo con `SessionStore.displayName()`.
   */
  readonly paciente: string | null;
  /**
   * Quién prescribió. `null` hasta FAR-E2: el resumen clínico solo trae el
   * uuid del perfil, y un uuid no se pinta ni se resuelve desde el front.
   */
  readonly prescriptor: string | null;
  readonly lineas: readonly LineaDePedido[];
  /** Total estimado como texto exacto, o `null` si falta algún precio. */
  readonly totalEstimado: string | null;
  readonly moneda: string | null;
  /** El código que se muestra en mostrador. Llega con `LISTO_PARA_RETIRO`. */
  readonly codigoDeRetiro: string | null;
  /** El motivo, en palabras, cuando el estado es `RECHAZADO`. */
  readonly motivoDeRechazo: string | null;
  readonly sustituciones: readonly PropuestaDeSustitucion[];
  /** El hito del envío artesanal, o `null` en retiros o sin salir aún. */
  readonly envio: HitoDeEnvio | null;
  /** La historia de dispensas: cada entrega parcial o total del mostrador. */
  readonly entregas: readonly EntregaRegistrada[];
  /**
   * El pago del pedido. `null` en pedidos que terminaron sin cobrar
   * (rechazados, vencidos, cancelados antes de pagar); los activos nacen
   * `PENDIENTE`.
   */
  readonly pago: PagoDelPedido | null;
  /** La receta de origen: para re-pedir y para volver al mapa de sedes. */
  readonly requestId: string;
  readonly siteId: string;
  /**
   * La farmacia dueña de la sede. La agregó FAR-I7, y no es sólo para las
   * promociones: un pedido pertenece a una farmacia, no sólo a una sucursal, y
   * re-pedir uno vencido necesita reconstruir el borrador entero.
   */
  readonly pharmacyId: string;
}

/**
 * Lo que «dónde comprar mi receta» arma al tocar «Enviar pedido»: la sede
 * elegida y los renglones ya evaluados. Viaja por el cliente y no por la URL:
 * nada de la persona se serializa en direcciones.
 */
export interface BorradorDePedido {
  readonly requestId: string;
  readonly siteId: string;
  /**
   * La farmacia dueña de la sede. La agregó FAR-I7: la confirmación necesita
   * saber de qué farmacia es el pedido para cruzar sus promociones vigentes.
   */
  readonly pharmacyId: string;
  readonly farmacia: string;
  readonly sede: string;
  readonly direccion: string | null;
  readonly lineas: readonly LineaDePedido[];
  readonly totalEstimado: string | null;
  readonly moneda: string | null;
}

/** El envío del pedido: el borrador más lo que la confirmación decide. */
export interface EnvioDePedido {
  readonly borrador: BorradorDePedido;
  readonly modalidad: ModalidadDeEntrega;
  readonly direccionDeEntrega: string | null;
}

/**
 * Los pasos que en la vida real ejecuta la farmacia. Sólo los consume la
 * barra de demostración (`environment.demoPresets`): con FAR-E1 estos pasos
 * los dispara la contraparte real y la barra desaparece.
 */
export const SIMULACIONES_DE_FARMACIA = [
  'REVISAR',
  'CONFIRMAR',
  'PROPONER_SUSTITUCION',
  'MARCAR_LISTO',
  'DISPENSAR',
  'RECHAZAR',
  'VENCER',
] as const;

export type SimulacionDeFarmacia = (typeof SIMULACIONES_DE_FARMACIA)[number];

/* ─── El lado del mostrador (carril FAR-I3, contrato de FAR-E2) ─────────── */

/** Qué decide la farmacia sobre un renglón al confirmar el pedido. */
export const DECISIONES_DE_LINEA = [
  'TAL_CUAL',
  'PROPONER_GENERICO',
  'NO_DISPONIBLE',
] as const;

export type DecisionDeLinea = (typeof DECISIONES_DE_LINEA)[number];

/**
 * El ajuste de un renglón en la confirmación. Con `PROPONER_GENERICO` la
 * propuesta es obligatoria — la pantalla no deja confirmar sin nombre; el
 * precio puede faltar, y entonces la comparación se muestra sin ahorro.
 */
export interface AjusteDeLinea {
  /** Índice (base 0) del renglón dentro de `PedidoFarmacia.lineas`. */
  readonly indice: number;
  readonly decision: DecisionDeLinea;
  readonly propuesta?: {
    readonly nombre: string;
    readonly precio: string | null;
  };
}

/** Lo que el mostrador registra al entregar: el código y qué renglones. */
export interface RegistroDeRetiro {
  /** El código que trae la persona (se compara sin distinguir mayúsculas). */
  readonly codigo: string;
  /** Índices de las líneas que se lleva en ESTA entrega (parcial o total). */
  readonly indices: readonly number[];
}

/**
 * El resultado de una dispensa. `codigoValido: false` no es un error del
 * sistema: es la respuesta honesta cuando el código no coincide, y la
 * pantalla lo dice en palabras. Con FAR-E3 será el 4xx del backend.
 */
export interface ResultadoDeDispensa {
  readonly codigoValido: boolean;
  readonly pedido: PedidoFarmacia | null;
}
