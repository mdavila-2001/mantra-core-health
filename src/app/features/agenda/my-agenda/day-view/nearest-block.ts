/** The minimum a block needs to be compared by time of day. */
interface TimedBlock {
  readonly clave: string;
  readonly desde: Date;
}

/**
 * The key, among `keys`, of the block that starts closest to `minute` (minutes
 * since midnight). With no match it falls back to the first key (empty if there are none).
 *
 * Used to land the focus on the nearest stretch after moving to another day
 * with the arrow keys.
 */
export function nearestBlockKey(
  blocks: readonly TimedBlock[],
  keys: readonly string[],
  minute: number,
): string {
  let chosen = keys[0] ?? '';
  let distance = Infinity;
  for (const block of blocks) {
    if (!keys.includes(block.clave)) continue;
    const d = Math.abs(block.desde.getHours() * 60 + block.desde.getMinutes() - minute);
    if (d < distance) {
      distance = d;
      chosen = block.clave;
    }
  }
  return chosen;
}
