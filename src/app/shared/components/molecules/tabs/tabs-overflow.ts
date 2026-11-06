/**
 * How the tab strip overflows, measured against the space the strip WOULD have
 * without its scroll arrows. Measuring against the list's own width (which the
 * arrows narrow) made the overflow sticky: once the arrows showed, the strip
 * could never fit again — e.g. after rotating or shrinking 1440 → 390 px.
 */

/** What is read from the DOM: the list's sizes and scroll, and the bar's inner width. */
export interface StripMetrics {
  /** The list's content width (`scrollWidth`): never smaller than its own box. */
  readonly scrollWidth: number;
  /** The list's visible width (`clientWidth`), arrows taken off when shown. */
  readonly clientWidth: number;
  readonly scrollLeft: number;
  /** The bar's inner width: what the list gets when there are no arrows. */
  readonly availableWidth: number;
}

export interface StripOverflow {
  readonly overflows: boolean;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

/** One pixel of slack: fractional widths make `scrollWidth` exceed by rounding. */
const SLACK = 1;

export function measureStrip(metrics: StripMetrics): StripOverflow {
  const overflows = metrics.scrollWidth - metrics.availableWidth > SLACK;
  const hidden = metrics.scrollWidth - metrics.clientWidth;
  return {
    overflows,
    canGoBack: overflows && metrics.scrollLeft > SLACK,
    canGoForward: overflows && metrics.scrollLeft < hidden - SLACK,
  };
}

/** The bar's width minus its horizontal padding: the list's width without arrows. */
export function availableWidth(bar: HTMLElement): number {
  const style = getComputedStyle(bar);
  return bar.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
}
