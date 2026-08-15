import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MedicalOrganizationClient } from './medical-organization.client';
import type {
  MedicalOrganizationConsole,
  PracticeSummary,
} from './medical-organization.types';

const CONCEPTO = { code: 'PR_TYPE_CLINIC', display: 'Clínica' };

const CONSOLA: MedicalOrganizationConsole = {
  organization: {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'HOSP-CENTRAL',
    name: 'Hospital Central',
    type: CONCEPTO,
    status: { code: 'PR_ACTIVE', display: 'Activa' },
    timeZone: 'America/La_Paz',
    currency: null,
  },
  sites: [],
  clinicalUnits: [],
  careSpaces: [],
  healthcareServices: [],
  staff: [],
  legalDocuments: [],
  inventory: [],
};

describe('MedicalOrganizationClient', () => {
  let client: MedicalOrganizationClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(MedicalOrganizationClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide las prácticas al prefijo que el proxy ya declara', () => {
    let practicas: readonly PracticeSummary[] = [];
    client.listPractices().subscribe((result) => (practicas = result));

    const req = http.expectOne('/practices');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: '11111111-1111-4111-8111-111111111111',
        code: 'HOSP-CENTRAL',
        name: 'Hospital Central',
        status: 'activa',
      },
    ]);

    expect(practicas).toHaveLength(1);
  });

  it('trae el árbol entero en una sola petición', () => {
    let consola: MedicalOrganizationConsole | undefined;
    client
      .getConsole('11111111-1111-4111-8111-111111111111')
      .subscribe((result) => (consola = result));

    // Una petición y no siete: las siete listas cuelgan del mismo ámbito y se
    // miran juntas, así que encadenarlas sería carga sin beneficio.
    const req = http.expectOne(
      '/practices/11111111-1111-4111-8111-111111111111/organization',
    );
    expect(req.request.method).toBe('GET');
    req.flush(CONSOLA);

    expect(consola?.organization.name).toBe('Hospital Central');
  });

  it('escapa el identificador antes de pegarlo a la ruta', () => {
    client.getConsole('prac/uno').subscribe();

    http.expectOne('/practices/prac%2Funo/organization').flush(CONSOLA);
  });
});
