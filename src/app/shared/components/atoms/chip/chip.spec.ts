import { readFileSync } from 'node:fs';

import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Chip } from './chip';
import { CHIP_SIZES, CHIP_VARIANTS } from './chip.types';

const CHIP_CSS = 'src/app/shared/components/atoms/chip/chip.css';
const TONE_CSS = 'src/app/shared/components/tone/tone.css';

describe('Chip', () => {
  let fixture: ComponentFixture<Chip>;
  const removidos: number[] = [];

  /** El selector es de elemento: el host ES el chip. */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function botonCerrar(): HTMLButtonElement | null {
    return host().querySelector('.chip__remove');
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  async function teclear(key: string): Promise<void> {
    host().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    removidos.length = 0;
    await TestBed.configureTestingModule({ imports: [Chip] }).compileComponents();
    fixture = TestBed.createComponent(Chip);
    fixture.componentInstance.removed.subscribe(() => removidos.push(1));
    await fixture.whenStable();
  });

  describe('tonos', () => {
    it('cada variante engancha el mapa compartido con el Badge', async () => {
      for (const variant of CHIP_VARIANTS) {
        await setInputs({ variant });
        expect(host().classList.contains(`tone--${variant}`)).toBe(true);
      }
    });

    it('cada tamaño genera su modificador BEM', async () => {
      for (const size of CHIP_SIZES) {
        await setInputs({ size });
        expect(host().classList.contains(`chip--${size}`)).toBe(true);
      }
    });

    it('por defecto es neutral: una faceta no es un estado clínico', () => {
      expect(host().classList.contains('tone--neutral')).toBe(true);
    });

    /**
     * El ámbar es el punto de acción único del sistema (identidad-visual.md).
     * Como tono de chip volvería a aparecer N veces por pantalla, así que el
     * único ámbar admitido es el que ya trae el trío `--st-warning-*`.
     */
    it('no existe un tono ámbar propio', () => {
      expect(CHIP_VARIANTS).not.toContain('amber');
      expect(CHIP_VARIANTS).not.toContain('accent');
    });

    it('ni el chip ni el mapa de tonos tocan la rampa ámbar ni el color de acción', () => {
      for (const css of [readFileSync(CHIP_CSS, 'utf8'), readFileSync(TONE_CSS, 'utf8')]) {
        const declaraciones = css
          .split('\n')
          .filter((linea) => !linea.trimStart().startsWith('/*') && !linea.trimStart().startsWith('*'));

        expect(declaraciones.join('\n')).not.toContain('--c-amber');
        expect(declaraciones.join('\n')).not.toContain('--brand-accent');
      }
    });
  });

  describe('modo estático', () => {
    it('no es enfocable ni se anuncia como control', () => {
      expect(host().hasAttribute('tabindex')).toBe(false);
      expect(host().hasAttribute('role')).toBe(false);
      expect(host().hasAttribute('aria-pressed')).toBe(false);
    });

    it('no tiene botón de cierre', () => {
      expect(botonCerrar()).toBeNull();
    });
  });

  describe('modo removible', () => {
    beforeEach(async () => {
      await setInputs({ removable: true, label: 'Cardiología' });
    });

    it('el chip entero es alcanzable con teclado', () => {
      expect(host().getAttribute('tabindex')).toBe('0');
    });

    it('el botón de cierre nombra QUÉ quita', () => {
      expect(botonCerrar()?.getAttribute('aria-label')).toBe('Quitar Cardiología');
    });

    it('el botón de cierre emite `removed`', () => {
      botonCerrar()?.click();

      expect(removidos).toHaveLength(1);
    });

    it('Delete emite `removed`', async () => {
      await teclear('Delete');

      expect(removidos).toHaveLength(1);
    });

    it('Backspace emite `removed`', async () => {
      await teclear('Backspace');

      expect(removidos).toHaveLength(1);
    });

    it('otras teclas no quitan nada', async () => {
      await teclear('a');
      await teclear('Enter');

      expect(removidos).toHaveLength(0);
    });
  });

  describe('modo seleccionable', () => {
    beforeEach(async () => {
      await setInputs({ selectable: true, label: 'Solo urgencias' });
    });

    it('se anuncia como botón de dos estados', () => {
      expect(host().getAttribute('role')).toBe('button');
      expect(host().getAttribute('aria-pressed')).toBe('false');
      expect(host().getAttribute('tabindex')).toBe('0');
    });

    it('Enter alterna la selección', async () => {
      await teclear('Enter');

      expect(fixture.componentInstance.selected()).toBe(true);
      expect(host().getAttribute('aria-pressed')).toBe('true');

      await teclear('Enter');
      expect(fixture.componentInstance.selected()).toBe(false);
    });

    it('Espacio alterna y no desplaza la página', async () => {
      const evento = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      host().dispatchEvent(evento);
      await fixture.whenStable();

      expect(fixture.componentInstance.selected()).toBe(true);
      expect(evento.defaultPrevented).toBe(true);
    });

    it('el click alterna igual que el teclado', async () => {
      host().click();
      await fixture.whenStable();

      expect(fixture.componentInstance.selected()).toBe(true);
    });

    it('seleccionado no se dice solo con color: lleva su modificador', async () => {
      await teclear('Enter');

      expect(host().classList.contains('chip--selected')).toBe(true);
    });
  });

  describe('exclusión de modos', () => {
    it('con ambos gana removable y no queda como botón de dos estados', async () => {
      await setInputs({ removable: true, selectable: true, label: 'Cardiología' });

      expect(botonCerrar()).not.toBeNull();
      expect(host().hasAttribute('aria-pressed')).toBe(false);
      expect(host().classList.contains('chip--selectable')).toBe(false);
    });

    it('con ambos, Enter no selecciona: manda el modo removible', async () => {
      await setInputs({ removable: true, selectable: true });
      await teclear('Enter');

      expect(fixture.componentInstance.selected()).toBe(false);
    });

    it('avisa en desarrollo', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const ambiguo = TestBed.createComponent(Chip);
      ambiguo.componentRef.setInput('removable', true);
      ambiguo.componentRef.setInput('selectable', true);
      await ambiguo.whenStable();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('son excluyentes'));
      warn.mockRestore();
    });
  });
});
