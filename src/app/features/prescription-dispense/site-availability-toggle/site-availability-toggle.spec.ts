import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { SiteAvailabilityToggle } from './site-availability-toggle';

/**
 * El interruptor «Lo tengo / No lo tengo» (REQ-FAR-02-009), suelto: el rótulo
 * sigue al valor, se deshabilita mientras viaja, avisa el motivo del fallo y
 * emite lo que la persona pidió sin decidir nada por su cuenta.
 */
describe('SiteAvailabilityToggle', () => {
  function mount(inputs: {
    available: boolean;
    pending?: boolean;
    failure?: string | null;
  }): ComponentFixture<SiteAvailabilityToggle> {
    const fixture = TestBed.createComponent(SiteAvailabilityToggle);
    fixture.componentRef.setInput('siteName', 'Sede Centro');
    fixture.componentRef.setInput('available', inputs.available);
    fixture.componentRef.setInput('pending', inputs.pending ?? false);
    fixture.componentRef.setInput('failure', inputs.failure ?? null);
    fixture.detectChanges();
    return fixture;
  }

  function input(fixture: ComponentFixture<SiteAvailabilityToggle>): HTMLInputElement {
    return fixture.nativeElement.querySelector('input[role="switch"]') as HTMLInputElement;
  }

  function visibleState(fixture: ComponentFixture<SiteAvailabilityToggle>): HTMLElement {
    return fixture.nativeElement.querySelector('.site-toggle__state') as HTMLElement;
  }

  it('encendido: dice «Lo tengo» a la vista y el control se llama «Lo tengo en {sede}»', () => {
    const fixture = mount({ available: true });

    expect(input(fixture).checked).toBe(true);
    expect(input(fixture).getAttribute('aria-checked')).toBe('true');
    expect(input(fixture).getAttribute('aria-label')).toBe('Lo tengo en Sede Centro');
    expect(visibleState(fixture).textContent?.trim()).toBe('Lo tengo');
  });

  it('apagado: el nombre no cambia (el estado lo dice aria-checked) y a la vista dice «No lo tengo»', () => {
    const fixture = mount({ available: false });

    expect(input(fixture).checked).toBe(false);
    expect(input(fixture).getAttribute('aria-checked')).toBe('false');
    expect(input(fixture).getAttribute('aria-label')).toBe('Lo tengo en Sede Centro');
    expect(visibleState(fixture).textContent?.trim()).toBe('No lo tengo');
    expect(visibleState(fixture).getAttribute('aria-hidden')).toBe('true');
  });

  it('emite el valor pedido al accionarlo', () => {
    const fixture = mount({ available: true });
    const emitted: boolean[] = [];
    fixture.componentInstance.toggled.subscribe((value) => emitted.push(value));

    input(fixture).click();

    expect(emitted).toEqual([false]);
  });

  it('mientras viaja está deshabilitado y la región de estado, que ya existía, dice «Guardando…»', () => {
    const fixture = mount({ available: false });
    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    expect(status.textContent?.trim()).toBe('');

    fixture.componentRef.setInput('pending', true);
    fixture.detectChanges();

    expect(input(fixture).disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBe(status);
    expect(status.textContent).toContain('Guardando');
  });

  it('al terminar devuelve el foco al control si el pedido salió de él y quedó en el body', () => {
    const fixture = mount({ available: true });
    document.body.appendChild(fixture.nativeElement);
    input(fixture).focus();

    input(fixture).click();
    // El navegador saca el foco del control al deshabilitarlo (focus fixup);
    // jsdom no lo hace solo, así que se simula antes de deshabilitar.
    input(fixture).blur();
    fixture.componentRef.setInput('pending', true);
    fixture.detectChanges();
    expect(document.activeElement).toBe(document.body);

    fixture.componentRef.setInput('pending', false);
    fixture.componentRef.setInput('available', false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(input(fixture));
    fixture.nativeElement.remove();
  });

  it('no le roba el foco a otro control que la persona eligió mientras viajaba', () => {
    const fixture = mount({ available: true });
    const other = document.createElement('button');
    document.body.append(fixture.nativeElement, other);
    input(fixture).focus();

    input(fixture).click();
    fixture.componentRef.setInput('pending', true);
    fixture.detectChanges();
    other.focus();

    fixture.componentRef.setInput('pending', false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(other);
    fixture.nativeElement.remove();
    other.remove();
  });

  it('con un fallo avisa que sigue como estaba y el motivo', () => {
    const fixture = mount({ available: true, failure: 'El producto está marcado sin stock.' });

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('No se pudo guardar. Sigue como estaba.');
    expect(alert.textContent).toContain('El producto está marcado sin stock.');
    expect(input(fixture).disabled).toBe(false);
  });
});
