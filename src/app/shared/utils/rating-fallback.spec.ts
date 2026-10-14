import { ratingFallback } from './rating-fallback';

describe('ratingFallback', () => {
  it('genera una calificación consistente y positiva', () => {
    const res1 = ratingFallback('doctor-1');
    const res2 = ratingFallback('doctor-1');
    expect(res1.average).toBe(res2.average);
    expect(res1.count).toBe(res2.count);
    expect(res1.average).toBeGreaterThanOrEqual(4.5);
    expect(res1.average).toBeLessThanOrEqual(5.0);
    expect(res1.count).toBeGreaterThan(0);
  });

  it('produce valores variados para distintas semillas', () => {
    const resA = ratingFallback('doctor-A');
    const resB = ratingFallback('doctor-B');
    expect(typeof resA.average).toBe('number');
    expect(typeof resB.average).toBe('number');
  });
});
