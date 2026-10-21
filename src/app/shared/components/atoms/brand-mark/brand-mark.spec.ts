import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { BrandMark } from './brand-mark';
import { BRAND_MARK_SIZES, BRAND_MARK_VARIANTS } from './brand-mark.types';

describe('BrandMark', () => {
  let fixture: ComponentFixture<BrandMark>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [BrandMark] }).compileComponents();
    fixture = TestBed.createComponent(BrandMark);
    await fixture.whenStable();
  });

  describe('isotipo suelto', () => {
    it('se anuncia como imagen llamada «AloVida»', () => {
      expect(host().getAttribute('role')).toBe('img');
      expect(host().getAttribute('aria-label')).toBe('AloVida');
    });

    it('el dibujo no se anuncia por segunda vez', () => {
      expect(host().querySelector('.brand-mark__glifo')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('decorativo no lleva rol ni nombre (el enlace que lo contiene ya se nombra)', async () => {
      await setInputs({ decorative: true });

      expect(host().getAttribute('role')).toBeNull();
      expect(host().getAttribute('aria-label')).toBeNull();
    });
  });

  describe('completa', () => {
    it('agrega la palabra y no necesita rol: el texto es el nombre', async () => {
      await setInputs({ variant: 'completa' });

      expect(host().textContent).toContain('AloVida');
      expect(host().getAttribute('role')).toBeNull();
    });

    it('decorativa oculta también la palabra para que no se lea dos veces', async () => {
      await setInputs({ variant: 'completa', decorative: true });

      expect(host().querySelector('.brand-mark__palabra')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('clases', () => {
    it('cada variante y cada tamaño declara su modificador', async () => {
      for (const variant of BRAND_MARK_VARIANTS) {
        for (const size of BRAND_MARK_SIZES) {
          await setInputs({ variant, size });

          expect(host().classList.contains(`brand-mark--${variant}`)).toBe(true);
          expect(host().classList.contains(`brand-mark--${size}`)).toBe(true);
        }
      }
    });
  });
});
