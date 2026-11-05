import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reiniciarElGobiernoDeAccesos } from '../../../core/mock/handlers/mock-reset';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../testing/governance-mock-backend';
import { elegir, escribir, pulsar } from '../../access-governance/simulator/simulator.fixtures';
import { MySupport } from './my-support';

/**
 * «Mis accesos» con el gobierno de accesos, contra el simulador de la API (`isolate: false`: cada prueba parte del piloto de
 * fábrica). Cada acción se demuestra pantalla → petición → respuesta → recarga → pantalla.
 */
describe('MySupport · gobierno de accesos', () => {
  let fixture: ComponentFixture<MySupport>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    for (let i = 0; i < 5; i += 1) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };
  const hechas = (): string[] => peticiones.map((p) => `${p.method} ${p.path} ${p.status}`);

  async function montar(cuenta: string): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideGovernanceMock(cuenta)],
    });
    fixture = TestBed.createComponent(MySupport);
    await settle();
    olvidarPeticiones();
  }

  beforeEach(() => {
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
  });
  afterEach(() => fixture?.destroy());

  describe('lo que puedo hacer y lo que se me pedirá', () => {
    it('cada organización dice las condiciones de mis permisos y qué pedirá al actuar', async () => {
      await montar('marcos');
      const condiciones = host().querySelector('[data-testid^="condiciones-"]')!;
      expect(condiciones.textContent).toContain('24 horas de anticipación');
      const obligaciones = host().querySelector('[data-testid^="obligaciones-"]')!;
      expect(obligaciones.textContent).toContain('Pide el motivo por escrito');
      expect(obligaciones.textContent).toContain('Cancelar citas');
    });

    it('quien no tiene condiciones ni obligaciones no ve esas secciones', async () => {
      await montar('lucia');
      expect(host().querySelector('[data-testid^="resumen-"]')).not.toBeNull();
      expect(
        host().querySelector('[data-testid^="condiciones-"]')?.textContent ?? '',
      ).not.toContain('24 horas');
    });
  });

  describe('«¿Por qué no puedo?»', () => {
    async function preguntar(accion: string, fecha: string, hora: string): Promise<void> {
      await elegir(host(), 'porque-accion', accion, settle);
      await elegir(host(), 'porque-doctor', 'Suárez', settle);
      await escribir(host(), 'porque-fecha', fecha, settle);
      await escribir(host(), 'porque-hora', hora, settle);
      await pulsar(host(), 'porque-enviar', settle);
    }

    it('pregunta con tres datos, muestra la explicación sin lo que solo ve el administrador y deja probar «¿y si…?»', async () => {
      await montar('marcos');
      await preguntar('Cancelar citas', '2026-11-03', '10:30');
      const explicar = peticiones.find((p) => p.path === '/me/support-access/explain')!;
      expect(explicar.status).toBe(200);
      expect(explicar.body).toMatchObject({ action: 'agenda.appointment.cancel' });
      expect((explicar.body as { tenantId: string }).tenantId).toBeTruthy();
      expect(byId('veredicto')!.getAttribute('data-efecto')).toBe('CHALLENGE');
      expect(byId('veredicto')!.textContent).toContain('faltan 6 horas');
      expect(byId('explicacion-pedir')!.textContent).toContain('Pida a su administrador');
      expect(byId('explicacion-arreglos')).toBeNull();
      // «¿Y si tuviera la aprobación?» y «¿si escribiera el motivo?»: vuelve a preguntar con assume, sin guardar nada.
      host()
        .querySelectorAll<HTMLElement>(
          '[data-testid="explicacion-ysi"] button[data-value="YES"]',
        )[2]!
        .click();
      await settle();
      host()
        .querySelectorAll<HTMLElement>(
          '[data-testid="explicacion-ysi"] button[data-value="YES"]',
        )[0]!
        .click();
      await settle();
      const llamadas = peticiones.filter((p) => p.path === '/me/support-access/explain');
      expect(llamadas.length).toBe(3);
      expect((llamadas[2]!.body as { assume: unknown }).assume).toEqual({
        approvalGranted: true,
        reasonProvided: true,
      });
      expect(byId('veredicto')!.getAttribute('data-efecto')).toBe('PERMIT');
      expect(hechas().filter((h) => !h.includes('/explain'))).toEqual([]);
    });

    it('una negación por horario se dice como negación y no inventa pasos que hacer', async () => {
      await montar('ana');
      await elegir(host(), 'porque-accion', 'Crear citas', settle);
      await escribir(host(), 'porque-fecha', '2026-11-08', settle);
      await escribir(host(), 'porque-hora', '22:00', settle);
      await pulsar(host(), 'porque-enviar', settle);
      expect(byId('veredicto')!.getAttribute('data-efecto')).toBe('DENY');
      expect(byId('explicacion-falta')).toBeNull();
    });

    it('sin elegir qué quiso hacer no pregunta', async () => {
      await montar('marcos');
      await pulsar(host(), 'porque-enviar', settle);
      expect(peticiones.filter((p) => p.path.includes('explain'))).toEqual([]);
      expect(host().textContent).toContain('Elija qué quiso hacer.');
    });
  });

  describe('mis pedidos de aprobación', () => {
    it('muestra lo que espera y permite retirarlo: petición, respuesta, recarga y lista nueva', async () => {
      await montar('marcos');
      const pendiente = host().querySelector(
        '[data-testid^="aprobacion-"][data-estado="PENDING"]',
      )!;
      expect(pendiente.textContent).toContain('Mateo Rivera');
      expect(pendiente.textContent).toContain('Espera la decisión');
      await pulsar(
        host(),
        pendiente.getAttribute('data-testid')!.replace('aprobacion-', 'aprobacion-retirar-'),
        settle,
      );
      expect(hechas()).toContain(
        `POST /me/support-approvals/${pendiente.getAttribute('data-testid')!.replace('aprobacion-', '')}/cancel 200`,
      );
      expect(hechas().filter((h) => h.startsWith('GET /me/support-approvals')).length).toBe(1);
      const despues = host().querySelector(
        `[data-testid="${pendiente.getAttribute('data-testid')!}"]`,
      )!;
      expect(despues.getAttribute('data-estado')).toBe('CANCELLED');
      expect(despues.textContent).toContain('Retirada');
      expect(despues.querySelector('button')).toBeNull();
    });

    it('quien no pidió nada lo lee en palabras', async () => {
      await montar('lucia');
      expect(byId('mis-aprobaciones')!.textContent).toContain('No tiene pedidos de aprobación.');
    });
  });
});
