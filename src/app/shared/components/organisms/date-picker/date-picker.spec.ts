import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { DatePicker } from './date-picker';

describe('DatePicker', () => {
  let fixture: ComponentFixture<DatePicker>;

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.date-picker-trigger');
  }
  function dialog(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role=dialog]');
  }
  function dias(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.calendar-day-btn'));
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

    it('Escape cierra y devuelve el foco al disparador', async () => {
      await abrir();

      dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();

      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(trigger());
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

      const elegido = dias().find((day) => !day.classList.contains('other-month'))!;
      elegido.click();
      await fixture.whenStable();

      const confirmar = [...fixture.nativeElement.querySelectorAll('.dialog-actions button')][1];
      confirmar.click();
      await fixture.whenStable();

      expect(dialog()).toBeNull();
      expect(fixture.componentInstance.value()).toBeInstanceOf(Date);
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

    it('navegar de mes cambia la vista sin tocar el valor', async () => {
      await abrir();
      const original = fixture.componentInstance.value();

      const anterior: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[aria-label="Mes anterior"]',
      );
      anterior.click();
      await fixture.whenStable();

      const delMes = dias().filter((day) => !day.classList.contains('other-month'));
      expect(delMes.length).toBe(30); // junio
      expect(fixture.componentInstance.value()).toBe(original);
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
