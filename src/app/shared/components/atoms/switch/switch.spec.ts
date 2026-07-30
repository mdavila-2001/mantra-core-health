import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { SwitchComponent } from './switch';

describe('SwitchComponent', () => {
  let fixture: ComponentFixture<SwitchComponent>;

  function native(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SwitchComponent] }).compileComponents();
    fixture = TestBed.createComponent(SwitchComponent);
    fixture.componentRef.setInput('label', 'Notificaciones');
    await fixture.whenStable();
  });

  it('se anuncia como interruptor, no como casilla', () => {
    expect(native().getAttribute('role')).toBe('switch');
  });

  it('role=switch exige aria-checked y lo mantiene sincronizado', async () => {
    expect(native().getAttribute('aria-checked')).toBe('false');

    native().click();
    await fixture.whenStable();

    expect(native().getAttribute('aria-checked')).toBe('true');
    expect(fixture.componentInstance.checked()).toBe(true);
  });

  it('alterna en los dos sentidos', async () => {
    native().click();
    await fixture.whenStable();
    native().click();
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

  it('el label queda asociado al control', () => {
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
    expect(label.control).toBe(native());
  });
});
