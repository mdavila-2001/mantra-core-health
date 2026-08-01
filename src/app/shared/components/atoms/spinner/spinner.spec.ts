import { readFileSync } from 'node:fs';

import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Spinner } from './spinner';
import { SPINNER_SIZES } from './spinner.types';

const SPINNER_CSS = 'src/app/shared/components/atoms/spinner/spinner.css';

describe('Spinner', () => {
  let fixture: ComponentFixture<Spinner>;

  /** El selector es de elemento: el host ES el spinner. */
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
    await TestBed.configureTestingModule({ imports: [Spinner] }).compileComponents();
    fixture = TestBed.createComponent(Spinner);
    await fixture.whenStable();
  });

  describe('anuncio', () => {
    it('es una región viva con nombre accesible por defecto', () => {
      expect(host().getAttribute('role')).toBe('status');
      expect(host().getAttribute('aria-label')).toBe('Cargando');
      expect(host().hasAttribute('aria-hidden')).toBe(false);
    });

    it('acepta un nombre propio del contexto clínico', async () => {
      await setInputs({ label: 'Cargando historia clínica' });
      expect(host().getAttribute('aria-label')).toBe('Cargando historia clínica');
    });

    it('decorative lo saca del árbol accesible: sin rol ni nombre', async () => {
      await setInputs({ decorative: true });

      expect(host().getAttribute('aria-hidden')).toBe('true');
      expect(host().hasAttribute('role')).toBe(false);
      expect(host().hasAttribute('aria-label')).toBe(false);
    });

    it('el dibujo nunca se anuncia por su cuenta', () => {
      expect(host().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('tamaños', () => {
    it('cada tamaño genera su modificador BEM', async () => {
      for (const size of SPINNER_SIZES) {
        await setInputs({ size });
        expect([...host().classList].sort()).toEqual(['spinner', `spinner--${size}`]);
      }
    });
  });

  describe('tinta', () => {
    it('ambos arcos pintan con currentColor: la hereda del contenedor', () => {
      const arcos = [...host().querySelectorAll('circle')];

      expect(arcos).toHaveLength(2);
      for (const arco of arcos) {
        expect(arco.getAttribute('stroke')).toBe('currentColor');
      }
    });
  });

  /**
   * jsdom no evalúa media queries de una hoja de estilos, así que la regla se
   * verifica sobre el archivo: es la única forma honesta de aseverarla.
   */
  describe('prefers-reduced-motion', () => {
    const css = readFileSync(SPINNER_CSS, 'utf8');

    it('ralentiza el giro en vez de congelarlo (una UI colgada no es accesible)', () => {
      const bloque = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));

      expect(bloque).toContain('animation-duration: 1.8s !important');
      expect(bloque).toContain('animation-iteration-count: infinite !important');
    });

    it('el giro base sigue existiendo fuera de la media query', () => {
      expect(css).toContain('animation: spinner-turn 0.7s linear infinite');
    });
  });
});
