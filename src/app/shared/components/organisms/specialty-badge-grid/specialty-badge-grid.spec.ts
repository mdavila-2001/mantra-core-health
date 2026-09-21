import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { SpecialtyBadgeGrid } from './specialty-badge-grid';
import type { SpecialtyBadgeItem } from '../specialty-badge/specialty-badge.types';

function especialidad(
  id: string,
  nombre: string,
  extra: Partial<SpecialtyBadgeItem> = {},
): SpecialtyBadgeItem {
  return {
    id,
    nombre,
    principal: false,
    certificada: false,
    estado: '',
    sello: null,
    ...extra,
  };
}

describe('SpecialtyBadgeGrid', () => {
  let fixture: ComponentFixture<SpecialtyBadgeGrid>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function insignias(): HTMLElement[] {
    return [...host().querySelectorAll<HTMLElement>('app-specialty-badge')];
  }

  function nombres(): string[] {
    return insignias().map((i) =>
      (i.querySelector('.specialty-badge__nombre')?.textContent ?? '').trim(),
    );
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SpecialtyBadgeGrid] }).compileComponents();
    fixture = TestBed.createComponent(SpecialtyBadgeGrid);
    fixture.componentRef.setInput('especialidades', []);
    await fixture.whenStable();
  });

  it('dibuja una insignia por especialidad', async () => {
    await setInputs({
      especialidades: [
        especialidad('1', 'Cardiología'),
        especialidad('2', 'Medicina interna'),
        especialidad('3', 'Pediatría'),
      ],
    });
    expect(insignias()).toHaveLength(3);
  });

  it('sin especialidades no dibuja nada, y no inventa un vacío propio', async () => {
    await setInputs({ especialidades: [] });
    expect(insignias()).toHaveLength(0);
  });

  describe('el orden lo pone el componente', () => {
    it('la principal va primera aunque llegue última', async () => {
      await setInputs({
        especialidades: [
          especialidad('1', 'Cardiología'),
          especialidad('2', 'Medicina interna'),
          especialidad('3', 'Pediatría', { principal: true }),
        ],
      });
      expect(nombres()[0]).toBe('Pediatría');
    });

    it('el resto conserva el orden en que llegó: alfabetizar sería inventar criterio', async () => {
      await setInputs({
        especialidades: [
          especialidad('1', 'Traumatología'),
          especialidad('2', 'Cardiología'),
          especialidad('3', 'Pediatría', { principal: true }),
        ],
      });
      expect(nombres()).toEqual(['Pediatría', 'Traumatología', 'Cardiología']);
    });

    it('NO muta el arreglo que recibe', async () => {
      const entrada = [
        especialidad('1', 'Cardiología'),
        especialidad('2', 'Pediatría', { principal: true }),
      ];
      await setInputs({ especialidades: entrada });
      expect(entrada.map((e) => e.nombre)).toEqual(['Cardiología', 'Pediatría']);
    });
  });

  describe('se anuncia como lista', () => {
    it('es una lista de verdad, no divs: el lector puede decir cuántas son', async () => {
      await setInputs({ especialidades: [especialidad('1', 'Cardiología')] });
      expect(host().querySelector('ul')).not.toBeNull();
      expect(host().querySelectorAll('li')).toHaveLength(1);
    });

    it('lleva un nombre accesible, y se puede cambiar cuando hay más de un grid', async () => {
      await setInputs({ especialidades: [especialidad('1', 'Cardiología')] });
      expect(host().querySelector('ul')?.getAttribute('aria-label')).toBe('Especialidades');

      await setInputs({ etiqueta: 'Especialidades certificadas' });
      expect(host().querySelector('ul')?.getAttribute('aria-label')).toBe(
        'Especialidades certificadas',
      );
    });
  });

  it('pasa cada dato a su insignia: principal, certificada y estado', async () => {
    await setInputs({
      especialidades: [
        especialidad('1', 'Cardiología', {
          principal: true,
          certificada: true,
          estado: 'Vigente',
          sello: 'approved',
        }),
      ],
    });
    const insignia = insignias()[0]!;
    expect(insignia.classList).toContain('tone--primary');
    expect(insignia.querySelector('.specialty-badge__certificada')).not.toBeNull();
    expect(insignia.querySelector('app-status-seal')).not.toBeNull();
    expect((insignia.textContent ?? '').replace(/\s+/g, ' ')).toContain('Vigente');
  });
});
