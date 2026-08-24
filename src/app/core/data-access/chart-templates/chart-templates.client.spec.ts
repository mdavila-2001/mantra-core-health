import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ChartTemplatesClient } from './chart-templates.client';
import type { ChartTemplate } from './chart-templates.types';

const PLANTILLA: ChartTemplate = {
  id: 'tpl-1',
  specialtyConceptId: 'sp-1',
  code: 'CARDIO_INTAKE',
  name: 'Ficha de cardiología',
  version: 1,
  statusConceptId: 'st-1',
  fieldTargetConceptId: 'target-1',
  fields: [],
};

describe('ChartTemplatesClient', () => {
  let client: ChartTemplatesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(ChartTemplatesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('listTemplates sin especialidad no manda ninguna clave', () => {
    client.listTemplates().subscribe();

    const req = http.expectOne((r) => r.url === '/charts/templates');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);

    req.flush([PLANTILLA]);
  });

  it('listTemplates con especialidad manda specialtyId', () => {
    let recibidas: readonly ChartTemplate[] | undefined;
    client.listTemplates('sp-1').subscribe((r) => (recibidas = r));

    const req = http.expectOne((r) => r.url === '/charts/templates');
    expect(req.request.params.get('specialtyId')).toBe('sp-1');

    req.flush([PLANTILLA]);
    expect(recibidas).toEqual([PLANTILLA]);
  });

  it('getTemplate pide la plantilla por id', () => {
    let recibida: ChartTemplate | undefined;
    client.getTemplate('tpl-1').subscribe((r) => (recibida = r));

    const req = http.expectOne((r) => r.url === '/charts/templates/tpl-1');
    expect(req.request.method).toBe('GET');

    req.flush(PLANTILLA);
    expect(recibida).toEqual(PLANTILLA);
  });

  it('createTemplate manda el esquema completo y devuelve la plantilla creada', () => {
    let creada: ChartTemplate | undefined;
    const input = {
      specialtyConceptId: 'sp-1',
      code: 'CARDIO_INTAKE',
      name: 'Ficha de cardiología',
      fields: [{ code: 'f1', name: 'Campo 1', dataType: 'string' }],
    };
    client.createTemplate(input).subscribe((r) => (creada = r));

    const req = http.expectOne((r) => r.url === '/charts/templates');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);

    req.flush(PLANTILLA);
    expect(creada).toEqual(PLANTILLA);
  });
});
