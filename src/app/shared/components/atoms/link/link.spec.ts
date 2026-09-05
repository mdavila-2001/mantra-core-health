import { readFileSync } from 'node:fs';

import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Link } from './link';
import { LINK_VARIANTS, type LinkVariant } from './link.types';

const LINK_CSS = 'src/app/shared/components/atoms/link/link.css';

/** Host real: el selector es de atributo, el componente vive EN un <a>. */
@Component({
  imports: [Link],
  template: `
    <a app-link [href]="href()" [variant]="variant()" [external]="external()">Ver ficha</a>
  `,
})
class HostComponent {
  readonly href = signal('/pacientes/123');
  readonly variant = signal<LinkVariant>('default');
  readonly external = signal<boolean | undefined>(undefined);
}

/** `href` literal en el marcado: el caso que el servidor puede resolver. */
@Component({
  imports: [Link],
  template: `<a app-link href="https://www.who.int/es">Guía OMS</a>`,
})
class HostEstatico {}

describe('Link', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function ancla(): HTMLAnchorElement {
    const element = fixture.nativeElement.querySelector('a');
    if (!(element instanceof HTMLAnchorElement)) {
      throw new Error('el <a> host no está en el DOM');
    }
    return element;
  }

  async function conHref(href: string): Promise<void> {
    host.href.set(href);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('variantes', () => {
    it('cada variante genera su modificador BEM', async () => {
      for (const variant of LINK_VARIANTS) {
        host.variant.set(variant);
        await fixture.whenStable();

        expect([...ancla().classList].sort()).toEqual(['link', `link--${variant}`]);
      }
    });
  });

  describe('destino interno', () => {
    it('no abre pestaña nueva ni agrega rel', () => {
      expect(ancla().hasAttribute('target')).toBe(false);
      expect(ancla().hasAttribute('rel')).toBe(false);
    });

    it('no muestra el aviso de pestaña nueva', () => {
      expect(ancla().querySelector('.link__external-icon')).toBeNull();
      expect(ancla().textContent).not.toContain('pestaña nueva');
    });

    it('una URL absoluta del mismo origen sigue siendo interna', async () => {
      await conHref(`${window.location.origin}/agenda`);

      expect(ancla().hasAttribute('target')).toBe(false);
    });

    it('mailto y tel no son destinos externos: no abren pestaña', async () => {
      for (const href of ['mailto:mesa@alovida.salud.bo', 'tel:+59122000000']) {
        await conHref(href);
        expect(ancla().hasAttribute('target')).toBe(false);
      }
    });
  });

  describe('destino externo', () => {
    beforeEach(async () => {
      await conHref('https://www.who.int/es');
    });

    it('se detecta solo por el href', () => {
      expect(ancla().getAttribute('target')).toBe('_blank');
    });

    it('lleva rel="noopener noreferrer": la pestaña nueva no hereda la sesión', () => {
      expect(ancla().getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('lo dice en palabras, no solo con el ícono', () => {
      const aviso = ancla().querySelector('.sr-only');

      expect(aviso?.textContent?.trim()).toBe('(se abre en una pestaña nueva)');
      expect(ancla().querySelector('.link__external-icon')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
    });

    /**
     * Lo que garantiza que el HTML del SERVIDOR ya salga con `rel`: la marca no
     * puede depender de un hook de render, que en SSR no corre. Sin
     * `whenStable()` no hay hooks post-render — solo la primera detección.
     */
    it('un href estático sale marcado en el primer render, sin esperar hooks', async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostEstatico] }).compileComponents();

      const estatico = TestBed.createComponent(HostEstatico);
      estatico.detectChanges();

      const externo = estatico.nativeElement.querySelector('a') as HTMLAnchorElement;
      expect(externo.getAttribute('target')).toBe('_blank');
      expect(externo.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('`external` fuerza la decisión en los dos sentidos', async () => {
      host.external.set(false);
      await fixture.whenStable();
      expect(ancla().hasAttribute('target')).toBe(false);

      await conHref('/pacientes/123');
      host.external.set(true);
      await fixture.whenStable();

      expect(ancla().getAttribute('target')).toBe('_blank');
      expect(ancla().getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  describe('foco y color', () => {
    it('el ancla es enfocable con teclado', () => {
      ancla().focus();

      expect(document.activeElement).toBe(ancla());
    });

    /**
     * jsdom no resuelve el `box-shadow` de la regla global de `:focus-visible`,
     * así que se verifica lo que sí es verificable: que el sistema declara el
     * anillo una sola vez y que el enlace no lo pisa con `outline: none`.
     */
    it('no anula el anillo de foco del sistema', () => {
      const css = readFileSync(LINK_CSS, 'utf8');

      expect(css).not.toContain('outline: none');
      expect(readFileSync('src/styles.css', 'utf8')).toContain(':focus-visible');
    });

    it('el subrayado no depende del color: está declarado en el estado base', () => {
      const css = readFileSync(LINK_CSS, 'utf8');
      const base = css.slice(css.indexOf(':host {'), css.indexOf(':host(:hover)'));

      expect(base).toContain('text-decoration: underline');
    });
  });
});
