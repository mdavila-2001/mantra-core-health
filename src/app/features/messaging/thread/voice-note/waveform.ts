/** Bars drawn for the waveform: enough to read the shape, few enough to fit 16rem. */
export const BARS = 36;
/** Speeds offered, in the order the button cycles through them. */
export const RATES = [1, 1.5, 2] as const;

/** Peak of each slice, scaled so the loudest bar fills the height. */
export function peaksOf(samples: Float32Array): number[] {
  const size = Math.max(1, Math.floor(samples.length / BARS));
  const raw = Array.from({ length: BARS }, (_, bar) => {
    let peak = 0;
    for (let i = bar * size; i < (bar + 1) * size && i < samples.length; i++) {
      peak = Math.max(peak, Math.abs(samples[i]!));
    }
    return peak;
  });
  const loudest = Math.max(...raw, 0.0001);
  return raw.map((peak) => Math.max(0.15, peak / loudest));
}

export function clock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
