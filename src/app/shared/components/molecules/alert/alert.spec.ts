import { readFileSync } from 'node:fs';

import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Alert } from './alert';
import { ALERT_TONES, ALERT_TONE_NOUNS } from './alert.types';

const ALERT_CSS = 'src/app/shared/components/molecules/alert/alert.css';

describe('Alert', () => {
  let fixture: ComponentFixture<Alert>;
  const cierres: number[] = [];

  /** El selector es de elemento: el host ES el aviso. */
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
    cierres.length = 0;
    await TestBed.configureTestingModule({ imports: [Alert] }).compileComponents();
    fixture = TestBed.createComponent(Alert);
    fixture.componentInstance.dismissed.subscribe(() => cierres.push(1));
    await fixture.whenStable();
  });

  describe('anuncio por tono', () => {
    it('el error interrumpe: role=alert + aria-live=assertive', async () => {
      await setInputs({ tone: 'error' });

      expect(host().getAttribute('role')).toBe('alert');
      expect(host().getAttribute('aria-live')).toBe('assertive');
    });

    it('los demás esperan su turno: role=status + aria-live=polite', async () => {
      for (const tone of ALERT_TONES.filter((candidato) => candidato !== 'error')) {
        await setInputs({ tone });

        expect(host().getAttribute('role')).toBe('status');
        expect(host().getAttribute('aria-live')).toBe('polite');
      }
    });

    it('cada tono se dice en palabras, no solo con color', async () => {
      for (const tone of ALERT_TONES) {
        await setInputs({ tone });

        const dicho = host().querySelector('.sr-only')?.textContent?.trim();
        expect(dicho).toBe(`${ALERT_TONE_NOUNS[tone]}:`);
      }
    });

    it('engancha el mapa de tonos compartido con Badge y Chip', async () => {
      for (const tone of ALERT_TONES) {
        await setInputs({ tone });
        expect(host().classList.contains(`tone--${tone}`)).toBe(true);
      }
    });
  });

  describe('contenido', () => {
    it('sin título no lo renderiza', () => {
      expect(host().querySelector('.alert__title')).toBeNull();
    });

    it('con título lo muestra', async () => {
      await setInputs({ title: 'No se pudo guardar la evolución' });

      expect(host().querySelector('.alert__title')?.textContent?.trim()).toBe(
        'No se pudo guardar la evolución',
      );
    });

    it('el ícono viene por defecto y nunca se anuncia', () => {
      const icono = host().querySelector('.alert__icon');

      expect(icono).not.toBeNull();
      expect(icono?.getAttribute('aria-hidden')).toBe('true');
    });

    it('se puede apagar el ícono', async () => {
      await setInputs({ icon: false });

      expect(host().querySelector('.alert__icon')).toBeNull();
    });
  });

  describe('cierre', () => {
    it('sin `dismissible` no hay botón de cierre', () => {
      expect(host().querySelector('.alert__dismiss')).toBeNull();
    });

    it('el botón de cierre tiene nombre accesible', async () => {
      await setInputs({ dismissible: true });

      expect(host().querySelector('.alert__dismiss')?.getAttribute('aria-label')).toBe(
        'Cerrar aviso',
      );
    });

    it('emite `dismissed` y NO se auto-oculta: el estado lo lleva el consumidor', async () => {
      await setInputs({ dismissible: true, title: 'Sin conexión' });

      host().querySelector<HTMLButtonElement>('.alert__dismiss')?.click();
      await fixture.whenStable();

      expect(cierres).toHaveLength(1);
      // sigue en el DOM: nadie lo sacó
      expect(host().querySelector('.alert__title')?.textContent?.trim()).toBe('Sin conexión');
      expect(host().querySelector('.alert__dismiss')).not.toBeNull();
    });
  });

  describe('paleta', () => {
    /** El ámbar es el punto de acción único: solo entra por el trío `--st-warning-*`. */
    it('no toca la rampa ámbar ni el color de acción', () => {
      const css = readFileSync(ALERT_CSS, 'utf8');
      const declaraciones = css
        .split('\n')
        .filter((linea) => !linea.trimStart().startsWith('/*') && !linea.trimStart().startsWith('*'));

      expect(declaraciones.join('\n')).not.toContain('--c-amber');
      expect(declaraciones.join('\n')).not.toContain('--brand-accent');
    });

    it('no declara tonos de marca: un aviso siempre comunica un estado', () => {
      expect(ALERT_TONES).not.toContain('primary');
      expect(ALERT_TONES).not.toContain('secondary');
    });
  });
});
