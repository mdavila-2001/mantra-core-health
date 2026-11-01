import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { OperacionDetalle, TablaOperacion } from '../../../../core/data-access/admin-portal/portal.types';
import { OperationData } from './operation-data';

/**
 * Qué tablas toca una operación de la API, agrupadas por efecto (lee, escribe,
 * borra), con vía, fuente y confianza; los eventos que emite y los trabajos
 * que encola. Distingue «no toca tablas» (con el motivo del inventario) de
 * «sin dato» (nadie lo determinó).
 */

function fila(partial: Partial<TablaOperacion>): TablaOperacion {
  return {
    schema: 'clinical',
    tabla: 'encounter',
    operacion: 'LEE',
    detalle: '',
    confianza: 'ALTA',
    via: ['EncountersService.find'],
    fuente: 'encounters.service.ts:40',
    catalogada: true,
    ...partial,
  };
}

function operacion(partial: Partial<OperacionDetalle>): OperacionDetalle {
  return { datos: [], eventos: [], trabajos: [], noResuelto: [], sinTablas: null, ...partial } as unknown as OperacionDetalle;
}

describe('OperationData', () => {
  let fixture: ComponentFixture<OperationData>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);

  function pintar(op: OperacionDetalle): void {
    fixture = TestBed.createComponent(OperationData);
    fixture.componentRef.setInput('operation', op);
    fixture.componentRef.setInput('tableUrl', (s: string, t: string) => `/superadmin/portal/catalog/tables/${s}/${t}`);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('agrupa por efecto, cuenta tablas distintas y enlaza cada una a su ficha', () => {
    pintar(
      operacion({
        datos: [
          fila({}),
          fila({ operacion: 'ESCRIBE' }),
          fila({ schema: 'billing', tabla: 'charge', operacion: 'ESCRIBE', catalogada: false }),
        ],
      }),
    );
    expect(q('portal-operation-tables-count')?.textContent).toBe('2 tablas: 1 leída · 2 escritas · 0 borradas');
    expect(q('portal-operation-tables-LEE')?.querySelectorAll('li')).toHaveLength(1);
    const escritas = q('portal-operation-tables-ESCRIBE')!;
    expect(escritas.querySelectorAll('li.data__table')).toHaveLength(2);
    expect(escritas.querySelector('a')?.getAttribute('href')).toBe('/superadmin/portal/catalog/tables/clinical/encounter');
    expect(escritas.textContent).toContain('No está en el catálogo');
  });

  it('cada tabla dice por dónde se llega y dónde está el acceso', () => {
    pintar(operacion({ datos: [fila({})] }));
    const tabla = q('portal-operation-tables-LEE')!.querySelector('li')!;
    expect(tabla.textContent).toContain('EncountersService.find');
    expect(tabla.textContent).toContain('encounters.service.ts:40');
  });

  it('sin tablas: «no toca tablas» con su motivo, o «sin dato»', () => {
    pintar(operacion({ sinTablas: 'Sólo arma un token' }));
    expect(q('portal-operation-tables-empty')?.textContent).toContain('No toca tablas.');
    expect(q('portal-operation-tables-empty')?.textContent).toContain('Sólo arma un token');

    pintar(operacion({}));
    expect(q('portal-operation-tables-empty')?.textContent).toContain('Sin dato.');
  });

  it('eventos, trabajos y lo que el generador no pudo seguir', () => {
    pintar(operacion({ eventos: ['encounter.closed'], trabajos: [], noResuelto: ['this.repo[dynamic]()'] }));
    expect(root().textContent).toContain('encounter.closed');
    expect(root().textContent).toContain('Ninguno.');
    expect(root().textContent).toContain('Lo que el generador no pudo seguir');
    expect(root().textContent).toContain('this.repo[dynamic]()');
  });
});
