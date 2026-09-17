import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { ComprobanteDeCanje } from '../../../../core/data-access/loyalty/loyalty.types';
import { RedeemCode } from './redeem-code';

/**
 * El comprobante de canje (FAR-I6). Lo que se fija: que el chip DEMO **no
 * tenga prop que lo quite** —quien escanea el código todavía no existe y la
 * pantalla no puede dejar de decirlo—, que el código se vea en letras aunque
 * el QR falle, y que ningún identificador interno llegue a la pantalla.
 */

const GENERADO_EL = new Date('2026-08-22T14:30:00');
const VENCE_EL = new Date('2026-08-22T14:45:00');

const comprobante = (extra: Partial<ComprobanteDeCanje> = {}): ComprobanteDeCanje => ({
  canje: {
    id: 'a1b2c3d4-0000-4000-8000-00000000feed',
    puntos: '150',
    saldoDespues: '290',
    puntosDePorVida: '720',
    duplicado: false,
  },
  codigo: 'HJ4KMP73',
  generadoEl: GENERADO_EL,
  venceEl: VENCE_EL,
  ...extra,
});

describe('RedeemCode', () => {
  let fixture: ComponentFixture<RedeemCode>;

  const montar = (dato = comprobante()): void => {
    fixture = TestBed.createComponent(RedeemCode);
    fixture.componentRef.setInput('comprobante', dato);
    fixture.detectChanges();
  };

  const texto = (): string => fixture.nativeElement.textContent ?? '';
  const porTestId = (id: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RedeemCode] });
  });

  it('anuncia que es una demostración', () => {
    montar();

    expect(porTestId('canje-chip-demo')?.textContent).toContain('DEMO');
  });

  it('no expone ningún input para apagar el chip DEMO', () => {
    montar();

    // El único input del componente es el comprobante: no hay forma de pedirle
    // que oculte la marca, ni siquiera por error.
    const inputs = Object.keys(
      (RedeemCode as unknown as { ɵcmp: { inputs: Record<string, unknown> } }).ɵcmp.inputs,
    );
    expect(inputs).toEqual(['comprobante']);
  });

  it('muestra el código en letras, que es lo que se dicta si el escáner falla', () => {
    montar();

    expect(porTestId('canje-codigo')?.textContent?.trim()).toBe('HJ4KMP73');
  });

  it('dice cuánto canjeaste y cuánto te queda', () => {
    montar();

    expect(porTestId('canje-puntos')?.textContent).toContain('150');
    expect(porTestId('canje-saldo')?.textContent).toContain('290');
  });

  it('dice a qué hora vence', () => {
    montar();

    expect(porTestId('canje-vence')?.textContent).toContain('14:45');
  });

  it('dice que el código se muestra en la caja del supermercado, con el vencimiento a la vista', () => {
    montar();

    expect(porTestId('canje-caja')?.textContent?.trim()).toBe(
      'Mostrá este código en la caja del supermercado',
    );
    expect(porTestId('canje-vence')?.textContent).toContain('14:45');
  });

  it('se titula «Código de canje» y no manda a ningún mostrador (D-T-E6-02)', () => {
    montar();

    expect(fixture.nativeElement.querySelector('#canje-titulo')?.textContent?.trim()).toBe(
      'Código de canje',
    );
    expect(texto().toLowerCase()).not.toContain('mostrador');
  });

  it('no pinta ningún identificador interno', () => {
    montar();

    expect(texto()).not.toContain('a1b2c3d4');
    expect(texto()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i);
  });

  it('avisa cuando lo cierran', () => {
    montar();
    let cerrado = false;
    fixture.componentInstance.cerrado.subscribe(() => (cerrado = true));

    porTestId('canje-cerrar')?.click();

    expect(cerrado).toBe(true);
  });
});
