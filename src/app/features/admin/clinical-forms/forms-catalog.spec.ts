import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormsCatalog } from './forms-catalog';
import type { ChartTemplate } from '../../../core/data-access/chart-templates/chart-templates.types';

/**
 * Carril R2-5, punto 5 del reclamo: «NO ESTAN LOS FORMULARIOS … Y DEBE ESTAR
 * CATALOGADO.» Lo que se prueba acá es exactamente eso: que agrupe por
 * especialidad, que la procedencia esté en el catálogo, y que las dos acciones
 * sean el motor que ya existía.
 */
const ORIGEN = {
  sourceTitle: 'Historia Clínica Perinatal',
  organization: 'CLAP/SMR — OPS/OMS',
  url: 'https://iris.paho.org/handle/10665.2/17048',
  license: 'CC BY-NC-SA 3.0 IGO',
  retrievedAt: '2026-08-14',
};

function plantilla(over: Partial<ChartTemplate> = {}): ChartTemplate {
  return {
    id: 'tpl-1',
    specialtyConceptId: 'esp-cardio',
    code: 'CARDIO_FICHA_BASE',
    name: 'Ficha cardiológica',
    version: 1,
    statusConceptId: 'st-1',
    fields: [],
    ...over,
  };
}

describe('FormsCatalog', () => {
  let fixture: ComponentFixture<FormsCatalog>;
  let componente: FormsCatalog;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FormsCatalog);
    componente = fixture.componentInstance;
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function peticionDelCatalogo() {
    return http.expectOne((r) => r.url === '/charts/templates' && r.method === 'GET');
  }

  function peticionDeEtiquetas() {
    return http.expectOne((r) => r.url === '/terminology/concepts' && r.method === 'GET');
  }

  it('pide el catálogo entero, sin filtrar por especialidad', () => {
    const req = peticionDelCatalogo();

    // El filtro de arriba es de la pantalla de armado; el catálogo agrupa, así
    // que necesita todas.
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('agrupa por especialidad y traduce el concept id a su nombre', () => {
    peticionDelCatalogo().flush([
      plantilla({ id: 'a', specialtyConceptId: 'esp-cardio', name: 'Ficha cardiológica' }),
      plantilla({ id: 'b', specialtyConceptId: 'esp-pedia', name: 'Control de niño sano' }),
      plantilla({ id: 'c', specialtyConceptId: 'esp-cardio', name: 'Riesgo cardiovascular' }),
    ]);

    peticionDeEtiquetas().flush({
      items: [
        { conceptId: 'esp-cardio', display: 'Cardiología', code: 'C' },
        { conceptId: 'esp-pedia', display: 'Pediatría', code: 'P' },
      ],
    });

    const grupos = interno<() => readonly { titulo: string; formularios: unknown[] }[]>('grupos')();
    expect(grupos.map((g) => g.titulo)).toEqual(['Cardiología', 'Pediatría']);
    expect(grupos[0].formularios).toHaveLength(2);
    expect(interno<() => number>('total')()).toBe(3);
  });

  it('si terminología no resuelve, agrupa igual y usa el id como título', () => {
    peticionDelCatalogo().flush([plantilla()]);
    peticionDeEtiquetas().error(new ProgressEvent('error'));

    const grupos = interno<() => readonly { titulo: string }[]>('grupos')();
    // Un fallo leyendo metadatos no puede dejar el catálogo en error: los
    // formularios están, y son lo que el cliente pidió ver.
    expect(grupos).toHaveLength(1);
    expect(grupos[0].titulo).toBe('esp-cardio');
  });

  it('«usar esta plantilla» la asigna como predeterminada', () => {
    peticionDelCatalogo().flush([plantilla({ id: 'tpl-9' })]);
    peticionDeEtiquetas().flush({ items: [] });

    interno<(p: ChartTemplate) => void>('usar')(plantilla({ id: 'tpl-9' }));

    const req = http.expectOne(
      (r) => r.url === '/charts/templates/tpl-9/assignments' && r.method === 'POST',
    );
    expect(req.request.body).toEqual({ isDefault: true });
    req.flush({ id: 'as-1', templateId: 'tpl-9', isDefault: true, statusConceptId: 'st-1' });

    expect(interno<() => string | null>('asignando')()).toBeNull();
  });

  it('«duplicar para adaptar» emite el formulario y no llama a la API', () => {
    peticionDelCatalogo().flush([plantilla()]);
    peticionDeEtiquetas().flush({ items: [] });

    const emitidas: ChartTemplate[] = [];
    componente.duplicar.subscribe((p) => emitidas.push(p));

    interno<(p: ChartTemplate) => void>('adaptar')(plantilla({ id: 'tpl-7' }));

    expect(emitidas).toHaveLength(1);
    expect(emitidas[0].id).toBe('tpl-7');
    // Duplicar es del motor de alta, no un endpoint nuevo.
    http.expectNone((r) => r.method === 'POST');
  });

  it('el vistazo del esquema corta a seis campos y dice cuántos quedan', () => {
    const campos = Array.from({ length: 9 }, (_, i) => ({
      assignmentId: `a${i}`,
      fieldId: `f${i}`,
      code: `campo_${i}`,
      name: `Campo ${i}`,
      dataType: 'string',
      required: false,
    }));
    const con9 = plantilla({ fields: campos });

    peticionDelCatalogo().flush([con9]);
    peticionDeEtiquetas().flush({ items: [] });

    expect(interno<(p: ChartTemplate) => readonly string[]>('vistazo')(con9)).toHaveLength(6);
    expect(interno<(p: ChartTemplate) => number>('restantes')(con9)).toBe(3);
  });

  it('una plantilla con procedencia la conserva para pintarla', () => {
    const conOrigen = plantilla({ provenance: ORIGEN });

    peticionDelCatalogo().flush([conOrigen]);
    peticionDeEtiquetas().flush({ items: [] });

    const grupos =
      interno<() => readonly { formularios: readonly ChartTemplate[] }[]>('grupos')();
    expect(grupos[0].formularios[0].provenance?.organization).toBe('CLAP/SMR — OPS/OMS');
    expect(grupos[0].formularios[0].provenance?.url).toMatch(/^https:\/\//);
  });
});
