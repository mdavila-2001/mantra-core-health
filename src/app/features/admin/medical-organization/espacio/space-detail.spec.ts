import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { idDeEspacio, SITIOS_INFRA } from '../../../../core/mock/fixtures/infraestructura';
import { TENANT_HOSPITAL } from '../../../../core/mock/mock-session';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { MaquetaDeInfraestructura } from '../../../../../testing/maqueta-de-infraestructura';
import { SpaceDetail } from './space-detail';

const SAN_LUCAS = SITIOS_INFRA[0]!;
const RUTA = '/administration/medical-organization/spaces';

/** La sesión de quien administra: el reflejo de permisos ofrece las acciones. */
function comoAdministrador(): void {
  const sesion = TestBed.inject(SessionStore);
  Object.defineProperty(sesion, 'roles', { value: signal(['SECURITY_ADMIN']) });
  Object.defineProperty(sesion, 'activeTenantId', { value: signal(TENANT_HOSPITAL) });
}

describe('SpaceDetail', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let maqueta: MaquetaDeInfraestructura;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administration/medical-organization/spaces/:id', component: SpaceDetail }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    maqueta = new MaquetaDeInfraestructura();
    comoAdministrador();
    harness = await RouterTestingHarness.create();
  });

  const raiz = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  async function esperar(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
      maqueta.responderTodo(http, () => harness.detectChanges());
      harness.detectChanges();
    }
  }

  async function abrir(code: string, query = ''): Promise<void> {
    await harness.navigateByUrl(`${RUTA}/${idDeEspacio(SAN_LUCAS, code)}${query}`, SpaceDetail);
    await esperar();
  }

  function boton(testId: string): HTMLButtonElement {
    const b = raiz().querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
    if (b === null) throw new Error(`sin botón ${testId}`);
    return b;
  }

  it('es UNA tarjeta con las cinco pestañas del contrato y la de Operación de F2', async () => {
    await abrir('301');
    const tarjetas = raiz().querySelectorAll('[data-testid=ficha-espacio]');
    expect(tarjetas).toHaveLength(1);
    const pestanas = Array.from(raiz().querySelectorAll('[role=tab]')).map((t) => t.textContent?.trim());
    expect(pestanas).toEqual(['General', 'Atributos técnicos', 'Unidades', 'Hijos', 'Historial', 'Operación']);
    expect(raiz().textContent).toContain('Habitación 301');
    expect(raiz().textContent).toContain('Edificio A › Pabellón Norte');
  });

  it('abre la pestaña de la URL: ?tab=children lista los hijos', async () => {
    await abrir('301', '?tab=children');
    const hijos = raiz().querySelector('[data-testid=ficha-hijos]')!;
    expect(hijos.textContent).toContain('Cama 301-A');
    expect(hijos.textContent).toContain('Cama 301-B');
  });

  it('retirar con dependencias muestra los bloqueos con su próxima acción y no pide motivo', async () => {
    const dialogs = TestBed.inject(DialogService);
    const motivo = vi.spyOn(dialogs, 'confirmWithReason');
    await abrir('IMG-TC');
    boton('ficha-ciclo-retire').click();
    await esperar();
    const lista = raiz().querySelector('[data-testid=ficha-bloqueos]')!;
    expect(lista.textContent).toContain('Citas futuras');
    expect(lista.textContent).toContain('Recurso de agenda vigente');
    expect(lista.textContent).toContain('Equipos instalados');
    expect(lista.querySelector('a')?.textContent).toContain('Reubicar las citas futuras');
    expect(motivo).not.toHaveBeenCalled();
    http.expectNone((r) => r.url.endsWith('/lifecycle'));
  });

  it('suspender pide motivo, manda If-Match y relee la ficha (UI → request → response → recarga)', async () => {
    const dialogs = TestBed.inject(DialogService);
    vi.spyOn(dialogs, 'confirmWithReason').mockResolvedValue('Recambio de piso vinílico');
    await abrir('CE-03');
    harness.detectChanges();
    boton('ficha-ciclo-suspend').click();
    await Promise.resolve();
    await Promise.resolve();
    const peticion = http.expectOne((r) => r.url.endsWith('/lifecycle'));
    expect(peticion.request.headers.get('If-Match')).toBe('1');
    expect(peticion.request.body).toEqual({ action: 'suspend', reason: 'Recambio de piso vinílico' });
    maqueta.responder(peticion);
    await esperar();
    expect(raiz().querySelector('[data-testid=ficha-estado]')?.textContent).toContain('Suspendido');
  });

  it('412: si otra persona cambió el espacio, lo dice y no pisa nada', async () => {
    const dialogs = TestBed.inject(DialogService);
    vi.spyOn(dialogs, 'confirm').mockResolvedValue(true);
    await abrir('304');
    boton('ficha-ciclo-activate').click();
    await Promise.resolve();
    await Promise.resolve();
    http
      .expectOne((r) => r.url.endsWith('/lifecycle'))
      .flush({ code: 'CONCURRENCY_CONFLICT', message: 'Otra persona modificó este espacio.' }, { status: 412, statusText: 'Precondition Failed' });
    harness.detectChanges();
    expect(raiz().querySelector('[data-testid=ficha-fallo]')?.textContent).toContain('Otra persona modificó');
  });

  it('S6: un espacio inexistente o de otro tenant no filtra existencia y ofrece volver', async () => {
    await harness.navigateByUrl(`${RUTA}/no-existe`, SpaceDetail);
    await esperar();
    expect(raiz().textContent).toContain('No encontramos lo que busca');
    expect(Array.from(raiz().querySelectorAll('a')).some((a) => a.textContent?.includes('Volver a la infraestructura'))).toBe(true);
  });

  it('sin permiso de escritura no ofrece editar ni el ciclo de vida', async () => {
    Object.defineProperty(TestBed.inject(SessionStore), 'roles', { value: signal(['PRACTITIONER']) });
    await abrir('301');
    expect(raiz().querySelector('[data-testid=ficha-editar]')).toBeNull();
    expect(raiz().querySelector('[data-testid=ficha-ciclo-retire]')).toBeNull();
  });

  it('el aviso de aislamiento sin validar sale del perfil de la función', async () => {
    await abrir('303');
    expect(raiz().textContent).not.toContain('No apto para aislamiento');
    expect(TestBed.inject(Router).url).toContain('/spaces/');
  });
});
