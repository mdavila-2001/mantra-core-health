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

  /** Responde «mis organizaciones» y, si hay alguna, su gente. */
  function responder(items: unknown[]): void {
    http.expectOne((r) => r.url === MIAS).flush({ items });
    fixture.detectChanges();
    if (items.length > 0) {
      http
        .expectOne((r) => r.url.includes('/memberships'))
        .flush({ items: [], count: 0, limit: 50, nextCursor: null });
      fixture.detectChanges();
    }
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
    responder([
      organizacion(),
      organizacion({ id: 'ten-2', tradeName: 'Centro Médico Norte' }),
    ]);

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.organizacion__selector'),
    ).not.toBeNull();
    expect(texto()).toContain('Centro Médico Norte');
  });

  /** El hueco que llena TP-2 se anuncia, para que nadie lo busque en otro lado. */
  it('anuncia las solicitudes de médicos como lo que viene', () => {
    montar();
    responder([organizacion()]);

    expect(texto()).toContain('Solicitudes de médicos');
  });
});
