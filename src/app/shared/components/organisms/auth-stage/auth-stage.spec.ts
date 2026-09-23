import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthStage } from './auth-stage';

describe('AuthStage', () => {
  let fixture: ComponentFixture<AuthStage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AuthStage] }).compileComponents();
    fixture = TestBed.createComponent(AuthStage);
    await fixture.whenStable();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('es decorativo: no lo anuncia un lector de pantalla', () => {
    expect(el().getAttribute('aria-hidden')).toBe('true');
  });

  it('el latido dibuja cinco capas sobre UNA misma curva (base, aura, halo, cometa y chispa)', () => {
    const capas = Array.from(el().querySelectorAll('.auth-stage__ecg path'));
    expect(capas.map((c) => c.getAttribute('class'))).toEqual([
      'auth-stage__ecg-base',
      'auth-stage__ecg-aura',
      'auth-stage__ecg-halo',
      'auth-stage__ecg-comet',
      'auth-stage__ecg-spark',
    ]);
    // Si una capa tuviera otra curva, las cabezas del cometa se separarían.
    expect(new Set(capas.map((c) => c.getAttribute('d'))).size).toBe(1);
    expect(capas.every((c) => c.getAttribute('pathLength') === '1000')).toBe(true);
  });

  it('las ondas salen del pico R protagonista, que es de donde el CSS calcula la sincronía', () => {
    const ondas = Array.from(
      el().querySelectorAll('.auth-stage__wave:not(.auth-stage__wave--far)'),
    );
    expect(ondas).toHaveLength(2);
    for (const onda of ondas) {
      expect([onda.getAttribute('cx'), onda.getAttribute('cy')]).toEqual(['649', '150']);
    }
  });

  it('las motas son deterministas: servidor y navegador pintan la misma escena', () => {
    const motas = Array.from(el().querySelectorAll<HTMLElement>('.auth-stage__mote'));
    expect(motas).toHaveLength(22);
    const columnas = motas.map((m) => m.style.getPropertyValue('--x'));
    expect(columnas[0]).toBe('13%');
    expect(columnas.every((x) => parseFloat(x) >= 0 && parseFloat(x) < 100)).toBe(true);
  });
});
