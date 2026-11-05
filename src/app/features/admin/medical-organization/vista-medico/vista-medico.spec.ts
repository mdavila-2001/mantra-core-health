import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { MedicalOrganization } from '../medical-organization';

const RUTA = '/administration/medical-organization';

/**
 * «Mis organizaciones» del médico: sin las pestañas ni el recuadro de
 * cobertura de una organización que no administra, con la lista de a cuáles
 * pertenece y el buzón de solicitudes de ingreso.
 */
describe('MedicalOrganization — vista del médico', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function montar(perfilProfesional: string | null): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administration/medical-organization', component: MedicalOrganization }]),
      ],
    });
    // `practitionerProfileId` es un `computed` del token; acá basta con fijarlo.
    (TestBed.inject(SessionStore) as unknown as { practitionerProfileId: () => string | null }).practitionerProfileId =
      () => perfilProfesional;
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(RUTA, MedicalOrganization);
  }

  afterEach(() => http.verify());

  const texto = (): string => harness.routeNativeElement?.textContent ?? '';
  const rotulos = (): string[] =>
    Array.from(harness.routeNativeElement!.querySelectorAll('[role="tab"]')).map(
      (t) => t.textContent?.trim() ?? '',
    );

  /** Responde `/practices` —la pide el panel y la pestaña— y las vinculaciones del médico. */
  function resolver(practicas: object[] = [], estado?: { status: number; statusText: string }): void {
    for (const pedido of http.match('/practices')) {
      if (estado) pedido.flush({ code: 'FORBIDDEN', message: 'No administra' }, estado);
      else pedido.flush(practicas);
    }
    for (const pedido of http.match('/practitioners/me/role-assignments')) pedido.flush([]);
    harness.detectChanges();
  }

  it('un médico sin organizaciones propias ve sólo «Mis organizaciones» y el buzón', async () => {
    await montar('hp-1');
    resolver();

    expect(rotulos()).toEqual(['Mis organizaciones', 'Solicitudes de ingreso']);
    expect(texto()).not.toContain('Qué administra esta pantalla y qué no');
    expect(texto()).not.toContain('Esta pestaña depende de la organización');
    expect(texto()).not.toContain('Sedes');
  });

  it('un 403 al listar las prácticas es la misma vista del médico', async () => {
    await montar('hp-1');
    resolver([], { status: 403, statusText: 'Forbidden' });

    expect(rotulos()).toEqual(['Mis organizaciones', 'Solicitudes de ingreso']);
  });

  it('la pestaña «Solicitudes de ingreso» abre el buzón y pide las vinculaciones', async () => {
    await montar('hp-1');
    resolver();

    (harness.routeNativeElement!.querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    harness.detectChanges();
    http.expectOne('/practitioners/me/role-assignments').flush([]);
    harness.detectChanges();

    expect(texto()).toContain('No tiene solicitudes ni invitaciones de ingreso');
  });

  it('un médico que además tiene un consultorio sigue viendo sólo las dos pestañas', async () => {
    await montar('hp-1');
    resolver([{ id: 'prac-1', code: 'HC', name: 'Hospital Central', status: 'activa' }]);
    for (const pedido of http.match('/practices/prac-1/organization')) {
      pedido.flush({
        organization: { id: 'prac-1', code: 'HC', name: 'Hospital Central', type: null, status: null, timeZone: null, currency: null },
        sites: [],
        clinicalUnits: [],
        careSpaces: [],
        healthcareServices: [],
        staff: [],
        legalDocuments: [],
        inventory: [],
      });
    }
    harness.detectChanges();

    expect(rotulos()).toEqual(['Mis organizaciones', 'Solicitudes de ingreso']);
    expect(texto()).not.toContain('Qué administra esta pantalla y qué no');
  });

  it('una cuenta sin perfil profesional y sin prácticas conserva el vacío con «Dar de alta»', async () => {
    await montar(null);
    http.expectOne('/practices').flush([]);
    harness.detectChanges();

    expect(rotulos()).not.toContain('Solicitudes de ingreso');
    expect(texto()).toContain('Dar de alta la organización');
  });
});
