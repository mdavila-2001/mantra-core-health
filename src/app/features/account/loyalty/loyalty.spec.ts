import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { SessionStore } from '../../../core/auth/session.store';
import { LoyaltyClient } from '../../../core/data-access/loyalty/loyalty.client';
import type {
  Membresia,
  MovimientoDePuntos,
} from '../../../core/data-access/loyalty/loyalty.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { TOAST_DEFAULT_DURATION_MS } from '../../../shared/components/molecules/toast/toast.types';
import { Loyalty } from './loyalty';
import { DETALLE_DE_COMPRA_SIMULADA, promocionActivaDeEjemplo } from './loyalty.fixtures';

/**
 * «Mis puntos» (FAR-I6). Lo que se fija: la pantalla se guarda por perfil de
 * paciente, el saldo se lee de un vistazo, cada movimiento dice si sumó o
 * restó **con palabras y no sólo con color**, el ledger pagina por cursor, y
 * canjear más de lo que hay se rechaza antes de tocar nada.
 *
 * T-E6 suma la marca «nombre provisional», «Simular compra» con su toast y la
 * promoción x2 de ejemplo —sin enlace, D-T-E6-01—, y fija que nada de eso
 * aparezca con `loyaltyDemo` apagado.
 *
 * Corre con `environment.development` → `loyaltyDemo` encendido, así que hay
 * membresía sembrada. La rama apagada se prueba abajo, apagando la llave antes
 * de construir el cliente.
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

/** El texto como lo lee una persona: sin los saltos de la plantilla. */
function normalizado(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim();
}

