import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Badge } from './badge';
import { BADGE_SIZES, BADGE_VARIANTS } from './badge.types';

describe('Badge', () => {
  let fixture: ComponentFixture<Badge>;

  /** El selector es de elemento: el host ES el badge. */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return (host().textContent ?? '').trim();
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Badge] }).compileComponents();
    fixture = TestBed.createComponent(Badge);
    await fixture.whenStable();
  });

  describe('render por defecto', () => {
    it('es primary md y no muestra nada sin value', () => {
      expect([...host().classList].sort()).toEqual(['badge', 'badge--md', 'badge--primary']);
      expect(text()).toBe('');
    });

    it('expone role=status para que un conteo que cambia se anuncie', () => {
      expect(host().getAttribute('role')).toBe('status');
    });

    it('sin label no fija aria-label: el nombre sale del contenido visible', () => {
      expect(host().hasAttribute('aria-label')).toBe(false);
    });
  });

  describe('variantes y tamaños', () => {
    it('cada combinación genera sus modificadores BEM', async () => {
      for (const variant of BADGE_VARIANTS) {
        for (const size of BADGE_SIZES) {
          await setInputs({ variant, size });
          expect(host().classList.contains(`badge--${variant}`)).toBe(true);
          expect(host().classList.contains(`badge--${size}`)).toBe(true);
        }
      }
    });
  });

  describe('displayValue', () => {
    it('muestra un número por debajo del techo tal cual', async () => {
      await setInputs({ value: 5 });
      expect(fixture.componentInstance.displayValue()).toBe('5');
      expect(text()).toBe('5');
    });

    it('trunca con el techo por defecto: 100 con max 99 → «99+»', async () => {
      await setInputs({ value: 100 });
      expect(fixture.componentInstance.displayValue()).toBe('99+');
      expect(fixture.componentInstance.isTruncated()).toBe(true);
    });

    it('el valor igual al techo NO se trunca', async () => {
      await setInputs({ value: 99 });
      expect(fixture.componentInstance.displayValue()).toBe('99');
      expect(fixture.componentInstance.isTruncated()).toBe(false);
    });

    it('respeta un techo propio', async () => {
      await setInputs({ value: 12, max: 9 });
      expect(fixture.componentInstance.displayValue()).toBe('9+');
    });

    it('una cadena se muestra sin tocar, aunque parezca larga', async () => {
      await setInputs({ value: 'Vigente' });
      expect(fixture.componentInstance.displayValue()).toBe('Vigente');
      expect(text()).toBe('Vigente');
    });

    it('el cero se muestra: no es lo mismo que «sin valor»', async () => {
      await setInputs({ value: 0 });
      expect(fixture.componentInstance.displayValue()).toBe('0');
    });
  });

  describe('dotOnly', () => {
    it('vacía el contenido y agrega su modificador', async () => {
      await setInputs({ dotOnly: true, value: 42, label: 'alertas' });
      expect(fixture.componentInstance.displayValue()).toBe('');
      expect(text()).toBe('');
      expect(host().classList.contains('badge--dot')).toBe(true);
    });

    it('gana sobre el contenido proyectado', async () => {
      await setInputs({ dotOnly: true, label: 'Requiere revisión' });
      expect(text()).toBe('');
    });

    it('avisa en desarrollo si no tiene label', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const mudo = TestBed.createComponent(Badge);
      mudo.componentRef.setInput('dotOnly', true);
      await mudo.whenStable();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('dotOnly sin `label`'));
      warn.mockRestore();
    });
  });

  describe('nombre accesible', () => {
    it('arma una frase explícita con el conteo', async () => {
      await setInputs({ value: 3, label: 'notificaciones no leídas' });
      expect(host().getAttribute('aria-label')).toBe('3 notificaciones no leídas');
    });

    it('lee el truncado en palabras, no como «99+»', async () => {
      await setInputs({ value: 250, label: 'notificaciones no leídas' });
      expect(host().getAttribute('aria-label')).toBe('más de 99 notificaciones no leídas');
    });

    it('con un valor de texto usa el label tal cual', async () => {
      await setInputs({ value: 'Vigente', label: 'Estado del convenio' });
      expect(host().getAttribute('aria-label')).toBe('Estado del convenio');
    });

    it('el punto se nombra con su label', async () => {
      await setInputs({ dotOnly: true, value: 7, label: 'Requiere revisión' });
      expect(host().getAttribute('aria-label')).toBe('Requiere revisión');
    });
  });
});
