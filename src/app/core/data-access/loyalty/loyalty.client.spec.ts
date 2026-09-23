import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { LoyaltyClient, SaldoInsuficienteError } from './loyalty.client';
import type { MyLoyaltyResponseDto, PointsLedgerPageDto } from './loyalty.dto';
import type {
  Canje,
  Membresia,
  PaginaDeMovimientos,
} from './loyalty.types';

/**
 * El cliente de puntos contra el contrato real.
 *
 * Lo que se fija: que habla HTTP con el portal del paciente, que **nunca manda
 * un titular** —ni en la URL ni en el cuerpo—, que el cursor viaja opaco tal
 * como lo emitió el backend, y que `enrolled: false` es un vacío legítimo y no
 * un error. Y que nada de esto vuelve a fabricar datos.
 */
describe('LoyaltyClient', () => {
  let client: LoyaltyClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(LoyaltyClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('mi membresía', () => {
    it('pide GET /loyalty/me sin identificar al titular', () => {
      client.miMembresia().subscribe();

      const req = http.expectOne('/loyalty/me');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual([]);
      expect(req.request.urlWithParams).not.toContain('member');
      expect(req.request.urlWithParams).not.toContain('patient');
      req.flush({ enrolled: false });
    });

    it('enrolled:false es un vacío legítimo, no un error', () => {
      let recibido: unknown = 'sin llamar';
      client.miMembresia().subscribe((m) => (recibido = m));

      http.expectOne('/loyalty/me').flush({ enrolled: false });

      expect(recibido).toBeNull();
    });

    it('traduce la membresía real al dominio de la pantalla', () => {
      const dto: MyLoyaltyResponseDto = {
        enrolled: true,
        membership: {
          membershipId: 'm-1',
          programName: 'Puntos AloVida',
          pointsCurrencyName: 'puntos',
          pointsBalance: '440.00',
          lifetimePoints: '720.00',
          tier: {
            code: 'FRECUENTE',
            name: 'Frecuente',
            multiplier: '1.25',
            minPoints: '500',
          },
          enrolledAt: '2026-05-01T10:00:00.000Z',
          active: true,
        },
      };
      let membresia = null as Membresia | null;
      client.miMembresia().subscribe((m) => (membresia = m));

      http.expectOne('/loyalty/me').flush(dto);

      expect(membresia?.id).toBe('m-1');
      expect(membresia?.saldo).toBe('440.00');
      expect(membresia?.puntosDePorVida).toBe('720.00');
      expect(membresia?.nivel?.nombre).toBe('Frecuente');
      expect(membresia?.activa).toBe(true);
    });
  });

  describe('mis movimientos', () => {
    const pagina: PointsLedgerPageDto = {
      entries: [
        {
          entryId: 'e-1',
          direction: 'POINTS_EARN',
          points: '70.00',
          reason: 'REASON_EVENT',
          balanceAfter: '440.00',
          occurredAt: '2026-09-14T10:00:00.000Z',
        },
      ],
      nextCursor: 'cursor-opaco',
    };

    it('la primera página va sin cursor', () => {
      client.misMovimientos().subscribe();

      const req = http.expectOne((r) => r.url === '/loyalty/me/points');
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush({ entries: [] });
    });

    it('manda el cursor tal cual lo emitió el backend', () => {
      client.misMovimientos('cursor-opaco').subscribe();

      const req = http.expectOne((r) => r.url === '/loyalty/me/points');
      expect(req.request.params.get('cursor')).toBe('cursor-opaco');
      req.flush({ entries: [] });
    });

    it('traduce los movimientos y conserva el cursor siguiente', () => {
      let recibido = null as PaginaDeMovimientos | null;
      client.misMovimientos().subscribe((p) => (recibido = p));

      http.expectOne((r) => r.url === '/loyalty/me/points').flush(pagina);

      expect(recibido?.movimientos[0].id).toBe('e-1');
      expect(recibido?.movimientos[0].direccion).toBe('POINTS_EARN');
      expect(recibido?.movimientos[0].motivo).toBe('REASON_EVENT');
      expect(recibido?.nextCursor).toBe('cursor-opaco');
    });
  });

  describe('mis movimientos · casos límite', () => {
    it('sin cursor siguiente el dominio dice null, no undefined', () => {
      let recibido = null as PaginaDeMovimientos | null;
      client.misMovimientos().subscribe((p) => (recibido = p));

      http.expectOne((r) => r.url === '/loyalty/me/points').flush({ entries: [] });

      expect(recibido?.nextCursor).toBeNull();
    });

    it('un concepto que la API no reconoce llega como null, sin inventarlo', () => {
      let recibido = null as PaginaDeMovimientos | null;
      client.misMovimientos().subscribe((p) => (recibido = p));

      http.expectOne((r) => r.url === '/loyalty/me/points').flush({
        entries: [
          { entryId: 'e-9', points: '10.00', occurredAt: '2026-09-14T10:00:00.000Z' },
        ],
      });

      expect(recibido?.movimientos[0].direccion).toBeNull();
      expect(recibido?.movimientos[0].motivo).toBeNull();
    });
  });

  describe('canjear', () => {
    const respuesta = {
      ledgerEntryId: 'e-1',
      membershipId: 'm-1',
      points: '100',
      balanceAfter: '340.00',
      lifetimePoints: '720.00',
      duplicate: false,
    };

    it('manda sólo cantidad y clave: el titular sale del token', () => {
      client.canjear({ puntos: '100', idempotencyKey: 'k-1' }).subscribe();

      const req = http.expectOne('/loyalty/me/points/redeem');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ points: '100', idempotencyKey: 'k-1' });
      expect(Object.keys(req.request.body)).not.toContain('memberRefId');
      expect(Object.keys(req.request.body)).not.toContain('membershipId');
      req.flush(respuesta);
    });

    it('devuelve el canje real, con el saldo que dejó el backend', () => {
      let canje = null as Canje | null;
      client
        .canjear({ puntos: '100', idempotencyKey: 'k-1' })
        .subscribe((c) => (canje = c));

      http.expectOne('/loyalty/me/points/redeem').flush(respuesta);

      expect(canje?.id).toBe('e-1');
      expect(canje?.saldoDespues).toBe('340.00');
      expect(canje?.duplicado).toBe(false);
    });

    it('traduce el saldo insuficiente del backend a su error propio', () => {
      let error: unknown = null;
      client
        .canjear({ puntos: '999', idempotencyKey: 'k-2' })
        .subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne('/loyalty/me/points/redeem').flush(
        {
          code: 'PRECONDITION_FAILED',
          message: 'Saldo de puntos insuficiente',
          details: { pointsBalance: '340.00', requested: '999' },
          timestamp: '2026-09-18T10:00:00.000Z',
          path: '/loyalty/me/points/redeem',
        },
        { status: 412, statusText: 'Precondition Failed' },
      );

      expect(error).toBeInstanceOf(SaldoInsuficienteError);
      expect((error as SaldoInsuficienteError).saldo).toBe('340.00');
    });

    it('otro fallo no se disfraza de saldo insuficiente', () => {
      let error: unknown = null;
      client
        .canjear({ puntos: '10', idempotencyKey: 'k-3' })
        .subscribe({ error: (e: unknown) => (error = e) });

      http.expectOne('/loyalty/me/points/redeem').flush(
        { code: 'INTERNAL', message: 'boom', timestamp: 'x', path: 'y' },
        { status: 500, statusText: 'Server Error' },
      );

      expect(error).not.toBeInstanceOf(SaldoInsuficienteError);
    });
  });

  it('el comprobante sigue siendo local: la API no emite el código de canje', () => {
    const comprobante = client.comprobanteDe({
      id: 'e-1',
      puntos: '100',
      saldoDespues: '340.00',
      puntosDePorVida: '720.00',
      duplicado: false,
    });

    expect(comprobante.codigo).toHaveLength(8);
    expect(comprobante.codigo).not.toMatch(/[O0I1]/);
    expect(comprobante.venceEl.getTime()).toBeGreaterThan(
      comprobante.generadoEl.getTime(),
    );
  });
});
