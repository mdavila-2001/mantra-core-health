import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AccessExplainClient } from '../../../core/data-access/access-governance/access-explain.client';
import type {
  ExplainAccessResponse,
  ExplainMyAccessRequest,
} from '../../../core/data-access/access-governance/access-explain.types';
import { AccessWhyNot } from './why-not';

/**
 * «¿Por qué no puedo?»: le pregunta a la API (que es la autoridad) por qué una
 * acción está denegada y muestra el resumen, los pasos que la persona puede
 * dar y a quién pedirle. El front no decide nada: sólo cuenta lo que la API
 * explicó. Un fallo se dice sin dejar la pregunta colgada.
 */

const PREGUNTA: ExplainMyAccessRequest = {
  tenantId: 't-1',
  action: 'agenda.appointment.view',
  practitionerRoleAssignmentId: 'pra-1',
  careSpaceId: 'cs-1',
  appointmentStartAt: '2026-10-31T14:00:00Z',
} as ExplainMyAccessRequest;

const DENEGADO = {
  decision: { effect: 'DENY' },
  summary: 'No tiene asignado este consultorio.',
  missing: [{ message: 'Pida que lo asignen al consultorio 3.' }, { message: 'O use su propia agenda.' }],
  askAdmin: 'Lo resuelve la administración de la clínica.',
} as unknown as ExplainAccessResponse;

describe('AccessWhyNot', () => {
  let fixture: ComponentFixture<AccessWhyNot>;
  let explainMine: ReturnType<typeof vi.fn>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="por-que${id}"]`);

  function pintar(): void {
    fixture = TestBed.createComponent(AccessWhyNot);
    fixture.componentRef.setInput('request', PREGUNTA);
    fixture.detectChanges();
  }

  function preguntar(): void {
    q('-boton')!.click();
    fixture.detectChanges();
  }

  beforeEach(() => {
    explainMine = vi.fn(() => of(DENEGADO));
    TestBed.configureTestingModule({ providers: [{ provide: AccessExplainClient, useValue: { explainMine } }] });
  });

  it('cerrado: sólo el botón, sin preguntar todavía a la API', () => {
    pintar();
    expect(q('-boton')?.textContent?.trim()).toBe('¿Por qué no puedo?');
    expect(q('-boton')?.getAttribute('aria-expanded')).toBe('false');
    expect(q('-resumen')).toBeNull();
    expect(explainMine).not.toHaveBeenCalled();
  });

  it('pregunta con la acción y el contexto exactos, y muestra resumen, pasos y a quién pedir', () => {
    pintar();
    preguntar();

    expect(explainMine).toHaveBeenCalledWith(PREGUNTA);
    expect(q('-boton')?.getAttribute('aria-expanded')).toBe('true');
    expect(q('-resumen')?.textContent?.trim()).toBe('No tiene asignado este consultorio.');
    expect(Array.from(q('-pasos')!.querySelectorAll('li')).map((li) => li.textContent)).toEqual([
      'Pida que lo asignen al consultorio 3.',
      'O use su propia agenda.',
    ]);
    expect(q('-admin')?.textContent?.trim()).toBe('Lo resuelve la administración de la clínica.');
  });

  it('mientras la API piensa no repite la pregunta', () => {
    const pendiente = new Subject<ExplainAccessResponse>();
    explainMine.mockReturnValue(pendiente);
    pintar();
    preguntar();
    preguntar();

    expect(explainMine).toHaveBeenCalledTimes(1);
    expect(q('-boton')?.getAttribute('aria-disabled')).toBe('true');
    pendiente.next(DENEGADO);
    fixture.detectChanges();
    expect(q('-resumen')).not.toBeNull();
  });

  it('«Entendido» pliega la respuesta', () => {
    pintar();
    preguntar();
    q('-cerrar')!.click();
    fixture.detectChanges();
    expect(q('-resumen')).toBeNull();
  });

  it('un fallo de la API se dice como alerta, con el texto genérico si no trae motivo', () => {
    explainMine.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    pintar();
    preguntar();

    expect(q('-error')?.textContent).toContain('No pudimos explicarlo ahora.');
    expect(q('-resumen')).toBeNull();
  });

  it('el prefijo y la etiqueta son configurables', () => {
    fixture = TestBed.createComponent(AccessWhyNot);
    fixture.componentRef.setInput('request', PREGUNTA);
    fixture.componentRef.setInput('idPrefix', 'agenda');
    fixture.componentRef.setInput('label', '¿Por qué no lo veo?');
    fixture.detectChanges();
    expect(root().querySelector('[data-testid="agenda-boton"]')?.textContent?.trim()).toBe('¿Por qué no lo veo?');
  });
});
