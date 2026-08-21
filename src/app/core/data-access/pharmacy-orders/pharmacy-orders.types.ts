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
  readonly lineas: readonly LineaDePedido[];
  /** Total estimado como texto exacto, o `null` si falta algún precio. */
  readonly totalEstimado: string | null;
  readonly moneda: string | null;
  /** El código que se muestra en mostrador. Llega con `LISTO_PARA_RETIRO`. */
  readonly codigoDeRetiro: string | null;
  /** El motivo, en palabras, cuando el estado es `RECHAZADO`. */
  readonly motivoDeRechazo: string | null;
  readonly sustituciones: readonly PropuestaDeSustitucion[];
  /** La receta de origen: para re-pedir y para volver al mapa de sedes. */
  readonly requestId: string;
  readonly siteId: string;
}

/**
 * Lo que «dónde comprar mi receta» arma al tocar «Enviar pedido»: la sede
 * elegida y los renglones ya evaluados. Viaja por el cliente y no por la URL:
 * nada de la persona se serializa en direcciones.
 */
export interface BorradorDePedido {
  readonly requestId: string;
  readonly siteId: string;
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
