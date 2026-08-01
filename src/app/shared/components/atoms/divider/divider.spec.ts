import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Divider } from './divider';
import { DIVIDER_ORIENTATIONS } from './divider.types';

describe('Divider', () => {
  let fixture: ComponentFixture<Divider>;

  /** El selector es de elemento: el host ES el separador. */
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
    await TestBed.configureTestingModule({ imports: [Divider] }).compileComponents();
    fixture = TestBed.createComponent(Divider);
    await fixture.whenStable();
  });

  describe('semántica', () => {
    it('se anuncia como separador horizontal por defecto', () => {
      expect(host().getAttribute('role')).toBe('separator');
      expect(host().getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('cada orientación declara la suya y su modificador BEM', async () => {
      for (const orientation of DIVIDER_ORIENTATIONS) {
        await setInputs({ orientation });

        expect(host().getAttribute('aria-orientation')).toBe(orientation);
        expect(host().classList.contains(`divider--${orientation}`)).toBe(true);
      }
    });

    it('sin rótulo no agrega ningún nodo: la línea es el borde del host', () => {
      expect(host().querySelector('.divider__label')).toBeNull();
      expect(host().hasAttribute('aria-label')).toBe(false);
    });
  });

  describe('rótulo', () => {
    it('en horizontal se ve y además nombra al separador', async () => {
      await setInputs({ label: 'Antecedentes' });

      expect(host().querySelector('.divider__label')?.textContent?.trim()).toBe('Antecedentes');
      expect(host().getAttribute('aria-label')).toBe('Antecedentes');
      expect(host().classList.contains('divider--labelled')).toBe(true);
    });

    it('las dos líneas que lo flanquean son decoración', async () => {
      await setInputs({ label: 'Antecedentes' });

      const lineas = host().querySelectorAll('.divider__line');
      expect(lineas).toHaveLength(2);
      for (const linea of lineas) {
        expect(linea.getAttribute('aria-hidden')).toBe('true');
      }
    });

    it('en vertical se ignora: no hay dónde escribirlo', async () => {
      await setInputs({ orientation: 'vertical', label: 'Antecedentes' });

      expect(host().querySelector('.divider__label')).toBeNull();
      expect(host().hasAttribute('aria-label')).toBe(false);
      expect(host().classList.contains('divider--labelled')).toBe(false);
    });

    it('avisa en desarrollo cuando el rótulo se ignora', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const vertical = TestBed.createComponent(Divider);
      vertical.componentRef.setInput('orientation', 'vertical');
      vertical.componentRef.setInput('label', 'Antecedentes');
      await vertical.whenStable();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('se ignora en orientación vertical'));
      warn.mockRestore();
    });

    it('un rótulo en blanco no cuenta como rótulo', async () => {
      await setInputs({ label: '   ' });

      expect(host().querySelector('.divider__label')).toBeNull();
      expect(host().classList.contains('divider--labelled')).toBe(false);
    });
  });
});
