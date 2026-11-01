import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { MapaFila, OperacionDetalle } from '../../../../core/data-access/admin-portal/portal.types';
import { loading, ready, unexpectedError } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { OperationResponses } from './operation-responses';

/**
 * Con qué puede responder una operación de la API y quién la llama. Cuenta
 * éxitos (< 400) y errores; las respuestas van en una tabla; y «quién la
 * llama» distingue «nadie la llama» de «no se pudo saber» (sin dato).
 */

function operacion(respuestas: OperacionDetalle['respuestasPosibles']): OperacionDetalle {
  return { respuesta: { httpCode: 201 }, respuestasPosibles: respuestas } as unknown as OperacionDetalle;
}

const RESPUESTAS = [
  { estado: 201, codigo: null, causas: [] },
  { estado: 404, codigo: 'NOT_FOUND', causas: ['no existe'] },
  { estado: 409, codigo: 'CONFLICT', causas: ['versión vieja', 'duplicado'] },
];

describe('OperationResponses', () => {
  let fixture: ComponentFixture<OperationResponses>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const llamadores = (): HTMLElement => root().querySelector('[data-testid="portal-operation-callers"]')!;

  function pintar(op: OperacionDetalle, mapRow: ViewState<MapaFila | null>): void {
    fixture = TestBed.createComponent(OperationResponses);
    fixture.componentRef.setInput('operation', op);
    fixture.componentRef.setInput('mapRow', mapRow);
    fixture.detectChanges();
  }

  it('dice el código de éxito declarado y cuenta éxitos y errores', () => {
    pintar(operacion(RESPUESTAS), ready(null));
    const resumen = root().querySelector('.responses__muted')!.textContent!.replace(/\s+/g, ' ');
    expect(resumen).toContain('Código declarado de éxito: 201');
    expect(resumen).toContain('1 respuesta de éxito');
    expect(resumen).toContain('2 respuestas de error');
    expect(root().querySelector('app-data-table')).not.toBeNull();
  });

  it('sin respuestas enumeradas lo dice', () => {
    pintar(operacion([]), ready(null));
    expect(root().textContent).toContain('El inventario no enumeró respuestas para esta operación.');
    expect(root().querySelector('app-data-table')).toBeNull();
  });

  it('quién la llama: lista de clientes, ninguno, o sin dato', () => {
    pintar(operacion([]), ready({ llamadaPor: ['AdmissionsClient', 'LabPortalClient'], autorizacion: 'f3.adt.read' } as unknown as MapaFila));
    expect(Array.from(llamadores().querySelectorAll('li')).map((li) => li.textContent?.trim())).toEqual(['AdmissionsClient', 'LabPortalClient']);
    expect(root().textContent).toContain('Autorización que anota el mapa: f3.adt.read');

    pintar(operacion([]), ready({ llamadaPor: [], autorizacion: '—' } as unknown as MapaFila));
    expect(llamadores().textContent).toContain('Ningún cliente del front la llama');

    pintar(operacion([]), ready(null));
    expect(llamadores().textContent).toContain('el mapa de rutas no trae una fila');
  });

  it('mientras consulta lo anuncia; si falla, dice que no se pudo', () => {
    pintar(operacion([]), loading());
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Consultando el mapa de rutas');

    pintar(operacion([]), unexpectedError('req-1'));
    expect(llamadores().textContent).toContain('no se pudo consultar el mapa de rutas');
  });
});