/** `dd/MM`, como lo pinta la tarjeta. */
function diaYMes(fecha: Date): string {
  return `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

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

  function simularCompra(): void {
    porTestId('puntos-simular-compra')?.click();
    fixture.detectChanges();
  }

  function chipsDeMultiplicador(): NodeListOf<HTMLElement> {
    return (fixture.nativeElement as HTMLElement).querySelectorAll(
      '[data-testid="movimiento-multiplicador"]',
    );
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
    // D-T-E6-02: el código se presenta en la caja del supermercado.
    expect(texto()).toContain('presentar en la caja del supermercado');
    expect(texto().toLowerCase()).not.toContain('mostrador');
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

  it('rechaza los decimales diciendo la verdad, sin culpar al saldo', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    porTestId('puntos-canjear')?.click();
    fixture.detectChanges();

    escribirPuntos('0.5');
    porTestId('canjear-confirmar')?.click();
    fixture.detectChanges();

    // Se queda en el formulario y explica el motivo real: los puntos son
    // enteros. Culpar al saldo sería mentir — hay 440.
    expect(porTestId('canjear-form')).not.toBeNull();
    expect(texto()).toContain('Los puntos son enteros');
    expect(texto()).not.toContain('no alcanza');
    expect(texto()).not.toContain('Te alcanza para canjear');
  });

  it('nunca canjea una cantidad distinta de la pedida', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    porTestId('puntos-canjear')?.click();
    fixture.detectChanges();

    escribirPuntos('1.9');
    porTestId('canjear-confirmar')?.click();
    fixture.detectChanges();

    // Truncar a 1 en silencio descontaría algo que nadie pidió.
    expect(porTestId('canje-comprobante')).toBeNull();
    expect(porTestId('canjear-form')).not.toBeNull();
  });

  it('con un solo punto el texto concuerda en singular', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    porTestId('puntos-canjear')?.click();
    fixture.detectChanges();

    escribirPuntos('1');
    porTestId('canjear-confirmar')?.click();
    fixture.detectChanges();

    expect(porTestId('canje-puntos')?.textContent?.trim()).toBe('1 punto');
  });

  /* ─── T-E6 ─────────────────────────────────────────────────────────────── */

  it('marca el nombre del programa como provisional, sin cambiarlo (F4.1)', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    expect(fixture.nativeElement.querySelector('#saldo-titulo')?.textContent?.trim()).toBe(
      'Puntos AloVida',
    );
    expect(porTestId('puntos-nombre-provisional')?.textContent?.trim()).toBe('nombre provisional');
  });

  it('la tarjeta dice «puntos x2» y hasta cuándo, con badge y sin enlace (F4.5, D-T-E6-01)', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    const tarjeta = porTestId('puntos-promocion');
    expect(normalizado(tarjeta?.querySelector('h2')?.textContent)).toBe(
      `Promoción activa: puntos x2 hasta el ${diaYMes(promocionActivaDeEjemplo().hasta)}`,
    );
    expect(porTestId('puntos-promocion-multiplicador')?.textContent?.trim()).toBe('x2');
    expect(porTestId('puntos-promocion-chip-demo')?.textContent).toContain('DEMO');
    // El enlace a la promoción queda para T-E7.
    expect(tarjeta?.querySelector('a, [href], [routerlink]')).toBeNull();
  });

  it('el x2 de la promoción no sale del multiplicador del nivel', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    // El nivel sembrado «Frecuente» multiplica por 1.25: si la tarjeta leyera
    // ese campo, diría x1.25.
    expect(porTestId('puntos-nivel')?.textContent).toContain('Frecuente');
    expect(porTestId('puntos-promocion')?.textContent).not.toContain('1.25');
  });

  it('antes de simular, ningún movimiento sembrado lleva el chip x2', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    expect(chipsDeMultiplicador()).toHaveLength(0);
  });

  it('«Simular compra» acredita por el cliente, avisa con un toast y deja el movimiento arriba con x2 (F4.3)', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    const toasts = TestBed.inject(ToastService);

    simularCompra();

    expect(porTestId('puntos-disponibles')?.textContent?.trim()).toBe('560');
    expect(porTestId('puntos-de-por-vida')?.textContent?.trim()).toBe('840');
    expect(toasts.toasts()).toEqual([
      expect.objectContaining({
        type: 'success',
        message: 'Sumaste 120 Puntos AloVida por tu compra',
      }),
    ]);

    const primera = fixture.nativeElement.querySelector('.movimientos__fila') as HTMLElement;
    expect(primera.textContent).toContain(DETALLE_DE_COMPRA_SIMULADA);
    expect(primera.textContent).toContain('+120');
    expect(
      primera.querySelector('[data-testid="movimiento-multiplicador"]')?.textContent?.trim(),
    ).toBe('x2');
    // Sólo la compra simulada: a ningún otro movimiento se le inventa el x2.
    expect(chipsDeMultiplicador()).toHaveLength(1);
  });

  it('el saldo simulado es el del cliente, no una copia de la pantalla', async () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    simularCompra();

    const enElCliente = await new Promise<string | undefined>((resolve) => {
      client.miMembresia().subscribe((m) => resolve(m?.saldo));
    });
    expect(enElCliente).toBe('560');
  });

  it('el toast de la acreditación se va solo', () => {
    vi.useFakeTimers();
    try {
      abrirSesion({ pid: 'pp-1' });
      montar();
      const toasts = TestBed.inject(ToastService);

      simularCompra();
      expect(toasts.toasts()).toHaveLength(1);

      vi.advanceTimersByTime(Number(TOAST_DEFAULT_DURATION_MS.success));
      expect(toasts.toasts()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('después de simular, saldo → canjear → comprobante sigue funcionando', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    simularCompra();

    porTestId('puntos-canjear')?.click();
    fixture.detectChanges();
    escribirPuntos('100');
    porTestId('canjear-confirmar')?.click();
    fixture.detectChanges();

    expect(porTestId('canje-comprobante')).not.toBeNull();
    expect(porTestId('canje-caja')?.textContent).toContain(
      'Mostrá este código en la caja del supermercado',
    );
    expect(porTestId('canje-vence')).not.toBeNull();

    porTestId('canje-cerrar')?.click();
    fixture.detectChanges();

    expect(porTestId('puntos-disponibles')?.textContent?.trim()).toBe('460');
    const primera = fixture.nativeElement.querySelector('.movimientos__fila');
    expect(primera?.textContent).toContain('Canje que generaste desde la app');
  });
});

/**
 * `loyaltyDemo` apagado. La llave se apaga **antes** de que exista el cliente,
 * porque el cliente siembra al construirse; y se restaura después, porque el
 * entorno es un solo objeto para toda la corrida.
 */
describe('Loyalty con loyaltyDemo apagado', () => {
  const entorno = environment as { loyaltyDemo: boolean };
  const original = entorno.loyaltyDemo;

  const MEMBRESIA_REAL: Membresia = {
    id: 'm-1',
    programa: 'Puntos AloVida',
    unidad: 'puntos',
    saldo: '50',
    puntosDePorVida: '50',
    nivel: null,
    inscritaEl: new Date('2026-09-01T10:00:00'),
    estado: 'ACTIVA',
  };

  /** Adversarial: el mismo detalle que la compra simulada, pero sin demo. */
  const MOVIMIENTO_REAL: MovimientoDePuntos = {
    id: 'mv-1',
    direccion: 'CREDITO',
    puntos: '50',
    motivo: 'COMPRA',
    saldoDespues: '50',
    detalle: DETALLE_DE_COMPRA_SIMULADA,
    ocurrioEl: new Date('2026-09-02T10:00:00'),
    venceEl: null,
  };

  function montarCon(providers: Provider[] = []): ComponentFixture<Loyalty> {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), ...providers],
    });
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], pid: 'pp-1' }),
      refreshToken: 'r-1',
    });
    const montada = TestBed.createComponent(Loyalty);
    montada.detectChanges();
    return montada;
  }

  const testId = (montada: ComponentFixture<Loyalty>, id: string): HTMLElement | null =>
    (montada.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  beforeEach(() => {
    entorno.loyaltyDemo = false;
  });

  afterEach(() => {
    entorno.loyaltyDemo = original;
  });

  it('sin datos sembrados dice que no hay programa y no ofrece ninguna demostración', () => {
    const montada = montarCon();

    expect(montada.nativeElement.textContent).toContain(
      'Todavía no hay un programa de Puntos AloVida activo para tu cuenta',
    );
    expect(testId(montada, 'puntos-disponibles')).toBeNull();
    expect(testId(montada, 'puntos-promocion')).toBeNull();
    expect(testId(montada, 'puntos-simular-compra')).toBeNull();
  });

  it('aunque llegue una membresía, sin la demo no hay tarjeta x2, simular compra ni chip', () => {
    const montada = montarCon([
      {
        provide: LoyaltyClient,
        useValue: {
          miMembresia: () => of(MEMBRESIA_REAL),
          misMovimientos: () => of({ movimientos: [MOVIMIENTO_REAL], nextCursor: null }),
        },
      },
    ]);

    expect(testId(montada, 'puntos-disponibles')?.textContent?.trim()).toBe('50');
    expect(testId(montada, 'puntos-promocion')).toBeNull();
    expect(testId(montada, 'puntos-simular-compra')).toBeNull();
    expect(testId(montada, 'movimiento-multiplicador')).toBeNull();
  });
});
