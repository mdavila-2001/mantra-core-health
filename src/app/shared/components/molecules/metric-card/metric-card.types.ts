export const METRIC_TONES = ['neutral', 'primary', 'success', 'warning', 'error', 'info'] as const;
export type MetricTone = (typeof METRIC_TONES)[number];
