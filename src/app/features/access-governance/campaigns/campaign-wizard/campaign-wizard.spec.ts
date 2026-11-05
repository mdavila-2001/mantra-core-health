import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AccessReviewsClient } from '../../../../core/data-access/access-governance/access-reviews.client';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import {
  campanas,
  itemsDeRevision,
} from '../../../../core/mock/fixtures/support-hospital-governance';
import { reiniciarElGobiernoDeAccesos } from '../../../../core/mock/handlers/mock-reset';
import { chooseSelectOption } from '../../../../../testing/select';
import {
  olvidarPeticiones,
  peticiones,
  provideGovernanceMock,
} from '../../../../../testing/governance-mock-backend';
import { CampaignWizard } from './campaign-wizard';

const RUTAS = [
  { path: 'administration/access-governance/campaigns/new', component: CampaignWizard },
  { path: 'administration/access-governance/campaigns/:campaignId', component: CampaignWizard },
];

describe('CampaignWizard', () => {
  let fixture: ComponentFixture<CampaignWizard>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const texto = (id: string): string => byId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const refrescar = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  const clic = async (id: string): Promise<void> => {
    const el = byId(id);
    if (el === null) throw new Error(`No existe ${id}`);
    (el.matches('input,button,a')
      ? el
      : (el.querySelector('input,button,a') as HTMLElement)
    ).click();
    await refrescar();
  };
  const escribir = async (id: string, valor: string): Promise<void> => {
    const el = byId(id) as HTMLElement;
    const campo = (
      el.matches('input,textarea') ? el : el.querySelector('input,textarea')
    ) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await refrescar();
  };
  const elegir = async (id: string, opcion: string): Promise<void> => {
    await chooseSelectOption(fixture, byId(id)!, opcion);
    await refrescar();
  };
  const paso = (): string => texto('asistente-paso');

  async function abrir(proveedores: unknown[]): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideRouter(RUTAS), ...(proveedores as never[])],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/administration/access-governance/campaigns/new', CampaignWizard);
    fixture = harness.fixture as unknown as ComponentFixture<CampaignWizard>;
    await refrescar();
  }
  async function conNombre(nombre: string): Promise<void> {
    await escribir('campana-nombre', nombre);
  }
  async function hastaElPaso4(nombre = 'Certificación 2027'): Promise<void> {
    await conNombre(nombre);
    await clic('asistente-siguiente');
    await clic('asistente-siguiente');
    await clic('asistente-siguiente');
  }

  beforeEach(() => {
    reiniciarElGobiernoDeAccesos();
    olvidarPeticiones();
  });

  it('empieza en el paso 1 de 4 y no deja avanzar sin un nombre: el error está junto al campo y el paso no cambia', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    expect(host().textContent).toContain('Nueva campaña de certificación');
    expect(paso()).toContain('Paso 1 de 4');
    await clic('asistente-siguiente');
    expect(texto('campana-error-name')).toContain('Escriba un nombre de al menos 3 caracteres');
    expect(paso()).toContain('Paso 1 de 4');
    expect(peticiones.filter((p) => p.method === 'POST')).toEqual([]);
  });

  it('lleva el foco al campo con el problema y, al avanzar, al título del paso', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await clic('asistente-siguiente');
    const nombre = byId('campana-nombre')!;
    expect(document.activeElement).toBe(
      nombre.matches('input') ? nombre : nombre.querySelector('input'),
    );
    await conNombre('Certificación 2027');
    await clic('asistente-siguiente');
    expect(document.activeElement?.id).toBe('t-paso-2');
    await clic('asistente-atras');
    expect(document.activeElement?.id).toBe('t-paso-1');
  });

  it('el paso 2 muestra la vista previa de ítems y revisores que sale de la API antes de crear nada', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await conNombre('Certificación 2027');
    await clic('asistente-siguiente');
    expect(paso()).toContain('Paso 2 de 4');
    const pedido = peticiones.find((p) => p.path === '/org/access-reviews/campaigns/preview');
    expect(pedido?.status).toBe(200);
    expect(pedido?.body).toMatchObject({
      name: 'Certificación 2027',
      kind: 'PERIODIC',
      scope: { kind: 'ORGANIZATION' },
    });
    expect(typeof (pedido?.body as { dueAt: string }).dueAt).toBe('string');
    expect(texto('vista-previa-total')).toMatch(/\d+ accesos? por revisar/);
    expect(texto('vista-previa-revisores')).toContain('Administración de seguridad');
    expect(byId('vista-previa-lista')).not.toBeNull();
    // Nada se creó todavía.
    expect(campanas.todos().some((c) => c.name === 'Certificación 2027')).toBe(false);
  });

  it('cambiar un filtro vuelve a calcular la vista previa', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await conNombre('Certificación 2027');
    await clic('asistente-siguiente');
    olvidarPeticiones();
    await elegir('filtro-sensibilidad', 'Alta o crítica');
    const pedido = peticiones.find((p) => p.path === '/org/access-reviews/campaigns/preview');
    expect(pedido?.body).toMatchObject({ filters: { minSensitivity: 'HIGH' } });
  });

  it('si con ese alcance no hay nada que revisar lo dice y no deja seguir (S4)', async () => {
    await abrir([...provideGovernanceMock('hospital_piloto')]);
    vi.spyOn(TestBed.inject(AccessReviewsClient), 'previewCampaign').mockReturnValue(
      of({ total: 0, byReviewerKind: {}, withoutReviewer: 0, items: [] }),
    );
    await conNombre('Certificación 2027');
    await clic('asistente-siguiente');
    expect(host().textContent).toContain('Con ese alcance y esos filtros no hay nada que revisar');
    expect(byId('asistente-siguiente')!.getAttribute('aria-disabled')).toBe('true');
    await clic('asistente-siguiente');
    expect(paso()).toContain('Paso 2 de 4');
  });

  it('avisa cuántos accesos no tienen revisor elegible', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    vi.spyOn(TestBed.inject(AccessReviewsClient), 'previewCampaign').mockReturnValue(
      of({
        total: 3,
        byReviewerKind: { ADMIN: 2, DOCTOR_OWNER: 1 },
        withoutReviewer: 1,
        items: [],
      }),
    );
    await conNombre('Certificación 2027');
    await clic('asistente-siguiente');
    expect(texto('vista-previa-sin-revisor')).toContain('1 acceso no tiene quien lo revise');
    expect(texto('vista-previa-revisores')).toContain('Doctor responsable');
  });

  it('un alcance por servicio ofrece los servicios de la organización y exige elegir al menos uno', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await conNombre('Solo ecografía');
    await elegir('campana-alcance', 'Por servicio');
    await clic('asistente-siguiente');
    expect(texto('campana-error-scope')).toContain('Elija al menos un servicio');
    const primero = host().querySelector('[data-testid^="alcance-servicio-"]') as HTMLElement;
    expect(primero).not.toBeNull();
    (primero.querySelector('input') as HTMLInputElement).click();
    await refrescar();
    await clic('asistente-siguiente');
    expect(paso()).toContain('Paso 2 de 4');
    const pedido = peticiones.find((p) => p.path === '/org/access-reviews/campaigns/preview');
    expect(
      (pedido?.body as { scope: { kind: string; healthcareServiceIds: string[] } }).scope.kind,
    ).toBe('SERVICE');
    expect(
      (pedido?.body as { scope: { healthcareServiceIds: string[] } }).scope.healthcareServiceIds,
    ).toHaveLength(1);
  });

  it('el paso 3 no acepta una fecha pasada', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await conNombre('Certificación 2027');
    await clic('asistente-siguiente');
    await clic('asistente-siguiente');
    expect(paso()).toContain('Paso 3 de 4');
    await escribir('campana-fecha', '2020-01-01');
    await clic('asistente-siguiente');
    expect(texto('campana-error-dueDate')).toContain('La fecha límite debe ser de hoy en adelante');
    expect(paso()).toContain('Paso 3 de 4');
  });

  it('una campaña de cambio de rol solo escala: no ofrece quitar lo no certificado', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await conNombre('Cambio de rol de Ana');
    await elegir('campana-tipo', 'Cambio de rol');
    await clic('asistente-siguiente');
    await clic('asistente-siguiente');
    expect(byId('campana-accion-escalar')).not.toBeNull();
    expect(byId('campana-accion-revocar')).toBeNull();
  });

  it('el paso 4 resume todo y «Crear y lanzar» crea, lanza, vuelve a leer y lleva al seguimiento', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await hastaElPaso4();
    expect(paso()).toContain('Paso 4 de 4');
    expect(texto('resumen-nombre')).toContain('Certificación 2027');
    expect(texto('resumen-alcance')).toContain('Toda la organización');
    expect(texto('resumen-no-certificado')).toContain('se quita');
    expect(texto('resumen-items')).toMatch(/\d+ accesos?/);

    olvidarPeticiones();
    await clic('campana-crear-lanzar');

    const orden = peticiones
      .filter((p) => p.method === 'POST')
      .map((p) => p.path.replace(/[0-9a-f-]{36}/, ':id'));
    expect(orden).toEqual([
      '/org/access-reviews/campaigns',
      '/org/access-reviews/campaigns/:id/launch',
    ]);
    const creada = campanas.todos().find((c) => c.name === 'Certificación 2027')!;
    expect(creada.status).toBe('OPEN');
    expect(itemsDeRevision.filtrar((i) => i.campaignId === creada.id).length).toBeGreaterThan(0);
    expect(TestBed.inject(Router).url).toBe(
      `/administration/access-governance/campaigns/${creada.id}`,
    );
  });

  it('«Crear como borrador» solo crea: no lanza', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await hastaElPaso4('Borrador 2027');
    olvidarPeticiones();
    await clic('campana-crear-borrador');
    expect(peticiones.filter((p) => p.method === 'POST').map((p) => p.path)).toEqual([
      '/org/access-reviews/campaigns',
    ]);
    const creada = campanas.todos().find((c) => c.name === 'Borrador 2027')!;
    expect(creada.status).toBe('DRAFT');
    expect(TestBed.inject(Router).url).toBe(
      `/administration/access-governance/campaigns/${creada.id}`,
    );
  });

  it('si ya hay una campaña igual en curso la API lo rechaza (409), la pantalla lo explica y no se pierde el recorrido', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await hastaElPaso4('Certificación Q4-2026');
    olvidarPeticiones();
    await clic('campana-crear-lanzar');
    expect(peticiones.find((p) => p.method === 'POST')?.status).toBe(409);
    expect(texto('campana-error')).toContain('Ya existe una campaña igual en curso');
    expect(paso()).toContain('Paso 4 de 4');
    expect(TestBed.inject(Router).url).toBe('/administration/access-governance/campaigns/new');
    expect(campanas.todos().filter((c) => c.name === 'Certificación Q4-2026')).toHaveLength(1);
  });

  it('si la campaña se creó pero no se pudo lanzar, queda como borrador y se ofrece abrirla', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await hastaElPaso4('Se crea y no se lanza');
    vi.spyOn(TestBed.inject(AccessReviewsClient), 'launchCampaign').mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: {
              statusCode: 500,
              code: 'INTERNAL',
              message: 'x',
              correlationId: 'req-321',
              timestamp: '',
              path: '/x',
            },
          }),
      ),
    );
    await clic('campana-crear-lanzar');
    expect(texto('campana-error')).toContain('se creó como borrador');
    expect(texto('campana-error')).toContain('req-321');
    const creada = campanas.todos().find((c) => c.name === 'Se crea y no se lanza')!;
    expect(creada.status).toBe('DRAFT');
    expect(byId('campana-abrir-borrador')?.getAttribute('href')).toBe(
      `/administration/access-governance/campaigns/${creada.id}`,
    );
  });

  it('un delegado sin «quitar permisos»: la API rechaza quitar por vencimiento (403 ADMIN_CEILING_EXCEEDED, AUTO_REVOKE) y la pantalla lo dice junto al campo, sin ofrecer más «quitar»', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await hastaElPaso4('Campaña de un delegado');
    const crear = vi.spyOn(TestBed.inject(AccessReviewsClient), 'createCampaign').mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: {
              statusCode: 403,
              code: 'FORBIDDEN',
              message:
                'Su perfil no le permite quitar permisos: la campaña no puede revocar por vencimiento. Elija «escalar» o pida a un administrador de seguridad.',
              reason: 'ADMIN_CEILING_EXCEEDED',
              details: { breach: 'AUTO_REVOKE', reason: 'ADMIN_CEILING_EXCEEDED' },
              timestamp: '',
              path: '/x',
            },
          }),
      ),
    );
    await clic('campana-crear-lanzar');

    // Vuelve al paso donde se elige qué pasa con lo que nadie certifique, con el mensaje junto a ese campo.
    expect(paso()).toContain('Paso 3 de 4');
    expect(texto('campana-error-uncertifiedAction')).toContain('no le permite quitar permisos');
    expect(texto('campana-error-uncertifiedAction')).toContain('administrador de seguridad');
    expect(byId('campana-accion-revocar')).toBeNull();
    expect(byId('campana-accion-escalar')).not.toBeNull();
    expect(texto('campana-error-uncertifiedAction')).not.toMatch(/ADMIN_CEILING_EXCEEDED|AUTO_REVOKE/);

    // Con «escalar» (la única opción) la campaña se puede crear: no repite el pedido que se sabe rechazado.
    crear.mockRestore();
    await clic('asistente-siguiente');
    await clic('campana-crear-lanzar');
    const enviado = peticiones.find((p) => p.method === 'POST' && p.path === '/org/access-reviews/campaigns');
    expect(enviado?.body).toMatchObject({ uncertifiedAction: 'UNCERTIFIED_ESCALATE' });
  });

  it('un 403 ADMIN_CEILING_EXCEEDED de otro tipo (no AUTO_REVOKE) no cambia el recorrido: se explica arriba', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await hastaElPaso4('Otra campaña');
    vi.spyOn(TestBed.inject(AccessReviewsClient), 'createCampaign').mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: {
              statusCode: 403,
              code: 'FORBIDDEN',
              message: 'Eso excede lo que usted puede dar.',
              reason: 'ADMIN_CEILING_EXCEEDED',
              details: { breach: 'CONDITION_LOOSENED', reason: 'ADMIN_CEILING_EXCEEDED' },
              timestamp: '',
              path: '/x',
            },
          }),
      ),
    );
    await clic('campana-crear-lanzar');
    expect(paso()).toContain('Paso 4 de 4');
    expect(texto('campana-error')).toContain('Eso excede lo que usted puede dar');
  });

  it('se puede volver a un paso anterior sin perder lo escrito', async () => {
    await abrir(provideGovernanceMock('hospital_piloto'));
    await conNombre('Certificación 2027');
    await clic('asistente-siguiente');
    await clic('asistente-atras');
    expect(paso()).toContain('Paso 1 de 4');
    expect((byId('campana-nombre') as HTMLInputElement).value).toBe('Certificación 2027');
  });

  it('si no se pueden leer los doctores y servicios, explica el fallo con el código de soporte (S9)', async () => {
    const getCatalog = () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: {
              statusCode: 500,
              code: 'INTERNAL',
              message: 'x',
              correlationId: 'req-404',
              timestamp: '',
              path: '/x',
            },
          }),
      );
    await abrir([
      {
        provide: SupportAccessClient,
        useValue: { getCatalog, listEngagements: () => of({ items: [] }) },
      },
      { provide: AccessReviewsClient, useValue: {} },
    ]);
    expect(host().textContent).toContain('req-404');
  });
});
