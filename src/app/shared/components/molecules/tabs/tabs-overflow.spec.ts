import { availableWidth, measureStrip } from './tabs-overflow';

/* The strip's overflow is measured against its room WITHOUT the arrows, so it
   is not sticky: a strip that fits once the arrows are gone drops them. */
describe('measureStrip', () => {
  it('fits when the content fits the bar, even while the arrows still narrow the list', () => {
    // 1440 → 390: arrows shown, list 268 px wide, content 300 px, bar 316 px.
    expect(measureStrip({ scrollWidth: 300, clientWidth: 268, scrollLeft: 32, availableWidth: 316 })).toEqual({
      overflows: false,
      canGoBack: false,
      canGoForward: false,
    });
  });

  it('overflows when the content is wider than the bar, and says where there is more', () => {
    expect(measureStrip({ scrollWidth: 600, clientWidth: 268, scrollLeft: 0, availableWidth: 316 })).toEqual({
      overflows: true,
      canGoBack: false,
      canGoForward: true,
    });
    expect(measureStrip({ scrollWidth: 600, clientWidth: 268, scrollLeft: 332, availableWidth: 316 })).toEqual({
      overflows: true,
      canGoBack: true,
      canGoForward: false,
    });
  });

  it('a one-pixel rounding excess is not an overflow', () => {
    expect(measureStrip({ scrollWidth: 317, clientWidth: 316, scrollLeft: 0, availableWidth: 316 }).overflows).toBe(false);
  });
});

describe('availableWidth', () => {
  it('is the bar width minus its horizontal padding', () => {
    const bar = document.createElement('div');
    bar.style.paddingLeft = '8px';
    bar.style.paddingRight = '8px';
    Object.defineProperty(bar, 'clientWidth', { value: 400 });
    document.body.appendChild(bar);
    expect(availableWidth(bar)).toBe(384);
    bar.remove();
  });
});
