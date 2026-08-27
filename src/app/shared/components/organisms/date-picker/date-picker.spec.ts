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
  function encabezado(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.view-switch');
  }
  function celdas(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.calendar-unit-btn'));
  }
  function celda(texto: string): HTMLButtonElement {
    return celdas().find((cell) => cell.textContent?.trim() === texto)!;
  }
  function flecha(etiqueta: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[aria-label="${etiqueta}"]`);
  }
  function anuncio(): string {
    return fixture.nativeElement.querySelector('[role=status]')?.textContent?.trim() ?? '';
  }
  function nombreDeMes(month: number): string {
    return new Intl.DateTimeFormat('es-BO', { month: 'long' }).format(new Date(2026, month, 1));
  }

  async function abrir(): Promise<void> {
    trigger().click();
    await fixture.whenStable();
  }

  /** Abre el diálogo y sube a la grilla de años desde el encabezado. */
  async function abrirAnios(): Promise<void> {
    await abrir();
    encabezado().click();
    await fixture.whenStable();
  }

  async function teclear(target: Element, key: string): Promise<void> {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
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
    it('la grilla de años arranca en la década de 2000 cuando no hay fecha elegida', async () => {
      fixture.componentRef.setInput('value', null);
      await fixture.whenStable();
      await abrirAnios();

      const esperados = Array.from({ length: 12 }, (_, index) => String(1999 + index));
      expect(celdas().map((cell) => cell.textContent?.trim())).toEqual(esperados);
      expect(anuncio()).toBe('Años 2000 a 2009');
      // 1999 y 2010 son los vecinos de la década, atenuados.
      expect(celdas()[0].classList.contains('other-decade')).toBe(true);
      expect(celdas()[11].classList.contains('other-decade')).toBe(true);
      expect(celda('2005').classList.contains('other-decade')).toBe(false);
    });

    it('elegir un año abre la grilla de meses y elegir el mes vuelve a los días', async () => {
      await abrirAnios();

      celda('2024').click();
      await fixture.whenStable();
      expect(anuncio()).toBe('Meses de 2024');
      expect(celdas().length).toBe(12);
      expect(celdas()[2].getAttribute('aria-label')).toBe(`${nombreDeMes(2)} de 2024`);

      celdas()[2].click(); // marzo
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('.calendar-grid-wide')).toBeNull();
      const diasDeMarzo = dias().filter((day) => !day.classList.contains('other-month'));
      expect(diasDeMarzo.length).toBe(31);
      expect(diasDeMarzo[0].getAttribute('aria-label')).toContain('2024');
      expect(encabezado().textContent).toContain('2024');
    });

    it('elegir 1985 en 3 gestos: año, mes y día', async () => {
      fixture.componentRef.setInput('value', null);
      await fixture.whenStable();
      await abrir();

      let toques = 0;
      encabezado().click();
      toques++;
      await fixture.whenStable();

      // De la década de 2000 a la de 1980.
      for (let salto = 0; salto < 2; salto++) {
        flecha('Década anterior').click();
        toques++;
        await fixture.whenStable();
      }
      expect(anuncio()).toBe('Años 1980 a 1989');

      celda('1985').click(); // gesto 1: el año
      toques++;
      await fixture.whenStable();

      celdas()[2].click(); // gesto 2: marzo
      toques++;
      await fixture.whenStable();

      const quince = dias().find(
        (day) => day.textContent?.trim() === '15' && !day.classList.contains('other-month'),
      )!;
      quince.click(); // gesto 3: el día
      toques++;
      await fixture.whenStable();

      const confirmar = [...fixture.nativeElement.querySelectorAll('.dialog-actions button')][1];
      confirmar.click();
      await fixture.whenStable();

      const elegido = fixture.componentInstance.value();
      expect(elegido?.getFullYear()).toBe(1985);
      expect(elegido?.getMonth()).toBe(2);
      expect(elegido?.getDate()).toBe(15);
      // Tres selecciones más el encabezado y las dos décadas de distancia.
      expect(toques).toBe(6);
    });

    it('la grilla de años no ofrece años posteriores a maxDate', async () => {
      fixture.componentRef.setInput('maxDate', 'today');
      await fixture.whenStable();
      await abrirAnios();

      const anioActual = new Date().getFullYear();
      const habilitados = celdas()
        .filter((cell) => !cell.disabled)
        .map((cell) => Number(cell.textContent));
      const futuros = celdas().filter((cell) => Number(cell.textContent) > anioActual);

      expect(habilitados.length).toBeGreaterThan(0);
      expect(habilitados.every((anio) => anio <= anioActual)).toBe(true);
      expect(futuros.length).toBeGreaterThan(0);
      expect(futuros.every((cell) => cell.disabled)).toBe(true);
      expect(futuros.every((cell) => cell.getAttribute('aria-disabled') === 'true')).toBe(true);
      expect(futuros.every((cell) => cell.classList.contains('is-disabled'))).toBe(true);
      // La década siguiente entera queda fuera: la flecha se apaga.
      expect(flecha('Década siguiente').getAttribute('aria-disabled')).toBe('true');
    });

    it('la grilla de años no ofrece la década anterior a minDate', async () => {
      fixture.componentRef.setInput('minDate', new Date(1900, 0, 1));
      fixture.componentRef.setInput('value', new Date(1905, 5, 10));
      await fixture.whenStable();
      await abrirAnios();

      expect(anuncio()).toBe('Años 1900 a 1909');
      expect(celda('1899').disabled).toBe(true);
      expect(celda('1900').disabled).toBe(false);
      expect(flecha('Década anterior').getAttribute('aria-disabled')).toBe('true');

      flecha('Década anterior').click();
      await fixture.whenStable();
      expect(anuncio()).toBe('Años 1900 a 1909');
    });

    it('las flechas mueven el foco entre celdas y Enter elige', async () => {
      await abrirAnios();

      // La celda del año en vista es la única tabulable y recibe el foco.
      const activa = celdas().findIndex((cell) => cell.getAttribute('tabindex') === '0');
      expect(celdas()[activa].textContent?.trim()).toBe('2026');
      expect(celdas().filter((cell) => cell.getAttribute('tabindex') === '0').length).toBe(1);
      expect(document.activeElement).toBe(celdas()[activa]);

      await teclear(celdas()[activa], 'ArrowUp'); // una fila: cuatro columnas
      expect(document.activeElement).toBe(celdas()[activa - 4]);
      expect(celdas()[activa - 4].getAttribute('tabindex')).toBe('0');

      await teclear(document.activeElement!, 'ArrowRight');
      expect(document.activeElement).toBe(celdas()[activa - 3]);

      const anio = document.activeElement!.textContent?.trim();
      await teclear(document.activeElement!, 'Enter');

      expect(anuncio()).toBe(`Meses de ${anio}`);
    });

    it('Escape vuelve a los días y recién después cierra el diálogo', async () => {
      await abrirAnios();
      expect(fixture.nativeElement.querySelector('.calendar-grid-wide')).not.toBeNull();

      await teclear(dialog()!, 'Escape');

      expect(dialog()).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.calendar-grid-wide')).toBeNull();
      expect(document.activeElement).toBe(encabezado());

      await teclear(dialog()!, 'Escape');

      expect(dialog()).toBeNull();
    });

    it('anuncia el panel vigente en una región viva', async () => {
      await abrir();

      const region: HTMLElement = fixture.nativeElement.querySelector('[role=status]');
      expect(region.getAttribute('aria-live')).toBe('polite');
      expect(region.classList.contains('sr-only')).toBe(true);
      expect(anuncio()).toBe(`${nombreDeMes(6)} de 2026`);

      encabezado().click();
      await fixture.whenStable();
      expect(anuncio()).toBe('Años 2020 a 2029');

      celda('2026').click();
      await fixture.whenStable();
      expect(anuncio()).toBe('Meses de 2026');
    });

    it('los botones de año anterior y siguiente saltan un año completo', async () => {
      await abrir();

      flecha('Año anterior').click();
      await fixture.whenStable();

      expect(encabezado().textContent).toContain('2025');
      expect(anuncio()).toBe(`${nombreDeMes(6)} de 2025`);
    });

    it('las flechas de mes y año se deshabilitan al tocar el límite', async () => {
      fixture.componentRef.setInput('maxDate', new Date(2026, 6, 20));
      await fixture.whenStable();
      await abrir();

      expect(flecha('Mes anterior').getAttribute('aria-disabled')).toBe('false');
      expect(flecha('Mes siguiente').getAttribute('aria-disabled')).toBe('true');
      expect(flecha('Año siguiente').getAttribute('aria-disabled')).toBe('true');

      flecha('Mes siguiente').click();
      await fixture.whenStable();

      expect(encabezado().textContent).toContain(nombreDeMes(6));
      expect(encabezado().textContent).toContain('2026');
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

