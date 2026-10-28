import { TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter, Router } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import type { ContextoDeChat } from './contexto-de-chat';
import { contextoDeLaQuery, destinoDeLaQuery, enlaceDeChat, usarIrAlChat } from './enlace-de-chat';

/**
 * Lo que estas pruebas fijan.
 *
 * Que lo que arma un botón del marketplace vuelve entero al otro lado de la
 * URL, y que lo que **no** armó un botón —una ruta a otro sitio, un tipo
 * inventado, un título vacío— no se convierte en tarjeta.
 */
describe('enlace-de-chat', () => {
  const pedido: ContextoDeChat = {
    tipo: 'pedido',
    titulo: 'Farmacia Vida · Sucursal Central',
    detalle: '2 productos · 69,00 Bs',
    ruta: '/my-account/pharmacy-orders/7f3c',
  };

  describe('enlaceDeChat / contextoDeLaQuery', () => {
    it('ida y vuelta: lo que arma el botón es lo que lee la bandeja', () => {
      const params = enlaceDeChat({ escribirA: 'farmacia-vida' }, pedido);
      expect(params['escribirA']).toBe('farmacia-vida');
      expect(contextoDeLaQuery(convertToParamMap(params))).toEqual(pedido);
    });

    it('sin contexto es el ?escribirA= de siempre', () => {
      expect(enlaceDeChat({ escribirA: 'dra-quispe' })).toEqual({ escribirA: 'dra-quispe' });
      expect(contextoDeLaQuery(convertToParamMap({ escribirA: 'dra-quispe' }))).toBeNull();
    });

    it('el detalle es opcional y uno vacío no viaja', () => {
      const sinDetalle = { tipo: 'farmacia', titulo: 'Farmacia Vida', ruta: '/pharmacies-directory/farmacia-vida' } as const;
      const params = enlaceDeChat({ escribirA: 'farmacia-vida' }, { ...sinDetalle, detalle: '  ' });
      expect('detalle' in params).toBe(false);
      expect(contextoDeLaQuery(convertToParamMap(params))).toEqual(sinDetalle);
    });

    it('el chat de un pedido viaja como ?pedido=<id>, y un id que rearma la ruta no', () => {
      const params = enlaceDeChat({ pedido: 'o-1' }, pedido);
      expect(params['pedido']).toBe('o-1');
      expect('escribirA' in params).toBe(false);
      expect(destinoDeLaQuery(convertToParamMap(params))).toEqual({ pedido: 'o-1' });
      expect(destinoDeLaQuery(convertToParamMap({ pedido: '../admin' }))).toBeNull();
      expect(destinoDeLaQuery(convertToParamMap({ escribirA: 'x' }))).toEqual({ escribirA: 'x' });
      expect(destinoDeLaQuery(convertToParamMap({}))).toBeNull();
    });

    it.each([
      ['un tipo inventado', { sobre: 'receta' }],
      ['un título vacío', { titulo: '   ' }],
      ['una ruta a otro sitio', { ruta: 'https://otro-sitio.example/x' }],
      ['una ruta protocol-relative', { ruta: '//otro-sitio.example' }],
      ['una ruta que sube', { ruta: '/my-account/../admin' }],
      ['sin ruta', { ruta: '' }],
    ])('descarta el contexto entero con %s', (_caso, cambio) => {
      const params = { ...enlaceDeChat({ escribirA: 'farmacia-vida' }, pedido), ...cambio };
      expect(contextoDeLaQuery(convertToParamMap(params))).toBeNull();
    });
  });

  describe('usarIrAlChat', () => {
    let navegar: ReturnType<typeof vi.spyOn>;

    const montar = (conSesion: boolean) => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: SessionStore, useValue: { isAuthenticated: () => conSesion } },
        ],
      });
      const router = TestBed.inject(Router);
      navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      return TestBed.runInInjectionContext(() => usarIrAlChat());
    };

    it('con sesión va derecho a la bandeja con el contexto en la URL', () => {
      montar(true)({ escribirA: 'farmacia-vida' }, pedido);
      expect(navegar).toHaveBeenCalledWith(['/messaging'], {
        queryParams: enlaceDeChat({ escribirA: 'farmacia-vida' }, pedido),
      });
    });

    it('sin sesión pasa por el login y vuelve a la bandeja con todo puesto', () => {
      montar(false)({ escribirA: 'farmacia-vida' }, pedido);
      expect(navegar).toHaveBeenCalledTimes(1);
      const [destino, extras] = navegar.mock.calls[0] as [string[], { queryParams: { returnUrl: string } }];
      expect(destino).toEqual(['/auth']);
      const vuelta = TestBed.inject(Router).parseUrl(extras.queryParams.returnUrl);
      expect(vuelta.root.children['primary']?.segments.map((s) => s.path)).toEqual(['messaging']);
      expect(contextoDeLaQuery(vuelta.queryParamMap)).toEqual(pedido);
      expect(vuelta.queryParamMap.get('escribirA')).toBe('farmacia-vida');
    });
  });
});
