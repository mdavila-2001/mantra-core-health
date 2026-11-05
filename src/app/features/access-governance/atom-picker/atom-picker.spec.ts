import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { SUPPORT_ATOMS } from '../../../core/data-access/support-access/support-atoms';
import { AtomPicker } from './atom-picker';

/**
 * El selector de permisos atómicos de las reglas de gobierno: lista por
 * categoría, búsqueda sin tildes ni mayúsculas, chips de lo elegido con
 * «Quitar» rotulado, y el vacío dicho en palabras.
 */
describe('AtomPicker', () => {
  let fixture: ComponentFixture<AtomPicker>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const primero = SUPPORT_ATOMS[0]!;
  const segundo = SUPPORT_ATOMS[1]!;

  function pintar(selected: readonly string[] = []): void {
    fixture = TestBed.createComponent(AtomPicker);
    fixture.componentRef.setInput('label', 'Primer grupo');
    fixture.componentRef.setInput('idPrefix', 'pk');
    fixture.componentRef.setInput('selected', selected);
    fixture.detectChanges();
  }

  function marcar(code: string, valor: boolean): void {
    const caja = root().querySelector<HTMLInputElement>(`[data-testid="pk-opcion-${code}"] input`)!;
    caja.checked = valor;
    caja.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  async function buscar(texto: string): Promise<void> {
    const campo = root().querySelector<HTMLInputElement>('[data-testid="pk-buscar"]')!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('es un fieldset rotulado con una casilla por permiso y el vacío dicho', () => {
    pintar();
    expect(root().querySelector('legend')?.textContent).toBe('Primer grupo');
    expect(root().querySelectorAll('[data-testid^="pk-opcion-"]')).toHaveLength(SUPPORT_ATOMS.length);
    expect(root().querySelector('[data-testid="pk-elegidos"]')?.textContent).toContain('Todavía no eligió ningún permiso.');
  });

  it('marcar agrega al final sin duplicar y muestra el chip con su nombre', () => {
    pintar([segundo.code]);
    marcar(primero.code, true);
    expect(fixture.componentInstance.selected()).toEqual([segundo.code, primero.code]);
    expect(root().querySelector('[data-testid="pk-elegidos"]')?.textContent).toContain(primero.name);
  });

  it('«Quitar» del chip saca ese permiso y se rotula con su nombre', () => {
    pintar([primero.code, segundo.code]);
    const quitar = root().querySelector<HTMLButtonElement>(`[data-testid="pk-quitar-${primero.code}"]`)!;
    expect(quitar.getAttribute('aria-label')).toBe(`Quitar «${primero.name}»`);
    quitar.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual([segundo.code]);
  });

  it('la búsqueda ignora tildes y mayúsculas; sin coincidencias lo dice', async () => {
    pintar();
    const termino = primero.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .slice(0, 6);
    await buscar(termino);
    expect(root().querySelector(`[data-testid="pk-opcion-${primero.code}"]`)).not.toBeNull();
    expect(root().querySelectorAll('[data-testid^="pk-opcion-"]').length).toBeLessThan(SUPPORT_ATOMS.length);

    await buscar('zzzz-no-existe');
    expect(root().textContent).toContain('Ningún permiso coincide con lo que escribió.');
  });

  it('marca el error con su clase', () => {
    pintar();
    fixture.componentRef.setInput('hasError', true);
    fixture.detectChanges();
    expect(root().querySelector('fieldset')?.classList.contains('selector--error')).toBe(true);
  });
});
