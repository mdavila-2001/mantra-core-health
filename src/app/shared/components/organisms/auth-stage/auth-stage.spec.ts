import { readFileSync } from 'node:fs';

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

  describe('hoja de estilos', () => {
    const css = (): string =>
      readFileSync('src/app/shared/components/organisms/auth-stage/auth-stage.css', 'utf8');

    it('todo grosor de la tira lleva el factor `--ecg-k`: en teléfono se pinta a ~0,31× y sin él la onda se pierde', () => {
      const grosores = css().match(/stroke-width:[^;]+;/g) ?? [];

      expect(grosores.length).toBeGreaterThanOrEqual(6);
      for (const grosor of grosores) {
        expect(grosor, grosor).toContain('var(--ecg-k)');
      }
    });

    it('el factor vale 1 en escritorio, donde la tira cubre el escenario a ~0,83×', () => {
      expect(css()).toMatch(/--ecg-k:\s*2\.4;/);
      expect(css()).toMatch(/aspect-ratio:\s*auto;\s*--ecg-k:\s*1;/);
    });

    it('el trazo base respira con el ciclo del monitor y «reducir movimiento» lo apaga', () => {
      expect(css()).toMatch(/auth-stage-ecg-breathe var\(--beat\)/);
      const reducido = css().slice(css().indexOf('prefers-reduced-motion'));
      expect(reducido).toContain('.auth-stage__ecg-base');
      expect(reducido).toMatch(/animation:\s*none\s*!important/);
    });
  });
});
