/* ============================================================================
    Los datos de demostración de T-E6 (pantalla J del mockup de farmacia).

    Nada de esto es contrato. Ni el cliente de puntos
    (`core/data-access/loyalty`) ni la API (`promotions`) conocen un
    multiplicador de promoción: el único que existe es el del nivel
    (`NivelDeMembresia.multiplicador`), que escala toda la acumulación y no
    tiene fecha de fin. Por eso estos datos viven junto a la pantalla, y la
    pantalla sólo los usa con `environment.loyaltyDemo` encendido.
    ========================================================================== */

/** Un día en milisegundos, para escribir la vigencia en días legibles. */
const UN_DIA = 24 * 60 * 60 * 1000;

/** Cuántos días le quedan a la promoción de ejemplo, contados desde hoy. */
const DIAS_DE_VIGENCIA_DE_LA_PROMOCION = 12;

/**
 * Cuántos puntos acredita «Simular compra» (F4.3).
 *
 * Un monto fijo de ejemplo, **no una regla**: cuántos puntos da una compra es
 * la negociación que el cliente todavía no cerró (F4.2), y esa línea es del
 * resumen del checkout, no de esta pantalla.
 */
export const PUNTOS_DE_COMPRA_SIMULADA = '120';

/**
 * El detalle con el que la compra simulada queda en el ledger.
 *
 * Es también lo que la marca como hecha con la promoción: el ledger no guarda
 * multiplicadores, así que la pantalla reconoce su propia compra de ejemplo
 * por el texto que ella misma escribió, y no marca ninguna otra.
 */
export const DETALLE_DE_COMPRA_SIMULADA = 'Compra con promoción en Farmacia Central';

/** La promoción de ejemplo que multiplica los puntos (F4.5). */
export interface PromocionDeEjemplo {
  /** Por cuánto multiplica. Texto exacto, como toda cifra de puntos. */
  readonly factor: string;
  /** Hasta cuándo dura. */
  readonly hasta: Date;
}

/**
 * La promoción activa de ejemplo.
 *
 * El fin se cuenta desde `ahora` para que la tarjeta nunca diga «activa» de
 * una promoción que ya terminó. No trae enlace, por la decisión D-T-E6-01: hoy
 * no hay un destino estable al que mandar a la persona, y el enlace a la
 * promoción lo completa T-E7 cuando exista su sección.
 */
export function promocionActivaDeEjemplo(ahora: Date = new Date()): PromocionDeEjemplo {
  return {
    factor: '2',
    hasta: new Date(ahora.getTime() + DIAS_DE_VIGENCIA_DE_LA_PROMOCION * UN_DIA),
  };
}
