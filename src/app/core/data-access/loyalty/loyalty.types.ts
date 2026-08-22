/**
 * Tipos de la billetera de puntos del paciente (carril FAR-I6).
 *
 * El backend tiene las tablas (`promotions.loyalty_programs`, `loyalty_tiers`,
 * `loyalty_memberships`, `points_ledger_entries`) y las escrituras, pero **no
 * tiene ninguna lectura para el paciente**: hoy los saldos sólo vuelven como
 * efecto colateral de un `POST`. Estos tipos espejan lo que devolverán las dos
 * lecturas pedidas en `COORDINACION-AGENTES.md`; cuando existan, el ajuste vive
 * acá y en el cliente, y las pantallas no se enteran.
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
 * Provisorio del front, como `ESTADOS_DE_PEDIDO`: en la base esto es
 * `direction_concept_id`, un concepto de terminología. Estos códigos son la
 * identidad mientras el catálogo no llegue, y **jamás se muestran** — la
 * etiqueta en castellano vive en la pantalla.
 *
 * TODO(FAR-E?): reemplazar por el concepto resuelto que devuelva la lectura.
 */
export const DIRECCIONES_DE_PUNTOS = ['CREDITO', 'DEBITO'] as const;

export type DireccionDePuntos = (typeof DIRECCIONES_DE_PUNTOS)[number];

/**
 * Por qué se movieron los puntos. Provisorio del front, igual que la dirección
 * (en la base es `reason_concept_id`).
 *
 * `AJUSTE` es la compensación de una reversa: el ledger es append-only, así que
 * devolver puntos no borra la entrada original, agrega una nueva.
 *
 * TODO(FAR-E?): reemplazar por el concepto resuelto que devuelva la lectura.
 */
export const MOTIVOS_DE_PUNTOS = [
  'BIENVENIDA',
  'COMPRA',
  'CANJE',
  'VENCIMIENTO',
  'AJUSTE',
] as const;

export type MotivoDePuntos = (typeof MOTIVOS_DE_PUNTOS)[number];

/** Provisorio del front; en la base es `status_concept_id`. */
export const ESTADOS_DE_MEMBRESIA = ['ACTIVA', 'SUSPENDIDA', 'CERRADA'] as const;

export type EstadoDeMembresia = (typeof ESTADOS_DE_MEMBRESIA)[number];

/**
 * El nivel de la membresía. Multiplica lo que se acumula: la regla dice cuántos
 * puntos vale el evento y el nivel los multiplica — ascender es lo que se
 * compra siendo fiel.
 */
export interface NivelDeMembresia {
  readonly codigo: string;
  readonly nombre: string;
  /** Cuánto multiplica la acumulación. Texto exacto: es `numeric`. */
  readonly multiplicador: string;
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
  readonly inscritaEl: Date;
  readonly estado: EstadoDeMembresia;
}

/**
 * Una entrada del ledger, ya en palabras.
 *
 * El ledger es **append-only**: esto se lee y no se edita nunca. Una corrección
 * es otra entrada, no un cambio sobre ésta.
 */
export interface MovimientoDePuntos {
  readonly id: string;
  readonly direccion: DireccionDePuntos;
  /** Siempre positivo; el signo lo dice `direccion`. Texto exacto. */
  readonly puntos: string;
  readonly motivo: MotivoDePuntos;
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
