import { NAV_DRAWER_MAX_WIDTH } from '../../../../core/layout/breakpoints';
import { CONSULTA_DEL_CAJON } from './ancho-del-cajon';

describe('AnchoDelCajon', () => {
  it('turns the panel into a sheet well above the nav drawer threshold', () => {
    const ancho = Number(/max-width: (\d+)px/.exec(CONSULTA_DEL_CAJON)?.[1]);
    expect(ancho).toBe(1279);
    // At 1024 px (nav sidebar + 26rem panel) the canvas was left at 280 px.
    expect(ancho).toBeGreaterThan(NAV_DRAWER_MAX_WIDTH + 400);
  });
});
