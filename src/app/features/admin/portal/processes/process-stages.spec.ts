import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Etapa } from '../../../../core/data-access/admin-portal/portal.types';
import { ProcessStages } from './process-stages';

/**
 * Las etapas de un proceso del portal: cada una numerada, con sus operaciones
 * (método, ruta enlazada, riesgo, quién actúa) y los efectos sobre tablas,
 * eventos y trabajos. Una tabla sin ficha en el catálogo se nombra sin enlace.
 */

const ETAPAS: readonly Etapa[] = [
  {
    codigo: 'E1',
    nombre: 'Alta del paciente',
    fuente: 'Registro de procesos §2.1',
    operaciones: [
      {
        operacionId: 'op-1',
        metodo: 'POST',
        ruta: '/profiles/patients',
        quienActua: 'Recepción',
        queHace: 'Crea el perfil',
        riesgo: 'ALTO',
        efectos: {
          tablas: [
            { tabla: 'profiles.patient', operacion: 'INSERT', detalle: '' },
            { tabla: 'externa.sin_ficha', operacion: 'UPDATE', detalle: '' },
          ],
          eventos: ['patient.created'],
          trabajos: ['send-welcome'],
        },
      },
    ],
  },
  { codigo: 'E2', nombre: 'Vacía', fuente: null, operaciones: [] },
] as unknown as readonly Etapa[];

describe('ProcessStages', () => {
  let fixture: ComponentFixture<ProcessStages>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function pintar(stages: readonly Etapa[]): void {
    fixture = TestBed.createComponent(ProcessStages);
    fixture.componentRef.setInput('stages', stages);
    fixture.componentRef.setInput('operationUrl', (id: string) => `/admin/portal/operaciones/${id}`);
    fixture.componentRef.setInput('tableUrl', (q: string) => (q.startsWith('profiles.') ? `/admin/portal/tablas/${q}` : null));
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('numera las etapas y muestra su fuente', () => {
    pintar(ETAPAS);
    const titulos = Array.from(root().querySelectorAll('.stages__title')).map((h) => h.textContent?.replace(/\s+/g, ' ').trim());
    expect(titulos).toEqual(['1 Alta del paciente', '2 Vacía']);
    expect(root().querySelector('.stages__source')?.textContent).toBe('Registro de procesos §2.1');
  });

  it('cada operación: método, ruta enlazada, riesgo, qué hace y quién actúa', () => {
    pintar(ETAPAS);
    const op = root().querySelector('.stages__operation')!;
    expect(op.textContent).toContain('POST');
    expect(op.querySelector('a.stages__route')?.getAttribute('href')).toBe('/admin/portal/operaciones/op-1');
    expect(op.textContent).toContain('Riesgo alto');
    expect(op.textContent).toContain('Crea el perfil');
    expect(op.textContent).toContain('Actúa: Recepción');
    expect(op.textContent).toContain('Eventos: patient.created');
    expect(op.textContent).toContain('Trabajos: send-welcome');
  });

  it('una tabla con ficha se enlaza; una sin ficha se nombra sin enlace', () => {
    pintar(ETAPAS);
    const efectos = Array.from(root().querySelectorAll('.stages__effect'));
    expect(efectos[0]!.querySelector('a')?.getAttribute('href')).toBe('/admin/portal/tablas/profiles.patient');
    expect(efectos[1]!.querySelector('a')).toBeNull();
    expect(efectos[1]!.textContent).toContain('externa.sin_ficha');
  });

  it('una etapa sin operaciones y un proceso sin etapas lo dicen', () => {
    pintar(ETAPAS);
    expect(root().textContent).toContain('Esta etapa no tiene operaciones.');
    pintar([]);
    expect(root().textContent).toContain('El inventario no describe etapas para este proceso.');
  });
});
