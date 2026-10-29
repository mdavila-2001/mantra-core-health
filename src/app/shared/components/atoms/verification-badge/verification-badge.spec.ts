import { PLATFORM_ID } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { expectNoSeriousViolations } from '../../../../../testing/a11y';
import { VerificationBadge } from './verification-badge';
import {
  VERIFICATION_BADGE_SIZES,
  VERIFICATION_BADGE_VARIANTS,
  VERIFICATION_COPY,
} from './verification-badge.types';

describe('VerificationBadge', () => {
  let fixture: ComponentFixture<VerificationBadge>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** El elemento que lleva el rol: el pictograma ES la información. */
  function badge(): HTMLElement | null {
    return host().querySelector<HTMLElement>('[role="img"]');
  }

  function globe(): HTMLElement | null {
    return document.body.querySelector('app-tooltip-panel');
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerificationBadge],
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    }).compileComponents();
    fixture = TestBed.createComponent(VerificationBadge);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    document.body.querySelectorAll('app-tooltip-panel').forEach((node) => node.remove());
  });

  describe('estados', () => {
    it('VERIFIED pinta el sello con su tilde y es el único que lo hace', async () => {
      await setInputs({ status: 'VERIFIED' });
      expect(host().querySelector('.vb__seal')).not.toBeNull();
      expect(host().querySelector('.vb__check')).not.toBeNull();

      for (const status of ['IN_REVIEW', 'SUSPENDED', 'EXPIRED', 'UNVERIFIED', 'NO_EXISTE']) {
        await setInputs({ status, variant: 'label' });
        expect(host().querySelector('.vb__check'), status).toBeNull();
        expect(host().querySelector('.vb__seal'), status).toBeNull();
      }
    });

    it('IN_REVIEW pinta un reloj, no un check, y dice «Verificación en proceso»', async () => {
      await setInputs({ status: 'IN_REVIEW' });
      expect(host().querySelector('.vb__disc')).not.toBeNull();
      expect(host().querySelector('.vb__glyph')).not.toBeNull();
      expect(badge()?.getAttribute('aria-label')).toBe('Verificación en proceso');
      expect(badge()?.classList.contains('vb--in-review')).toBe(true);
    });

    it('SUSPENDED y EXPIRED llevan su texto y ninguna marca de verificado', async () => {
      await setInputs({ status: 'SUSPENDED', variant: 'label' });
      expect(host().textContent).toContain('Verificación suspendida');
      await setInputs({ status: 'EXPIRED', variant: 'label' });
      expect(host().textContent).toContain('Verificación vencida');
      expect(host().querySelector('.vb__check')).toBeNull();
    });

    it('UNVERIFIED en variante icono no pinta nada y oculta el host', async () => {
      await setInputs({ status: 'UNVERIFIED' });
      expect(badge()).toBeNull();
      expect(host().classList.contains('vb-host--hidden')).toBe(true);
    });

    it('UNVERIFIED en variante label dice «No verificado» sin check', async () => {
      await setInputs({ status: 'UNVERIFIED', variant: 'label' });
      expect(host().textContent).toContain('No verificado');
      expect(host().querySelector('.vb__check')).toBeNull();
      expect(host().classList.contains('vb-host--hidden')).toBe(false);
    });

    it('un estado desconocido, nulo o indefinido no pinta check ni icono', async () => {
      for (const status of ['RARO', '', null, undefined, 7]) {
        await setInputs({ status });
        expect(badge(), String(status)).toBeNull();
        expect(host().querySelector('.vb__check'), String(status)).toBeNull();
      }
    });

    it('por omisión no pinta nada: nadie queda verificado por descuido', () => {
      expect(badge()).toBeNull();
    });
  });

  describe('tamaños y variantes', () => {
    it('cada combinación aplica sus modificadores', async () => {
      for (const size of VERIFICATION_BADGE_SIZES) {
        for (const variant of VERIFICATION_BADGE_VARIANTS) {
          await setInputs({ status: 'VERIFIED', size, variant });
          const classes = badge()?.classList;
          expect(classes?.contains(`vb--${size}`), `${size}/${variant}`).toBe(true);
          expect(classes?.contains(`vb--${variant}`), `${size}/${variant}`).toBe(true);
        }
      }
    });

    it('la variante icono no tiene texto visible y la label sí', async () => {
      await setInputs({ status: 'VERIFIED', variant: 'icon' });
      expect(host().querySelector('.vb__text')).toBeNull();
      await setInputs({ variant: 'label' });
      expect(host().querySelector('.vb__text')?.textContent).toBe('Verificado');
    });

    it('la animación es opt-in', async () => {
      await setInputs({ status: 'VERIFIED' });
      expect(badge()?.classList.contains('vb--animated')).toBe(false);
      await setInputs({ animated: true });
      expect(badge()?.classList.contains('vb--animated')).toBe(true);
    });
  });

  describe('accesibilidad', () => {
    it('role="img" con el nombre completo de cada estado', async () => {
      for (const status of ['VERIFIED', 'IN_REVIEW', 'SUSPENDED', 'EXPIRED'] as const) {
        await setInputs({ status });
        expect(badge()?.getAttribute('aria-label')).toBe(VERIFICATION_COPY[status]!.name);
      }
      await setInputs({ status: 'VERIFIED' });
      expect(badge()?.getAttribute('aria-label')).toBe('Profesional verificado');
    });

    it('el sujeto entra en el nombre accesible', async () => {
      await setInputs({ status: 'VERIFIED', subject: 'Dra. Ana Rojas' });
      expect(badge()?.getAttribute('aria-label')).toBe('Dra. Ana Rojas, profesional verificado');
      await setInputs({ status: 'IN_REVIEW' });
      expect(badge()?.getAttribute('aria-label')).toBe('Dra. Ana Rojas, verificación en proceso');
    });

    it('un sujeto vacío o de espacios se ignora', async () => {
      await setInputs({ status: 'VERIFIED', subject: '   ' });
      expect(badge()?.getAttribute('aria-label')).toBe('Profesional verificado');
    });

    it('un nombre de 200 caracteres cabe entero; uno de 5000 se acota', async () => {
      const largo = 'A'.repeat(200);
      await setInputs({ status: 'VERIFIED', subject: largo });
      expect(badge()?.getAttribute('aria-label')).toBe(`${largo}, profesional verificado`);

      await setInputs({ subject: 'B'.repeat(5000) });
      const label = badge()?.getAttribute('aria-label') ?? '';
      expect(label.length).toBeLessThan(260);
      expect(label.startsWith('B'.repeat(199) + '…')).toBe(true);
      expect(badge()).not.toBeNull();
    });

    it('el pictograma es decorativo para el lector: el nombre sale del aria-label', async () => {
      await setInputs({ status: 'VERIFIED' });
      const svg = host().querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('focusable')).toBe('false');
    });

    it('es enfocable con teclado por omisión y deja de serlo con interactive=false', async () => {
      await setInputs({ status: 'VERIFIED' });
      expect(badge()?.tabIndex).toBe(0);
      await setInputs({ interactive: false });
      expect(badge()?.hasAttribute('tabindex')).toBe(false);
    });

    it('sin foco, el significado queda en title para el puntero', async () => {
      await setInputs({ status: 'VERIFIED', interactive: false });
      expect(badge()?.getAttribute('title')).toContain(
        'Identidad y matrícula profesional comprobadas por AloVida',
      );
      await setInputs({ interactive: true });
      expect(badge()?.hasAttribute('title')).toBe(false);
    });

    it('no tiene violaciones serias de axe en ningún estado', async () => {
      for (const status of ['VERIFIED', 'IN_REVIEW', 'SUSPENDED', 'EXPIRED', 'UNVERIFIED']) {
        for (const variant of ['icon', 'label']) {
          await setInputs({ status, variant, subject: 'Dra. Ana Rojas' });
          await expectNoSeriousViolations(host());
        }
      }
    });
  });

  describe('tooltip', () => {
    async function focusBadge(): Promise<void> {
      badge()?.dispatchEvent(new FocusEvent('focus'));
      await fixture.whenStable();
    }

    it('abre con el foco, dice qué significa y se cierra con Escape', async () => {
      await setInputs({ status: 'VERIFIED' });
      await focusBadge();
      expect(globe()?.getAttribute('role')).toBe('tooltip');
      expect(globe()?.textContent).toContain('Identidad y matrícula profesional comprobadas por AloVida.');
      expect(badge()?.getAttribute('aria-describedby')).toBe(globe()?.id);

      badge()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(globe()).toBeNull();
    });

    it('muestra fecha de verificación y vigencia sólo si vienen y son reales', async () => {
      await setInputs({ status: 'VERIFIED', verifiedAt: '2026-03-12', validUntil: '2027-03-12' });
      await focusBadge();
      expect(globe()?.textContent).toMatch(/Verificación realizada el 12 de marzo de 2026/);
      expect(globe()?.textContent).toMatch(/Vigente hasta el 12 de marzo de 2027/);
    });

    it('no inventa fechas: nulas o inválidas no se muestran', async () => {
      await setInputs({ status: 'VERIFIED', verifiedAt: null, validUntil: 'nunca' });
      await focusBadge();
      expect(globe()?.textContent).not.toMatch(/Verificación realizada|Vigente hasta/);
    });

    it('EXPIRED dice cuándo venció; IN_REVIEW no muestra fechas', async () => {
      await setInputs({ status: 'EXPIRED', validUntil: '2026-01-05' });
      await focusBadge();
      expect(globe()?.textContent).toMatch(/Venció el 5 de enero de 2026/);

      badge()?.dispatchEvent(new FocusEvent('blur'));
      await setInputs({ status: 'IN_REVIEW', verifiedAt: '2026-03-12', validUntil: '2027-03-12' });
      await focusBadge();
      expect(globe()?.textContent).not.toMatch(/2026|2027/);
    });

    it('interactive=false no abre ningún globo', async () => {
      await setInputs({ status: 'VERIFIED', interactive: false });
      await focusBadge();
      expect(globe()).toBeNull();
    });
  });
});
