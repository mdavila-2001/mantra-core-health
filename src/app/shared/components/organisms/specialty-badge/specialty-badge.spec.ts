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

  describe('el sello del estado', () => {
    it('se dibuja con la variante y el texto juntos', async () => {
      await setInputs({ sello: 'approved', estado: 'Certificada por el colegio' });
      const sello = host().querySelector('app-status-seal');
      expect(sello).not.toBeNull();
      expect(texto()).toContain('Certificada por el colegio');
    });

    it('con variante pero sin texto NO se dibuja: sería estado dicho por color', async () => {
      await setInputs({ sello: 'approved', estado: '   ' });
      expect(host().querySelector('app-status-seal')).toBeNull();
    });

    it('con texto pero sin variante tampoco', async () => {
      await setInputs({ sello: null, estado: 'Vigente' });
      expect(host().querySelector('app-status-seal')).toBeNull();
    });
  });
});
