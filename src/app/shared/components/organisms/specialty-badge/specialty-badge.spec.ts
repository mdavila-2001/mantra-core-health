import { readFileSync } from 'node:fs';

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

  describe('tonos: sólo dos, y del mapa compartido', () => {
    it('la principal toma el tono de marca', async () => {
      await setInputs({ principal: true });
      expect(host().classList).toContain('tone--primary');
    });

    it('el resto va en neutro, no en un color sorteado', async () => {
      await setInputs({ principal: false });
      expect(host().classList).toContain('tone--neutral');
    });

    it('no usa ningún otro tono del sistema', async () => {
      for (const principal of [true, false]) {
        await setInputs({ principal });
        const tonos = [...host().classList].filter((c) => c.startsWith('tone--'));
        expect(tonos).toHaveLength(1);
        expect(['tone--primary', 'tone--neutral']).toContain(tonos[0]);
      }
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

  describe('nada se dice sólo con color', () => {
    it('«principal» lleva la palabra, no sólo el tono', async () => {
      await setInputs({ principal: true });
      expect(texto()).toContain('Principal');
    });

    it('la que no es principal no la lleva', async () => {
      await setInputs({ principal: false });
      expect(texto()).not.toContain('Principal');
    });

    it('«certificada» lleva glifo y texto para quien no ve la pantalla', async () => {
      await setInputs({ certificada: true });
      const marca = host().querySelector('.specialty-badge__certificada');
      expect(marca?.querySelector('svg')).not.toBeNull();
      expect(marca?.querySelector('.sr-only')?.textContent).toContain('Certificada');
    });

    it('sin certificar no dibuja la marca', async () => {
      await setInputs({ certificada: false });
      expect(host().querySelector('.specialty-badge__certificada')).toBeNull();
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
