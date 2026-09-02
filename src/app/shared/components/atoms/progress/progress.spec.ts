import { readFileSync } from 'node:fs';

import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Progress } from './progress';
import { PROGRESS_SIZES, PROGRESS_TONES } from './progress.types';

const PROGRESS_CSS = 'src/app/shared/components/atoms/progress/progress.css';

describe('Progress', () => {
  let fixture: ComponentFixture<Progress>;

  /** El selector es de elemento: el host ES la barra. */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function relleno(): HTMLElement {
    const element = host().querySelector<HTMLElement>('.progress__fill');
    if (element === null) {
      throw new Error('el relleno no está en el DOM');
    }
    return element;
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Progress] }).compileComponents();
    fixture = TestBed.createComponent(Progress);
    fixture.componentRef.setInput('label', 'Subida del informe');
    await fixture.whenStable();
  });

  describe('semántica', () => {
    it('se anuncia como barra de progreso con su nombre y su rango', () => {
      expect(host().getAttribute('role')).toBe('progressbar');
      expect(host().getAttribute('aria-label')).toBe('Subida del informe');
      expect(host().getAttribute('aria-valuemin')).toBe('0');
      expect(host().getAttribute('aria-valuemax')).toBe('100');
    });

    it('avisa en desarrollo si no tiene nombre accesible', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const anonima = TestBed.createComponent(Progress);
      await anonima.whenStable();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('sin `label`'));
      warn.mockRestore();
    });
  });

  describe('modo indeterminado', () => {
    it('sin value no declara aria-valuenow: no hay valor que decir', () => {
      expect(host().hasAttribute('aria-valuenow')).toBe(false);
      expect(fixture.componentInstance.isIndeterminate()).toBe(true);
      expect(host().classList.contains('progress--indeterminate')).toBe(true);
    });

    it('el ancho del relleno lo pone el CSS, no el valor', () => {
      expect(relleno().style.width).toBe('');
    });
  });

  describe('modo determinado', () => {
    it('publica el avance en aria-valuenow y en el ancho', async () => {
      await setInputs({ value: 42 });

      expect(host().getAttribute('aria-valuenow')).toBe('42');
      expect(relleno().style.width).toBe('42%');
      expect(host().classList.contains('progress--indeterminate')).toBe(false);
    });

    it('el 0 es un valor, no la ausencia de valor', async () => {
      await setInputs({ value: 0 });

      expect(host().getAttribute('aria-valuenow')).toBe('0');
      expect(fixture.componentInstance.isIndeterminate()).toBe(false);
    });

    it('recorta lo que se salga del rango: no se confía en el consumidor', async () => {
      await setInputs({ value: 180 });
      expect(host().getAttribute('aria-valuenow')).toBe('100');
      expect(relleno().style.width).toBe('100%');

      await setInputs({ value: -20 });
      expect(host().getAttribute('aria-valuenow')).toBe('0');
      expect(relleno().style.width).toBe('0%');
    });

    it('un NaN se trata como sin valor, no como cero', async () => {
      await setInputs({ value: Number.NaN });

      expect(host().hasAttribute('aria-valuenow')).toBe(false);
      expect(fixture.componentInstance.isIndeterminate()).toBe(false);
    });
  });

  describe('tonos y tamaños', () => {
    it('cada tono y tamaño genera su modificador BEM', async () => {
      for (const tone of PROGRESS_TONES) {
        for (const size of PROGRESS_SIZES) {
          await setInputs({ tone, size });

          expect(host().classList.contains(`progress--${tone}`)).toBe(true);
          expect(host().classList.contains(`progress--${size}`)).toBe(true);
        }
      }
    });

    /** El ámbar es el punto de acción único de la pantalla: acá no entra. */
    it('no existe un tono ámbar', () => {
      expect(PROGRESS_TONES).not.toContain('warning');
      expect(PROGRESS_TONES).not.toContain('amber');

      const css = readFileSync(PROGRESS_CSS, 'utf8');
      const declaraciones = css
        .split('\n')
        .filter((linea) => !linea.trimStart().startsWith('/*') && !linea.trimStart().startsWith('*'));

      expect(declaraciones.join('\n')).not.toContain('--c-amber');
      expect(declaraciones.join('\n')).not.toContain('--brand-accent');
    });
  });

  describe('la punta', () => {
    function punta(): HTMLElement | null {
      return host().querySelector<HTMLElement>('.progress__marker');
    }

    it('no se dibuja por defecto: el átomo también sirve a las subidas de archivo', async () => {
      await setInputs({ value: 40 });

      expect(punta()).toBeNull();
      expect(host().classList.contains('progress--with-marker')).toBe(false);
    });

    it('con showMarker aparece en la posición del avance, y se mueve con él', async () => {
      await setInputs({ value: 25, showMarker: true });

      expect(punta()).not.toBeNull();
      expect(punta()!.style.left).toBe('25%');

      await setInputs({ value: 75 });
      expect(punta()!.style.left).toBe('75%');
    });

    it('el riel deja de recortar cuando hay punta: si cupiera dentro no sería punta', async () => {
      await setInputs({ value: 40, showMarker: true });

      expect(host().classList.contains('progress--with-marker')).toBe(true);
    });

    it('en indeterminada no hay punta: señalaría un lugar inventado', async () => {
      await setInputs({ value: null, showMarker: true });

      expect(punta()).toBeNull();
      expect(host().classList.contains('progress--with-marker')).toBe(false);
    });

    it('no aporta nada al lector de pantalla: el avance ya viaja en los aria-value*', async () => {
      await setInputs({ value: 60, showMarker: true });

      expect(punta()!.getAttribute('aria-hidden')).toBe('true');
      // Encenderla no cambia una palabra de lo que se anuncia.
      expect(host().getAttribute('aria-valuenow')).toBe('60');
      expect(host().getAttribute('role')).toBe('progressbar');
    });

    /** El ámbar es el punto de acción único: tampoco entra por la punta. */
    it('el brillo sale de la propia tinta, no de un color nuevo', () => {
      const css = readFileSync(PROGRESS_CSS, 'utf8');
      const marcador = css.slice(css.indexOf('.progress__marker'));

      expect(marcador).toContain('var(--_progress-fill)');
      expect(marcador).not.toContain('--c-amber');
      expect(marcador).not.toContain('--brand-accent');
      // Ningún color escrito a mano: todo sale de un token.
      expect(marcador).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(marcador).not.toMatch(/rgba?\(/);
    });
  });

  describe('prefers-reduced-motion', () => {
    it('la animación indeterminada se ralentiza: una barra quieta se lee colgada', () => {
      const css = readFileSync(PROGRESS_CSS, 'utf8');
      const bloque = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

      expect(bloque).toContain('animation-duration: 3s !important');
      expect(bloque).toContain('animation-iteration-count: infinite !important');
    });

    it('la punta queda QUIETA: el pulso no informa nada que el ancho no diga ya', () => {
      const css = readFileSync(PROGRESS_CSS, 'utf8');
      const reduce = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));

      expect(reduce).toContain('.progress__marker');
      expect(reduce).toContain('animation: none !important');
    });

    it('el pulso sólo existe con movimiento permitido, no al revés', () => {
      const css = readFileSync(PROGRESS_CSS, 'utf8');
      const permitido = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));

      // La animación se DECLARA dentro de `no-preference`: así no existe
      // siquiera para quien pidió no verla, en vez de declararse y apagarse.
      expect(permitido).toContain('progress-marker-pulse');
    });
  });
});
