/**
 * Tipos de la billetera de puntos del paciente (carril FAR-I6).
 *
 * Espejan el contrato real del portal: `GET loyalty/me`,
 * `GET loyalty/me/points` y `POST loyalty/me/points/redeem`. Los códigos son
 * los del catálogo del backend; la traducción del cable a estos tipos vive en
 * `loyalty.adapter.ts`.
 *
 * Misma convención de cifras que el pedido de farmacia: **texto exacto**. Los
 * puntos son `numeric` en la base y un `numeric` no cabe sin pérdida en un
 * `number` de JavaScript.
 */

/**
 * El nombre del programa, en un solo lugar.
 *
 * El cliente lo dijo con todas las letras: «el nombre lo decidiremos juntos
 * después». Cuando lo decida, cambiarlo es editar esta línea. El backend
 * también publica el suyo (`programName`) y ese manda cuando llega: esto es lo
 * que se dice mientras no haya programa del que leerlo.
 */
export const NOMBRE_PROGRAMA_PUNTOS = 'Puntos AloVida';

/**
 * Hacia dónde mueve los puntos una entrada del ledger.
 *
 * Son los **códigos reales del catálogo** que publica la API
 * (`promotions:points-direction:*`), no un value set provisional del front.
 * Jamás se muestran: la etiqueta en castellano vive en `punto-motivo.ts`.
 */
export const DIRECCIONES_DE_PUNTOS = [
  'POINTS_EARN',
  'POINTS_REDEEM',
  'POINTS_EXPIRE',
  'POINTS_ADJUST',
] as const;

export type DireccionDePuntos = (typeof DIRECCIONES_DE_PUNTOS)[number];

/**
 * Por qué se movieron los puntos.
 *
 * Códigos reales del catálogo (`promotions:points-reason:*`). Un ajuste manual
 * es la compensación de una reversa: el ledger es append-only, así que devolver
 * puntos no borra la entrada original, agrega una nueva.
 */
export const MOTIVOS_DE_PUNTOS = [
  'REASON_SIGNUP',
  'REASON_EVENT',
  'REASON_REDEMPTION',
  'REASON_EXPIRY',
  'REASON_REFERRAL',
  'REASON_MANUAL',
] as const;

export type MotivoDePuntos = (typeof MOTIVOS_DE_PUNTOS)[number];

/**
 * El nivel de la membresía. Multiplica lo que se acumula: la regla dice cuántos
 * puntos vale el evento y el nivel los multiplica — ascender es lo que se
 * compra siendo fiel.
 */
export interface NivelDeMembresia {
  readonly codigo: string;
  readonly nombre: string;
  /** Cuánto multiplica la acumulación, o `null` si el nivel no lo declara. */
  readonly multiplicador: string | null;
  /** Desde cuántos puntos de por vida se alcanza. Texto exacto. */
  readonly puntosMinimos: string;
}

/**
 * Mi membresía del programa activo.
 *
 * `saldo` y `puntosDePorVida` son **proyecciones**: la fuente de verdad es el
 * ledger, y el backend las vuelve a derivar recorriéndolo entero cuando
 * recomputa. La pantalla las muestra, no las calcula.
 */
export interface Membresia {
  readonly id: string;
  /** El nombre legible del programa, tal como lo publica el backend. */
  readonly programa: string;
  /** Cómo se llaman las unidades («puntos»), del programa. */
  readonly unidad: string;
  /** Lo que se puede canjear hoy. Texto exacto. */
  readonly saldo: string;
  /**
   * Todo lo acumulado desde siempre. Texto exacto.
   *
   * No baja al canjear: el nivel mide lealtad acumulada, no saldo disponible.
   */
  readonly puntosDePorVida: string;
  readonly nivel: NivelDeMembresia | null;
  /** Cuándo se inscribió, si la lectura lo trae. */
  readonly inscritaEl: Date | null;
  /** Si la membresía está activa. El estado como concepto no se publica. */
  readonly activa: boolean;
}

/**
 * Una entrada del ledger, ya en palabras.
 *
 * El ledger es **append-only**: esto se lee y no se edita nunca. Una corrección
 * es otra entrada, no un cambio sobre ésta.
 */
export interface MovimientoDePuntos {
  readonly id: string;
  /**
   * `null` cuando la API no reconoce el concepto como uno de puntos. Es raro y
   * se dice: antes que inventar una dirección, la fila va sin signo.
   */
  readonly direccion: DireccionDePuntos | null;
  /** Siempre positivo; el signo lo dice `direccion`. Texto exacto. */
  readonly puntos: string;
  readonly motivo: MotivoDePuntos | null;
  /** El saldo que quedó después, o `null` si el origen no lo registró. */
  readonly saldoDespues: string | null;
  /** «Compra en Farmacia Central», o `null` si no hay de dónde decirlo. */
  readonly detalle: string | null;
  readonly ocurrioEl: Date;
  /** Cuándo vencen estos puntos, si el programa los hace vencer. */
  readonly venceEl: Date | null;
}

/**
 * Una página del ledger. **Por cursor, nunca por número de página**: es la
 * regla del M34, la misma que gobierna los listados de dominio.
 */
export interface PaginaDeMovimientos {
  readonly movimientos: readonly MovimientoDePuntos[];
  /** `null` = no hay más. */
  readonly nextCursor: string | null;
}

/**
 * El resultado de canjear. Espeja la respuesta de
 * `POST /loyalty/memberships/:id/points/redeem`, que ya autoriza a `MEMBER`.
 *
 * `duplicado` es la idempotencia: reintentar con la misma clave devuelve la
 * entrada anterior en vez de descontar dos veces.
 */
export interface Canje {
  /** El id de la entrada del ledger que registró el canje. */
  readonly id: string;
  readonly puntos: string;
  readonly saldoDespues: string;
  readonly puntosDePorVida: string;
  readonly duplicado: boolean;
}

/**
 * El comprobante que el paciente muestra en el comercio.
 *
 * **Esto es lo simulado del carril.** El código y su vencimiento los produce el
 * front: el lado comercio —quien escanea y descuenta— no existe todavía y está
 * declarado fuera de alcance (README de la tanda, tarjeta FAR-I6). Por eso la
 * pantalla lo muestra con el chip DEMO, y por eso este tipo vive separado de
 * `Canje`, que sí espeja el contrato real.
 *
 * TODO(lado comercio): cuando exista, el código lo emite el backend junto con
 * el canje y este tipo se funde con `Canje`.
 */
export interface ComprobanteDeCanje {
  readonly canje: Canje;
  /** Lo que se lee en voz alta si el escáner falla. Nunca un uuid. */
  readonly codigo: string;
  readonly generadoEl: Date;
  readonly venceEl: Date;
}

/** Lo que hace falta para pedir un canje. */
export interface PedidoDeCanje {
  readonly puntos: string;
  /**
   * La clave de idempotencia. La pone quien llama y la repite al reintentar:
   * es lo único que hace segura la reentrega desde una cola.
   */
  readonly idempotencyKey: string;
}
