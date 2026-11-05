import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reiniciarElGobiernoDeAccesos } from '../../../core/mock/handlers/mock-reset';
import { uuid } from '../../../core/mock/mock-store';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { elegir, escribir, pulsar } from '../../access-governance/simulator/simulator.fixtures';
import { MyTeam } from './my-team';

/**
 * «Mi equipo» del doctor con el gobierno de accesos, contra el simulador de la API (`isolate: false`): lo que espera su decisión
 * y «¿Por qué pudo o no pudo…?» sobre su propia agenda. Cada acción se demuestra pantalla → petición → respuesta → pantalla.
 */
describe('MyTeam · gobierno de accesos', () => {
  let fixture: ComponentFixture<MyTeam>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 5; i += 1) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };

  async function montar(cuenta: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideGovernanceMock(cuenta)],
    });
    fixture = TestBed.createComponent(MyTeam);
    await settle();
    olvidarPeticiones();
  }

  const botonDePorQue = (): HTMLElement =>
    host().querySelector<HTMLElement>('[data-testid^="porque-miembro-"]')!;

  beforeEach(() => {
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
  });
  afterEach(() => fixture?.destroy());

  describe('lo que espera al doctor', () => {
    it('dice cuántas aprobaciones esperan su decisión y lleva a decidirlas', async () => {
      await montar('suarez');
      const aprobaciones = byId('atencion-aprobaciones')!;
      expect(aprobaciones.textContent).toContain('aprobación');
      expect(aprobaciones.querySelector('a')!.getAttribute('href')).toBe('/my-team/approvals');
      expect(byId('equipo-atencion')!.getAttribute('aria-live')).toBe('polite');
    });

    it('lo que no tiene pendiente se dice con todas las letras, sin botón que no lleva a nada', async () => {
      await montar('suarez');
      expect(byId('atencion-revisiones')!.textContent).toContain(
        'Ningún acceso de su equipo espera su revisión.',
      );
      expect(byId('atencion-revisiones')!.querySelector('a')).toBeNull();
    });
  });

  describe('«¿Por qué pudo o no pudo…?»', () => {
    it('abre la pregunta, la manda con su propia agenda y explica sin datos de otras agendas', async () => {
      await montar('suarez');
      await pulsar(host(), botonDePorQue().getAttribute('data-testid')!, settle);
      await elegir(host(), 'explicar-equipo-accion', 'Cancelar citas', settle);
      await escribir(host(), 'explicar-equipo-fecha', '2026-11-03', settle);
      await escribir(host(), 'explicar-equipo-hora', '10:30', settle);
      await pulsar(host(), 'explicar-equipo-enviar', settle);
      const llamada = peticiones.find((p) => p.path === '/me/practitioner/support-team/explain')!;
      expect(llamada.status).toBe(200);
      expect(llamada.body).toMatchObject({
        action: 'agenda.appointment.cancel',
        practitionerRoleAssignmentId: uuid('hp-doc-suarez'),
      });
      expect((llamada.body as { engagementId: string }).engagementId).toBeTruthy();
      expect(host().querySelector('[data-testid="veredicto"]')).not.toBeNull();
      expect(
        host().querySelector(
          '[data-testid="explicacion-pedir"], [data-testid="explicacion-arreglos"]',
        ),
      ).not.toBeNull();
    });
  });
});
