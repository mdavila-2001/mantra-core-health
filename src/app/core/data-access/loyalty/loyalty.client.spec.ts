import { TestBed } from '@angular/core/testing';
import { firstValueFrom, lastValueFrom } from 'rxjs';

import { LoyaltyClient, SaldoInsuficienteError } from './loyalty.client';

/**
 * Lo que estas pruebas fijan son **las reglas del modelo**, no el mock.
 *
 * El saldo nunca queda negativo, canjear no toca los puntos de por vida ni el
 * nivel, el ledger sólo crece y la clave de idempotencia devuelve la entrada
 * anterior en vez de descontar dos veces. Son las de
 * `promotions.points_ledger_entries` (V51 del modelo, reglas 45-58): cuando el
 * backend reemplace este cliente, estas mismas pruebas tienen que seguir
 * pasando — si alguna deja de valer, es que el contrato cambió, no el mock.
 *
 * Corren con la demo **encendida**, que es el default de desarrollo
 * (`environment.development.ts`): la rama apagada —sin membresía— se verifica
 * en runtime, la misma convención que los otros specs de gates del repo.
 */
describe('LoyaltyClient', () => {
  let client: LoyaltyClient;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    client = TestBed.inject(LoyaltyClient);
  });

  describe('la membresía sembrada', () => {
    it('tiene saldo y puntos de por vida coherentes con el ledger', async () => {
      const cuenta = await firstValueFrom(client.miMembresia());
      const pagina = await firstValueFrom(client.misMovimientos(null));

      expect(cuenta).not.toBeNull();
      // El saldo es una proyección del ledger: el movimiento más nuevo lo dice.
      expect(pagina.movimientos[0].saldoDespues).toBe(cuenta?.saldo);
    });

    it('acumula más de por vida que el saldo disponible, porque hubo canjes', async () => {
      const cuenta = await firstValueFrom(client.miMembresia());

      expect(Number(cuenta?.puntosDePorVida)).toBeGreaterThan(Number(cuenta?.saldo));
    });

    it('entrega los puntos como texto, no como número', async () => {
      const cuenta = await firstValueFrom(client.miMembresia());

      // El `numeric` de la base no cabe sin pérdida en un `number`: la misma
      // regla que los importes del pedido de farmacia.
      expect(typeof cuenta?.saldo).toBe('string');
      expect(typeof cuenta?.puntosDePorVida).toBe('string');
    });
  });

  describe('el ledger', () => {
    it('pagina por cursor y no repite movimientos entre páginas', async () => {
      const primera = await firstValueFrom(client.misMovimientos(null));
      expect(primera.nextCursor).not.toBeNull();

      const segunda = await firstValueFrom(client.misMovimientos(primera.nextCursor));
      const idsPrimera = primera.movimientos.map((m) => m.id);
      const idsSegunda = segunda.movimientos.map((m) => m.id);

      expect(idsSegunda.some((id) => idsPrimera.includes(id))).toBe(false);
    });

    it('devuelve los movimientos del más nuevo al más viejo', async () => {
      const pagina = await firstValueFrom(client.misMovimientos(null));
      const fechas = pagina.movimientos.map((m) => m.ocurrioEl.getTime());

      expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    });

    it('vuelve al principio si el cursor no se reconoce', async () => {
      const primera = await firstValueFrom(client.misMovimientos(null));
      const conCursorRoto = await firstValueFrom(client.misMovimientos('no-existe'));

      expect(conCursorRoto.movimientos[0].id).toBe(primera.movimientos[0].id);
    });

    it('siempre entrega los puntos en positivo: el signo lo dice la dirección', async () => {
      const pagina = await firstValueFrom(client.misMovimientos(null));

      for (const movimiento of pagina.movimientos) {
        expect(Number(movimiento.puntos)).toBeGreaterThan(0);
      }
      expect(pagina.movimientos.some((m) => m.direccion === 'DEBITO')).toBe(true);
    });
  });

  describe('canjear', () => {
    it('descuenta del saldo y deja la entrada en el ledger', async () => {
      const antes = await firstValueFrom(client.miMembresia());
      const canje = await firstValueFrom(
        client.canjear({ puntos: '50', idempotencyKey: 'k-1' }),
      );
      const pagina = await firstValueFrom(client.misMovimientos(null));

      expect(Number(canje.saldoDespues)).toBe(Number(antes?.saldo) - 50);
      expect(pagina.movimientos[0].motivo).toBe('CANJE');
      expect(pagina.movimientos[0].direccion).toBe('DEBITO');
      expect(pagina.movimientos[0].puntos).toBe('50');
    });

    it('NO toca los puntos de por vida ni el nivel', async () => {
      const antes = await firstValueFrom(client.miMembresia());
      await firstValueFrom(client.canjear({ puntos: '100', idempotencyKey: 'k-2' }));
      const despues = await firstValueFrom(client.miMembresia());

      // El nivel mide lealtad acumulada, no saldo disponible: gastar no
      // degrada a nadie.
      expect(despues?.puntosDePorVida).toBe(antes?.puntosDePorVida);
      expect(despues?.nivel?.codigo).toBe(antes?.nivel?.codigo);
    });

    it('rechaza canjear más de lo que hay: el saldo nunca queda negativo', async () => {
      const cuenta = await firstValueFrom(client.miMembresia());
      const demasiado = String(Number(cuenta?.saldo) + 1);

      await expect(
        lastValueFrom(client.canjear({ puntos: demasiado, idempotencyKey: 'k-3' })),
      ).rejects.toBeInstanceOf(SaldoInsuficienteError);

      const sinCambios = await firstValueFrom(client.miMembresia());
      expect(sinCambios?.saldo).toBe(cuenta?.saldo);
    });

    it('rechaza un canje de cero o negativo', async () => {
      await expect(
        lastValueFrom(client.canjear({ puntos: '0', idempotencyKey: 'k-4' })),
      ).rejects.toBeInstanceOf(SaldoInsuficienteError);
      await expect(
        lastValueFrom(client.canjear({ puntos: '-10', idempotencyKey: 'k-5' })),
      ).rejects.toBeInstanceOf(SaldoInsuficienteError);
    });

    it('con la misma clave devuelve el canje anterior y no descuenta dos veces', async () => {
      const primero = await firstValueFrom(
        client.canjear({ puntos: '30', idempotencyKey: 'repetida' }),
      );
      const saldoTrasElPrimero = (await firstValueFrom(client.miMembresia()))?.saldo;

      const segundo = await firstValueFrom(
        client.canjear({ puntos: '30', idempotencyKey: 'repetida' }),
      );
      const saldoFinal = (await firstValueFrom(client.miMembresia()))?.saldo;

      expect(segundo.id).toBe(primero.id);
      expect(segundo.duplicado).toBe(true);
      expect(primero.duplicado).toBe(false);
      expect(saldoFinal).toBe(saldoTrasElPrimero);
    });

    it('el ledger sólo crece: canjear no borra ni edita lo anterior', async () => {
      const antes = await firstValueFrom(client.misMovimientos(null));
      const idsAntes = antes.movimientos.map((m) => m.id);

      await firstValueFrom(client.canjear({ puntos: '20', idempotencyKey: 'k-6' }));

      const despues = await firstValueFrom(client.misMovimientos(null));
      const idsDespues = despues.movimientos.map((m) => m.id);

      // El primero de antes sigue estando (corrido un lugar), con su mismo id.
      expect(idsDespues).toContain(idsAntes[0]);
      expect(idsDespues[0]).not.toBe(idsAntes[0]);
    });
  });

  describe('el comprobante de canje', () => {
    it('trae un código legible, sin caracteres que se confundan al dictarlo', async () => {
      const canje = await firstValueFrom(
        client.canjear({ puntos: '10', idempotencyKey: 'k-7' }),
      );
      const comprobante = client.comprobanteDe(canje);

      expect(comprobante.codigo).toMatch(/^[ACDEFHJKLMNPRTUVWXY34679]{8}$/);
    });

    it('vence después de haberse generado, no antes', async () => {
      const canje = await firstValueFrom(
        client.canjear({ puntos: '10', idempotencyKey: 'k-8' }),
      );
      const comprobante = client.comprobanteDe(canje);

      expect(comprobante.venceEl.getTime()).toBeGreaterThan(comprobante.generadoEl.getTime());
    });
  });

  describe('acreditarPorCompra (el puerto de la acumulación)', () => {
    it('suma al saldo Y a los puntos de por vida', async () => {
      const antes = await firstValueFrom(client.miMembresia());

      const despues = await firstValueFrom(client.acreditarPorCompra('75', 'Compra de prueba'));

      expect(Number(despues?.saldo)).toBe(Number(antes?.saldo) + 75);
      expect(Number(despues?.puntosDePorVida)).toBe(Number(antes?.puntosDePorVida) + 75);
    });

    it('ignora una acreditación de cero o inválida en vez de ensuciar el ledger', async () => {
      const antes = await firstValueFrom(client.misMovimientos(null));

      await firstValueFrom(client.acreditarPorCompra('0', 'Nada'));
      await firstValueFrom(client.acreditarPorCompra('no-es-un-numero', 'Nada'));

      const despues = await firstValueFrom(client.misMovimientos(null));
      expect(despues.movimientos[0].id).toBe(antes.movimientos[0].id);
    });
  });
});
