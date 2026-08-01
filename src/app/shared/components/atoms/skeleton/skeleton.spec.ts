import { readFileSync } from 'node:fs';

import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Skeleton } from './skeleton';
import { SKELETON_LAST_LINE_WIDTH, SKELETON_VARIANTS } from './skeleton.types';

const SKELETON_CSS = 'src/app/shared/components/atoms/skeleton/skeleton.css';

describe('Skeleton', () => {
  let fixture: ComponentFixture<Skeleton>;

  /** El selector es de elemento: el host ES la silueta. */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function lineas(): HTMLElement[] {
    return [...host().querySelectorAll<HTMLElement>('.skeleton__line')];
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Skeleton] }).compileComponents();
    fixture = TestBed.createComponent(Skeleton);
    await fixture.whenStable();
  });

  describe('accesibilidad', () => {
    it('nunca se anuncia: cinco cajas vacías no informan nada', () => {
      expect(host().getAttribute('aria-hidden')).toBe('true');
    });

    it('sigue oculto en todas las variantes', async () => {
      for (const variant of SKELETON_VARIANTS) {
        await setInputs({ variant });
        expect(host().getAttribute('aria-hidden')).toBe('true');
      }
    });
  });

  describe('variantes', () => {
    it('cada variante genera su modificador BEM', async () => {
      for (const variant of SKELETON_VARIANTS) {
        await setInputs({ variant });
        expect([...host().classList].sort()).toEqual(['skeleton', `skeleton--${variant}`]);
      }
    });

    it('las medidas crudas van al host tal cual', async () => {
      await setInputs({ variant: 'rect', width: '240px', height: '180px' });

      expect(host().style.width).toBe('240px');
      expect(host().style.height).toBe('180px');
    });

    it('circle y rect no proyectan líneas', async () => {
      for (const variant of ['circle', 'rect']) {
        await setInputs({ variant, lines: 4 });
        expect(lineas()).toHaveLength(0);
      }
    });
  });

  describe('líneas de texto', () => {
    it('una sola línea va al ancho completo: no hay párrafo que simular', () => {
      expect(lineas()).toHaveLength(1);
      expect(lineas()[0].style.width).toBe('100%');
    });

    it('varias líneas terminan con la última más corta', async () => {
      await setInputs({ lines: 3 });

      const anchos = lineas().map((linea) => linea.style.width);
      expect(anchos).toEqual(['100%', '100%', SKELETON_LAST_LINE_WIDTH]);
    });

    it('un conteo absurdo no rompe el layout', async () => {
      await setInputs({ lines: 0 });
      expect(lineas()).toHaveLength(1);

      await setInputs({ lines: -3 });
      expect(lineas()).toHaveLength(1);
    });
  });

  /**
   * jsdom no evalúa media queries de una hoja: la regla se verifica sobre el
   * archivo, igual que en el Spinner.
   */
  describe('prefers-reduced-motion', () => {
    it('el brillo se vuelve estático — no lento, como sí hace el spinner', () => {
      const css = readFileSync(SKELETON_CSS, 'utf8');
      const bloque = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

      expect(bloque).toContain('animation: none !important');
      expect(bloque).toContain('background-image: none');
    });
  });
});
