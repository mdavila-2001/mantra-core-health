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

  describe('el orden es el de entrada: ninguna se adelanta (D-01)', () => {
    it('conserva el orden en que llegaron: alfabetizar sería inventar criterio', async () => {
      await setInputs({
        especialidades: [
          especialidad('1', 'Traumatología'),
          especialidad('2', 'Cardiología'),
          especialidad('3', 'Pediatría'),
        ],
      });
      expect(nombres()).toEqual(['Traumatología', 'Cardiología', 'Pediatría']);
    });

    it('aunque el dato venga marcado como principal desde el contrato, no se adelanta', async () => {
      // El contrato todavía trae `isPrimary`: si alguien vuelve a pasarlo a la
      // rejilla con cualquier nombre, no tiene que adelantarla.
      const marcada = { ...especialidad('3', 'Pediatría'), principal: true } as SpecialtyBadgeItem;
      await setInputs({
        especialidades: [
          especialidad('1', 'Cardiología'),
          especialidad('2', 'Medicina interna'),
          marcada,
        ],
      });
      expect(nombres()).toEqual(['Cardiología', 'Medicina interna', 'Pediatría']);
    });

    it('NO muta el arreglo que recibe', async () => {
      const entrada = [especialidad('1', 'Cardiología'), especialidad('2', 'Pediatría')];
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

  it('pasa cada dato a su insignia: el estado, en el tono de todas', async () => {
    await setInputs({
      especialidades: [
        especialidad('1', 'Cardiología', {
          estado: 'Vigente',
          sello: 'approved',
        }),
      ],
    });
    const insignia = insignias()[0]!;
    expect(insignia.classList).toContain('tone--secondary');
    expect(insignia.querySelector('app-status-seal')).not.toBeNull();
    expect((insignia.textContent ?? '').replace(/\s+/g, ' ')).toContain('Vigente');
  });
});
