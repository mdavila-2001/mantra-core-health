import { readFileSync } from 'node:fs';

import { reflectComponentType } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { SpecialtyBadge } from './specialty-badge';

const BADGE_CSS = 'src/app/shared/components/organisms/specialty-badge/specialty-badge.css';

describe('SpecialtyBadge', () => {
  let fixture: ComponentFixture<SpecialtyBadge>;

  /** El selector es de elemento: el host ES la insignia. */
  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return (host().textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SpecialtyBadge] }).compileComponents();
    fixture = TestBed.createComponent(SpecialtyBadge);
    fixture.componentRef.setInput('especialidad', 'Cardiología');
    await fixture.whenStable();
  });

  describe('lo que muestra', () => {
    it('pinta el nombre que recibe', () => {
      expect(texto()).toContain('Cardiología');
    });

    it('monta el ícono del set de especialidades, no un glifo propio', () => {
      expect(host().querySelector('app-specialty-icon')).not.toBeNull();
    });

    it('el ícono no se anuncia: el nombre ya está escrito al lado', () => {
      const icono = host().querySelector('app-specialty-icon');
      expect(icono?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('tono: uno solo, igual para todas (D-01)', () => {
    /** Las combinaciones que podrían cambiar el tono o sumar una marca. */
    const VARIANTES: readonly Record<string, unknown>[] = [
      {},
      { estado: 'Verificada', sello: 'approved' },
      { estado: 'En revisión', sello: 'pending' },
    ];

    it('va en el secundario de marca, no en un color sorteado', () => {
      expect(host().classList).toContain('tone--secondary');
    });

    it('nunca en gris: el cliente pidió dejar de ver el neutro', async () => {
      for (const variante of VARIANTES) {
        await setInputs(variante);
        expect(host().classList).not.toContain('tone--neutral');
      }
    });

    it('un solo tono y siempre el mismo, sea cual sea la especialidad', async () => {
      for (const variante of VARIANTES) {
        await setInputs(variante);
        const tonos = [...host().classList].filter((c) => c.startsWith('tone--'));
        expect(tonos).toEqual(['tone--secondary']);
      }
    });

    it('ninguna se distingue como principal: la insignia no tiene con qué', async () => {
      const entradas = reflectComponentType(SpecialtyBadge)?.inputs.map((i) => i.propName);
      expect(entradas).not.toContain('principal');
      for (const variante of VARIANTES) {
        await setInputs(variante);
        expect(texto()).not.toMatch(/principal/i);
      }
    });

    it('tampoco se distingue la certificada: la insignia no tiene con qué (24/09/2026)', () => {
      const entradas = reflectComponentType(SpecialtyBadge)?.inputs.map((i) => i.propName);
      expect(entradas).not.toContain('certificada');
      // El único dibujo es el ícono de la especialidad: ninguna marca aparte.
      const fueraDelIcono = [...host().querySelectorAll('svg')].filter(
        (svg) => svg.closest('app-specialty-icon') === null,
      );
      expect(fueraDelIcono).toHaveLength(0);
    });

    it('no declara un solo color propio: todo entra por el mapa de tonos', () => {
      const css = readFileSync(BADGE_CSS, 'utf8');
      // Cualquier literal de color sería un valor que el tema oscuro no puede
      // cambiar. El único `#` legítimo sería ninguno.
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css).not.toMatch(/\b(rgb|hsl)a?\(/);
      expect(css).toContain("@import '../../tone/tone.css'");
    });
  });

  describe('el estado de la especialidad (una sola fuente visual: el átomo)', () => {
    it('se dibuja con la variante y el texto juntos, con la palabra del átomo', async () => {
      await setInputs({ sello: 'approved', estado: 'Certificada por el colegio' });
      expect(host().querySelector('app-verification-badge')).not.toBeNull();
      expect(host().querySelector('app-status-seal')).toBeNull();
      expect(texto()).toContain('Verificado');
    });

    it('en trámite se dice «En verificación», no «Verificado»', async () => {
      await setInputs({ sello: 'pending', estado: 'En revisión' });
      expect(texto()).toContain('En verificación');
      expect(host().querySelector('.vb__check')).toBeNull();
    });

    it('un rechazo sigue siendo el sello del trámite: no es una verificación', async () => {
      await setInputs({ sello: 'rejected', estado: 'Rechazada' });
      expect(host().querySelector('app-status-seal')).not.toBeNull();
      expect(host().querySelector('app-verification-badge')).toBeNull();
    });

    it('un estado que no se pudo leer no se inventa como «Verificado»', async () => {
      await setInputs({ sello: 'unknown', estado: 'Sin determinar' });
      expect(host().querySelector('app-verification-badge')).toBeNull();
      expect(host().querySelector('app-status-seal')).toBeNull();
    });

    it('con variante pero sin texto NO se dibuja: sería estado dicho por color', async () => {
      await setInputs({ sello: 'approved', estado: '   ' });
      expect(host().querySelector('app-status-seal')).toBeNull();
      expect(host().querySelector('app-verification-badge')).toBeNull();
    });

    it('con texto pero sin variante tampoco', async () => {
      await setInputs({ sello: null, estado: 'Vigente' });
      expect(host().querySelector('app-status-seal')).toBeNull();
      expect(host().querySelector('app-verification-badge')).toBeNull();
    });
  });
});
