import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { StatusSeal } from './status-seal';
import { STATUS_SEAL_VARIANTS, type StatusSealVariant } from './status-seal.types';

/** El tono que cada variante debe enganchar en `tone.css`. */
const TONO_ESPERADO: Readonly<Record<(typeof STATUS_SEAL_VARIANTS)[number], string>> = {
  pending: 'warning',
  'in-review': 'warning',
  approved: 'success',
  rejected: 'error',
  expired: 'info',
};

@Component({
  imports: [StatusSeal],
  template: `
    <app-status-seal variant="approved" label="Aprobado">Emitido el 12/07/2026</app-status-seal>
  `,
})
class ConDetalle {}

describe('StatusSeal', () => {
  let fixture: ComponentFixture<StatusSeal>;

  /** El selector es de elemento: el host ES el sello. */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function icono(): SVGElement | null {
    return host().querySelector('.status-seal__icon svg');
  }

  async function setVariant(variant: StatusSealVariant): Promise<void> {
    fixture.componentRef.setInput('variant', variant);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StatusSeal] }).compileComponents();
    fixture = TestBed.createComponent(StatusSeal);
    // `label` es obligatorio: sin él la plantilla no puede renderizar.
    fixture.componentRef.setInput('label', 'Estado del caso');
    await fixture.whenStable();
  });

  describe('variantes', () => {
    it('cada variante engancha su tono en el host', async () => {
      for (const variant of STATUS_SEAL_VARIANTS) {
        await setVariant(variant);
        expect(host().classList.contains('status-seal')).toBe(true);
        // el color no lo pone el sello: lo resuelve `tone.css`
        expect(host().classList.contains(`tone--${TONO_ESPERADO[variant]}`)).toBe(true);
      }
    });

    it('el label queda renderizado en toda variante', async () => {
      for (const variant of STATUS_SEAL_VARIANTS) {
        await setVariant(variant);
        expect((host().textContent ?? '').trim()).toContain('Estado del caso');
      }
    });

    it('cada variante dibuja un ícono, y las formas son todas distintas', async () => {
      const formas = new Set<string>();
      for (const variant of [...STATUS_SEAL_VARIANTS, 'unknown' as const]) {
        await setVariant(variant);
        const svg = icono();
        expect(svg).not.toBeNull();
        formas.add(svg?.innerHTML ?? '');
      }
      // la forma también porta significado: seis variantes, seis dibujos
      expect(formas.size).toBe(STATUS_SEAL_VARIANTS.length + 1);
    });
  });

  describe('fallback', () => {
    it('sin variante cae en unknown → tono neutral', () => {
      expect(host().classList.contains('tone--neutral')).toBe(true);
    });
  });

  describe('accesibilidad', () => {
    it('no expone role: es un sello estático, la pantalla ya anuncia', () => {
      expect(host().hasAttribute('role')).toBe(false);
    });

    it('el ícono es decorativo: aria-hidden en el wrapper y focusable=false en el svg', () => {
      const wrapper = host().querySelector('.status-seal__icon');
      expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
      expect(icono()?.getAttribute('focusable')).toBe('false');
    });
  });

  describe('detalle proyectado', () => {
    it('el contenido proyectado aparece en el elemento del detalle', async () => {
      const conDetalle = TestBed.createComponent(ConDetalle);
      await conDetalle.whenStable();

      const detalle = (conDetalle.nativeElement as HTMLElement).querySelector(
        '.status-seal__detail',
      );
      expect(detalle?.textContent).toContain('Emitido el 12/07/2026');
    });
  });
});
