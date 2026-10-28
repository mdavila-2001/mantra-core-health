import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter, Router } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import type { ContextoDeChat } from './contexto-de-chat';
import {
  almacenDeLaPestana,
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
    ruta: '/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6',
  };

  /** A dónde lleva el botón en estas pruebas. */
  const VIDA = { escribirA: 'farmacia-vida' } as const;
  const guardar = (contexto: ContextoDeChat, ahora?: number): string | null =>
    guardarContexto(VIDA, contexto, sessionStorage, ahora);
  const tomar = (nonce: string | null, ahora?: number): ContextoDeChat | null =>
    tomarContexto(nonce, VIDA, sessionStorage, ahora);

  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  describe('enlaceDeChat', () => {
    it('lleva a quién y, como mucho, el nonce: nunca el contexto', () => {
      const nonce = guardar(pedido)!;
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
      const nonce = guardar(pedido)!;
      expect(nonce).toMatch(/^[0-9a-f-]{36}$/u);
      expect(tomar(nonce)).toEqual(pedido);
      // De un solo uso: un refresco o un segundo `queryParamMap` no lo encuentran.
      expect(tomar(nonce)).toBeNull();
      expect(sessionStorage.getItem(PREFIJO_DE_CONTEXTO + nonce)).toBeNull();
    });

    it('un nonce inventado —el de un enlace externo— no da tarjeta', () => {
      guardar(pedido);
      expect(tomar('falso')).toBeNull();
      expect(tomar('00000000-0000-4000-8000-000000000000')).toBeNull();
      expect(tomar(null)).toBeNull();
      expect(nonceDeLaQuery(convertToParamMap({ ctx: 'falso' }))).toBeNull();
    });

    it('el detalle es opcional y uno vacío no se guarda', () => {
      const sinDetalle = { tipo: 'farmacia', titulo: 'Farmacia Vida', ruta: '/pharmacies-directory/farmacia-vida' } as const;
      const nonce = guardar({ ...sinDetalle, detalle: '  ' })!;
      expect(tomar(nonce)).toEqual(sinDetalle);
    });

    it('un contexto inválido ni se guarda', () => {
      expect(guardar({ ...pedido, ruta: 'https://otro.example' })).toBeNull();
      expect(guardar({ ...pedido, titulo: '   ' })).toBeNull();
    });

    it.each([
      ['un tipo inventado', { tipo: 'receta' }],
      ['un título vacío', { titulo: '   ' }],
      ['una ruta a otro sitio', { ruta: 'https://otro-sitio.example/x' }],
      ['una ruta protocol-relative', { ruta: '//otro-sitio.example' }],
      ['una ruta que sube', { ruta: '/my-account/../admin' }],
      ['sin ruta', { ruta: '' }],
    ])('lo guardado se valida otra vez al leerlo: descarta %s', (_caso, cambio) => {
      const nonce = guardar(pedido)!;
      // Alguien con acceso a la pestaña lo reescribió: igual no pasa.
      sessionStorage.setItem(
        PREFIJO_DE_CONTEXTO + nonce,
        JSON.stringify({ contexto: { ...pedido, ...cambio }, destino: VIDA, guardadoEn: Date.now() }),
      );
      expect(tomar(nonce)).toBeNull();
    });

    it('L-1 · la tarjeta sale sólo hacia el destino que eligió el botón', () => {
      const nonce = guardar(pedido)!;
      // Alguien cambió `escribirA` en la URL y dejó el `ctx=`: no hay tarjeta,
      // y el nonce queda consumido igual.
      expect(tomarContexto(nonce, { escribirA: 'otra-farmacia' }, sessionStorage)).toBeNull();
      expect(tomar(nonce)).toBeNull();

      const delPedido = guardarContexto({ pedido: 'o-1' }, pedido, sessionStorage)!;
      expect(tomarContexto(delPedido, { escribirA: 'o-1' }, sessionStorage)).toBeNull();
      const otraVez = guardarContexto({ pedido: 'o-1' }, pedido, sessionStorage)!;
      expect(tomarContexto(otraVez, { pedido: 'o-2' }, sessionStorage)).toBeNull();
      const bien = guardarContexto({ pedido: 'o-1' }, pedido, sessionStorage)!;
      expect(tomarContexto(bien, { pedido: 'o-1' }, sessionStorage)).toEqual(pedido);
    });

    it('L-1 · lo guardado sin destino (o con otro formato) no da tarjeta', () => {
      const nonce = guardar(pedido)!;
      sessionStorage.setItem(
        PREFIJO_DE_CONTEXTO + nonce,
        JSON.stringify({ contexto: pedido, guardadoEn: Date.now() }),
      );
      expect(tomar(nonce)).toBeNull();
    });

    it('L-1 · guardar barre los contextos vencidos o ilegibles de la pestaña, y deja los vigentes', () => {
      const ahora = Date.now();
      const viejo = guardar(pedido, ahora - VIGENCIA_DE_CONTEXTO_MS - 1)!;
      const vigente = guardar(pedido, ahora - 1000)!;
      sessionStorage.setItem(`${PREFIJO_DE_CONTEXTO}roto`, '{no es json');
      sessionStorage.setItem('otra.cosa', 'se queda');

      const nuevo = guardar(pedido, ahora)!;

      expect(sessionStorage.getItem(PREFIJO_DE_CONTEXTO + viejo)).toBeNull();
      expect(sessionStorage.getItem(`${PREFIJO_DE_CONTEXTO}roto`)).toBeNull();
      expect(sessionStorage.getItem(PREFIJO_DE_CONTEXTO + vigente)).not.toBeNull();
      expect(sessionStorage.getItem(PREFIJO_DE_CONTEXTO + nuevo)).not.toBeNull();
      expect(sessionStorage.getItem('otra.cosa')).toBe('se queda');
    });

    it('L-1 · sin almacenamiento (SSR) ni se guarda ni se lee', () => {
      expect(guardarContexto(VIDA, pedido, null)).toBeNull();
      const nonce = guardar(pedido)!;
      expect(tomarContexto(nonce, VIDA, null)).toBeNull();
    });

    it('uno vencido no da tarjeta', () => {
      const ahora = Date.now();
      const nonce = guardar(pedido, ahora)!;
      expect(tomar(nonce, ahora + VIGENCIA_DE_CONTEXTO_MS + 1)).toBeNull();
    });
  });

  describe('almacenDeLaPestana', () => {
    it('L-1 · en el servidor no hay almacenamiento aunque Node exponga `sessionStorage` global', () => {
      TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
      expect(typeof sessionStorage).not.toBe('undefined');
      expect(TestBed.runInInjectionContext(() => almacenDeLaPestana())).toBeNull();
    });

    it('en el navegador es el `sessionStorage` de la pestaña', () => {
      TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
      expect(TestBed.runInInjectionContext(() => almacenDeLaPestana())).toBe(sessionStorage);
    });

    it('usarIrAlChat en el servidor no deja nada en el `sessionStorage` del proceso', () => {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'server' },
          { provide: SessionStore, useValue: { isAuthenticated: () => true } },
        ],
      });
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      TestBed.runInInjectionContext(() => usarIrAlChat())(VIDA, pedido);
      expect(sessionStorage.length).toBe(0);
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
      expect(tomar(extras.queryParams['ctx'] ?? null)).toEqual(pedido);
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
      expect(tomar(nonceDeLaQuery(vuelta.queryParamMap))).toEqual(pedido);
    });

    it('sin contexto no deja nada en la pestaña', () => {
      montar(true)({ pedido: 'o-1' });
      expect(navegar).toHaveBeenCalledWith(['/messaging'], { queryParams: { pedido: 'o-1' } });
      expect(sessionStorage.length).toBe(0);
    });
  });
});
