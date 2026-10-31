import { isShareTokenRoute } from './share-return-url';

describe('isShareTokenRoute', () => {
  it.each(['/rx/abc', '/rx//abc', '/administration/pharmacy-orders/rx/abc?x=1'])(
    '%s lleva el token',
    (url) => {
      expect(isShareTokenRoute(url)).toBe(true);
    },
  );

  it.each([null, '/', '/rx', '/rx/', '/verify/rx/0d9f', '/rxnorm/abc', '/my-account?next=/rx/abc'])(
    '%s no',
    (url) => {
      expect(isShareTokenRoute(url)).toBe(false);
    },
  );
});
