import { readFileSync } from 'node:fs';

import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FormSection } from './form-section';

const FORM_SECTION_CSS =
  'src/app/shared/components/organisms/form-section/form-section.css';

@Component({
  imports: [FormSection],
  template: `
    <app-form-section
      [legend]="legend()"
      [description]="description()"
      [collapsible]="collapsible()"
      [invalid]="invalido()"
      [(expanded)]="expanded"
    >
      <input class="campo" [attr.aria-invalid]="invalido()" />
    </app-form-section>
  `,
})
class HostComponent {
  readonly legend = signal('Datos de contacto');
  readonly description = signal('');
  readonly collapsible = signal(false);
  readonly expanded = signal(true);
  readonly invalido = signal(false);
}

describe('FormSection', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function toggle(): HTMLButtonElement | null {
    return root().querySelector('.form-section__toggle');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('semántica', () => {
    it('es un fieldset con legend real, no un div con role', () => {
      const fieldset = root().querySelector('fieldset');

      expect(fieldset).not.toBeNull();
      expect(fieldset?.querySelector('legend')?.textContent).toContain('Datos de contacto');
      expect(root().querySelector('div[role="group"]')).toBeNull();
    });

    it('sin descripción no declara aria-describedby', () => {
      expect(root().querySelector('fieldset')?.hasAttribute('aria-describedby')).toBe(false);
    });

    it('la descripción se enlaza al fieldset', async () => {
      host.description.set('Los usamos para avisos de turnos');
      await fixture.whenStable();

      const descrito = root().querySelector('fieldset')?.getAttribute('aria-describedby');
      const texto = root().querySelector(`#${descrito}`);
      expect(texto?.textContent?.trim()).toBe('Los usamos para avisos de turnos');
    });
  });

  describe('no plegable (default)', () => {
    it('no hay botón y el contenido está siempre', () => {
      expect(toggle()).toBeNull();
      expect(root().querySelector('.campo')).not.toBeNull();
    });
  });

  describe('plegable', () => {
    beforeEach(async () => {
      host.collapsible.set(true);
      await fixture.whenStable();
    });

    it('el botón declara qué controla y su estado', () => {
      expect(toggle()?.getAttribute('aria-expanded')).toBe('true');
      expect(toggle()?.getAttribute('aria-controls')).toBeTruthy();
    });

    it('al plegar, el contenido sale del DOM', async () => {
      toggle()?.click();
      await fixture.whenStable();

      expect(host.expanded()).toBe(false);
      expect(root().querySelector('.campo')).toBeNull();
    });
  });

  describe('regla dura: un error no se puede esconder', () => {
    it('con un control inválido, plegar no hace nada', async () => {
      host.collapsible.set(true);
      host.invalido.set(true);
      await fixture.whenStable();

      toggle()?.click();
      await fixture.whenStable();

      expect(host.expanded()).toBe(true);
      expect(root().querySelector('.campo')).not.toBeNull();
    });

    it('si la validación falla con la sección plegada, se despliega sola', async () => {
      host.collapsible.set(true);
      host.expanded.set(false);
      await fixture.whenStable();
      expect(root().querySelector('.campo')).toBeNull();

      // el formulario se envía y el FormGroup avisa que esta sección falló
      host.invalido.set(true);
      await fixture.whenStable();

      expect(host.expanded()).toBe(true);
      expect(root().querySelector('.campo')).not.toBeNull();
    });

    it('sin errores, plegar funciona normalmente', async () => {
      host.collapsible.set(true);
      host.invalido.set(false);
      await fixture.whenStable();

      toggle()?.click();
      await fixture.whenStable();

      expect(host.expanded()).toBe(false);
    });
  });

  describe('mobile-first', () => {
    it('una columna en la base, dos y tres a medida que la sección se ensancha, sin max-width', () => {
      // Mobile-first por el ancho de la SECCIÓN (container queries): dentro de
      // un diálogo angosto sigue en una columna. La tercera columna es la de
      // la regla del cliente (composition-rules §5), refactor UX.
      const css = readFileSync(FORM_SECTION_CSS, 'utf8');

      expect(css).not.toContain('max-width:');
      expect(css).toContain('container-type: inline-size');
      expect(css).toContain('@container (min-width: 36rem)');
      expect(css).toContain('@container (min-width: 60rem)');
      expect(css).toContain('repeat(3, minmax(0, 1fr))');

      const base = css.slice(0, css.indexOf('@container'));
      expect(base).toContain('grid-template-columns: 1fr');
    });
  });
});
