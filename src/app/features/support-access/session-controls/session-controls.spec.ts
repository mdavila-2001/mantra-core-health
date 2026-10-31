import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SessionPolicy } from '../../../core/data-access/support-access/support-access.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { SessionControls } from './session-controls';

const TODAS: SessionPolicy = { scope: 'ALL_ACCOUNTS', idleTimeoutMinutes: 15, newDeviceAlert: true, enforceIpRules: false, requireMfa: false };
const PERSONAL: SessionPolicy = { scope: 'ORG_STAFF', idleTimeoutMinutes: 10, newDeviceAlert: true, enforceIpRules: false, requireMfa: false };

interface Interno {
  cambiarInactividad(m: number | null): void;
  cambiarHorario(h: unknown): void;
  crearRegla(): void;
  elegirRol(c: string | null): void;
}

describe('SessionControls', () => {
  let fixture: ComponentFixture<SessionControls>;
  let getSessionPolicies: ReturnType<typeof vi.fn>;
  let putSessionPolicies: ReturnType<typeof vi.fn>;
  let confirmarCambios: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  /** `app-button` deshabilita con `aria-disabled`, no con el atributo nativo. */
  const apagado = (id: string): boolean => byId(id)!.getAttribute('aria-disabled') === 'true';
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const interno = (): Interno => fixture.componentInstance as unknown as Interno;
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const alternar = async (id: string): Promise<void> => {
    (byId(id)!.querySelector('input') as HTMLInputElement).click();
    await refrescar();
  };
  const clic = async (id: string): Promise<void> => {
    (byId(id) as HTMLElement).click();
    await refrescar();
  };
  const pestana = async (nombre: string): Promise<void> => {
    const tab = [...host().querySelectorAll('[role="tab"]')].find((t) => t.textContent?.includes(nombre)) as HTMLElement;
    tab.click();
    await refrescar();
  };

  async function abrir(politicas: readonly SessionPolicy[] = [TODAS, PERSONAL]): Promise<void> {
    getSessionPolicies = vi.fn(() => of({ policies: politicas }));
    putSessionPolicies = vi.fn((body: { policies: readonly SessionPolicy[] }) => of(body));
    confirmarCambios = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: SupportAccessClient, useValue: { getSessionPolicies, putSessionPolicies, getIpAccessRules: () => of({ rules: [] }), putIpAccessRules: vi.fn(() => of({ rules: [] })) } },
        { provide: DialogService, useValue: { confirmarCambios } },
      ],
    });
    fixture = TestBed.createComponent(SessionControls);
    fixture.detectChanges();
    await refrescar();
  }

  it('muestra los cinco controles de la regla de todas las cuentas, cada uno explicado y con su efecto', async () => {
    await abrir();
    for (const id of ['control-inactividad', 'control-dispositivo', 'control-horario', 'control-red', 'control-dos-pasos']) expect(byId(id)).not.toBeNull();
    expect(byId('efecto-idle')!.textContent).toContain('La sesión se cierra tras 15 minutos sin actividad.');
    expect(byId('efecto-mfa')!.textContent).toContain('Opcional');
    expect(byId('control-dos-pasos')!.textContent).toContain('Aunque alguien robe la contraseña');
    expect(host().textContent).not.toMatch(/\bMFA\b|\bTOTP\b/);
  });

  it('guardar arranca deshabilitado: sin cambios no hay nada que guardar', async () => {
    await abrir();
    expect(apagado('controles-guardar')).toBe(true);
    expect(apagado('controles-descartar')).toBe(true);
  });

  it('tocar un control cambia lo que dice, la vista previa y habilita guardar', async () => {
    await abrir();
    await alternar('control-mfa');
    expect(byId('efecto-mfa')!.textContent).toContain('Obligatoria');
    expect(byId('vista-reglas')!.textContent).toContain('Dos pasos');
    expect(byId('vista-reglas')!.textContent).toContain('Obligatoria');
    expect(apagado('controles-guardar')).toBe(false);
  });

  it('la vista previa prueba un día y una hora contra el horario', async () => {
    await abrir();
    interno().cambiarHorario({ days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' });
    await refrescar();
    // La prueba arranca en sábado a las 21:00.
    expect(byId('vista-prueba')!.textContent).toContain('No puede entrar');
    expect(byId('vista-prueba')!.textContent).toContain('fuera del horario laboral');
  });

  it('descartar vuelve a lo guardado', async () => {
    await abrir();
    await alternar('control-network');
    expect(byId('efecto-network')!.textContent).toContain('Solo se entra desde la red');
    await clic('controles-descartar');
    expect(byId('efecto-network')!.textContent).toContain('cualquier red');
  });

  it('guardar pide confirmación, manda las reglas y vuelve a leer lo guardado', async () => {
    await abrir();
    interno().cambiarInactividad(30);
    await refrescar();
    await clic('controles-guardar');
    expect(confirmarCambios).toHaveBeenCalledTimes(1);
    expect(putSessionPolicies).toHaveBeenCalledWith({ policies: [{ ...TODAS, idleTimeoutMinutes: 30 }, PERSONAL] });
    // UI → request → respuesta → se vuelve a leer.
    expect(getSessionPolicies).toHaveBeenCalledTimes(2);
  });

  it('si cancela la confirmación no se guarda nada', async () => {
    await abrir();
    interno().cambiarInactividad(30);
    await refrescar();
    confirmarCambios.mockResolvedValueOnce(false);
    await clic('controles-guardar');
    expect(putSessionPolicies).not.toHaveBeenCalled();
    expect(byId('efecto-idle')!.textContent).toContain('30 minutos');
  });

  it('si la API rechaza, lo dice y no pierde lo editado', async () => {
    await abrir();
    putSessionPolicies.mockReturnValueOnce(throwError(() => new Error('x')));
    interno().cambiarInactividad(30);
    await refrescar();
    await clic('controles-guardar');
    expect(byId('controles-error')).not.toBeNull();
    expect(byId('efecto-idle')!.textContent).toContain('30 minutos');
  });

  describe('lo que la API rechaza al guardar (422 con details.reason)', () => {
    const rechazo = (reason: string, extra: Record<string, unknown> = {}): HttpErrorResponse =>
      new HttpErrorResponse({ status: 422, error: { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'x', details: { reason, ...extra }, timestamp: '', path: '/org/session-policies' } });

    async function intentar(fallo: HttpErrorResponse): Promise<string> {
      await abrir();
      putSessionPolicies.mockReturnValueOnce(throwError(() => fallo));
      interno().cambiarInactividad(30);
      await refrescar();
      await clic('controles-guardar');
      return byId('controles-error')!.textContent!;
    }

    it('un horario de menos de 4 horas: dice el mínimo y no pierde lo editado', async () => {
      const texto = await intentar(rechazo('SESSION_POLICY_HOURS_TOO_SHORT', { minimumMinutes: 240 }));
      expect(texto).toContain('al menos 4 horas');
      expect(byId('efecto-idle')!.textContent).toContain('30 minutos');
    });

    it('un horario sin horas: pide distinguir la hora de inicio de la de fin', async () => {
      expect(await intentar(rechazo('SESSION_POLICY_HOURS_EMPTY'))).toContain('no admite a nadie');
    });

    it('un horario que dejaría afuera a quien guarda: lo dice con la hora en que está trabajando', async () => {
      expect(await intentar(rechazo('SESSION_POLICY_WOULD_LOCK_OUT_ACTOR'))).toContain('quedaría fuera de su propia organización');
    });

    it('redes exigidas que dejarían afuera a quien guarda: manda a revisar las redes', async () => {
      expect(await intentar(rechazo('IP_RULES_WOULD_LOCK_OUT_ACTOR'))).toContain('Revise las redes de la organización');
    });

    it('un corte de red no se hace pasar por un rechazo de la API', async () => {
      expect(await intentar(new HttpErrorResponse({ status: 0 }))).toContain('No pudimos conectarnos');
    });
  });

  it('el personal sin regla propia ofrece crearla; crearla muestra sus controles', async () => {
    await abrir([TODAS]);
    await pestana('Personal de la organización');
    expect(byId('controles-sin-regla')).not.toBeNull();
    await clic('controles-crear-regla');
    expect(byId('control-inactividad')).not.toBeNull();
    expect(apagado('controles-guardar')).toBe(false);
  });

  it('al personal le rigen las dos reglas y se queda con lo más estricto', async () => {
    await abrir();
    await pestana('Personal de la organización');
    expect(byId('controles-vista-previa')!.textContent).toContain('Personal de la organización');
    expect(byId('vista-reglas')!.textContent).toContain('10 minutos');
  });

  it('por rol: elegir un rol y crear su regla', async () => {
    await abrir();
    await pestana('Por rol');
    interno().elegirRol('SECURITY_ADMIN');
    await refrescar();
    expect(byId('controles-sin-regla')).not.toBeNull();
    await clic('controles-crear-regla');
    expect(byId('controles-vista-previa')!.textContent).toContain('Rol: Administración de seguridad');
  });

  it('quitar una regla la saca de lo que se guarda', async () => {
    await abrir();
    await pestana('Personal de la organización');
    await clic('controles-quitar-regla');
    await clic('controles-guardar');
    expect(putSessionPolicies).toHaveBeenCalledWith({ policies: [TODAS] });
  });

  it('un horario sin ninguna hora habilitada impide guardar y dice por qué', async () => {
    await abrir();
    interno().cambiarHorario({ days: [1], from: '08:00', to: '08:00' });
    await refrescar();
    expect(byId('controles-problemas')!.textContent).toContain('no admite a nadie');
    expect(apagado('controles-guardar')).toBe(true);
  });
});
