import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PracticeSitesClient } from './practice-sites.client';
import type { PracticeSitePage } from './practice-sites.types';

describe('PracticeSitesClient', () => {
  let client: PracticeSitesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(PracticeSitesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide los consultorios del profesional, no los de la práctica', () => {
    client.listSitesOfPractitioner('prac-1').subscribe();

    const req = http.expectOne((r) => r.url === '/practitioners/prac-1/sites');
    expect(req.request.method).toBe('GET');

    req.flush({ items: [], count: 0 });
  });

  it('escapa el identificador en la ruta', () => {
    client.listSitesOfPractitioner('prac/1').subscribe();

    http.expectOne((r) => r.url === '/practitioners/prac%2F1/sites').flush({ items: [], count: 0 });
  });

  it('devuelve la sede con su dirección ya compuesta', () => {
    let pagina: PracticeSitePage | null = null;
    client.listSitesOfPractitioner('prac-1').subscribe((p) => (pagina = p));

    http.expectOne((r) => r.url === '/practitioners/prac-1/sites').flush({
      items: [
        {
          id: 'site-1',
          practiceId: 'pr-1',
          code: 'CC',
          name: 'Consultorio Central',
          timeZone: 'America/La_Paz',
          addressText: 'Av. Brasil 1234, La Paz',
          status: 'st-1',
        },
      ],
      count: 1,
    });

    expect(pagina!.items[0].addressText).toBe('Av. Brasil 1234, La Paz');
  });

  /**
   * Vacío es «no tiene consultorio registrado», no un error. Se fija acá para
   * que ninguna pantalla lo traduzca a un estado de fallo.
   */
  it('acepta la lista vacía como respuesta válida', () => {
    let pagina: PracticeSitePage | null = null;
    client.listSitesOfPractitioner('prac-1').subscribe((p) => (pagina = p));

    http
      .expectOne((r) => r.url === '/practitioners/prac-1/sites')
      .flush({ items: [], count: 0 });

    expect(pagina!.count).toBe(0);
  });

  describe('Carril 18 — mis organizaciones', () => {
    it('listMyRoleAssignments pide /practitioners/me/role-assignments y normaliza opcionales', () => {
      let vinculaciones: readonly unknown[] = [];
      client
        .listMyRoleAssignments()
        .subscribe((items) => (vinculaciones = items));

      http.expectOne((r) => r.url === '/practitioners/me/role-assignments').flush([
        {
          id: 'role-1',
          practiceId: 'practice-1',
          practiceName: 'Clínica Central',
          practiceType: null,
          practiceSiteId: null,
          roleConceptId: 'role-attending',
          specialtyConceptId: null,
          status: 'status-pending',
          isPrimary: false,
          validFrom: '2026-01-01',
          validTo: null,
          createdAt: '2026-01-01T12:00:00.000Z',
        },
      ]);

      expect(vinculaciones).toEqual([
        {
          id: 'role-1',
          practiceId: 'practice-1',
          practiceName: 'Clínica Central',
          roleConceptId: 'role-attending',
          status: 'status-pending',
          isPrimary: false,
          validFrom: new Date(2026, 0, 1),
          createdAt: new Date('2026-01-01T12:00:00.000Z'),
        },
      ]);
      expect('practiceType' in (vinculaciones[0] as object)).toBe(false);
      expect('validTo' in (vinculaciones[0] as object)).toBe(false);
    });

    it('selfRequestAffiliation postea al practiceId dado y devuelve el estado PENDING', () => {
      let resultado: unknown;
      client
        .selfRequestAffiliation('practice-1', { roleConceptId: 'role-attending' })
        .subscribe((r) => (resultado = r));

      const req = http.expectOne(
        (r) => r.url === '/practices/practice-1/role-assignments/self-request',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ roleConceptId: 'role-attending' });
      req.flush({
        id: 'role-1',
        practiceId: 'practice-1',
        practitionerProfileId: 'prof-1',
        status: 'status-pending',
        createdAt: '2026-01-01T12:00:00.000Z',
      });

      expect(resultado).toEqual({
        id: 'role-1',
        practiceId: 'practice-1',
        practitionerProfileId: 'prof-1',
        status: 'status-pending',
        createdAt: new Date('2026-01-01T12:00:00.000Z'),
      });
    });
  });
});
