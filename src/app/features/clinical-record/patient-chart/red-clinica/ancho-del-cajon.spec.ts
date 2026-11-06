import { NAV_DRAWER_MAX_WIDTH } from '../../../../core/layout/breakpoints';
import { CONSULTA_DEL_CAJON } from './ancho-del-cajon';

describe('AnchoDelCajon', () => {
  it('mirrors the Breakpoints nav drawer threshold', () => {
    expect(CONSULTA_DEL_CAJON).toBe(`(max-width: ${NAV_DRAWER_MAX_WIDTH - 1}px)`);
  });
});
