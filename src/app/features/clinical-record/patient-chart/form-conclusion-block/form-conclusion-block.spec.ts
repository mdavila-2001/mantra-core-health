import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { FormConclusionBlock, type CierreDelFormulario } from './form-conclusion-block';

/**
 * Lo que estas pruebas fijan (D4):
 *
 * 1. **Todo lo elige quien atiende, a mano.** No hay sugerencias de IA ni se
 *    consulta ningún servicio fuera del catálogo de la plataforma.
 * 2. **Elegir emite el cierre**, con el concepto de la categoría cuando el
 *    catálogo lo publica.
 * 3. **Una orden sin categoría no se emite**: se dice qué falta.
 */

/** El catálogo, como lo publica `GET /system-context/dynamic-enums` por target. */
const CATALOGOS: Readonly<
  Record<string, readonly { conceptId: string; code: string; display: string }[]>
> = {
  'clinical.conditions.code_concept_id': [
    { conceptId: 'dx-j069', code: 'J06.9', display: 'Infección respiratoria aguda' },
  ],
  'clinical.service_requests.code_concept_id': [
    { conceptId: 'st-hemograma', code: 'STUDY-HEMOGRAMA', display: 'Hemograma completo' },
  ],
  'clinical.service_requests.category_concept_id': [
    { conceptId: 'cat-lab', code: 'SRQ-LAB', display: 'Laboratorio' },
    { conceptId: 'cat-imaging', code: 'SRQ-IMAGING', display: 'Imagenología' },
  ],
};

describe('FormConclusionBlock', () => {
  let fixture: ComponentFixture<FormConclusionBlock>;
  let componente: FormConclusionBlock;
  let http: HttpTestingController;
  let emitidos: CierreDelFormulario[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FormConclusionBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('nombreDeFicha', 'Ficha de cardiología');
    emitidos = [];
    componente.cierre.subscribe((cierre) => emitidos.push(cierre));
    fixture.detectChanges();
    responderCatalogos();
    fixture.detectChanges();
  });

  afterEach(() => {
    // Any request other than the catalog ones fails here: no AI service is called.
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function html(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** Responde los catálogos que piden los selectores y el bloque (memoizados por target). */
  function responderCatalogos(): void {
    for (const peticion of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      const target = peticion.request.params.get('target') ?? '';
      peticion.flush({
        code: target,
        name: target,
        definitionId: `def-${target}`,
        valueSetId: `vs-${target}`,
        options: (CATALOGOS[target] ?? []).map((opcion, ordinal) => ({ ...opcion, ordinal })),
      });
    }
  }

  it('sin IA: no sugiere nada, solo ofrece elegir a mano', () => {
    expect(html().textContent).not.toMatch(/\bIA\b/);
    expect(html().querySelector('[data-testid="cierre-tentativos"]')).toBeNull();
    expect(html().querySelector('[data-testid="cierre-disclaimer"]')).toBeNull();
    expect(html().querySelectorAll('app-concept-select')).toHaveLength(2);
    expect(html().textContent).toContain('Ficha de cardiología');
  });

  it('elegir el diagnóstico a mano emite el cierre', () => {
    interno<(id: string | null) => void>('elegirDiagnostico')('dx-j069');

    expect(emitidos.at(-1)).toEqual({ diagnostico: 'dx-j069', orden: null });
    expect(componente.tieneCambiosPendientes()).toBe(true);
  });

  it('límite: un estudio elegido sin categoría no viaja, y se dice qué falta', () => {
    interno<(id: string | null) => void>('elegirEstudio')('st-hemograma');
    fixture.detectChanges();

    expect(emitidos.at(-1)).toEqual({ diagnostico: null, orden: null });
    expect(html().querySelector('[data-testid="cierre-orden-incompleta"]')).not.toBeNull();

    interno<(c: 'LAB' | 'IMAGING' | 'OTHER' | null) => void>('elegirCategoria')('LAB');
    fixture.detectChanges();
    expect(emitidos.at(-1)?.orden).toEqual({
      codeConceptId: 'st-hemograma',
      category: 'LAB',
      categoryConceptId: 'cat-lab',
    });
    expect(html().querySelector('[data-testid="cierre-orden-incompleta"]')).toBeNull();
  });
});
