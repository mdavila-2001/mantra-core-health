/* ============================================================================
    Aleatoriedad determinista. Los datos de demostración tienen que ser
    idénticos en cada carga y en cada prueba: una cifra que cambia al recargar
    no se puede comparar entre pantallas.
    ========================================================================== */

/** Hash FNV-1a de 32 bits: convierte una clave de texto en una semilla estable. */
export function hashSeed(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: generador de 32 bits, rápido y suficiente para datos de demostración. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido multiplicativo centrado en 1 (±`amplitude`), estable para una clave. */
export function noise(key: string, amplitude: number): number {
  const value = mulberry32(hashSeed(key))();
  return 1 + (value * 2 - 1) * amplitude;
}

/** Número en [0, 1) estable para una clave. */
export function unit(key: string): number {
  return mulberry32(hashSeed(key))();
}
