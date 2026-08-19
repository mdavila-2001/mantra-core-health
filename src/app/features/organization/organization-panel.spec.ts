import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OrganizationPanel } from './organization-panel';

/**
 * El panel de la organización — TP-1.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **La pantalla se abre sola**: pregunta por «mis organizaciones» y no
 *    necesita que nadie le pase un identificador. Ese era el callejón que
 *    impedía que existiera.
 * 2. **No pertenecer a ninguna no es un error**: es que la pantalla no le
 *    corresponde, y se dice con esas palabras en vez de con un fallo.
 * 3. **El permiso lo dice el servidor**: con `canAdminister` en falso no
 *    aparece la forma de editar. Deducirlo acá daría dos definiciones de
 *    «administra esta organización» que se separan.
 * 4. **Sin aprobar se avisa**: quien administra tiene que enterarse de que su
 *    organización todavía no aparece en las búsquedas de pacientes.
 */
describe('OrganizationPanel', () => {
  let fixture: ComponentFixture<OrganizationPanel>;
  let http: HttpTestingController;

  const MIAS = '/tenants/me';

  /** Una organización del actor, con lo que la pantalla mira de ella. */
  function organizacion(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ten-1',
      code: 'CLIN-1',
      legalName: 'Clínica del Centro SRL',
      tradeName: 'Clínica del Centro',
      tenantTypeConceptId: 'tt-1',
      statusConceptId: 'st-1',
      verificationStatusConceptId: 'vr-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      myRoleConceptId: 'rol-admin',
      canAdminister: true,
      isVerified: true,
      timeZone: 'America/La_Paz',
      ...overrides,
    };
  }

  function montar(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OrganizationPanel);
    fixture.detectChanges();
  }

  /** Responde «mis organizaciones» y, si hay alguna, su gente y su bandeja. */
  function responder(items: unknown[], solicitudes: unknown[] = []): void {
    http.expectOne((r) => r.url === MIAS).flush({ items });
    fixture.detectChanges();
    if (items.length === 0) return;

    http
      .expectOne((r) => r.url.includes('/memberships'))
      .flush({ items: [], count: 0, limit: 50, nextCursor: null });
    fixture.detectChanges();
    http.expectOne((r) => r.url.includes('/practitioner-requests')).flush({ items: solicitudes });
    fixture.detectChanges();
  }

  /** Una solicitud de vínculo esperando decisión. */
  function solicitud(overrides: Record<string, unknown> = {}) {
    return {
      id: 'af-1',
      practitionerProfileId: 'pp-1',
      organizationName: 'Clínica del Centro',
      roleTitle: 'Médico de planta',
      practiceSiteId: 'sede-1',
      startDate: '2026-03-01T00:00:00.000Z',
      statusConceptId: 'st-pendiente',
      createdAt: '2026-02-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  afterEach(() => http?.verify());

  it('pregunta por las organizaciones del actor sin que nadie le pase un id', () => {
    montar();

    const pedido = http.expectOne((r) => r.url === MIAS);
    expect(pedido.request.method).toBe('GET');
    pedido.flush({ items: [] });
    fixture.detectChanges();
  });

  it('sin organizaciones lo dice, en vez de mostrar un fallo', () => {
    montar();
    responder([]);

    expect(texto()).toContain('No administrás ninguna organización');
  });

  it('muestra los datos de la organización y su gente', () => {
    montar();
    responder([organizacion()]);

    expect(texto()).toContain('Datos de tu organización');
    expect(texto()).toContain('Su gente');
  });

  /**
   * El `staff` ve su organización y no la edita: es la distinción que decide
   * si la pantalla ofrece guardar. Los datos siguen a la vista —saber qué tiene
   * su organización es parte de trabajar en ella—; lo que desaparece es la
   * forma de cambiarlos.
   */
  it('quien no administra ve los datos pero no la forma de guardarlos', () => {
    montar();
    responder([organizacion({ canAdminister: false })]);

    expect(texto()).toContain('Clínica del Centro SRL');
    expect(texto()).toContain('hace falta ser administrador');
    expect(texto()).not.toContain('Guardar datos');
  });

  it('quien administra sí puede guardar', () => {
    montar();
    responder([organizacion()]);

    expect(texto()).toContain('Guardar datos');
  });

  it('avisa cuando la organización todavía no está aprobada', () => {
    montar();
    responder([organizacion({ isVerified: false })]);

    expect(texto()).toContain('Todavía no está aprobada');
    expect(texto()).toContain('Pendiente de aprobación');
  });

  it('una organización aprobada no muestra el aviso', () => {
    montar();
    responder([organizacion()]);

    expect(texto()).not.toContain('Todavía no está aprobada');
    expect(texto()).toContain('Aprobada');
  });

  /**
   * Con una sola no hay nada que elegir; el selector sería una fila de un botón
   * que no hace nada.
   */
  it('con una sola organización no ofrece elegir', () => {
    montar();
    responder([organizacion()]);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.organizacion__selector'),
    ).toBeNull();
  });

  it('con varias ofrece elegir entre todas', () => {
    montar();
    responder([organizacion(), organizacion({ id: 'ten-2', tradeName: 'Centro Médico Norte' })]);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.organizacion__selector'),
    ).not.toBeNull();
    expect(texto()).toContain('Centro Médico Norte');
  });

  /* -- Solicitudes de médicos (TP-2) ---------------------------------------- */

  it('pide la bandeja de solicitudes de la organización elegida', () => {
    montar();
    http.expectOne((r) => r.url === MIAS).flush({ items: [organizacion()] });
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.includes('/memberships'))
      .flush({ items: [], count: 0, limit: 50, nextCursor: null });
    fixture.detectChanges();

    const pedido = http.expectOne((r) => r.url.includes('/practitioner-requests'));
    expect(pedido.request.url).toBe('/tenants/ten-1/practitioner-requests');
    pedido.flush({ items: [] });
    fixture.detectChanges();
  });

  it('sin solicitudes pendientes lo dice', () => {
    montar();
    responder([organizacion()]);

    expect(texto()).toContain('No hay solicitudes pendientes');
  });

  it('muestra cada solicitud con su cargo y desde cuándo', () => {
    montar();
    responder([organizacion()], [solicitud()]);

    expect(texto()).toContain('Médico de planta');
    expect(texto()).toContain('Aprobar');
    expect(texto()).toContain('Rechazar');
  });

  /**
   * El staff ve quién pidió trabajar ahí —es información legítima de su
   * trabajo— pero no decide. La API igual lo rechazaría; acá se evita ofrecer
   * un botón que va a fallar.
   */
  it('quien no administra ve las solicitudes pero no decide', () => {
    montar();
    responder([organizacion({ canAdminister: false })], [solicitud()]);

    expect(texto()).toContain('Médico de planta');
    expect(texto()).not.toContain('Aprobar');
  });

  it('aprobar manda la decisión y recarga la bandeja', () => {
    montar();
    responder([organizacion()], [solicitud()]);

    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Aprobar'));
    boton?.click();
    fixture.detectChanges();

    const decision = http.expectOne(
      (r) => r.url === '/tenants/ten-1/practitioner-requests/af-1/approve',
    );
    expect(decision.request.method).toBe('POST');
    decision.flush(null);
    fixture.detectChanges();

    // Se vuelve a pedir la bandeja en vez de sacar la fila a mano: si alguien
    // más decidió mientras tanto, sacarla localmente mostraría algo que ya no
    // está.
    http.expectOne((r) => r.url.includes('/practitioner-requests')).flush({ items: [] });
    fixture.detectChanges();
  });

  it('rechazar manda la decisión al endpoint de rechazo', () => {
    montar();
    responder([organizacion()], [solicitud()]);

    const boton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Rechazar'));
    boton?.click();
    fixture.detectChanges();

    http.expectOne((r) => r.url === '/tenants/ten-1/practitioner-requests/af-1/reject').flush(null);
    fixture.detectChanges();
    http.expectOne((r) => r.url.includes('/practitioner-requests')).flush({ items: [] });
    fixture.detectChanges();
  });
});
