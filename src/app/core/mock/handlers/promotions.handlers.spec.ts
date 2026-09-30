import { HttpHeaders } from '@angular/common/http';

import type { MyPromotionsResponseDto } from '../../data-access/promotions/promotions.dto';
import { crearRouterSimulado } from './index';
import { buscarUsuario } from '../mock-session';
import { isMockReply, type MockRequest } from '../mock-router';

/** `GET /promotions/me` del backend simulado, en los tres niveles. */
describe('handlers de promociones: GET /promotions/me', () => {
  const router = crearRouterSimulado();
  const paciente = buscarUsuario('paciente')!;

  function pedir(user: MockRequest['user']) {
    const match = router.match('GET', '/promotions/me');
    if (match === null) throw new Error('No existe GET /promotions/me');
    return match.handler({
      method: 'GET',
      path: '/promotions/me',
      params: match.params,
      query: new URLSearchParams(),
      body: {},
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest);
  }

  it('correcto — el paciente recibe las vigentes, con su propio cupón en la de cupón', () => {
    const page = pedir(paciente) as MyPromotionsResponseDto;

    expect(page.count).toBe(page.items.length);
    expect(page.items.map((item) => item.type?.code)).toEqual(['PROMO_AUTO', 'PROMO_COUPON']);
    const conCupon = page.items.find((item) => item.type?.code === 'PROMO_COUPON');
    expect(conCupon?.coupons).toHaveLength(1);
    // Todas vigentes: ninguna venció antes de hoy.
    for (const item of page.items) {
      expect(item.validTo === null || new Date(item.validTo) > new Date()).toBe(true);
    }
  });

  it('límite — el código del cupón es del titular: otra persona recibe otro', () => {
    const otro = { ...paciente, patientProfileId: '11111111-2222-4333-8444-555555555555' };
    const mio = (pedir(paciente) as MyPromotionsResponseDto).items[1]?.coupons[0]?.code;
    const suyo = (pedir(otro) as MyPromotionsResponseDto).items[1]?.coupons[0]?.code;

    expect(mio).toBeDefined();
    expect(suyo).toBeDefined();
    expect(mio).not.toBe(suyo);
  });

  it('inválido — sin perfil de paciente en la sesión responde la precondición, no un vacío', () => {
    const resultado = pedir(null);

    // El código, no el número: según la rama el doble lo responde 412 o 422.
    expect(isMockReply(resultado)).toBe(true);
    expect(isMockReply(resultado) ? resultado.status : 200).toBeGreaterThanOrEqual(400);
    expect(isMockReply(resultado) ? (resultado.body as { code: string }).code : null).toBe(
      'PRECONDITION_FAILED',
    );
  });
});
