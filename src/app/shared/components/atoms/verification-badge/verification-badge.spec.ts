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

  /** El pictograma con nombre: el elemento que lleva el rol. */
  function face(): HTMLElement | null {
    return host().querySelector<HTMLElement>('[role="img"]');
  }

  /** El control que se enfoca: un botón (con popover) o, sin foco, un span. */
  function trigger(): HTMLElement | null {
    return host().querySelector<HTMLElement>('.vb');
  }

  function popover(): HTMLElement | null {
    return host().querySelector<HTMLElement>('.vb-pop');
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  async function focusTrigger(): Promise<void> {
    trigger()?.dispatchEvent(new FocusEvent('focus'));
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

    it('IN_REVIEW pinta un reloj, no un sello, y dice «Verificación en proceso»', async () => {
      await setInputs({ status: 'IN_REVIEW' });
      expect(host().querySelector('.vb__disc')).not.toBeNull();
      expect(host().querySelector('.vb__glyph')).not.toBeNull();
      expect(face()?.getAttribute('aria-label')).toBe('Verificación en proceso');
      expect(trigger()?.classList.contains('vb--in-review')).toBe(true);
    });

    it('EXPIRED lleva su pictograma gris y su texto, sin ninguna marca de verificado', async () => {
      await setInputs({ status: 'EXPIRED', variant: 'label' });
      expect(host().textContent).toContain('Verificación vencida');
      expect(host().querySelector('.vb__disc')).not.toBeNull();
      expect(host().querySelector('.vb__check')).toBeNull();
    });

    it('UNVERIFIED nunca dibuja un glifo: en icono no hay nada, en label sólo texto', async () => {
      await setInputs({ status: 'UNVERIFIED', variant: 'icon' });
      expect(face()).toBeNull();
      expect(host().classList.contains('vb-host--hidden')).toBe(true);

      await setInputs({ status: 'UNVERIFIED', variant: 'label' });
      expect(host().querySelector('svg')).toBeNull();
      expect(host().textContent).toContain('No verificado');
    });

    it('una suspensión llega como UNVERIFIED; un SUSPENDED suelto se trata como desconocido: sin glifo ni texto de verificado', async () => {
      await setInputs({ status: 'SUSPENDED', variant: 'icon' });
      expect(face()).toBeNull();
      await setInputs({ status: 'SUSPENDED', variant: 'label' });
      expect(host().querySelector('svg')).toBeNull();
      expect(host().textContent).toContain('No verificado');
    });

    it('un estado desconocido, nulo o indefinido no pinta check ni icono', async () => {
      for (const status of ['RARO', '', null, undefined, 7]) {
        await setInputs({ status });
        expect(face(), String(status)).toBeNull();
        expect(host().querySelector('.vb__check'), String(status)).toBeNull();
      }
    });

    it('por omisión no pinta nada: nadie queda verificado por descuido', () => {
      expect(face()).toBeNull();
    });

    it('un VERIFIED con la vigencia vencida se pinta como vencido, no como verificado', async () => {
      await setInputs({ status: 'VERIFIED', validUntil: '2020-01-31', variant: 'label' });
      expect(host().querySelector('.vb__check')).toBeNull();
      expect(host().textContent).toContain('Verificación vencida');
      expect(face()?.getAttribute('aria-label')).toBe('Verificación vencida');

      await focusTrigger();
      expect(popover()?.textContent).toMatch(/vencida/);
      expect(popover()?.textContent).toMatch(/Venció el 31 de enero de 2020/);
    });

    it('un VERIFIED vigente sigue siendo VERIFIED', async () => {
      await setInputs({ status: 'VERIFIED', validUntil: '2099-01-31' });
      expect(host().querySelector('.vb__check')).not.toBeNull();
    });
  });

  describe('tamaños y variantes', () => {
    it('cada combinación aplica sus modificadores', async () => {
      for (const size of VERIFICATION_BADGE_SIZES) {
        for (const variant of VERIFICATION_BADGE_VARIANTS) {
          await setInputs({ status: 'VERIFIED', size, variant });
          const classes = trigger()?.classList;
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
      expect(trigger()?.classList.contains('vb--animated')).toBe(false);
      await setInputs({ animated: true });
      expect(trigger()?.classList.contains('vb--animated')).toBe(true);
    });
  });

  describe('accesibilidad', () => {
    it('role="img" con el nombre completo de cada estado', async () => {
      for (const status of ['VERIFIED', 'IN_REVIEW', 'EXPIRED'] as const) {
        await setInputs({ status });
        expect(face()?.getAttribute('aria-label')).toBe(VERIFICATION_COPY[status]!.name);
      }
      await setInputs({ status: 'VERIFIED' });
      expect(face()?.getAttribute('aria-label')).toBe('Profesional verificado');
    });

    it('el sujeto entra en el nombre accesible', async () => {
      await setInputs({ status: 'VERIFIED', subject: 'Dra. Ana Rojas' });
      expect(face()?.getAttribute('aria-label')).toBe('Dra. Ana Rojas, profesional verificado');
      await setInputs({ status: 'IN_REVIEW' });
      expect(face()?.getAttribute('aria-label')).toBe('Dra. Ana Rojas, verificación en proceso');
    });

    it('un sujeto vacío o de espacios se ignora', async () => {
      await setInputs({ status: 'VERIFIED', subject: '   ' });
      expect(face()?.getAttribute('aria-label')).toBe('Profesional verificado');
    });

    it('un nombre de 200 caracteres cabe entero; uno de 5000 se acota', async () => {
      const largo = 'A'.repeat(200);
      await setInputs({ status: 'VERIFIED', subject: largo });
      expect(face()?.getAttribute('aria-label')).toBe(`${largo}, profesional verificado`);

      await setInputs({ subject: 'B'.repeat(5000) });
      const label = face()?.getAttribute('aria-label') ?? '';
      expect(label.length).toBeLessThan(260);
      expect(label.startsWith('B'.repeat(199) + '…')).toBe(true);
      expect(face()).not.toBeNull();
    });

    it('el pictograma es decorativo para el lector: el nombre sale del aria-label', async () => {
      await setInputs({ status: 'VERIFIED' });
      const svg = host().querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.getAttribute('focusable')).toBe('false');
    });

    it('por omisión es un botón (foco de teclado) y con interactive=false un span sin tabstop', async () => {
      await setInputs({ status: 'VERIFIED' });
      expect(trigger()?.tagName).toBe('BUTTON');
      expect(trigger()?.getAttribute('type')).toBe('button');
      await setInputs({ interactive: false });
      expect(trigger()?.tagName).toBe('SPAN');
      expect(trigger()?.hasAttribute('tabindex')).toBe(false);
    });

    it('sin foco, el significado queda en title para el puntero', async () => {
      await setInputs({ status: 'VERIFIED', interactive: false });
      expect(trigger()?.getAttribute('title')).toContain(
        'Identidad y matrícula profesional comprobadas por AloVida',
      );
      await setInputs({ interactive: true });
      expect(trigger()?.hasAttribute('title')).toBe(false);
    });

    it('no tiene violaciones serias de axe en ningún estado, abierto ni cerrado', async () => {
      for (const status of ['VERIFIED', 'IN_REVIEW', 'EXPIRED', 'UNVERIFIED']) {
        for (const variant of ['icon', 'label']) {
          await setInputs({ status, variant, subject: 'Dra. Ana Rojas' });
          await expectNoSeriousViolations(host());
          await focusTrigger();
          await expectNoSeriousViolations(host());
          trigger()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }
      }
    });
  });

  describe('popover', () => {
    it('abre con el foco, dice qué significa y qué NO significa, y lo enlaza con aria-describedby', async () => {
      await setInputs({ status: 'VERIFIED' });
      await focusTrigger();
      expect(popover()?.getAttribute('role')).toBe('tooltip');
      expect(popover()?.textContent).toContain('Identidad y matrícula profesional comprobadas por AloVida');
      expect(popover()?.textContent).toContain('No es una recomendación clínica');
      expect(trigger()?.getAttribute('aria-describedby')).toBe(popover()?.id);
      expect(trigger()?.getAttribute('aria-expanded')).toBe('true');
    });

    it('se descarta con Esc desde el botón (WCAG 1.4.13)', async () => {
      await setInputs({ status: 'VERIFIED' });
      await focusTrigger();
      trigger()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();
      expect(popover()).toBeNull();
      expect(trigger()?.getAttribute('aria-expanded')).toBe('false');
    });

    it('se descarta con Esc también desde el propio popover', async () => {
      await setInputs({ status: 'VERIFIED' });
      await focusTrigger();
      popover()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();
      expect(popover()).toBeNull();
    });

    it('un clic lo fija: no se cierra al perder el foco ni al irse el puntero; otro clic lo cierra', async () => {
      await setInputs({ status: 'VERIFIED' });
      trigger()?.click();
      await fixture.whenStable();
      expect(popover()).not.toBeNull();

      trigger()?.dispatchEvent(new FocusEvent('blur'));
      trigger()?.dispatchEvent(new Event('pointerleave'));
      await new Promise((resolve) => setTimeout(resolve, 260));
      await fixture.whenStable();
      expect(popover()).not.toBeNull();

      trigger()?.click();
      await fixture.whenStable();
      expect(popover()).toBeNull();
    });

    it('es hoverable: entrar en el popover cancela el cierre; salir lo cierra', async () => {
      await setInputs({ status: 'VERIFIED' });
      await focusTrigger();
      trigger()?.dispatchEvent(new FocusEvent('blur'));
      trigger()?.dispatchEvent(new Event('pointerleave'));
      popover()?.dispatchEvent(new Event('pointerenter'));
      await new Promise((resolve) => setTimeout(resolve, 260));
      await fixture.whenStable();
      expect(popover()).not.toBeNull();

      popover()?.dispatchEvent(new Event('pointerleave'));
      await new Promise((resolve) => setTimeout(resolve, 260));
      await fixture.whenStable();
      expect(popover()).toBeNull();
    });

    it('un clic fuera lo cierra', async () => {
      await setInputs({ status: 'VERIFIED' });
      trigger()?.click();
      await fixture.whenStable();
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await fixture.whenStable();
      expect(popover()).toBeNull();
    });

    it('muestra fecha de verificación y vigencia sólo si vienen y son reales', async () => {
      await setInputs({ status: 'VERIFIED', verifiedAt: '2026-03-12', validUntil: '2099-03-12' });
      await focusTrigger();
      expect(popover()?.textContent).toMatch(/Verificación realizada el 12 de marzo de 2026/);
      expect(popover()?.textContent).toMatch(/Vigente hasta el 12 de marzo de 2099/);
    });

    it('no inventa fechas: nulas o inválidas no se muestran', async () => {
      await setInputs({ status: 'VERIFIED', verifiedAt: null, validUntil: 'nunca' });
      await focusTrigger();
      expect(popover()?.textContent).not.toMatch(/Verificación realizada|Vigente hasta/);
    });

    it('IN_REVIEW no muestra fechas', async () => {
      await setInputs({ status: 'IN_REVIEW', verifiedAt: '2026-03-12', validUntil: '2099-03-12' });
      await focusTrigger();
      expect(popover()?.textContent).not.toMatch(/2026|2099/);
    });

    it('interactive=false no abre ningún popover', async () => {
      await setInputs({ status: 'VERIFIED', interactive: false });
      trigger()?.dispatchEvent(new FocusEvent('focus'));
      await fixture.whenStable();
      expect(popover()).toBeNull();
    });

    it('al destruir el componente no deja temporizadores ni oyentes de documento', async () => {
      await setInputs({ status: 'VERIFIED' });
      await focusTrigger();
      fixture.destroy();
      expect(() => document.body.dispatchEvent(new Event('pointerdown'))).not.toThrow();
    });
  });
});
