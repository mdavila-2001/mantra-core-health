import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupportCode } from './support-code';

describe('SupportCode', () => {
  let fixture: ComponentFixture<SupportCode>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(SupportCode);
    fixture.componentRef.setInput('code', 'req-777');
    fixture.detectChanges();
  });

  it('muestra el código entero, sin cortes', () => {
    const code = host().querySelector('code')!;
    expect(code.textContent).toBe('req-777');
    expect(host().textContent).toContain('Código de soporte:');
  });

  it('copia el código al portapapeles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    host().querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(writeText).toHaveBeenCalledWith('req-777');
  });

  it('sin `copyable` no ofrece el botón', () => {
    fixture.componentRef.setInput('copyable', false);
    fixture.detectChanges();
    expect(host().querySelector('button')).toBeNull();
  });
});
