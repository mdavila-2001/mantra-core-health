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
  function grillaDeAnios(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.calendar-grid-years');
  }
  function grillaDeMeses(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.calendar-grid-months');
  }
  function enfocada(): string {
    return document.activeElement?.textContent?.trim() ?? '';
  }
  function tabulables(): HTMLButtonElement[] {
    return celdas().filter((cell) => cell.getAttribute('tabindex') === '0');
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

    it('al clickear el input selecciona los dos dígitos del día si se clickea al inicio', () => {
      fixture.componentRef.setInput('value', new Date(2026, 6, 15));
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.setSelectionRange(1, 1);
      inputEl.dispatchEvent(new MouseEvent('click'));

      expect(inputEl.selectionStart).toBe(0);
      expect(inputEl.selectionEnd).toBe(2);
    });

    it('al clickear en la sección de mes selecciona los dos dígitos del mes', () => {
      fixture.componentRef.setInput('value', new Date(2026, 6, 15));
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.setSelectionRange(4, 4);
      inputEl.dispatchEvent(new MouseEvent('click'));

      expect(inputEl.selectionStart).toBe(3);
      expect(inputEl.selectionEnd).toBe(5);
    });

    it('al clickear en la sección de año selecciona los cuatro dígitos del año', () => {
      fixture.componentRef.setInput('value', new Date(2026, 6, 15));
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.setSelectionRange(8, 8);
      inputEl.dispatchEvent(new MouseEvent('click'));

      expect(inputEl.selectionStart).toBe(6);
      expect(inputEl.selectionEnd).toBe(10);
    });

    it('Tab navega de Día a Mes y de Mes a Año', () => {
      fixture.componentRef.setInput('value', new Date(2026, 6, 15));
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.setSelectionRange(0, 2);

      // Tab desde Día -> Mes [3, 5]
      const tab1 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      inputEl.dispatchEvent(tab1);
      expect(tab1.defaultPrevented).toBe(true);
      expect(inputEl.selectionStart).toBe(3);
      expect(inputEl.selectionEnd).toBe(5);

      // Tab desde Mes -> Año [6, 10]
      const tab2 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      inputEl.dispatchEvent(tab2);
      expect(tab2.defaultPrevented).toBe(true);
      expect(inputEl.selectionStart).toBe(6);
      expect(inputEl.selectionEnd).toBe(10);

      // Tab desde Año no previene default para salir al botón del calendario
      const tab3 = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      inputEl.dispatchEvent(tab3);
      expect(tab3.defaultPrevented).toBe(false);
    });

    it('Shift+Tab navega de Año a Mes y de Mes a Día', () => {
      fixture.componentRef.setInput('value', new Date(2026, 6, 15));
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.setSelectionRange(6, 10);

      // Shift+Tab desde Año -> Mes [3, 5]
      const sTab1 = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
      inputEl.dispatchEvent(sTab1);
      expect(sTab1.defaultPrevented).toBe(true);
      expect(inputEl.selectionStart).toBe(3);
      expect(inputEl.selectionEnd).toBe(5);

      // Shift+Tab desde Mes -> Día [0, 2]
      const sTab2 = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
      inputEl.dispatchEvent(sTab2);
      expect(sTab2.defaultPrevented).toBe(true);
      expect(inputEl.selectionStart).toBe(0);
      expect(inputEl.selectionEnd).toBe(2);
    });

    it('Flechas arriba y abajo incrementan o decrementan el segmento seleccionado', () => {
      fixture.componentRef.setInput('value', new Date(2026, 6, 15));
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.setSelectionRange(0, 2);

      // Flecha arriba en Día: 15 -> 16
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      expect(inputEl.value.startsWith('16/')).toBe(true);
      expect(inputEl.selectionStart).toBe(0);
      expect(inputEl.selectionEnd).toBe(2);

      // Flecha abajo en Día: 16 -> 15
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(inputEl.value.startsWith('15/')).toBe(true);
    });

    it('al teclear un dígito >= 4 en el día completa con 0X y avanza a mes', () => {
      fixture.componentRef.setInput('value', null);
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.dispatchEvent(new Event('focus'));
      inputEl.setSelectionRange(0, 2);

      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '5' }));
      expect(inputEl.value).toBe('05/MM/AAAA');
      expect(inputEl.selectionStart).toBe(3);
      expect(inputEl.selectionEnd).toBe(5);
    });

    it('al escribir solo 1 en día, mes y año normaliza a 01 y 0001', () => {
      fixture.componentRef.setInput('value', null);
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.dispatchEvent(new Event('focus'));
      inputEl.setSelectionRange(0, 2);

      // Tipear 1 en Día -> '1D/MM/AAAA'
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
      expect(inputEl.value).toBe('1D/MM/AAAA');

      // Presionar Tab -> Día se normaliza a 01 y salta a Mes
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      expect(inputEl.value.startsWith('01/')).toBe(true);
      expect(inputEl.selectionStart).toBe(3);
      expect(inputEl.selectionEnd).toBe(5);

      // Tipear 1 en Mes -> '01/1M/AAAA'
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
      expect(inputEl.value).toBe('01/1M/AAAA');

      // Presionar Tab -> Mes se normaliza a 01 y salta a Año
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      expect(inputEl.value.startsWith('01/01/')).toBe(true);
      expect(inputEl.selectionStart).toBe(6);
      expect(inputEl.selectionEnd).toBe(10);

      // Tipear 1 en Año -> '01/01/1AAA'
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
      expect(inputEl.value).toBe('01/01/1AAA');

      // Al salir / blur, Año se normaliza a 0001 y se obtiene fecha completa 01/01/0001
      inputEl.dispatchEvent(new Event('blur'));
      expect(inputEl.value).toBe('01/01/0001');

      const val = fixture.componentInstance.value();
      expect(val).toBeInstanceOf(Date);
      expect(val?.getFullYear()).toBe(1);
      expect(val?.getMonth()).toBe(0);
      expect(val?.getDate()).toBe(1);
    });

    it('al tipear 1 en día y presionar / normaliza a 01 y avanza a mes', () => {
      fixture.componentRef.setInput('value', null);
      fixture.detectChanges();

      const inputEl = input()!;
      inputEl.dispatchEvent(new Event('focus'));
      inputEl.setSelectionRange(0, 2);

      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));

      expect(inputEl.value.startsWith('01/')).toBe(true);
      expect(inputEl.selectionStart).toBe(3);
      expect(inputEl.selectionEnd).toBe(5);
    });
  });

  describe('navegación de años y meses', () => {
    it('un campo cerrado al pasado abre la grilla de años en 1980-2009', async () => {
      // `maxDate="today"` es cómo se declaran los tres campos de fecha de
      // nacimiento de la aplicación, y es la señal que hace que el calendario
      // mire hacia atrás. Sin ella el campo es una fecha operativa y abre en
      // hoy — ver la prueba siguiente.
      fixture.componentRef.setInput('value', null);
      fixture.componentRef.setInput('maxDate', 'today');
      await fixture.whenStable();
      await abrirAnios();

      const textos = celdas().map((cell) => cell.textContent?.trim());
      expect(textos.length).toBe(30);
      expect(textos[0]).toBe('1980');
      expect(textos[29]).toBe('2009');
      expect(textos).toEqual(Array.from({ length: 30 }, (_, index) => String(1980 + index)));
      expect(anuncio()).toBe('Años 1980 a 2009');
      // Los treinta son de la página: ninguno se muestra atenuado.
      expect(celdas().filter((cell) => cell.classList.contains('other-decade')).length).toBe(0);
    });

    it('sin tope en el pasado el calendario abre en el mes de hoy, no en enero de 2000', async () => {
      // El defecto: el mes por defecto salía de una constante —enero de
      // `MAX_DEFAULT_YEAR`—, una heurística de fecha de nacimiento aplicada a
      // los veintidós campos que NO piden un nacimiento. Bloquear la agenda de
      // la semana que viene abría el calendario veintiséis años atrás.
      fixture.componentRef.setInput('value', null);
      fixture.componentRef.setInput('minDate', 'today');
      await fixture.whenStable();
      await abrir();

      const hoy = new Date();
      expect(encabezado().textContent).toContain(String(hoy.getFullYear()));
      expect(encabezado().textContent).toContain(nombreDeMes(hoy.getMonth()));
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

      expect(grillaDeMeses()).toBeNull();
      expect(grillaDeAnios()).toBeNull();
      const diasDeMarzo = dias().filter((day) => !day.classList.contains('other-month'));
      expect(diasDeMarzo.length).toBe(31);
      expect(diasDeMarzo[0].getAttribute('aria-label')).toContain('2024');
      expect(encabezado().textContent).toContain('2024');
    });

    it('carga 1985 en 4 toques: encabezado, año, mes y día', async () => {
      fixture.componentRef.setInput('value', null);
      fixture.componentRef.setInput('maxDate', 'today');
      await fixture.whenStable();
      await abrir();

      let toques = 0;
      encabezado().click();
      toques++;
      await fixture.whenStable();

      // 1985 entra en la página que abre sola: no hay que paginar.
      expect(anuncio()).toBe('Años 1980 a 2009');
      expect(celda('1985')).toBeDefined();

      celda('1985').click(); // toque 2: el año
      toques++;
      await fixture.whenStable();

      celdas()[2].click(); // toque 3: marzo
      toques++;
      await fixture.whenStable();

      const quince = dias().find(
        (day) => day.textContent?.trim() === '15' && !day.classList.contains('other-month'),
      )!;
      quince.click(); // toque 4: el día
      toques++;
      await fixture.whenStable();

      expect(toques).toBe(4);

      const confirmar = [...fixture.nativeElement.querySelectorAll('.dialog-actions button')][1];
      confirmar.click();
      await fixture.whenStable();

      const elegido = fixture.componentInstance.value();
      expect(elegido?.getFullYear()).toBe(1985);
      expect(elegido?.getMonth()).toBe(2);
      expect(elegido?.getDate()).toBe(15);
    });

    it('la grilla de años no ofrece años posteriores a maxDate', async () => {
      fixture.componentRef.setInput('maxDate', new Date(2026, 11, 31));
      await fixture.whenStable();
      await abrirAnios();

      expect(anuncio()).toBe('Años 2000 a 2029');
      expect(celda('2026').disabled).toBe(false);

      const futuros = ['2027', '2028', '2029'].map(celda);
      expect(futuros.every((cell) => cell.disabled)).toBe(true);
      expect(futuros.every((cell) => cell.getAttribute('aria-disabled') === 'true')).toBe(true);
      expect(futuros.every((cell) => cell.classList.contains('is-disabled'))).toBe(true);
      // La página siguiente entera queda fuera: la flecha se apaga.
      expect(flecha('30 años siguientes').getAttribute('aria-disabled')).toBe('true');
    });

    it('la grilla de años apaga los años anteriores a minDate', async () => {
      fixture.componentRef.setInput('minDate', new Date(1900, 0, 1));
      fixture.componentRef.setInput('value', new Date(1905, 5, 10));
      await fixture.whenStable();
      await abrirAnios();

      expect(anuncio()).toBe('Años 1880 a 1909');
      expect(celda('1899').disabled).toBe(true);
      expect(celda('1900').disabled).toBe(false);
    });

    it('en el borde de minDate la flecha de 30 años anteriores se apaga', async () => {
      fixture.componentRef.setInput('minDate', new Date(1900, 0, 1));
      fixture.componentRef.setInput('value', new Date(1925, 5, 10));
      await fixture.whenStable();
      await abrirAnios();

      expect(anuncio()).toBe('Años 1900 a 1929');
      expect(celda('1900').disabled).toBe(false);
      expect(flecha('30 años anteriores').getAttribute('aria-disabled')).toBe('true');

      flecha('30 años anteriores').click();
      await fixture.whenStable();
      expect(anuncio()).toBe('Años 1900 a 1929');
    });

    it('las flechas mueven el foco de a cinco por fila y Enter elige', async () => {
      await abrirAnios();

      // La celda del año en vista es la única tabulable y recibe el foco.
      const activa = celdas().findIndex((cell) => cell.getAttribute('tabindex') === '0');
      expect(celdas()[activa].textContent?.trim()).toBe('2026');
      expect(tabulables().length).toBe(1);
      expect(document.activeElement).toBe(celdas()[activa]);

      await teclear(celdas()[activa], 'ArrowUp'); // una fila: cinco columnas
      expect(document.activeElement).toBe(celdas()[activa - 5]);
      expect(enfocada()).toBe('2021');
      expect(celdas()[activa - 5].getAttribute('tabindex')).toBe('0');

      await teclear(document.activeElement!, 'ArrowDown');
      expect(enfocada()).toBe('2026');

      await teclear(document.activeElement!, 'ArrowRight');
      expect(document.activeElement).toBe(celdas()[activa + 1]);

      const anio = enfocada();
      await teclear(document.activeElement!, 'Enter');

      expect(anuncio()).toBe(`Meses de ${anio}`);
    });

    it('Inicio y Fin van al primer y al último año de la página', async () => {
      await abrirAnios();

      const activa = celdas().findIndex((cell) => cell.getAttribute('tabindex') === '0');

      await teclear(celdas()[activa], 'Home');
      expect(enfocada()).toBe('2000');

      await teclear(document.activeElement!, 'End');
      expect(enfocada()).toBe('2029');
    });

    it('Av Pág y Re Pág cambian de página de 30 años sin duplicar el tabindex', async () => {
      await abrirAnios();

      const activa = celdas().findIndex((cell) => cell.getAttribute('tabindex') === '0');

      await teclear(celdas()[activa], 'PageDown');
      expect(anuncio()).toBe('Años 2030 a 2059');
      // El foco cae en el año equivalente de la página nueva.
      expect(enfocada()).toBe('2056');
      expect(tabulables().length).toBe(1);

      await teclear(document.activeElement!, 'PageUp');
      expect(anuncio()).toBe('Años 2000 a 2029');
      expect(enfocada()).toBe('2026');
      expect(tabulables().length).toBe(1);
    });

    it('Escape vuelve a los días y recién después cierra el diálogo', async () => {
      await abrirAnios();
      expect(grillaDeAnios()).not.toBeNull();

      await teclear(dialog()!, 'Escape');

      expect(dialog()).not.toBeNull();
      expect(grillaDeAnios()).toBeNull();
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
      expect(anuncio()).toBe('Años 2000 a 2029');

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

  describe('no se confirma lo que nadie eligió', () => {
    function confirmar(): HTMLButtonElement {
      return fixture.nativeElement.querySelector('[data-testid="date-picker-confirm"]');
    }

    /**
     * `app-button` deshabilita con `aria-disabled` y no con el atributo nativo,
     * a propósito: así el botón sigue siendo enfocable y un lector de pantalla
     * puede llegar a él y decir por qué no se puede usar. Lo que corta el clic
     * es el propio componente.
     */
    function estaDeshabilitado(): boolean {
      return confirmar().getAttribute('aria-disabled') === 'true';
    }

    it('sin valor previo, «Confirmar» nace deshabilitado', async () => {
      fixture.componentRef.setInput('value', null);
      await fixture.whenStable();
      await abrir();

      // `open()` siembra el mes que se dibuja, no una elección: antes de este
      // caso aceptaba el 1 de enero del año por defecto y lo escribía como si
      // la persona lo hubiera elegido.
      expect(estaDeshabilitado()).toBe(true);
    });

    it('elegir un día lo habilita', async () => {
      fixture.componentRef.setInput('value', null);
      await fixture.whenStable();
      await abrir();
      expect(estaDeshabilitado()).toBe(true);

      const dia = dias().find((d) => !d.disabled)!;
      dia.click();
      await fixture.whenStable();

      expect(estaDeshabilitado()).toBe(false);
    });

    it('confirmar sin elegir no escribe ninguna fecha', async () => {
      fixture.componentRef.setInput('value', null);
      await fixture.whenStable();
      await abrir();

      confirmar().click();
      await fixture.whenStable();

      expect(input()?.value ?? '').toBe('');
    });

    it('con valor previo se puede confirmar sin tocar nada: ya hay día, mes y año', async () => {
      await abrir();

      expect(estaDeshabilitado()).toBe(false);
    });
  });
});

