import { TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter, Router } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import type { ContextoDeChat } from './contexto-de-chat';
import {
  destinoDeLaQuery,
  enlaceDeChat,
  guardarContexto,
  nonceDeLaQuery,
  PREFIJO_DE_CONTEXTO,
  tomarContexto,
  usarIrAlChat,
  VIGENCIA_DE_CONTEXTO_MS,
} from './enlace-de-chat';

/**
 * Lo que estas pruebas fijan (H1).
 *
 * Que el contexto **no viaja en la URL**: el botón lo deja en la pestaña bajo
 * un nonce de un solo uso y la URL lleva sólo el nonce. Un enlace de afuera no
 * puede fabricar un nonce que exista en `sessionStorage`, así que no puede
 * hacer que alguien mande una tarjeta con un título elegido por otro. Y que lo
 * guardado se vuelve a validar al leerlo.
 */
describe('enlace-de-chat', () => {
  const pedido: ContextoDeChat = {
    tipo: 'pedido',
    titulo: 'Farmacia Vida · Sucursal Central',
    detalle: '2 productos · 69,00 Bs',
    ruta: '/my-account/pharmacy-orders/7f3c',
  };

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  describe('enlaceDeChat', () => {
    it('lleva a quién y, como mucho, el nonce: nunca el contexto', () => {
      const nonce = guardarContexto(pedido)!;
      const params = enlaceDeChat({ escribirA: 'farmacia-vida' }, nonce);
      expect(params).toEqual({ escribirA: 'farmacia-vida', ctx: nonce });
      expect(JSON.stringify(params)).not.toContain('Farmacia Vida');
    });

    it('sin contexto es el ?escribirA= de siempre', () => {
      expect(enlaceDeChat({ escribirA: 'dra-quispe' })).toEqual({ escribirA: 'dra-quispe' });
    });

    it('el chat de un pedido viaja como ?pedido=<id>, y un id que rearma la ruta no', () => {
      const params = enlaceDeChat({ pedido: 'o-1' });
      expect(params).toEqual({ pedido: 'o-1' });
      expect(destinoDeLaQuery(convertToParamMap(params))).toEqual({ pedido: 'o-1' });
      expect(destinoDeLaQuery(convertToParamMap({ pedido: '../admin' }))).toBeNull();
      expect(destinoDeLaQuery(convertToParamMap({ escribirA: 'x' }))).toEqual({ escribirA: 'x' });
      expect(destinoDeLaQuery(convertToParamMap({}))).toBeNull();
    });
  });

  describe('guardarContexto / tomarContexto', () => {
    it('ida y vuelta: lo que deja el botón es lo que lee la bandeja, una sola vez', () => {
      const nonce = guardarContexto(pedido)!;
      expect(nonce).toMatch(/^[0-9a-f-]{36}$/u);
      expect(tomarContexto(nonce)).toEqual(pedido);
      // De un solo uso: un refresco o un segundo `queryParamMap` no lo encuentran.
      expect(tomarContexto(nonce)).toBeNull();
      expect(sessionStorage.getItem(PREFIJO_DE_CONTEXTO + nonce)).toBeNull();
    });

    it('un nonce inventado —el de un enlace externo— no da tarjeta', () => {
      guardarContexto(pedido);
      expect(tomarContexto('falso')).toBeNull();
      expect(tomarContexto('00000000-0000-4000-8000-000000000000')).toBeNull();
      expect(tomarContexto(null)).toBeNull();
      expect(nonceDeLaQuery(convertToParamMap({ ctx: 'falso' }))).toBeNull();
    });

    it('el detalle es opcional y uno vacío no se guarda', () => {
      const sinDetalle = { tipo: 'farmacia', titulo: 'Farmacia Vida', ruta: '/pharmacies-directory/farmacia-vida' } as const;
      const nonce = guardarContexto({ ...sinDetalle, detalle: '  ' })!;
      expect(tomarContexto(nonce)).toEqual(sinDetalle);
    });

    it('un contexto inválido ni se guarda', () => {
      expect(guardarContexto({ ...pedido, ruta: 'https://otro.example' })).toBeNull();
      expect(guardarContexto({ ...pedido, titulo: '   ' })).toBeNull();
    });

    it.each([
      ['un tipo inventado', { tipo: 'receta' }],
      ['un título vacío', { titulo: '   ' }],
      ['una ruta a otro sitio', { ruta: 'https://otro-sitio.example/x' }],
      ['una ruta protocol-relative', { ruta: '//otro-sitio.example' }],
      ['una ruta que sube', { ruta: '/my-account/../admin' }],
      ['sin ruta', { ruta: '' }],
    ])('lo guardado se valida otra vez al leerlo: descarta %s', (_caso, cambio) => {
      const nonce = guardarContexto(pedido)!;
      // Alguien con acceso a la pestaña lo reescribió: igual no pasa.
      sessionStorage.setItem(
        PREFIJO_DE_CONTEXTO + nonce,
        JSON.stringify({ contexto: { ...pedido, ...cambio }, guardadoEn: Date.now() }),
      );
      expect(tomarContexto(nonce)).toBeNull();
    });

    it('uno vencido no da tarjeta', () => {
      const ahora = Date.now();
      const nonce = guardarContexto(pedido, ahora)!;
      expect(tomarContexto(nonce, ahora + VIGENCIA_DE_CONTEXTO_MS + 1)).toBeNull();
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

    it('con sesión va derecho a la bandeja con el nonce, y el contexto queda en la pestaña', () => {
      montar(true)({ escribirA: 'farmacia-vida' }, pedido);
      const [destino, extras] = navegar.mock.calls[0] as [string[], { queryParams: Record<string, string> }];
      expect(destino).toEqual(['/messaging']);
      expect(Object.keys(extras.queryParams).sort()).toEqual(['ctx', 'escribirA']);
      expect(tomarContexto(extras.queryParams['ctx'] ?? null)).toEqual(pedido);
    });

    it('sin sesión pasa por el login y, en la misma pestaña, el nonce sigue sirviendo a la vuelta', () => {
      montar(false)({ escribirA: 'farmacia-vida' }, pedido);
      expect(navegar).toHaveBeenCalledTimes(1);
      const [destino, extras] = navegar.mock.calls[0] as [string[], { queryParams: { returnUrl: string } }];
      expect(destino).toEqual(['/auth']);
      const vuelta = TestBed.inject(Router).parseUrl(extras.queryParams.returnUrl);
      expect(vuelta.root.children['primary']?.segments.map((s) => s.path)).toEqual(['messaging']);
      expect(vuelta.queryParamMap.get('escribirA')).toBe('farmacia-vida');
      expect(vuelta.queryParamMap.has('titulo')).toBe(false);
      // `sessionStorage` sobrevive al login en la pestaña: la bandeja lo encuentra.
      expect(tomarContexto(nonceDeLaQuery(vuelta.queryParamMap))).toEqual(pedido);
    });

    it('sin contexto no deja nada en la pestaña', () => {
      montar(true)({ pedido: 'o-1' });
      expect(navegar).toHaveBeenCalledWith(['/messaging'], { queryParams: { pedido: 'o-1' } });
      expect(sessionStorage.length).toBe(0);
    });
  });
});
