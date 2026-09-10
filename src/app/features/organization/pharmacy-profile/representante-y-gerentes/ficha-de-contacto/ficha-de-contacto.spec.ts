import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FichaDeContacto } from './ficha-de-contacto';
import type { ContactoDeLaEmpresa } from '../../pharmacy-profile.types';

/**
 * La misma ficha sirve para el representante legal y para los tres gerentes, y
 * lo único que los distingue es qué datos trae cada uno. Estas pruebas fijan
 * eso: con celular se ofrece llamar, sin celular no queda una fila vacía.
 */
describe('FichaDeContacto', () => {
  let fixture: ComponentFixture<FichaDeContacto>;

  const GERENTE: ContactoDeLaEmpresa = {
    cargo: 'Gerente Comercial',
    nombre: 'Lucía Fernanda Roca Mendoza',
    celular: '+591 70011224',
    correo: 'comercial@farmaciaandina.bo',
  };

  function montar(contacto: ContactoDeLaEmpresa): HTMLElement {
    fixture = TestBed.createComponent(FichaDeContacto);
    fixture.componentRef.setInput('contacto', contacto);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => fixture.destroy());

  it('el encabezado es el cargo, y el nombre lo acompaña', () => {
    const root = montar(GERENTE);

    expect(root.querySelector('h3')?.textContent).toContain('Gerente Comercial');
    expect(root.textContent ?? '').toContain('Lucía Fernanda Roca Mendoza');
  });

  it('el correo se ofrece para escribirle, no como texto suelto', () => {
    const root = montar(GERENTE);

    const correo = root.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
    expect(correo?.getAttribute('href')).toBe('mailto:comercial@farmaciaandina.bo');
  });

  it('con celular se ofrece llamarlo, y el enlace marca lo que se lee', () => {
    const root = montar(GERENTE);

    const telefono = root.querySelector<HTMLAnchorElement>('a[href^="tel:"]');
    // El destino va sin espacios: `tel:` no los admite y el navegador que no
    // los tolera deja el enlace muerto.
    expect(telefono?.getAttribute('href')).toBe('tel:+59170011224');
    // Y el texto visible los conserva, que es como se lee un número acá.
    expect(telefono?.textContent?.trim()).toBe('+591 70011224');
    expect(root.textContent ?? '').toContain('Celular');
  });

  it('sin celular no queda una fila vacía: el dato no existe, no está en blanco', () => {
    const root = montar({ ...GERENTE, cargo: 'Representante legal', celular: null });

    expect(root.querySelector('a[href^="tel:"]')).toBeNull();
    expect(root.textContent ?? '').not.toContain('Celular');
  });
});
