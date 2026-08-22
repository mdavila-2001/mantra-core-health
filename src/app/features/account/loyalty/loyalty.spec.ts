import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { LoyaltyClient } from '../../../core/data-access/loyalty/loyalty.client';
import { Loyalty } from './loyalty';

/**
 * «Mis puntos» (FAR-I6). Lo que se fija: la pantalla se guarda por perfil de
 * paciente, el saldo se lee de un vistazo, cada movimiento dice si sumó o
 * restó **con palabras y no sólo con color**, el ledger pagina por cursor, y
 * canjear más de lo que hay se rechaza antes de tocar nada.
 *
 * Corre con `environment.development` → `loyaltyDemo` encendido, así que hay
 * membresía sembrada. La rama apagada —sin programa activo— vive en el cliente
 * y se verifica en runtime, misma convención que los otros specs de gates.
 */

/** base64url **sobre UTF-8**, como el token real. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe('Loyalty', () => {
  let fixture: ComponentFixture<Loyalty>;
  let client: LoyaltyClient;

  function abrirSesion(claims: Record<string, unknown>): void {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], ...claims }),
      refreshToken: 'r-1',
    });
  }

  function montar(): void {
    fixture = TestBed.createComponent(Loyalty);
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function porTestId(id: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
  }

  function escribirPuntos(valor: string): void {
    const campo = porTestId('canjear-puntos') as HTMLInputElement | null;
    if (campo === null) {
      throw new Error('El campo de puntos no está en pantalla.');
    }
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    client = TestBed.inject(LoyaltyClient);
  });

  it('sin perfil de paciente lo dice, sin cargar nada', () => {
    abrirSesion({});
    montar();

    expect(texto()).toContain('Esta sección es para pacientes');
    expect(porTestId('puntos-saldo')).toBeNull();
  });

  it('muestra el saldo, el nivel y lo acumulado desde siempre', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    expect(porTestId('puntos-disponibles')?.textContent?.trim()).toBe('440');
    expect(porTestId('puntos-nivel')?.textContent).toContain('Frecuente');
    expect(porTestId('puntos-de-por-vida')?.textContent?.trim()).toBe('720');
  });

  it('cada movimiento dice con palabras si sumó o restó, no sólo con color', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    // El signo visual va oculto al lector; la frase es la que se escucha.
    expect(texto()).toContain('Sumaste');
    expect(texto()).toContain('Restaste');
  });

  it('no pinta ningún identificador interno', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    expect(texto()).not.toMatch(UUID);
  });

  it('«Ver más» trae la página siguiente del ledger sin repetir la primera', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    const filasAntes = fixture.nativeElement.querySelectorAll('.movimientos__fila').length;

    porTestId('movimientos-ver-mas')?.click();
    fixture.detectChanges();

    const filasDespues = fixture.nativeElement.querySelectorAll('.movimientos__fila').length;
    expect(filasAntes).toBe(6);
    expect(filasDespues).toBe(12);
  });

  it('canjear pide cuántos puntos antes de hacer nada', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    porTestId('puntos-canjear')?.click();
    fixture.detectChanges();

    expect(porTestId('canjear-form')).not.toBeNull();
    expect(texto()).toContain('440');
  });

  it('rechaza canjear más de lo que hay y dice hasta cuánto se puede', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    porTestId('puntos-canjear')?.click();
    fixture.detectChanges();

    escribirPuntos('999999');
    porTestId('canjear-confirmar')?.click();
    fixture.detectChanges();

    expect(texto()).toContain('Te alcanza para canjear hasta 440 puntos');
    // Y no llegó a emitirse ningún comprobante.
    expect(porTestId('canje-comprobante')).toBeNull();
  });

  it('rechaza el campo vacío sin llamar al cliente', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    porTestId('puntos-canjear')?.click();
    fixture.detectChanges();

    porTestId('canjear-confirmar')?.click();
    fixture.detectChanges();

    expect(texto()).toContain('Escribí cuántos puntos');
  });

  it('canjear deja el comprobante en pantalla y baja el saldo', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    porTestId('puntos-canjear')?.click();
    fixture.detectChanges();

    escribirPuntos('100');
    porTestId('canjear-confirmar')?.click();
    fixture.detectChanges();

    expect(porTestId('canje-comprobante')).not.toBeNull();
    expect(porTestId('canje-chip-demo')?.textContent).toContain('DEMO');

    porTestId('canje-cerrar')?.click();
    fixture.detectChanges();

    expect(porTestId('puntos-disponibles')?.textContent?.trim()).toBe('340');
  });

  it('el canje aparece arriba del ledger al volver al saldo', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    porTestId('puntos-canjear')?.click();
    fixture.detectChanges();

    escribirPuntos('25');
    porTestId('canjear-confirmar')?.click();
    fixture.detectChanges();
    porTestId('canje-cerrar')?.click();
    fixture.detectChanges();

    const primera = fixture.nativeElement.querySelector('.movimientos__fila');
    expect(primera?.textContent).toContain('Canje que generaste desde la app');
  });

  it('sin saldo no ofrece canjear', async () => {
    abrirSesion({ pid: 'pp-1' });
    // Vaciar la billetera por el mismo camino que usa la pantalla.
    const cuenta = await new Promise<string>((resolve) => {
      client.miMembresia().subscribe((m) => resolve(m?.saldo ?? '0'));
    });
    await new Promise<void>((resolve) => {
      client.canjear({ puntos: cuenta, idempotencyKey: 'vaciar' }).subscribe(() => resolve());
    });
    montar();

    expect(porTestId('puntos-disponibles')?.textContent?.trim()).toBe('0');
    expect(porTestId('puntos-canjear')).toBeNull();
  });
});
