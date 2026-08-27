import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { DatePicker } from './date-picker';

describe('DatePicker', () => {
  let fixture: ComponentFixture<DatePicker>;

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.date-picker-trigger');
  }
  function input(): HTMLInputElement | null {
    return fixture.nativeElement.querySelector('.date-picker-input');
  }
  function dialog(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role=dialog]');
  }
  function dias(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.calendar-day-btn'));
  }
  function yearSelect(): HTMLSelectElement | null {
    return fixture.nativeElement.querySelector('.year-select');
  }
  function monthSelect(): HTMLSelectElement | null {
    return fixture.nativeElement.querySelector('.month-select');
  }

  async function abrir(): Promise<void> {
    trigger().click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DatePicker] }).compileComponents();
    fixture = TestBed.createComponent(DatePicker);
    fixture.componentRef.setInput('value', new Date(2026, 6, 15, 10, 30));
    await fixture.whenStable();
  });

  describe('el diálogo se comporta como un diálogo', () => {
    it('el disparador declara que abre uno', () => {
      expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('al abrir, el foco entra al diálogo', async () => {
      await abrir();

      expect(dialog()).not.toBeNull();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(dialog());
    });

    it('Escape cierra y devuelve el foco', async () => {
      await abrir();

      dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();

      expect(dialog()).toBeNull();
      const active = document.activeElement;
      expect(active === input() || active === trigger()).toBe(true);
    });

    it('cancelar descarta lo elegido', async () => {
      const original = fixture.componentInstance.value();
      await abrir();

      dias()[20].click();
      await fixture.whenStable();

      const cancelar = [...fixture.nativeElement.querySelectorAll('.dialog-actions button')][0];
      cancelar.click();
      await fixture.whenStable();

      expect(fixture.componentInstance.value()).toBe(original);
    });

    it('confirmar aplica lo elegido', async () => {
      await abrir();

      const elegido = dias().find((day) => !day.classList.contains('other-month') && !day.disabled)!;
      elegido.click();
      await fixture.whenStable();

      const confirmar = [...fixture.nativeElement.querySelectorAll('.dialog-actions button')][1];
      confirmar.click();
      await fixture.whenStable();

      expect(dialog()).toBeNull();
      expect(fixture.componentInstance.value()).toBeInstanceOf(Date);
    });
  });

  describe('ingreso por teclado y máscara in-place', () => {
    it('muestra el valor formateado en el input de texto', () => {
      expect(input()?.value).toBe('15/07/2026');
    });

    it('al hacer focus en un campo vacío, inicializa con la máscara DD/MM/AAAA', () => {
      fixture.componentRef.setInput('value', null);
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.dispatchEvent(new Event('focus'));
      expect(inputEl.value).toBe('DD/MM/AAAA');
    });

    it('reemplaza los caracteres in-place al teclear dígitos', () => {
      fixture.componentRef.setInput('value', null);
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.dispatchEvent(new Event('focus'));
      inputEl.setSelectionRange(0, 0);

      // Tipear '1' -> '1D/MM/AAAA'
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
      expect(inputEl.value).toBe('1D/MM/AAAA');

      // Tipear '4' -> '14/MM/AAAA' y salta a posición 3
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '4' }));
      expect(inputEl.value).toBe('14/MM/AAAA');

      // Tipear '0' -> '14/0M/AAAA'
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '0' }));
      expect(inputEl.value).toBe('14/0M/AAAA');

      // Tipear '3' -> '14/03/AAAA'
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
      expect(inputEl.value).toBe('14/03/AAAA');

      // Tipear '1', '9', '8', '5' -> '14/03/1985'
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '9' }));
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '8' }));
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));
      expect(inputEl.value).toBe('14/03/1985');

      const val = fixture.componentInstance.value();
      expect(val).toBeInstanceOf(Date);
      expect(val?.getFullYear()).toBe(1985);
      expect(val?.getMonth()).toBe(2);
      expect(val?.getDate()).toBe(14);
    });

    it('al presionar Backspace restaura el carácter de la plantilla', () => {
      fixture.componentRef.setInput('value', null);
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.dispatchEvent(new Event('focus'));
      inputEl.setSelectionRange(0, 0);

      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
      expect(inputEl.value).toBe('1D/MM/AAAA');

      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      expect(inputEl.value).toBe('DD/MM/AAAA');
    });

    it('escribir una fecha inválida marca error en blur', async () => {
      const inputEl = input()!;
      inputEl.value = '32/13/2026';
      inputEl.dispatchEvent(new Event('blur'));
      await fixture.whenStable();

      expect(inputEl.getAttribute('aria-invalid')).toBe('true');
    });

    it('vaciar el input limpia el valor del modelo al perder foco', async () => {
      const inputEl = input()!;
      inputEl.value = 'DD/MM/AAAA';
      inputEl.dispatchEvent(new Event('blur'));
      await fixture.whenStable();

      expect(fixture.componentInstance.value()).toBeNull();
      expect(inputEl.value).toBe('');
    });
  });

  describe('navegación de años y meses', () => {
    it('el selector de año empieza por defecto en 2000 cuando no hay fecha elegida', async () => {
      fixture.componentRef.setInput('value', null);
      await fixture.whenStable();
      await abrir();

      const select = yearSelect();
      expect(select?.value).toBe('2000');
      // La primera opción del dropdown es 2000 (no 2100)
      expect(select?.options[0].value).toBe('2000');
    });

    it('permite cambiar de año directamente con el selector desplegable', async () => {
      await abrir();
      const select = yearSelect();
      expect(select).not.toBeNull();

      select!.value = '1985';
      select!.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      const diasJulio1985 = dias().filter((d) => !d.classList.contains('other-month'));
      expect(diasJulio1985.length).toBe(31);
      expect(diasJulio1985[0].getAttribute('aria-label')).toContain('1985');
    });

    it('permite cambiar de mes con el selector desplegable', async () => {
      await abrir();
      const select = monthSelect();
      expect(select).not.toBeNull();

      select!.value = '1'; // Febrero
      select!.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      const diasFebrero2026 = dias().filter((d) => !d.classList.contains('other-month'));
      expect(diasFebrero2026.length).toBe(28); // 2026 no es bisiesto
    });

    it('los botones de año anterior y siguiente saltan un año completo', async () => {
      await abrir();

      const anioAnterior: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[aria-label="Año anterior"]',
      );
      anioAnterior.click();
      await fixture.whenStable();

      expect(yearSelect()?.value).toBe('2025');
    });
  });

  describe('límites de fecha (maxDate / minDate)', () => {
    it('deshabilita días posteriores a maxDate', async () => {
      fixture.componentRef.setInput('maxDate', new Date(2026, 6, 20));
      await fixture.whenStable();
      await abrir();

      const diasDelMes = dias().filter((d) => !d.classList.contains('other-month'));
      // Día 20 debe estar habilitado
      expect(diasDelMes[19].disabled).toBe(false);
      // Día 21 debe estar deshabilitado
      expect(diasDelMes[20].disabled).toBe(true);
      expect(diasDelMes[20].classList.contains('is-disabled')).toBe(true);
    });

    it('escribir por teclado una fecha posterior a maxDate marca error', async () => {
      fixture.componentRef.setInput('maxDate', new Date(2026, 6, 20));
      await fixture.whenStable();

      const inputEl = input()!;
      inputEl.value = '25/07/2026';
      inputEl.dispatchEvent(new Event('input'));
      inputEl.dispatchEvent(new Event('blur'));
      await fixture.whenStable();

      expect(inputEl.getAttribute('aria-invalid')).toBe('true');
    });
  });

  describe('el calendario no depende solo del color', () => {
    it('el día elegido se anuncia con aria-pressed', async () => {
      await abrir();

      const seleccionados = dias().filter(
        (day) => day.getAttribute('aria-pressed') === 'true',
      );
      expect(seleccionados.length).toBe(1);
      expect(seleccionados[0].classList.contains('is-selected')).toBe(true);
    });

    it('cada día se lee con su fecha completa, no solo el número', async () => {
      await abrir();

      const etiqueta = dias()[0].getAttribute('aria-label') ?? '';
      expect(etiqueta.length).toBeGreaterThan(2);
      expect(etiqueta).not.toBe(dias()[0].textContent?.trim());
    });
  });

  describe('grilla del mes', () => {
    it('siempre tiene semanas completas', async () => {
      await abrir();

      expect(dias().length % 7).toBe(0);
    });

    it('contiene todos los días del mes en vista', async () => {
      await abrir();

      const delMes = dias().filter((day) => !day.classList.contains('other-month'));
      expect(delMes.length).toBe(31); // julio
    });
  });

  it('deshabilitado no abre', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    await abrir();

    expect(dialog()).toBeNull();
  });

  it('el selector de hora solo existe en modo date-time', async () => {
    await abrir();
    expect(fixture.nativeElement.querySelector('.time-picker-section')).toBeNull();

    fixture.componentRef.setInput('mode', 'date-time');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.time-picker-section')).not.toBeNull();
  });
});

