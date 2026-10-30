import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { readFileSync } from 'node:fs';

import { BrandMark } from './brand-mark';

/**
 * La identidad de la marca: glifo + «AloVida» con «Alo» y «Vida» en dos tonos.
 * Lo que se prueba es la estructura que la sostiene y que los colores salgan de
 * tokens —un valor suelto rompería el tema oscuro sin avisar—.
 */
describe('BrandMark', () => {
  let fixture: ComponentFixture<BrandMark>;

  function render(inputs: Record<string, unknown> = {}): HTMLElement {
    fixture = TestBed.createComponent(BrandMark);
    for (const [clave, valor] of Object.entries(inputs)) {
      fixture.componentRef.setInput(clave, valor);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BrandMark] }).compileComponents();
  });

  it('dice «AloVida» de corrido: dos tramos contiguos, sin espacio', () => {
    const root = render();

    expect(root.querySelector('.brand-mark__alo')?.textContent).toBe('Alo');
    expect(root.querySelector('.brand-mark__vida')?.textContent).toBe('Vida');
    expect(root.querySelector('.brand-mark__word')?.textContent?.trim()).toBe('AloVida');
  });

  it('el glifo es decorativo: el nombre ya lo dice el texto', () => {
    expect(render().querySelector('.brand-mark__glyph')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('por omisión es chico y no late; grande y con latido sólo si se pide', () => {
    expect(render().querySelector('.brand-mark')?.className).toBe('brand-mark');

    const grande = render({ size: 'lg', beat: true }).querySelector('.brand-mark')!;
    expect(grande.classList).toContain('brand-mark--lg');
    expect(grande.classList).toContain('brand-mark--beat');
  });

  describe('colores', () => {
    const css = readFileSync('src/app/shared/components/atoms/brand-mark/brand-mark.css', 'utf8');
    const regla = (selector: string): string =>
      new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

    it('«Alo» y «Vida» tienen colores distintos', () => {
      expect(regla('.brand-mark__alo')).not.toBe('');
      expect(regla('.brand-mark__vida')).not.toBe('');
      expect(regla('.brand-mark__alo')).not.toBe(regla('.brand-mark__vida'));
    });

    it('salen sólo de tokens: nada de hex sueltos, que no se invertirían en oscuro', () => {
      expect(regla('.brand-mark__alo')).toContain('var(--brand-primary)');
      expect(regla('.brand-mark__vida')).toContain('var(--brand-secondary)');
      expect(css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    });

    it('no usa el celeste del arte original, que no es de la paleta', () => {
      expect(css.toLowerCase()).not.toContain('00a3ff');
    });

    it('el rótulo se mantiene como texto grande: 3,88:1 sólo pasa AA grande', () => {
      const tamano = /font-size:\s*([\d.]+)rem/.exec(regla('.brand-mark__word'));

      expect(Number(tamano?.[1])).toBeGreaterThanOrEqual(1.2);
      expect(regla('.brand-mark__word')).toContain('font-weight: 700');
    });
  });
});
