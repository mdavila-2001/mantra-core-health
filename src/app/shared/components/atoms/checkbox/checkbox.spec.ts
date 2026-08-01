import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  let fixture: ComponentFixture<Checkbox>;

  function native(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Checkbox] }).compileComponents();
    fixture = TestBed.createComponent(Checkbox);
    fixture.componentRef.setInput('label', 'Acepto los términos');
    await fixture.whenStable();
  });

  it('un clic marca la casilla una sola vez', async () => {
    native().click();
    await fixture.whenStable();

    expect(fixture.componentInstance.checked()).toBe(true);
    expect(native().checked).toBe(true);
  });

  it('dos clics vuelven al estado inicial', async () => {
    native().click();
    await fixture.whenStable();
    native().click();
    await fixture.whenStable();

    expect(fixture.componentInstance.checked()).toBe(false);
  });

  it('el estado sale del evento nativo, no de invertir el propio', async () => {
    // Si el componente invirtiera su señal, un change con checked=false
    // estando en false lo dejaría en true.
    native().checked = false;
    native().dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(fixture.componentInstance.checked()).toBe(false);
  });

  it('deshabilitado no cambia de estado', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();

    native().click();
    await fixture.whenStable();

    expect(fixture.componentInstance.checked()).toBe(false);
  });

  it('el label envuelve al control, así que el clic en el texto también marca', () => {
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    expect(label.control).toBe(native());
  });

  it('hasError marca aria-invalid, no solo color', async () => {
    expect(native().getAttribute('aria-invalid')).toBe('false');

    fixture.componentRef.setInput('hasError', true);
    await fixture.whenStable();

    expect(native().getAttribute('aria-invalid')).toBe('true');
  });

  it('no repite aria-checked: el checkbox nativo ya lo expone', () => {
    expect(native().hasAttribute('aria-checked')).toBe(false);
  });
});
